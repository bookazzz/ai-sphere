"""System errors tracking model."""

from sqlalchemy import String, Text, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SystemError(Base, TimestampMixin):
    __tablename__ = "system_errors"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    error_code: Mapped[str] = mapped_column(String(100), default="")      # ERR_OPENROUTER_TIMEOUT
    error_text: Mapped[str] = mapped_column(Text, default="")             # readable message
    service: Mapped[str] = mapped_column(String(50), default="openrouter") # openrouter, payment, file, auth, email, db
    model_id: Mapped[str | None] = mapped_column(String(200), default=None)
    user_id: Mapped[int | None] = mapped_column(Integer, default=None)
    request_id: Mapped[str | None] = mapped_column(String(100), default=None)
    repeat_count: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="new")        # new, investigating, fixed, ignored
    stack_trace: Mapped[str] = mapped_column(Text, default="")
    resolved_by: Mapped[int | None] = mapped_column(Integer, default=None)  # admin_id
    resolved_at: Mapped[str | None] = mapped_column(String(50), default=None)
