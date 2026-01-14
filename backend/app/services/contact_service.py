"""Contact submission service.

Handles:
1. Screenshot upload to Supabase Storage
2. Data submission to Google Apps Script Webhook (Sheets連携)
"""

import base64
import logging
from datetime import datetime
from typing import Any

import httpx

from app.config import settings
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

CONTACT_SCREENSHOTS_BUCKET = "contact-screenshots"


async def upload_screenshot(
    user_id: str,
    screenshot_base64: str,
    filename: str,
) -> str | None:
    """Upload screenshot to Supabase Storage.

    Args:
        user_id: User ID for folder organization
        screenshot_base64: Base64 encoded image data
        filename: Original filename

    Returns:
        Storage path if successful, None otherwise
    """
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        return None

    try:
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = filename.split(".")[-1].lower() if "." in filename else "jpg"
        # Normalize extension
        if ext in ("jpeg", "heic", "heif"):
            ext = "jpg"
        storage_path = f"{user_id}/{timestamp}.{ext}"

        # Decode base64
        file_content = base64.b64decode(screenshot_base64)

        # Determine content type
        content_type = "image/jpeg"
        if ext == "png":
            content_type = "image/png"
        elif ext == "webp":
            content_type = "image/webp"

        # Upload to Supabase Storage
        client.storage.from_(CONTACT_SCREENSHOTS_BUCKET).upload(
            path=storage_path,
            file=file_content,
            file_options={
                "content-type": content_type,
                "upsert": "true",
            },
        )

        logger.info(f"Screenshot uploaded: {storage_path}")
        return storage_path

    except Exception as e:
        logger.error(f"Failed to upload screenshot: {e}")
        return None


async def send_to_gas_webhook(data: dict[str, Any]) -> bool:
    """Send contact data to Google Apps Script webhook.

    Args:
        data: Contact form data

    Returns:
        True if successful, False otherwise
    """
    webhook_url = settings.gas_webhook_url
    if not webhook_url:
        logger.warning("GAS_WEBHOOK_URL not configured, skipping webhook")
        return False

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.post(
                webhook_url,
                json=data,
                timeout=30.0,
            )

            # Log response for debugging
            logger.info(
                f"GAS webhook response: {response.status_code} - {response.text}"
            )

            if response.status_code == 200:
                logger.info("Contact sent to GAS webhook successfully")
                return True
            else:
                logger.warning(
                    f"GAS webhook returned {response.status_code}: {response.text}"
                )
                return False

    except Exception as e:
        logger.error(f"Failed to send to GAS webhook: {e}")
        return False


# 日本語ラベルマッピング
TYPE_LABELS = {
    "feature_request": "機能リクエスト",
    "bug_report": "バグ報告",
    "other": "その他",
}

SCREEN_LABELS = {
    "register": "家電登録",
    "appliance_list": "家電一覧",
    "appliance_detail": "家電詳細",
    "maintenance": "メンテナンス一覧",
    "qa": "QA機能",
    "groups": "グループ",
    "mypage": "マイページ",
    "other": "その他",
}


async def submit_contact(
    user_id: str,
    user_email: str,
    contact_type: str,
    screen: str,
    content: str,
    reproduction_steps: str | None = None,
    screenshot_base64: str | None = None,
    screenshot_filename: str | None = None,
) -> dict[str, Any]:
    """Submit contact form.

    1. Upload screenshot to Supabase Storage (if provided)
    2. Send data to Google Apps Script webhook (Sheets連携)

    Args:
        user_id: User ID
        user_email: User email
        contact_type: Contact type (feature_request, bug_report, other)
        screen: Screen where issue occurred
        content: Message content
        reproduction_steps: Steps to reproduce (for bug reports)
        screenshot_base64: Base64 encoded screenshot
        screenshot_filename: Screenshot filename

    Returns:
        Result dict with success status and message
    """
    timestamp = datetime.now().isoformat()
    screenshot_path = None

    # Upload screenshot if provided
    if screenshot_base64 and screenshot_filename:
        screenshot_path = await upload_screenshot(
            user_id=user_id,
            screenshot_base64=screenshot_base64,
            filename=screenshot_filename,
        )

    # Prepare webhook data with Japanese labels
    webhook_data = {
        "timestamp": timestamp,
        "user_id": user_id,
        "user_email": user_email,
        "type": TYPE_LABELS.get(contact_type, contact_type),
        "screen": SCREEN_LABELS.get(screen, screen),
        "content": content,
        "reproduction_steps": reproduction_steps or "",
        "screenshot_path": screenshot_path or "",
    }

    # Send to GAS Webhook
    webhook_success = await send_to_gas_webhook(webhook_data)

    if not webhook_success:
        logger.warning("GAS webhook failed, but continuing...")
        # Note: We don't fail the request even if webhook fails
        # The screenshot is already saved in Supabase Storage

    return {
        "success": True,
        "message": "お問い合わせを送信しました",
        "webhook_success": webhook_success,
    }
