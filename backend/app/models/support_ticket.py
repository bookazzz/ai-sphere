"""Support tickets system."""

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SupportTicket(Base, TimestampMixin):
    __tablename__ = "support_tickets"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="other")  # payment / credits / model_error / files / auth / data_deletion / other
    priority: Mapped[str] = mapped_column(String(20), default="normal")  # low / normal / high / urgent
    status: Mapped[str] = mapped_column(String(30), default="new")  # new / in_progress / waiting_user / resolved / closed
    assigned_to: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), default=None)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    is_internal: Mapped[bool] = mapped_column(default=False)


class TicketMessage(Base, TimestampMixin):
    __tablename__ = "ticket_messages"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticket_id: Mapped[int] = mapped_column(Integer, ForeignKey("support_tickets.id"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(default=False)  # admin-only note
