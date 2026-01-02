"""Health check endpoints"""

from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns:
        dict: Status information
    """
    return {
        "status": "ok",
        "service": "Manual Agent Backend",
        "version": "0.1.0"
    }


@router.get("/health/supabase")
async def supabase_health_check():
    """
    Supabase connectivity check endpoint.

    Tests connection to Supabase and verifies:
    - Environment variables are set
    - Connection to Supabase is successful
    - Categories table is accessible

    Returns:
        dict: Supabase connection status and details
    """
    result = {
        "status": "unknown",
        "checks": {
            "env_configured": False,
            "connection": False,
            "categories_table": False,
        },
        "details": {}
    }

    # Check environment variables
    if not settings.supabase_url:
        result["status"] = "error"
        result["details"]["error"] = "SUPABASE_URL not configured"
        return result

    if not settings.supabase_publishable_key:
        result["status"] = "error"
        result["details"]["error"] = "SUPABASE_PUBLISHABLE_KEY not configured"
        return result

    result["checks"]["env_configured"] = True
    result["details"]["url"] = settings.supabase_url

    # Test connection using Secret Key (bypasses RLS for health check)
    try:
        from supabase import create_client

        # Use secret key to bypass RLS for health check
        # In production, this endpoint should be protected or removed
        key_to_use = settings.supabase_secret_key or settings.supabase_publishable_key
        supabase = create_client(
            settings.supabase_url,
            key_to_use
        )
        result["checks"]["connection"] = True
        result["details"]["using_secret_key"] = bool(settings.supabase_secret_key)

        # Test categories table access
        response = supabase.table("categories").select("*").execute()
        categories = response.data

        result["checks"]["categories_table"] = True
        result["details"]["categories_count"] = len(categories)
        result["details"]["categories"] = [cat["name"] for cat in categories]

        result["status"] = "ok"

    except Exception as e:
        result["status"] = "error"
        result["details"]["error"] = str(e)

    return result
