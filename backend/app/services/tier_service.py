import logging
from datetime import date, datetime, timedelta, timezone

from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# 日本標準時 (JST = UTC+9)
JST = timezone(timedelta(hours=9))

# 日次リセット時刻（日本時間）
DAILY_RESET_HOUR_JST = 4


def get_usage_date() -> date:
    """
    Get the usage date based on JST 4:00 AM reset.

    The daily usage resets at 4:00 AM JST.
    - Before 4:00 AM JST: previous day's date
    - After 4:00 AM JST: current day's date
    """
    now_jst = datetime.now(JST)
    if now_jst.hour < DAILY_RESET_HOUR_JST:
        return (now_jst - timedelta(days=1)).date()
    return now_jst.date()


def get_user_tier(user_id: str) -> dict | None:
    """
    Get user's tier information.
    Returns None if not found.
    """
    client = get_supabase_client()
    try:
        response = (
            client.table("users")
            .select("tier_id, user_tiers(*)")
            .eq("id", user_id)
            .single()
            .execute()
        )

        if response.data and response.data.get("user_tiers"):
            return response.data["user_tiers"]
        return None
    except Exception as e:
        logger.error(f"Error fetching user tier: {e}")
        return None


def _get_default_tier() -> dict:
    """
    Return default free tier if lookup fails.
    """
    return {
        "name": "free",
        "display_name": "無料プラン",
        "max_appliances": 3,
        "max_manual_searches_per_day": 5,
        "max_qa_questions_per_day": 10,
    }


def get_or_create_daily_usage(user_id: str, today: date | None = None) -> dict:
    """
    Get or create daily usage record for user.
    Returns dict with user_id, date, manual_searches, qa_questions.
    """
    if today is None:
        today = get_usage_date()

    client = get_supabase_client()
    try:
        # First, try to fetch existing record
        response = (
            client.table("user_daily_usage")
            .select("*")
            .eq("user_id", user_id)
            .eq("date", today.isoformat())
            .execute()
        )

        if response.data and len(response.data) > 0:
            return response.data[0]

        # Record doesn't exist, insert new one
        insert_response = (
            client.table("user_daily_usage")
            .insert(
                {
                    "user_id": user_id,
                    "date": today.isoformat(),
                    "manual_searches": 0,
                    "qa_questions": 0,
                }
            )
            .execute()
        )

        if insert_response.data and len(insert_response.data) > 0:
            return insert_response.data[0]

        # Return default if insert failed (e.g., race condition)
        return {
            "user_id": user_id,
            "date": today.isoformat(),
            "manual_searches": 0,
            "qa_questions": 0,
        }
    except Exception as e:
        logger.error(f"Error getting/creating daily usage: {e}")
        # Return default empty usage
        return {
            "user_id": user_id,
            "date": today.isoformat(),
            "manual_searches": 0,
            "qa_questions": 0,
        }


def check_can_add_appliance(user_id: str) -> dict:
    """
    Check if user can add a personal appliance based on their tier limit.
    Returns dict with: allowed, current_usage, limit, tier_name, tier_display_name.
    """
    tier = get_user_tier(user_id)
    if not tier:
        tier = _get_default_tier()

    limit = tier.get("max_appliances", 3)
    tier_name = tier.get("name", "free")
    tier_display_name = tier.get("display_name", "無料プラン")

    # If unlimited (-1), always allow
    if limit == -1:
        return {
            "allowed": True,
            "current_usage": 0,
            "limit": -1,
            "tier_name": tier_name,
            "tier_display_name": tier_display_name,
        }

    # Count user's personal appliances
    client = get_supabase_client()
    try:
        response = (
            client.table("user_appliances")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .is_("group_id", "null")
            .execute()
        )
        current_usage = response.count or 0
    except Exception as e:
        logger.error(f"Error counting user appliances: {e}")
        current_usage = 0

    allowed = current_usage < limit

    return {
        "allowed": allowed,
        "current_usage": current_usage,
        "limit": limit,
        "tier_name": tier_name,
        "tier_display_name": tier_display_name,
    }


