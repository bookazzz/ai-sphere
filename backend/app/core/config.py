"""Application settings with namespaced, backwards-compatible environment variables."""

from pathlib import Path

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = BACKEND_ROOT / "data"


class Settings(BaseSettings):
    # App
    app_name: str = "AI-Sphere"
    environment: str = Field("development", validation_alias=AliasChoices("AISPHERE_ENVIRONMENT", "ENVIRONMENT"))
    # Deliberately do not accept the generic DEBUG variable: process managers often set it
    # to non-boolean values (for example "release").
    debug: bool = Field(False, validation_alias="AISPHERE_DEBUG")

    # Database
    data_dir: Path = Field(DEFAULT_DATA_DIR, validation_alias=AliasChoices("AISPHERE_DATA_DIR", "DATA_DIR"))
    database_url: str = Field(
        f"sqlite+aiosqlite:///{(DEFAULT_DATA_DIR / 'ai_sphere.db').as_posix()}",
        validation_alias=AliasChoices("AISPHERE_DATABASE_URL", "DATABASE_URL"),
    )
    database_url_sync: str = Field(
        f"sqlite:///{(DEFAULT_DATA_DIR / 'ai_sphere.db').as_posix()}",
        validation_alias=AliasChoices("AISPHERE_DATABASE_URL_SYNC", "DATABASE_URL_SYNC"),
    )

    # JWT
    jwt_secret: str = Field(
        "change-me-in-production",
        validation_alias=AliasChoices("AISPHERE_JWT_SECRET", "JWT_SECRET", "SECRET_KEY"),
    )
    jwt_algorithm: str = Field("HS256", validation_alias=AliasChoices("AISPHERE_JWT_ALGORITHM", "JWT_ALGORITHM", "ALGORITHM"))
    access_token_expire_minutes: int = Field(
        60 * 24 * 7,
        validation_alias=AliasChoices("AISPHERE_ACCESS_TOKEN_EXPIRE_MINUTES", "ACCESS_TOKEN_EXPIRE_MINUTES"),
    )
    jwt_expire_minutes: int = 60 * 24 * 7  # alias

    # CORS
    cors_origins: str = Field(
        "http://localhost:3000,https://ai-sphere.ru",
        validation_alias=AliasChoices("AISPHERE_CORS_ORIGINS", "CORS_ORIGINS"),
    )
    auth_cookie_name: str = Field("ai_sphere_session", validation_alias=AliasChoices("AISPHERE_AUTH_COOKIE_NAME", "AUTH_COOKIE_NAME"))
    cookie_secure: bool = Field(False, validation_alias=AliasChoices("AISPHERE_COOKIE_SECURE", "COOKIE_SECURE"))
    admin_rate_limit_per_minute: int = 120

    # Yandex OAuth
    yandex_client_id: str = Field("", validation_alias=AliasChoices("AISPHERE_YANDEX_CLIENT_ID", "YANDEX_CLIENT_ID"))
    yandex_client_secret: str = Field("", validation_alias=AliasChoices("AISPHERE_YANDEX_CLIENT_SECRET", "YANDEX_CLIENT_SECRET"))
    yandex_redirect_uri: str = Field("https://ai-sphere.ru/api/auth/oauth/yandex/callback", validation_alias=AliasChoices("AISPHERE_YANDEX_REDIRECT_URI", "YANDEX_REDIRECT_URI"))

    # VK OAuth
    vk_client_id: str = Field("", validation_alias=AliasChoices("AISPHERE_VK_CLIENT_ID", "VK_CLIENT_ID"))
    vk_client_secret: str = Field("", validation_alias=AliasChoices("AISPHERE_VK_CLIENT_SECRET", "VK_CLIENT_SECRET"))
    vk_redirect_uri: str = Field("https://ai-sphere.ru/api/auth/oauth/vk/callback", validation_alias=AliasChoices("AISPHERE_VK_REDIRECT_URI", "VK_REDIRECT_URI"))

    # Frontend URL (for OAuth redirects after auth)
    frontend_url: str = Field("https://ai-sphere.ru", validation_alias=AliasChoices("AISPHERE_FRONTEND_URL", "FRONTEND_URL"))

    # YooKassa (DEPRECATED — replaced by Platega)
    # yookassa_shop_id: str = ""
    # yookassa_secret_key: str = ""
    # yookassa_return_url: str = "https://ai-sphere.ru/billing"
    # yookassa_test: bool = True

    # OpenRouter
    openrouter_api_key: str = Field("", validation_alias=AliasChoices("AISPHERE_OPENROUTER_API_KEY", "OPENROUTER_API_KEY"))
    openrouter_base_url: str = Field("https://openrouter.ai/api/v1", validation_alias=AliasChoices("AISPHERE_OPENROUTER_BASE_URL", "OPENROUTER_BASE_URL"))
    openrouter_proxy: str | None = Field(None, validation_alias=AliasChoices("AISPHERE_OPENROUTER_PROXY", "OPENROUTER_PROXY"))
    voice_punctuation_model: str = Field(
        "google/gemini-2.5-flash-lite",
        validation_alias=AliasChoices("AISPHERE_VOICE_PUNCTUATION_MODEL", "VOICE_PUNCTUATION_MODEL"),
    )
    web_search_enabled: bool = Field(False, validation_alias=AliasChoices("AISPHERE_WEB_SEARCH_ENABLED", "WEB_SEARCH_ENABLED"))
    media_generation_enabled: bool = Field(True, validation_alias="AISPHERE_MEDIA_GENERATION_ENABLED")
    video_generation_enabled: bool = Field(True, validation_alias="AISPHERE_VIDEO_GENERATION_ENABLED")
    auto_routing_enabled: bool = Field(True, validation_alias="AISPHERE_AUTO_ROUTING_ENABLED")
    media_retention_days: int = Field(30, validation_alias="AISPHERE_MEDIA_RETENTION_DAYS")
    history_retention_days: int = Field(30, ge=1, le=365, validation_alias="AISPHERE_HISTORY_RETENTION_DAYS")
    free_daily_cost_budget_usd: float = Field(5.0, ge=0, validation_alias="AISPHERE_FREE_DAILY_COST_BUDGET_USD")
    monthly_fixed_cost_rub: float = Field(0.0, ge=0, validation_alias="AISPHERE_MONTHLY_FIXED_COST_RUB")
    credits_per_usd: float = Field(1200.0, validation_alias="AISPHERE_CREDITS_PER_USD")
    openrouter_smoke_max_usd: float = Field(2.0, validation_alias="AISPHERE_OPENROUTER_SMOKE_MAX_USD")
    usd_rub_rate: float = Field(95.0, gt=0, validation_alias="AISPHERE_USD_RUB_RATE")
    target_gross_margin: float = Field(0.80, ge=0.0, lt=0.95, validation_alias="AISPHERE_TARGET_GROSS_MARGIN")
    payment_fee_rate: float = Field(0.05, ge=0.0, lt=0.20, validation_alias="AISPHERE_PAYMENT_FEE_RATE")
    fx_safety_factor: float = Field(1.10, ge=1.0, le=2.0, validation_alias="AISPHERE_FX_SAFETY_FACTOR")
    openrouter_funding_fee_rate: float = Field(0.055, ge=0.0, lt=0.20, validation_alias="AISPHERE_OPENROUTER_FUNDING_FEE_RATE")
    analytics_v2_enabled: bool = Field(True, validation_alias="AISPHERE_ANALYTICS_V2_ENABLED")
    campaigns_enabled: bool = Field(True, validation_alias="AISPHERE_CAMPAIGNS_ENABLED")
    gamification_enabled: bool = Field(True, validation_alias="AISPHERE_GAMIFICATION_ENABLED")
    experiments_enabled: bool = Field(True, validation_alias="AISPHERE_EXPERIMENTS_ENABLED")

    # YooKassa (Platega)
    platega_merchant_id: str = Field("", validation_alias=AliasChoices("AISPHERE_PLATEGA_MERCHANT_ID", "PLATEGA_MERCHANT_ID"))
    platega_secret_key: str = Field("", validation_alias=AliasChoices("AISPHERE_PLATEGA_SECRET_KEY", "PLATEGA_SECRET_KEY"))
    platega_return_url: str = Field("", validation_alias=AliasChoices("AISPHERE_PLATEGA_RETURN_URL", "PLATEGA_RETURN_URL"))
    platega_fail_url: str = Field("", validation_alias=AliasChoices("AISPHERE_PLATEGA_FAIL_URL", "PLATEGA_FAIL_URL"))

    model_config = SettingsConfigDict(
        env_prefix="AISPHERE_",
        env_file=(BACKEND_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> set[str]:
        return {origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()}

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def generations_dir(self) -> Path:
        return self.data_dir / "generations"

    @model_validator(mode="after")
    def validate_production(self):
        data_dir = self.data_dir if self.data_dir.is_absolute() else BACKEND_ROOT / self.data_dir
        self.data_dir = data_dir.resolve()

        def absolute_sqlite_url(url: str, prefix: str) -> str:
            if not url.startswith(prefix):
                return url
            raw_path = url[len(prefix):]
            if raw_path == ":memory:":
                return url
            db_path = Path(raw_path)
            if not db_path.is_absolute():
                db_path = self.data_dir / db_path
            return f"{prefix}{db_path.resolve().as_posix()}"

        if "database_url" not in self.model_fields_set:
            self.database_url = f"sqlite+aiosqlite:///{(self.data_dir / 'ai_sphere.db').as_posix()}"
        else:
            self.database_url = absolute_sqlite_url(self.database_url, "sqlite+aiosqlite:///")
        if "database_url_sync" not in self.model_fields_set:
            self.database_url_sync = f"sqlite:///{(self.data_dir / 'ai_sphere.db').as_posix()}"
        else:
            self.database_url_sync = absolute_sqlite_url(self.database_url_sync, "sqlite:///")

        if bool(self.platega_merchant_id) != bool(self.platega_secret_key):
            raise ValueError("AISPHERE_PLATEGA_MERCHANT_ID and AISPHERE_PLATEGA_SECRET_KEY must be set together")
        if bool(self.yandex_client_id) != bool(self.yandex_client_secret):
            raise ValueError("AISPHERE_YANDEX_CLIENT_ID and AISPHERE_YANDEX_CLIENT_SECRET must be set together")
        if bool(self.vk_client_id) != bool(self.vk_client_secret):
            raise ValueError("AISPHERE_VK_CLIENT_ID and AISPHERE_VK_CLIENT_SECRET must be set together")
        if self.environment.lower() == "production":
            if self.jwt_secret in {"change-me-in-production", "replace-with-a-new-random-secret-at-least-32-characters"} or len(self.jwt_secret) < 32:
                raise ValueError("AISPHERE_JWT_SECRET must be a new random value of at least 32 characters")
            if not self.frontend_url.startswith("https://"):
                raise ValueError("AISPHERE_FRONTEND_URL must use HTTPS in production")
            if not self.cookie_secure:
                raise ValueError("AISPHERE_COOKIE_SECURE must be true in production")
            if not self.openrouter_api_key:
                raise ValueError("AISPHERE_OPENROUTER_API_KEY is required in production")
            if self.platega_merchant_id and not self.platega_return_url.startswith("https://"):
                raise ValueError("AISPHERE_PLATEGA_RETURN_URL must use HTTPS when billing is enabled")
        return self


settings = Settings()
