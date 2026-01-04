"""Service for managing appliances (shared and user-owned)."""

from datetime import UTC
from uuid import UUID

from app.schemas.appliance import (
    SharedAppliance,
    UserApplianceCreate,
    UserApplianceUpdate,
    UserApplianceWithDetails,
)
from app.services.supabase_client import get_supabase_client


class ApplianceServiceError(Exception):
    """Base exception for appliance service errors."""

    pass


class ApplianceNotFoundError(ApplianceServiceError):
    """Raised when appliance is not found."""

    pass


class DuplicateNameError(ApplianceServiceError):
    """Raised when user already has an appliance with the same name."""

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
) -> UserApplianceWithDetails:
    """
    Register a new appliance for a user.

    This will:
    1. Get or create the shared appliance (by maker/model_number)
    2. Create a user_appliance record linking the user to the shared appliance

    Args:
        user_id: User's UUID
        appliance_data: Appliance registration data

    Returns:
        UserApplianceWithDetails with all appliance information

    Raises:
        DuplicateNameError: If user already has an appliance with the same name
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # Get or create shared appliance
    shared = await get_or_create_shared_appliance(
        maker=appliance_data.maker,
        model_number=appliance_data.model_number,
        category=appliance_data.category,
        manual_source_url=appliance_data.manual_source_url,
        stored_pdf_path=appliance_data.stored_pdf_path,
    )

    # Create user_appliance record
    insert_data = {
        "user_id": str(user_id),
        "shared_appliance_id": str(shared.id),
        "name": appliance_data.name,
    }
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
        raise ApplianceServiceError(f"Failed to register appliance: {e}") from e

    if not result.data:
        raise ApplianceServiceError("Failed to register user appliance")

    user_appliance = result.data[0]

    # Return combined data
    return UserApplianceWithDetails(
        id=user_appliance["id"],
        user_id=user_appliance["user_id"],
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
    )


async def get_user_appliances(user_id: UUID) -> list[UserApplianceWithDetails]:
    """
    Get all appliances for a user.

    Args:
        user_id: User's UUID

    Returns:
        List of UserApplianceWithDetails

    Raises:
        ApplianceServiceError: If database operation fails
    """
    from datetime import datetime

    from app.schemas.appliance import NextMaintenanceInfo

    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    # Query user_appliances with joined shared_appliances data
    result = (
        client.table("user_appliances")
        .select("*, shared_appliances(*)")
        .eq("user_id", str(user_id))
        .order("created_at", desc=True)
        .execute()
    )

    appliances = []
    for row in result.data:
        shared = row.get("shared_appliances", {})

        # Get next upcoming maintenance for this appliance
        next_maintenance = None
        maintenance_result = (
            client.table("maintenance_schedules")
            .select("task_name, next_due_at, importance")
            .eq("user_appliance_id", row["id"])
            .not_.is_("next_due_at", "null")
            .order("next_due_at", desc=False)
            .limit(1)
            .execute()
        )

        if maintenance_result.data:
            maintenance = maintenance_result.data[0]
            next_due_at = datetime.fromisoformat(
                maintenance["next_due_at"].replace("Z", "+00:00")
            )
            now = datetime.now(UTC)
            days_until_due = (next_due_at - now).days

            next_maintenance = NextMaintenanceInfo(
                task_name=maintenance["task_name"],
                next_due_at=next_due_at,
                importance=maintenance["importance"],
                days_until_due=days_until_due,
            )

        appliances.append(
            UserApplianceWithDetails(
                id=row["id"],
                user_id=row["user_id"],
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
            )
        )

    return appliances


async def get_user_appliance(
    user_id: UUID, appliance_id: UUID
) -> UserApplianceWithDetails:
    """
    Get a specific appliance for a user.

    Args:
        user_id: User's UUID
        appliance_id: Appliance's UUID (user_appliances.id)

    Returns:
        UserApplianceWithDetails

    Raises:
        ApplianceNotFoundError: If appliance not found or not owned by user
        ApplianceServiceError: If database operation fails
    """
    client = get_supabase_client()
    if not client:
        raise ApplianceServiceError("Supabase client not configured")

    result = (
        client.table("user_appliances")
        .select("*, shared_appliances(*)")
        .eq("id", str(appliance_id))
        .eq("user_id", str(user_id))
        .execute()
    )

    if not result.data:
        raise ApplianceNotFoundError(f"Appliance {appliance_id} not found")

    row = result.data[0]
    shared = row.get("shared_appliances", {})

    return UserApplianceWithDetails(
        id=row["id"],
        user_id=row["user_id"],
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
    )


async def update_user_appliance(
    user_id: UUID,
    appliance_id: UUID,
    update_data: UserApplianceUpdate,
) -> UserApplianceWithDetails:
    """
    Update a user's appliance.

    Args:
        user_id: User's UUID
        appliance_id: Appliance's UUID (user_appliances.id)
        update_data: Fields to update

    Returns:
        Updated UserApplianceWithDetails

    Raises:
        ApplianceNotFoundError: If appliance not found or not owned by user
        DuplicateNameError: If the new name already exists for this user
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
    Delete a user's appliance.

    Note: This only deletes the user_appliance record.
    The shared_appliance remains for other users.

    Args:
        user_id: User's UUID
        appliance_id: Appliance's UUID (user_appliances.id)

    Returns:
        True if deleted successfully

    Raises:
        ApplianceNotFoundError: If appliance not found or not owned by user
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
