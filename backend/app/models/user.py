"""User model with role-based access and separate credit tracking."""

import datetime

from sqlalchemy import Boolean, String, Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(100), default=None)

    # Role
    role_id: Mapped[int | None] = mapped_column(ForeignKey("admin_roles.id"), default=None)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    # Credits — раздельный учёт
    credits_paid: Mapped[int] = mapped_column(default=0)       # платные
    credits_free: Mapped[int] = mapped_column(default=0)       # бесплатные
    credits_bonus: Mapped[int] = mapped_column(default=0)      # бонусные (включая промо)
    credits_promo: Mapped[int] = mapped_column(default=0)      # промокоды

    # Free credits program
    free_program_start: Mapped[datetime.date | None] = mapped_column(Date, default=None)
    free_program_days: Mapped[int] = mapped_column(default=60)
    last_daily_reset: Mapped[datetime.date | None] = mapped_column(Date, default=None)

    # Financial
    total_spent_rub: Mapped[int] = mapped_column(default=0)   # копейки
    total_spent_credits: Mapped[int] = mapped_column(default=0)
    total_paid_rub: Mapped[int] = mapped_column(default=0)    # всего пополнено

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Stats
    request_count: Mapped[int] = mapped_column(default=0)
    chat_count: Mapped[int] = mapped_column(default=0)
    last_seen: Mapped[datetime.datetime | None] = mapped_column(default=None)

    # Registration
    registered_by: Mapped[str] = mapped_column(String(50), default="email")  # email, yandex, vk
    reg_ip: Mapped[str | None] = mapped_column(String(50), default=None)
    reg_ua: Mapped[str | None] = mapped_column(String(500), default=None)
    reg_source: Mapped[str | None] = mapped_column(String(255), default=None)  # utm source
    reg_utm: Mapped[str | None] = mapped_column(String(500), default=None)  # JSON

    # OAuth
    yandex_id: Mapped[str | None] = mapped_column(String(100), unique=True, default=None)
    vk_id: Mapped[str | None] = mapped_column(String(100), unique=True, default=None)

    # Referral
    referrer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)
    referral_code: Mapped[str | None] = mapped_column(String(50), unique=True, default=None)

    @property
    def credits(self) -> int:
        return self.credits_paid + self.credits_free + self.credits_bonus + self.credits_promo

    @property
    def is_superadmin(self) -> bool:
        return bool(self.is_admin and self.role_id is None)
