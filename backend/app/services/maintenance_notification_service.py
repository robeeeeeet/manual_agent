"""
Maintenance reminder notification service.

Combines maintenance schedule checking with push notification sending
to remind users about upcoming maintenance tasks.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.services.maintenance_log_service import get_upcoming_maintenance
from app.services.notification_service import (
    NotificationServiceError,
    send_notification_to_user,
)
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class MaintenanceNotificationError(Exception):
    """Base exception for maintenance notification errors."""

    pass


async def send_maintenance_reminders(
    days_ahead: int = 7,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Send push notifications for upcoming maintenance items.

    Args:
        days_ahead: Number of days to look ahead for due maintenance
        user_id: Optional specific user ID to send reminders to.
                 If None, sends to all users with upcoming maintenance.

    Returns:
        Dictionary with results:
            {
                "users_processed": int,
                "notifications_sent": int,
                "notifications_failed": int,
                "errors": [str]
            }
    """
    results = {
        "users_processed": 0,
        "notifications_sent": 0,
        "notifications_failed": 0,
        "errors": [],
    }

    try:
        if user_id:
            # Send reminders to specific user
            user_results = await _send_reminders_for_user(user_id, days_ahead)
            results["users_processed"] = 1
            results["notifications_sent"] += user_results.get("success", 0)
            results["notifications_failed"] += user_results.get("failed", 0)
            results["errors"].extend(user_results.get("errors", []))
        else:
            # Get all users with push subscriptions and upcoming maintenance
            users = await _get_users_with_upcoming_maintenance(days_ahead)
            results["users_processed"] = len(users)

            for uid in users:
                try:
                    user_results = await _send_reminders_for_user(uid, days_ahead)
                    results["notifications_sent"] += user_results.get("success", 0)
                    results["notifications_failed"] += user_results.get("failed", 0)
                    results["errors"].extend(user_results.get("errors", []))
                except Exception as e:
                    logger.error(f"Error sending reminders to user {uid}: {e}")
                    results["errors"].append(f"User {uid}: {str(e)}")

    except Exception as e:
        logger.error(f"Error in send_maintenance_reminders: {e}")
        results["errors"].append(str(e))

    return results


async def _get_users_with_upcoming_maintenance(days_ahead: int) -> list[str]:
    """
    Get list of user IDs who have upcoming maintenance and push subscriptions.

    Args:
        days_ahead: Number of days to look ahead

    Returns:
        List of user IDs
    """
    client = get_supabase_client()
    if not client:
        return []

    try:
        now = datetime.now(UTC)
        future_date = now + timedelta(days=days_ahead)

        # Get users with upcoming maintenance
        response = (
            client.table("maintenance_schedules")
            .select("user_appliances!inner(user_id)")
            .lte("next_due_at", future_date.isoformat())
            .gte("next_due_at", now.isoformat())
            .execute()
        )

        if not response.data:
            return []

        # Extract unique user IDs
        user_ids = set()
        for item in response.data:
            user_appliance = item.get("user_appliances")
            if user_appliance and user_appliance.get("user_id"):
                user_ids.add(user_appliance["user_id"])

        # Filter to users with active push subscriptions
        if user_ids:
            # 一括で購読情報を取得
            subscriptions_result = (
                client.table("push_subscriptions")
                .select("user_id")
                .in_("user_id", list(user_ids))
                .execute()
            )

            # 購読があるユーザーIDのセットを構築
            subscribed_user_ids = {
                sub["user_id"] for sub in (subscriptions_result.data or [])
            }

            # フィルタリング
            users_with_subscriptions = [
                uid for uid in user_ids if uid in subscribed_user_ids
            ]
        else:
            users_with_subscriptions = []

        return users_with_subscriptions

    except Exception as e:
        logger.error(f"Error getting users with upcoming maintenance: {e}")
        return []


