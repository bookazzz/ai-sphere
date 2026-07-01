"""User model."""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(100), default=None)
    credits: Mapped[int] = mapped_column(default=0)
    total_spent_rub: Mapped[int] = mapped_column(default=0)  # копейки
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    # OAuth
    yandex_id: Mapped[str | None] = mapped_column(String(100), unique=True, default=None)
    vk_id: Mapped[str | None] = mapped_column(String(100), unique=True, default=None)
