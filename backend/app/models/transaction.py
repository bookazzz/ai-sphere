"""Transaction model for billing."""

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[int] = mapped_column()  # кредиты: +пополнение, -списание
    rub_amount: Mapped[int] = mapped_column(default=0)  # копейки
    type: Mapped[str] = mapped_column(String(20))  # topup, spend, bonus, refund
    description: Mapped[str] = mapped_column(String(500), default="")
    payment_id: Mapped[str | None] = mapped_column(String(100), unique=True, default=None)
