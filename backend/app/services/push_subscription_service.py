"""Service for managing push notification subscriptions."""

from uuid import UUID

from app.schemas.push_subscription import (
    PushSubscriptionCreate,
    PushSubscriptionResponse,
)
from app.services.supabase_client import get_supabase_client


class PushSubscriptionServiceError(Exception):
    """Base exception for push subscription service errors."""

    pass


class SubscriptionNotFoundError(PushSubscriptionServiceError):
    """Raised when subscription is not found."""

    pass


async def subscribe(
    user_id: UUID,
    subscription_data: PushSubscriptionCreate,
) -> PushSubscriptionResponse:
    """
    Create or update a push subscription (upsert).

    If a subscription with the same endpoint already exists, it will be updated.
    Otherwise, a new subscription is created.

    Args:
        user_id: User's UUID
        subscription_data: Subscription data (endpoint, keys)

    Returns:
        PushSubscriptionResponse

    Raises:
        PushSubscriptionServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise PushSubscriptionServiceError("Supabase client not configured")

    # Check if subscription with this endpoint already exists
    existing_result = (
        client.table("push_subscriptions")
        .select("*")
        .eq("endpoint", subscription_data.endpoint)
        .execute()
    )

    if existing_result.data:
        # Update existing subscription
        existing_id = existing_result.data[0]["id"]
        update_data = {
            "user_id": str(user_id),
            "p256dh_key": subscription_data.p256dh_key,
            "auth_key": subscription_data.auth_key,
        }

        result = (
            client.table("push_subscriptions")
            .update(update_data)
            .eq("id", existing_id)
            .execute()
        )

        if not result.data:
            raise PushSubscriptionServiceError("Failed to update subscription")

        return PushSubscriptionResponse(**result.data[0])

    # Create new subscription
    insert_data = {
        "user_id": str(user_id),
        "endpoint": subscription_data.endpoint,
        "p256dh_key": subscription_data.p256dh_key,
        "auth_key": subscription_data.auth_key,
    }

    try:
        result = client.table("push_subscriptions").insert(insert_data).execute()
    except Exception as e:
        raise PushSubscriptionServiceError(f"Failed to create subscription: {e}") from e

    if not result.data:
        raise PushSubscriptionServiceError("Failed to create subscription")

    return PushSubscriptionResponse(**result.data[0])


async def unsubscribe(
    user_id: UUID,
    endpoint: str,
) -> bool:
    """
    Delete a push subscription.

    Args:
        user_id: User's UUID
        endpoint: Push service endpoint URL

    Returns:
        True if deleted successfully

    Raises:
        SubscriptionNotFoundError: If subscription not found or not owned by user
        PushSubscriptionServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise PushSubscriptionServiceError("Supabase client not configured")

    # Check if subscription exists and belongs to user
    result = (
        client.table("push_subscriptions")
        .select("id")
        .eq("user_id", str(user_id))
        .eq("endpoint", endpoint)
        .execute()
    )

    if not result.data:
        raise SubscriptionNotFoundError(
            f"Subscription with endpoint {endpoint} not found for user {user_id}"
        )

    # Delete the subscription
    try:
        client.table("push_subscriptions").delete().eq(
            "id", result.data[0]["id"]
        ).execute()
    except Exception as e:
        raise PushSubscriptionServiceError(f"Failed to delete subscription: {e}") from e

    return True


async def get_user_subscriptions(
    user_id: UUID,
) -> list[PushSubscriptionResponse]:
    """
    Get all push subscriptions for a user.

    Args:
        user_id: User's UUID

    Returns:
        List of PushSubscriptionResponse

    Raises:
        PushSubscriptionServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise PushSubscriptionServiceError("Supabase client not configured")

    try:
        result = (
            client.table("push_subscriptions")
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .execute()
        )

        return [PushSubscriptionResponse(**row) for row in result.data]

    except Exception as e:
        raise PushSubscriptionServiceError(f"Failed to get subscriptions: {e}") from e
