"""Maintenance item extraction service using Gemini"""

import json
import tempfile
import time
from pathlib import Path

import requests
from google import genai
from google.genai import types

from app.config import settings

# Valid category and importance values
VALID_CATEGORIES = {"cleaning", "inspection", "replacement"}
VALID_IMPORTANCES = {"high", "medium", "low"}


def sanitize_maintenance_item(item: dict) -> dict:
    """
    Sanitize a maintenance item to ensure it conforms to the expected schema.

    - frequency_days: ensure >= 1 (default: 30)
    - category: ensure single valid value (default: cleaning)
    - importance: ensure single valid value (default: medium)
    """
    sanitized = item.copy()

    # Sanitize frequency_days
    freq_days = sanitized.get("frequency_days", 0)
    if not isinstance(freq_days, int) or freq_days < 1:
        sanitized["frequency_days"] = 30  # Default to monthly

    # Sanitize category - handle cases like "cleaning/inspection"
    cat = sanitized.get("category", "")
    if isinstance(cat, str):
        # Take first valid category if multiple are provided
        for valid_cat in VALID_CATEGORIES:
            if valid_cat in cat.lower():
                sanitized["category"] = valid_cat
                break
        else:
            sanitized["category"] = "cleaning"  # Default
    else:
        sanitized["category"] = "cleaning"

    # Sanitize importance - handle cases like "high/medium"
    imp = sanitized.get("importance", "")
    if isinstance(imp, str):
        for valid_imp in VALID_IMPORTANCES:
            if valid_imp in imp.lower():
                sanitized["importance"] = valid_imp
                break
        else:
            sanitized["importance"] = "medium"  # Default
    else:
        sanitized["importance"] = "medium"

    return sanitized


def sanitize_extraction_result(result: dict) -> dict:
    """Sanitize the entire extraction result."""
    if "maintenance_items" in result and isinstance(result["maintenance_items"], list):
        result["maintenance_items"] = [
            sanitize_maintenance_item(item) for item in result["maintenance_items"]
        ]
    return result


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
                display_name=Path(filename).stem, mime_type="application/pdf"
            ),
        )

        # Wait for processing
        while file.state.name == "PROCESSING":
            time.sleep(2)
            file = client.files.get(name=file.name)

        if file.state.name == "FAILED":
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
    source_filename: str = "manual.pdf",
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

    prompt = f"""この取扱説明書から、**定期的に実施すべきメンテナンス・お手入れ作業**を抽出してください。

## 製品情報
{product_info_text}

## 抽出対象（ユーザーが実際に手を動かして行う作業のみ）

1. **清掃作業**
   - フィルター清掃、内部清掃、外装の拭き掃除など
   - 例: 「フィルターを取り外して水洗いする」「庫内を拭き掃除する」

2. **点検作業**
   - 部品の状態確認、動作確認など
   - 例: 「電源コードの傷みを確認する」「排水口の詰まりを確認する」

3. **交換作業**
   - 消耗品の交換（フィルター、パッキン、電池など）
   - 例: 「浄水フィルターを交換する」「乾電池を交換する」

## 除外対象（以下は抽出しないでください）

- **利用上の注意・禁止事項**: 「～しないでください」「～は禁止」
- **安全上のご注意を読む**: 読むだけで作業を伴わないもの
- **設置・移動に関する確認**: 設置場所の確認、製品の移動
- **一般的な注意喚起**: 「異常があれば使用を中止」「修理は販売店へ」
- **製品の分解・修理**: 「分解しないでください」「修理は専門店へ」
- **使い方の説明**: 操作方法、機能の説明
- **トラブルシューティング**: 故障時の対応

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
            "description": "具体的な作業内容",
            "frequency": "周期（例: 使用後毎回, 週1回, 月1回, 年1回）",
            "frequency_days": 周期を日数で表現（毎日=1, 週1回=7, 月1回=30, 年1回=365。不明な場合は30）,
            "category": "cleaning か inspection か replacement のいずれか1つのみ",
            "importance": "high か medium か low のいずれか1つのみ",
            "page_reference": "記載ページ（わかる場合）"
        }}
    ],
    "notes": "抽出時の補足事項"
}}
```

## 重要なルール
- **実際に作業を伴う項目のみ**を抽出（「読む」「確認を怠らない」は対象外）
- category は cleaning, inspection, replacement のいずれか1つのみ選択
- importance は high, medium, low のいずれか1つのみ選択
- frequency_days は1以上の整数（周期不明の場合は30）
- 取扱説明書に明記されている項目のみを抽出
- 推測や一般的なアドバイスは含めない
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash", contents=[uploaded_file, prompt]
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
        # Sanitize the result to ensure it conforms to the schema
        result = sanitize_extraction_result(result)
        return result
    except json.JSONDecodeError as e:
        return {
            "error": f"JSON parse error: {str(e)}",
            "raw_response": response_text[:1000],
        }
