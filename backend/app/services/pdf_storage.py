"""
PDF Storage Service

Handles downloading PDFs from URLs and storing them in Supabase Storage.
Also provides functionality to search for existing PDFs by manufacturer and model number.
Includes PDF decryption for encrypted PDFs (owner password only).
"""

import hashlib
import logging
import re

import httpx

from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# Storage bucket name for manual PDFs
MANUALS_BUCKET = "manuals"


def normalize_manufacturer(manufacturer: str) -> str:
    """
    Normalize manufacturer name for consistent storage paths.

    Converts to ASCII-safe format. Non-ASCII characters (like Japanese)
    are converted to a short hash to ensure Supabase Storage compatibility.

    Args:
        manufacturer: Original manufacturer name

    Returns:
        Normalized manufacturer name (ASCII only)
    """
    normalized = manufacturer.lower().strip().replace(" ", "_").replace("　", "_")

    # Check if string contains non-ASCII characters
    if not normalized.isascii():
        # Create a hash from the original name for uniqueness
        hash_suffix = hashlib.sha256(manufacturer.encode("utf-8")).hexdigest()[:8]
        # Keep any ASCII characters and append hash
        ascii_part = re.sub(r"[^\x00-\x7F]+", "", normalized)
        if ascii_part:
            return f"{ascii_part}_{hash_suffix}"
        else:
            return f"mfr_{hash_suffix}"

    return normalized


def normalize_model_number(model_number: str) -> str:
    """
    Normalize model number for consistent storage paths.

    Converts to ASCII-safe format for Supabase Storage compatibility.

    Args:
        model_number: Original model number

    Returns:
        Normalized model number (ASCII only)
    """
    # Remove common problematic characters for file paths
    normalized = (
        model_number.strip().replace(" ", "_").replace("/", "-").replace("\\", "-")
    )

    # Check if string contains non-ASCII characters
    if not normalized.isascii():
        # Create a hash from the original model number
        hash_suffix = hashlib.sha256(model_number.encode("utf-8")).hexdigest()[:8]
        # Keep any ASCII characters and append hash
        ascii_part = re.sub(r"[^\x00-\x7F]+", "", normalized)
        if ascii_part:
            return f"{ascii_part}_{hash_suffix}"
        else:
            return f"model_{hash_suffix}"

    return normalized


def generate_storage_path(manufacturer: str, model_number: str) -> str:
    """
    Generate a storage path for a PDF based on manufacturer and model number.

    Path format (new): {normalized_manufacturer}/{normalized_model_number}/manual.pdf

    Note: Old format was {normalized_manufacturer}/{normalized_model_number}.pdf
    This was updated in Phase 6 to support the folder structure for QA and text_cache files.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        Storage path string
    """
    # Use new folder structure: mfr_xxx/model/manual.pdf
    norm_manufacturer = normalize_manufacturer(manufacturer)
    norm_model = normalize_model_number(model_number)
    return f"{norm_manufacturer}/{norm_model}/manual.pdf"


def generate_folder_path(manufacturer: str, model_number: str) -> str:
    """
    Generate folder path for a product: {normalized_manufacturer}/{normalized_model}/

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        Folder path string (with trailing slash)
    """
    norm_manufacturer = normalize_manufacturer(manufacturer)
    norm_model = normalize_model_number(model_number)
    return f"{norm_manufacturer}/{norm_model}"


def get_qa_path(manufacturer: str, model_number: str) -> str:
    """
    Generate QA file path: {normalized_manufacturer}/{normalized_model}/qa.md

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        QA file path string
    """
    return f"{generate_folder_path(manufacturer, model_number)}/qa.md"


def get_text_cache_path(manufacturer: str, model_number: str) -> str:
    """
    Generate text cache path: {normalized_manufacturer}/{normalized_model}/text_cache.md

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        Text cache path string
    """
    return f"{generate_folder_path(manufacturer, model_number)}/text_cache.md"


def get_manual_pdf_path(manufacturer: str, model_number: str) -> str:
    """
    Generate manual PDF path (new folder format): {normalized_manufacturer}/{normalized_model}/manual.pdf

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        Manual PDF path string
    """
    return f"{generate_folder_path(manufacturer, model_number)}/manual.pdf"


