#!/usr/bin/env python3
"""
PDFストレージ構造マイグレーションスクリプト

現在の `mfr_xxx/model.pdf` 形式から新しい `mfr_xxx/model/manual.pdf` 形式に移行します。

Phase 6: QAマークダウン方式のための準備として、以下のフォルダ構造に移行:
  manuals/
  └── mfr_xxx/
      └── model/
          ├── manual.pdf      (説明書PDF)
          ├── qa.md           (QAマークダウン - 後で生成)
          └── text_cache.md   (テキストキャッシュ - 後で生成)

使用方法:
    cd backend && uv run python ../scripts/migrate_pdf_storage.py [--dry-run]

オプション:
    --dry-run   実際の変更を行わずに、実行内容を確認

注意:
    - .env ファイルに SUPABASE_URL, SUPABASE_SECRET_KEY が設定されている必要があります
    - マイグレーション前にバックアップを取ることを推奨します
"""

import argparse
import logging
import os
import sys
from pathlib import Path

# プロジェクトルートを追加
project_root = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
from supabase import create_client, Client

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# .env 読み込み
load_dotenv(Path(__file__).parent.parent / ".env")

MANUALS_BUCKET = "manuals"


def get_supabase_client() -> Client:
    """Supabaseクライアントを取得"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set")

    return create_client(url, key)


def get_shared_appliances_with_pdf(supabase: Client) -> list[dict]:
    """PDFが保存されている shared_appliances を取得"""
    result = supabase.table("shared_appliances").select("*").not_.is_("stored_pdf_path", "null").execute()
    return result.data or []


def is_old_format(path: str) -> bool:
    """旧形式（mfr_xxx/model.pdf）かどうか判定"""
    # 新形式は mfr_xxx/model/manual.pdf
    return path.endswith(".pdf") and "/manual.pdf" not in path


def convert_to_new_path(old_path: str) -> str:
    """旧パスを新パスに変換"""
    # mfr_xxx/model.pdf -> mfr_xxx/model/manual.pdf
    if old_path.endswith(".pdf"):
        base = old_path[:-4]  # .pdf を除去
        return f"{base}/manual.pdf"
    return old_path


def migrate_pdf(supabase: Client, appliance: dict, dry_run: bool) -> bool:
    """1つのPDFを移行"""
    old_path = appliance["stored_pdf_path"]
    appliance_id = appliance["id"]
    manufacturer = appliance["maker"]  # DBカラム名は "maker"
    model_number = appliance["model_number"]

    if not is_old_format(old_path):
        logger.info(f"  [SKIP] Already in new format: {old_path}")
        return True

    new_path = convert_to_new_path(old_path)

    logger.info(f"  [MIGRATE] {manufacturer} {model_number}")
    logger.info(f"    Old: {old_path}")
    logger.info(f"    New: {new_path}")

    if dry_run:
        logger.info("    [DRY-RUN] Would move file and update database")
        return True

    try:
        # 1. PDFをダウンロード
        pdf_bytes = supabase.storage.from_(MANUALS_BUCKET).download(old_path)

        # 2. 新しいパスにアップロード
        supabase.storage.from_(MANUALS_BUCKET).upload(
            new_path,
            pdf_bytes,
            {"content-type": "application/pdf", "upsert": "true"}
        )
        logger.info(f"    [OK] Uploaded to new path")

        # 3. shared_appliances テーブルを更新
        supabase.table("shared_appliances").update({
            "stored_pdf_path": new_path
        }).eq("id", appliance_id).execute()
        logger.info(f"    [OK] Updated database")

        # 4. 古いファイルを削除（オプション - コメントアウト可）
        supabase.storage.from_(MANUALS_BUCKET).remove([old_path])
        logger.info(f"    [OK] Removed old file")

        return True

    except Exception as e:
        logger.error(f"    [ERROR] Migration failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="PDFストレージ構造をPhase 6形式にマイグレーション"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際の変更を行わずに、実行内容を確認",
    )
    args = parser.parse_args()

    print("=" * 80)
    print("PDFストレージ構造マイグレーション")
    print("=" * 80)

    if args.dry_run:
        print()
        print("  *** DRY-RUN モード: 実際の変更は行いません ***")

    print()

    try:
        supabase = get_supabase_client()
        logger.info("Supabase接続成功")
    except Exception as e:
        logger.error(f"Supabase接続失敗: {e}")
        sys.exit(1)

    # PDFを持つ家電を取得
    appliances = get_shared_appliances_with_pdf(supabase)
    logger.info(f"PDFを持つ家電数: {len(appliances)}")

    if not appliances:
        logger.info("マイグレーション対象がありません")
        return

    # 移行実行
    success_count = 0
    skip_count = 0
    error_count = 0

    for appliance in appliances:
        if is_old_format(appliance["stored_pdf_path"]):
            if migrate_pdf(supabase, appliance, args.dry_run):
                success_count += 1
            else:
                error_count += 1
        else:
            skip_count += 1

    print()
    print("=" * 80)
    print("結果サマリー")
    print("=" * 80)
    print(f"  合計: {len(appliances)}")
    print(f"  移行成功: {success_count}")
    print(f"  スキップ（既に新形式）: {skip_count}")
    print(f"  エラー: {error_count}")
    print("=" * 80)

    if args.dry_run:
        print()
        print("これはDRY-RUNです。実際に移行するには --dry-run を外して実行してください。")


if __name__ == "__main__":
    main()
