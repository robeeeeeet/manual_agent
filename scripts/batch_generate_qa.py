#!/usr/bin/env python3
"""
QAマークダウン一括生成スクリプト

既存のPDFを持つ家電に対して、QAマークダウンを一括生成します。

Phase 6: QAマークダウン方式の実装に伴い、既存データに対してQAを生成。

使用方法:
    cd backend && uv run python ../scripts/batch_generate_qa.py [オプション]

オプション:
    --limit N       処理する最大件数（デフォルト: 100）
    --delay N       API呼び出し間の遅延秒数（デフォルト: 2）
    --force         既存のQAがある場合も再生成
    --dry-run       実際の生成を行わずに、対象を確認

注意:
    - .env ファイルに SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY が必要
    - Gemini API のレート制限に注意（デフォルトで2秒の遅延）
    - 大量のPDFを処理する場合はコストに注意
"""

import argparse
import asyncio
import logging
import os
import sys
import time
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


def get_gemini_api_key() -> str:
    """Gemini APIキーを取得"""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY must be set")
    return key


def get_qa_path_from_pdf_path(stored_pdf_path: str) -> str:
    """PDFパスからQAファイルパスを生成"""
    # mfr_xxx/model/manual.pdf → mfr_xxx/model/qa.md
    if stored_pdf_path.endswith("/manual.pdf"):
        return stored_pdf_path.replace("/manual.pdf", "/qa.md")
    # 旧形式の場合（念のため）
    elif stored_pdf_path.endswith(".pdf"):
        return stored_pdf_path[:-4] + "/qa.md"
    return stored_pdf_path + "/qa.md"


def check_qa_exists(supabase: Client, stored_pdf_path: str) -> bool:
    """QAファイルが存在するか確認"""
    qa_path = get_qa_path_from_pdf_path(stored_pdf_path)
    try:
        supabase.storage.from_(MANUALS_BUCKET).download(qa_path)
        return True
    except Exception:
        return False


async def generate_qa_for_appliance(
    supabase: Client,
    appliance: dict,
    gemini_api_key: str,
    dry_run: bool,
) -> bool:
    """1つの家電に対してQAを生成"""
    from google import genai
    from google.genai import types
    from datetime import datetime, timezone

    appliance_id = appliance["id"]
    manufacturer = appliance["maker"]  # DBカラム名は "maker"
    model_number = appliance["model_number"]
    stored_pdf_path = appliance["stored_pdf_path"]
    category = appliance.get("category", "")

    logger.info(f"Processing: {manufacturer} {model_number}")

    if dry_run:
        logger.info("  [DRY-RUN] Would generate QA")
        return True

    try:
        # PDFをダウンロード
        pdf_bytes = supabase.storage.from_(MANUALS_BUCKET).download(stored_pdf_path)
        logger.info(f"  Downloaded PDF: {len(pdf_bytes)} bytes")

        # QA生成プロンプト
        qa_prompt = """
この製品の説明書PDFを読んで、よくある質問（FAQ）をMarkdown形式で生成してください。

## 出力フォーマット（厳守）:

## 操作・設定
### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]

## お手入れ・メンテナンス
### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]

## トラブルシューティング
### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]

## 仕様・その他
### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]

## 要件:
- 各カテゴリに3〜5件の質問を含めてください
- ユーザーが実際に聞きそうな実用的な質問を選んでください
- 回答は簡潔かつ具体的に
- 必ず参照ページ番号を含めてください
- 説明書に記載がない内容は含めないでください
"""

        # Gemini APIでQA生成
        client = genai.Client(api_key=gemini_api_key)

        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                        types.Part.from_text(text=qa_prompt),
                    ],
                ),
            ],
        )

        qa_content = response.text
        logger.info(f"  Generated QA: {len(qa_content)} chars")

        # ヘッダーを追加
        now = datetime.now(timezone.utc).isoformat()
        header = f"""---
appliance_id: {appliance_id}
manufacturer: {manufacturer}
model_number: {model_number}
generated_at: {now}
last_updated_at: {now}
---

# {manufacturer} {model_number} よくある質問

"""
        footer = "\n\n## ユーザー追加QA\n"
        full_content = header + qa_content + footer

        # QAファイルを保存
        qa_path = get_qa_path_from_pdf_path(stored_pdf_path)
        supabase.storage.from_(MANUALS_BUCKET).upload(
            qa_path,
            full_content.encode("utf-8"),
            {"content-type": "text/plain", "upsert": "true"}
        )
        logger.info(f"  Saved QA: {qa_path}")

        return True

    except Exception as e:
        logger.error(f"  Error: {e}")
        return False


async def main_async(args):
    """メイン処理（非同期）"""
    print("=" * 80)
    print("QAマークダウン一括生成")
    print("=" * 80)

    if args.dry_run:
        print()
        print("  *** DRY-RUN モード: 実際の生成は行いません ***")

    print()

    try:
        supabase = get_supabase_client()
        logger.info("Supabase接続成功")

        gemini_api_key = get_gemini_api_key()
        logger.info("Gemini APIキー確認成功")
    except Exception as e:
        logger.error(f"初期化失敗: {e}")
        sys.exit(1)

    # PDFを持つ家電を取得
    result = supabase.table("shared_appliances").select("*").not_.is_("stored_pdf_path", "null").limit(args.limit).execute()
    appliances = result.data or []

    logger.info(f"対象家電数: {len(appliances)}")

    if not appliances:
        logger.info("処理対象がありません")
        return

    # 処理実行
    success_count = 0
    skip_count = 0
    error_count = 0

    for i, appliance in enumerate(appliances):
        manufacturer = appliance["maker"]  # DBカラム名は "maker"
        model_number = appliance["model_number"]
        stored_pdf_path = appliance["stored_pdf_path"]

        # 既存QAチェック
        if not args.force and check_qa_exists(supabase, stored_pdf_path):
            logger.info(f"[{i+1}/{len(appliances)}] Skip (QA exists): {manufacturer} {model_number}")
            skip_count += 1
            continue

        logger.info(f"[{i+1}/{len(appliances)}] Processing: {manufacturer} {model_number}")

        success = await generate_qa_for_appliance(
            supabase,
            appliance,
            gemini_api_key,
            args.dry_run,
        )

        if success:
            success_count += 1
        else:
            error_count += 1

        # レート制限対策
        if i < len(appliances) - 1 and not args.dry_run:
            logger.info(f"  Waiting {args.delay}s before next request...")
            time.sleep(args.delay)

    print()
    print("=" * 80)
    print("結果サマリー")
    print("=" * 80)
    print(f"  合計: {len(appliances)}")
    print(f"  生成成功: {success_count}")
    print(f"  スキップ（既存QA）: {skip_count}")
    print(f"  エラー: {error_count}")
    print("=" * 80)

    if args.dry_run:
        print()
        print("これはDRY-RUNです。実際に生成するには --dry-run を外して実行してください。")


def main():
    parser = argparse.ArgumentParser(
        description="既存PDFに対してQAマークダウンを一括生成"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="処理する最大件数（デフォルト: 100）",
    )
    parser.add_argument(
        "--delay",
        type=int,
        default=2,
        help="API呼び出し間の遅延秒数（デフォルト: 2）",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="既存のQAがある場合も再生成",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際の生成を行わずに、対象を確認",
    )
    args = parser.parse_args()

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
