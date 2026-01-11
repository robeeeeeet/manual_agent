"""Group management API routes (Phase 7: Family Sharing)"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from app.schemas.appliance import ErrorResponse
from app.schemas.group import (
    Group,
    GroupCreate,
    GroupListResponse,
    GroupMemberInfo,
    GroupUpdate,
    GroupWithMembers,
    InviteCodeResponse,
    JoinGroupRequest,
    JoinGroupResponse,
)
from app.services import group_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["groups"])


def _get_user_id_from_header(x_user_id: str | None) -> UUID:
    """Extract and validate user ID from header."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "User ID required",
                "code": "UNAUTHORIZED",
                "details": "X-User-ID header is required",
            },
        )
    try:
        return UUID(x_user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid user ID",
                "code": "INVALID_USER_ID",
                "details": "X-User-ID must be a valid UUID",
            },
        ) from e


# ============================================================================
# Group CRUD
# ============================================================================


@router.post(
    "",
    response_model=Group,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Create a new group",
    description="Create a new family group. The creator becomes the owner.",
)
async def create_group(
    body: GroupCreate,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Create a new group."""
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.create_group(str(user_id), body.name)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": result["error"],
                "code": "GROUP_CREATE_FAILED",
            },
        )

    return result["group"]


@router.get(
    "",
    response_model=GroupListResponse,
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="List user's groups",
    description="Get all groups the user is a member of.",
)
async def list_groups(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Get all groups the user is a member of."""
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.get_user_groups(str(user_id))

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": result["error"],
                "code": "GROUP_LIST_FAILED",
            },
        )

    return {"groups": result["groups"], "count": result["count"]}


@router.get(
    "/{group_id}",
    response_model=GroupWithMembers,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get group details",
    description="Get group details including members list.",
)
async def get_group(
    group_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Get group details."""
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.get_group(str(group_id), str(user_id))

    if "error" in result:
        error_msg = result["error"]
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": error_msg,
                    "code": "GROUP_NOT_FOUND",
                },
            )
        if "not a member" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": error_msg,
                    "code": "NOT_GROUP_MEMBER",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": error_msg,
                "code": "GROUP_GET_FAILED",
            },
        )

    return result["group"]


@router.patch(
    "/{group_id}",
    response_model=Group,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Update group",
    description="Update group name. Only the owner can update.",
)
async def update_group(
    group_id: UUID,
    body: GroupUpdate,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Update group."""
    user_id = _get_user_id_from_header(x_user_id)

    if not body.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Name is required",
                "code": "VALIDATION_ERROR",
            },
        )

    result = await group_service.update_group(str(group_id), str(user_id), body.name)

    if "error" in result:
        error_msg = result["error"]
        if "owner" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": error_msg,
                    "code": "NOT_GROUP_OWNER",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": error_msg,
                "code": "GROUP_UPDATE_FAILED",
            },
        )

    return result["group"]


@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Delete group",
    description="Delete a group. Only the owner can delete. Group appliances are transferred to the owner.",
)
async def delete_group(
    group_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Delete group."""
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.delete_group(str(group_id), str(user_id))

    if "error" in result:
        error_msg = result["error"]
        if "owner" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": error_msg,
                    "code": "NOT_GROUP_OWNER",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": error_msg,
                "code": "GROUP_DELETE_FAILED",
            },
        )

    return None


# ============================================================================
# Invite Code
# ============================================================================


@router.post(
    "/{group_id}/regenerate-code",
    response_model=InviteCodeResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Regenerate invite code",
    description="Regenerate the group invite code. Only the owner can regenerate.",
)
async def regenerate_invite_code(
    group_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Regenerate invite code."""
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.regenerate_invite_code(str(group_id), str(user_id))

    if "error" in result:
        error_msg = result["error"]
        if "owner" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": error_msg,
                    "code": "NOT_GROUP_OWNER",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": error_msg,
                "code": "CODE_REGENERATE_FAILED",
            },
        )

    return {"invite_code": result["invite_code"]}


# ============================================================================
# Verify Invite Code
# ============================================================================


