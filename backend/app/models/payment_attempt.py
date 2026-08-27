"""Pending provider payments used to validate and idempotently process webhooks."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PaymentAttempt(Base, TimestampMixin):
    __tablename__ = "payment_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    plan_id: Mapped[int] = mapped_column(ForeignKey("credit_plans.id"), nullable=False)
    amount_kopecks: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    failure_reason: Mapped[str | None] = mapped_column(String(500), default=None)
