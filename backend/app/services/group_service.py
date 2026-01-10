"""Group service for family sharing management (Phase 7)."""

import logging
import secrets
import string
from datetime import UTC, datetime

from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# Invite code configuration
INVITE_CODE_LENGTH = 6
INVITE_CODE_CHARS = string.ascii_uppercase + string.digits  # A-Z, 0-9


def _generate_invite_code() -> str:
    """Generate a random invite code (6 characters, uppercase alphanumeric)."""
    return "".join(secrets.choice(INVITE_CODE_CHARS) for _ in range(INVITE_CODE_LENGTH))


class GroupServiceError(Exception):
    """Base exception for group service errors."""

    pass


class GroupNotFoundError(GroupServiceError):
    """Raised when group is not found."""

    pass


class NotGroupOwnerError(GroupServiceError):
    """Raised when user is not the group owner."""

    pass


class NotGroupMemberError(GroupServiceError):
    """Raised when user is not a group member."""

    pass


class InvalidInviteCodeError(GroupServiceError):
    """Raised when invite code is invalid."""

    pass


class AlreadyMemberError(GroupServiceError):
    """Raised when user is already a member of the group."""

    pass


class CannotRemoveOwnerError(GroupServiceError):
    """Raised when trying to remove the group owner."""

    pass


# ============================================================================
# Group CRUD Operations
# ============================================================================


async def create_group(owner_id: str, name: str) -> dict:
    """
    Create a new group.

    Args:
        owner_id: UUID of the group owner
        name: Group name

    Returns:
        dict with:
        - group: Created group data
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Generate unique invite code
        invite_code = _generate_invite_code()

        # Retry if invite code already exists (very unlikely)
        for _ in range(3):
            existing = (
                client.table("groups")
                .select("id")
                .eq("invite_code", invite_code)
                .execute()
            )
            if not existing.data:
                break
            invite_code = _generate_invite_code()

        # Create group
        group_response = (
            client.table("groups")
            .insert(
                {
                    "name": name,
                    "invite_code": invite_code,
                    "owner_id": owner_id,
                }
            )
            .execute()
        )

        if not group_response.data:
            return {"error": "Failed to create group"}

        group = group_response.data[0]

        # Add owner as a member with 'owner' role
        client.table("group_members").insert(
            {
                "group_id": group["id"],
                "user_id": owner_id,
                "role": "owner",
            }
        ).execute()

        return {"group": group}

    except Exception as e:
        logger.error(f"Error creating group: {e}")
        return {"error": str(e)}


async def get_group(group_id: str, user_id: str) -> dict:
    """
    Get group details (only if user is a member).

    Args:
        group_id: UUID of the group
        user_id: UUID of the requesting user (for membership check)

    Returns:
        dict with:
        - group: Group data with members
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Check membership
        if not await _is_member(client, group_id, user_id):
            return {"error": "Not a member of this group"}

        # Get group
        group_response = (
            client.table("groups").select("*").eq("id", group_id).single().execute()
        )

        if not group_response.data:
            return {"error": "Group not found"}

        group = group_response.data

        # Get members with email from users table
        members_response = (
            client.table("group_members")
            .select("id, user_id, role, joined_at, users(email)")
            .eq("group_id", group_id)
            .execute()
        )

        members = []
        for m in members_response.data or []:
            members.append(
                {
                    "id": m["id"],
                    "user_id": m["user_id"],
                    "email": m["users"]["email"] if m.get("users") else "",
                    "role": m["role"],
                    "joined_at": m["joined_at"],
                }
            )

        group["members"] = members
        group["member_count"] = len(members)

        return {"group": group}

    except Exception as e:
        logger.error(f"Error getting group: {e}")
        return {"error": str(e)}