async def _send_reminders_for_user(
    user_id: str,
    days_ahead: int,
) -> dict[str, Any]:
    """
    Send maintenance reminder notifications to a specific user.

    Args:
        user_id: User's UUID string
        days_ahead: Number of days to look ahead

    Returns:
        Dictionary with notification results
    """
    results = {"success": 0, "failed": 0, "errors": []}

    try:
        # Get upcoming maintenance for this user
        upcoming = await get_upcoming_maintenance(user_id, days_ahead)

        if not upcoming:
            logger.info(f"No upcoming maintenance for user {user_id}")
            return results

        # Group by urgency (due today, due this week)
        due_today = []
        due_soon = []
        now = datetime.now(UTC)

        for schedule in upcoming:
            next_due = schedule.get("next_due_at")
            if not next_due:
                continue

            # Parse next_due_at
            if isinstance(next_due, str):
                try:
                    due_date = datetime.fromisoformat(next_due.replace("Z", "+00:00"))
                except ValueError:
                    continue
            else:
                due_date = next_due

            days_until = (due_date - now).days

            if days_until <= 0:
                due_today.append(schedule)
            elif days_until <= 3:
                due_soon.append(schedule)

        # Send notification for items due today
        if due_today:
            notification_result = await _send_due_today_notification(user_id, due_today)
            results["success"] += notification_result.get("success", 0)
            results["failed"] += notification_result.get("failed", 0)
            results["errors"].extend(notification_result.get("errors", []))

        # Send notification for items due soon
        if due_soon:
            notification_result = await _send_due_soon_notification(user_id, due_soon)
            results["success"] += notification_result.get("success", 0)
            results["failed"] += notification_result.get("failed", 0)
            results["errors"].extend(notification_result.get("errors", []))

    except NotificationServiceError as e:
        logger.error(f"Notification service error for user {user_id}: {e}")
        results["errors"].append(str(e))
    except Exception as e:
        logger.error(f"Error sending reminders for user {user_id}: {e}")
        results["errors"].append(str(e))

    return results


async def _send_due_today_notification(
    user_id: str,
    schedules: list[dict],
) -> dict[str, Any]:
    """
    Send notification for maintenance items due today.

    Args:
        user_id: User's UUID string
        schedules: List of maintenance schedules due today

    Returns:
        Notification send results
    """
    count = len(schedules)

    if count == 1:
        schedule = schedules[0]
        appliance_name = _get_appliance_name(schedule)
        item_name = schedule.get("task_name", "お手入れ")
        title = "今日のお手入れ"
        body = f"{appliance_name}の『{item_name}』のお手入れのタイミングです"
    else:
        title = "今日のお手入れ"
        body = f"{count}件のお手入れのタイミングです"

    notification_payload = {
        "title": title,
        "body": body,
        "icon": "/icon-192.png",
        "badge": "/badge-72.png",
        "tag": "maintenance-due-today",
        "data": {
            "type": "maintenance_reminder",
            "urgency": "today",
            "url": "/appliances",
        },
    }

    try:
        return await send_notification_to_user(UUID(user_id), notification_payload)
    except Exception as e:
        logger.error(f"Failed to send due today notification: {e}")
        return {"success": 0, "failed": 1, "errors": [str(e)]}


async def _send_due_soon_notification(
    user_id: str,
    schedules: list[dict],
) -> dict[str, Any]:
    """
    Send notification for maintenance items due soon (within 3 days).

    Args:
        user_id: User's UUID string
        schedules: List of maintenance schedules due soon

    Returns:
        Notification send results
    """
    count = len(schedules)

    if count == 1:
        schedule = schedules[0]
        appliance_name = _get_appliance_name(schedule)
        item_name = schedule.get("task_name", "お手入れ")
        title = "お手入れのお知らせ"
        body = f"{appliance_name}の『{item_name}』のお手入れ時期が近づいています"
    else:
        title = "お手入れのお知らせ"
        body = f"{count}件のお手入れ時期が近づいています"

    notification_payload = {
        "title": title,
        "body": body,
        "icon": "/icon-192.png",
        "badge": "/badge-72.png",
        "tag": "maintenance-due-soon",
        "data": {
            "type": "maintenance_reminder",
            "urgency": "soon",
            "url": "/appliances",
        },
    }

    try:
        return await send_notification_to_user(UUID(user_id), notification_payload)
    except Exception as e:
        logger.error(f"Failed to send due soon notification: {e}")
        return {"success": 0, "failed": 1, "errors": [str(e)]}


def _get_appliance_name(schedule: dict) -> str:
    """
    Extract appliance name from schedule data.

    Args:
        schedule: Maintenance schedule with nested appliance info

    Returns:
        Appliance name or default string
    """
    user_appliance = schedule.get("user_appliances", {})
    if user_appliance:
        name = user_appliance.get("name")
        if name:
            return name

        # Try to get from shared_appliance
        shared = user_appliance.get("shared_appliances", {})
        if shared:
            maker = shared.get("maker", "")
            model = shared.get("model_number", "")
            if maker or model:
                return f"{maker} {model}".strip()

    return "家電"


async def send_test_notification(user_id: str) -> dict[str, Any]:
    """
    Send a test notification to verify push notification setup.

    Args:
        user_id: User's UUID string

    Returns:
        Notification send results
    """
    notification_payload = {
        "title": "テスト通知",
        "body": "Push通知が正常に設定されています！",
        "icon": "/icon-192.png",
        "badge": "/badge-72.png",
        "tag": "test-notification",
        "data": {
            "type": "test",
            "url": "/",
        },
    }

    try:
        return await send_notification_to_user(UUID(user_id), notification_payload)
    except Exception as e:
        logger.error(f"Failed to send test notification: {e}")
        return {"success": 0, "failed": 1, "expired": 0, "errors": [str(e)]}


