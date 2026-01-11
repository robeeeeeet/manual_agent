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

    Args:
        user_id: User's UUID (used for personal ownership or group membership check)
        appliance_data: Appliance registration data
        group_id: Group's UUID (if registering as group appliance)

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

    # If group_id is provided, verify membership
    group_name = None
    if group_id:
        membership = (
            client.table("group_members")
            .select("id")
            .eq("group_id", str(group_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        if not membership.data:
            raise NotGroupMemberError("You are not a member of this group")

        # Get group name
        group_result = (
            client.table("groups")
            .select("name")
            .eq("id", str(group_id))
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
    # Either user_id OR group_id is set (XOR constraint in DB)
    insert_data = {
        "shared_appliance_id": str(shared.id),
        "name": appliance_data.name,
    }

    if group_id:
        insert_data["group_id"] = str(group_id)
        # user_id is NULL for group appliances
    else:
        insert_data["user_id"] = str(user_id)

    if appliance_data.image_url:
        insert_data["image_url"] = appliance_data.image_url

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
    return UserApplianceWithDetails(
        id=user_appliance["id"],
        user_id=user_appliance.get("user_id"),
        group_id=user_appliance.get("group_id"),
        shared_appliance_id=user_appliance["shared_appliance_id"],
        name=user_appliance["name"],
        image_url=user_appliance.get("image_url"),
        created_at=user_appliance["created_at"],
        updated_at=user_appliance["updated_at"],
        maker=shared.maker,
        model_number=shared.model_number,
        category=shared.category,
        manual_source_url=shared.manual_source_url,
        stored_pdf_path=shared.stored_pdf_path,
        group_name=group_name,
        is_group_owned=group_id is not None,
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

    appliances = []
    for row in all_appliances_data:
        shared = row.get("shared_appliances", {})
        is_group_owned = row.get("group_id") is not None
        group_name = (
            group_names_map.get(row.get("group_id")) if is_group_owned else None
        )

        # Get next upcoming maintenance for this appliance
        next_maintenance = None
        maintenance_result = (
            client.table("maintenance_schedules")
            .select(
                "next_due_at, shared_maintenance_items!inner(task_name, importance)"
            )
            .eq("user_appliance_id", row["id"])
            .not_.is_("next_due_at", "null")
            .order("next_due_at", desc=False)
            .limit(1)
            .execute()
        )

        if maintenance_result.data:
            maintenance = maintenance_result.data[0]
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

        appliances.append(
            UserApplianceWithDetails(
                id=row["id"],
                user_id=row.get("user_id"),
                group_id=row.get("group_id"),
                shared_appliance_id=row["shared_appliance_id"],
                name=row["name"],
                image_url=row.get("image_url"),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                maker=shared.get("maker", ""),
                model_number=shared.get("model_number", ""),
                category=shared.get("category", ""),
                manual_source_url=shared.get("manual_source_url"),
                stored_pdf_path=shared.get("stored_pdf_path"),
                next_maintenance=next_maintenance,
                group_name=group_name,
                is_group_owned=is_group_owned,
            )
        )

    return appliances


async def get_user_appliance(
    user_id: UUID, appliance_id: UUID
) -> UserApplianceWithDetails:
    """
    Get a specific appliance for a user.

    Access is granted if:
    - User owns the appliance (personal ownership), OR
    - User is a member of the group that owns the appliance

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

    # Check access: personal ownership OR group membership
    has_access = False
    group_name = None
    is_group_owned = row.get("group_id") is not None

    if row.get("user_id") == str(user_id):
        # Personal ownership
        has_access = True
    elif is_group_owned:
        # Check group membership
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

    if not has_access:
        raise ApplianceNotFoundError(f"Appliance {appliance_id} not found")

    shared = row.get("shared_appliances", {})

    return UserApplianceWithDetails(
        id=row["id"],
        user_id=row.get("user_id"),
        group_id=row.get("group_id"),
        shared_appliance_id=row["shared_appliance_id"],
        name=row["name"],
        image_url=row.get("image_url"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        maker=shared.get("maker", ""),
        model_number=shared.get("model_number", ""),
        category=shared.get("category", ""),
        manual_source_url=shared.get("manual_source_url"),
        stored_pdf_path=shared.get("stored_pdf_path"),
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

    # Prepare update data
    data = {}
    if update_data.name is not None:
        data["name"] = update_data.name
    if update_data.image_url is not None:
        data["image_url"] = update_data.image_url

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


async def share_appliance(
    user_id: UUID, appliance_id: UUID
) -> UserApplianceWithDetails:
    """
    Share a personal appliance with the user's group.

    Transfers ownership from personal to group while keeping the original owner tracked:
    - user_id is KEPT (tracks original owner for leave_group logic)
    - group_id is set to the user's group

    Args:
        user_id: User's UUID
        appliance_id: Appliance's UUID (user_appliances.id)

    Returns:
        Updated UserApplianceWithDetails

    Raises:
        NoGroupMembershipError: If user is not a member of any group
        NotOwnerError: If user is not the personal owner of the appliance
        AlreadySharedError: If appliance is already shared with a group
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # 1. Get user's group (1 group only due to 00013 constraint)
    group = await get_user_group(user_id)
    if not group:
        raise NoGroupMembershipError("グループに参加していません")

    # 2. Get the appliance
    result = (
        client.table("user_appliances")
        .select("*")
        .eq("id", str(appliance_id))
        .execute()
    )

    if not result.data:
        raise ApplianceNotFoundError(f"Appliance {appliance_id} not found")

    appliance = result.data[0]

    # 3. Check ownership - must be personal owner
    if appliance.get("user_id") != str(user_id):
        raise NotOwnerError("この家電の所有者ではありません")

    # 4. Check if already shared
    if appliance.get("group_id") is not None:
        raise AlreadySharedError("既に共有されています")

    # 5. Share with group (keep user_id to track original owner)
    try:
        client.table("user_appliances").update(
            {"group_id": group["id"]}  # Keep user_id, only set group_id
        ).eq("id", str(appliance_id)).execute()
    except Exception as e:
        logger.error(f"Failed to share appliance: {e}")
        raise ApplianceServiceError(f"Failed to share appliance: {e}") from e

    # 6. Return updated appliance
    return await get_user_appliance(user_id, appliance_id)


async def unshare_appliance(
    user_id: UUID, appliance_id: UUID
) -> UserApplianceWithDetails:
    """
    Unshare a group appliance and return it to personal ownership.

    Only the original owner (user_id in the appliance record) can unshare.
    Simply clears group_id since user_id is already the original owner.

    Args:
        user_id: User's UUID (must be the original owner)
        appliance_id: Appliance's UUID (user_appliances.id)

    Returns:
        Updated UserApplianceWithDetails

    Raises:
        NotOwnerError: If user is not the original owner of the appliance
        NotSharedError: If appliance is not shared (already personal ownership)
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # 1. Get the appliance
    result = (
        client.table("user_appliances")
        .select("*")
        .eq("id", str(appliance_id))
        .execute()
    )

    if not result.data:
        raise ApplianceNotFoundError(f"Appliance {appliance_id} not found")

    appliance = result.data[0]

    # 2. Check if it's a group appliance
    if appliance.get("group_id") is None:
        raise NotSharedError("この家電は共有されていません")

    # 3. Check if user is the original owner
    if appliance.get("user_id") != str(user_id):
        raise NotOwnerError("この家電の元の所有者ではありません")

    # 4. Return to personal ownership (just clear group_id)
    try:
        client.table("user_appliances").update({"group_id": None}).eq(
            "id", str(appliance_id)
        ).execute()
    except Exception as e:
        logger.error(f"Failed to unshare appliance: {e}")
        raise ApplianceServiceError(f"Failed to unshare appliance: {e}") from e

    # 5. Return updated appliance
    return await get_user_appliance(user_id, appliance_id)
