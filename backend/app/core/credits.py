"""Atomic credit entitlements and bucket-aware balance helpers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from zoneinfo import ZoneInfoNotFoundError

from sqlalchemy import or_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credit_op import CreditOperation
from app.models.user import User


try:
    MOSCOW_TZ = ZoneInfo("Europe/Moscow")
except ZoneInfoNotFoundError:  # Windows images may not ship the IANA database; Moscow is fixed UTC+3.
    MOSCOW_TZ = timezone(timedelta(hours=3), name="Europe/Moscow")
CREDIT_BUCKETS = ("free", "bonus", "paid", "promo")


def moscow_today():
    return datetime.now(MOSCOW_TZ).date()


async def apply_daily_credits(user: User, db: AsyncSession) -> User:
    """Set the non-paying user's free bucket to 10 once per Moscow day."""
    if user.total_paid_rub > 0:
        return user
    today = moscow_today()
    before_total = user.credits
    before_free = user.credits_free
    result = await db.execute(
        update(User)
        .where(
            User.id == user.id,
            User.total_paid_rub == 0,
            or_(User.last_daily_reset.is_(None), User.last_daily_reset != today),
        )
        .values(credits_free=10, last_daily_reset=today)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 1:
        delta = 10 - before_free
        db.add(CreditOperation(
            user_id=user.id,
            op_type="daily_free",
            credit_type="free",
            amount=delta,
            balance_before=before_total,
            balance_after=before_total + delta,
            source=today.isoformat(),
            related_id=f"daily:{today.isoformat()}",
            comment="Ежедневный баланс бесплатных кредитов",
        ))
        await db.commit()
    await db.refresh(user)
    return user


def bucket_snapshot(user: User) -> dict[str, int]:
    return {name: int(getattr(user, f"credits_{name}", 0) or 0) for name in CREDIT_BUCKETS}


def allocate_buckets(snapshot: dict[str, int], amount: int) -> dict[str, int]:
    remaining = max(0, int(amount))
    allocation: dict[str, int] = {}
    for name in CREDIT_BUCKETS:
        used = min(max(0, int(snapshot.get(name, 0))), remaining)
        allocation[name] = used
        remaining -= used
    if remaining:
        raise ValueError("insufficient credits")
    return allocation


async def restore_buckets(db: AsyncSession, user_id: int, allocation: dict[str, int], amount: int | None = None) -> dict[str, int]:
    """Restore up to amount credits proportionally in original spend order."""
    remaining = sum(max(0, int(v)) for v in allocation.values()) if amount is None else max(0, int(amount))
    values = {}
    restored = {name: 0 for name in CREDIT_BUCKETS}
    for name in reversed(CREDIT_BUCKETS):
        value = min(max(0, int(allocation.get(name, 0))), remaining)
        restored[name] = value
        remaining -= value
        if value:
            column = getattr(User, f"credits_{name}")
            values[f"credits_{name}"] = column + value
    if values:
        await db.execute(update(User).where(User.id == user_id).values(**values))
    return restored