async def send_scheduled_maintenance_reminders() -> dict[str, Any]:
    """
    Cron用: 現在の時刻に通知すべきユーザーにリマインドを送信。

    ユーザーごとの notify_time と timezone を考慮して、
    現在の時刻がユーザーの通知時刻と一致する場合のみ通知を送信。

    Returns:
        Dictionary with results:
            {
                "users_processed": int,
                "notifications_sent": int,
                "notifications_failed": int,
                "errors": [str]
            }
    """
    results = {
        "users_processed": 0,
        "notifications_sent": 0,
        "notifications_failed": 0,
        "errors": [],
    }

    try:
        # 現在の時刻に通知すべきユーザーを取得
        users = await _get_users_for_scheduled_notification()
        results["users_processed"] = len(users)

        logger.info(f"Found {len(users)} users for scheduled notification")

        for uid in users:
            try:
                user_results = await _send_reminders_for_user(uid, days_ahead=7)
                results["notifications_sent"] += user_results.get("success", 0)
                results["notifications_failed"] += user_results.get("failed", 0)
                results["errors"].extend(user_results.get("errors", []))
            except Exception as e:
                logger.error(f"Error sending scheduled reminders to user {uid}: {e}")
                results["errors"].append(f"User {uid}: {str(e)}")

    except Exception as e:
        logger.error(f"Error in send_scheduled_maintenance_reminders: {e}")
        results["errors"].append(str(e))

    return results


async def _get_users_for_scheduled_notification() -> list[str]:
    """
    現在の時刻に通知すべきユーザーIDのリストを取得。

    ユーザーの timezone で現在の時刻を計算し、
    その時刻が notify_time と一致（同じ時間帯）する場合に通知対象とする。

    Returns:
        List of user IDs to notify
    """
    from zoneinfo import ZoneInfo

    client = get_supabase_client()
    if not client:
        return []

    try:
        # Push購読があり、メンテナンス予定があるユーザーを取得
        now = datetime.now(UTC)
        future_date = now + timedelta(days=7)

        # メンテナンス予定があるユーザーを取得
        schedules_response = (
            client.table("maintenance_schedules")
            .select("user_appliances!inner(user_id)")
            .lte("next_due_at", future_date.isoformat())
            .gte("next_due_at", now.isoformat())
            .execute()
        )

        if not schedules_response.data:
            logger.info("No users with upcoming maintenance")
            return []

        # ユニークなユーザーIDを抽出
        user_ids = set()
        for item in schedules_response.data:
            user_appliance = item.get("user_appliances")
            if user_appliance and user_appliance.get("user_id"):
                user_ids.add(user_appliance["user_id"])

        if not user_ids:
            return []

        user_ids_list = list(user_ids)

        # 一括で購読情報を取得
        subscriptions_result = (
            client.table("push_subscriptions")
            .select("user_id")
            .in_("user_id", user_ids_list)
            .execute()
        )
        subscribed_user_ids = {
            sub["user_id"] for sub in (subscriptions_result.data or [])
        }

        # 購読があるユーザーのみ通知設定を一括取得
        users_to_notify = []
        if subscribed_user_ids:
            users_result = (
                client.table("users")
                .select("id, notify_time, timezone")
                .in_("id", list(subscribed_user_ids))
                .execute()
            )

            # ユーザー設定のマップを構築
            user_settings_map = {u["id"]: u for u in (users_result.data or [])}

            # 現在時刻に通知すべきユーザーをフィルタリング
            for uid in subscribed_user_ids:
                user_data = user_settings_map.get(uid)
                if not user_data:
                    continue

                notify_time_str = user_data.get("notify_time", "09:00:00")
                timezone_str = user_data.get("timezone", "Asia/Tokyo")

                # ユーザーのタイムゾーンで現在の時刻を取得
                try:
                    user_tz = ZoneInfo(timezone_str)
                except Exception:
                    user_tz = ZoneInfo("Asia/Tokyo")

                user_now = now.astimezone(user_tz)
                user_current_hour = user_now.hour

                # notify_time から時間を抽出 (HH:MM:SS 形式)
                try:
                    notify_hour = int(notify_time_str.split(":")[0])
                except (ValueError, IndexError):
                    notify_hour = 9  # デフォルト

                # 現在の時間がユーザーの通知時刻と一致するか確認
                if user_current_hour == notify_hour:
                    users_to_notify.append(uid)
                    logger.info(
                        f"User {uid} scheduled for notification "
                        f"(timezone={timezone_str}, notify_time={notify_time_str}, "
                        f"current_hour={user_current_hour})"
                    )

        return users_to_notify

    except Exception as e:
        logger.error(f"Error getting users for scheduled notification: {e}")
        return []
