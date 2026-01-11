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
    MaintenanceCompleteRequest,
    MaintenanceCompleteResponse,
    MaintenanceLogList,
    UserApplianceCreate,
    UserApplianceUpdate,
    UserApplianceWithDetails,
)
from app.schemas.tier import TierLimitExceededError
from app.services.appliance_service import (
    AlreadySharedError,
    ApplianceNotFoundError,
    ApplianceServiceError,
    DuplicateNameError,
    NoGroupMembershipError,
    NotGroupMemberError,
    NotOwnerError,
    NotSharedError,
    delete_user_appliance,
    get_user_appliance,
    get_user_appliances,
    register_user_appliance,
    share_appliance,
    unshare_appliance,
    update_user_appliance,
)
from app.services.image_conversion import convert_heic_to_jpeg, is_heic_file
from app.services.image_recognition import analyze_appliance_image
from app.services.maintenance_log_service import (
    complete_maintenance,
    get_maintenance_logs,
    get_upcoming_maintenance,
)
from app.services.tier_service import (
    check_can_add_appliance,
    check_can_add_group_appliance,
)

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
        403: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Register a new appliance",
    description="Register a new appliance for the authenticated user or a group",
)
async def register_appliance(
    appliance: UserApplianceCreate,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Register a new appliance.

    This endpoint:
    1. Gets or creates a shared appliance (by maker/model_number)
    2. Creates a user_appliance record linking the user or group to it

    If group_id is provided in the request body, the appliance is registered
    as a group appliance (owned by the group, accessible to all members).
    Otherwise, it's registered as a personal appliance.

    Args:
        appliance: Appliance registration data (including optional group_id)
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        UserApplianceWithDetails with full appliance information

    Raises:
        HTTPException: If registration fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    # Check tier limit for appliance registration
    if appliance.group_id:
        # Group appliance - check owner's tier
        tier_check = await check_can_add_group_appliance(str(appliance.group_id))
    else:
        # Personal appliance - check user's tier
        tier_check = await check_can_add_appliance(str(user_id))

    if not tier_check["allowed"]:
        return JSONResponse(
            status_code=403,
            content=TierLimitExceededError(
                message="家電登録数が上限に達しました。プランをアップグレードしてください。",
                current_usage=tier_check["current_usage"],
                limit=tier_check["limit"],
                tier=tier_check["tier_name"],
                tier_display_name=tier_check["tier_display_name"],
            ).model_dump(),
        )

    try:
        result = await register_user_appliance(
            user_id, appliance, group_id=appliance.group_id
        )
        return result
    except NotGroupMemberError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Not a group member",
                "code": "NOT_GROUP_MEMBER",
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
    description="Get all appliances (personal + group) accessible to the authenticated user",
)
async def list_appliances(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Get all appliances for the authenticated user.

    This includes:
    - Personal appliances (owned directly by the user)
    - Group appliances (owned by groups the user is a member of)

    Args:
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        List of UserApplianceWithDetails (with is_group_owned and group_name fields)

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


# ============================================================================
# Maintenance Completion Endpoints
# ============================================================================


@router.post(
    "/schedules/{schedule_id}/complete",
    response_model=MaintenanceCompleteResponse,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Complete a maintenance task",
    description="Mark a maintenance schedule as complete and update next due date",
)
async def complete_maintenance_task(
    schedule_id: UUID,
    request: MaintenanceCompleteRequest,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Mark a maintenance task as complete.

    This endpoint:
    1. Creates a maintenance log entry
    2. Updates last_done_at on the schedule
    3. Recalculates next_due_at based on interval

    Args:
        schedule_id: Maintenance schedule UUID
        request: Completion details (optional notes and done_at)
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        MaintenanceCompleteResponse with log and updated schedule

    Raises:
        HTTPException: If completion fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    result = await complete_maintenance(
        schedule_id=str(schedule_id),
        user_id=str(user_id),
        notes=request.notes,
        done_at=request.done_at,
    )

    if "error" in result:
        if result["error"] == "Schedule not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "Schedule not found",
                    "code": "NOT_FOUND",
                    "details": result["error"],
                },
            )
        if result["error"] == "Not authorized to complete this maintenance":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "Not authorized",
                    "code": "FORBIDDEN",
                    "details": result["error"],
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to complete maintenance",
                "code": "COMPLETION_ERROR",
                "details": result["error"],
            },
        )

    return MaintenanceCompleteResponse(
        success=True,
        log=result.get("log"),
        schedule=result.get("schedule"),
        message="Maintenance task completed successfully",
    )


