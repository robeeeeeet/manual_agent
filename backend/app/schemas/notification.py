"""Notification schemas for API validation."""

from pydantic import BaseModel, Field


class NotificationData(BaseModel):
    """Notification data payload."""

    url: str = Field(..., description="URL to navigate to when notification is clicked")
    type: str = Field(
        ..., description="Notification type (e.g., 'maintenance_reminder')"
    )


class NotificationPayload(BaseModel):
    """Web push notification payload."""

    title: str = Field(..., description="Notification title", max_length=100)
    body: str = Field(..., description="Notification body", max_length=200)
    icon: str = Field(
        default="/icon-192.png", description="Icon URL (192x192)", max_length=255
    )
    badge: str = Field(
        default="/badge-72.png", description="Badge URL (72x72)", max_length=255
    )
    data: NotificationData = Field(..., description="Custom notification data")


class SendNotificationRequest(BaseModel):
    """Request schema for sending notifications."""

    user_id: str = Field(..., description="Target user's UUID")
    notification: NotificationPayload = Field(..., description="Notification payload")


class SendNotificationResponse(BaseModel):
    """Response schema for notification sending."""

    success: int = Field(..., description="Number of successful sends")
    failed: int = Field(..., description="Number of failed sends")
    expired: int = Field(..., description="Number of expired subscriptions (deleted)")
    errors: list[str] = Field(
        default_factory=list, description="List of error messages"
    )


class SendBulkNotificationRequest(BaseModel):
    """Request schema for sending bulk notifications."""

    user_ids: list[str] = Field(
        ..., description="List of target user UUIDs", min_length=1
    )
    notification: NotificationPayload = Field(..., description="Notification payload")


class SendBulkNotificationResponse(BaseModel):
    """Response schema for bulk notification sending."""

    total_users: int = Field(..., description="Total number of users")
    success: int = Field(..., description="Number of successful sends")
    failed: int = Field(..., description="Number of failed sends")
    expired: int = Field(..., description="Number of expired subscriptions (deleted)")
    errors: list[str] = Field(
        default_factory=list, description="List of error messages"
    )


class MaintenanceReminderRequest(BaseModel):
    """Request schema for maintenance reminder trigger."""

    days_ahead: int = Field(
        default=7,
        ge=1,
        le=30,
        description="Number of days to look ahead for due maintenance",
    )
    user_id: str | None = Field(
        default=None,
        description="Optional specific user ID to send reminders to",
    )


class MaintenanceReminderResponse(BaseModel):
    """Response schema for maintenance reminder trigger."""

    users_processed: int = Field(..., description="Number of users processed")
    notifications_sent: int = Field(..., description="Number of notifications sent")
    notifications_failed: int = Field(..., description="Number of failed notifications")
    errors: list[str] = Field(
        default_factory=list, description="List of error messages"
    )
