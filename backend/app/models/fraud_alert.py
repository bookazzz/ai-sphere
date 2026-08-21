"""Fraud detection alerts."""

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class FraudAlert(Base, TimestampMixin):
    __tablename__ = "fraud_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), index=True, default=None)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # Types: mass_registrations / multi_account / rapid_requests / proxy_vpn / anomalous_spending / duplicate_payment / bot / brute_force / dangerous_file
    risk_level: Mapped[str] = mapped_column(String(20), default="medium")  # low / medium / high / critical
    ip_address: Mapped[str | None] = mapped_column(String(50), default=None)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, default=None)  # JSON with extra data
    status: Mapped[str] = mapped_column(String(30), default="new")  # new / investigating / blocked / resolved / ignored
    action_taken: Mapped[str | None] = mapped_column(String(50), default=None)
    # Actions: temp_block / limit_free / captcha / ip_block / account_block / manual_review
    resolved_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), default=None)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
