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
        # Check if user is already a member of another group
        existing_membership = (
            client.table("group_members")
            .select("id, group_id")
            .eq("user_id", owner_id)
            .execute()
        )
        if existing_membership.data:
            return {
                "error": "You are already a member of another group. Leave it first."
            }

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
        try:
            client.table("group_members").insert(
                {
                    "group_id": group["id"],
                    "user_id": owner_id,
                    "role": "owner",
                }
            ).execute()
        except Exception as member_error:
            # Ignore duplicate key error - owner may already be added by trigger
            error_str = str(member_error)
            if "duplicate key" not in error_str and "23505" not in error_str:
                raise member_error
            logger.info("Owner already added to group_members (possibly by trigger)")

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
            .select("id, user_id, joined_at, users(email)")
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
                .select("id, user_id, joined_at, users(email)")
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
        (
            client.table("groups")
            .update(
                {
                    "invite_code": invite_code,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", group_id)
            .execute()
        )

        # Supabase Python client: update()後のresponse.dataは更新件数のみ
        # 生成済みのinvite_codeを直接返す
        return {"invite_code": invite_code}

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


async def join_group(
    user_id: str, invite_code: str, migrate_personal_appliances: bool = True
) -> dict:
    """
    Join a group using invite code.

    Args:
        user_id: UUID of the joining user
        invite_code: Invite code
        migrate_personal_appliances: If True, migrate personal appliances to group

    Returns:
        dict with:
        - group: Joined group data
        - has_personal_appliances: True if user had personal appliances
        - migrated_count: Number of appliances migrated to group (if migration performed)
        - merged_count: Number of appliances merged (if duplicates found)
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

        # Check if already a member of THIS group
        existing_same_group = (
            client.table("group_members")
            .select("id")
            .eq("group_id", group["id"])
            .eq("user_id", user_id)
            .execute()
        )

        if existing_same_group.data:
            return {"error": "You are already a member of this group"}

        # Check if already a member of ANY other group
        existing_any_group = (
            client.table("group_members")
            .select("id, group_id")
            .eq("user_id", user_id)
            .execute()
        )

        if existing_any_group.data:
            return {
                "error": "You are already a member of another group. Leave it first."
            }

        # Check for personal appliances before joining
        personal_appliances = (
            client.table("user_appliances")
            .select("id, name, shared_appliance_id")
            .eq("user_id", user_id)
            .is_("group_id", "null")
            .execute()
        )
        has_personal = bool(personal_appliances.data)

        # Add as member first
        client.table("group_members").insert(
            {
                "group_id": group["id"],
                "user_id": user_id,
                "role": "member",
            }
        ).execute()

        migrated_count = 0
        merged_count = 0

        # If user has personal appliances and migration is enabled
        if has_personal and migrate_personal_appliances:
            # Migrate personal appliances to group
            for appliance in personal_appliances.data or []:
                # Check for duplicates in group
                existing_group_appliance = (
                    client.table("user_appliances")
                    .select("id")
                    .eq("shared_appliance_id", appliance["shared_appliance_id"])
                    .eq("group_id", group["id"])
                    .execute()
                )

                if existing_group_appliance.data:
                    # Duplicate found - merge maintenance schedules then delete
                    target_id = existing_group_appliance.data[0]["id"]

                    # Migrate maintenance schedules
                    client.table("maintenance_schedules").update(
                        {"user_appliance_id": target_id}
                    ).eq("user_appliance_id", appliance["id"]).execute()

                    # Delete duplicate
                    client.table("user_appliances").delete().eq(
                        "id", appliance["id"]
                    ).execute()
                    merged_count += 1
                else:
                    # No duplicate - just transfer to group
                    # user_id は維持（元の所有者情報として保持、DB制約もあり）
                    client.table("user_appliances").update(
                        {"group_id": group["id"]}
                    ).eq("id", appliance["id"]).execute()
                    migrated_count += 1

            logger.info(
                f"User {user_id} joined group {group['id']}: "
                f"migrated {migrated_count} appliances, merged {merged_count}"
            )

        result = {
            "group": group,
            "has_personal_appliances": has_personal,
        }
        if has_personal and migrate_personal_appliances:
            result["migrated_count"] = migrated_count
            result["merged_count"] = merged_count

        return result

    except Exception as e:
        logger.error(f"Error joining group: {e}")
        return {"error": str(e)}


async def leave_group(
    user_id: str, group_id: str, take_appliances: bool = False
) -> dict:
    """
    Leave a group (owner cannot leave).

    Args:
        user_id: UUID of the leaving user
        group_id: UUID of the group
        take_appliances: If True, create copies of group appliances for personal ownership

    Returns:
        dict with:
        - success: True if left successfully
        - copied_count: Number of appliances copied to personal ownership
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

        copied_count = 0

        # If take_appliances, create copies of all group appliances
        if take_appliances:
            # Get all group appliances
            group_appliances = (
                client.table("user_appliances")
                .select("*, shared_appliances(*)")
                .eq("group_id", group_id)
                .execute()
            )

            for appliance in group_appliances.data or []:
                # Create a copy for the leaving user (personal appliance)
                # Original stays in the group unchanged
                insert_data = {
                    "user_id": user_id,
                    "shared_appliance_id": appliance["shared_appliance_id"],
                    "name": appliance["name"],
                    "group_id": None,  # Personal appliance
                }
                if appliance.get("image_url"):
                    insert_data["image_url"] = appliance["image_url"]

                try:
                    result = (
                        client.table("user_appliances").insert(insert_data).execute()
                    )
                    if result.data:
                        new_appliance_id = result.data[0]["id"]

                        # Copy maintenance schedules
                        schedules = (
                            client.table("maintenance_schedules")
                            .select("*")
                            .eq("user_appliance_id", appliance["id"])
                            .execute()
                        )

                        for schedule in schedules.data or []:
                            schedule_copy = {
                                "user_appliance_id": new_appliance_id,
                                "shared_item_id": schedule.get("shared_item_id"),
                                "interval_type": schedule.get("interval_type"),
                                "interval_value": schedule.get("interval_value"),
                                "next_due_at": schedule.get("next_due_at"),
                                "last_done_at": schedule.get("last_done_at"),
                            }
                            new_schedule_result = (
                                client.table("maintenance_schedules")
                                .insert(schedule_copy)
                                .execute()
                            )

                            # Copy maintenance logs for this schedule
                            if new_schedule_result.data:
                                new_schedule_id = new_schedule_result.data[0]["id"]
                                logs = (
                                    client.table("maintenance_logs")
                                    .select("*")
                                    .eq("schedule_id", schedule["id"])
                                    .execute()
                                )
                                for log in logs.data or []:
                                    log_copy = {
                                        "schedule_id": new_schedule_id,
                                        "done_at": log.get("done_at"),
                                        "done_by_user_id": log.get("done_by_user_id"),
                                        "notes": log.get("notes"),
                                    }
                                    client.table("maintenance_logs").insert(
                                        log_copy
                                    ).execute()

                        copied_count += 1
                except Exception as e:
                    logger.warning(f"Failed to copy appliance {appliance['id']}: {e}")
                    continue

            logger.info(
                f"User {user_id} leaving group {group_id}: "
                f"copied {copied_count} appliances to personal ownership"
            )

        # Remove membership (user loses access to group appliances)
        client.table("group_members").delete().eq("group_id", group_id).eq(
            "user_id", user_id
        ).execute()

        result = {"success": True}
        if take_appliances:
            result["copied_count"] = copied_count

        return result

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
            .select("id, user_id, joined_at, users(email)")
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
