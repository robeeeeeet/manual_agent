"""Pydantic schemas for QA abuse prevention."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ViolationType(str, Enum):
    """Type of QA violation."""

    OFF_TOPIC = "off_topic"  # 製品と無関係な質問
    INAPPROPRIATE = "inappropriate"  # 不適切な内容
    ATTACK = "attack"  # 攻撃的な質問（プロンプトインジェクション等）


class DetectionMethod(str, Enum):
    """Method used to detect violation."""

    RULE_BASED = "rule_based"  # ルールベース判定（高速）
    LLM = "llm"  # LLM判定（精度重視）


# ============================================================================
# Violation Record Schemas (違反記録)
# ============================================================================
class QAViolationBase(BaseModel):
    """Base schema for QA violation."""

    user_id: UUID = Field(..., description="User ID who submitted the question")
    shared_appliance_id: UUID = Field(..., description="Appliance ID context")
    question: str = Field(..., description="The violating question content")
    violation_type: ViolationType = Field(..., description="Type of violation")
    detection_method: DetectionMethod = Field(..., description="Detection method")


class QAViolationCreate(QAViolationBase):
    """Schema for creating a QA violation record."""

    pass


class QAViolation(QAViolationBase):
    """Schema for QA violation response."""

    id: UUID = Field(..., description="Unique identifier")
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = {"from_attributes": True}


# ============================================================================
# Restriction Status Schemas (利用制限状態)
# ============================================================================
class QARestrictionBase(BaseModel):
    """Base schema for QA restriction."""

    user_id: UUID = Field(..., description="User ID (unique)")
    violation_count: int = Field(..., ge=0, description="Total number of violations")
    restricted_until: datetime | None = Field(
        None, description="Restriction end time (null if not restricted)"
    )
    last_violation_at: datetime | None = Field(
        None, description="Last violation timestamp"
    )


class QARestrictionCreate(BaseModel):
    """Schema for creating a QA restriction record."""

    user_id: UUID = Field(..., description="User ID")
    violation_count: int = Field(1, ge=1, description="Initial violation count")
    restricted_until: datetime | None = Field(
        None, description="Initial restriction end time"
    )
    last_violation_at: datetime = Field(..., description="Violation timestamp")


class QARestrictionUpdate(BaseModel):
    """Schema for updating a QA restriction record."""

    violation_count: int | None = Field(None, ge=0, description="New violation count")
    restricted_until: datetime | None = Field(
        None, description="New restriction end time"
    )
    last_violation_at: datetime | None = Field(
        None, description="New violation timestamp"
    )


class QARestriction(QARestrictionBase):
    """Schema for QA restriction response."""

    id: UUID = Field(..., description="Unique identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


# ============================================================================
# Error Response Schemas
# ============================================================================
class QABlockedError(BaseModel):
    """Error response when user is restricted from using QA feature."""

    error: str = Field("QA機能は現在制限されています", description="Error message")
    code: str = Field("QA_BLOCKED", description="Error code")
    restricted_until: datetime = Field(..., description="Restriction end time")
    violation_count: int = Field(..., description="Total violation count")


class InvalidQuestionError(BaseModel):
    """Error response when question is invalid."""

    error: str = Field(..., description="Error message")
    code: str = Field("INVALID_QUESTION", description="Error code")
    violation_type: ViolationType = Field(..., description="Type of violation")
    reason: str = Field(..., description="Reason for rejection")


# ============================================================================
# Validation Schemas
# ============================================================================
class QuestionValidationResult(BaseModel):
    """Result of question validation."""

    is_valid: bool = Field(..., description="Whether the question is valid")
    violation_type: ViolationType | None = Field(
        None, description="Type of violation (if invalid)"
    )
    detection_method: DetectionMethod | None = Field(
        None, description="Detection method used (if invalid)"
    )
    reason: str | None = Field(None, description="Reason for rejection (if invalid)")


# ============================================================================
# User Status Schemas
# ============================================================================
class QAUserStatus(BaseModel):
    """Current QA usage status for a user."""

    is_restricted: bool = Field(..., description="Whether user is currently restricted")
    violation_count: int = Field(..., ge=0, description="Total violation count")
    restricted_until: datetime | None = Field(
        None, description="Restriction end time (if restricted)"
    )
    last_violation_at: datetime | None = Field(
        None, description="Last violation timestamp"
    )
