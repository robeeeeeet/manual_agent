"""Manual PDF search service using Google Custom Search API and Gemini"""

import json
import tempfile
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types

from app.config import settings


def get_gemini_client():
    """Get Gemini client instance"""
    return genai.Client(api_key=settings.gemini_api_key)


def custom_search(query: str, num_results: int = 10) -> list[dict]:
    """
    Execute Google Custom Search API query.

    Args:
        query: Search query string
        num_results: Number of results to return (max 10)

    Returns:
        List of search results with title, link, snippet
    """
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": settings.google_cse_api_key,
        "cx": settings.google_cse_id,
        "q": query,
        "num": min(num_results, 10),
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()

        results = []
        for item in data.get("items", []):
            results.append(
                {
                    "title": item.get("title", ""),
                    "link": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                }
            )
        return results
    except Exception as e:
        print(f"Custom Search API error: {e}")
        return []


def is_target_manual_by_snippet(
    result: dict, manufacturer: str, model_number: str
) -> str:
    """
    Judge if search result is target manual by snippet.

    Returns:
        "yes" - Definitely target PDF
        "maybe" - Possibly target (needs verification)
        "no" - Not target
    """
    title = result.get("title", "").lower()
    snippet = result.get("snippet", "").lower()
    link = result.get("link", "").lower()

    model_lower = model_number.lower()
    model_no_hyphen = model_lower.replace("-", "")

    # Check if model number is in title or URL
    model_in_title = model_lower in title or model_no_hyphen in title
    model_in_link = model_lower in link or model_no_hyphen in link

    # Manual-related keywords
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


def verify_pdf(url: str) -> bool:
    """Verify if URL points to an accessible PDF"""
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.head(url, headers=headers, timeout=10, allow_redirects=True)
        content_type = response.headers.get("Content-Type", "")

        if response.status_code == 200 and "application/pdf" in content_type.lower():
            return True

        # For /file type URLs, use GET to verify
        if url.endswith("/file"):
            response = requests.get(
                url, headers=headers, timeout=10, allow_redirects=True, stream=True
            )
            content_type = response.headers.get("Content-Type", "")
            return (
                response.status_code == 200
                and "application/pdf" in content_type.lower()
            )

        return False
    except Exception:
        return False


def verify_pdf_is_target(pdf_url: str, manufacturer: str, model_number: str) -> bool:
    """
    Download PDF and verify with LLM if it's the target manual.

    Args:
        pdf_url: URL of the PDF to verify
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        True if PDF is target manual, False otherwise
    """
    try:
        client = get_gemini_client()

        # Download PDF to temporary file
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(pdf_url, headers=headers, timeout=30, stream=True)
        response.raise_for_status()

        # Verify Content-Type
        content_type = response.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower():
            return False

        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            for chunk in response.iter_content(chunk_size=8192):
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            # Upload to Gemini
            file = client.files.upload(
                file=tmp_path,
                config=types.UploadFileConfig(
                    display_name="manual_check", mime_type="application/pdf"
                ),
            )

            # Wait for processing
            while file.state.name == "PROCESSING":
                time.sleep(2)
                file = client.files.get(name=file.name)

            if file.state.name == "FAILED":
                return False

            # Verify with LLM
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
                model="gemini-2.5-flash", contents=[file, prompt]
            )

            response_text = response.text.strip()
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                response_text = response_text[start:end].strip()

            result = json.loads(response_text)
            return result.get("is_target", False)

        finally:
            # Clean up temporary file
            import os

            os.unlink(tmp_path)

    except Exception as e:
        print(f"PDF verification error: {e}")
        return False


