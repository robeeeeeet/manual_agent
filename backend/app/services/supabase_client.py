"""Supabase client singleton for backend services."""

from functools import lru_cache

from app.config import settings
from supabase import Client, create_client


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
        print("Warning: SUPABASE_URL not configured")
        return None

    # Prefer secret_key for backend (bypasses RLS)
    # Fall back to publishable_key if secret not available
    key = settings.supabase_secret_key or settings.supabase_publishable_key

    if not key:
        print("Warning: No Supabase key configured")
        return None

    try:
        return create_client(settings.supabase_url, key)
    except Exception as e:
        print(f"Error creating Supabase client: {e}")
        return None
