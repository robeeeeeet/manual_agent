"""
Maintenance item cache service.

Provides caching for LLM-extracted maintenance items to avoid repeated API calls
for the same appliance (same maker + model_number).
"""

import logging
from datetime import UTC, date, datetime, timedelta

from dateutil.relativedelta import relativedelta

from app.services.maintenance_extraction import extract_maintenance_items
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


def _calculate_next_due_from_purchase(
    interval_type: str | None,
    interval_value: int | None,
    base_date: date,
) -> datetime | None:
    """
    Calculate next_due_at from a base date (purchase or registration date).

    For monthly intervals, uses relativedelta to maintain the same day of month.
    Finds the first future occurrence after today.

    Args:
        interval_type: "days", "months", or "manual"
        interval_value: Number of days/months
        base_date: Base date for calculation (purchase or registration date)

    Returns:
        First future datetime when maintenance is due, or None for manual
    """
    if not interval_type or interval_type == "manual":
        return None
    if not interval_value or interval_value <= 0:
        return None

    now = datetime.now(UTC)
    # Convert base_date to datetime at midnight UTC
    current = datetime.combine(base_date, datetime.min.time(), tzinfo=UTC)

    if interval_type == "days":
        delta = timedelta(days=interval_value)
    elif interval_type == "months":
        delta = relativedelta(months=interval_value)
    else:
        return None

    # Find first occurrence after now
    while current <= now:
        current = current + delta

    return current


