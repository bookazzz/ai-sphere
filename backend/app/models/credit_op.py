"""Credit operations journal — every credit movement recorded."""

from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CreditOperation(Base, TimestampMixin):
    __tablename__ = "credit_operations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    op_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # purchase, daily_free, promo, spend, refund, manual_add, manual_remove, bonus, compensation, payment_refund
    credit_type: Mapped[str] = mapped_column(String(20), default="paid")
    # paid, free, bonus, promo
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # положительное = добавление, отрицательное = списание
    balance_before: Mapped[int] = mapped_column(Integer, default=0)
    balance_after: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(255), default="")  # plan_id, promo_code, request_id
    related_id: Mapped[str | None] = mapped_column(String(100), default=None)  # payment_id, request_id, chat_id
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)
    comment: Mapped[str] = mapped_column(Text, default="")
