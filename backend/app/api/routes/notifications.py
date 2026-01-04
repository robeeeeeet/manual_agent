"""Notification API routes"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from app.schemas.appliance import ErrorResponse
from app.schemas.notification import (
    MaintenanceReminderRequest,
    MaintenanceReminderResponse,
    NotificationPayload,
    SendBulkNotificationRequest,
    SendBulkNotificationResponse,
    SendNotificationRequest,
    SendNotificationResponse,
)
from app.services.maintenance_notification_service import (
    MaintenanceNotificationError,
    send_maintenance_reminders,
)
from app.services.notification_service import (
    NotificationServiceError,
    VAPIDNotConfiguredError,
    send_notification_to_multiple_users,
    send_notification_to_user,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


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
    "/send",
    response_model=SendNotificationResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Send push notification to a user",
    description="Send a push notification to all subscriptions of a specific user. "
    "This endpoint is intended for testing and admin use. "
    "For automated scheduled notifications, use the background scheduler.",
)
async def send_notification(
    request: SendNotificationRequest,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Send a push notification to a user.

    This endpoint sends a notification to all active subscriptions of the specified user.
    Expired subscriptions (410 Gone) are automatically deleted.

    Args:
        request: SendNotificationRequest with user_id and notification payload
        x_user_id: Caller's user ID from header (for authorization)

    Returns:
        SendNotificationResponse with send results

    Raises:
        HTTPException: If notification sending fails
    """
    # Validate caller is authenticated (even if we don't use the ID for now)
    _get_user_id_from_header(x_user_id)

    # Parse target user ID
    try:
        target_user_id = UUID(request.user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid target user ID",
                "code": "INVALID_USER_ID",
                "details": "user_id must be a valid UUID",
            },
        ) from e

    # Send notification
    try:
        results = await send_notification_to_user(
            target_user_id, request.notification.model_dump()
        )
        return SendNotificationResponse(**results)

    except VAPIDNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "VAPID not configured",
                "code": "VAPID_NOT_CONFIGURED",
                "details": str(e),
            },
        ) from e

    except NotificationServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Notification sending failed",
                "code": "NOTIFICATION_ERROR",
                "details": str(e),
            },
        ) from e


@router.post(
    "/send-bulk",
    response_model=SendBulkNotificationResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Send push notification to multiple users",
    description="Send a push notification to all subscriptions of multiple users. "
    "This endpoint is intended for bulk operations and scheduled notifications.",
)
async def send_bulk_notification(
    request: SendBulkNotificationRequest,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Send a push notification to multiple users.

    This endpoint sends the same notification to all specified users.
    Expired subscriptions (410 Gone) are automatically deleted.

    Args:
        request: SendBulkNotificationRequest with user_ids and notification payload
        x_user_id: Caller's user ID from header (for authorization)

    Returns:
        SendBulkNotificationResponse with aggregated send results

    Raises:
        HTTPException: If notification sending fails
    """
    # Validate caller is authenticated
    _get_user_id_from_header(x_user_id)

    # Parse target user IDs
    try:
        target_user_ids = [UUID(uid) for uid in request.user_ids]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid target user ID",
                "code": "INVALID_USER_ID",
                "details": "All user_ids must be valid UUIDs",
            },
        ) from e

    # Send notifications
    try:
        results = await send_notification_to_multiple_users(
            target_user_ids, request.notification.model_dump()
        )
        return SendBulkNotificationResponse(**results)

    except VAPIDNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "VAPID not configured",
                "code": "VAPID_NOT_CONFIGURED",
                "details": str(e),
            },
        ) from e

    except NotificationServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Bulk notification sending failed",
                "code": "NOTIFICATION_ERROR",
                "details": str(e),
            },
        ) from e


@router.post(
    "/test",
    response_model=SendNotificationResponse,
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Send test notification to authenticated user",
    description="Send a test notification to the authenticated user's subscriptions",
)
async def send_test_notification(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Send a test notification to the authenticated user.

    This is a convenience endpoint for testing push notifications.
    It sends a predefined test message to the caller's subscriptions.

    Args:
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        SendNotificationResponse with send results

    Raises:
        HTTPException: If notification sending fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    # Create test notification payload
    test_notification = NotificationPayload(
        title="テスト通知",
        body="これはテスト通知です。通知機能が正常に動作しています。",
        icon="/icon-192.png",
        badge="/badge-72.png",
        data={
            "url": "/",
            "type": "test",
        },
    )

    # Send notification
    try:
        results = await send_notification_to_user(
            user_id, test_notification.model_dump()
        )
        return SendNotificationResponse(**results)

    except VAPIDNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "VAPID not configured",
                "code": "VAPID_NOT_CONFIGURED",
                "details": str(e),
            },
        ) from e

    except NotificationServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Test notification sending failed",
                "code": "NOTIFICATION_ERROR",
                "details": str(e),
            },
        ) from e


@router.post(
    "/reminders/send",
    response_model=MaintenanceReminderResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Send maintenance reminder notifications",
    description="Trigger maintenance reminder notifications for users with upcoming maintenance. "
    "This endpoint can be called by a scheduled job or triggered manually.",
)
async def send_reminders(
    request: MaintenanceReminderRequest | None = None,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Send maintenance reminder notifications.

    This endpoint finds users with maintenance due within the specified number of days
    and sends push notifications to remind them.

    For scheduled/batch operations, call without user_id to process all users.
    For testing, specify a user_id to send reminders only to that user.

    Args:
        request: Optional request with days_ahead and user_id
        x_user_id: Caller's user ID from header (for authorization)

    Returns:
        MaintenanceReminderResponse with notification results

    Raises:
        HTTPException: If reminder sending fails
    """
    # Validate caller is authenticated
    _get_user_id_from_header(x_user_id)

    days_ahead = 7
    target_user_id = None

    if request:
        days_ahead = request.days_ahead
        target_user_id = request.user_id

    try:
        results = await send_maintenance_reminders(
            days_ahead=days_ahead,
            user_id=target_user_id,
        )
        return MaintenanceReminderResponse(**results)

    except VAPIDNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "VAPID not configured",
                "code": "VAPID_NOT_CONFIGURED",
                "details": str(e),
            },
        ) from e

    except MaintenanceNotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Maintenance reminder sending failed",
                "code": "REMINDER_ERROR",
                "details": str(e),
            },
        ) from e

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Unexpected error",
                "code": "INTERNAL_ERROR",
                "details": str(e),
            },
        ) from e


@router.post(
    "/reminders/my",
    response_model=MaintenanceReminderResponse,
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Send maintenance reminders to current user",
    description="Trigger maintenance reminder notifications for the authenticated user. "
    "Useful for testing or manual reminder requests.",
)
async def send_my_reminders(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Send maintenance reminders to the authenticated user.

    This convenience endpoint sends maintenance reminders only to the calling user.
    It checks for maintenance due within the next 7 days.

    Args:
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        MaintenanceReminderResponse with notification results

    Raises:
        HTTPException: If reminder sending fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        results = await send_maintenance_reminders(
            days_ahead=7,
            user_id=str(user_id),
        )
        return MaintenanceReminderResponse(**results)

    except VAPIDNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "VAPID not configured",
                "code": "VAPID_NOT_CONFIGURED",
                "details": str(e),
            },
        ) from e

    except MaintenanceNotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Maintenance reminder sending failed",
                "code": "REMINDER_ERROR",
                "details": str(e),
            },
        ) from e

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Unexpected error",
                "code": "INTERNAL_ERROR",
                "details": str(e),
            },
        ) from e