async def download_pdf(url: str, timeout: float = 60.0) -> bytes | None:
    """
    Download a PDF from a URL.

    Args:
        url: URL of the PDF to download
        timeout: Request timeout in seconds

    Returns:
        PDF content as bytes, or None if download failed
    """
    import time

    start_time = time.time()
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
        ) as client:
            response = await client.get(url)
            response.raise_for_status()

            # Verify it's a PDF (check magic bytes or content type)
            content = response.content
            content_type = response.headers.get("content-type", "")

            # Check if content is PDF
            if content.startswith(b"%PDF") or "application/pdf" in content_type:
                elapsed = time.time() - start_time
                size_mb = len(content) / (1024 * 1024)
                logger.info(
                    f"PDF download completed in {elapsed:.2f}s "
                    f"(size={size_mb:.2f}MB, url={url[:80]}...)"
                )
                return content
            else:
                elapsed = time.time() - start_time
                logger.warning(
                    f"Downloaded content is not a PDF (elapsed={elapsed:.2f}s). "
                    f"Content-Type: {content_type}, url={url}"
                )
                return None

    except httpx.HTTPError as e:
        elapsed = time.time() - start_time
        logger.error(
            f"HTTP error downloading PDF (elapsed={elapsed:.2f}s) from {url}: {e}"
        )
        return None
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            f"Error downloading PDF (elapsed={elapsed:.2f}s) from {url}: {e}",
            exc_info=True,
        )
        return None


