"""Manual PDF search service using Google Custom Search API and Gemini"""

import asyncio
import json
import logging
import tempfile
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# Semaphore to limit concurrent searches
# Initialized lazily to avoid issues with event loop not running at import time
_search_semaphore: asyncio.Semaphore | None = None


def get_search_semaphore() -> asyncio.Semaphore:
    """Get or create the search semaphore for limiting concurrent searches."""
    global _search_semaphore
    if _search_semaphore is None:
        _search_semaphore = asyncio.Semaphore(settings.max_concurrent_searches)
        logger.info(
            f"Initialized search semaphore with max {settings.max_concurrent_searches} concurrent searches"
        )
    return _search_semaphore


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

    start_time = time.time()
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
        elapsed = time.time() - start_time
        logger.info(
            f"Custom Search API completed in {elapsed:.2f}s "
            f"(query={query[:50]}..., results={len(results)})"
        )
        return results
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            f"Custom Search API error (elapsed={elapsed:.2f}s): {e}", exc_info=True
        )
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
        logger.error(f"PDF verification error: {e}", exc_info=True)
        return False


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
    except json.JSONDecodeError:
        # LLMが不正なJSONを返した場合
        return {
            "found_pdf": None,
            "explore_links": [],
            "reason": "AI解析結果の処理に失敗しました。再度お試しください",
        }
    except Exception as e:
        error_str = str(e).lower()
        if "api" in error_str or "quota" in error_str or "rate" in error_str:
            reason = (
                "API制限に達した可能性があります。しばらく待ってから再度お試しください"
            )
        elif "timeout" in error_str or "connection" in error_str:
            reason = (
                "ネットワーク接続に問題があります。接続を確認して再度お試しください"
            )
        elif "auth" in error_str or "key" in error_str or "credential" in error_str:
            reason = "サービスの認証に問題があります。管理者にお問い合わせください"
        else:
            reason = "一時的なエラーが発生しました。再度お試しください"
        return {"found_pdf": None, "explore_links": [], "reason": reason}


# Progress event types for SSE
class SearchProgress:
    """Progress event for SSE streaming"""

    def __init__(
        self,
        step: str,
        message: str,
        detail: str = "",
        current: int = 0,
        total: int = 0,
    ):
        self.step = step
        self.message = message
        self.detail = detail
        self.current = current
        self.total = total

    def to_dict(self):
        return {
            "type": "progress",
            "step": self.step,
            "message": self.message,
            "detail": self.detail,
            "current": self.current,
            "total": self.total,
        }


async def search_manual_with_progress(
    manufacturer: str,
    model_number: str,
    official_domains: list[str] | None = None,
    excluded_urls: list[str] | None = None,
    skip_domain_filter: bool = False,
    cached_candidates: list[dict] | None = None,
):
    """
    Search for manual PDF with progress updates (generator for SSE).

    This function limits concurrent searches using a semaphore (default: 5 max).
    When the limit is reached, new requests will wait until a slot is available.

    Note: This function only searches for PDFs. Domain learning and PDF storage
    should be performed separately after user confirms the result.
    Use confirm_manual() for that purpose.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        official_domains: List of official domains to prioritize in search
        excluded_urls: List of PDF URLs to exclude from search results (for retry)
        skip_domain_filter: Skip domain-based filtering for broader search (for retry)
        cached_candidates: Cached PDF candidates from previous search (for retry)

    Yields:
        SearchProgress events during search
        Final result dict when complete (includes candidates for caching)
    """
    semaphore = get_search_semaphore()

    # Log queue status
    available_slots = semaphore._value  # Number of available slots
    if available_slots == 0:
        logger.info(
            f"[QUEUE] Search request queued - waiting for available slot "
            f"(max concurrent: {settings.max_concurrent_searches})"
        )
        yield SearchProgress(
            "queued",
            "検索待機中...",
            f"現在{settings.max_concurrent_searches}件の検索が実行中です",
        )

    async with semaphore:
        logger.info(
            f"[SEARCH] Acquired search slot - starting search for {manufacturer} {model_number}"
        )
        try:
            async for event in _search_manual_with_progress_impl(
                manufacturer=manufacturer,
                model_number=model_number,
                official_domains=official_domains,
                excluded_urls=excluded_urls,
                skip_domain_filter=skip_domain_filter,
                cached_candidates=cached_candidates,
            ):
                yield event
        finally:
            logger.info(
                f"[SEARCH] Released search slot - finished search for {manufacturer} {model_number}"
            )


