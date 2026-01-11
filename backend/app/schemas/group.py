"""Pydantic schemas for group-related API operations (Phase 7: Family Sharing)"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# Group Schemas
# ============================================================================
class GroupCreate(BaseModel):
    """Schema for creating a new group"""

    name: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Group name",
    )


class GroupUpdate(BaseModel):
    """Schema for updating a group"""

    name: str | None = Field(
        None,
        min_length=1,
        max_length=50,
        description="Group name",
    )


class Group(BaseModel):
    """Schema for group response"""

    id: UUID = Field(..., description="Group ID")
    name: str = Field(..., description="Group name")
    invite_code: str = Field(..., description="Invite code (6-8 characters)")
    owner_id: UUID = Field(..., description="Owner user ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


# ============================================================================
# Group Member Schemas
# ============================================================================
class GroupMemberInfo(BaseModel):
    """Schema for group member information"""

    id: UUID = Field(..., description="Membership ID")
    user_id: UUID = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    joined_at: datetime = Field(..., description="Join timestamp")

    model_config = {"from_attributes": True}


class GroupWithMembers(Group):
    """Schema for group with members list"""

    members: list[GroupMemberInfo] = Field(
        default_factory=list, description="Members list"
    )
    member_count: int = Field(..., description="Number of members")


# ============================================================================
# Join Group Schemas
# ============================================================================
class JoinGroupRequest(BaseModel):
    """Schema for joining a group via invite code"""

    invite_code: str = Field(
        ...,
        min_length=6,
        max_length=8,
        description="Invite code",
    )


class JoinGroupResponse(BaseModel):
    """Schema for join group response"""

    success: bool = Field(..., description="Whether join was successful")
    group: Group | None = Field(None, description="Joined group (if successful)")
    message: str | None = Field(None, description="Error message (if failed)")


# ============================================================================
# Group List Schemas
# ============================================================================
class GroupListResponse(BaseModel):
    """Schema for user's groups list response"""

    groups: list[GroupWithMembers] = Field(
        default_factory=list, description="User's groups"
    )
    count: int = Field(..., description="Number of groups")


# ============================================================================
# Invite Code Schemas
# ============================================================================
class InviteCodeResponse(BaseModel):
    """Schema for invite code regeneration response"""

    invite_code: str = Field(..., description="New invite code")
