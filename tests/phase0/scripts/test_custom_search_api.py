"""
Phase 0-2 改善版: Google Custom Search JSON API を使用したPDF取得

戦略:
1. filetype:pdf + site: で直接PDF検索
2. 見つかったらスニペットで判断、不明ならPDFをDLしてLLM解析
3. PDFが見つからなければマニュアルページを検索→既存ロジックでPDF抽出
"""

import os
import json
import requests
import tempfile
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from dotenv import load_dotenv
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / ".env")

from google import genai
from google.genai import types

# Google Custom Search API設定
# 環境変数: GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID
GOOGLE_CSE_API_KEY = os.environ.get("GOOGLE_CSE_API_KEY")
GOOGLE_CSE_ID = os.environ.get("GOOGLE_CSE_ID")

TEST_PRODUCTS = [
    {
        "manufacturer": "日立",
        "model_number": "MRO-S7D",
        "category": "オーブンレンジ",
        "official_domains": ["kadenfan.hitachi.co.jp", "hitachi.co.jp"]
    },
    {
        "manufacturer": "象印",
        "model_number": "CP-EA20",
        "category": "電気ポット",
        "official_domains": ["zojirushi.co.jp"]
    },
    {
        "manufacturer": "象印",
        "model_number": "NW-JX10",
        "category": "炊飯器",
        "official_domains": ["zojirushi.co.jp"]
    },
    {
        "manufacturer": "タイガー",
        "model_number": "KAM-R132",
        "category": "オーブントースター",
        "official_domains": ["tiger-forest.com", "tiger-corporation.com", "tiger.jp"]
    },
]

MAX_DEPTH = 3
MAX_LINKS_PER_PAGE = 5


def get_gemini_client():
    """Geminiクライアントを取得"""
    api_key = os.environ.get("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


def custom_search(query: str, num_results: int = 10) -> list:
    """
    Google Custom Search JSON API で検索

    Returns:
        [{"title": "...", "link": "...", "snippet": "..."}, ...]
    """
    if not GOOGLE_CSE_API_KEY or not GOOGLE_CSE_ID:
        print("  ⚠️ GOOGLE_CSE_API_KEY または GOOGLE_CSE_ID が未設定")
        return []

    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": GOOGLE_CSE_API_KEY,
        "cx": GOOGLE_CSE_ID,
        "q": query,
        "num": min(num_results, 10),
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()

        results = []
        for item in data.get("items", []):
            results.append({
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            })
        return results
    except Exception as e:
        print(f"  ❌ Custom Search API エラー: {e}")
        return []


def is_target_manual_by_snippet(result: dict, manufacturer: str, model_number: str) -> str:
    """
    スニペットから目的のマニュアルかどうか判断

    Returns:
        "yes" - 確実に目的のPDF
        "maybe" - 可能性あり（要確認）
        "no" - 違う
    """
    title = result.get("title", "").lower()
    snippet = result.get("snippet", "").lower()
    link = result.get("link", "").lower()

    model_lower = model_number.lower()
    model_no_hyphen = model_lower.replace("-", "")

    # 型番がタイトルやURLに含まれている
    model_in_title = model_lower in title or model_no_hyphen in title
    model_in_link = model_lower in link or model_no_hyphen in link

    # マニュアル関連キーワード
    manual_keywords = ["取扱説明書", "マニュアル", "manual", "instruction"]
    is_manual = any(kw in title or kw in snippet for kw in manual_keywords)

    if model_in_link and is_manual:
        return "yes"
    elif model_in_title or model_in_link:
        return "maybe"
    elif is_manual:
        return "maybe"
    else:
        return "no"


def verify_pdf_is_target(pdf_url: str, manufacturer: str, model_number: str) -> bool:
    """
    PDFをダウンロードしてLLMで目的のマニュアルか確認
    """
    try:
        client = get_gemini_client()

        # PDFをダウンロード（一時ファイル）
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(pdf_url, headers=headers, timeout=30, stream=True)
        response.raise_for_status()

        # Content-Type確認
        content_type = response.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower():
            return False

        # 一時ファイルに保存
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            for chunk in response.iter_content(chunk_size=8192):
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            # Geminiにアップロード
            file = client.files.upload(
                file=tmp_path,
                config=types.UploadFileConfig(
                    display_name="manual_check",
                    mime_type='application/pdf'
                )
            )

            # 処理完了待機
            import time
            while file.state.name == 'PROCESSING':
                time.sleep(2)
                file = client.files.get(name=file.name)

            if file.state.name == 'FAILED':
                return False

            # LLMで確認
            prompt = f"""このPDFは「{manufacturer} {model_number}」の取扱説明書ですか？

最初の数ページを確認して、以下のJSON形式で回答してください：
```json
{{
    "is_target": true または false,
    "found_model": "PDFに記載されていた型番",
    "reason": "判断理由"
}}
```"""

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[file, prompt]
            )

            response_text = response.text.strip()
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                response_text = response_text[start:end].strip()

            result = json.loads(response_text)
            return result.get("is_target", False)

        finally:
            # 一時ファイル削除
            os.unlink(tmp_path)

    except Exception as e:
        print(f"      PDF検証エラー: {e}")
        return False


