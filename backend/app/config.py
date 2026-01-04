"""Application configuration"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # API Keys
    gemini_api_key: str
    google_cse_api_key: str
    google_cse_id: str

    # Supabase (Optional for Phase 1, Required from Phase 2)
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_secret_key: str | None = None

    # VAPID (Web Push Notifications)
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_subject: str | None = None

    # API Configuration
    api_v1_prefix: str = "/api/v1"
    project_name: str = "Manual Agent Backend"
    version: str = "0.1.0"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
    ]
    # Vercel プレビュー/本番ドメイン用の正規表現パターン
    cors_origin_regex: str | None = r"https://.*\.vercel\.app"

    # Upload limits
    max_upload_size_mb: int = 50

    # Concurrency limits
    max_concurrent_searches: int = 5  # Maximum parallel manual searches
    max_thread_pool_workers: int = 10  # Thread pool size for blocking I/O operations

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Global settings instance
settings = Settings()
