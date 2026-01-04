"""
PDF Storage Service

Handles downloading PDFs from URLs and storing them in Supabase Storage.
Also provides functionality to search for existing PDFs by manufacturer and model number.
"""

import hashlib
import re

import httpx

from app.services.supabase_client import get_supabase_client

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

    Path format: {normalized_manufacturer}/{normalized_model_number}.pdf

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        Storage path string
    """
    norm_manufacturer = normalize_manufacturer(manufacturer)
    norm_model = normalize_model_number(model_number)
    return f"{norm_manufacturer}/{norm_model}.pdf"


async def download_pdf(url: str, timeout: float = 60.0) -> bytes | None:
    """
    Download a PDF from a URL.

    Args:
        url: URL of the PDF to download
        timeout: Request timeout in seconds

    Returns:
        PDF content as bytes, or None if download failed
    """
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
                return content
            else:
                print(f"Downloaded content is not a PDF. Content-Type: {content_type}")
                return None

    except httpx.HTTPError as e:
        print(f"HTTP error downloading PDF from {url}: {e}")
        return None
    except Exception as e:
        print(f"Error downloading PDF from {url}: {e}")
        return None


async def upload_pdf_to_storage(pdf_content: bytes, storage_path: str) -> str | None:
    """
    Upload PDF content to Supabase Storage.

    Args:
        pdf_content: PDF file content as bytes
        storage_path: Path within the storage bucket

    Returns:
        Full storage path on success, None on failure
    """
    client = get_supabase_client()
    if not client:
        print("Supabase client not available")
        return None

    try:
        print(f"Uploading PDF to storage: {storage_path} ({len(pdf_content)} bytes)")

        # Upload to storage
        # Note: upsert=True will overwrite if file exists
        result = client.storage.from_(MANUALS_BUCKET).upload(
            path=storage_path,
            file=pdf_content,
            file_options={
                "content-type": "application/pdf",
                "upsert": "true",  # Overwrite if exists
            },
        )

        print(f"Upload result: {result}")

        # Return the storage path (not URL, as we'll generate signed URLs when needed)
        return storage_path

    except Exception as e:
        import traceback

        print(f"Error uploading PDF to storage: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return None


async def save_pdf_from_url(manufacturer: str, model_number: str, pdf_url: str) -> dict:
    """
    Download a PDF from URL and save it to Supabase Storage.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        pdf_url: URL of the PDF to download

    Returns:
        Dict with:
            - success: bool
            - storage_path: str (if successful)
            - error: str (if failed)
    """
    print(
        f"save_pdf_from_url called: manufacturer={manufacturer}, model={model_number}"
    )
    print(f"PDF URL: {pdf_url}")

    # Generate storage path
    storage_path = generate_storage_path(manufacturer, model_number)
    print(f"Storage path: {storage_path}")

    # Download PDF
    print("Downloading PDF...")
    pdf_content = await download_pdf(pdf_url)
    if not pdf_content:
        print("PDF download failed")
        return {"success": False, "error": "PDFのダウンロードに失敗しました"}

    print(f"PDF downloaded successfully: {len(pdf_content)} bytes")

    # Upload to storage
    print("Uploading to storage...")
    saved_path = await upload_pdf_to_storage(pdf_content, storage_path)
    if not saved_path:
        print("Storage upload failed")
        return {"success": False, "error": "PDFの保存に失敗しました"}

    print(f"PDF saved successfully to: {saved_path}")
    return {"success": True, "storage_path": saved_path}


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
        print(f"Error getting public URL: {e}")
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
        print(f"Error creating signed URL: {e}")
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
        print(f"Error searching for existing PDF: {e}")
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
        print(f"Error checking PDF existence: {e}")
        return False
