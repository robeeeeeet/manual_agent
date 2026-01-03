"""Image conversion service for HEIC to JPEG conversion"""

import io

import pillow_heif
from PIL import Image

# Register HEIF/HEIC format with Pillow
pillow_heif.register_heif_opener()


async def convert_heic_to_jpeg(
    image_bytes: bytes, quality: int = 85, max_size: int = 1200
) -> bytes:
    """
    Convert HEIC/HEIF image to JPEG for preview.

    Args:
        image_bytes: Raw HEIC/HEIF image bytes
        quality: JPEG quality (1-100), default 85
        max_size: Maximum dimension (width or height), default 1200px

    Returns:
        JPEG image as bytes
    """
    # Open HEIC image
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if necessary (HEIC might have alpha channel)
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    # Resize if too large (for preview purposes)
    if max(image.size) > max_size:
        ratio = max_size / max(image.size)
        new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    # Save as JPEG
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=quality, optimize=True)
    output.seek(0)

    return output.read()


def is_heic_file(filename: str) -> bool:
    """Check if filename has HEIC/HEIF extension"""
    if not filename:
        return False
    lower_name = filename.lower()
    return lower_name.endswith(".heic") or lower_name.endswith(".heif")
