"""Maintenance item extraction service using Gemini"""

import json
import tempfile
import time
from pathlib import Path

import requests
from google import genai
from google.genai import types

from app.config import settings


def get_gemini_client():
    """Get Gemini client instance"""
    return genai.Client(api_key=settings.gemini_api_key)


async def upload_pdf_to_gemini(client, pdf_bytes: bytes, filename: str):
    """
    Upload PDF to Gemini API.

    Args:
        client: Gemini client
        pdf_bytes: PDF file bytes
        filename: Original filename

    Returns:
        Uploaded file object
    """
    # Save to temporary file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        file = client.files.upload(
            file=tmp_path,
            config=types.UploadFileConfig(
                display_name=Path(filename).stem,
                mime_type='application/pdf'
            )
        )

        # Wait for processing
        while file.state.name == 'PROCESSING':
            time.sleep(2)
            file = client.files.get(name=file.name)

        if file.state.name == 'FAILED':
            raise Exception(f"File processing failed: {file.state.name}")

        return file

    finally:
        # Clean up temporary file
        import os
        os.unlink(tmp_path)


async def download_pdf_from_url(pdf_url: str) -> bytes:
    """
    Download PDF from URL.

    Args:
        pdf_url: URL of the PDF

    Returns:
        PDF file bytes
    """
    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(pdf_url, headers=headers, timeout=30, stream=True)
    response.raise_for_status()

    # Verify Content-Type
    content_type = response.headers.get("Content-Type", "")
    if "pdf" not in content_type.lower():
        raise ValueError(f"URL does not point to PDF: {content_type}")

    return response.content


async def extract_maintenance_items(
    pdf_source: bytes | str,
    manufacturer: str = None,
    model_number: str = None,
    category: str = None,
    source_filename: str = "manual.pdf"
) -> dict:
    """
    Extract maintenance items from manual PDF.

    Args:
        pdf_source: Either PDF bytes or URL string
        manufacturer: Manufacturer name (optional, will be extracted if not provided)
        model_number: Model number (optional, will be extracted if not provided)
        category: Product category (optional)
        source_filename: Filename for PDF bytes source

    Returns:
        dict with product info, maintenance_items list, and notes
    """
    client = get_gemini_client()

    # Handle PDF source (bytes or URL)
    if isinstance(pdf_source, str):
        # URL provided - download first
        pdf_bytes = await download_pdf_from_url(pdf_source)
        uploaded_file = await upload_pdf_to_gemini(client, pdf_bytes, "manual.pdf")
    else:
        # Bytes provided
        uploaded_file = await upload_pdf_to_gemini(client, pdf_source, source_filename)

    # Build product info section
    product_info_text = ""
    if manufacturer:
        product_info_text += f"- メーカー: {manufacturer}\n"
    if model_number:
        product_info_text += f"- 型番: {model_number}\n"
    if category:
        product_info_text += f"- カテゴリ: {category}\n"

    if not product_info_text:
        product_info_text = "（不明 - PDFから抽出してください）"

    prompt = f"""この取扱説明書から、定期的なメンテナンス・お手入れ項目を抽出してください。

## 製品情報
{product_info_text}

## 抽出対象
1. **定期的なお手入れ・清掃項目**
   - フィルター清掃、内部清掃、外装清掃など
   - 推奨周期（毎日、週1回、月1回、年1回など）

2. **定期点検・交換項目**
   - 消耗品の交換（フィルター、パッキンなど）
   - 推奨交換周期

3. **安全確認項目**
   - 定期的に確認すべき安全関連項目

## 出力形式（JSON）
```json
{{
    "product": {{
        "manufacturer": "メーカー名",
        "model_number": "型番",
        "category": "カテゴリ"
    }},
    "maintenance_items": [
        {{
            "item_name": "項目名（例: 庫内の清掃）",
            "description": "詳細説明",
            "frequency": "周期（例: 使用後毎回, 週1回, 月1回, 年1回）",
            "frequency_days": 周期を日数で表現（毎日=1, 週1回=7, 月1回=30, 年1回=365）,
            "category": "cleaning/inspection/replacement/safety",
            "importance": "high/medium/low",
            "page_reference": "記載ページ（わかる場合）"
        }}
    ],
    "notes": "抽出時の補足事項"
}}
```

## 注意事項
- 取扱説明書に明記されている項目のみを抽出してください
- 推測や一般的なアドバイスは含めないでください
- 周期が明記されていない場合は「適宜」または「必要に応じて」と記載してください
"""

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[uploaded_file, prompt]
    )

    response_text = response.text.strip()

    # Extract JSON
    if "```json" in response_text:
        start = response_text.find("```json") + 7
        end = response_text.find("```", start)
        response_text = response_text[start:end].strip()
    elif "```" in response_text:
        start = response_text.find("```") + 3
        end = response_text.find("```", start)
        response_text = response_text[start:end].strip()

    try:
        result = json.loads(response_text)
        return result
    except json.JSONDecodeError as e:
        return {
            "error": f"JSON parse error: {str(e)}",
            "raw_response": response_text[:1000]
        }
