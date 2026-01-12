"""Image recognition service using Gemini Vision API"""

import json
from pathlib import Path

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
    image_bytes: bytes, filename: str, existing_categories: list[str] | None = None
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

## 画像状態の判定

まず、画像の状態を以下から判定してください：
1. **ラベル明瞭**: 型番・メーカーが明確に読める → "status": "success"
2. **ラベル部分的**: 一部見えるが全体は不明 → "status": "need_label_photo"
3. **ラベル不明瞭**: 汚れ・反射等で読めない → "status": "need_label_photo"
4. **ラベル非表示**: ラベルが写っていない → "status": "need_label_photo"
5. **本体のみ**: ロゴからメーカー推測可能 → "status": "need_label_photo"

## タスク

### 型番ラベルが見える場合（状態1）
型番・メーカー名を**正確に**読み取ってください。

### 型番ラベルが見えない/読めない場合（状態2〜5）
【重要】**型番を推測・予測しないでください**。model_number は必ず null にしてください。
代わりに以下を行ってください：
- メーカーをロゴや外観から特定
- 製品カテゴリを特定
- 型番ラベルの位置を具体的に案内（撮り直しガイド）

## メーカー名について

旧ブランド名は現在のブランド名に変換してください：
- National → パナソニック / Panasonic
- SANYO → パナソニック / Panasonic（家電部門吸収後）
- 東芝EMI → 東芝 / Toshiba

## カテゴリの選択について
以下の既存カテゴリから最適なものを選んでください：
{categories_str}

既存カテゴリに適切なものがない場合のみ、新しいカテゴリ名を提案してください。
その場合は `is_new_category: true` を設定してください。

## 良い抽出例

◯ 例1: ラベルが明確に読める
画像: エアコン室内機のラベル、「Panasonic CS-X283D」と記載
→ {{"status": "success", "manufacturer": {{"ja": "パナソニック", "en": "Panasonic"}}, "model_number": "CS-X283D", "confidence": "high"}}

◯ 例2: メーカーロゴのみ見える
画像: 洗濯機の操作パネル、「HITACHI」ロゴあり、型番不明
→ {{"status": "need_label_photo", "manufacturer": {{"ja": "日立", "en": "Hitachi"}}, "model_number": null, "label_guide": {{...}}}}

◯ 例3: 旧ブランド名
画像: エアコン、「National」ロゴ
→ {{"manufacturer": {{"ja": "パナソニック", "en": "Panasonic"}}}} ← 現在のブランド名に変換

## 悪い抽出例（避けてください）

✕ 例1: 見えないのに型番を推測
画像: 型番ラベルが反射で読めない
NG: {{"model_number": "ABC-123"}} ← 推測で型番を生成している
OK: {{"status": "need_label_photo", "model_number": null, ...}}

✕ 例2: 旧ブランド名をそのまま使用
画像: 「National」ロゴ
NG: {{"manufacturer": {{"ja": "ナショナル", "en": "National"}}}}
OK: {{"manufacturer": {{"ja": "パナソニック", "en": "Panasonic"}}}}

✕ 例3: 部分的に見える型番を補完
画像: 「CS-X28」まで見えて最後の文字が切れている
NG: {{"model_number": "CS-X283D"}} ← 推測で補完している
OK: {{"status": "need_label_photo", "model_number": null, ...}}

## 出力形式（JSON）

型番が読み取れた場合:
{{
  "status": "success",
  "manufacturer": {{"ja": "メーカー名", "en": "Manufacturer"}},
  "model_number": "読み取った型番（完全に読めた場合のみ）",
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
        model="gemini-2.5-flash", contents=[image_part, prompt]
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
        result = {"raw_response": response_text, "error": f"JSON parse error: {str(e)}"}

    return result
