"""Role model for admin access control."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Role(Base, TimestampMixin):
    __tablename__ = "admin_roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    permissions: Mapped[str] = mapped_column(Text, default="{}")  # JSON dict: {"module": "crud"}
    is_system: Mapped[bool] = mapped_column(default=False)  # нельзя удалить встроенную роль
