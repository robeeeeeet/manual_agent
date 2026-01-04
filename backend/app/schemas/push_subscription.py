"""Pydantic schemas for push subscription API operations"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PushSubscriptionCreate(BaseModel):
    """Schema for creating a push subscription"""

    endpoint: str = Field(..., description="Push service endpoint URL", min_length=1)
    p256dh_key: str = Field(..., description="P-256 public key (Base64)", min_length=1)
    auth_key: str = Field(
        ..., description="Authentication secret (Base64)", min_length=1
    )


class PushSubscriptionResponse(BaseModel):
    """Schema for push subscription response"""

    id: UUID = Field(..., description="Unique identifier")
    user_id: UUID = Field(..., description="User ID")
    endpoint: str = Field(..., description="Push service endpoint URL")
    p256dh_key: str = Field(..., description="P-256 public key (Base64)")
    auth_key: str = Field(..., description="Authentication secret (Base64)")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


class PushSubscriptionList(BaseModel):
    """Schema for list of push subscriptions"""

    subscriptions: list[PushSubscriptionResponse] = Field(
        ..., description="List of subscriptions"
    )
    total_count: int = Field(..., description="Total number of subscriptions")
