"""Notifications system — admin can send to users."""

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    button_text: Mapped[str | None] = mapped_column(String(100), default=None)
    button_url: Mapped[str | None] = mapped_column(String(500), default=None)
    audience: Mapped[str] = mapped_column(String(50), default="all")  # all / new / paid / zero_balance / model_users / specific_user
    audience_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), default=None)
    channel: Mapped[str] = mapped_column(String(50), default="site")  # site / email / both
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    sent_count: Mapped[int] = mapped_column(default=0)
    opened_count: Mapped[int] = mapped_column(default=0)
