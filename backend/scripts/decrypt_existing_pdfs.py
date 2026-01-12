"""
既存の暗号化PDFを検出して解除するスクリプト

Usage:
    cd backend
    uv run python scripts/decrypt_existing_pdfs.py [--dry-run]

このスクリプトは以下を行います:
1. shared_appliances テーブルから stored_pdf_path が設定されている全レコードを取得
2. 各PDFをダウンロードして暗号化状態をチェック
3. オーナーパスワードで暗号化されている場合は解除して再アップロード
4. ユーザーパスワードで解除不可の場合は is_pdf_encrypted = TRUE に設定
5. 暗号化されていない場合は is_pdf_encrypted = FALSE を確認
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.pdf_decryption import decrypt_pdf
from app.services.pdf_storage import MANUALS_BUCKET
from app.services.supabase_client import get_supabase_client

# リトライ設定
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5


async def get_all_stored_pdfs() -> list[dict]:
    """stored_pdf_pathが設定されている全家電を取得"""
    client = get_supabase_client()
    if not client:
        print("ERROR: Supabase client not available")
        return []

    result = (
        client.table("shared_appliances")
        .select("id, maker, model_number, stored_pdf_path, is_pdf_encrypted")
        .not_.is_("stored_pdf_path", "null")
        .execute()
    )
    return result.data or []


def download_from_storage(storage_path: str) -> bytes | None:
    """Supabase StorageからPDFをダウンロード"""
    client = get_supabase_client()
    if not client:
        return None

    try:
        return client.storage.from_(MANUALS_BUCKET).download(storage_path)
    except Exception as e:
        print(f"  Download failed: {storage_path} - {e}")
        return None


def upload_to_storage(content: bytes, storage_path: str) -> bool:
    """Supabase StorageにPDFをアップロード（リトライ付き）"""
    import time

    client = get_supabase_client()
    if not client:
        return False

    file_size_mb = len(content) / (1024 * 1024)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(
                f"  Uploading ({file_size_mb:.1f}MB, attempt {attempt}/{MAX_RETRIES})...",
                end=" ",
            )
            client.storage.from_(MANUALS_BUCKET).upload(
                path=storage_path,
                file=content,
                file_options={
                    "content-type": "application/pdf",
                    "upsert": "true",
                },
            )
            print("OK")
            return True
        except Exception as e:
            error_msg = str(e)
            print(f"Failed: {error_msg[:50]}...")
            if attempt < MAX_RETRIES:
                print(f"  Retrying in {RETRY_DELAY_SECONDS} seconds...")
                time.sleep(RETRY_DELAY_SECONDS)
            else:
                print(f"  Upload failed after {MAX_RETRIES} attempts: {storage_path}")
                return False
    return False


def update_encryption_flag(appliance_id: str, is_encrypted: bool) -> bool:
    """shared_appliancesテーブルのis_pdf_encryptedフラグを更新"""
    client = get_supabase_client()
    if not client:
        return False

    try:
        client.table("shared_appliances").update({"is_pdf_encrypted": is_encrypted}).eq(
            "id", appliance_id
        ).execute()
        return True
    except Exception as e:
        print(f"  Flag update failed: {appliance_id} - {e}")
        return False


async def process_pdf(appliance: dict, dry_run: bool) -> dict:
    """1つのPDFを処理"""
    appliance_id = appliance["id"]
    storage_path = appliance["stored_pdf_path"]
    maker = appliance["maker"]
    model = appliance["model_number"]
    current_flag = appliance.get("is_pdf_encrypted", False)

    # ダウンロード
    pdf_content = download_from_storage(storage_path)
    if not pdf_content:
        return {"status": "download_failed", "path": storage_path}

    # 暗号化チェック & 解除試行
    decrypted, was_decrypted, still_encrypted = decrypt_pdf(pdf_content)

    if not was_decrypted and not still_encrypted:
        # 元々暗号化されていない
        # フラグが正しく設定されているか確認
        if current_flag:
            if not dry_run:
                update_encryption_flag(appliance_id, False)
            return {"status": "not_encrypted_flag_fixed", "path": storage_path}
        return {"status": "not_encrypted", "path": storage_path}

    if still_encrypted:
        # ユーザーパスワードで解除不可 → フラグを立てる
        if not dry_run:
            update_encryption_flag(appliance_id, True)
        return {
            "status": "cannot_decrypt",
            "path": storage_path,
            "maker": maker,
            "model": model,
        }

    # 解除成功 → 再アップロード & フラグをFalseに
    if not dry_run:
        if upload_to_storage(decrypted, storage_path):
            update_encryption_flag(appliance_id, False)
        else:
            return {
                "status": "upload_failed",
                "path": storage_path,
                "maker": maker,
                "model": model,
            }

    return {
        "status": "decrypted",
        "path": storage_path,
        "maker": maker,
        "model": model,
        "original_size": len(pdf_content),
        "new_size": len(decrypted),
    }


async def main(dry_run: bool = False):
    print(f"=== PDF Decryption Script {'(DRY RUN)' if dry_run else ''} ===\n")

    appliances = await get_all_stored_pdfs()
    print(f"Found {len(appliances)} appliances with stored PDFs\n")

    if not appliances:
        print("No PDFs to process.")
        return

    results = {
        "not_encrypted": 0,
        "not_encrypted_flag_fixed": 0,
        "decrypted": 0,
        "cannot_decrypt": 0,
        "download_failed": 0,
        "upload_failed": 0,
    }
    decrypted_list = []
    cannot_decrypt_list = []

    for i, app in enumerate(appliances, 1):
        print(
            f"[{i}/{len(appliances)}] {app['maker']} {app['model_number']}...", end=" "
        )
        result = await process_pdf(app, dry_run)
        status = result["status"]
        print(status)
        results[status] = results.get(status, 0) + 1

        if status == "decrypted":
            decrypted_list.append(result)
        elif status == "cannot_decrypt":
            cannot_decrypt_list.append(result)

    print("\n=== Summary ===")
    print(f"Not encrypted: {results['not_encrypted']}")
    print(f"Not encrypted (flag fixed): {results['not_encrypted_flag_fixed']}")
    print(f"Decrypted successfully: {results['decrypted']}")
    print(f"Cannot decrypt (user password): {results['cannot_decrypt']}")
    print(f"Download failed: {results['download_failed']}")
    print(f"Upload failed: {results['upload_failed']}")

    if decrypted_list:
        print("\n=== Decrypted PDFs ===")
        for item in decrypted_list:
            size_change = item["new_size"] - item["original_size"]
            sign = "+" if size_change > 0 else ""
            print(
                f"  - {item['maker']} {item['model']} ({item['original_size']:,} -> {item['new_size']:,} bytes, {sign}{size_change:,})"
            )

    if cannot_decrypt_list:
        print("\n=== Cannot Decrypt (User Password Protected) ===")
        for item in cannot_decrypt_list:
            print(f"  - {item['maker']} {item['model']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Decrypt existing encrypted PDFs in Supabase Storage"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Check only, don't modify anything",
    )
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))
