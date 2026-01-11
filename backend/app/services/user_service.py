"""User service for profile and settings management."""

import logging
from datetime import UTC, datetime, timedelta

from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


async def get_user_profile(user_id: str) -> dict:
    """
    Get user profile information.

    Args:
        user_id: UUID of the user

    Returns:
        dict with:
        - profile: User profile data (id, email, display_name, notify_time, timezone, created_at)
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        response = (
            client.table("users")
            .select("id, email, display_name, notify_time, timezone, created_at")
            .eq("id", user_id)
            .single()
            .execute()
        )

        if not response.data:
            return {"error": "User not found"}

        return {"profile": response.data}

    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        return {"error": str(e)}


async def update_user_settings(
    user_id: str,
    notify_time: str | None = None,
    display_name: str | None = None,
) -> dict:
    """
    Update user settings.

    Args:
        user_id: UUID of the user
        notify_time: Notification time in HH:MM format (optional)
        display_name: Display name for the user (optional)

    Returns:
        dict with:
        - settings: Updated settings (display_name, notify_time, timezone, updated_at)
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        update_data: dict = {
            "updated_at": datetime.now(UTC).isoformat(),
        }

        if notify_time is not None:
            update_data["notify_time"] = notify_time

        if display_name is not None:
            # Validate display_name
            display_name = display_name.strip()
            if not display_name:
                return {"error": "表示名を入力してください"}
            if len(display_name) > 20:
                return {"error": "表示名は20文字以内で入力してください"}
            update_data["display_name"] = display_name

        response = (
            client.table("users")
            .update(update_data)
            .eq("id", user_id)
            .select("display_name, notify_time, timezone, updated_at")
            .single()
            .execute()
        )

        if not response.data:
            return {"error": "Failed to update settings"}

        return {"settings": response.data}

    except Exception as e:
        logger.error(f"Error updating user settings: {e}")
        return {"error": str(e)}


async def get_maintenance_stats(user_id: str) -> dict:
    """
    Get maintenance statistics for a user.

    Stats include:
    - upcoming_count: Tasks due within 7 days from now
    - overdue_count: Tasks with next_due_at in the past
    - completed_total: Total completed tasks
    - completed_this_month: Tasks completed this month

    Args:
        user_id: UUID of the user

    Returns:
        dict with:
        - stats: MaintenanceStats data
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        now = datetime.now(UTC)
        seven_days_later = now + timedelta(days=7)

        # Get first day of current month
        first_day_of_month = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        # First, get user's appliance IDs
        appliances_response = (
            client.table("user_appliances")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )
        appliance_ids = [a["id"] for a in (appliances_response.data or [])]

        # Default counts if no appliances
        upcoming_count = 0
        overdue_count = 0

        if appliance_ids:
            # Count upcoming maintenance (next 7 days)
            upcoming_response = (
                client.table("maintenance_schedules")
                .select("id", count="exact")
                .in_("user_appliance_id", appliance_ids)
                .gte("next_due_at", now.isoformat())
                .lte("next_due_at", seven_days_later.isoformat())
                .execute()
            )
            upcoming_count = upcoming_response.count or 0

            # Count overdue maintenance
            overdue_response = (
                client.table("maintenance_schedules")
                .select("id", count="exact")
                .in_("user_appliance_id", appliance_ids)
                .lt("next_due_at", now.isoformat())
                .execute()
            )
            overdue_count = overdue_response.count or 0

        # Count total completed maintenance
        completed_total_response = (
            client.table("maintenance_logs")
            .select("id", count="exact")
            .eq("done_by_user_id", user_id)
            .execute()
        )
        completed_total = completed_total_response.count or 0

        # Count completed this month
        completed_month_response = (
            client.table("maintenance_logs")
            .select("id", count="exact")
            .eq("done_by_user_id", user_id)
            .gte("done_at", first_day_of_month.isoformat())
            .execute()
        )
        completed_this_month = completed_month_response.count or 0

        stats = {
            "upcoming_count": upcoming_count,
            "overdue_count": overdue_count,
            "completed_total": completed_total,
            "completed_this_month": completed_this_month,
        }

        return {"stats": stats}

    except Exception as e:
        logger.error(f"Error fetching maintenance stats: {e}")
        return {"error": str(e)}
