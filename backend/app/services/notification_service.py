"""Service for sending web push notifications."""

import logging
from typing import Any
from uuid import UUID

from pywebpush import WebPushException, webpush

from app.config import settings
from app.schemas.push_subscription import PushSubscriptionResponse
from app.services.push_subscription_service import get_user_subscriptions
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class NotificationServiceError(Exception):
    """Base exception for notification service errors."""

    pass


class VAPIDNotConfiguredError(NotificationServiceError):
    """Raised when VAPID keys are not configured."""

    pass


def _validate_vapid_config():
    """
    Validate VAPID configuration.

    Raises:
        VAPIDNotConfiguredError: If VAPID keys are not configured
    """
    if not settings.vapid_public_key:
        raise VAPIDNotConfiguredError("VAPID_PUBLIC_KEY not configured")
    if not settings.vapid_private_key:
        raise VAPIDNotConfiguredError("VAPID_PRIVATE_KEY not configured")
    if not settings.vapid_subject:
        raise VAPIDNotConfiguredError("VAPID_SUBJECT not configured")


async def send_notification_to_user(
    user_id: UUID,
    notification_payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Send a push notification to all subscriptions of a user.

    Args:
        user_id: User's UUID
        notification_payload: Notification data in the format:
            {
                "title": "Notification title",
                "body": "Notification body",
                "icon": "/icon-192.png",
                "badge": "/badge-72.png",
                "data": {
                    "url": "/appliances/123",
                    "type": "maintenance_reminder"
                }
            }

    Returns:
        Dictionary with results:
            {
                "success": int,  # Number of successful sends
                "failed": int,   # Number of failed sends
                "expired": int,  # Number of expired subscriptions (deleted)
                "errors": [str]  # List of error messages
            }

    Raises:
        VAPIDNotConfiguredError: If VAPID keys are not configured
        NotificationServiceError: If notification sending fails
    """
    _validate_vapid_config()

    # Get all subscriptions for the user
    try:
        subscriptions = await get_user_subscriptions(user_id)
    except Exception as e:
        raise NotificationServiceError(f"Failed to get user subscriptions: {e}") from e

    if not subscriptions:
        logger.info(f"No subscriptions found for user {user_id}")
        return {"success": 0, "failed": 0, "expired": 0, "errors": []}

    # Send notification to each subscription
    results = {
        "success": 0,
        "failed": 0,
        "expired": 0,
        "errors": [],
    }

    for subscription in subscriptions:
        try:
            await _send_to_subscription(subscription, notification_payload)
            results["success"] += 1
            logger.info(
                f"Notification sent successfully to subscription {subscription.id}"
            )

        except WebPushException as e:
            # Check if subscription has expired (410 Gone)
            if e.response and e.response.status_code == 410:
                logger.warning(
                    f"Subscription {subscription.id} has expired, deleting..."
                )
                try:
                    await _delete_expired_subscription(subscription.id)
                    results["expired"] += 1
                except Exception as delete_error:
                    logger.error(
                        f"Failed to delete expired subscription {subscription.id}: {delete_error}"
                    )
                    results["failed"] += 1
                    results["errors"].append(
                        f"Subscription {subscription.id}: Failed to delete expired subscription"
                    )
            else:
                logger.error(
                    f"Failed to send notification to subscription {subscription.id}: {e}"
                )
                results["failed"] += 1
                results["errors"].append(f"Subscription {subscription.id}: {str(e)}")

        except Exception as e:
            logger.error(
                f"Unexpected error sending to subscription {subscription.id}: {e}"
            )
            results["failed"] += 1
            results["errors"].append(
                f"Subscription {subscription.id}: Unexpected error: {str(e)}"
            )

    return results


async def _send_to_subscription(
    subscription: PushSubscriptionResponse,
    notification_payload: dict[str, Any],
):
    """
    Send push notification to a single subscription.

    Args:
        subscription: PushSubscriptionResponse object
        notification_payload: Notification data

    Raises:
        WebPushException: If push notification fails
    """
    import json

    # Construct subscription info for pywebpush
    subscription_info = {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh_key,
            "auth": subscription.auth_key,
        },
    }

    # VAPID claims
    vapid_claims = {"sub": settings.vapid_subject}

    # Send the notification
    webpush(
        subscription_info=subscription_info,
        data=json.dumps(notification_payload),
        vapid_private_key=settings.vapid_private_key,
        vapid_claims=vapid_claims,
    )


async def _delete_expired_subscription(subscription_id: int):
    """
    Delete an expired subscription from the database.

    Args:
        subscription_id: Subscription ID to delete

    Raises:
        NotificationServiceError: If deletion fails
    """
    client = get_supabase_client()
    if not client:
        raise NotificationServiceError("Supabase client not configured")

    try:
        client.table("push_subscriptions").delete().eq("id", subscription_id).execute()
    except Exception as e:
        raise NotificationServiceError(
            f"Failed to delete expired subscription: {e}"
        ) from e


async def send_notification_to_multiple_users(
    user_ids: list[UUID],
    notification_payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Send a push notification to multiple users.

    Args:
        user_ids: List of user UUIDs
        notification_payload: Notification data

    Returns:
        Dictionary with aggregated results:
            {
                "total_users": int,
                "success": int,
                "failed": int,
                "expired": int,
                "errors": [str]
            }

    Raises:
        VAPIDNotConfiguredError: If VAPID keys are not configured
    """
    _validate_vapid_config()

    aggregated_results = {
        "total_users": len(user_ids),
        "success": 0,
        "failed": 0,
        "expired": 0,
        "errors": [],
    }

    for user_id in user_ids:
        try:
            results = await send_notification_to_user(user_id, notification_payload)
            aggregated_results["success"] += results["success"]
            aggregated_results["failed"] += results["failed"]
            aggregated_results["expired"] += results["expired"]
            aggregated_results["errors"].extend(results["errors"])

        except Exception as e:
            logger.error(f"Failed to send notification to user {user_id}: {e}")
            aggregated_results["failed"] += 1
            aggregated_results["errors"].append(f"User {user_id}: {str(e)}")

    return aggregated_results
