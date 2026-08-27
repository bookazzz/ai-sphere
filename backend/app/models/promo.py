"""Promo code model for admin panel."""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PromoCode(Base, TimestampMixin):
    __tablename__ = "promo_codes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    credits: Mapped[int] = mapped_column()
    max_uses: Mapped[int] = mapped_column(default=0)  # 0 = unlimited
    used_count: Mapped[int] = mapped_column(default=0)
    description: Mapped[str] = mapped_column(String(500), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[date | None] = mapped_column(Date, default=None)


class PromoRedemption(Base, TimestampMixin):
    __tablename__ = "promo_redemptions"
    __table_args__ = (UniqueConstraint("promo_id", "user_id", name="uq_promo_redemptions_promo_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    promo_id: Mapped[int] = mapped_column(ForeignKey("promo_codes.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
