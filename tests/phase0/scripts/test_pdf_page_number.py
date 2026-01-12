"""
PDFページ番号特定テスト

目的: LLMが「PDFビューアのページ番号」を正確に特定できるか検証

実行方法:
    cd /home/robert/applications/manual_agent/backend
    uv run python ../tests/phase0/scripts/test_pdf_page_number.py
"""

import asyncio
import os
import sys
import tempfile
import time

# backendディレクトリをパスに追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../backend"))

from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client

# プロジェクトルートの.envを読み込む
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

# 設定
STORAGE_PATH = "mfr_dd439e1b/NP-45EF1WAS/manual.pdf"
TARGET_ITEM = "残さいフィルターのお手入れ"
EXPECTED_PDF_PAGE = 14  # 期待するPDFページ番号
PRINTED_PAGE = 26  # 説明書に印刷されているページ番号

PROMPT = """このPDFを分析して、以下の質問に答えてください。

## 質問
「{target_item}」という内容が記載されているのは、**PDFの何ページ目**ですか？

## 重要な注意
- 「PDFのページ番号」とは、PDFビューア（Adobe Reader、ブラウザ等）で表示される **1から始まる連番** です
- 説明書に印刷されている「26ページ」等の番号ではありません
- PDFの1ページ目から数えて何枚目かを答えてください

## 回答形式
以下のJSON形式で回答してください:
```json
{{
    "target_item": "検索した項目名",
    "pdf_page_number": PDFのページ番号（数値）,
    "printed_page_number": "説明書に印刷されているページ番号（見つかれば）",
    "confidence": "high/medium/low",
    "notes": "補足説明"
}}
```
"""


async def main():
    # 環境変数チェック
    required_vars = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "GEMINI_API_KEY"]
    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        print(f"Error: Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

    # Supabaseクライアント初期化
    supabase = create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"]
    )

    # PDFダウンロード
    print(f"Downloading PDF from: {STORAGE_PATH}")
    response = supabase.storage.from_("manuals").download(STORAGE_PATH)
    pdf_bytes = response
    print(f"Downloaded {len(pdf_bytes):,} bytes")

    # Gemini初期化
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    # PDFを一時ファイルに保存してアップロード
    print("Uploading PDF to Gemini...")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        uploaded_file = client.files.upload(
            file=tmp_path,
            config=types.UploadFileConfig(
                display_name="manual", mime_type="application/pdf"
            ),
        )

        # 処理完了を待つ
        while uploaded_file.state.name == "PROCESSING":
            print("  Waiting for processing...")
            time.sleep(2)
            uploaded_file = client.files.get(name=uploaded_file.name)

        if uploaded_file.state.name == "FAILED":
            raise Exception(f"File processing failed: {uploaded_file.state.name}")

        print(f"Uploaded: {uploaded_file.name}")
    finally:
        os.unlink(tmp_path)

    # プロンプト送信
    print(f"\nSearching for: {TARGET_ITEM}")
    prompt = PROMPT.format(target_item=TARGET_ITEM)

    print("Sending request to Gemini...")
    response = client.models.generate_content(
        model="gemini-2.5-flash", contents=[uploaded_file, prompt]
    )

    print("\n" + "=" * 60)
    print("RESULT")
    print("=" * 60)
    print(response.text)
    print("\n" + "=" * 60)
    print(f"Expected PDF page: {EXPECTED_PDF_PAGE}")
    print(f"Printed page (in manual): {PRINTED_PAGE}")
    print("=" * 60)

    # 簡易判定
    if str(EXPECTED_PDF_PAGE) in response.text:
        print("\n✅ SUCCESS: LLM returned the correct PDF page number!")
    elif str(PRINTED_PAGE) in response.text:
        print("\n❌ FAILED: LLM returned the printed page number instead of PDF page")
    else:
        print("\n⚠️  UNCLEAR: Please check the response manually")


if __name__ == "__main__":
    asyncio.run(main())
