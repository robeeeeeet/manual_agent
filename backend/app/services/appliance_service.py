"""Service for managing appliances (shared and user-owned)."""

import logging
from datetime import UTC
from uuid import UUID

from app.schemas.appliance import (
    SharedAppliance,
    UserApplianceCreate,
    UserApplianceUpdate,
    UserApplianceWithDetails,
)
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class ApplianceServiceError(Exception):
    """Base exception for appliance service errors."""

    pass


class ApplianceNotFoundError(ApplianceServiceError):
    """Raised when appliance is not found."""

    pass


class DuplicateNameError(ApplianceServiceError):
    """Raised when user already has an appliance with the same name."""

    pass


class NotGroupMemberError(ApplianceServiceError):
    """Raised when user is not a member of the group."""

    pass


class NoGroupMembershipError(ApplianceServiceError):
    """Raised when user is not a member of any group."""

    pass


class NotOwnerError(ApplianceServiceError):
    """Raised when user is not the owner of the appliance."""

    pass


class AlreadySharedError(ApplianceServiceError):
    """Raised when appliance is already shared with a group."""

    pass


class NotSharedError(ApplianceServiceError):
    """Raised when appliance is not shared (personal ownership)."""

    pass


async def get_or_create_shared_appliance(
    maker: str,
    model_number: str,
    category: str,
    manual_source_url: str | None = None,
    stored_pdf_path: str | None = None,
    is_pdf_encrypted: bool = False,
) -> SharedAppliance:
    """
    Get existing or create new shared appliance.

    If a shared appliance with the same maker and model_number exists,
    it is returned. Otherwise, a new one is created.

    Args:
        maker: Manufacturer name
        model_number: Model number
        category: Product category
        manual_source_url: Original URL of the manual PDF
        stored_pdf_path: Path to stored PDF in Supabase Storage
        is_pdf_encrypted: True if PDF is encrypted and cannot be displayed in react-pdf

    Returns:
        SharedAppliance instance

    Raises:
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # Check if shared appliance already exists
    result = (
        client.table("shared_appliances")
        .select("*")
        .eq("maker", maker)
        .eq("model_number", model_number)
        .execute()
    )

    if result.data:
        # Update if manual info is provided and not already set
        existing = result.data[0]
        needs_update = False
        update_data = {}

        if manual_source_url and not existing.get("manual_source_url"):
            update_data["manual_source_url"] = manual_source_url
            needs_update = True
        if stored_pdf_path and not existing.get("stored_pdf_path"):
            update_data["stored_pdf_path"] = stored_pdf_path
            needs_update = True
        # Always update is_pdf_encrypted when storing a new PDF
        if stored_pdf_path:
            update_data["is_pdf_encrypted"] = is_pdf_encrypted
            needs_update = True

        if needs_update:
            client.table("shared_appliances").update(update_data).eq(
                "id", existing["id"]
            ).execute()
            # Refetch to get updated data
            result = (
                client.table("shared_appliances")
                .select("*")
                .eq("id", existing["id"])
                .execute()
            )

        return SharedAppliance(**result.data[0])

    # Create new shared appliance
    insert_data = {
        "maker": maker,
        "model_number": model_number,
        "category": category,
        "is_pdf_encrypted": is_pdf_encrypted,
    }
    if manual_source_url:
        insert_data["manual_source_url"] = manual_source_url
    if stored_pdf_path:
        insert_data["stored_pdf_path"] = stored_pdf_path

    result = client.table("shared_appliances").insert(insert_data).execute()

    if not result.data:
        raise ApplianceServiceError("Failed to create shared appliance")

    return SharedAppliance(**result.data[0])


async def register_user_appliance(
    user_id: UUID,
    appliance_data: UserApplianceCreate,
    group_id: UUID | None = None,
) -> UserApplianceWithDetails:
    """
    Register a new appliance for a user or group.

    This will:
    1. Get or create the shared appliance (by maker/model_number)
    2. Create a user_appliance record linking the user/group to the shared appliance
    3. If user is in a group and no explicit group_id is provided, auto-share with group

    Args:
        user_id: User's UUID (always set as owner/registrant)
        appliance_data: Appliance registration data
        group_id: Group's UUID (if explicitly registering as group appliance)
                  If None and user is in a group, auto-detect and use user's group

    Returns:
        UserApplianceWithDetails with all appliance information

    Raises:
        NotGroupMemberError: If user is not a member of the specified group
        DuplicateNameError: If owner already has an appliance with the same name
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # Auto-detect user's group if group_id not provided
    effective_group_id = group_id
    if effective_group_id is None:
        user_group = await get_user_group(user_id)
        if user_group:
            effective_group_id = UUID(user_group["id"])

    # If group_id is provided or detected, verify membership
    group_name = None
    if effective_group_id:
        membership = (
            client.table("group_members")
            .select("id")
            .eq("group_id", str(effective_group_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        if not membership.data:
            raise NotGroupMemberError("You are not a member of this group")

        # Get group name
        group_result = (
            client.table("groups")
            .select("name")
            .eq("id", str(effective_group_id))
            .single()
            .execute()
        )
        if group_result.data:
            group_name = group_result.data["name"]

    # Get or create shared appliance
    shared = await get_or_create_shared_appliance(
        maker=appliance_data.maker,
        model_number=appliance_data.model_number,
        category=appliance_data.category,
        manual_source_url=appliance_data.manual_source_url,
        stored_pdf_path=appliance_data.stored_pdf_path,
    )

    # Create user_appliance record
    # user_id is ALWAYS set (DB constraint: chk_user_appliances_owner)
    # group_id is set if registering as group appliance
    insert_data = {
        "user_id": str(user_id),  # 常に登録者を記録（所有者/元所有者として）
        "shared_appliance_id": str(shared.id),
        "name": appliance_data.name,
    }

    if effective_group_id:
        insert_data["group_id"] = str(effective_group_id)

    if appliance_data.image_url:
        insert_data["image_url"] = appliance_data.image_url

    if appliance_data.purchased_at:
        insert_data["purchased_at"] = appliance_data.purchased_at.isoformat()

    try:
        result = client.table("user_appliances").insert(insert_data).execute()
    except Exception as e:
        error_str = str(e).lower()
        if "unique" in error_str and "name" in error_str:
            raise DuplicateNameError(
                f"You already have an appliance named '{appliance_data.name}'"
            ) from e
        if "chk_user_appliances_owner" in error_str:
            raise ApplianceServiceError(
                "Invalid ownership: must specify either user_id or group_id"
            ) from e
        raise ApplianceServiceError(f"Failed to register appliance: {e}") from e

    if not result.data:
        raise ApplianceServiceError("Failed to register user appliance")

    user_appliance = result.data[0]

    # Return combined data
    # Parse purchased_at from user_appliance (may be None)
    purchased_at_str = user_appliance.get("purchased_at")
    purchased_at_val = None
    if purchased_at_str:
        from datetime import date

        purchased_at_val = date.fromisoformat(purchased_at_str)

    return UserApplianceWithDetails(
        id=user_appliance["id"],
        user_id=user_appliance.get("user_id"),
        group_id=user_appliance.get("group_id"),
        shared_appliance_id=user_appliance["shared_appliance_id"],
        name=user_appliance["name"],
        image_url=user_appliance.get("image_url"),
        purchased_at=purchased_at_val,
        created_at=user_appliance["created_at"],
        updated_at=user_appliance["updated_at"],
        maker=shared.maker,
        model_number=shared.model_number,
        category=shared.category,
        manual_source_url=shared.manual_source_url,
        stored_pdf_path=shared.stored_pdf_path,
        is_pdf_encrypted=shared.is_pdf_encrypted,
        group_name=group_name,
        is_group_owned=effective_group_id is not None,
    )


async def get_user_appliances(user_id: UUID) -> list[UserApplianceWithDetails]:
    """
    Get all appliances for a user (personal + group appliances).

    Args:
        user_id: User's UUID

    Returns:
        List of UserApplianceWithDetails (personal appliances + group appliances)

    Raises:
        ApplianceServiceError: If database operation fails
    """
    from datetime import datetime

    from app.schemas.appliance import NextMaintenanceInfo

    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # Step 1: Get user's personal appliances (not shared with any group)
    # Note: Shared appliances keep user_id but have group_id set
    personal_result = (
        client.table("user_appliances")
        .select("*, shared_appliances(*)")
        .eq("user_id", str(user_id))
        .is_("group_id", "null")
        .execute()
    )

    # Step 2: Get user's group memberships
    memberships_result = (
        client.table("group_members")
        .select("group_id")
        .eq("user_id", str(user_id))
        .execute()
    )

    group_ids = [m["group_id"] for m in (memberships_result.data or [])]

    # Step 3: Get group appliances (if user is in any groups)
    group_appliances_data = []
    group_names_map = {}
    if group_ids:
        # Get group names
        groups_result = (
            client.table("groups").select("id, name").in_("id", group_ids).execute()
        )
        group_names_map = {g["id"]: g["name"] for g in (groups_result.data or [])}

        # Get group appliances
        group_appliances_result = (
            client.table("user_appliances")
            .select("*, shared_appliances(*)")
            .in_("group_id", group_ids)
            .execute()
        )
        group_appliances_data = group_appliances_result.data or []

    # Combine personal and group appliances
    all_appliances_data = (personal_result.data or []) + group_appliances_data

    # Sort by created_at descending
    all_appliances_data.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    # Batch fetch owner display names to avoid N+1 queries
    owner_user_ids = list(
        {row.get("user_id") for row in all_appliances_data if row.get("user_id")}
    )
    display_name_map: dict[str, str] = {}
    if owner_user_ids:
        users_result = (
            client.table("users")
            .select("id, display_name")
            .in_("id", owner_user_ids)
            .execute()
        )
        display_name_map = {
            u["id"]: u.get("display_name", "") for u in (users_result.data or [])
        }

    # Batch fetch duplicate counts for each shared_appliance_id
    duplicate_count_map: dict[str, int] = {}
    shared_appliance_ids = list(
        {row["shared_appliance_id"] for row in all_appliances_data}
    )

    if shared_appliance_ids:
        # Count user_appliances per shared_appliance_id
        # Only count within user's scope (personal or group)
        if group_ids:
            # User is in a group - count group appliances + members' personal appliances
            # Get all member user IDs from group_members table
            all_members_result = (
                client.table("group_members")
                .select("user_id")
                .in_("group_id", group_ids)
                .execute()
            )
            member_user_ids = list(
                {m["user_id"] for m in (all_members_result.data or [])}
            )

            for shared_id in shared_appliance_ids:
                # Build OR filter for group appliances or members' personal appliances
                or_filter = (
                    f"group_id.in.({','.join(group_ids)}),"
                    f"and(user_id.in.({','.join(member_user_ids)}),group_id.is.null)"
                )
                count_result = (
                    client.table("user_appliances")
                    .select("id", count="exact")
                    .eq("shared_appliance_id", shared_id)
                    .or_(or_filter)
                    .execute()
                )
                duplicate_count_map[shared_id] = count_result.count or 0
        else:
            # No group - only count user's personal appliances
            for shared_id in shared_appliance_ids:
                count_result = (
                    client.table("user_appliances")
                    .select("id", count="exact")
                    .eq("shared_appliance_id", shared_id)
                    .eq("user_id", str(user_id))
                    .is_("group_id", "null")
                    .execute()
                )
                duplicate_count_map[shared_id] = count_result.count or 0

    # Batch fetch all maintenance schedules to avoid N+1 queries
    maintenance_map: dict[str, dict] = {}
    all_appliance_ids = [row["id"] for row in all_appliances_data]
    if all_appliance_ids:
        all_maintenance_result = (
            client.table("maintenance_schedules")
            .select(
                "user_appliance_id, next_due_at, "
                "shared_maintenance_items!inner(task_name, importance)"
            )
            .in_("user_appliance_id", all_appliance_ids)
            .not_.is_("next_due_at", "null")
            .order("next_due_at", desc=False)
            .execute()
        )
        # Build map: appliance_id -> earliest maintenance
        for m in all_maintenance_result.data or []:
            appliance_id = m["user_appliance_id"]
            # First occurrence is the earliest (already sorted by next_due_at ASC)
            if appliance_id not in maintenance_map:
                maintenance_map[appliance_id] = m

    appliances = []
    for row in all_appliances_data:
        shared = row.get("shared_appliances", {})
        is_group_owned = row.get("group_id") is not None
        group_name = (
            group_names_map.get(row.get("group_id")) if is_group_owned else None
        )

        # Get owner display name from the pre-fetched map
        owner_display_name = display_name_map.get(row.get("user_id")) or None

        # Get next upcoming maintenance from the pre-fetched map
        next_maintenance = None
        maintenance = maintenance_map.get(row["id"])
        if maintenance:
            item_details = maintenance.get("shared_maintenance_items", {}) or {}
            next_due_at = datetime.fromisoformat(
                maintenance["next_due_at"].replace("Z", "+00:00")
            )
            now = datetime.now(UTC)
            days_until_due = (next_due_at - now).days

            next_maintenance = NextMaintenanceInfo(
                task_name=item_details.get("task_name", ""),
                next_due_at=next_due_at,
                importance=item_details.get("importance", "medium"),
                days_until_due=days_until_due,
            )

        # Parse purchased_at from row (may be None)
        purchased_at_str = row.get("purchased_at")
        purchased_at_val = None
        if purchased_at_str:
            from datetime import date

            purchased_at_val = date.fromisoformat(purchased_at_str)

        appliances.append(
            UserApplianceWithDetails(
                id=row["id"],
                user_id=row.get("user_id"),
                group_id=row.get("group_id"),
                shared_appliance_id=row["shared_appliance_id"],
                name=row["name"],
                image_url=row.get("image_url"),
                purchased_at=purchased_at_val,
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                maker=shared.get("maker", ""),
                model_number=shared.get("model_number", ""),
                category=shared.get("category", ""),
                manual_source_url=shared.get("manual_source_url"),
                stored_pdf_path=shared.get("stored_pdf_path"),
                is_pdf_encrypted=shared.get("is_pdf_encrypted", False),
                next_maintenance=next_maintenance,
                group_name=group_name,
                is_group_owned=is_group_owned,
                owner_display_name=owner_display_name,
                duplicate_count=duplicate_count_map.get(row["shared_appliance_id"], 0),
            )
        )

    return appliances


async def get_user_appliance(
    user_id: UUID, appliance_id: UUID
) -> UserApplianceWithDetails:
    """
    Get a specific appliance for a user.

    Access is granted if:
    - For group appliances: User is a member of the group that owns the appliance
    - For personal appliances: User owns the appliance (user_id matches)

    Args:
        user_id: User's UUID
        appliance_id: Appliance's UUID (user_appliances.id)

    Returns:
        UserApplianceWithDetails

    Raises:
        ApplianceNotFoundError: If appliance not found or not accessible
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # Get the appliance first
    result = (
        client.table("user_appliances")
        .select("*, shared_appliances(*)")
        .eq("id", str(appliance_id))
        .execute()
    )

    if not result.data:
        raise ApplianceNotFoundError(f"Appliance {appliance_id} not found")

    row = result.data[0]

    # Check access: group membership OR personal ownership
    has_access = False
    group_name = None
    is_group_owned = row.get("group_id") is not None

    if is_group_owned:
        # Group appliance: MUST check group membership (even if user_id matches)
        membership = (
            client.table("group_members")
            .select("id")
            .eq("group_id", row["group_id"])
            .eq("user_id", str(user_id))
            .execute()
        )
        if membership.data:
            has_access = True
            # Get group name
            group_result = (
                client.table("groups")
                .select("name")
                .eq("id", row["group_id"])
                .single()
                .execute()
            )
            if group_result.data:
                group_name = group_result.data["name"]
    elif row.get("user_id") == str(user_id):
        # Personal appliance: check ownership
        has_access = True

    if not has_access:
        raise ApplianceNotFoundError(f"Appliance {appliance_id} not found")

    shared = row.get("shared_appliances", {})

    # Parse purchased_at from row (may be None)
    purchased_at_str = row.get("purchased_at")
    purchased_at_val = None
    if purchased_at_str:
        from datetime import date

        purchased_at_val = date.fromisoformat(purchased_at_str)

    return UserApplianceWithDetails(
        id=row["id"],
        user_id=row.get("user_id"),
        group_id=row.get("group_id"),
        shared_appliance_id=row["shared_appliance_id"],
        name=row["name"],
        image_url=row.get("image_url"),
        purchased_at=purchased_at_val,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        maker=shared.get("maker", ""),
        model_number=shared.get("model_number", ""),
        category=shared.get("category", ""),
        manual_source_url=shared.get("manual_source_url"),
        stored_pdf_path=shared.get("stored_pdf_path"),
        is_pdf_encrypted=shared.get("is_pdf_encrypted", False),
        group_name=group_name,
        is_group_owned=is_group_owned,
    )


async def update_user_appliance(
    user_id: UUID,
    appliance_id: UUID,
    update_data: UserApplianceUpdate,
) -> UserApplianceWithDetails:
    """
    Update an appliance.

    Access is granted if:
    - User owns the appliance (personal ownership), OR
    - User is a member of the group that owns the appliance

    Args:
        user_id: User's UUID
        appliance_id: Appliance's UUID (user_appliances.id)
        update_data: Fields to update

    Returns:
        Updated UserApplianceWithDetails

    Raises:
        ApplianceNotFoundError: If appliance not found or not accessible
        DuplicateNameError: If the new name already exists for this owner
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # Check if appliance exists and belongs to user
    await get_user_appliance(user_id, appliance_id)

    # Prepare update data (only include explicitly set fields)
    update_fields = update_data.model_dump(exclude_unset=True)
    data = {}
    if "name" in update_fields:
        data["name"] = update_data.name
    if "image_url" in update_fields:
        data["image_url"] = update_data.image_url
    if "purchased_at" in update_fields:
        # Convert date to ISO string, or None to clear
        data["purchased_at"] = (
            update_data.purchased_at.isoformat() if update_data.purchased_at else None
        )

    if not data:
        # Nothing to update, just return current data
        return await get_user_appliance(user_id, appliance_id)

    try:
        client.table("user_appliances").update(data).eq(
            "id", str(appliance_id)
        ).execute()
    except Exception as e:
        error_str = str(e).lower()
        if "unique" in error_str and "name" in error_str:
            raise DuplicateNameError(
                f"You already have an appliance named '{update_data.name}'"
            ) from e
        raise ApplianceServiceError(f"Failed to update appliance: {e}") from e

    return await get_user_appliance(user_id, appliance_id)


async def delete_user_appliance(user_id: UUID, appliance_id: UUID) -> bool:
    """
    Delete an appliance.

    Access is granted if:
    - User owns the appliance (personal ownership), OR
    - User is a member of the group that owns the appliance

    Note: This only deletes the user_appliance record.
    The shared_appliance remains for other users.

    Args:
        user_id: User's UUID
        appliance_id: Appliance's UUID (user_appliances.id)

    Returns:
        True if deleted successfully

    Raises:
        ApplianceNotFoundError: If appliance not found or not accessible
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # Check if appliance exists and belongs to user
    await get_user_appliance(user_id, appliance_id)

    # Delete the user_appliance record
    client.table("user_appliances").delete().eq("id", str(appliance_id)).execute()

    return True


async def find_shared_appliance_by_maker_model(
    maker: str, model_number: str
) -> SharedAppliance | None:
    """
    Find a shared appliance by maker and model number.

    This is useful for checking if a manual already exists for a given appliance.

    Args:
        maker: Manufacturer name
        model_number: Model number

    Returns:
        SharedAppliance if found, None otherwise
    """
    client = get_supabase_client()
    if not client:
        return None

    result = (
        client.table("shared_appliances")
        .select("*")
        .eq("maker", maker)
        .eq("model_number", model_number)
        .execute()
    )

    if not result.data:
        return None

    return SharedAppliance(**result.data[0])


async def update_shared_appliance_manual(
    shared_appliance_id: UUID,
    manual_source_url: str | None = None,
    stored_pdf_path: str | None = None,
) -> SharedAppliance:
    """
    Update manual information for a shared appliance.

    Args:
        shared_appliance_id: Shared appliance's UUID
        manual_source_url: URL where the manual was found
        stored_pdf_path: Path to stored PDF in Supabase Storage

    Returns:
        Updated SharedAppliance

    Raises:
        ApplianceNotFoundError: If shared appliance not found
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    update_data = {}
    if manual_source_url is not None:
        update_data["manual_source_url"] = manual_source_url
    if stored_pdf_path is not None:
        update_data["stored_pdf_path"] = stored_pdf_path

    if not update_data:
        # Nothing to update, fetch and return current
        result = (
            client.table("shared_appliances")
            .select("*")
            .eq("id", str(shared_appliance_id))
            .execute()
        )
        if not result.data:
            raise ApplianceNotFoundError(
                f"Shared appliance {shared_appliance_id} not found"
            )
        return SharedAppliance(**result.data[0])

    result = (
        client.table("shared_appliances")
        .update(update_data)
        .eq("id", str(shared_appliance_id))
        .execute()
    )

    if not result.data:
        raise ApplianceNotFoundError(
            f"Shared appliance {shared_appliance_id} not found"
        )

    return SharedAppliance(**result.data[0])


async def get_user_group(user_id: UUID) -> dict | None:
    """
    Get the group that the user belongs to.

    Since users can only belong to one group (00013 constraint),
    this returns a single group or None.

    Args:
        user_id: User's UUID

    Returns:
        Group dict with id, name, etc. or None if not in any group
    """
    client = get_supabase_client()
    if not client:
        return None

    result = (
        client.table("group_members")
        .select("group_id, groups(id, name, owner_id)")
        .eq("user_id", str(user_id))
        .execute()
    )

    if not result.data:
        return None

    membership = result.data[0]
    group_data = membership.get("groups", {})
    return {
        "id": group_data.get("id"),
        "name": group_data.get("name"),
        "owner_id": group_data.get("owner_id"),
    }


# share_appliance and unshare_appliance functions removed in favor of automatic group sharing
# Appliances are now automatically shared with the group when registered by a group member


async def check_merge_candidates_on_share(
    user_id: UUID, appliance_id: UUID
) -> list[dict]:
    """
    Check if sharing an appliance would trigger a merge with other members' appliances.

    When a user shares their personal appliance to the group, we need to check
    if other group members have personal appliances with the same shared_appliance_id.
    These would be merged (their maintenance_schedules migrated) when sharing.

    Args:
        user_id: User's UUID
        appliance_id: Appliance's UUID (user_appliances.id)

    Returns:
        List of appliances that would be merged, with owner display_name:
        [
            {
                "id": "...",
                "name": "...",
                "owner_display_name": "...",
                "maintenance_schedule_count": 5
            }
        ]
        Empty list if no merge candidates found.

    Raises:
        ApplianceNotFoundError: If appliance not found
        NoGroupMembershipError: If user is not in a group
    """
    client = get_supabase_client()
    if not client:
        return []

    # 1. Get user's group
    group = await get_user_group(user_id)
    if not group:
        return []  # No group = no merge candidates

    # 2. Get the appliance to be shared
    result = (
        client.table("user_appliances")
        .select("*, shared_appliance_id")
        .eq("id", str(appliance_id))
        .execute()
    )

    if not result.data:
        raise ApplianceNotFoundError(f"Appliance {appliance_id} not found")

    appliance = result.data[0]
    shared_appliance_id = appliance.get("shared_appliance_id")

    if not shared_appliance_id:
        return []  # No shared_appliance_id = no merge candidates

    # 3. Get all group members (excluding the current user)
    members_result = (
        client.table("group_members")
        .select("user_id")
        .eq("group_id", group["id"])
        .neq("user_id", str(user_id))
        .execute()
    )
    other_member_ids = [m["user_id"] for m in (members_result.data or [])]

    if not other_member_ids:
        return []  # No other members = no merge candidates

    # 4. Find other members' personal appliances with the same shared_appliance_id
    # (personal = has user_id but no group_id)
    candidates_result = (
        client.table("user_appliances")
        .select("id, name, user_id")
        .eq("shared_appliance_id", shared_appliance_id)
        .in_("user_id", other_member_ids)
        .is_("group_id", "null")
        .execute()
    )

    if not candidates_result.data:
        return []

    # 5. Get display names and maintenance schedule counts
    merge_candidates = []
    for candidate in candidates_result.data:
        # Get display_name
        user_result = (
            client.table("users")
            .select("display_name")
            .eq("id", candidate["user_id"])
            .execute()
        )
        display_name = "グループメンバー"
        if user_result.data and user_result.data[0].get("display_name"):
            display_name = user_result.data[0]["display_name"]

        # Get maintenance schedule count
        schedule_result = (
            client.table("maintenance_schedules")
            .select("id", count="exact")
            .eq("user_appliance_id", candidate["id"])
            .execute()
        )
        schedule_count = schedule_result.count or 0

        merge_candidates.append(
            {
                "id": candidate["id"],
                "name": candidate["name"],
                "owner_display_name": display_name,
                "maintenance_schedule_count": schedule_count,
            }
        )

    return merge_candidates


async def merge_appliances_on_share(
    target_appliance_id: UUID,
    source_appliance_ids: list[str],
) -> dict:
    """
    Merge source appliances into the target appliance.

    This function:
    1. Migrates maintenance_schedules from source appliances to target
    2. Deletes the source appliances

    Args:
        target_appliance_id: The appliance that will receive the merged data
        source_appliance_ids: List of appliance IDs to merge into target

    Returns:
        dict with merge statistics:
        {
            "merged_appliance_count": 2,
            "migrated_schedule_count": 5
        }

    Raises:
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    if not source_appliance_ids:
        return {"merged_appliance_count": 0, "migrated_schedule_count": 0}

    total_migrated_schedules = 0

    try:
        for source_id in source_appliance_ids:
            # 1. Count schedules before migration
            count_result = (
                client.table("maintenance_schedules")
                .select("id", count="exact")
                .eq("user_appliance_id", source_id)
                .execute()
            )
            schedule_count = count_result.count or 0
            total_migrated_schedules += schedule_count

            # 2. Migrate maintenance_schedules to target appliance
            if schedule_count > 0:
                client.table("maintenance_schedules").update(
                    {"user_appliance_id": str(target_appliance_id)}
                ).eq("user_appliance_id", source_id).execute()

            # 3. Delete the source appliance
            client.table("user_appliances").delete().eq("id", source_id).execute()

            logger.info(
                f"Merged appliance {source_id} into {target_appliance_id}, "
                f"migrated {schedule_count} schedules"
            )

        return {
            "merged_appliance_count": len(source_appliance_ids),
            "migrated_schedule_count": total_migrated_schedules,
        }
    except Exception as e:
        logger.error(f"Failed to merge appliances: {e}")
        raise ApplianceServiceError(f"Failed to merge appliances: {e}") from e


async def check_duplicate_in_group(
    user_id: UUID,
    maker: str,
    model_number: str,
) -> dict | None:
    """
    Check if the same maker + model_number appliance already exists in the user's group.

    Checks:
    - Group-owned appliances (group_id is set)
    - Personal appliances of all group members (user_id is set, group_id is null)

    Args:
        user_id: User's UUID (to find their group)
        maker: Manufacturer name
        model_number: Model number

    Returns:
        dict with duplicate info if found:
        {
            "exists": True,
            "appliances": [
                {
                    "id": "...",
                    "name": "...",
                    "owner_type": "group" or "personal",
                    "owner_name": "..." (group name or user display_name)
                }
            ]
        }
        None if no duplicates found
    """
    client = get_supabase_client()
    if not client:
        return None

    # Step 1: Get user's group (if any)
    group = await get_user_group(user_id)

    # Step 2: Find shared_appliance by maker + model_number
    shared_result = (
        client.table("shared_appliances")
        .select("id")
        .eq("maker", maker)
        .eq("model_number", model_number)
        .execute()
    )

    if not shared_result.data:
        # No shared appliance exists yet, so no duplicates
        return None

    shared_appliance_id = shared_result.data[0]["id"]

    # Step 3: Find all user_appliances referencing this shared_appliance
    # that belong to the user's scope (personal or group)
    duplicates = []

    if group:
        # User is in a group - check group appliances + all members' personal appliances
        group_id = group["id"]

        # Get all group members
        members_result = (
            client.table("group_members")
            .select("user_id")
            .eq("group_id", group_id)
            .execute()
        )
        member_user_ids = [m["user_id"] for m in (members_result.data or [])]

        # Find user_appliances with this shared_appliance_id
        # belonging to this group or its members
        appliances_result = (
            client.table("user_appliances")
            .select("id, name, user_id, group_id")
            .eq("shared_appliance_id", shared_appliance_id)
            .execute()
        )

        for appliance in appliances_result.data or []:
            # Check if this appliance belongs to the group or its members
            if appliance.get("group_id") == group_id:
                # Group-owned appliance
                duplicates.append(
                    {
                        "id": appliance["id"],
                        "name": appliance["name"],
                        "owner_type": "group",
                        "owner_name": group["name"],
                    }
                )
            elif (
                appliance.get("user_id") in member_user_ids
                and appliance.get("group_id") is None
            ):
                # Personal appliance of a group member
                # Get member display_name
                member_result = (
                    client.table("users")
                    .select("display_name")
                    .eq("id", appliance["user_id"])
                    .execute()
                )
                member_name = "グループメンバー"
                if member_result.data and member_result.data[0].get("display_name"):
                    if appliance.get("user_id") == str(user_id):
                        member_name = "あなた"
                    else:
                        member_name = member_result.data[0]["display_name"]
                duplicates.append(
                    {
                        "id": appliance["id"],
                        "name": appliance["name"],
                        "owner_type": "personal",
                        "owner_name": member_name,
                    }
                )
    else:
        # No group - only check user's personal appliances
        appliances_result = (
            client.table("user_appliances")
            .select("id, name")
            .eq("shared_appliance_id", shared_appliance_id)
            .eq("user_id", str(user_id))
            .is_("group_id", "null")
            .execute()
        )

        for appliance in appliances_result.data or []:
            duplicates.append(
                {
                    "id": appliance["id"],
                    "name": appliance["name"],
                    "owner_type": "personal",
                    "owner_name": "あなた",
                }
            )

    if duplicates:
        return {"exists": True, "appliances": duplicates}

    return None
