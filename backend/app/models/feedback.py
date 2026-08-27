"""User feedback, message ratings and administrative replies."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class MessageFeedback(Base, TimestampMixin):
    __tablename__ = "message_feedback"
    __table_args__ = (
        UniqueConstraint("session_id", "message_index", "user_id", name="uq_message_feedback_target"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    message_index: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    feedback_type: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(200), index=True, default="")


class UserFeedback(Base, TimestampMixin):
    __tablename__ = "user_feedback"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(20), index=True, default="other")
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer, default=None)
    source: Mapped[str] = mapped_column(String(50), default="site")
    status: Mapped[str] = mapped_column(String(20), index=True, default="new")


class FeedbackReply(Base):
    __tablename__ = "feedback_replies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    feedback_id: Mapped[int] = mapped_column(ForeignKey("user_feedback.id", ondelete="CASCADE"), index=True, nullable=False)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

