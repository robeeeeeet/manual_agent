"""Contact/Feedback API routes."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from app.schemas.contact import ContactRequest, ContactResponse
from app.services.contact_service import submit_contact

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contact", tags=["contact"])


def _get_user_id_from_header(x_user_id: str | None) -> UUID:
    """Extract and validate user ID from header."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "User ID required", "code": "UNAUTHORIZED"},
        )
    try:
        return UUID(x_user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Invalid user ID", "code": "INVALID_USER_ID"},
        ) from e


@router.post(
    "",
    response_model=ContactResponse,
    summary="Submit contact/feedback",
    description="Submit feature request, bug report, or other feedback",
)
async def submit(
    request: ContactRequest,
    x_user_id: Annotated[str | None, Header()] = None,
    x_user_email: Annotated[str | None, Header()] = None,
) -> ContactResponse:
    """Submit contact form.

    Requires authentication via X-User-ID header.
    """
    user_id = _get_user_id_from_header(x_user_id)

    logger.info(f"Contact submission from user {user_id}: type={request.type.value}")

    result = await submit_contact(
        user_id=str(user_id),
        user_email=x_user_email or "",
        contact_type=request.type.value,
        screen=request.screen.value,
        content=request.content,
        reproduction_steps=request.reproduction_steps,
        screenshot_base64=request.screenshot_base64,
        screenshot_filename=request.screenshot_filename,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": result["message"], "code": "INTERNAL_ERROR"},
        )

    return ContactResponse(success=True, message=result["message"])
