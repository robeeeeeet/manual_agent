"""Pydantic schemas for user-related API operations"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# User Profile Schemas
# ============================================================================
class UserProfile(BaseModel):
    """Schema for user profile response"""

    id: UUID = Field(..., description="User ID")
    email: str = Field(..., description="Email address")
    notify_time: str = Field(..., description="Notification time in HH:MM format")
    timezone: str = Field(..., description="Timezone (e.g., Asia/Tokyo)")
    created_at: datetime = Field(..., description="Account creation timestamp")

    model_config = {"from_attributes": True}


# ============================================================================
# User Settings Schemas
# ============================================================================
class UserSettingsUpdate(BaseModel):
    """Schema for updating user settings"""

    notify_time: str | None = Field(
        None,
        description="Notification time in HH:MM format",
        pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$",
    )


class UserSettings(BaseModel):
    """Schema for user settings response"""

    notify_time: str = Field(..., description="Notification time in HH:MM format")
    timezone: str = Field(..., description="Timezone")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


# ============================================================================
# Maintenance Statistics Schemas
# ============================================================================
class MaintenanceStats(BaseModel):
    """Schema for maintenance statistics response"""

    upcoming_count: int = Field(
        ..., description="Number of maintenance tasks due within 7 days"
    )
    overdue_count: int = Field(..., description="Number of overdue maintenance tasks")
    completed_total: int = Field(
        ..., description="Total number of completed maintenance tasks"
    )
    completed_this_month: int = Field(
        ..., description="Number of maintenance tasks completed this month"
    )

    model_config = {"from_attributes": True}
