"""Maintenance item extraction service using Gemini"""

import json
import logging
import tempfile
import time
from pathlib import Path

import requests
from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# Valid category and importance values
VALID_CATEGORIES = {"cleaning", "inspection", "replacement"}
VALID_IMPORTANCES = {"high", "medium", "low"}


def sanitize_maintenance_item(item: dict) -> dict:
    """
    Sanitize a maintenance item to ensure it conforms to the expected schema.

    - frequency_days: ensure >= 0 (0 means "as needed", e.g., "汚れたら")
    - category: ensure single valid value (default: cleaning)
    - importance: ensure single valid value (default: medium)
    """
    sanitized = item.copy()

    # Sanitize frequency_days (0 is valid for "as needed" items)
    freq_days = sanitized.get("frequency_days", 30)
    if not isinstance(freq_days, int) or freq_days < 0:
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
            logger.error(f"Gemini file processing failed: {file.state.name}")
            raise Exception(f"File processing failed: {file.state.name}")

        logger.info(f"PDF uploaded to Gemini successfully: {filename}")
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
    logger.info(f"Downloading PDF from URL: {pdf_url}")
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(pdf_url, headers=headers, timeout=30, stream=True)
        response.raise_for_status()

        # Verify Content-Type
        content_type = response.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower():
            logger.warning(f"URL does not point to PDF: {content_type}, url={pdf_url}")
            raise ValueError(f"URL does not point to PDF: {content_type}")

        logger.info(f"PDF downloaded successfully: {len(response.content)} bytes")
        return response.content
    except requests.RequestException as e:
        logger.error(f"Failed to download PDF from {pdf_url}: {e}", exc_info=True)
        raise


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

## 抽出前チェックリスト（必須）

以下の**すべて**を満たす項目のみ抽出してください：
□ ユーザーが自分で実行できる作業である
□ 具体的な行動指示がある（動詞で終わる: 掃除する、確認する、交換する）
□ 定期的な実施が想定される（または「汚れたら」等の条件付き）

## 抽出対象（ユーザーが実際に手を動かして行う作業のみ）

1. **清掃作業** (category: cleaning)
   - フィルター清掃、内部清掃、外装の拭き掃除など
   - 例: 「フィルターを取り外して水洗いする」「庫内を拭き掃除する」

2. **点検作業** (category: inspection)
   - 部品の状態確認、動作確認など
   - 例: 「電源コードの傷みを確認する」「排水口の詰まりを確認する」

3. **交換作業** (category: replacement)
   - 消耗品の交換（フィルター、パッキン、電池など）
   - 例: 「浄水フィルターを交換する」「乾電池を交換する」

## 絶対に抽出しないもの（除外リスト）

以下に該当する項目は**絶対に抽出しないでください**：

