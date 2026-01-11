"""API routes for tier and usage management."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from app.schemas.tier import TierLimitExceededError
from app.services.tier_service import (
    check_and_increment_manual_search,
    get_user_usage_stats,
)

router = APIRouter(prefix="/tiers", tags=["tiers"])


def _get_user_id_from_header(x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": "Authentication required", "code": "UNAUTHORIZED"},
        )
    try:
        UUID(x_user_id)  # Validate UUID format
        return x_user_id
    except ValueError as err:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid user ID", "code": "INVALID_USER_ID"},
        ) from err


@router.post("/check-manual-search")
async def check_manual_search_limit(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Check if user can perform manual search (and increment counter)."""
    user_id = _get_user_id_from_header(x_user_id)
    result = await check_and_increment_manual_search(user_id)

    if not result["allowed"]:
        return JSONResponse(
            status_code=403,
            content=TierLimitExceededError(
                message="本日の説明書検索回数が上限に達しました",
                current_usage=result["current_usage"],
                limit=result["limit"],
                tier=result["tier_name"],
                tier_display_name=result["tier_display_name"],
            ).model_dump(),
        )

    return {"allowed": True, **result}


@router.get("/usage")
async def get_usage_stats(
    x_user_id: Annotated[str | None, Header()] = None,
):
    """Get user's current tier and usage statistics."""
    user_id = _get_user_id_from_header(x_user_id)
    stats = await get_user_usage_stats(user_id)
    return stats
