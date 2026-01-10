"""
Maintenance list API routes.

Provides endpoints for viewing all maintenance schedules with filtering.
"""

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException

from app.schemas.appliance import (
    MaintenanceCounts,
    MaintenanceListResponse,
    MaintenanceWithAppliance,
)
from app.services.maintenance_log_service import get_all_maintenance_with_details

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _get_user_id_from_header(x_user_id: str | None) -> str:
    """Extract and validate user ID from header."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-ID header is required")
    return x_user_id


@router.get("", response_model=MaintenanceListResponse)
async def get_maintenance_list(
    x_user_id: Annotated[str | None, Header()] = None,
    status: str | None = None,
    importance: str | None = None,
    appliance_id: str | None = None,
) -> MaintenanceListResponse:
    """
    Get all maintenance schedules for the authenticated user.

    Args:
        x_user_id: User ID from header (required)
        status: Filter by status (comma-separated: overdue,upcoming,scheduled,manual)
        importance: Filter by importance (comma-separated: high,medium,low)
        appliance_id: Filter by specific appliance UUID

    Returns:
        MaintenanceListResponse with items and counts by status
    """
    user_id = _get_user_id_from_header(x_user_id)

    # Parse comma-separated filters
    status_filter = status.split(",") if status else None
    importance_filter = importance.split(",") if importance else None

    # Validate status filter values
    valid_statuses = {"overdue", "upcoming", "scheduled", "manual"}
    if status_filter and not all(s in valid_statuses for s in status_filter):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status value. Valid values: {', '.join(valid_statuses)}",
        )

    # Validate importance filter values
    valid_importances = {"high", "medium", "low"}
    if importance_filter and not all(i in valid_importances for i in importance_filter):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid importance value. Valid values: {', '.join(valid_importances)}",
        )

    result = await get_all_maintenance_with_details(
        user_id=user_id,
        status_filter=status_filter,
        importance_filter=importance_filter,
        appliance_id=appliance_id,
    )

    return MaintenanceListResponse(
        items=[MaintenanceWithAppliance(**item) for item in result["items"]],
        counts=MaintenanceCounts(**result["counts"]),
    )
