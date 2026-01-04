"""Appliance-related API routes"""

import base64
import json
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.config import settings
from app.schemas.appliance import (
    ErrorResponse,
    ImageRecognitionResponse,
    UserApplianceCreate,
    UserApplianceUpdate,
    UserApplianceWithDetails,
)
from app.services.appliance_service import (
    ApplianceNotFoundError,
    ApplianceServiceError,
    DuplicateNameError,
    delete_user_appliance,
    get_user_appliance,
    get_user_appliances,
    register_user_appliance,
    update_user_appliance,
)
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


# ============================================================================
# Appliance CRUD Endpoints
# ============================================================================


def _get_user_id_from_header(x_user_id: str | None) -> UUID:
    """Extract and validate user ID from header."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "User ID required",
                "code": "UNAUTHORIZED",
                "details": "X-User-ID header is required",
            },
        )
    try:
        return UUID(x_user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid user ID",
                "code": "INVALID_USER_ID",
                "details": "X-User-ID must be a valid UUID",
            },
        ) from e


@router.post(
    "/register",
    response_model=UserApplianceWithDetails,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Register a new appliance",
    description="Register a new appliance for the authenticated user",
)
async def register_appliance(
    appliance: UserApplianceCreate,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Register a new appliance.

    This endpoint:
    1. Gets or creates a shared appliance (by maker/model_number)
    2. Creates a user_appliance record linking the user to it

    Args:
        appliance: Appliance registration data
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        UserApplianceWithDetails with full appliance information

    Raises:
        HTTPException: If registration fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        result = await register_user_appliance(user_id, appliance)
        return result
    except DuplicateNameError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "Duplicate name",
                "code": "DUPLICATE_NAME",
                "details": str(e),
            },
        ) from e
    except ApplianceServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Registration failed",
                "code": "REGISTRATION_ERROR",
                "details": str(e),
            },
        ) from e


@router.get(
    "",
    response_model=list[UserApplianceWithDetails],
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get user's appliances",
    description="Get all appliances registered by the authenticated user",
)
async def list_appliances(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Get all appliances for the authenticated user.

    Args:
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        List of UserApplianceWithDetails

    Raises:
        HTTPException: If retrieval fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        return await get_user_appliances(user_id)
    except ApplianceServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to get appliances",
                "code": "FETCH_ERROR",
                "details": str(e),
            },
        ) from e


@router.get(
    "/{appliance_id}",
    response_model=UserApplianceWithDetails,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get a specific appliance",
    description="Get details of a specific appliance by ID",
)
async def get_appliance(
    appliance_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Get a specific appliance by ID.

    Args:
        appliance_id: Appliance's UUID
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        UserApplianceWithDetails

    Raises:
        HTTPException: If appliance not found or retrieval fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        return await get_user_appliance(user_id, appliance_id)
    except ApplianceNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Appliance not found",
                "code": "NOT_FOUND",
                "details": str(e),
            },
        ) from e
    except ApplianceServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to get appliance",
                "code": "FETCH_ERROR",
                "details": str(e),
            },
        ) from e


@router.patch(
    "/{appliance_id}",
    response_model=UserApplianceWithDetails,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Update an appliance",
    description="Update the display name or image of an appliance",
)
async def update_appliance(
    appliance_id: UUID,
    update_data: UserApplianceUpdate,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Update an appliance's display name or image.

    Args:
        appliance_id: Appliance's UUID
        update_data: Fields to update
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        Updated UserApplianceWithDetails

    Raises:
        HTTPException: If update fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        return await update_user_appliance(user_id, appliance_id, update_data)
    except ApplianceNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Appliance not found",
                "code": "NOT_FOUND",
                "details": str(e),
            },
        ) from e
    except DuplicateNameError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "Duplicate name",
                "code": "DUPLICATE_NAME",
                "details": str(e),
            },
        ) from e
    except ApplianceServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to update appliance",
                "code": "UPDATE_ERROR",
                "details": str(e),
            },
        ) from e


@router.delete(
    "/{appliance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Delete an appliance",
    description="Delete an appliance from the user's list",
)
async def delete_appliance(
    appliance_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Delete an appliance.

    Note: This only removes the user's ownership. The shared appliance
    data remains for other users who may have the same appliance.

    Args:
        appliance_id: Appliance's UUID
        x_user_id: User's UUID from header (set by BFF)

    Raises:
        HTTPException: If deletion fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        await delete_user_appliance(user_id, appliance_id)
    except ApplianceNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Appliance not found",
                "code": "NOT_FOUND",
                "details": str(e),
            },
        ) from e
    except ApplianceServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to delete appliance",
                "code": "DELETE_ERROR",
                "details": str(e),
            },
        ) from e
