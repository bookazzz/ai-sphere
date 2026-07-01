"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "AI-Sphere"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./data.db"
    database_url_sync: str = "sqlite:///./data.db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # OAuth
    yandex_client_id: str = ""
    yandex_client_secret: str = ""
    yandex_redirect_uri: str = "https://ai-sphere.ru/api/auth/yandex/callback"

    vk_client_id: str = ""
    vk_client_secret: str = ""
    vk_redirect_uri: str = "https://ai-sphere.ru/api/auth/vk/callback"

    # YooKassa
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_return_url: str = "https://ai-sphere.ru/payment-success"
    yookassa_test: bool = True

    # OpenRouter / LLM
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    default_model: str = "deepseek/deepseek-chat"

    # CORS
    cors_origins: str = "https://ai-sphere.ru,http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
