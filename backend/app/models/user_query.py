"""Normalized user prompts for searchable admin review."""

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserQuery(Base, TimestampMixin):
    __tablename__ = "user_queries"
    __table_args__ = (
        UniqueConstraint("session_id", "message_index", name="uq_user_queries_session_message"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    message_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(String(200), index=True, default=None)
    has_attachments: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

