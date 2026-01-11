from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class UserTier(BaseModel):
    id: UUID
    name: str  # 'free', 'basic', 'premium'
    display_name: str  # '無料プラン', etc.
    max_appliances: int  # -1 = unlimited
    max_manual_searches_per_day: int
    max_qa_questions_per_day: int
    model_config = {"from_attributes": True}


class UserDailyUsage(BaseModel):
    user_id: UUID
    date: date
    manual_searches: int = 0
    qa_questions: int = 0
    model_config = {"from_attributes": True}


class TierCheckResult(BaseModel):
    allowed: bool
    current_usage: int
    limit: int
    tier_name: str
    tier_display_name: str


class TierLimitExceededError(BaseModel):
    error: str = Field("TIER_LIMIT_EXCEEDED")
    message: str
    current_usage: int
    limit: int
    tier: str
    tier_display_name: str


class UserUsageStats(BaseModel):
    tier: UserTier
    daily_usage: UserDailyUsage
    appliance_count: int
