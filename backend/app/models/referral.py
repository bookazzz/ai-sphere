"""Referral / affiliate program."""

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ReferralPartner(Base, TimestampMixin):
    __tablename__ = "referral_partners"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True, nullable=False)
    referral_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    commission_rate: Mapped[float] = mapped_column(default=0.1)  # 10%
    total_earned: Mapped[int] = mapped_column(default=0)  # in kopecks
    total_paid: Mapped[int] = mapped_column(default=0)
    referral_count: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)
    payout_method: Mapped[str | None] = mapped_column(String(50), default=None)
    payout_details: Mapped[str | None] = mapped_column(String(500), default=None)


class ReferralTransaction(Base, TimestampMixin):
    __tablename__ = "referral_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(ForeignKey("referral_partners.id"), index=True, nullable=False)
    referred_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # commission / payout / bonus
    amount: Mapped[int] = mapped_column(default=0)  # kopecks
    related_payment_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"), default=None)
    description: Mapped[str | None] = mapped_column(String(500), default=None)
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending / paid / cancelled
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
