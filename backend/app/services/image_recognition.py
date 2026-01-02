"""Image recognition service using Gemini Vision API"""

import json
from pathlib import Path
from typing import BinaryIO

from google import genai
from google.genai import types

from app.config import settings


def get_mime_type(filename: str) -> str:
    """Get MIME type from file extension"""
    suffix = Path(filename).suffix.lower()

    mime_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".heic": "image/heic",
        ".heif": "image/heif",
    }

    return mime_types.get(suffix, "image/jpeg")


DEFAULT_CATEGORIES = [
    "エアコン・空調",
    "洗濯・乾燥",
    "キッチン",
    "給湯・暖房",
    "掃除",
    "住宅設備",
    "その他",
]


async def analyze_appliance_image(
    image_bytes: bytes,
    filename: str,
    existing_categories: list[str] | None = None
) -> dict:
    """
    Analyze appliance image to extract manufacturer and model number.

    Args:
        image_bytes: Image file bytes
        filename: Original filename (for MIME type detection)
        existing_categories: List of existing category names to choose from

    Returns:
        dict: Analysis result with manufacturer, model_number, category, etc.
    """
    # Initialize Gemini client
    client = genai.Client(api_key=settings.gemini_api_key)

    # Create image part
    mime_type = get_mime_type(filename)
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    # Use provided categories or default
    categories = existing_categories if existing_categories else DEFAULT_CATEGORIES
    categories_str = "\n".join(f"- {cat}" for cat in categories)

    prompt = f"""この画像は家電製品または住宅設備の写真です。

## タスク
画像から以下の情報を抽出してください。

### 1. 型番ラベルが見える場合
型番・メーカー名を正確に読み取ってください。

### 2. 型番ラベルが見えない/読めない場合
【重要】型番を推測・予測しないでください。
代わりに以下を行ってください：
- メーカーをロゴや外観から特定
- 製品カテゴリを特定
- 型番ラベルの位置を具体的に案内（撮り直しガイド）

## カテゴリの選択について
以下の既存カテゴリから最適なものを選んでください：
{categories_str}

既存カテゴリに適切なものがない場合のみ、新しいカテゴリ名を提案してください。
その場合は `is_new_category: true` を設定してください。

## 出力形式（JSON）

型番が読み取れた場合:
{{
  "status": "success",
  "manufacturer": {{"ja": "メーカー名", "en": "Manufacturer"}},
  "model_number": "読み取った型番",
  "category": "既存カテゴリ名または新規カテゴリ名",
  "is_new_category": false,
  "confidence": "high"
}}

型番が読み取れない場合:
{{
  "status": "need_label_photo",
  "manufacturer": {{"ja": "メーカー名", "en": "Manufacturer"}},
  "model_number": null,
  "category": "既存カテゴリ名または新規カテゴリ名",
  "is_new_category": false,
  "confidence": "medium",
  "label_guide": {{
    "locations": [
      {{"position": "具体的な位置", "description": "詳細説明", "priority": 1}},
      {{"position": "別の候補位置", "description": "詳細説明", "priority": 2}}
    ],
    "photo_tips": "撮影のコツ（明るさ、角度など）"
  }}
}}

JSON形式のみで回答してください。"""

    # Call Gemini 2.0 Flash
    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=[image_part, prompt]
    )

    # Parse response
    response_text = response.text.strip()

    # Extract JSON block (handles ```json ... ``` format)
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        json_lines = []
        in_json = False
        for line in lines:
            if line.startswith("```json"):
                in_json = True
                continue
            elif line.startswith("```"):
                in_json = False
                continue
            if in_json:
                json_lines.append(line)
        response_text = "\n".join(json_lines)

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError as e:
        result = {
            "raw_response": response_text,
            "error": f"JSON parse error: {str(e)}"
        }

    return result