✕ **禁止事項**: 「〜しないでください」「〜は禁止」「〜厳禁」「〜はおやめください」
✕ **専門家対応**: 「販売店へ」「修理業者に」「サービスに連絡」「お買い上げの販売店」
✕ **警告文のみ**: 「ご注意ください」「〜に気をつけて」「〜にご留意」
✕ **設置時の確認**: 「設置時に確認」「購入時に確認」「据付時に」
✕ **使用上の注意**: 「使用中は〜しない」「操作時は〜」「ご使用前に」
✕ **読むだけの項目**: 「安全上のご注意を読む」「取扱説明書をよく読む」
✕ **分解・改造**: 「分解しないでください」「改造しないでください」
✕ **異常時の対応**: 「異常があれば使用を中止」「故障かなと思ったら」
✕ **トラブルシューティング**: 故障診断、エラー対応

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
            "description": "<p>作業の概要説明</p><ol><li>手順1</li><li>手順2</li></ol>",
            "frequency": "周期（例: 使用後毎回, 週1回, 月1回, 年1回）",
            "frequency_days": 周期を日数で表現（毎日=1, 週1回=7, 月1回=30, 年1回=365。不明な場合は0）,
            "category": "cleaning か inspection か replacement のいずれか1つのみ",
            "importance": "high か medium か low のいずれか1つのみ",
            "pdf_page_number": PDFビューアで表示されるページ番号（1から始まる連番、数値）,
            "printed_page_number": "説明書に印刷されているページ番号（例: 26ページ）"
        }}
    ],
    "notes": "抽出時の補足事項"
}}
```

## description フィールドの書式（重要）

description は **HTML形式** で記述してください。

### 使用可能なHTMLタグ
- `<p>` - 段落（概要説明に使用）
- `<ol><li>` - 番号付きリスト（手順説明に使用、必須）
- `<ul><li>` - 箇条書きリスト（注意点の列挙など）
- `<strong>` - 強調テキスト
- `<h4>`, `<h5>` - 小見出し（複数の作業がある場合）
- `<br>` - 改行

### description の記述例
```html
<p>フィルターを取り外して清掃します。</p>
<ol>
<li>電源を切り、コンセントを抜く</li>
<li>フィルターカバーを外す</li>
<li>フィルターを取り出し、掃除機でホコリを吸い取る</li>
<li>汚れがひどい場合は水洗いし、完全に乾かす</li>
<li>フィルターを元に戻し、カバーを閉める</li>
</ol>
```

## 良い抽出例（参考にしてください）

◯ 例1: フィルター清掃
{{
  "item_name": "フィルター清掃",
  "description": "<p>フィルターのホコリを取り除きます。</p><ol><li>運転を停止し、電源プラグを抜く</li><li>前面パネルを開けてフィルターを取り外す</li><li>掃除機でホコリを吸い取る</li><li>汚れがひどい場合は水洗いし、日陰で完全に乾かす</li><li>フィルターを元に戻す</li></ol>",
  "frequency": "2週間に1回",
  "frequency_days": 14,
  "category": "cleaning",
  "importance": "high"
}}
→ 具体的な手順を ol/li で構造化、頻度も明確

◯ 例2: 排水口の点検
{{
  "item_name": "排水口の点検",
  "description": "<p>排水口の詰まりを確認します。</p><ol><li>排水口カバーを外す</li><li>ゴミや髪の毛を取り除く</li><li>水を流して排水状態を確認</li></ol>",
  "frequency": "月1回",
  "frequency_days": 30,
  "category": "inspection",
  "importance": "medium"
}}

## 悪い抽出例（これらは避けてください）

✕ 例1: 禁止事項を抽出してしまった
{{
  "item_name": "分解禁止",
  "description": "製品を分解しないでください"
}}
→ ユーザーが行う作業ではない（禁止事項）→ 抽出しない

✕ 例2: 手順が不明確
{{
  "item_name": "内部清掃",
  "description": "内部を清掃してください"
}}
→ 具体的な手順がない → 必ず ol/li で手順を記載

✕ 例3: 頻度と frequency_days が矛盾
{{
  "item_name": "フィルター交換",
  "frequency": "適宜",
  "frequency_days": 30
}}
→ 「適宜」なのに30日と設定は矛盾
→ 周期不明なら frequency_days=0, frequency="汚れが目立ったら" 等

## description 品質要件（重要）

description は以下の要素を**必ず**含めてください：

1. **概要説明**（1文）: 何をする作業か `<p>` タグで記載
2. **具体的な手順**（最低3ステップ）: `<ol><li>` で記載
3. **各ステップは具体的な動作**: 「外す」「洗う」「乾かす」「戻す」等

❌ NG: "フィルターを掃除してください"
✅ OK: "<p>フィルターのホコリを除去します。</p><ol><li>電源を切る</li><li>カバーを開けてフィルターを取り外す</li><li>掃除機でホコリを吸い取る</li><li>元に戻す</li></ol>"

※ PDFに詳細手順がない場合は一般的な手順で補完し、notes に「一般的な手順で補完」と記載

## importance 判定基準

- **high**: 安全性に関わる / 製品寿命に影響 / 頻度が高い（毎日〜週1回）
- **medium**: 性能維持に関わる / 月1回程度の作業
- **low**: 年1回程度 / 任意・推奨レベル

## pdf_page_number と printed_page_number の違い（重要）

- **pdf_page_number**: PDFビューア（Adobe Reader、ブラウザ等）で表示される **1から始まる連番**
  - PDFファイルの1ページ目から数えて何枚目か
  - 見開き2ページが1ページに収まっている場合でも、PDFとしては1ページとしてカウント
- **printed_page_number**: 説明書に **印刷されている** ページ番号（例: "26ページ"、"P.15"）
  - PDFのページ番号とは異なることが多い（表紙、目次、見開きなどの影響）

例: 説明書に「26ページ」と印刷されている内容が、PDFでは14ページ目にある場合
  - pdf_page_number: 14
  - printed_page_number: "26ページ"

## 重要なルール
- **実際に作業を伴う項目のみ**を抽出（「読む」「確認を怠らない」は対象外）
- **description は必ずHTML形式**で、手順は `<ol><li>` を使用（3ステップ以上）
- category は cleaning, inspection, replacement のいずれか1つのみ
- importance は high, medium, low のいずれか1つのみ
- frequency_days: 毎日=1, 週1=7, 2週間=14, 月1=30, 年1=365, 不明=0
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
        items_count = len(result.get("maintenance_items", []))
        logger.info(
            f"Maintenance extraction completed: {items_count} items extracted, "
            f"manufacturer={manufacturer}, model_number={model_number}"
        )
        return result
    except json.JSONDecodeError as e:
        logger.error(
            f"Maintenance extraction JSON parse error: {str(e)}, "
            f"manufacturer={manufacturer}, model_number={model_number}, "
            f"raw_response={response_text[:200]}..."
        )
        return {
            "error": f"JSON parse error: {str(e)}",
            "raw_response": response_text[:1000],
        }
