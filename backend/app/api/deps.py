"""Dependency injection for API routes"""

from typing import Annotated

from fastapi import Depends, HTTPException, Header, status

from app.config import settings


async def verify_backend_key(
    x_backend_key: Annotated[str | None, Header()] = None
) -> None:
    """
    Verify backend API key (for BFF → Backend authentication).

    This dependency is currently not enforced but prepared for Phase 1
    when Next.js BFF will communicate with this backend.

    Args:
        x_backend_key: Backend API key from X-Backend-Key header

    Raises:
        HTTPException: If key is invalid (when enforced)
    """
    # TODO: Implement in Phase 1 when BFF is ready
    # For now, this is a placeholder
    pass


# Example of how to use in routes:
# @router.post("/protected", dependencies=[Depends(verify_backend_key)])
# async def protected_endpoint():
#     return {"message": "Protected"}
