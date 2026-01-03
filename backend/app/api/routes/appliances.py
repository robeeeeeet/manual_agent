"""Appliance-related API routes"""

import base64
import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.config import settings
from app.schemas.appliance import ErrorResponse, ImageRecognitionResponse
from app.services.image_conversion import convert_heic_to_jpeg, is_heic_file
from app.services.image_recognition import analyze_appliance_image

router = APIRouter(prefix="/appliances", tags=["appliances"])

# Type aliases with metadata for API parameters
ImageFile = Annotated[UploadFile, File(description="Image file of the appliance")]
CategoriesForm = Annotated[
    str | None, Form(description="JSON array of existing category names")
]

# Allowed image extensions
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"}


@router.post(
    "/recognize",
    response_model=ImageRecognitionResponse,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Recognize appliance from image",
    description="Upload an image of an appliance to extract manufacturer and model number",
)
async def recognize_appliance(
    image: ImageFile,
    categories: CategoriesForm = None,
):
    """
    Recognize appliance from uploaded image.

    This endpoint accepts an image file and uses Gemini Vision API to extract:
    - Manufacturer name
    - Model number (if visible)
    - Product category
    - Guidance for finding label if not visible

    Args:
        image: Uploaded image file (JPEG, PNG, WebP, HEIC)

    Returns:
        ImageRecognitionResponse with extracted information

    Raises:
        HTTPException: If file is invalid or processing fails
    """
    # Validate file type (check both content_type and extension)
    is_valid_content_type = image.content_type and image.content_type.startswith(
        "image/"
    )

    # Also check by file extension (for HEIC and other formats that may not have correct MIME type)
    file_ext = Path(image.filename or "").suffix.lower() if image.filename else ""
    is_valid_extension = file_ext in ALLOWED_IMAGE_EXTENSIONS

    if not is_valid_content_type and not is_valid_extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid file type",
                "code": "INVALID_FILE_TYPE",
                "details": f"Expected image file, got {image.content_type} (extension: {file_ext})",
            },
        )

    # Check file size
    contents = await image.read()
    file_size_mb = len(contents) / (1024 * 1024)

    if file_size_mb > settings.max_upload_size_mb:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "File too large",
                "code": "FILE_TOO_LARGE",
                "details": f"Max size: {settings.max_upload_size_mb}MB, got {file_size_mb:.2f}MB",
            },
        )

    try:
        # Parse categories if provided
        category_list = None
        if categories:
            try:
                category_list = json.loads(categories)
            except json.JSONDecodeError:
                pass  # Use default categories if parsing fails

        # Analyze image
        result = await analyze_appliance_image(
            contents, image.filename or "image.jpg", existing_categories=category_list
        )
        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Image recognition failed",
                "code": "RECOGNITION_ERROR",
                "details": str(e),
            },
        ) from e


@router.post(
    "/convert-heic",
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Convert HEIC to JPEG",
    description="Convert HEIC/HEIF image to JPEG for preview",
)
async def convert_heic_image(
    image: ImageFile,
):
    """
    Convert HEIC/HEIF image to JPEG for preview.

    This endpoint accepts a HEIC/HEIF file and returns a base64-encoded JPEG.

    Args:
        image: Uploaded HEIC/HEIF image file

    Returns:
        JSON with base64-encoded JPEG data URL

    Raises:
        HTTPException: If file is invalid or conversion fails
    """
    # Validate file type
    if not is_heic_file(image.filename or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid file type",
                "code": "INVALID_FILE_TYPE",
                "details": "Expected HEIC/HEIF file",
            },
        )

    # Check file size
    contents = await image.read()
    file_size_mb = len(contents) / (1024 * 1024)

    if file_size_mb > settings.max_upload_size_mb:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "File too large",
                "code": "FILE_TOO_LARGE",
                "details": f"Max size: {settings.max_upload_size_mb}MB, got {file_size_mb:.2f}MB",
            },
        )

    try:
        # Convert HEIC to JPEG
        jpeg_bytes = await convert_heic_to_jpeg(contents)

        # Encode as base64 data URL
        base64_data = base64.b64encode(jpeg_bytes).decode("utf-8")
        data_url = f"data:image/jpeg;base64,{base64_data}"

        return JSONResponse(
            content={
                "success": True,
                "dataUrl": data_url,
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "HEIC conversion failed",
                "code": "CONVERSION_ERROR",
                "details": str(e),
            },
        ) from e
