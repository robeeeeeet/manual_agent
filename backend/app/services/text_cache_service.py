"""Text cache service for PDF text extraction and caching."""

import logging

from google import genai
from google.genai import types

from app.config import settings
from app.services.pdf_storage import get_text_cache_path
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF using Gemini API.

    Args:
        pdf_bytes: PDF file bytes

    Returns:
        Extracted text in Markdown format

    Raises:
        Exception: If extraction fails
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = """
このPDFの全テキスト内容を抽出してください。
- 目次、本文、表、図のキャプションなど、すべてのテキストを含めてください
- 元の構造（見出し、リスト等）を維持してMarkdown形式で出力してください
- ページ番号がある場合は `[P.XX]` の形式で含めてください
"""

    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    types.Part.from_text(text=prompt),
                ],
            ),
        ],
    )

    return response.text


async def get_text_cache(manufacturer: str, model_number: str) -> str | None:
    """
    Get text cache from Supabase Storage.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        Cached text or None if not found
    """
    supabase = get_supabase_client()
    cache_path = get_text_cache_path(manufacturer, model_number)

    try:
        response = supabase.storage.from_("manuals").download(cache_path)
        return response.decode("utf-8")
    except Exception as e:
        logger.debug(f"Text cache not found: {cache_path}, error: {e}")
        return None


async def save_text_cache(manufacturer: str, model_number: str, text: str) -> str:
    """
    Save text cache to Supabase Storage.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        text: Extracted text content

    Returns:
        Storage path of saved cache
    """
    supabase = get_supabase_client()
    cache_path = get_text_cache_path(manufacturer, model_number)

    supabase.storage.from_("manuals").upload(
        cache_path,
        text.encode("utf-8"),
        {"content-type": "text/plain", "upsert": "true"},
    )

    return cache_path


async def get_or_create_text_cache(
    manufacturer: str, model_number: str, pdf_bytes: bytes
) -> str:
    """
    Get text cache or create if not exists.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        pdf_bytes: PDF file bytes for extraction if cache doesn't exist

    Returns:
        Cached or newly extracted text
    """
    cached = await get_text_cache(manufacturer, model_number)
    if cached:
        logger.debug(f"Text cache found for {manufacturer} {model_number}")
        return cached

    logger.info(f"Creating text cache for {manufacturer} {model_number}")
    text = await extract_text_from_pdf(pdf_bytes)
    await save_text_cache(manufacturer, model_number, text)
    return text
