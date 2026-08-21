"""AI Model model — managed via admin panel."""

from sqlalchemy import Boolean, String, Text, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AiModel(Base, TimestampMixin):
    __tablename__ = "ai_models"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Display
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    provider: Mapped[str] = mapped_column(String(100), default="openrouter")
    category: Mapped[str] = mapped_column(String(100), default="general")

    # OpenRouter
    or_model_id: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    or_input_cost: Mapped[float] = mapped_column(Float, default=0)   # $ per 1M tokens
    or_output_cost: Mapped[float] = mapped_column(Float, default=0)
    or_last_updated: Mapped[str | None] = mapped_column(String(50), default=None)  # ISO date
    or_auto_update: Mapped[bool] = mapped_column(Boolean, default=False)

    # Pricing (credits per 1K tokens)
    price_input: Mapped[float] = mapped_column(Float, default=0)
    price_output: Mapped[float] = mapped_column(Float, default=0)
    price_unit: Mapped[float] = mapped_column(Float, default=0)    # единая цена (если не раздельная)
    price_mode: Mapped[str] = mapped_column(String(20), default="separate")  # separate, unified, fixed
    fixed_price: Mapped[float] = mapped_column(Float, default=0)   # фикс. цена за запрос
    min_cost: Mapped[float] = mapped_column(Float, default=0)      # мин. стоимость запроса
    markup_factor: Mapped[float] = mapped_column(Float, default=2.5)  # коэффициент наценки

    # Economics (auto-calculated)
    margin: Mapped[float] = mapped_column(Float, default=0.0)      # текущая маржа %
    margin_min: Mapped[float] = mapped_column(Float, default=0.6)  # минимальная допустимая маржа 60%
    is_unprofitable: Mapped[bool] = mapped_column(Boolean, default=False)

    # Limits
    max_input_tokens: Mapped[int] = mapped_column(Integer, default=128000)
    max_output_tokens: Mapped[int] = mapped_column(Integer, default=4096)
    max_context: Mapped[int] = mapped_column(Integer, default=128000)
    max_files: Mapped[int] = mapped_column(Integer, default=10)
    max_file_size_mb: Mapped[int] = mapped_column(Integer, default=50)
    daily_limit_per_user: Mapped[int] = mapped_column(Integer, default=0)    # 0 = no limit
    spend_limit_per_user: Mapped[int] = mapped_column(Integer, default=0)
    total_spend_limit: Mapped[int] = mapped_column(Integer, default=0)

    # Availability
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_free_available: Mapped[bool] = mapped_column(Boolean, default=False)
    is_guest_available: Mapped[bool] = mapped_column(Boolean, default=False)
    is_paid_only: Mapped[bool] = mapped_column(Boolean, default=False)
    min_balance: Mapped[int] = mapped_column(Integer, default=0)
    show_cost_warning: Mapped[bool] = mapped_column(Boolean, default=False)

    # Order
    sort_order: Mapped[int] = mapped_column(Integer, default=100)

    # Stats
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_or: Mapped[float] = mapped_column(Float, default=0.0)  # $ total spend
    total_revenue: Mapped[float] = mapped_column(Float, default=0.0)  # credits * rate
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_response_time: Mapped[float] = mapped_column(Float, default=0.0)

    # Vision
    vision: Mapped[bool] = mapped_column(Boolean, default=False)