def verify_pdf(url: str) -> bool:
    """PDFにアクセスできるか確認"""
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.head(url, headers=headers, timeout=10, allow_redirects=True)
        content_type = response.headers.get("Content-Type", "")

        if response.status_code == 200 and "application/pdf" in content_type.lower():
            return True

        # /file形式などはGETで確認
        if url.endswith("/file"):
            response = requests.get(url, headers=headers, timeout=10, allow_redirects=True, stream=True)
            content_type = response.headers.get("Content-Type", "")
            return response.status_code == 200 and "application/pdf" in content_type.lower()

        return False
    except:
        return False


def search_pdf_direct(manufacturer: str, model_number: str, official_domains: list) -> dict:
    """
    Step 1: filetype:pdf で直接PDF検索
    """
    print("\n[Step 1] 直接PDF検索 (filetype:pdf)")

    # 公式ドメインごとに検索
    for domain in official_domains:
        query = f"{manufacturer} {model_number} 取扱説明書 filetype:pdf site:{domain}"
        print(f"  検索: {query}")

        results = custom_search(query, num_results=5)
        print(f"  結果: {len(results)}件")

        for result in results:
            link = result["link"]
            print(f"    - {result['title'][:40]}...")
            print(f"      URL: {link[:60]}...")

            # スニペットで判断
            judgment = is_target_manual_by_snippet(result, manufacturer, model_number)
            print(f"      スニペット判断: {judgment}")

            if judgment == "yes":
                if verify_pdf(link):
                    print(f"  ✅ PDF発見（確実）: {link}")
                    return {"success": True, "pdf_url": link, "method": "direct_search"}

            elif judgment == "maybe":
                print(f"      → PDFをダウンロードして確認中...")
                if verify_pdf_is_target(link, manufacturer, model_number):
                    print(f"  ✅ PDF発見（LLM確認済）: {link}")
                    return {"success": True, "pdf_url": link, "method": "direct_search_verified"}

    print("  PDFが直接見つからない → Step 2へ")
    return {"success": False}


def fetch_page_html(url: str, model_number: str = None) -> str:
    """ページのHTMLを取得し、リンク抽出用に整形"""
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        model_variants = []
        if model_number:
            model_variants = [
                model_number.lower(),
                model_number.lower().replace("-", ""),
            ]

        priority_links = []
        pdf_links = []
        manual_links = []

        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            text = a_tag.get_text(strip=True)
            absolute_url = urljoin(url, href)

            if not absolute_url.startswith("http"):
                continue

            link_info = f"- [{text}]({absolute_url})"
            href_lower = href.lower()

            if model_variants and any(v in href_lower for v in model_variants):
                priority_links.append(link_info)
            elif ".pdf" in href_lower or href.endswith("/file"):
                pdf_links.append(link_info)
            elif any(kw in href_lower or kw in text.lower() for kw in
                     ["manual", "取扱説明書", "マニュアル", "toiawase", "support"]):
                manual_links.append(link_info)

        formatted = f"""## 型番関連リンク（{len(priority_links)}件）:
{chr(10).join(priority_links) if priority_links else "なし"}

## PDFリンク（{len(pdf_links)}件）:
{chr(10).join(pdf_links) if pdf_links else "なし"}

## マニュアル関連リンク（{len(manual_links)}件）:
{chr(10).join(manual_links[:15]) if manual_links else "なし"}
"""
        return formatted
    except Exception as e:
        return f"Error: {e}"