async def search_pdf_direct(
    manufacturer: str, model_number: str, official_domains: list[str]
) -> dict:
    """
    Step 1: Direct PDF search using filetype:pdf

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        official_domains: List of official domains to search

    Returns:
        dict with success status and pdf_url if found
    """
    # Search each official domain
    for domain in official_domains:
        query = f"{manufacturer} {model_number} 取扱説明書 filetype:pdf site:{domain}"
        print(f"Search: {query}")

        results = custom_search(query, num_results=5)
        print(f"Results: {len(results)} items")

        for result in results:
            link = result["link"]

            # Judge by snippet
            judgment = is_target_manual_by_snippet(result, manufacturer, model_number)

            if judgment == "yes":
                if verify_pdf(link):
                    print(f"PDF found (confirmed): {link}")
                    return {"success": True, "pdf_url": link, "method": "direct_search"}

            elif judgment == "maybe":
                if verify_pdf_is_target(link, manufacturer, model_number):
                    print(f"PDF found (LLM verified): {link}")
                    return {
                        "success": True,
                        "pdf_url": link,
                        "method": "direct_search_verified",
                    }

    return {"success": False}


def fetch_page_html(url: str, model_number: str = None) -> str:
    """Fetch page HTML and format for link extraction"""
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
            elif any(
                kw in href_lower or kw in text.lower()
                for kw in ["manual", "取扱説明書", "マニュアル", "toiawase", "support"]
            ):
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
    """Use LLM to analyze page and extract PDF link"""
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


async def search_manual_page(
    manufacturer: str, model_number: str, official_domains: list[str]
) -> dict:
    """
    Step 2: Search manual page and extract PDF

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        official_domains: List of official domains

    Returns:
        dict with success status and pdf_url if found
    """
    for domain in official_domains:
        query = f"{manufacturer} {model_number} 取扱説明書 site:{domain}"
        print(f"Search: {query}")

        results = custom_search(query, num_results=5)
        print(f"Results: {len(results)} items")

        visited = set()

        for result in results:
            page_url = result["link"]
            if page_url in visited:
                continue
            visited.add(page_url)

            # If direct PDF
            if page_url.lower().endswith(".pdf"):
                if verify_pdf(page_url):
                    print(f"PDF found: {page_url}")
                    return {
                        "success": True,
                        "pdf_url": page_url,
                        "method": "page_search_direct",
                    }

            # Extract PDF from page
            page_info = fetch_page_html(page_url, model_number)
            if page_info.startswith("Error"):
                continue

            llm_result = extract_pdf_with_llm(page_info, manufacturer, model_number)

            # Check if PDF found
            found_pdf = llm_result.get("found_pdf")
            if found_pdf and verify_pdf(found_pdf):
                print(f"PDF found: {found_pdf}")
                return {
                    "success": True,
                    "pdf_url": found_pdf,
                    "method": "page_search_extract",
                }

            # Follow exploration links (depth 1)
            for link in llm_result.get("explore_links", [])[:3]:
                if link in visited:
                    continue
                visited.add(link)

                sub_page_info = fetch_page_html(link, model_number)
                if sub_page_info.startswith("Error"):
                    continue

                sub_result = extract_pdf_with_llm(
                    sub_page_info, manufacturer, model_number
                )
                sub_pdf = sub_result.get("found_pdf")
                if sub_pdf and verify_pdf(sub_pdf):
                    print(f"PDF found: {sub_pdf}")
                    return {
                        "success": True,
                        "pdf_url": sub_pdf,
                        "method": "page_search_deep",
                    }

    return {"success": False, "reason": "not_found"}


async def search_manual(
    manufacturer: str, model_number: str, official_domains: list[str] | None = None
) -> dict:
    """
    Search for manual PDF using two-step strategy.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        official_domains: Optional list of official domains to search

    Returns:
        dict with success status, pdf_url, and method if found
    """
    if not official_domains:
        official_domains = []

    # Step 1: Direct PDF search
    result = await search_pdf_direct(manufacturer, model_number, official_domains)
    if result.get("success"):
        return result

    # Step 2: Manual page search
    result = await search_manual_page(manufacturer, model_number, official_domains)
    return result