async def _search_manual_with_progress_impl(
    manufacturer: str,
    model_number: str,
    official_domains: list[str] | None = None,
    excluded_urls: list[str] | None = None,
    skip_domain_filter: bool = False,
    cached_candidates: list[dict] | None = None,
):
    """
    Internal implementation of search_manual_with_progress.

    This function contains the actual search logic. It should not be called directly;
    use search_manual_with_progress() instead which handles concurrency limiting.
    """
    from urllib.parse import urlparse

    from app.services.manufacturer_domain import ManufacturerDomainService

    domain_service = ManufacturerDomainService()

    # Normalize excluded URLs set for fast lookup
    excluded_url_set = set(excluded_urls or [])

    # Candidate collection for retry caching
    all_candidates: list[dict] = []
    seen_candidate_urls: set[str] = set()

    def add_candidate(
        url: str,
        source: str,
        judgment: str,
        title: str | None = None,
        snippet: str | None = None,
        verified: bool = False,
        verification_failed_reason: str | None = None,
        priority: int = 0,
    ):
        """Add a candidate to the collection if not already seen."""
        if url in seen_candidate_urls:
            return
        seen_candidate_urls.add(url)
        all_candidates.append(
            {
                "url": url,
                "source": source,
                "judgment": judgment,
                "title": title,
                "snippet": snippet,
                "verified": verified,
                "verification_failed_reason": verification_failed_reason,
                "priority": priority,
            }
        )

    def update_candidate(url: str, verified: bool, failed_reason: str | None = None):
        """Update a candidate's verification status."""
        for candidate in all_candidates:
            if candidate["url"] == url:
                candidate["verified"] = verified
                candidate["verification_failed_reason"] = failed_reason
                break

    # === パナソニック専用ルート ===
    # パナソニック製品は公式サイトから直接取得する（Google CSE をスキップ）
    from app.services.panasonic_manual import is_panasonic, search_panasonic_manual

    if is_panasonic(manufacturer):
        yield SearchProgress(
            "panasonic_search",
            "パナソニック公式サイトを検索中...",
            "公式サポートページから取扱説明書を取得します",
        )

        panasonic_result = await search_panasonic_manual(model_number)

        if panasonic_result:
            logger.info(f"[PANASONIC] Found PDF: {panasonic_result['pdf_url']}")
            yield {
                "type": "result",
                "success": True,
                "pdf_url": panasonic_result["pdf_url"],
                "method": "panasonic_official",
                "candidates": [],
            }
            return

        # 見つからない場合は従来フローへフォールバック
        logger.info(
            "[PANASONIC] Not found on official site, falling back to Google search"
        )
        yield SearchProgress(
            "panasonic_fallback",
            "公式サイトで見つかりませんでした",
            "Google検索にフォールバックします",
        )

    # Phase A: Process cached candidates first (for retry search)
    if cached_candidates:
        logger.info(f"[CACHE] Processing {len(cached_candidates)} cached candidates")
        yield SearchProgress(
            "cached_candidates",
            "キャッシュ候補を確認中...",
            f"{len(cached_candidates)}件の候補を検証します",
        )

        # Filter to processable candidates
        # Include "pending" candidates (collected but not yet judged)
        processable = [
            c
            for c in cached_candidates
            if c["url"] not in excluded_url_set
            and not c.get("verified", False)
            and c.get("judgment") in ("yes", "maybe", "pending")
        ]

        # Sort by priority (lower = higher priority)
        processable.sort(key=lambda x: x.get("priority", 0))

        for idx, candidate in enumerate(processable):
            url = candidate["url"]
            judgment = candidate.get("judgment", "maybe")
            domain = urlparse(url).netloc

            yield SearchProgress(
                "cached_candidate_check",
                f"キャッシュ候補を検証中（{idx + 1}/{len(processable)}）",
                f"{domain}",
                idx + 1,
                len(processable),
            )

            # Add to all_candidates to track processing
            add_candidate(
                url=url,
                source=candidate.get("source", "google_search"),
                judgment=judgment,
                title=candidate.get("title"),
                snippet=candidate.get("snippet"),
                verified=False,
                priority=candidate.get("priority", 0),
            )

            # For "pending" candidates, first judge by snippet
            if judgment == "pending":
                snippet_result = {
                    "title": candidate.get("title", ""),
                    "snippet": candidate.get("snippet", ""),
                    "link": url,
                }
                judgment = await asyncio.to_thread(
                    is_target_manual_by_snippet,
                    snippet_result,
                    manufacturer,
                    model_number,
                )
                # Update the judgment in all_candidates
                for c in all_candidates:
                    if c["url"] == url:
                        c["judgment"] = judgment
                        break
                logger.info(f"[CACHE] Judged pending candidate: {judgment} - {url}")

            if judgment == "yes":
                if await asyncio.to_thread(verify_pdf, url):
                    update_candidate(url, True, None)
                    logger.info(f"[CACHE] Found valid PDF from cached candidate: {url}")
                    logger.info("[CACHE] Skipping Google search - using cached result")
                    yield {
                        "type": "result",
                        "success": True,
                        "pdf_url": url,
                        "method": "cached_candidate",
                        "candidates": all_candidates,
                    }
                    return
                else:
                    update_candidate(url, True, "http_error")
            elif judgment == "maybe":
                if await asyncio.to_thread(
                    verify_pdf_is_target, url, manufacturer, model_number
                ):
                    update_candidate(url, True, None)
                    logger.info(
                        f"[CACHE] Found valid PDF from cached candidate (verified): {url}"
                    )
                    logger.info("[CACHE] Skipping Google search - using cached result")
                    yield {
                        "type": "result",
                        "success": True,
                        "pdf_url": url,
                        "method": "cached_candidate_verified",
                        "candidates": all_candidates,
                    }
                    return
                else:
                    update_candidate(url, True, "not_target")

        # Also add all other cached candidates that weren't processed
        for c in cached_candidates:
            add_candidate(
                url=c["url"],
                source=c.get("source", "google_search"),
                judgment=c.get("judgment", "pending"),
                title=c.get("title"),
                snippet=c.get("snippet"),
                verified=c.get("verified", False),
                verification_failed_reason=c.get("verification_failed_reason"),
                priority=c.get("priority", 0),
            )

        logger.info(
            f"[CACHE] All {len(processable)} processable candidates exhausted, "
            "proceeding to Google search"
        )
        yield SearchProgress(
            "cached_candidates_exhausted",
            "キャッシュ候補を検証完了",
            "新規検索を実行します",
        )

    # Step 0: Get learned domains (skip if skip_domain_filter is True)
    logger.info("[GOOGLE] Starting Google Custom Search API call")
    yield SearchProgress("init", "検索を開始しています...", "ドメイン情報を取得中")

    if skip_domain_filter:
        # For retry search, skip domain filtering entirely
        official_domains = None
        yield SearchProgress(
            "domain",
            "再検索モード",
            "ドメインフィルタを無効化して検索します",
        )
    elif not official_domains:
        official_domains = await domain_service.get_domains(manufacturer)
        if official_domains:
            yield SearchProgress(
                "domain",
                "登録済みドメインを発見",
                f"サイト: {', '.join(official_domains)}",
            )

    # Step 1: Direct PDF search
    yield SearchProgress(
        "google_search", "Googleで説明書を検索中...", "PDF直接リンクを探しています"
    )

    # Build queries - domain filter disabled (domains still registered via confirm_manual)
    queries = []
    queries.append(f"{manufacturer} {model_number} 取扱説明書 filetype:pdf")

    candidate_priority = 0  # Priority counter for candidates

    for query_idx, query in enumerate(queries):
        yield SearchProgress(
            "google_search",
            "Googleで説明書を検索中...",
            f"クエリ {query_idx + 1}/{len(queries)}",
            query_idx + 1,
            len(queries),
        )

        # Run sync function in thread to avoid blocking event loop
        results = await asyncio.to_thread(custom_search, query, 5)

        # Filter to only PDF results, excluding previously found URLs
        pdf_results = [
            r
            for r in results
            if r["link"].lower().endswith(".pdf") and r["link"] not in excluded_url_set
        ]
        total_pdfs = len(pdf_results)

        logger.info(
            f"[GOOGLE] Query '{query[:50]}...' returned {len(results)} results, "
            f"{total_pdfs} PDFs after filtering"
        )

        if total_pdfs == 0:
            logger.info("[GOOGLE] No PDF results for query, trying next query")
            continue

        for result_idx, result in enumerate(pdf_results):
            pdf_url = result["link"]
            pdf_domain = urlparse(pdf_url).netloc

            # Progress: Checking result
            yield SearchProgress(
                "check_result",
                f"検索結果を確認中（{result_idx + 1}/{total_pdfs}）",
                f"{pdf_domain}",
                result_idx + 1,
                total_pdfs,
            )

            # Progress: Checking snippet
            yield SearchProgress(
                "check_snippet",
                f"スニペットを判定中（{result_idx + 1}/{total_pdfs}）",
                "AIで説明書の一致を確認中",
                result_idx + 1,
                total_pdfs,
            )

            # Judge by snippet (same logic as search_pdf_direct)
            judgment = await asyncio.to_thread(
                is_target_manual_by_snippet, result, manufacturer, model_number
            )

            # Add to candidates collection
            add_candidate(
                url=pdf_url,
                source="google_search",
                judgment=judgment,
                title=result.get("title"),
                snippet=result.get("snippet"),
                verified=False,
                priority=candidate_priority,
            )
            candidate_priority += 1

            if judgment == "yes":
                # Progress: Verifying PDF
                yield SearchProgress(
                    "verify_pdf",
                    f"PDFを検証中（{result_idx + 1}/{total_pdfs}）",
                    "ダウンロード可能か確認中",
                    result_idx + 1,
                    total_pdfs,
                )
                if await asyncio.to_thread(verify_pdf, pdf_url):
                    update_candidate(pdf_url, True, None)
                    # Collect remaining results as candidates before returning
                    for remaining_idx in range(result_idx + 1, total_pdfs):
                        remaining_result = pdf_results[remaining_idx]
                        remaining_url = remaining_result["link"]
                        add_candidate(
                            url=remaining_url,
                            source="google_search",
                            judgment="pending",  # Not judged yet
                            title=remaining_result.get("title"),
                            snippet=remaining_result.get("snippet"),
                            verified=False,
                            priority=candidate_priority + remaining_idx,
                        )
                    yield {
                        "type": "result",
                        "success": True,
                        "pdf_url": pdf_url,
                        "method": "direct_search",
                        "candidates": all_candidates,
                    }
                    return
                else:
                    update_candidate(pdf_url, True, "http_error")
            elif judgment == "maybe":
                # Progress: Verifying PDF content
                yield SearchProgress(
                    "verify_pdf_content",
                    f"PDF内容を検証中（{result_idx + 1}/{total_pdfs}）",
                    "説明書の型番を確認中",
                    result_idx + 1,
                    total_pdfs,
                )
                if await asyncio.to_thread(
                    verify_pdf_is_target, pdf_url, manufacturer, model_number
                ):
                    update_candidate(pdf_url, True, None)
                    # Collect remaining results as candidates before returning
                    for remaining_idx in range(result_idx + 1, total_pdfs):
                        remaining_result = pdf_results[remaining_idx]
                        remaining_url = remaining_result["link"]
                        add_candidate(
                            url=remaining_url,
                            source="google_search",
                            judgment="pending",  # Not judged yet
                            title=remaining_result.get("title"),
                            snippet=remaining_result.get("snippet"),
                            verified=False,
                            priority=candidate_priority + remaining_idx,
                        )
                    yield {
                        "type": "result",
                        "success": True,
                        "pdf_url": pdf_url,
                        "method": "direct_search_verified",
                        "candidates": all_candidates,
                    }
                    return
                else:
                    update_candidate(pdf_url, True, "not_target")
            # judgment == "no": skip this result (already added to candidates)

    # Step 2: Manual page search (no filetype:pdf, no domain filter)
    # Step 1 failed to find direct PDF, so search broadly for manual pages
    yield SearchProgress("page_search", "公式ページを調査中...", "検索クエリを準備中")

    # Search without domain filter to find official manual pages
    queries = [f"{manufacturer} {model_number} 取扱説明書"]

    visited = set()

    for query_idx, query in enumerate(queries):
        yield SearchProgress(
            "page_search",
            "Googleで公式ページを検索中...",
            f"クエリ {query_idx + 1}/{len(queries)}",
            query_idx + 1,
            len(queries),
        )

        # Run sync function in thread to avoid blocking event loop
        results = await asyncio.to_thread(custom_search, query, 5)
        total_results = len(results)

        logger.info(
            f"[PAGE_SEARCH] Query '{query[:50]}...' returned {total_results} results"
        )

        if total_results == 0:
            logger.info("[PAGE_SEARCH] No results for query, trying next query")
            continue

        yield SearchProgress(
            "page_search_results",
            "検索結果を取得しました",
            f"{total_results}件の結果を確認します",
            0,
            total_results,
        )

        for idx, result in enumerate(results):
            page_url = result["link"]
            if page_url in visited:
                continue
            visited.add(page_url)

            domain = urlparse(page_url).netloc

            # Progress: Checking result
            yield SearchProgress(
                "check_page_result",
                f"検索結果を確認中（{idx + 1}/{total_results}）",
                f"{domain}",
                idx + 1,
                total_results,
            )

            if page_url.lower().endswith(".pdf"):
                # Skip excluded URLs
                if page_url in excluded_url_set:
                    continue

                # Add to candidates
                add_candidate(
                    url=page_url,
                    source="page_extract",
                    judgment="maybe",
                    title=result.get("title"),
                    snippet=result.get("snippet"),
                    verified=False,
                    priority=candidate_priority,
                )
                candidate_priority += 1

                yield SearchProgress(
                    "verify_page_pdf",
                    f"PDFを検証中（{idx + 1}/{total_results}）",
                    f"{domain}",
                    idx + 1,
                    total_results,
                )
                if await asyncio.to_thread(verify_pdf, page_url):
                    update_candidate(page_url, True, None)
                    yield {
                        "type": "result",
                        "success": True,
                        "pdf_url": page_url,
                        "method": "page_search_direct",
                        "candidates": all_candidates,
                    }
                    return
                else:
                    update_candidate(page_url, True, "http_error")
                continue

            # Progress: Fetching page
            yield SearchProgress(
                "page_fetch",
                f"ページを取得中（{idx + 1}/{total_results}）",
                f"{domain} からHTMLを取得中",
                idx + 1,
                total_results,
            )

            # Fetch and analyze page
            page_info = await asyncio.to_thread(fetch_page_html, page_url, model_number)
            if page_info.startswith("Error"):
                continue

            # Progress: LLM extracting
            yield SearchProgress(
                "llm_extract",
                f"AIでPDFリンクを抽出中（{idx + 1}/{total_results}）",
                f"{domain} のページを解析中",
                idx + 1,
                total_results,
            )

            llm_result = await asyncio.to_thread(
                extract_pdf_with_llm, page_info, manufacturer, model_number
            )

            found_pdf = llm_result.get("found_pdf")
            if found_pdf and found_pdf not in excluded_url_set:
                # Add LLM-found PDF to candidates
                add_candidate(
                    url=found_pdf,
                    source="page_extract",
                    judgment="maybe",
                    verified=False,
                    priority=candidate_priority,
                )
                candidate_priority += 1

                yield SearchProgress(
                    "verify_extracted_pdf",
                    f"抽出したPDFを検証中（{idx + 1}/{total_results}）",
                    "ダウンロード可能か確認中",
                    idx + 1,
                    total_results,
                )
                if await asyncio.to_thread(verify_pdf, found_pdf):
                    update_candidate(found_pdf, True, None)
                    yield {
                        "type": "result",
                        "success": True,
                        "pdf_url": found_pdf,
                        "method": "page_search_extract",
                        "candidates": all_candidates,
                    }
                    return
                else:
                    update_candidate(found_pdf, True, "http_error")

            # Collect explore_links as candidates (for future retry)
            explore_links = llm_result.get("explore_links", [])
            for el_idx, explore_link in enumerate(explore_links):
                if explore_link not in excluded_url_set:
                    add_candidate(
                        url=explore_link,
                        source="explore_link",
                        judgment="pending",
                        verified=False,
                        priority=candidate_priority + 100 + el_idx,  # Lower priority
                    )

            # Follow exploration links (first 3)
            explore_links_to_follow = explore_links[:3]
            if explore_links_to_follow:
                yield SearchProgress(
                    "deep_search_init",
                    "関連ページを探索中...",
                    f"{len(explore_links_to_follow)}件のリンクを追跡します",
                    0,
                    len(explore_links_to_follow),
                )

                for link_idx, link in enumerate(explore_links_to_follow):
                    if link in visited:
                        continue
                    visited.add(link)

                    link_domain = urlparse(link).netloc

                    # Progress: Fetching sub page
                    yield SearchProgress(
                        "deep_search_fetch",
                        f"関連ページを取得中（{link_idx + 1}/{len(explore_links_to_follow)}）",
                        f"{link_domain}",
                        link_idx + 1,
                        len(explore_links_to_follow),
                    )

                    sub_page_info = await asyncio.to_thread(
                        fetch_page_html, link, model_number
                    )
                    if sub_page_info.startswith("Error"):
                        continue

                    # Progress: LLM extracting from sub page
                    yield SearchProgress(
                        "deep_search_extract",
                        f"AIで解析中（{link_idx + 1}/{len(explore_links_to_follow)}）",
                        f"{link_domain} のページを解析中",
                        link_idx + 1,
                        len(explore_links_to_follow),
                    )

                    sub_result = await asyncio.to_thread(
                        extract_pdf_with_llm, sub_page_info, manufacturer, model_number
                    )
                    sub_pdf = sub_result.get("found_pdf")
                    if sub_pdf and sub_pdf not in excluded_url_set:
                        # Add deep-found PDF to candidates
                        add_candidate(
                            url=sub_pdf,
                            source="page_extract",
                            judgment="maybe",
                            verified=False,
                            priority=candidate_priority,
                        )
                        candidate_priority += 1

                        yield SearchProgress(
                            "deep_search_verify",
                            f"PDFを検証中（{link_idx + 1}/{len(explore_links_to_follow)}）",
                            "ダウンロード可能か確認中",
                            link_idx + 1,
                            len(explore_links_to_follow),
                        )
                        if await asyncio.to_thread(verify_pdf, sub_pdf):
                            update_candidate(sub_pdf, True, None)
                            yield {
                                "type": "result",
                                "success": True,
                                "pdf_url": sub_pdf,
                                "method": "page_search_deep",
                                "candidates": all_candidates,
                            }
                            return
                        else:
                            update_candidate(sub_pdf, True, "http_error")

                    # Also collect explore_links from sub-pages
                    sub_explore_links = sub_result.get("explore_links", [])
                    for sel_idx, sub_explore_link in enumerate(sub_explore_links):
                        if sub_explore_link not in excluded_url_set:
                            add_candidate(
                                url=sub_explore_link,
                                source="explore_link",
                                judgment="pending",
                                verified=False,
                                priority=candidate_priority + 200 + sel_idx,
                            )

    # Log detailed failure summary
    total_candidates = len(all_candidates)
    verified_candidates = [c for c in all_candidates if c.get("verified")]
    failed_reasons = {}
    for c in verified_candidates:
        reason = c.get("verification_failed_reason", "unknown")
        failed_reasons[reason] = failed_reasons.get(reason, 0) + 1

    logger.warning(
        f"[SEARCH FAILED] {manufacturer} {model_number} - "
        f"Total candidates: {total_candidates}, "
        f"Verified: {len(verified_candidates)}, "
        f"Failed reasons: {failed_reasons}"
    )

    # Log each candidate for debugging
    for idx, c in enumerate(all_candidates):
        logger.info(
            f"[CANDIDATE {idx + 1}/{total_candidates}] "
            f"url={c.get('url', 'N/A')[:80]}..., "
            f"source={c.get('source')}, "
            f"judgment={c.get('judgment')}, "
            f"verified={c.get('verified')}, "
            f"failed_reason={c.get('verification_failed_reason')}"
        )

    yield {
        "type": "result",
        "success": False,
        "reason": "メーカーサイトでPDFが見つかりませんでした。下記からPDFを手動アップロードできます",
        "candidates": all_candidates,
    }
