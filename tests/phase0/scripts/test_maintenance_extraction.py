"""
Phase 0-3: マニュアルPDFからメンテナンス項目を抽出

検証内容:
1. PDFをGemini APIにアップロード
2. メンテナンス項目と周期を抽出
3. 抽出結果の精度を確認
"""

import os
import json
import time
from pathlib import Path

from dotenv import load_dotenv
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / ".env")

from google import genai
from google.genai import types

# テストPDFのディレクトリ
PDF_DIR = Path(__file__).parent / "test_pdfs"

# テスト対象
TEST_PDFS = [
    {
        "manufacturer": "日立",
        "model_number": "MRO-S7D",
        "category": "オーブンレンジ",
        "filename": "hitachi_mro-s7d.pdf"
    },
    {
        "manufacturer": "象印",
        "model_number": "CP-EA20",
        "category": "電気ポット",
        "filename": "zojirushi_cp-ea20.pdf"
    },
    {
        "manufacturer": "象印",
        "model_number": "NW-JX10",
        "category": "炊飯器",
        "filename": "zojirushi_nw-jx10.pdf"
    },
    {
        "manufacturer": "タイガー",
        "model_number": "KAM-R132",
        "category": "オーブントースター",
        "filename": "tiger_kam-r132.pdf"
    },
]


def get_gemini_client():
    """Geminiクライアントを取得"""
    api_key = os.environ.get("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


def upload_pdf(client, pdf_path: Path) -> object:
    """PDFをGemini APIにアップロード"""
    print(f"  アップロード中: {pdf_path.name}...")

    file = client.files.upload(
        file=str(pdf_path),
        config=types.UploadFileConfig(
            display_name=pdf_path.stem,
            mime_type='application/pdf'
        )
    )

    # 処理完了を待機
    while file.state.name == 'PROCESSING':
        print(f"    処理中... (state: {file.state.name})")
        time.sleep(2)
        file = client.files.get(name=file.name)

    if file.state.name == 'FAILED':
        raise Exception(f"ファイル処理失敗: {file.state.name}")

    print(f"  アップロード完了: {file.name}")
    return file


def extract_maintenance_items(client, uploaded_file, product_info: dict) -> dict:
    """PDFからメンテナンス項目を抽出"""

    prompt = f"""この取扱説明書から、定期的なメンテナンス・お手入れ項目を抽出してください。

## 製品情報
- メーカー: {product_info['manufacturer']}
- 型番: {product_info['model_number']}
- カテゴリ: {product_info['category']}

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

    # JSONを抽出
    if "```json" in response_text:
        start = response_text.find("```json") + 7
        end = response_text.find("```", start)
        response_text = response_text[start:end].strip()
    elif "```" in response_text:
        start = response_text.find("```") + 3
        end = response_text.find("```", start)
        response_text = response_text[start:end].strip()

    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse error: {e}", "raw": response_text[:1000]}


def test_product(product_info: dict) -> dict:
    """1つの製品をテスト"""
    print(f"\n{'='*60}")
    print(f"テスト: {product_info['manufacturer']} {product_info['model_number']}")
    print(f"{'='*60}")

    pdf_path = PDF_DIR / product_info["filename"]
    if not pdf_path.exists():
        return {"product": product_info, "success": False, "reason": "PDF not found"}

    try:
        client = get_gemini_client()

        # PDFアップロード
        uploaded_file = upload_pdf(client, pdf_path)

        # メンテナンス項目抽出
        print("  メンテナンス項目を抽出中...")
        result = extract_maintenance_items(client, uploaded_file, product_info)

        if "error" in result:
            print(f"  ❌ 抽出失敗: {result['error']}")
            return {"product": product_info, "success": False, "result": result}

        items = result.get("maintenance_items", [])
        print(f"  ✅ 抽出成功: {len(items)}件のメンテナンス項目")

        # 項目を表示
        for i, item in enumerate(items[:5], 1):  # 最初の5件を表示
            freq = item.get("frequency", "N/A")
            print(f"    {i}. {item.get('item_name', 'N/A')} ({freq})")

        if len(items) > 5:
            print(f"    ... 他 {len(items) - 5}件")

        return {
            "product": product_info,
            "success": True,
            "item_count": len(items),
            "result": result
        }

    except Exception as e:
        print(f"  ❌ エラー: {e}")
        return {"product": product_info, "success": False, "error": str(e)}


def main():
    print("Phase 0-3: マニュアルからメンテナンス項目抽出")
    print("=" * 60)

    results = []
    success_count = 0
    total_items = 0

    for product_info in TEST_PDFS:
        result = test_product(product_info)
        results.append(result)
        if result.get("success"):
            success_count += 1
            total_items += result.get("item_count", 0)

    # サマリー
    print("\n" + "=" * 60)
    print("検証結果サマリー")
    print("=" * 60)

    for result in results:
        product = result["product"]
        status = "✅" if result.get("success") else "❌"
        item_count = result.get("item_count", 0)
        print(f"{status} {product['manufacturer']} {product['model_number']}: {item_count}件抽出")

    print(f"\n成功率: {success_count}/{len(TEST_PDFS)} ({100*success_count//len(TEST_PDFS)}%)")
    print(f"合計抽出項目数: {total_items}件")

    # 詳細結果を保存
    output_path = Path(__file__).parent / "maintenance_extraction_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n詳細結果を保存: {output_path}")

    return results


if __name__ == "__main__":
    main()
