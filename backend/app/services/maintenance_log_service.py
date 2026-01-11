"""
Maintenance log service.

Provides functionality for recording maintenance completions,
calculating next due dates, and retrieving completion history.
"""

import logging
from datetime import UTC, datetime, timedelta

from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


def _calculate_next_due_at(
    interval_type: str | None,
    interval_value: int | None,
    from_date: datetime | None = None,
) -> datetime | None:
    """
    Calculate the next due date based on interval type and value.

    Args:
        interval_type: 'days', 'months', or 'manual'
        interval_value: Numeric value for the interval
        from_date: Starting date for calculation (defaults to now)

    Returns:
        Next due datetime or None for manual/invalid intervals
    """
    if not interval_type or interval_type == "manual":
        return None

    if not interval_value or interval_value <= 0:
        return None

    base_date = from_date or datetime.now(UTC)

    if interval_type == "days":
        return base_date + timedelta(days=interval_value)
    elif interval_type == "months":
        # Approximate months as 30 days
        return base_date + timedelta(days=interval_value * 30)
    elif interval_type == "years":
        # Approximate years as 365 days
        return base_date + timedelta(days=interval_value * 365)

    return None


async def complete_maintenance(
    schedule_id: str,
    user_id: str,
    notes: str | None = None,
    done_at: datetime | None = None,
) -> dict:
    """
    Record a maintenance completion and update the schedule's next due date.

    Args:
        schedule_id: UUID of the maintenance schedule
        user_id: UUID of the user completing the maintenance
        notes: Optional notes about the completion
        done_at: When the maintenance was done (defaults to now)

    Returns:
        dict with:
        - log: The created maintenance log record
        - schedule: The updated maintenance schedule
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Fetch the schedule with shared_maintenance_items JOIN
        schedule_response = (
            client.table("maintenance_schedules")
            .select(
                "id, user_appliance_id, shared_item_id, interval_type, interval_value, "
                "last_done_at, next_due_at, created_at, updated_at, "
                "shared_maintenance_items!inner(task_name, description, source_page, importance), "
                "user_appliances!inner(user_id, group_id)"
            )
            .eq("id", schedule_id)
            .single()
            .execute()
        )

        if not schedule_response.data:
            return {"error": "Schedule not found"}

        schedule = schedule_response.data
        appliance_info = schedule.get("user_appliances", {})
        appliance_user_id = appliance_info.get("user_id")
        appliance_group_id = appliance_info.get("group_id")

        # Verify the user has access to this schedule
        # Either: user owns the appliance OR user is a member of the appliance's group
        is_authorized = False
        if appliance_user_id == user_id:
            is_authorized = True
        elif appliance_group_id:
            # Check if user is a member of the group
            member_check = (
                client.table("group_members")
                .select("id")
                .eq("group_id", appliance_group_id)
                .eq("user_id", user_id)
                .execute()
            )
            if member_check.data:
                is_authorized = True

        if not is_authorized:
            return {"error": "Not authorized to complete this maintenance"}

        # Record the completion
        completion_time = done_at or datetime.now(UTC)
        log_data = {
            "schedule_id": schedule_id,
            "done_at": completion_time.isoformat(),
            "done_by_user_id": user_id,
            "notes": notes,
        }

        log_response = client.table("maintenance_logs").insert(log_data).execute()

        if not log_response.data:
            return {"error": "Failed to create maintenance log"}

        # Calculate and update next_due_at
        next_due_at = _calculate_next_due_at(
            schedule.get("interval_type"),
            schedule.get("interval_value"),
            completion_time,
        )

        update_data = {
            "last_done_at": completion_time.isoformat(),
            "next_due_at": next_due_at.isoformat() if next_due_at else None,
            "updated_at": datetime.now(UTC).isoformat(),
        }

        schedule_update_response = (
            client.table("maintenance_schedules")
            .update(update_data)
            .eq("id", schedule_id)
            .execute()
        )

        if not schedule_update_response.data:
            return {"error": "Failed to update schedule"}

        # Flatten the response for backward compatibility
        updated_schedule = schedule_update_response.data[0]
        item_details = schedule.get("shared_maintenance_items", {}) or {}
        updated_schedule["task_name"] = item_details.get("task_name", "")
        updated_schedule["description"] = item_details.get("description")
        updated_schedule["source_page"] = item_details.get("source_page")
        updated_schedule["importance"] = item_details.get("importance", "medium")

        return {
            "log": log_response.data[0],
            "schedule": updated_schedule,
        }

    except Exception as e:
        logger.error(f"Error completing maintenance: {e}")
        return {"error": str(e)}


async def get_maintenance_logs(
    schedule_id: str,
    user_id: str,
    limit: int = 10,
    offset: int = 0,
) -> dict:
    """
    Get completion history for a maintenance schedule.

    Args:
        schedule_id: UUID of the maintenance schedule
        user_id: UUID of the user requesting logs
        limit: Maximum number of logs to return
        offset: Number of logs to skip

    Returns:
        dict with:
        - logs: List of maintenance log records
        - total_count: Total number of logs
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {
            "error": "Database connection not available",
            "logs": [],
            "total_count": 0,
        }

    try:
        # Verify user has access to this schedule (owner or group member)
        schedule_response = (
            client.table("maintenance_schedules")
            .select("id, user_appliances!inner(user_id, group_id)")
            .eq("id", schedule_id)
            .single()
            .execute()
        )

        if not schedule_response.data:
            return {"error": "Schedule not found", "logs": [], "total_count": 0}

        appliance_data = schedule_response.data.get("user_appliances", {})
        appliance_user_id = appliance_data.get("user_id")
        appliance_group_id = appliance_data.get("group_id")

        # Check if user has access (owner or group member)
        has_access = False
        if appliance_user_id == user_id:
            has_access = True
        elif appliance_group_id:
            # Check if user is a member of the group
            membership_response = (
                client.table("group_members")
                .select("id")
                .eq("group_id", appliance_group_id)
                .eq("user_id", user_id)
                .execute()
            )
            if membership_response.data:
                has_access = True

        if not has_access:
            return {"error": "Not authorized", "logs": [], "total_count": 0}

        # Get total count
        count_response = (
            client.table("maintenance_logs")
            .select("id", count="exact")
            .eq("schedule_id", schedule_id)
            .execute()
        )
        total_count = count_response.count if count_response.count else 0

        # Get logs with pagination
        logs_response = (
            client.table("maintenance_logs")
            .select("*")
            .eq("schedule_id", schedule_id)
            .order("done_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        return {
            "logs": logs_response.data or [],
            "total_count": total_count,
        }

    except Exception as e:
        logger.error(f"Error fetching maintenance logs: {e}")
        return {"error": str(e), "logs": [], "total_count": 0}


async def get_upcoming_maintenance(
    user_id: str,
    days_ahead: int = 7,
) -> list[dict]:
    """
    Get maintenance schedules due within the specified number of days.

    Args:
        user_id: UUID of the user
        days_ahead: Number of days to look ahead

    Returns:
        List of maintenance schedules with appliance info
    """
    client = get_supabase_client()
    if not client:
        return []

    try:
        now = datetime.now(UTC)
        future_date = now + timedelta(days=days_ahead)

        response = (
            client.table("maintenance_schedules")
            .select(
                "id, user_appliance_id, shared_item_id, interval_type, interval_value, "
                "last_done_at, next_due_at, created_at, updated_at, "
                "shared_maintenance_items!inner(task_name, description, source_page, importance), "
                "user_appliances!inner(id, name, user_id, shared_appliance_id, "
                "shared_appliances(maker, model_number, category))"
            )
            .eq("user_appliances.user_id", user_id)
            .lte("next_due_at", future_date.isoformat())
            .order("next_due_at", desc=False)
            .execute()
        )

        # Flatten the response for backward compatibility
        result = []
        for schedule in response.data or []:
            item_details = schedule.pop("shared_maintenance_items", {}) or {}
            schedule["task_name"] = item_details.get("task_name", "")
            schedule["description"] = item_details.get("description")
            schedule["source_page"] = item_details.get("source_page")
            schedule["importance"] = item_details.get("importance", "medium")
            result.append(schedule)

        return result

    except Exception as e:
        logger.error(f"Error fetching upcoming maintenance: {e}")
        return []


async def get_all_maintenance_with_details(
    user_id: str,
    status_filter: list[str] | None = None,
    importance_filter: list[str] | None = None,
    appliance_id: str | None = None,
) -> dict:
    """
    Get all maintenance schedules for a user with appliance details.

    Includes both personal appliances and group appliances (if user is in a group).

    Args:
        user_id: UUID of the user
        status_filter: Filter by status ('overdue', 'upcoming', 'scheduled', 'manual')
        importance_filter: Filter by importance ('high', 'medium', 'low')
        appliance_id: Filter by specific appliance

    Returns:
        dict with:
        - items: List of maintenance items with appliance details and status
        - counts: Count of items by status
    """
    client = get_supabase_client()
    if not client:
        return {"items": [], "counts": _empty_counts()}

    try:
        now = datetime.now(UTC)
        seven_days_later = now + timedelta(days=7)

        # Step 1: Get user's personal appliances (not in any group)
        personal_appliances_data = []
        if not appliance_id:
            personal_result = (
                client.table("user_appliances")
                .select("id, name, shared_appliances(maker, model_number, category)")
                .eq("user_id", user_id)
                .is_("group_id", "null")
                .execute()
            )
            personal_appliances_data = personal_result.data or []
        else:
            # When filtering by specific appliance, check if it's accessible
            specific_result = (
                client.table("user_appliances")
                .select(
                    "id, name, user_id, group_id, shared_appliances(maker, model_number, category)"
                )
                .eq("id", appliance_id)
                .execute()
            )
            if specific_result.data:
                row = specific_result.data[0]
                # Check access: personal ownership OR group membership
                if row.get("user_id") == user_id:
                    personal_appliances_data = [row]
                elif row.get("group_id"):
                    # Will be handled in group appliances section
                    pass

        # Step 2: Get user's group memberships
        memberships_result = (
            client.table("group_members")
            .select("group_id")
            .eq("user_id", user_id)
            .execute()
        )
        group_ids = [m["group_id"] for m in (memberships_result.data or [])]

        # Step 3: Get group appliances
        group_appliances_data = []
        if group_ids:
            if appliance_id:
                # Check if specific appliance belongs to user's group
                group_appliance_result = (
                    client.table("user_appliances")
                    .select(
                        "id, name, shared_appliances(maker, model_number, category)"
                    )
                    .eq("id", appliance_id)
                    .in_("group_id", group_ids)
                    .execute()
                )
                group_appliances_data = group_appliance_result.data or []
            else:
                group_appliance_result = (
                    client.table("user_appliances")
                    .select(
                        "id, name, shared_appliances(maker, model_number, category)"
                    )
                    .in_("group_id", group_ids)
                    .execute()
                )
                group_appliances_data = group_appliance_result.data or []

        # Combine personal and group appliances
        all_appliances_data = personal_appliances_data + group_appliances_data

        if not all_appliances_data:
            return {"items": [], "counts": _empty_counts()}

        appliance_ids = [a["id"] for a in all_appliances_data]
        appliance_map = {a["id"]: a for a in all_appliances_data}

        # Step 4: Get all maintenance schedules for these appliances
        # JOIN shared_maintenance_items to get task_name, description, etc.
        schedules_response = (
            client.table("maintenance_schedules")
            .select(
                "id, user_appliance_id, shared_item_id, interval_type, interval_value, "
                "last_done_at, next_due_at, created_at, updated_at, "
                "shared_maintenance_items!inner(task_name, description, source_page, importance)"
            )
            .in_("user_appliance_id", appliance_ids)
            .order("next_due_at", desc=False, nullsfirst=False)
            .execute()
        )

        if not schedules_response.data:
            return {"items": [], "counts": _empty_counts()}

        # Step 5: Calculate status and build response
        items = []
        counts = {"overdue": 0, "upcoming": 0, "scheduled": 0, "manual": 0, "total": 0}

        for schedule in schedules_response.data:
            appliance = appliance_map.get(schedule["user_appliance_id"])
            if not appliance:
                continue

            shared = appliance.get("shared_appliances", {}) or {}
            # Get maintenance item details from JOIN
            item_details = schedule.get("shared_maintenance_items", {}) or {}

            # Calculate status and days until due
            status, days_until_due = _calculate_status(
                schedule.get("next_due_at"),
                schedule.get("interval_type"),
                now,
                seven_days_later,
            )

            # Update counts
            counts[status] += 1
            counts["total"] += 1

            # Apply filters
            if status_filter and status not in status_filter:
                continue
            if (
                importance_filter
                and item_details.get("importance") not in importance_filter
            ):
                continue

            items.append(
                {
                    "id": schedule["id"],
                    "task_name": item_details.get("task_name", ""),
                    "description": item_details.get("description"),
                    "next_due_at": schedule.get("next_due_at"),
                    "last_done_at": schedule.get("last_done_at"),
                    "importance": item_details.get("importance", "medium"),
                    "interval_type": schedule.get("interval_type", "manual"),
                    "interval_value": schedule.get("interval_value"),
                    "source_page": item_details.get("source_page"),
                    "appliance_id": schedule["user_appliance_id"],
                    "appliance_name": appliance["name"],
                    "maker": shared.get("maker", ""),
                    "model_number": shared.get("model_number", ""),
                    "category": shared.get("category", ""),
                    "status": status,
                    "days_until_due": days_until_due,
                }
            )

        # Sort: overdue first (most overdue first), then by next_due_at
        items.sort(
            key=lambda x: (
                0 if x["status"] == "overdue" else 1,
                x["days_until_due"] if x["days_until_due"] is not None else 9999,
            )
        )

        return {"items": items, "counts": counts}

    except Exception as e:
        logger.error(f"Error fetching all maintenance: {e}")
        return {"items": [], "counts": _empty_counts()}


def _calculate_status(
    next_due_at: str | None,
    interval_type: str | None,
    now: datetime,
    seven_days_later: datetime,
) -> tuple[str, int | None]:
    """
    Calculate status and days until due for a maintenance schedule.

    Returns:
        Tuple of (status, days_until_due)
    """
    if not next_due_at or interval_type == "manual":
        return ("manual", None)

    try:
        due_date = datetime.fromisoformat(next_due_at.replace("Z", "+00:00"))
        days_until = (due_date - now).days

        if due_date < now:
            return ("overdue", days_until)
        elif due_date <= seven_days_later:
            return ("upcoming", days_until)
        else:
            return ("scheduled", days_until)
    except Exception:
        return ("manual", None)


def _empty_counts() -> dict:
    """Return empty counts dictionary."""
    return {"overdue": 0, "upcoming": 0, "scheduled": 0, "manual": 0, "total": 0}


async def get_appliance_next_maintenance(
    user_appliance_id: str,
) -> dict | None:
    """
    Get the next upcoming maintenance for a specific appliance.

    Args:
        user_appliance_id: UUID of the user appliance

    Returns:
        The maintenance schedule with the earliest next_due_at, or None
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        response = (
            client.table("maintenance_schedules")
            .select(
                "id, user_appliance_id, shared_item_id, interval_type, interval_value, "
                "last_done_at, next_due_at, created_at, updated_at, "
                "shared_maintenance_items!inner(task_name, description, source_page, importance)"
            )
            .eq("user_appliance_id", user_appliance_id)
            .not_.is_("next_due_at", "null")
            .order("next_due_at", desc=False)
            .limit(1)
            .execute()
        )

        if response.data and len(response.data) > 0:
            # Flatten the response for backward compatibility
            schedule = response.data[0]
            item_details = schedule.pop("shared_maintenance_items", {}) or {}
            schedule["task_name"] = item_details.get("task_name", "")
            schedule["description"] = item_details.get("description")
            schedule["source_page"] = item_details.get("source_page")
            schedule["importance"] = item_details.get("importance", "medium")
            return schedule
        return None

    except Exception as e:
        logger.error(f"Error fetching next maintenance: {e}")
        return None


class MaintenanceNotFoundError(Exception):
    """Raised when a maintenance schedule is not found."""

    pass


class MaintenanceAccessDeniedError(Exception):
    """Raised when user doesn't have access to the maintenance schedule."""

    pass


async def delete_maintenance_schedule(
    user_id: str,
    schedule_id: str,
) -> dict:
    """
    Delete a maintenance schedule.

    Authorization: User must have access to the appliance that the schedule belongs to.
    This means either:
    - User is the personal owner of the appliance, OR
    - User is a member of the group that owns the appliance

    Args:
        user_id: User's UUID
        schedule_id: Maintenance schedule UUID

    Returns:
        dict with deletion result: {"deleted": True, "schedule_id": "..."}

    Raises:
        MaintenanceNotFoundError: If schedule not found
        MaintenanceAccessDeniedError: If user doesn't have access
    """
    client = get_supabase_client()
    if not client:
        raise MaintenanceNotFoundError("Database not available")

    try:
        # 1. Get the schedule and its associated appliance
        schedule_result = (
            client.table("maintenance_schedules")
            .select("id, user_appliance_id")
            .eq("id", schedule_id)
            .execute()
        )

        if not schedule_result.data:
            raise MaintenanceNotFoundError(
                f"Maintenance schedule {schedule_id} not found"
            )

        schedule = schedule_result.data[0]
        user_appliance_id = schedule["user_appliance_id"]

        # 2. Get the appliance to check ownership
        appliance_result = (
            client.table("user_appliances")
            .select("id, user_id, group_id")
            .eq("id", user_appliance_id)
            .execute()
        )

        if not appliance_result.data:
            raise MaintenanceNotFoundError("Associated appliance not found")

        appliance = appliance_result.data[0]

        # 3. Check access
        has_access = False

        # Check personal ownership
        if appliance.get("user_id") == user_id:
            has_access = True

        # Check group membership
        if not has_access and appliance.get("group_id"):
            membership_result = (
                client.table("group_members")
                .select("id")
                .eq("group_id", appliance["group_id"])
                .eq("user_id", user_id)
                .execute()
            )
            if membership_result.data:
                has_access = True

        if not has_access:
            raise MaintenanceAccessDeniedError(
                "You don't have permission to delete this maintenance schedule"
            )

        # 4. Delete the schedule (maintenance_logs will be cascade deleted or kept based on FK)
        # First delete related maintenance_logs
        client.table("maintenance_logs").delete().eq(
            "schedule_id", schedule_id
        ).execute()

        # Then delete the schedule
        client.table("maintenance_schedules").delete().eq("id", schedule_id).execute()

        logger.info(f"Deleted maintenance schedule {schedule_id} by user {user_id}")

        return {"deleted": True, "schedule_id": schedule_id}

    except MaintenanceNotFoundError:
        raise
    except MaintenanceAccessDeniedError:
        raise
    except Exception as e:
        logger.error(f"Error deleting maintenance schedule: {e}")
        raise MaintenanceNotFoundError(f"Failed to delete: {e}") from e