@router.get(
    "/verify-invite/{invite_code}",
    responses={
        200: {"description": "Invite code is valid"},
        404: {"model": ErrorResponse},
    },
    summary="Verify invite code",
    description="Check if an invite code is valid and return group info.",
)
async def verify_invite_code(invite_code: str):
    """Verify an invite code and return group info."""
    result = await group_service.get_group_by_invite_code(invite_code)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Invalid invite code",
                "code": "INVALID_INVITE_CODE",
                "details": "この招待コードは無効です。コードを確認してください。",
            },
        )

    return {
        "valid": True,
        "group": result["group"],
    }


# ============================================================================
# Join/Leave Group
# ============================================================================


@router.post(
    "/join",
    response_model=JoinGroupResponse,
    responses={
        401: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Join a group",
    description="Join a group using an invite code. Personal appliances are automatically migrated to group.",
)
async def join_group(
    body: JoinGroupRequest,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Join a group using invite code."""
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.join_group(
        str(user_id),
        body.invite_code,
        migrate_personal_appliances=body.migrate_personal_appliances,
    )

    if "error" in result:
        error_msg = result["error"]
        if "invalid" in error_msg.lower():
            return {"success": False, "group": None, "message": "Invalid invite code"}
        if "already a member of this group" in error_msg.lower():
            return {
                "success": False,
                "group": None,
                "message": "You are already a member of this group",
            }
        if "already a member of another group" in error_msg.lower():
            return {
                "success": False,
                "group": None,
                "message": "You are already a member of another group. Leave it first.",
            }
        return {"success": False, "group": None, "message": error_msg}

    # Add migration info to response message
    message = None
    if result.get("has_personal_appliances"):
        migrated = result.get("migrated_count", 0)
        merged = result.get("merged_count", 0)
        if migrated or merged:
            message = f"グループに参加しました。{migrated}件の家電を移行し、{merged}件を統合しました。"

    return {"success": True, "group": result["group"], "message": message}


@router.post(
    "/{group_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Leave a group",
    description="Leave a group. Optionally copy group appliances to personal ownership. The owner cannot leave; they must delete the group instead.",
)
async def leave_group(
    group_id: UUID,
    take_appliances: bool = False,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Leave a group.

    Args:
        group_id: UUID of the group to leave
        take_appliances: If True, copy group appliances to personal ownership before leaving
        x_user_id: User's UUID from header
    """
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.leave_group(
        str(user_id), str(group_id), take_appliances=take_appliances
    )

    if "error" in result:
        error_msg = result["error"]
        if "owner" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": error_msg,
                    "code": "OWNER_CANNOT_LEAVE",
                },
            )
        if "not a member" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": error_msg,
                    "code": "NOT_GROUP_MEMBER",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": error_msg,
                "code": "LEAVE_GROUP_FAILED",
            },
        )

    return None


# ============================================================================
# Members
# ============================================================================


@router.get(
    "/{group_id}/members",
    response_model=list[GroupMemberInfo],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="List group members",
    description="Get all members of a group.",
)
async def list_members(
    group_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Get group members."""
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.get_group_members(str(group_id), str(user_id))

    if "error" in result:
        error_msg = result["error"]
        if "not a member" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": error_msg,
                    "code": "NOT_GROUP_MEMBER",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": error_msg,
                "code": "GET_MEMBERS_FAILED",
            },
        )

    return result["members"]


@router.delete(
    "/{group_id}/members/{member_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Remove a member",
    description="Remove a member from the group. Only the owner can remove members.",
)
async def remove_member(
    group_id: UUID,
    member_user_id: UUID,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Remove a member from the group."""
    user_id = _get_user_id_from_header(x_user_id)

    result = await group_service.remove_member(
        str(user_id), str(group_id), str(member_user_id)
    )

    if "error" in result:
        error_msg = result["error"]
        if "owner can remove" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": error_msg,
                    "code": "NOT_GROUP_OWNER",
                },
            )
        if "remove the owner" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": error_msg,
                    "code": "CANNOT_REMOVE_OWNER",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": error_msg,
                "code": "REMOVE_MEMBER_FAILED",
            },
        )

    return None
