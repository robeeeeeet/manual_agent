"""Supabase client singleton for backend services."""

import logging
from functools import lru_cache

from app.config import settings
from supabase import Client, create_client

logger = logging.getLogger(__name__)


@lru_cache
def get_supabase_client() -> Client | None:
    """
    Get Supabase client instance (singleton).

    Uses secret_key to bypass RLS for backend operations.
    Returns None if Supabase is not configured.

    Returns:
        Supabase Client instance or None
    """
    if not settings.supabase_url:
        logger.warning("SUPABASE_URL not configured")
        return None

    # Prefer secret_key for backend (bypasses RLS)
    # Fall back to publishable_key if secret not available
    key = settings.supabase_secret_key or settings.supabase_publishable_key

    if not key:
        logger.warning("No Supabase key configured")
        return None

    try:
        return create_client(settings.supabase_url, key)
    except Exception as e:
        logger.error(f"Error creating Supabase client: {e}", exc_info=True)
        return None