async def get_user_groups(user_id: str) -> dict:
    """
    Get all groups the user is a member of.

    Args:
        user_id: UUID of the user

    Returns:
        dict with:
        - groups: List of groups with members
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Get user's memberships
        memberships_response = (
            client.table("group_members")
            .select("group_id")
            .eq("user_id", user_id)
            .execute()
        )

        if not memberships_response.data:
            return {"groups": [], "count": 0}

        group_ids = [m["group_id"] for m in memberships_response.data]

        # Get groups
        groups_response = (
            client.table("groups").select("*").in_("id", group_ids).execute()
        )

        groups = []
        for group in groups_response.data or []:
            # Get members for each group
            members_response = (
                client.table("group_members")
                .select("id, user_id, role, joined_at, users(email)")
                .eq("group_id", group["id"])
                .execute()
            )

            members = []
            for m in members_response.data or []:
                members.append(
                    {
                        "id": m["id"],
                        "user_id": m["user_id"],
                        "email": m["users"]["email"] if m.get("users") else "",
                        "role": m["role"],
                        "joined_at": m["joined_at"],
                    }
                )

            group["members"] = members
            group["member_count"] = len(members)
            groups.append(group)

        return {"groups": groups, "count": len(groups)}

    except Exception as e:
        logger.error(f"Error getting user groups: {e}")
        return {"error": str(e)}


async def update_group(group_id: str, owner_id: str, name: str) -> dict:
    """
    Update group (only owner can update).

    Args:
        group_id: UUID of the group
        owner_id: UUID of the requesting user (must be owner)
        name: New group name

    Returns:
        dict with:
        - group: Updated group data
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Check ownership
        if not await _is_owner(client, group_id, owner_id):
            return {"error": "Only the owner can update this group"}

        # Update group (supabase-py v2: update then fetch separately)
        client.table("groups").update(
            {
                "name": name,
                "updated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", group_id).execute()

        # Fetch updated data
        response = (
            client.table("groups").select("*").eq("id", group_id).single().execute()
        )

        if not response.data:
            return {"error": "Failed to update group"}

        return {"group": response.data}

    except Exception as e:
        logger.error(f"Error updating group: {e}")
        return {"error": str(e)}


async def delete_group(group_id: str, owner_id: str) -> dict:
    """
    Delete group (only owner can delete).

    When deleting, all shared appliances are returned to their original owners
    (group_id is set to NULL, user_id is already set to the original owner).

    Args:
        group_id: UUID of the group
        owner_id: UUID of the requesting user (must be owner)

    Returns:
        dict with:
        - success: True if deleted
        - transferred_count: Number of appliances returned to personal ownership
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Check ownership
        if not await _is_owner(client, group_id, owner_id):
            return {"error": "Only the owner can delete this group"}

        # Transfer all shared appliances back to personal ownership
        # Each appliance has user_id = original_owner, so just clear group_id
        transfer_result = (
            client.table("user_appliances")
            .update({"group_id": None})
            .eq("group_id", group_id)
            .execute()
        )
        transferred_count = len(transfer_result.data) if transfer_result.data else 0

        logger.info(
            f"Transferred {transferred_count} appliances to personal ownership "
            f"for deleted group {group_id}"
        )

        # Delete group (CASCADE deletes group_members)
        client.table("groups").delete().eq("id", group_id).execute()

        return {"success": True, "transferred_count": transferred_count}

    except Exception as e:
        logger.error(f"Error deleting group: {e}")
        return {"error": str(e)}


# ============================================================================
# Invite Code Operations
# ============================================================================


async def regenerate_invite_code(group_id: str, owner_id: str) -> dict:
    """
    Regenerate invite code (only owner can regenerate).

    Args:
        group_id: UUID of the group
        owner_id: UUID of the requesting user (must be owner)

    Returns:
        dict with:
        - invite_code: New invite code
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Check ownership
        if not await _is_owner(client, group_id, owner_id):
            return {"error": "Only the owner can regenerate the invite code"}

        # Generate new unique invite code
        invite_code = _generate_invite_code()

        for _ in range(3):
            existing = (
                client.table("groups")
                .select("id")
                .eq("invite_code", invite_code)
                .execute()
            )
            if not existing.data:
                break
            invite_code = _generate_invite_code()

        # Update invite code
        response = (
            client.table("groups")
            .update(
                {
                    "invite_code": invite_code,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", group_id)
            .select("invite_code")
            .single()
            .execute()
        )

        if not response.data:
            return {"error": "Failed to regenerate invite code"}

        return {"invite_code": response.data["invite_code"]}

    except Exception as e:
        logger.error(f"Error regenerating invite code: {e}")
        return {"error": str(e)}


async def get_group_by_invite_code(invite_code: str) -> dict:
    """
    Get group by invite code (for previewing before joining).

    Args:
        invite_code: Invite code

    Returns:
        dict with:
        - group: Group data (id, name, member_count only)
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        response = (
            client.table("groups")
            .select("id, name")
            .eq("invite_code", invite_code.upper())
            .single()
            .execute()
        )

        if not response.data:
            return {"error": "Invalid invite code"}

        group = response.data

        # Get member count
        members_response = (
            client.table("group_members")
            .select("id", count="exact")
            .eq("group_id", group["id"])
            .execute()
        )

        group["member_count"] = members_response.count or 0

        return {"group": group}

    except Exception as e:
        logger.error(f"Error getting group by invite code: {e}")
        return {"error": str(e)}


# ============================================================================
# Member Operations
# ============================================================================


async def join_group(user_id: str, invite_code: str) -> dict:
    """
    Join a group using invite code.

    Args:
        user_id: UUID of the joining user
        invite_code: Invite code

    Returns:
        dict with:
        - group: Joined group data
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Find group by invite code
        group_response = (
            client.table("groups")
            .select("*")
            .eq("invite_code", invite_code.upper())
            .single()
            .execute()
        )

        if not group_response.data:
            return {"error": "Invalid invite code"}

        group = group_response.data

        # Check if already a member
        existing = (
            client.table("group_members")
            .select("id")
            .eq("group_id", group["id"])
            .eq("user_id", user_id)
            .execute()
        )

        if existing.data:
            return {"error": "You are already a member of this group"}

        # Add as member
        client.table("group_members").insert(
            {
                "group_id": group["id"],
                "user_id": user_id,
                "role": "member",
            }
        ).execute()

        return {"group": group}

    except Exception as e:
        logger.error(f"Error joining group: {e}")
        return {"error": str(e)}


async def leave_group(user_id: str, group_id: str) -> dict:
    """
    Leave a group (owner cannot leave).

    When leaving, any appliances the user shared with the group are returned
    to their personal ownership (group_id is set to NULL).

    Args:
        user_id: UUID of the leaving user
        group_id: UUID of the group

    Returns:
        dict with:
        - success: True if left successfully
        - transferred_count: Number of appliances returned to personal ownership
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Check if owner
        if await _is_owner(client, group_id, user_id):
            return {"error": "Owner cannot leave the group. Delete it instead."}

        # Check if member
        if not await _is_member(client, group_id, user_id):
            return {"error": "You are not a member of this group"}

        # Transfer shared appliances back to personal ownership
        # Find appliances where user_id = leaving_user AND group_id = this_group
        transfer_result = (
            client.table("user_appliances")
            .update({"group_id": None})
            .eq("user_id", user_id)
            .eq("group_id", group_id)
            .execute()
        )
        transferred_count = len(transfer_result.data) if transfer_result.data else 0

        logger.info(
            f"Transferred {transferred_count} appliances to personal ownership "
            f"for user {user_id} leaving group {group_id}"
        )

        # Remove membership
        client.table("group_members").delete().eq("group_id", group_id).eq(
            "user_id", user_id
        ).execute()

        return {"success": True, "transferred_count": transferred_count}

    except Exception as e:
        logger.error(f"Error leaving group: {e}")
        return {"error": str(e)}


async def remove_member(owner_id: str, group_id: str, member_user_id: str) -> dict:
    """
    Remove a member from the group (only owner can remove).

    Args:
        owner_id: UUID of the owner
        group_id: UUID of the group
        member_user_id: UUID of the member to remove

    Returns:
        dict with:
        - success: True if removed successfully
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Check ownership
        if not await _is_owner(client, group_id, owner_id):
            return {"error": "Only the owner can remove members"}

        # Cannot remove owner
        if owner_id == member_user_id:
            return {"error": "Cannot remove the owner"}

        # Remove membership
        client.table("group_members").delete().eq("group_id", group_id).eq(
            "user_id", member_user_id
        ).execute()

        return {"success": True}

    except Exception as e:
        logger.error(f"Error removing member: {e}")
        return {"error": str(e)}


async def get_group_members(group_id: str, user_id: str) -> dict:
    """
    Get all members of a group (only if user is a member).

    Args:
        group_id: UUID of the group
        user_id: UUID of the requesting user

    Returns:
        dict with:
        - members: List of members
        - error: Error message if any
    """
    client = get_supabase_client()
    if not client:
        return {"error": "Database connection not available"}

    try:
        # Check membership
        if not await _is_member(client, group_id, user_id):
            return {"error": "Not a member of this group"}

        # Get members with email
        response = (
            client.table("group_members")
            .select("id, user_id, role, joined_at, users(email)")
            .eq("group_id", group_id)
            .execute()
        )

        members = []
        for m in response.data or []:
            members.append(
                {
                    "id": m["id"],
                    "user_id": m["user_id"],
                    "email": m["users"]["email"] if m.get("users") else "",
                    "role": m["role"],
                    "joined_at": m["joined_at"],
                }
            )

        return {"members": members}

    except Exception as e:
        logger.error(f"Error getting group members: {e}")
        return {"error": str(e)}


# ============================================================================
# Helper Functions
# ============================================================================


async def _is_owner(client, group_id: str, user_id: str) -> bool:
    """Check if user is the owner of the group."""
    response = (
        client.table("groups")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", user_id)
        .execute()
    )
    return bool(response.data)


async def _is_member(client, group_id: str, user_id: str) -> bool:
    """Check if user is a member of the group."""
    response = (
        client.table("group_members")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(response.data)
