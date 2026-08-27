"""Server-authoritative progress and reward processing."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credit_op import CreditOperation
from app.models.fraud_alert import FraudAlert
from app.models.product_growth import (
    Achievement, Mission, RewardLedger, UserAchievement, UserMissionProgress, UserProgress,
)
from app.models.user import User
from app.core.config import settings


LEVELS = ((1500, "Мастер"), (700, "Эксперт"), (300, "Практик"), (100, "Исследователь"), (0, "Новичок"))
MONTHLY_BONUS_CAP = 20

DEFAULT_MISSIONS = (
    {"code": "three-scenarios", "title": "Исследователь сценариев", "description": "Получите результаты в трёх разных сценариях", "criteria": {"kind": "distinct_templates", "target": 3}, "credits": 4, "xp": 0, "period": "lifetime", "order": 10},
    {"code": "multimodal", "title": "Три формата", "description": "Попробуйте текст, документ и изображение", "criteria": {"kind": "distinct_result_kinds", "target": 3, "values": ["text", "document", "image"]}, "credits": 5, "xp": 0, "period": "lifetime", "order": 20},
    {"code": "reuse-result", "title": "Продолжите работу", "description": "Повторно используйте готовый результат", "criteria": {"kind": "event_count", "event": "result_reused", "target": 1}, "credits": 3, "xp": 0, "period": "lifetime", "order": 30},
    {"code": "complete-project", "title": "Готовый процесс", "description": "Завершите многошаговый проект", "criteria": {"kind": "event_count", "event": "project_completed", "target": 1}, "credits": 5, "xp": 0, "period": "lifetime", "order": 40},
    {"code": "three-active-days", "title": "Неделя с AI-Sphere", "description": "Получите результаты в три разных дня месяца", "criteria": {"kind": "distinct_days", "target": 3}, "credits": 3, "xp": 0, "period": "monthly", "order": 50},
)

DEFAULT_SURVEYS = (
    {"code": "generation-failed", "title": "Что помешало завершить задачу?", "trigger": "generation_failed", "critical": True, "question": "Что было самым неудобным?", "options": ["Непонятная ошибка", "Слишком долго", "Не подошла модель", "Другое"]},
    {"code": "payment-abandoned", "title": "Что остановило оплату?", "trigger": "payment_returned", "critical": False, "question": "Почему вы не завершили оплату?", "options": ["Высокая цена", "Непонятны кредиты", "Нет удобного способа", "Не доверяю оплате", "Произошла ошибка", "Другое"]},
    {"code": "first-result", "title": "Первый результат", "trigger": "result_success", "critical": False, "question": "Насколько полезным оказался результат?", "options": ["Полезный", "Нужна доработка", "Не помог"]},
)


def level_for_xp(xp: int) -> str:
    return next(name for threshold, name in LEVELS if xp >= threshold)


def _period_key(period: str, now: datetime) -> str:
    return now.strftime("%Y-%m") if period == "monthly" else "lifetime"


async def _progress(db: AsyncSession, user_id: int, now: datetime) -> UserProgress:
    item = await db.get(UserProgress, user_id)
    month = now.strftime("%Y-%m")
    if item is None:
        item = UserProgress(user_id=user_id, bonus_month=month, updated_at=now)
        db.add(item)
        await db.flush()
    elif item.bonus_month != month:
        item.bonus_month = month
        item.monthly_bonus_credits = 0
    return item


async def _grant(
    db: AsyncSession, user: User, progress: UserProgress, reward_key: str,
    source_type: str, source_id: str, *, xp: int = 0, credits: int = 0,
) -> bool:
    credits = max(0, credits)
    if credits:
        high_risk = (await db.execute(select(func.count(FraudAlert.id)).where(
            FraudAlert.user_id == user.id, FraudAlert.risk_level.in_(("high", "critical")),
            FraudAlert.status.in_(("new", "investigating", "blocked")),
        ))).scalar() or 0
        if high_risk:
            # Credit rewards are delayed, not consumed. XP and achievements keep
            # working while the risk flag is reviewed.
            if xp:
                await _grant(
                    db, user, progress, f"{reward_key}:xp", source_type,
                    source_id, xp=xp, credits=0,
                )
            return False
    inserted = await db.execute(
        sqlite_insert(RewardLedger).values(
            reward_key=reward_key, user_id=user.id, source_type=source_type,
            source_id=source_id, xp_amount=0, credit_amount=0, detail_json="{}",
        ).on_conflict_do_nothing(index_elements=["reward_key"])
    )
    if inserted.rowcount != 1:
        return False
    granted_credits = 0
    if xp:
        new_xp = (await db.execute(
            update(UserProgress).where(UserProgress.user_id == user.id)
            .values(xp=UserProgress.xp + xp).returning(UserProgress.xp)
        )).scalar_one()
        progress.xp = new_xp
        progress.level = level_for_xp(new_xp)
    if credits:
        before = user.credits
        capped = await db.execute(
            update(UserProgress).where(
                UserProgress.user_id == user.id,
                UserProgress.monthly_bonus_credits + credits <= MONTHLY_BONUS_CAP,
            ).values(monthly_bonus_credits=UserProgress.monthly_bonus_credits + credits)
        )
        if capped.rowcount == 1:
            granted_credits = credits
        else:
            current = int((await db.execute(select(UserProgress.monthly_bonus_credits).where(UserProgress.user_id == user.id))).scalar_one())
            remaining = max(0, MONTHLY_BONUS_CAP - current)
            if remaining:
                partial = await db.execute(
                    update(UserProgress).where(
                        UserProgress.user_id == user.id,
                        UserProgress.monthly_bonus_credits == current,
                    ).values(monthly_bonus_credits=current + remaining)
                )
                granted_credits = remaining if partial.rowcount == 1 else 0
        if granted_credits:
            await db.execute(update(User).where(User.id == user.id).values(credits_bonus=User.credits_bonus + granted_credits))
            await db.refresh(progress)
            db.add(CreditOperation(
                user_id=user.id, op_type="bonus", credit_type="bonus", amount=granted_credits,
                balance_before=before, balance_after=before + granted_credits,
                source=f"mission:{source_id}", related_id=reward_key,
                comment="Игровая награда за освоение AI-Sphere",
            ))
    await db.execute(
        update(RewardLedger).where(RewardLedger.reward_key == reward_key)
        .values(xp_amount=xp, credit_amount=granted_credits)
    )
    return True


async def _award_achievement(db: AsyncSession, user_id: int, code: str) -> None:
    achievement = (await db.execute(select(Achievement).where(Achievement.code == code, Achievement.is_active == True))).scalar_one_or_none()
    if not achievement:
        return
    exists = (await db.execute(select(UserAchievement.id).where(
        UserAchievement.user_id == user_id, UserAchievement.achievement_id == achievement.id,
    ))).scalar_one_or_none()
    if not exists:
        await db.execute(
            sqlite_insert(UserAchievement).values(user_id=user_id, achievement_id=achievement.id)
            .on_conflict_do_nothing(index_elements=["user_id", "achievement_id"])
        )


async def process_product_event(
    db: AsyncSession, user: User | None, *, event_id: str, event_name: str,
    template_id: int | None, task_type: str, metadata: dict[str, str], now: datetime | None = None,
) -> None:
    if user is None or not settings.gamification_enabled:
        return
    now = now or datetime.now(timezone.utc)
    progress = await _progress(db, user.id, now)

    if event_name == "result_success":
        await _award_achievement(db, user.id, "first-result")
        day_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        daily_xp = (await db.execute(select(func.coalesce(func.sum(RewardLedger.xp_amount), 0)).where(
            RewardLedger.user_id == user.id, RewardLedger.source_type == "daily_result_xp",
            RewardLedger.created_at >= day_start,
        ))).scalar() or 0
        await _grant(db, user, progress, f"result:{user.id}:{event_id}", "daily_result_xp", event_id, xp=max(0, min(5, 25 - int(daily_xp))))
        if template_id:
            await _grant(db, user, progress, f"template-first:{user.id}:{template_id}", "first_template", str(template_id), xp=20)
        today = now.date()
        if progress.last_active_date != today:
            if progress.last_active_date == today - timedelta(days=1):
                progress.streak_days += 1
            else:
                progress.streak_days = 1
            progress.last_active_date = today
    elif event_name == "result_reused":
        await _grant(db, user, progress, f"reuse:{user.id}:{now.date().isoformat()}", "reuse_xp", event_id, xp=10)
    elif event_name == "project_completed":
        await _award_achievement(db, user.id, "project-master")
        await _grant(db, user, progress, f"project:{user.id}:{metadata.get('project_id', event_id)}", "project_xp", metadata.get("project_id", event_id), xp=50)

    missions = (await db.execute(select(Mission).where(Mission.is_active == True).order_by(Mission.sort_order))).scalars().all()
    for mission in missions:
        criteria = json.loads(mission.criteria_json or "{}")
        period_key = _period_key(mission.period, now)
        row = (await db.execute(select(UserMissionProgress).where(
            UserMissionProgress.user_id == user.id, UserMissionProgress.mission_id == mission.id,
            UserMissionProgress.period_key == period_key,
        ))).scalar_one_or_none()
        if row is None:
            await db.execute(
                sqlite_insert(UserMissionProgress).values(
                    user_id=user.id, mission_id=mission.id, period_key=period_key,
                    current_value=0, progress_json="{}",
                ).on_conflict_do_nothing(index_elements=["user_id", "mission_id", "period_key"])
            )
            row = (await db.execute(select(UserMissionProgress).where(
                UserMissionProgress.user_id == user.id, UserMissionProgress.mission_id == mission.id,
                UserMissionProgress.period_key == period_key,
            ))).scalar_one()
        if row.completed_at and row.rewarded_at:
            continue
        if row.completed_at:
            granted = await _grant(
                db, user, progress, f"mission:{user.id}:{mission.code}:{period_key}",
                "mission", mission.code, xp=mission.reward_xp, credits=mission.reward_credits,
            )
            if granted:
                row.rewarded_at = now
            continue
        state = json.loads(row.progress_json or "{}")
        kind = criteria.get("kind")
        if kind == "distinct_templates" and event_name == "result_success" and template_id:
            values = set(state.get("values", [])); values.add(str(template_id)); state["values"] = sorted(values); row.current_value = len(values)
        elif kind == "distinct_result_kinds" and event_name == "result_success":
            result_kind = metadata.get("result_kind") or task_type or "text"
            if result_kind in set(criteria.get("values", [])):
                values = set(state.get("values", [])); values.add(result_kind); state["values"] = sorted(values); row.current_value = len(values)
        elif kind == "event_count" and event_name == criteria.get("event"):
            row.current_value += 1
        elif kind == "distinct_days" and event_name == "result_success":
            values = set(state.get("values", [])); values.add(now.date().isoformat()); state["values"] = sorted(values); row.current_value = len(values)
        row.progress_json = json.dumps(state, ensure_ascii=False)
        if row.current_value >= int(criteria.get("target", 1)):
            row.completed_at = now
            granted = await _grant(
                db, user, progress, f"mission:{user.id}:{mission.code}:{period_key}",
                "mission", mission.code, xp=mission.reward_xp, credits=mission.reward_credits,
            )
            if granted:
                row.rewarded_at = now
            if mission.code == "three-scenarios":
                await _award_achievement(db, user.id, "explorer")
    progress.updated_at = now
