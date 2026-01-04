"""Push subscription API routes"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from app.schemas.appliance import ErrorResponse
from app.schemas.push_subscription import (
    PushSubscriptionCreate,
    PushSubscriptionList,
    PushSubscriptionResponse,
)
from app.services.push_subscription_service import (
    PushSubscriptionServiceError,
    SubscriptionNotFoundError,
    get_user_subscriptions,
    subscribe,
    unsubscribe,
)

router = APIRouter(prefix="/push", tags=["push-notifications"])


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
    "/subscribe",
    response_model=PushSubscriptionResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Subscribe to push notifications",
    description="Register a push notification subscription for the authenticated user",
)
async def subscribe_push(
    subscription: PushSubscriptionCreate,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Subscribe to push notifications.

    This endpoint creates or updates a push subscription.
    If a subscription with the same endpoint exists, it will be updated.

    Args:
        subscription: Push subscription data (endpoint, keys)
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        PushSubscriptionResponse with subscription details

    Raises:
        HTTPException: If subscription fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        result = await subscribe(user_id, subscription)
        return result
    except PushSubscriptionServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Subscription failed",
                "code": "SUBSCRIPTION_ERROR",
                "details": str(e),
            },
        ) from e


@router.delete(
    "/unsubscribe",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Unsubscribe from push notifications",
    description="Delete a push notification subscription",
)
async def unsubscribe_push(
    endpoint: str,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Unsubscribe from push notifications.

    Args:
        endpoint: Push service endpoint URL to delete
        x_user_id: User's UUID from header (set by BFF)

    Raises:
        HTTPException: If unsubscription fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        await unsubscribe(user_id, endpoint)
    except SubscriptionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Subscription not found",
                "code": "NOT_FOUND",
                "details": str(e),
            },
        ) from e
    except PushSubscriptionServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Unsubscription failed",
                "code": "UNSUBSCRIPTION_ERROR",
                "details": str(e),
            },
        ) from e


@router.get(
    "/subscriptions",
    response_model=PushSubscriptionList,
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get user's push subscriptions",
    description="Get all push notification subscriptions for the authenticated user",
)
async def list_subscriptions(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Get all push subscriptions for the authenticated user.

    Args:
        x_user_id: User's UUID from header (set by BFF)

    Returns:
        PushSubscriptionList with all subscriptions

    Raises:
        HTTPException: If retrieval fails
    """
    user_id = _get_user_id_from_header(x_user_id)

    try:
        subscriptions = await get_user_subscriptions(user_id)
        return PushSubscriptionList(
            subscriptions=subscriptions,
            total_count=len(subscriptions),
        )
    except PushSubscriptionServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to get subscriptions",
                "code": "FETCH_ERROR",
                "details": str(e),
            },
        ) from e