def check_can_add_group_appliance(group_id: str) -> dict:
    """
    Check if a group appliance can be added based on GROUP OWNER's tier limit.
    Returns dict with: allowed, current_usage, limit, tier_name, tier_display_name.
    """
    client = get_supabase_client()

    # Get group owner's user_id
    try:
        group_response = (
            client.table("groups")
            .select("owner_id")
            .eq("id", group_id)
            .single()
            .execute()
        )

        if not group_response.data:
            logger.error(f"Group {group_id} not found")
            return {
                "allowed": False,
                "current_usage": 0,
                "limit": 0,
                "tier_name": "unknown",
                "tier_display_name": "不明",
            }

        owner_id = group_response.data["owner_id"]
    except Exception as e:
        logger.error(f"Error fetching group owner: {e}")
        return {
            "allowed": False,
            "current_usage": 0,
            "limit": 0,
            "tier_name": "unknown",
            "tier_display_name": "不明",
        }

    # Get owner's tier
    tier = get_user_tier(owner_id)
    if not tier:
        tier = _get_default_tier()

    limit = tier.get("max_appliances", 3)
    tier_name = tier.get("name", "free")
    tier_display_name = tier.get("display_name", "無料プラン")

    # If unlimited (-1), always allow
    if limit == -1:
        return {
            "allowed": True,
            "current_usage": 0,
            "limit": -1,
            "tier_name": tier_name,
            "tier_display_name": tier_display_name,
        }

    # Count group appliances owned by this group
    try:
        response = (
            client.table("user_appliances")
            .select("id", count="exact")
            .eq("group_id", group_id)
            .execute()
        )
        current_usage = response.count or 0
    except Exception as e:
        logger.error(f"Error counting group appliances: {e}")
        current_usage = 0

    allowed = current_usage < limit

    return {
        "allowed": allowed,
        "current_usage": current_usage,
        "limit": limit,
        "tier_name": tier_name,
        "tier_display_name": tier_display_name,
    }


def check_and_increment_manual_search(user_id: str) -> dict:
    """
    Check if user can perform a manual search and increment counter if allowed.
    Returns dict with: allowed, current_usage, limit, tier_name, tier_display_name.
    """
    tier = get_user_tier(user_id)
    if not tier:
        tier = _get_default_tier()

    limit = tier.get("max_manual_searches_per_day", 5)
    tier_name = tier.get("name", "free")
    tier_display_name = tier.get("display_name", "無料プラン")

    # If unlimited (-1), always allow
    if limit == -1:
        return {
            "allowed": True,
            "current_usage": 0,
            "limit": -1,
            "tier_name": tier_name,
            "tier_display_name": tier_display_name,
        }

    # Get or create daily usage (resets at 4:00 AM JST)
    today = get_usage_date()
    usage = get_or_create_daily_usage(user_id, today)
    current_usage = usage.get("manual_searches", 0)

    allowed = current_usage < limit

    if allowed:
        # Increment counter
        client = get_supabase_client()
        try:
            client.table("user_daily_usage").update(
                {"manual_searches": current_usage + 1}
            ).eq("user_id", user_id).eq("date", today.isoformat()).execute()

            current_usage += 1
        except Exception as e:
            logger.error(f"Error incrementing manual_searches: {e}")

    return {
        "allowed": allowed,
        "current_usage": current_usage,
        "limit": limit,
        "tier_name": tier_name,
        "tier_display_name": tier_display_name,
    }


def check_and_increment_qa_question(user_id: str) -> dict:
    """
    Check if user can ask a QA question and increment counter if allowed.
    Returns dict with: allowed, current_usage, limit, tier_name, tier_display_name.
    """
    tier = get_user_tier(user_id)
    if not tier:
        tier = _get_default_tier()

    limit = tier.get("max_qa_questions_per_day", 10)
    tier_name = tier.get("name", "free")
    tier_display_name = tier.get("display_name", "無料プラン")

    # If unlimited (-1), always allow
    if limit == -1:
        return {
            "allowed": True,
            "current_usage": 0,
            "limit": -1,
            "tier_name": tier_name,
            "tier_display_name": tier_display_name,
        }

    # Get or create daily usage (resets at 4:00 AM JST)
    today = get_usage_date()
    usage = get_or_create_daily_usage(user_id, today)
    current_usage = usage.get("qa_questions", 0)

    allowed = current_usage < limit

    if allowed:
        # Increment counter
        client = get_supabase_client()
        try:
            client.table("user_daily_usage").update(
                {"qa_questions": current_usage + 1}
            ).eq("user_id", user_id).eq("date", today.isoformat()).execute()

            current_usage += 1
        except Exception as e:
            logger.error(f"Error incrementing qa_questions: {e}")

    return {
        "allowed": allowed,
        "current_usage": current_usage,
        "limit": limit,
        "tier_name": tier_name,
        "tier_display_name": tier_display_name,
    }


def get_user_usage_stats(user_id: str) -> dict:
    """
    Get comprehensive usage statistics for a user.
    Returns dict with: tier, daily_usage, appliance_count.
    """
    tier = get_user_tier(user_id)
    if not tier:
        tier = _get_default_tier()

    today = get_usage_date()
    daily_usage = get_or_create_daily_usage(user_id, today)

    # Count personal appliances
    client = get_supabase_client()
    try:
        response = (
            client.table("user_appliances")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .is_("group_id", "null")
            .execute()
        )
        appliance_count = response.count or 0
    except Exception as e:
        logger.error(f"Error counting appliances: {e}")
        appliance_count = 0

    return {
        "tier": tier,
        "daily_usage": daily_usage,
        "appliance_count": appliance_count,
    }