async def get_cached_maintenance_items(shared_appliance_id: str) -> list[dict] | None:
    """
    Get cached maintenance items for a shared appliance.

    Args:
        shared_appliance_id: UUID of the shared appliance

    Returns:
        List of maintenance items if cached, None if not found
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        response = (
            client.table("shared_maintenance_items")
            .select("*")
            .eq("shared_appliance_id", shared_appliance_id)
            .execute()
        )

        if response.data and len(response.data) > 0:
            return response.data
        return None

    except Exception as e:
        logger.error(
            f"Error fetching cached maintenance items: shared_appliance_id={shared_appliance_id}, error={e}",
            exc_info=True,
        )
        return None


async def save_maintenance_items_to_cache(
    shared_appliance_id: str,
    items: list[dict],
) -> list[dict]:
    """
    Save extracted maintenance items to cache.

    Args:
        shared_appliance_id: UUID of the shared appliance
        items: List of maintenance items from LLM extraction

    Returns:
        List of saved items with their IDs
    """
    client = get_supabase_client()
    if not client:
        raise ValueError("Supabase client not available")

    saved_items = []
    now = datetime.now(UTC).isoformat()

    for item in items:
        # Convert frequency_days to proper interval type and value
        frequency_days = item.get("frequency_days", 30)
        interval_type, interval_value = _convert_frequency_days_to_interval(
            frequency_days
        )

        # Convert LLM extraction format to DB format
        # Support both new format (pdf_page_number, printed_page_number) and
        # legacy format (page_reference) for backward compatibility
        pdf_page = item.get("pdf_page_number")
        printed_page = item.get("printed_page_number")
        legacy_page = item.get("page_reference")

        # If only legacy format is provided, use it as printed_page_number
        if printed_page is None and legacy_page is not None:
            printed_page = legacy_page

        db_item = {
            "shared_appliance_id": shared_appliance_id,
            "task_name": item.get("item_name", ""),
            "description": item.get("description", ""),
            "recommended_interval_type": interval_type,
            "recommended_interval_value": interval_value,
            "pdf_page_number": pdf_page,
            "printed_page_number": printed_page,
            "importance": item.get("importance", "medium"),
            "extracted_at": now,
        }

        try:
            response = (
                client.table("shared_maintenance_items").insert(db_item).execute()
            )
            if response.data:
                saved_items.append(response.data[0])
        except Exception as e:
            # Log error but continue with other items
            error_str = str(e).lower()
            if "duplicate key" in error_str or "23505" in error_str:
                logger.debug(
                    f"Maintenance item already exists, skipping: '{item.get('item_name')}'"
                )
            else:
                logger.error(
                    f"Error saving maintenance item '{item.get('item_name')}': {e}",
                    exc_info=True,
                )

    return saved_items


def _convert_frequency_days_to_interval(frequency_days: int) -> tuple[str, int | None]:
    """
    Convert frequency in days to interval type and value.

    Args:
        frequency_days: Frequency in days (from LLM extraction)

    Returns:
        Tuple of (interval_type, interval_value)
        - interval_type: 'days', 'months', or 'manual'
        - interval_value: properly converted value or None for manual

    Note:
        DB constraint only allows 'days', 'months', 'manual'.
        For periods of 1 year or more, we convert to months (e.g., 1 year = 12 months).

    Examples:
        - 1 day → ('days', 1)
        - 7 days → ('days', 7)
        - 30 days → ('months', 1)
        - 90 days → ('months', 3)
        - 365 days → ('months', 12)
        - 730 days → ('months', 24)
    """
    if frequency_days <= 0:
        return ("manual", None)
    elif frequency_days < 30:
        return ("days", frequency_days)
    else:
        # Convert days to months, rounding to nearest month
        # This handles both sub-year and multi-year periods
        months = round(frequency_days / 30)
        # Ensure at least 1 month
        months = max(1, months)
        return ("months", months)


async def get_or_extract_maintenance_items(
    shared_appliance_id: str,
    pdf_url: str | None = None,
    manufacturer: str | None = None,
    model_number: str | None = None,
    category: str | None = None,
) -> dict:
    """
    Get maintenance items from cache or extract from PDF.

    This is the main entry point for getting maintenance items.
    It first checks the cache, and if not found, extracts from PDF and caches.

    Args:
        shared_appliance_id: UUID of the shared appliance
        pdf_url: URL of the PDF manual (required if not cached)
        manufacturer: Manufacturer name (for extraction)
        model_number: Model number (for extraction)
        category: Product category (for extraction)

    Returns:
        dict with:
        - items: list of maintenance items
        - is_cached: whether items were from cache
        - extracted_at: when items were extracted
    """
    # Check cache first
    cached_items = await get_cached_maintenance_items(shared_appliance_id)

    if cached_items:
        # Return cached items
        extracted_at = cached_items[0].get("extracted_at") if cached_items else None
        return {
            "shared_appliance_id": shared_appliance_id,
            "items": cached_items,
            "is_cached": True,
            "extracted_at": extracted_at,
        }

    # Not cached - need to extract
    if not pdf_url:
        return {
            "shared_appliance_id": shared_appliance_id,
            "items": [],
            "is_cached": False,
            "extracted_at": None,
            "error": "PDF URL required for extraction (no cache available)",
        }

    # Extract from PDF
    extraction_result = await extract_maintenance_items(
        pdf_source=pdf_url,
        manufacturer=manufacturer,
        model_number=model_number,
        category=category,
    )

    if "error" in extraction_result:
        return {
            "shared_appliance_id": shared_appliance_id,
            "items": [],
            "is_cached": False,
            "extracted_at": None,
            "error": extraction_result.get("error"),
            "raw_response": extraction_result.get("raw_response"),
        }

    # Save to cache
    items = extraction_result.get("maintenance_items", [])
    saved_items = await save_maintenance_items_to_cache(shared_appliance_id, items)

    now = datetime.now(UTC).isoformat()
    return {
        "shared_appliance_id": shared_appliance_id,
        "items": saved_items,
        "is_cached": False,
        "extracted_at": now,
    }


async def register_maintenance_schedules(
    user_appliance_id: str,
    selected_item_ids: list[str],
    purchased_at: date | None = None,
) -> list[dict]:
    """
    Register selected maintenance items as user's schedules.

    Args:
        user_appliance_id: UUID of the user's appliance
        selected_item_ids: List of shared_maintenance_item IDs to register
        purchased_at: Purchase date for calculating next_due_at (optional)

    Returns:
        List of created maintenance schedules
    """
    client = get_supabase_client()
    if not client:
        raise ValueError("Supabase client not available")

    # Fetch selected shared items
    response = (
        client.table("shared_maintenance_items")
        .select("*")
        .in_("id", selected_item_ids)
        .execute()
    )

    if not response.data:
        return []

    created_schedules = []
    # Use purchase date if provided, otherwise use today as base
    base_date = purchased_at or datetime.now(UTC).date()

    for item in response.data:
        # Calculate next_due_at based on interval and purchase date
        interval_type = item.get("recommended_interval_type")
        interval_value = item.get("recommended_interval_value")

        next_due_dt = _calculate_next_due_from_purchase(
            interval_type=interval_type,
            interval_value=interval_value,
            base_date=base_date,
        )
        next_due_at = next_due_dt.isoformat() if next_due_dt else None

        # Note: task_name, description, page info, importance are now stored
        # in shared_maintenance_items and retrieved via JOIN
        schedule = {
            "user_appliance_id": user_appliance_id,
            "shared_item_id": item["id"],
            "interval_type": interval_type,
            "interval_value": interval_value,
            "next_due_at": next_due_at,
        }

        try:
            result = client.table("maintenance_schedules").insert(schedule).execute()
            if result.data:
                # Add task_name and importance from shared_maintenance_items
                # for API response validation
                schedule_data = result.data[0]
                schedule_data["task_name"] = item.get("task_name")
                schedule_data["description"] = item.get("description")
                schedule_data["pdf_page_number"] = item.get("pdf_page_number")
                schedule_data["printed_page_number"] = item.get("printed_page_number")
                schedule_data["source_page"] = item.get(
                    "printed_page_number"
                )  # backward compat, deprecated
                schedule_data["importance"] = item.get("importance")
                created_schedules.append(schedule_data)
        except Exception as e:
            logger.error(
                f"Error creating schedule for '{item['task_name']}': {e}",
                exc_info=True,
            )

    return created_schedules
