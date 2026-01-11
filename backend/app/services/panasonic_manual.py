"""パナソニック公式サイトからの取扱説明書取得

パナソニック製品の説明書を公式サポートサイトから直接取得する。
Google CSE API を経由せず、公式サイトをスクレイピングすることで
より正確な説明書を取得できる。
"""

import logging

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# パナソニック製品ページへの直接アクセスURL
# このURLは自動的に正しい製品ページにリダイレクトされる
PANASONIC_PRODUCT_URL = "https://panasonic.jp/c-sites/product.html"
PANASONIC_BASE_URL = "https://panasonic.jp"


async def search_panasonic_manual(model_number: str) -> dict | None:
    """
    パナソニック公式サイトから取扱説明書PDFを検索

    検索ページはJavaScriptで動的にレンダリングされるため、
    直接製品ページにアクセスする方式を使用。
    `c-sites/product.html?hb={型番}&tab=support` はサーバーサイドで
    正しい製品ページにリダイレクトされる。

    Args:
        model_number: 製品型番

    Returns:
        成功時: {"pdf_url": str, "method": "panasonic_official"}
        失敗時: None
    """
    try:
        # 直接製品ページにアクセス（サーバーサイドリダイレクト）
        product_url = f"{PANASONIC_PRODUCT_URL}?hb={model_number}&tab=support"
        logger.info(f"[PANASONIC] Accessing product page: {product_url}")

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(product_url)
            response.raise_for_status()

            final_url = str(response.url)
            logger.info(f"[PANASONIC] Final URL: {final_url}")

            # リダイレクト先が製品ページでない場合（404相当）
            if "product.html" in final_url or "error" in final_url.lower():
                logger.info(f"[PANASONIC] Product not found: {model_number}")
                return None

            # PDFリンクを抽出
            pdf_url = extract_manual_pdf_url(response.text)
            if not pdf_url:
                logger.info(f"[PANASONIC] No PDF link found for: {model_number}")
                return None

            if not pdf_url.startswith("http"):
                pdf_url = PANASONIC_BASE_URL + pdf_url

            logger.info(f"[PANASONIC] Found PDF: {pdf_url}")
            return {"pdf_url": pdf_url, "method": "panasonic_official"}

    except httpx.TimeoutException:
        logger.warning(f"[PANASONIC] Timeout for: {model_number}")
        return None
    except httpx.HTTPStatusError as e:
        logger.warning(
            f"[PANASONIC] HTTP error {e.response.status_code} for: {model_number}"
        )
        return None
    except Exception as e:
        logger.warning(f"[PANASONIC] Search error: {e}")
        return None


def extract_manual_pdf_url(html: str) -> str | None:
    """製品詳細ページHTMLから取扱説明書PDFのURLを抽出

    Args:
        html: 製品詳細ページのHTML

    Returns:
        取扱説明書PDFのURL、見つからない場合はNone
    """
    soup = BeautifulSoup(html, "html.parser")

    # c-product__link クラスでPDFリンクを探す（推奨）
    for link in soup.find_all("a", class_="c-product__link", href=True):
        href = link["href"]
        text = link.get_text(strip=True)

        # PDFリンクかつ「取扱説明書」を含む
        if ".pdf" in href.lower() and "取扱説明書" in text:
            logger.debug(f"[PANASONIC] Found manual PDF via c-product__link: {text}")
            return href

    # フォールバック: すべてのPDFリンクから探す
    for link in soup.find_all("a", href=True):
        href = link["href"]
        text = link.get_text(strip=True)

        if ".pdf" in href.lower() and "取扱説明書" in text:
            # support/manual パスを含むものを優先
            if "/support/manual/" in href or "/pim-assets/support/manual/" in href:
                logger.debug(f"[PANASONIC] Found manual PDF via fallback: {text}")
                return href

    return None


def is_panasonic(manufacturer: str) -> bool:
    """メーカー名がパナソニックかどうかを判定

    Args:
        manufacturer: メーカー名

    Returns:
        パナソニック系の場合True
    """
    if not manufacturer:
        return False

    normalized = manufacturer.lower().strip()
    panasonic_names = [
        "panasonic",
        "パナソニック",
        "national",  # 旧ブランド名
        "ナショナル",
    ]

    return any(name in normalized for name in panasonic_names)
