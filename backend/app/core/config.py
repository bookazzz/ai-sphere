"""Application settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "AI-Sphere"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./ai_sphere.db"
    database_url_sync: str = "sqlite:///./ai_sphere.db"  # for Alembic

    # JWT
    jwt_secret: str = "change-me-in-production"
    secret_key: str = "change-me-in-production"  # alias for compatibility
    algorithm: str = "HS256"
    jwt_algorithm: str = "HS256"  # alias
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    jwt_expire_minutes: int = 60 * 24 * 7  # alias

    # CORS
    cors_origins: str = "http://localhost:3000,https://ai-sphere.ru"

    # Yandex OAuth
    yandex_client_id: str = ""
    yandex_client_secret: str = ""
    yandex_redirect_uri: str = "https://ai-sphere.ru/api/auth/oauth/yandex/callback"

    # VK OAuth
    vk_client_id: str = ""
    vk_client_secret: str = ""
    vk_redirect_uri: str = "https://ai-sphere.ru/api/auth/oauth/vk/callback"

    # Frontend URL (for OAuth redirects after auth)
    frontend_url: str = "https://ai-sphere.ru"

    # YooKassa
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""

    # OpenRouter (используется в chat.py)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
