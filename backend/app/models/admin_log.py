"""Admin action log — every critical action recorded."""

from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AdminLog(Base, TimestampMixin):
    __tablename__ = "admin_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    # login, logout, user_edit, balance_change, payment_refund, model_price_change,
    # plan_change, api_key_change, chat_view, file_view, data_delete, role_change,
    # user_block, settings_change
    target_type: Mapped[str] = mapped_column(String(50), default="")  # user, model, plan, payment, system
    target_id: Mapped[str | None] = mapped_column(String(100), default=None)
    old_value: Mapped[str] = mapped_column(Text, default="")
    new_value: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[str | None] = mapped_column(String(50), default=None)
    result: Mapped[str] = mapped_column(String(50), default="success")  # success, error, blocked
    detail: Mapped[str] = mapped_column(Text, default="")
