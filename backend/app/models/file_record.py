"""File records for admin management."""

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class FileRecord(Base, TimestampMixin):
    __tablename__ = "file_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    chat_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chat_sessions.id"), default=None)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), default=None)
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="uploaded")  # uploaded / processing / processed / error / deleted / blocked
    error_text: Mapped[str | None] = mapped_column(Text, default=None)
    is_blocked: Mapped[bool] = mapped_column(default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True, default=None)