@router.get(
    "/schedules/{schedule_id}/logs",
    response_model=MaintenanceLogList,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get maintenance logs",
    description="Get completion history for a maintenance schedule",
)
async def get_maintenance_task_logs(
    schedule_id: UUID,
    limit: int = 10,
    offset: int = 0,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Get completion history for a maintenance schedule.

    Args:
        schedule_id: Maintenance schedule UUID
        limit: Maximum number of logs to return (default 10)
        offset: Number of logs to skip (default 0)
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        MaintenanceLogList with logs and total count

    Raises:
        HTTPException: If retrieval fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    result = await get_maintenance_logs(
        schedule_id=str(schedule_id),
        user_id=str(user_id),
        limit=limit,
        offset=offset,
    )

    if "error" in result and result["error"]:
        if result["error"] == "Schedule not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "Schedule not found",
                    "code": "NOT_FOUND",
                    "details": result["error"],
                },
            )
        if result["error"] == "Not authorized":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "Not authorized",
                    "code": "FORBIDDEN",
                    "details": result["error"],
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to get maintenance logs",
                "code": "FETCH_ERROR",
                "details": result["error"],
            },
        )

    return MaintenanceLogList(
        logs=result.get("logs", []),
        total_count=result.get("total_count", 0),
    )


@router.get(
    "/maintenance/upcoming",
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get upcoming maintenance tasks",
    description="Get maintenance tasks due within the specified number of days",
)
async def get_upcoming_maintenance_tasks(
    days: int = 7,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Get upcoming maintenance tasks.

    Args:
        days: Number of days to look ahead (default 7)
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        List of upcoming maintenance schedules with appliance info

    Raises:
        HTTPException: If retrieval fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        schedules = await get_upcoming_maintenance(
            user_id=str(user_id),
            days_ahead=days,
        )

        # Transform to include appliance info at top level
        result = []
        for schedule in schedules:
            user_appliance = schedule.get("user_appliances", {})
            shared_appliance = user_appliance.get("shared_appliances", {})

            result.append(
                {
                    "id": schedule["id"],
                    "task_name": schedule["task_name"],
                    "description": schedule.get("description"),
                    "next_due_at": schedule.get("next_due_at"),
                    "importance": schedule.get("importance", "medium"),
                    "appliance_name": user_appliance.get("name", ""),
                    "appliance_id": user_appliance.get("id"),
                    "maker": shared_appliance.get("maker", ""),
                    "model_number": shared_appliance.get("model_number", ""),
                }
            )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to get upcoming maintenance",
                "code": "FETCH_ERROR",
                "details": str(e),
            },
        ) from e


# ============================================================================
# Appliance Sharing Endpoints (Phase 7: Family Sharing)
# ============================================================================


@router.post(
    "/{appliance_id}/share",
    response_model=UserApplianceWithDetails,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Share appliance with group",
    description="Share a personal appliance with the user's group (one-tap sharing)",
)
async def share_appliance_endpoint(
    appliance_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Share a personal appliance with the user's group.

    This endpoint transfers ownership from personal to group:
    - The appliance becomes accessible to all group members
    - The original owner can still access it as a group member

    Since users can only belong to one group (Phase 7 constraint),
    no group selection is needed - the appliance is shared with
    the user's current group automatically.

    Args:
        appliance_id: Appliance's UUID
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        Updated UserApplianceWithDetails (now with is_group_owned=True)

    Raises:
        HTTPException: If sharing fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        return await share_appliance(user_id, appliance_id)
    except NoGroupMembershipError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Not in a group",
                "code": "NO_GROUP_MEMBERSHIP",
                "details": str(e),
            },
        ) from e
    except NotOwnerError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Not the owner",
                "code": "NOT_OWNER",
                "details": str(e),
            },
        ) from e
    except AlreadySharedError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "Already shared",
                "code": "ALREADY_SHARED",
                "details": str(e),
            },
        ) from e
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
                "error": "Failed to share appliance",
                "code": "SHARE_ERROR",
                "details": str(e),
            },
        ) from e


@router.post(
    "/{appliance_id}/unshare",
    response_model=UserApplianceWithDetails,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Unshare appliance from group",
    description="Return a group appliance to personal ownership",
)
async def unshare_appliance_endpoint(
    appliance_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Unshare a group appliance and return it to personal ownership.

    This endpoint transfers ownership from group to personal:
    - The requesting user becomes the personal owner
    - Other group members lose access to the appliance

    Args:
        appliance_id: Appliance's UUID
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        Updated UserApplianceWithDetails (now with is_group_owned=False)

    Raises:
        HTTPException: If unsharing fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        return await unshare_appliance(user_id, appliance_id)
    except NotSharedError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Not shared",
                "code": "NOT_SHARED",
                "details": str(e),
            },
        ) from e
    except NotGroupMemberError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Not a group member",
                "code": "NOT_GROUP_MEMBER",
                "details": str(e),
            },
        ) from e
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
                "error": "Failed to unshare appliance",
                "code": "UNSHARE_ERROR",
                "details": str(e),
            },
        ) from e
