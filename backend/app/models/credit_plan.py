"""Credit plans / tariffs — managed via admin panel."""

from datetime import date as date_type

from sqlalchemy import Boolean, String, Text, Integer, Date
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CreditPlan(Base, TimestampMixin):
    __tablename__ = "credit_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    price_rub: Mapped[int] = mapped_column(Integer, nullable=False)      # копейки
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    bonus_credits: Mapped[int] = mapped_column(Integer, default=0)
    old_price_rub: Mapped[int | None] = mapped_column(Integer, default=None)
    badge: Mapped[str | None] = mapped_column(String(100), default=None)
    badge_color: Mapped[str | None] = mapped_column(String(50), default=None)
    color: Mapped[str | None] = mapped_column(String(50), default=None)
    icon: Mapped[str | None] = mapped_column(String(50), default=None)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    start_date: Mapped[date_type | None] = mapped_column(Date, default=None)
    end_date: Mapped[date_type | None] = mapped_column(Date, default=None)

    is_new_users_only: Mapped[bool] = mapped_column(Boolean, default=False)
    purchase_limit: Mapped[int] = mapped_column(Integer, default=0)  # 0 = unlimited

    purchase_count: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue_rub: Mapped[int] = mapped_column(Integer, default=0)

    @property
    def credit_price(self) -> float:
        """Effective rubles per spendable credit, including package bonuses."""
        total = self.credits + self.bonus_credits
        return round(self.price_rub / 100 / total, 6) if total > 0 else 0.0