def extract_pdf_with_llm(page_info: str, manufacturer: str, model_number: str) -> dict:
    """LLMにページを解析させてPDFリンクを取得"""
    client = get_gemini_client()
    model_no_hyphen = model_number.replace("-", "")

    prompt = f"""あなたは家電製品の取扱説明書PDFを探すアシスタントです。

## 探している製品
- メーカー: {manufacturer}
- 型番: {model_number}（ハイフンなしだと「{model_no_hyphen}」）

## ページのリンク情報
{page_info[:12000]}

## タスク
上記から、**{manufacturer} {model_number}** の取扱説明書PDFを探してください。

## 出力形式（JSON）
```json
{{
    "found_pdf": "PDFのURL（見つかった場合）またはnull",
    "explore_links": ["さらに探索すべきURL", ...],
    "reason": "判断理由"
}}
```"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        response_text = response.text.strip()
        if "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            response_text = response_text[start:end].strip()

        return json.loads(response_text)
    except Exception as e:
        return {"found_pdf": None, "explore_links": [], "reason": f"Error: {e}"}


def search_manual_page(manufacturer: str, model_number: str, official_domains: list) -> dict:
    """
    Step 2: マニュアルページを検索してPDFを抽出
    """
    print("\n[Step 2] マニュアルページ検索")

    for domain in official_domains:
        query = f"{manufacturer} {model_number} 取扱説明書 site:{domain}"
        print(f"  検索: {query}")

        results = custom_search(query, num_results=5)
        print(f"  結果: {len(results)}件")

        visited = set()

        for result in results:
            page_url = result["link"]
            if page_url in visited:
                continue
            visited.add(page_url)

            print(f"  ページ探索: {page_url[:60]}...")

            # 直接PDFの場合
            if page_url.lower().endswith('.pdf'):
                if verify_pdf(page_url):
                    print(f"  ✅ PDF発見: {page_url}")
                    return {"success": True, "pdf_url": page_url, "method": "page_search_direct"}

            # ページからPDF抽出
            page_info = fetch_page_html(page_url, model_number)
            if page_info.startswith("Error"):
                continue

            llm_result = extract_pdf_with_llm(page_info, manufacturer, model_number)

            # PDFが見つかった場合
            found_pdf = llm_result.get("found_pdf")
            if found_pdf and verify_pdf(found_pdf):
                print(f"  ✅ PDF発見: {found_pdf}")
                return {"success": True, "pdf_url": found_pdf, "method": "page_search_extract"}

            # 探索リンクをたどる（深度1まで）
            for link in llm_result.get("explore_links", [])[:3]:
                if link in visited:
                    continue
                visited.add(link)

                print(f"    サブページ探索: {link[:50]}...")
                sub_page_info = fetch_page_html(link, model_number)
                if sub_page_info.startswith("Error"):
                    continue

                sub_result = extract_pdf_with_llm(sub_page_info, manufacturer, model_number)
                sub_pdf = sub_result.get("found_pdf")
                if sub_pdf and verify_pdf(sub_pdf):
                    print(f"  ✅ PDF発見: {sub_pdf}")
                    return {"success": True, "pdf_url": sub_pdf, "method": "page_search_deep"}

    return {"success": False, "reason": "not_found"}


def test_product(product: dict) -> dict:
    """1つの製品をテスト"""
    manufacturer = product["manufacturer"]
    model_number = product["model_number"]
    official_domains = product["official_domains"]

    print(f"\n{'='*60}")
    print(f"テスト: {manufacturer} {model_number}")
    print(f"{'='*60}")

    # Step 1: 直接PDF検索
    result = search_pdf_direct(manufacturer, model_number, official_domains)
    if result.get("success"):
        return {**result, "product": product}

    # Step 2: マニュアルページ検索
    result = search_manual_page(manufacturer, model_number, official_domains)
    return {**result, "product": product}


def main():
    print("Phase 0-2 改善版: Google Custom Search API")
    print("=" * 60)

    if not GOOGLE_CSE_API_KEY or not GOOGLE_CSE_ID:
        print("\n⚠️ 環境変数を設定してください:")
        print("  GOOGLE_CSE_API_KEY - Custom Search API キー")
        print("  GOOGLE_CSE_ID - 検索エンジンID")
        print("\n設定方法:")
        print("  1. https://programmablesearchengine.google.com/ で検索エンジン作成")
        print("  2. https://console.cloud.google.com/ でAPIキー取得")
        return

    results = []
    success_count = 0

    for product in TEST_PRODUCTS:
        result = test_product(product)
        results.append(result)
        if result.get("success"):
            success_count += 1

    # サマリー
    print("\n" + "=" * 60)
    print("検証結果サマリー")
    print("=" * 60)

    for result in results:
        product = result.get("product", {})
        status = "✅" if result.get("success") else "❌"
        method = result.get("method", "N/A")
        print(f"{status} {product.get('manufacturer')} {product.get('model_number')} [{method}]")
        if result.get("success"):
            print(f"   PDF: {result.get('pdf_url')}")

    print(f"\n成功率: {success_count}/{len(TEST_PRODUCTS)} ({100*success_count//len(TEST_PRODUCTS)}%)")

    return results


if __name__ == "__main__":
    main()
