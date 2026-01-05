"""
Cron job endpoints for scheduled tasks.

These endpoints are designed to be called by Cloud Scheduler and are
protected by a secret key authentication.
"""

import hashlib
import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.services.maintenance_notification_service import (
    MaintenanceNotificationError,
    send_scheduled_maintenance_reminders,
)
from app.services.notification_service import VAPIDNotConfiguredError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cron", tags=["Cron Jobs"])

_CRON_FINGERPRINT_LEN = 12


def _fingerprint_secret(value: str) -> str:
    """Return a non-reversible short fingerprint for debugging (never log raw secrets)."""
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return digest[:_CRON_FINGERPRINT_LEN]


def _summarize_secret(value: str | None) -> dict[str, object]:
    """Summarize a secret safely for logs without leaking the secret."""
    if value is None:
        return {"present": False}
    return {
        "present": True,
        "len": len(value),
        "has_cr": "\r" in value,
        "has_lf": "\n" in value,
        "has_surrounding_ws": value != value.strip(),
        "fp": _fingerprint_secret(value),
        "fp_stripped": _fingerprint_secret(value.strip()),
    }


def _normalize_secret(value: str) -> str:
    """Normalize secrets to avoid false mismatches due to surrounding whitespace."""
    return value.strip()


class CronResponse(BaseModel):
    """Cron job response schema."""

    success: bool
    message: str
    users_processed: int = 0
    notifications_sent: int = 0
    notifications_failed: int = 0
    errors: list[str] = []


class ErrorResponse(BaseModel):
    """Error response schema."""

    error: str
    code: str
    details: str | None = None


def _verify_cron_secret(x_cron_secret: str | None) -> None:
    """
    Verify the cron secret key from header.

    Args:
        x_cron_secret: Secret key from X-Cron-Secret header

    Raises:
        HTTPException: If secret key is missing or invalid
    """
    if not settings.cron_secret_key:
        logger.error("CRON_SECRET_KEY not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Cron secret not configured",
                "code": "CRON_SECRET_NOT_CONFIGURED",
            },
        )

    if not x_cron_secret:
        logger.warning("Missing X-Cron-Secret header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Missing cron secret",
                "code": "MISSING_CRON_SECRET",
            },
        )

    expected = settings.cron_secret_key
    received = x_cron_secret
    expected_norm = _normalize_secret(expected)
    received_norm = _normalize_secret(received)

    if not secrets.compare_digest(received_norm, expected_norm):
        logger.warning(
            "Invalid cron secret provided",
            extra={
                "cron_secret_expected": _summarize_secret(expected),
                "cron_secret_received": _summarize_secret(received),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Invalid cron secret",
                "code": "INVALID_CRON_SECRET",
            },
        )


@router.post(
    "/send-reminders",
    response_model=CronResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Send scheduled maintenance reminders",
    description="Cron job endpoint to send maintenance reminder notifications. "
    "Considers each user's notify_time and timezone settings. "
    "Should be called hourly by Cloud Scheduler.",
)
async def send_scheduled_reminders(
    x_cron_secret: Annotated[str | None, Header()] = None,
):
    """
    Cronジョブ用: 定期メンテナンスリマインドを送信。

    ユーザーごとの notify_time と timezone を考慮し、
    現在の時刻が通知時刻に該当するユーザーにのみ通知を送信。

    Cloud Schedulerから毎時実行されることを想定。

    Args:
        x_cron_secret: Cron認証用シークレットキー（X-Cron-Secret ヘッダー）

    Returns:
        CronResponse with notification results

    Raises:
        HTTPException: If authentication fails or sending fails
    """
    # Verify cron secret
    _verify_cron_secret(x_cron_secret)

    logger.info("Starting scheduled maintenance reminder job")

    try:
        results = await send_scheduled_maintenance_reminders()

        logger.info(
            f"Scheduled reminder job completed: "
            f"users={results['users_processed']}, "
            f"sent={results['notifications_sent']}, "
            f"failed={results['notifications_failed']}"
        )

        return CronResponse(
            success=True,
            message="Scheduled reminders processed successfully",
            users_processed=results["users_processed"],
            notifications_sent=results["notifications_sent"],
            notifications_failed=results["notifications_failed"],
            errors=results.get("errors", []),
        )

    except VAPIDNotConfiguredError as e:
        logger.error(f"VAPID not configured: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "VAPID not configured",
                "code": "VAPID_NOT_CONFIGURED",
                "details": str(e),
            },
        ) from e

    except MaintenanceNotificationError as e:
        logger.error(f"Maintenance notification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Reminder sending failed",
                "code": "REMINDER_ERROR",
                "details": str(e),
            },
        ) from e

    except Exception as e:
        logger.error(f"Unexpected error in scheduled reminders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Internal server error",
                "code": "INTERNAL_ERROR",
                "details": str(e),
            },
        ) from e