async def upload_pdf_to_storage(
    pdf_content: bytes,
    storage_path: str,
    max_retries: int = 3,
    retry_delay: float = 5.0,
) -> str | None:
    """
    Upload PDF content to Supabase Storage with retry logic.

    Args:
        pdf_content: PDF file content as bytes
        storage_path: Path within the storage bucket
        max_retries: Maximum number of upload attempts (default: 3)
        retry_delay: Delay between retries in seconds (default: 5.0)

    Returns:
        Full storage path on success, None on failure
    """
    import asyncio

    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        return None

    file_size_mb = len(pdf_content) / (1024 * 1024)

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(
                f"Uploading PDF to storage: {storage_path} "
                f"({file_size_mb:.1f}MB, attempt {attempt}/{max_retries})"
            )

            # Upload to storage
            # Note: upsert=True will overwrite if file exists
            client.storage.from_(MANUALS_BUCKET).upload(
                path=storage_path,
                file=pdf_content,
                file_options={
                    "content-type": "application/pdf",
                    "upsert": "true",  # Overwrite if exists
                },
            )

            logger.info(f"Upload successful: {storage_path}")
            return storage_path

        except Exception as e:
            error_msg = str(e)
            logger.warning(f"Upload attempt {attempt} failed: {error_msg[:100]}")

            if attempt < max_retries:
                logger.info(f"Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
            else:
                logger.error(
                    f"Upload failed after {max_retries} attempts: {storage_path}"
                )
                return None

    return None


async def save_pdf_from_url(manufacturer: str, model_number: str, pdf_url: str) -> dict:
    """
    Download a PDF from URL and save it to Supabase Storage.
    If the PDF is encrypted with owner password, decrypt it before saving.
    If encrypted with user password (cannot decrypt), save as-is and flag it.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        pdf_url: URL of the PDF to download

    Returns:
        Dict with:
            - success: bool
            - storage_path: str (if successful)
            - is_encrypted: bool (True if still encrypted after decryption attempt)
            - error: str (if failed)
    """
    # Import here to avoid circular import at module load time
    from app.services.pdf_decryption import decrypt_pdf

    logger.info(
        f"save_pdf_from_url called: manufacturer={manufacturer}, model={model_number}"
    )
    logger.info(f"PDF URL: {pdf_url}")

    # Generate storage path
    storage_path = generate_storage_path(manufacturer, model_number)
    logger.info(f"Storage path: {storage_path}")

    # Download PDF
    logger.info("Downloading PDF...")
    pdf_content = await download_pdf(pdf_url)
    if not pdf_content:
        logger.error("PDF download failed")
        return {"success": False, "error": "PDFのダウンロードに失敗しました"}

    logger.info(f"PDF downloaded successfully: {len(pdf_content)} bytes")

    # Attempt to decrypt PDF (handles owner password protection)
    logger.info("Checking PDF encryption and attempting decryption...")
    decrypted_content, was_decrypted, still_encrypted = decrypt_pdf(pdf_content)

    if was_decrypted:
        logger.info(f"PDF decrypted successfully for {manufacturer}/{model_number}")
        pdf_content = decrypted_content
    elif still_encrypted:
        logger.warning(
            f"PDF requires user password, cannot decrypt: {manufacturer}/{model_number}"
        )
        # Keep original content, but flag as encrypted
    else:
        logger.info("PDF was not encrypted")

    # Upload to storage (either decrypted or original if user password required)
    logger.info("Uploading to storage...")
    saved_path = await upload_pdf_to_storage(pdf_content, storage_path)
    if not saved_path:
        logger.error("Storage upload failed")
        return {"success": False, "error": "PDFの保存に失敗しました"}

    logger.info(f"PDF saved successfully to: {saved_path}")
    return {
        "success": True,
        "storage_path": saved_path,
        "is_encrypted": still_encrypted,
    }


async def get_pdf_public_url(storage_path: str) -> str | None:
    """
    Get a public URL for a stored PDF.

    Args:
        storage_path: Path within the storage bucket

    Returns:
        Public URL string, or None if not available
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        result = client.storage.from_(MANUALS_BUCKET).get_public_url(storage_path)
        return result
    except Exception as e:
        logger.error(f"Error getting public URL for {storage_path}: {e}", exc_info=True)
        return None


async def get_pdf_signed_url(storage_path: str, expires_in: int = 3600) -> str | None:
    """
    Get a signed URL for a stored PDF (for private buckets).

    Args:
        storage_path: Path within the storage bucket
        expires_in: URL expiration time in seconds (default: 1 hour)

    Returns:
        Signed URL string, or None if not available
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        result = client.storage.from_(MANUALS_BUCKET).create_signed_url(
            path=storage_path, expires_in=expires_in
        )
        return result.get("signedURL")
    except Exception as e:
        logger.error(
            f"Error creating signed URL for {storage_path}: {e}", exc_info=True
        )
        return None


async def find_existing_pdf(manufacturer: str, model_number: str) -> dict | None:
    """
    Search for an existing PDF by manufacturer and model number.

    Looks in the shared_appliances table for any record with matching
    manufacturer and model number that has a stored PDF.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        Dict with pdf info if found:
            - id: str (shared_appliance_id)
            - storage_path: str
            - source_url: str (original URL)
            - public_url: str (accessible URL)
        None if not found
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        # Search for existing shared appliance with same maker and model_number
        # that has a stored PDF
        result = (
            client.table("shared_appliances")
            .select("id, stored_pdf_path, manual_source_url")
            .ilike("maker", manufacturer)
            .ilike("model_number", model_number)
            .not_.is_("stored_pdf_path", "null")
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            record = result.data[0]
            storage_path = record.get("stored_pdf_path")

            if storage_path:
                # Get accessible URL (use signed URL since bucket requires authentication)
                signed_url = await get_pdf_signed_url(storage_path, expires_in=3600)

                return {
                    "id": record.get("id"),
                    "storage_path": storage_path,
                    "source_url": record.get("manual_source_url"),
                    "public_url": signed_url,  # Using signed URL for authenticated access
                }

        return None

    except Exception as e:
        logger.error(
            f"Error searching for existing PDF: manufacturer={manufacturer}, "
            f"model_number={model_number}, error={e}",
            exc_info=True,
        )
        return None


async def check_pdf_exists_in_storage(storage_path: str) -> bool:
    """
    Check if a PDF exists in storage at the given path.

    Args:
        storage_path: Path to check

    Returns:
        True if file exists, False otherwise
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        # Try to get file info
        # Extract folder and filename from path
        parts = storage_path.rsplit("/", 1)
        if len(parts) == 2:
            folder, filename = parts
        else:
            folder = ""
            filename = storage_path

        result = client.storage.from_(MANUALS_BUCKET).list(folder)

        for file_info in result:
            if file_info.get("name") == filename:
                return True

        return False

    except Exception as e:
        logger.error(
            f"Error checking PDF existence: {storage_path}, error={e}", exc_info=True
        )
        return False
