"""User profile and settings API routes"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from app.schemas.appliance import ErrorResponse
from app.schemas.user import (
    MaintenanceStats,
    UserProfile,
    UserSettings,
    UserSettingsUpdate,
)
from app.services.user_service import (
    get_maintenance_stats,
    get_user_profile,
    update_user_settings,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


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


@router.get(
    "/me",
    response_model=UserProfile,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get user profile",
    description="Retrieve the authenticated user's profile information",
)
async def get_me(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Get authenticated user's profile.

    Returns:
        UserProfile: User profile data including email, notify_time, timezone
    """
    user_id = _get_user_id_from_header(x_user_id)

    result = await get_user_profile(str(user_id))

    if "error" in result:
        error_msg = result["error"]
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "User not found",
                    "code": "USER_NOT_FOUND",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to fetch user profile",
                "code": "INTERNAL_ERROR",
                "details": error_msg,
            },
        )

    return result["profile"]


@router.patch(
    "/settings",
    response_model=UserSettings,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Update user settings",
    description="Update user notification settings (notify_time)",
)
async def update_settings(
    settings: UserSettingsUpdate,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Update user notification settings.

    Args:
        settings: UserSettingsUpdate with notify_time (HH:MM format)

    Returns:
        UserSettings: Updated settings with notify_time, timezone, updated_at
    """
    user_id = _get_user_id_from_header(x_user_id)

    if not settings.notify_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "notify_time is required",
                "code": "INVALID_REQUEST",
            },
        )

    result = await update_user_settings(str(user_id), settings.notify_time)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to update settings",
                "code": "INTERNAL_ERROR",
                "details": result["error"],
            },
        )

    return result["settings"]


@router.get(
    "/me/maintenance-stats",
    response_model=MaintenanceStats,
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get maintenance statistics",
    description="Retrieve maintenance statistics for the authenticated user",
)
async def get_stats(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Get user's maintenance statistics.

    Returns:
        MaintenanceStats: Statistics including upcoming, overdue, and completed counts
    """
    user_id = _get_user_id_from_header(x_user_id)

    result = await get_maintenance_stats(str(user_id))

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to fetch maintenance stats",
                "code": "INTERNAL_ERROR",
                "details": result["error"],
            },
        )

    return result["stats"]
