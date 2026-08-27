"""Product-growth APIs: cockpit analytics, journeys, campaigns, surveys and experiments."""

from __future__ import annotations

import hashlib
import json
import math
import statistics
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_admin
from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user, get_optional_user
from app.core.gamification import MONTHLY_BONUS_CAP, level_for_xp
from app.models.admin_log import AdminLog
from app.models.app_setting import AppSetting
from app.models.chat_message import ChatMessage
from app.models.credit_op import CreditOperation
from app.models.feedback import MessageFeedback
from app.models.payment_attempt import PaymentAttempt
from app.models.product_event import ProductEvent
from app.models.product_growth import (
    Achievement, Campaign, CampaignDelivery, Experiment, ExperimentAssignment,
    ExperimentVariant, Mission, RewardLedger, SavedSegment, Survey, SurveyQuestion,
    SurveyResponse, UserAchievement, UserMissionProgress, UserProgress,
)
from app.models.role import Role
from app.models.system_error import SystemError
from app.models.transaction import Transaction
from app.models.user import User
from app.models.user_query import UserQuery


router = APIRouter(prefix="/api", tags=["growth"])

# Only server-authored completion events are valid for the v2 baseline. The old
# browser-side ``first_result`` event is intentionally excluded so one task
# cannot be counted twice or forged by a client.
SUCCESS_EVENTS = {"result_success"}
FUNNEL_STAGES = (
    ("Посетили продукт", "landing_view"),
    ("Выбрали сценарий", "template_view"),
    ("Начали задачу", "task_started"),
    ("Получили результат", "result_success"),
    ("Открыли тарифы", "pricing_view"),
    ("Начали оплату", "checkout_started"),
    ("Успешно оплатили", "payment_succeeded"),
)


def _json(value: str | None, default: Any) -> Any:
    try:
        return json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return default


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _actor(event: ProductEvent) -> str:
    if event.user_id:
        return f"u:{event.user_id}"
    if event.anonymous_id:
        return f"a:{event.anonymous_id}"
    return f"e:{event.event_id}"


def _period(days: int, date_from: date | None, date_to: date | None) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    end = datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to else now
    start = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else end - timedelta(days=max(1, days))
    if start >= end:
        raise HTTPException(422, "Начало периода должно быть раньше окончания")
    return start, end


async def _baseline(db: AsyncSession) -> datetime:
    item = await db.get(AppSetting, "analytics_v2_baseline")
    if not item:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(item.value)
        return _aware(parsed) or datetime.min.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


async def _events(
    db: AsyncSession, start: datetime, end: datetime, *, source: str = "", device: str = "",
    template_id: int | None = None, model: str = "",
) -> list[ProductEvent]:
    start = max(start, await _baseline(db))
    query = select(ProductEvent).where(ProductEvent.created_at >= start, ProductEvent.created_at <= end)
    if source:
        query = query.where(ProductEvent.source == source)
    if device:
        query = query.where(ProductEvent.device_type == device)
    if template_id:
        query = query.where(ProductEvent.template_id == template_id)
    if model:
        query = query.where(ProductEvent.model == model)
    return list((await db.execute(query.order_by(ProductEvent.created_at, ProductEvent.id))).scalars().all())


def _group_events(events: list[ProductEvent]) -> dict[str, list[ProductEvent]]:
    grouped: dict[str, list[ProductEvent]] = defaultdict(list)
    anonymous_to_user: dict[str, int] = {}
    for event in events:
        if event.user_id and event.anonymous_id:
            anonymous_to_user[event.anonymous_id] = event.user_id
    for event in events:
        key = f"u:{anonymous_to_user[event.anonymous_id]}" if event.anonymous_id in anonymous_to_user else _actor(event)
        grouped[key].append(event)
    return grouped


def _ordered_conversion(actor_events: list[ProductEvent], stages: tuple[tuple[str, str], ...], window: timedelta) -> list[bool]:
    result: list[bool] = []
    cursor = 0
    started: datetime | None = None
    for _, event_name in stages:
        found = False
        for index in range(cursor, len(actor_events)):
            event = actor_events[index]
            name_matches = event.event_name == event_name
            if not name_matches:
                continue
            created = _aware(event.created_at)
            if started is None:
                started = created
            if started and created and created - started > window:
                break
            cursor = index + 1
            found = True
            break
        result.append(found)
        if not found:
            result.extend([False] * (len(stages) - len(result)))
            break
    return result


async def require_sensitive_admin(
    request: Request, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
) -> User:
    if admin.role_id is None:
        return admin
    role = await db.get(Role, admin.role_id)
    permissions = _json(role.permissions if role else "{}", {})
    if "r" not in str(permissions.get("analytics_sensitive", "")).lower():
        raise HTTPException(403, "Требуется право analytics_sensitive")
    return admin


class CampaignPayload(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    placement: str = Field(default="notification", pattern="^(banner|card|popup|notification)$")
    title: str = Field(min_length=2, max_length=255)
    body: str = Field(min_length=2, max_length=5000)
    button_text: str = Field(default="", max_length=100)
    button_url: str = Field(default="", max_length=500)
    segment_id: int | None = None
    audience: dict[str, Any] = {}
    frequency_cap: int = Field(default=1, ge=1, le=20)
    holdout_pct: int = Field(default=10, ge=0, le=50)
    goal_event: str = Field(default="payment_succeeded", max_length=50)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class SegmentPayload(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    filters: dict[str, Any] = {}


class SurveyAnswerPayload(BaseModel):
    question_id: int
    answer: str = Field(min_length=1, max_length=2000)
    anonymous_id: str = Field(default="", max_length=80)
    visit_session_id: str = Field(default="", max_length=80)


class ExperimentPayload(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    surface: str = Field(min_length=2, max_length=80)
    primary_metric: str = Field(default="activation", max_length=50)
    guardrails: list[str] = []
    variants: list[dict[str, Any]] = Field(min_length=2, max_length=5)


class MissionPayload(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    criteria: dict[str, Any]
    reward_credits: int = Field(default=0, ge=0, le=20)
    reward_xp: int = Field(default=0, ge=0, le=500)
    period: str = Field(default="lifetime", pattern="^(lifetime|monthly)$")
    is_active: bool = True
    sort_order: int = Field(default=100, ge=0, le=10000)


def _campaign_item(item: Campaign, stats: dict[str, int] | None = None) -> dict[str, Any]:
    return {
        "id": item.id, "name": item.name, "placement": item.placement, "title": item.title,
        "body": item.body, "button_text": item.button_text, "button_url": item.button_url,
        "segment_id": item.segment_id, "audience": _json(item.audience_json, {}), "status": item.status,
        "starts_at": item.starts_at.isoformat() if item.starts_at else None,
        "ends_at": item.ends_at.isoformat() if item.ends_at else None,
        "frequency_cap": item.frequency_cap, "holdout_pct": item.holdout_pct,
        "goal_event": item.goal_event, "stats": stats or {},
    }


def _matches_user(user: User | None, filters: dict[str, Any], progress: UserProgress | None = None) -> bool:
    if not filters:
        return True
    if user is None:
        return bool(filters.get("include_anonymous", False))
    if filters.get("user_ids") and user.id not in {int(value) for value in filters["user_ids"]}:
        return False
    if "paid" in filters and bool(user.total_paid_rub > 0) != bool(filters["paid"]):
        return False
    if user.request_count < int(filters.get("min_requests", 0)):
        return False
    if filters.get("max_requests") is not None and user.request_count > int(filters["max_requests"]):
        return False
    if filters.get("balance_lte") is not None and user.credits > int(filters["balance_lte"]):
        return False
    if filters.get("level") and (not progress or progress.level != filters["level"]):
        return False
    return True


async def _matches_user_full(db: AsyncSession, user: User | None, filters: dict[str, Any], progress: UserProgress | None = None) -> bool:
    if not _matches_user(user, filters, progress):
        return False
    if user is None:
        return True
    now = datetime.now(timezone.utc)
    event_conditions = [ProductEvent.user_id == user.id]
    if filters.get("active_within_days") is not None:
        event_conditions.append(ProductEvent.created_at >= now - timedelta(days=int(filters["active_within_days"])))
    if filters.get("task_type"):
        event_conditions.append(ProductEvent.task_type == str(filters["task_type"]))
    if filters.get("template_id"):
        event_conditions.append(ProductEvent.template_id == int(filters["template_id"]))
    if filters.get("source"):
        event_conditions.append(ProductEvent.source == str(filters["source"]))
    if filters.get("device"):
        event_conditions.append(ProductEvent.device_type == str(filters["device"]))
    if len(event_conditions) > 1 and not (await db.execute(select(ProductEvent.id).where(*event_conditions).limit(1))).scalar_one_or_none():
        return False
    if filters.get("has_generation_error") is not None:
        has_error = bool((await db.execute(select(ProductEvent.id).where(
            ProductEvent.user_id == user.id, ProductEvent.event_name == "generation_failed",
        ).limit(1))).scalar_one_or_none())
        if has_error != bool(filters["has_generation_error"]):
            return False
    if filters.get("inactive_days") is not None:
        recent = (await db.execute(select(ProductEvent.id).where(
            ProductEvent.user_id == user.id,
            ProductEvent.created_at >= now - timedelta(days=int(filters["inactive_days"])),
        ).limit(1))).scalar_one_or_none()
        if recent:
            return False
    if filters.get("payment_status"):
        paid = (await db.execute(select(PaymentAttempt.id).where(
            PaymentAttempt.user_id == user.id, PaymentAttempt.status == str(filters["payment_status"]),
        ).limit(1))).scalar_one_or_none()
        if not paid:
            return False
    if filters.get("mission_code"):
        mission = (await db.execute(select(Mission).where(Mission.code == str(filters["mission_code"])))).scalar_one_or_none()
        completed = mission and (await db.execute(select(UserMissionProgress.id).where(
            UserMissionProgress.user_id == user.id, UserMissionProgress.mission_id == mission.id,
            UserMissionProgress.completed_at.isnot(None),
        ).limit(1))).scalar_one_or_none()
        if not completed:
            return False
    return True


# ---- User engagement ----

@router.get("/progress")
async def get_progress(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    progress = await db.get(UserProgress, user.id)
    if progress is None:
        progress = UserProgress(user_id=user.id, bonus_month=datetime.now(timezone.utc).strftime("%Y-%m"))
        db.add(progress); await db.commit(); await db.refresh(progress)
    missions = (await db.execute(select(Mission).where(Mission.is_active == True).order_by(Mission.sort_order))).scalars().all()
    rows = (await db.execute(select(UserMissionProgress).where(UserMissionProgress.user_id == user.id))).scalars().all()
    by_mission: dict[int, UserMissionProgress] = {}
    for row in rows:
        if row.period_key in {"lifetime", datetime.now(timezone.utc).strftime("%Y-%m")}:
            by_mission[row.mission_id] = row
    achievements = (await db.execute(
        select(Achievement).join(UserAchievement, UserAchievement.achievement_id == Achievement.id).where(UserAchievement.user_id == user.id)
    )).scalars().all()
    return {
        "xp": progress.xp, "level": progress.level, "streak_days": progress.streak_days,
        "monthly_bonus_credits": progress.monthly_bonus_credits, "monthly_bonus_cap": MONTHLY_BONUS_CAP,
        "missions": [{
            "id": mission.id, "code": mission.code, "title": mission.title, "description": mission.description,
            "target": int(_json(mission.criteria_json, {}).get("target", 1)),
            "current": by_mission.get(mission.id).current_value if mission.id in by_mission else 0,
            "completed": bool(mission.id in by_mission and by_mission[mission.id].completed_at),
            "reward_credits": mission.reward_credits, "reward_xp": mission.reward_xp,
        } for mission in missions],
        "achievements": [{"code": item.code, "title": item.title, "description": item.description, "icon": item.icon} for item in achievements],
    }


@router.get("/engagement/campaigns")
async def active_campaigns(
    anonymous_id: str = Query("", max_length=80), user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db),
):
    if not settings.campaigns_enabled:
        return []
    now = datetime.now(timezone.utc)
    query = select(Campaign).where(Campaign.status == "active", or_(Campaign.starts_at.is_(None), Campaign.starts_at <= now), or_(Campaign.ends_at.is_(None), Campaign.ends_at >= now))
    campaigns = (await db.execute(query.order_by(Campaign.id))).scalars().all()
    progress = await db.get(UserProgress, user.id) if user else None
    result = []
    identity = f"u:{user.id}" if user else f"a:{anonymous_id}"
    for campaign in campaigns:
        audience = _json(campaign.audience_json, {})
        if campaign.segment_id:
            segment = await db.get(SavedSegment, campaign.segment_id)
            audience = _json(segment.filters_json, {}) if segment else audience
        if not await _matches_user_full(db, user, audience, progress):
            continue
        delivery_key = f"{campaign.id}:{identity}"
        delivery = (await db.execute(select(CampaignDelivery).where(CampaignDelivery.delivery_key == delivery_key))).scalar_one_or_none()
        if delivery is None:
            bucket = int(hashlib.sha256(delivery_key.encode()).hexdigest()[:8], 16) % 100
            delivery = CampaignDelivery(
                delivery_key=delivery_key, campaign_id=campaign.id, user_id=user.id if user else None,
                anonymous_id=anonymous_id, is_holdout=bucket < campaign.holdout_pct,
            )
            db.add(delivery); await db.flush()
        if delivery.is_holdout or delivery.dismissed_at or delivery.impression_count >= campaign.frequency_cap:
            continue
        result.append({**_campaign_item(campaign), "delivery_id": delivery.id})
    await db.commit()
    return result


@router.post("/engagement/campaigns/{delivery_id}/{action}")
async def campaign_action(
    delivery_id: int, action: str, anonymous_id: str = Query("", max_length=80),
    user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db),
):
    if action not in {"shown", "opened", "clicked", "dismissed"}:
        raise HTTPException(422, "Неизвестное действие")
    delivery = await db.get(CampaignDelivery, delivery_id)
    if not delivery or (delivery.user_id and (not user or delivery.user_id != user.id)) or (not delivery.user_id and delivery.anonymous_id != anonymous_id):
        raise HTTPException(404)
    now = datetime.now(timezone.utc)
    if action == "shown":
        campaign = await db.get(Campaign, delivery.campaign_id)
        if campaign and delivery.impression_count >= campaign.frequency_cap:
            return {"ok": True, "capped": True}
        delivery.impression_count += 1; delivery.first_shown_at = delivery.first_shown_at or now; delivery.last_shown_at = now
    else:
        setattr(delivery, f"{action}_at", now)
    await db.commit()
    return {"ok": True}


@router.get("/engagement/surveys")
async def eligible_surveys(
    trigger_event: str = "", anonymous_id: str = "", user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db),
):
    if not settings.campaigns_enabled:
        return []
    query = select(Survey).where(Survey.status == "active")
    if trigger_event:
        query = query.where(Survey.trigger_event == trigger_event)
    surveys = (await db.execute(query.order_by(Survey.id))).scalars().all()
    result = []
    now = datetime.now(timezone.utc)
    for survey in surveys:
        cutoff = now - timedelta(days=survey.frequency_days)
        previous = select(func.count(SurveyResponse.id)).where(SurveyResponse.survey_id == survey.id, SurveyResponse.created_at >= cutoff)
        previous = previous.where(SurveyResponse.user_id == user.id) if user else previous.where(SurveyResponse.anonymous_id == anonymous_id)
        if not survey.is_critical and (await db.execute(previous)).scalar():
            continue
        questions = (await db.execute(select(SurveyQuestion).where(SurveyQuestion.survey_id == survey.id).order_by(SurveyQuestion.sort_order))).scalars().all()
        result.append({"id": survey.id, "code": survey.code, "title": survey.title, "trigger_event": survey.trigger_event, "is_critical": survey.is_critical,
            "questions": [{"id": q.id, "prompt": q.prompt, "type": q.question_type, "options": _json(q.options_json, [])} for q in questions]})
    return result


@router.post("/engagement/surveys/{survey_id}/responses")
async def answer_survey(
    survey_id: int, payload: SurveyAnswerPayload, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db),
):
    question = await db.get(SurveyQuestion, payload.question_id)
    if not question or question.survey_id != survey_id:
        raise HTTPException(404)
    survey = await db.get(Survey, survey_id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=survey.frequency_days if survey else 14)
    duplicate = select(SurveyResponse.id).where(SurveyResponse.survey_id == survey_id, SurveyResponse.created_at >= cutoff)
    duplicate = duplicate.where(SurveyResponse.user_id == user.id) if user else duplicate.where(SurveyResponse.anonymous_id == payload.anonymous_id)
    if (await db.execute(duplicate.limit(1))).scalar_one_or_none():
        raise HTTPException(409, "Опрос уже пройден")
    db.add(SurveyResponse(survey_id=survey_id, question_id=question.id, user_id=user.id if user else None,
        anonymous_id=payload.anonymous_id, visit_session_id=payload.visit_session_id, answer=payload.answer.strip()))
    await db.commit()
    return {"ok": True}


@router.get("/experiments/assignments")
async def experiment_assignments(
    surface: str, anonymous_id: str = Query("", max_length=80), user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db),
):
    if not settings.experiments_enabled:
        return {"surface": surface, "assignment": None}
    experiment = (await db.execute(select(Experiment).where(Experiment.surface == surface, Experiment.status == "active").order_by(desc(Experiment.id)))).scalar_one_or_none()
    if not experiment:
        return {"surface": surface, "assignment": None}
    identity = f"u:{user.id}" if user else f"a:{anonymous_id}"
    if identity == "a:":
        raise HTTPException(422, "anonymous_id обязателен")
    assignment_key = f"{experiment.id}:{identity}"
    assignment = (await db.execute(select(ExperimentAssignment).where(ExperimentAssignment.assignment_key == assignment_key))).scalar_one_or_none()
    migrated_assignment = False
    if assignment is None and user and anonymous_id:
        anonymous_key = f"{experiment.id}:a:{anonymous_id}"
        assignment = (await db.execute(select(ExperimentAssignment).where(ExperimentAssignment.assignment_key == anonymous_key))).scalar_one_or_none()
        if assignment:
            assignment.assignment_key = assignment_key
            assignment.user_id = user.id
            migrated_assignment = True
    variants = (await db.execute(select(ExperimentVariant).where(ExperimentVariant.experiment_id == experiment.id).order_by(ExperimentVariant.id))).scalars().all()
    if not variants:
        return {"surface": surface, "assignment": None}
    if assignment is None:
        bucket = (int(hashlib.sha256(assignment_key.encode()).hexdigest()[:12], 16) % 1_000_000) / 1_000_000
        total = sum(max(0, item.weight) for item in variants) or len(variants)
        cursor = 0.0; chosen = variants[-1]
        for variant in variants:
            cursor += (max(0, variant.weight) or (1 / len(variants))) / total
            if bucket <= cursor:
                chosen = variant; break
        assignment = ExperimentAssignment(assignment_key=assignment_key, experiment_id=experiment.id, variant_id=chosen.id,
            user_id=user.id if user else None, anonymous_id=anonymous_id)
        db.add(assignment); await db.commit(); await db.refresh(assignment)
    elif migrated_assignment:
        await db.commit()
    variant = next(item for item in variants if item.id == assignment.variant_id)
    return {"surface": surface, "assignment": {"experiment_id": experiment.id, "variant_id": variant.id, "variant_key": variant.key, "payload": _json(variant.payload_json, {}), "exposed": bool(assignment.exposed_at)}}


@router.post("/experiments/assignments/{experiment_id}/expose")
async def expose_experiment(
    experiment_id: int, anonymous_id: str = "", user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db),
):
    identity = f"u:{user.id}" if user else f"a:{anonymous_id}"
    assignment = (await db.execute(select(ExperimentAssignment).where(ExperimentAssignment.assignment_key == f"{experiment_id}:{identity}"))).scalar_one_or_none()
    if not assignment:
        raise HTTPException(404)
    assignment.exposed_at = assignment.exposed_at or datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


# ---- Admin analytics ----

@router.get("/admin/growth/overview")
async def growth_overview(
    days: int = Query(30, ge=1, le=366), date_from: date | None = None, date_to: date | None = None,
    source: str = "", device: str = "", template_id: int | None = None, model: str = "",
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    start, end = _period(days, date_from, date_to)
    start = max(start, await _baseline(db))
    events = await _events(db, start, end, source=source, device=device, template_id=template_id, model=model)
    grouped = _group_events(events)
    visitors = len(grouped)
    registrations = int((await db.execute(select(func.count(User.id)).where(User.created_at >= start, User.created_at <= end, User.is_admin == False))).scalar() or 0)
    successful = [event for event in events if event.event_name in SUCCESS_EVENTS]
    task_starts = [event for event in events if event.event_name == "task_started"]
    failures = [
        event for event in events
        if event.event_name == "generation_failed" and _json(event.metadata_json, {}).get("_authoritative") is True
    ]
    activated: set[str] = set(); activation_times: list[float] = []
    for actor, actor_events in grouped.items():
        first = _aware(actor_events[0].created_at)
        success = next((_aware(item.created_at) for item in actor_events if item.event_name in SUCCESS_EVENTS), None)
        if first and success and success - first <= timedelta(hours=24):
            activated.add(actor); activation_times.append((success - first).total_seconds())
    pay_rows = (await db.execute(select(Transaction).where(Transaction.type == "topup", Transaction.created_at >= start, Transaction.created_at <= end))).scalars().all()
    payers = {item.user_id for item in pay_rows}
    payment_counts: dict[int, int] = defaultdict(int)
    for item in pay_rows: payment_counts[item.user_id] += 1
    revenue_kop = sum(item.rub_amount for item in pay_rows)
    model_cost_usd = float((await db.execute(select(func.coalesce(func.sum(ChatMessage.cost_or), 0)).where(ChatMessage.created_at >= start, ChatMessage.created_at <= end))).scalar() or 0)
    # OpenRouter costs are stored in USD cents; use the configured operational conversion only for display.
    estimated_cost_rub = round(model_cost_usd * 0.01 * 90, 2)
    revenue_rub = revenue_kop / 100
    now = datetime.now(timezone.utc)
    async def active_since(delta: timedelta) -> int:
        rows = await db.execute(select(ProductEvent.user_id, ProductEvent.anonymous_id).where(ProductEvent.event_name.in_(SUCCESS_EVENTS), ProductEvent.created_at >= now - delta))
        return len({f"u:{u}" if u else f"a:{a}" for u, a in rows.all() if u or a})
    retention = await _retention_rates(db, end, await _baseline(db))
    negative = int((await db.execute(select(func.count(MessageFeedback.id)).where(MessageFeedback.feedback_type == "dislike", MessageFeedback.created_at >= start))).scalar() or 0)
    pending_failed = int((await db.execute(select(func.count(PaymentAttempt.id)).where(PaymentAttempt.status.in_(("pending", "failed")), PaymentAttempt.created_at >= start))).scalar() or 0)
    failure_rate = round(len(failures) / max(len(task_starts), 1) * 100, 1)
    alerts = []
    if failure_rate >= 10: alerts.append({"severity": "high", "title": "Высокая доля ошибок генерации", "value": f"{failure_rate}%", "target": "blockers:generation_failed"})
    if pending_failed: alerts.append({"severity": "high", "title": "Незавершённые оплаты", "value": pending_failed, "target": "blockers:payment_failed"})
    if negative: alerts.append({"severity": "medium", "title": "Негативные оценки", "value": negative, "target": "feedback"})
    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()}, "freshness": max((_aware(e.created_at) for e in events), default=None),
        "sample_size": visitors, "sample_warning": visitors < 50,
        "metrics": {
            "unique_visitors": visitors, "registrations": registrations,
            "activation_24h_pct": round(len(activated) / max(visitors, 1) * 100, 1),
            "activated_users": len(activated), "median_time_to_value_seconds": round(statistics.median(activation_times)) if activation_times else None,
            "successful_tasks": len(successful), "task_failure_pct": failure_rate,
            "dau": await active_since(timedelta(days=1)), "wau": await active_since(timedelta(days=7)), "mau": await active_since(timedelta(days=30)),
            "paying_users": len(payers), "revenue_rub": round(revenue_rub, 2), "model_cost_rub_estimate": estimated_cost_rub,
            "gross_margin_pct_estimate": round((revenue_rub - estimated_cost_rub) / revenue_rub * 100, 1) if revenue_rub else 0,
            "first_payment_users": sum(1 for count in payment_counts.values() if count >= 1), "repeat_payment_users": sum(1 for count in payment_counts.values() if count >= 2),
            **retention,
        },
        "alerts": alerts,
    }


async def _retention_rates(db: AsyncSession, end: datetime, baseline: datetime) -> dict[str, float | int]:
    users = (await db.execute(select(User.id, User.created_at).where(User.is_admin == False, User.created_at >= baseline, User.created_at <= end - timedelta(days=1)))).all()
    result: dict[str, float | int] = {}
    for label, day in (("d1", 1), ("d7", 7), ("d30", 30)):
        eligible = [(uid, _aware(created)) for uid, created in users if _aware(created) and _aware(created) <= end - timedelta(days=day + 1)]
        retained = 0
        for uid, created in eligible:
            count = (await db.execute(select(func.count(ProductEvent.id)).where(
                ProductEvent.user_id == uid, ProductEvent.event_name.in_(SUCCESS_EVENTS),
                ProductEvent.created_at >= created + timedelta(days=day), ProductEvent.created_at < created + timedelta(days=day + 1),
            ))).scalar() or 0
            retained += int(count > 0)
        result[f"retention_{label}_pct"] = round(retained / max(len(eligible), 1) * 100, 1)
        result[f"retention_{label}_sample"] = len(eligible)
    return result


@router.get("/admin/growth/funnel")
async def growth_funnel(
    days: int = Query(30, ge=1, le=366), source: str = "", device: str = "", template_id: int | None = None, model: str = "",
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    start, end = _period(days, None, None)
    start = max(start, await _baseline(db))
    grouped = _group_events(await _events(db, start, end, source=source, device=device, template_id=template_id, model=model))
    counts = [0] * len(FUNNEL_STAGES)
    for actor_events in grouped.values():
        converted = _ordered_conversion(actor_events, FUNNEL_STAGES, timedelta(days=7))
        for index, value in enumerate(converted): counts[index] += int(value)
    stages = []
    for index, ((label, event), count) in enumerate(zip(FUNNEL_STAGES, counts)):
        previous = counts[index - 1] if index else count
        stages.append({"stage": label, "event": event, "users": count, "conversion_pct": round(count / max(previous, 1) * 100, 1), "dropped": max(0, previous - count) if index else 0})
    return {"stages": stages, "window_days": 7, "unique_actors": len(grouped)}


def _blocker_for(actor_events: list[ProductEvent]) -> str | None:
    names = [item.event_name for item in actor_events]
    if "landing_view" in names and "template_view" not in names and "input_started" not in names: return "unclear_start"
    if "template_view" in names and "task_started" not in names and "auth_prompted" not in names: return "template_no_submit"
    if "auth_prompted" in names and "auth_completed" not in names: return "auth_abandoned"
    if "estimate_viewed" in names and "task_started" not in names: return "price_friction"
    if "generation_failed" in names and not any(name in SUCCESS_EVENTS for name in names): return "generation_failed"
    if names.count("result_reused") >= 2 or any(item.event_name == "result_feedback" and _json(item.metadata_json, {}).get("status") == "dislike" for item in actor_events): return "result_unsatisfactory"
    if "balance_low" in names and "plan_selected" not in names: return "credits_unclear"
    if "pricing_view" in names and "checkout_started" not in names: return "pricing_abandoned"
    if "checkout_started" in names and "payment_succeeded" not in names: return "payment_abandoned"
    return None


BLOCKER_LABELS = {
    "unclear_start": "Не понял, что делать", "template_no_submit": "Выбрал сценарий, но не отправил",
    "auth_abandoned": "Остановился на авторизации", "price_friction": "Испугала стоимость",
    "generation_failed": "Не получил результат", "result_unsatisfactory": "Результат не устроил",
    "credits_unclear": "Не понял кредиты", "pricing_abandoned": "Не начал оплату",
    "payment_abandoned": "Не завершил оплату",
}


@router.get("/admin/growth/blockers")
async def growth_blockers(days: int = Query(30, ge=1, le=366), _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    start, end = _period(days, None, None)
    start = max(start, await _baseline(db))
    grouped = _group_events(await _events(db, start, end))
    buckets: dict[str, dict[str, Any]] = {code: {"actors": [], "sources": defaultdict(int), "devices": defaultdict(int), "templates": defaultdict(int)} for code in BLOCKER_LABELS}
    for actor, actor_events in grouped.items():
        code = _blocker_for(actor_events)
        if not code: continue
        bucket = buckets[code]; bucket["actors"].append(actor)
        for item in actor_events:
            if item.source: bucket["sources"][item.source] += 1
            if item.device_type: bucket["devices"][item.device_type] += 1
            if item.template_id: bucket["templates"][str(item.template_id)] += 1
    failed_attempts = (await db.execute(select(PaymentAttempt).where(PaymentAttempt.created_at >= start, PaymentAttempt.status.in_(("pending", "failed"))))).scalars().all()
    return [{
        "code": code, "label": BLOCKER_LABELS[code], "users": len(data["actors"]),
        "share_pct": round(len(data["actors"]) / max(len(grouped), 1) * 100, 1),
        "revenue_at_risk_rub": round(sum(item.amount_kopecks for item in failed_attempts) / 100, 2) if code == "payment_abandoned" else None,
        "top_sources": sorted(data["sources"].items(), key=lambda x: x[1], reverse=True)[:3],
        "top_devices": sorted(data["devices"].items(), key=lambda x: x[1], reverse=True)[:3],
        "top_templates": sorted(data["templates"].items(), key=lambda x: x[1], reverse=True)[:3],
    } for code, data in buckets.items()]


@router.get("/admin/growth/blockers/{code}/users")
async def blocker_users(code: str, days: int = 30, _=Depends(require_sensitive_admin), db: AsyncSession = Depends(get_db)):
    if code not in BLOCKER_LABELS: raise HTTPException(404)
    start, end = _period(days, None, None); grouped = _group_events(await _events(db, start, end))
    user_ids = [int(actor.split(":", 1)[1]) for actor, events in grouped.items() if actor.startswith("u:") and _blocker_for(events) == code]
    users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all() if user_ids else []
    return [{"id": item.id, "email": item.email, "credits": item.credits, "requests": item.request_count, "last_seen": item.last_seen.isoformat() if item.last_seen else None} for item in users]


@router.get("/admin/growth/journeys/{user_id}")
async def user_journey(user_id: int, request: Request, admin: User = Depends(require_sensitive_admin), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user: raise HTTPException(404)
    timeline: list[dict[str, Any]] = []
    events = (await db.execute(select(ProductEvent).where(ProductEvent.user_id == user_id).order_by(ProductEvent.created_at))).scalars().all()
    for item in events:
        timeline.append({"at": item.created_at.isoformat(), "type": "event", "name": item.event_name, "detail": {"page": item.page, "source": item.source, "device": item.device_type, "template_id": item.template_id, "model": item.model, "metadata": _json(item.metadata_json, {})}})
    queries = (await db.execute(select(UserQuery).where(UserQuery.user_id == user_id))).scalars().all()
    for item in queries: timeline.append({"at": item.created_at.isoformat(), "type": "query", "name": "Запрос пользователя", "detail": {"content": item.content, "model": item.model, "session_id": item.session_id}})
    messages = (await db.execute(select(ChatMessage).where(ChatMessage.user_id == user_id, ChatMessage.role == "assistant"))).scalars().all()
    for item in messages: timeline.append({"at": item.created_at.isoformat(), "type": "response", "name": "Ответ модели", "detail": {"content": item.content, "model": item.model, "error": item.error, "credits": item.credits_spent}})
    operations = (await db.execute(select(CreditOperation).where(CreditOperation.user_id == user_id))).scalars().all()
    for item in operations: timeline.append({"at": item.created_at.isoformat(), "type": "credits", "name": item.op_type, "detail": {"amount": item.amount, "balance_after": item.balance_after, "comment": item.comment}})
    attempts = (await db.execute(select(PaymentAttempt).where(PaymentAttempt.user_id == user_id))).scalars().all()
    for item in attempts: timeline.append({"at": item.created_at.isoformat(), "type": "payment", "name": item.status, "detail": {"amount_rub": item.amount_kopecks / 100, "credits": item.credits, "error": item.failure_reason}})
    responses = (await db.execute(select(SurveyResponse).where(SurveyResponse.user_id == user_id))).scalars().all()
    for item in responses: timeline.append({"at": item.created_at.isoformat(), "type": "survey", "name": "Ответ на опрос", "detail": {"survey_id": item.survey_id, "answer": item.answer}})
    rewards = (await db.execute(select(RewardLedger).where(RewardLedger.user_id == user_id))).scalars().all()
    for item in rewards: timeline.append({"at": item.created_at.isoformat(), "type": "reward", "name": item.source_type, "detail": {"xp": item.xp_amount, "credits": item.credit_amount, "source": item.source_id}})
    db.add(AdminLog(admin_id=admin.id, action="GET sensitive journey", target_type="user", target_id=str(user_id), ip=request.client.host if request.client else None, result="success", detail="Opened complete product journey with prompts"))
    await db.commit()
    timeline.sort(key=lambda item: item["at"])
    return {"user": {"id": user.id, "email": user.email, "name": user.name, "credits": user.credits, "registered_by": user.registered_by, "source": user.reg_source, "created_at": user.created_at.isoformat()}, "timeline": timeline}


# ---- Admin segments and campaigns ----

async def _segment_size(db: AsyncSession, filters: dict[str, Any]) -> int:
    users = (await db.execute(select(User).where(User.is_admin == False))).scalars().all()
    result = 0
    for user in users:
        progress = await db.get(UserProgress, user.id)
        result += int(await _matches_user_full(db, user, filters, progress))
    return result


@router.get("/admin/growth/segments")
async def list_segments(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SavedSegment).order_by(desc(SavedSegment.id)))).scalars().all()
    return [{"id": row.id, "name": row.name, "description": row.description, "filters": _json(row.filters_json, {}), "is_active": row.is_active, "size": await _segment_size(db, _json(row.filters_json, {}))} for row in rows]


@router.post("/admin/growth/segments")
async def create_segment(payload: SegmentPayload, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    item = SavedSegment(name=payload.name, description=payload.description, filters_json=json.dumps(payload.filters, ensure_ascii=False), created_by=admin.id)
    db.add(item); await db.commit(); await db.refresh(item)
    return {"id": item.id, "size": await _segment_size(db, payload.filters)}


@router.get("/admin/growth/campaigns")
async def list_campaigns(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Campaign).order_by(desc(Campaign.id)))).scalars().all(); result = []
    for row in rows:
        deliveries = (await db.execute(select(CampaignDelivery).where(CampaignDelivery.campaign_id == row.id))).scalars().all()
        result.append(_campaign_item(row, {"assigned": len(deliveries), "holdout": sum(d.is_holdout for d in deliveries), "shown": sum(d.impression_count > 0 for d in deliveries), "clicked": sum(bool(d.clicked_at) for d in deliveries), "dismissed": sum(bool(d.dismissed_at) for d in deliveries), "converted": sum(bool(d.converted_at) for d in deliveries)}))
    return result


@router.post("/admin/growth/campaigns")
async def create_campaign(payload: CampaignPayload, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if payload.segment_id and not await db.get(SavedSegment, payload.segment_id): raise HTTPException(404, "Сегмент не найден")
    item = Campaign(name=payload.name, placement=payload.placement, title=payload.title, body=payload.body,
        button_text=payload.button_text, button_url=payload.button_url, segment_id=payload.segment_id,
        audience_json=json.dumps(payload.audience, ensure_ascii=False), frequency_cap=payload.frequency_cap,
        holdout_pct=payload.holdout_pct, goal_event=payload.goal_event, starts_at=payload.starts_at,
        ends_at=payload.ends_at, status="draft", created_by=admin.id, updated_at=datetime.now(timezone.utc))
    db.add(item); await db.commit(); await db.refresh(item); return _campaign_item(item)


@router.post("/admin/growth/campaigns/{campaign_id}/{action}")
async def set_campaign_status(campaign_id: int, action: str, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if action not in {"activate", "pause", "stop"}: raise HTTPException(422)
    item = await db.get(Campaign, campaign_id)
    if not item: raise HTTPException(404)
    item.status = {"activate": "active", "pause": "paused", "stop": "completed"}[action]
    item.starts_at = item.starts_at or (datetime.now(timezone.utc) if action == "activate" else item.starts_at)
    item.updated_at = datetime.now(timezone.utc); await db.commit(); return _campaign_item(item)


# ---- Admin missions, surveys and experiments ----

@router.get("/admin/growth/missions")
async def list_missions(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    missions = (await db.execute(select(Mission).order_by(Mission.sort_order))).scalars().all(); result=[]
    for item in missions:
        total = int((await db.execute(select(func.count(UserMissionProgress.id)).where(UserMissionProgress.mission_id == item.id))).scalar() or 0)
        completed = int((await db.execute(select(func.count(UserMissionProgress.id)).where(UserMissionProgress.mission_id == item.id, UserMissionProgress.completed_at.isnot(None)))).scalar() or 0)
        rewards = int((await db.execute(select(func.coalesce(func.sum(RewardLedger.credit_amount), 0)).where(RewardLedger.source_type == "mission", RewardLedger.source_id == item.code))).scalar() or 0)
        result.append({"id": item.id, "code": item.code, "title": item.title, "description": item.description, "criteria": _json(item.criteria_json, {}), "reward_credits": item.reward_credits, "reward_xp": item.reward_xp, "period": item.period, "is_active": item.is_active, "sort_order": item.sort_order, "started": total, "completed": completed, "completion_pct": round(completed/max(total,1)*100,1), "credits_awarded": rewards})
    return result


@router.put("/admin/growth/missions/{mission_id}")
async def update_mission(mission_id: int, payload: MissionPayload, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    item = await db.get(Mission, mission_id)
    if not item: raise HTTPException(404)
    for key, value in payload.model_dump(exclude={"criteria"}).items(): setattr(item, key, value)
    item.criteria_json = json.dumps(payload.criteria, ensure_ascii=False); await db.commit(); return {"ok": True}


@router.get("/admin/growth/surveys")
async def survey_admin(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    surveys = (await db.execute(select(Survey).order_by(Survey.id))).scalars().all(); result=[]
    for survey in surveys:
        questions = (await db.execute(select(SurveyQuestion).where(SurveyQuestion.survey_id == survey.id))).scalars().all()
        responses = (await db.execute(select(SurveyResponse).where(SurveyResponse.survey_id == survey.id))).scalars().all()
        counts: dict[str,int]=defaultdict(int)
        for response in responses: counts[response.answer]+=1
        result.append({"id": survey.id, "code": survey.code, "title": survey.title, "trigger_event": survey.trigger_event, "status": survey.status, "is_critical": survey.is_critical, "frequency_days": survey.frequency_days, "questions": [{"id": q.id, "prompt": q.prompt, "options": _json(q.options_json, [])} for q in questions], "responses": len(responses), "answers": sorted(counts.items(), key=lambda x:x[1], reverse=True)})
    return result


@router.get("/admin/growth/experiments")
async def list_experiments(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    experiments = (await db.execute(select(Experiment).order_by(desc(Experiment.id)))).scalars().all(); result=[]
    for experiment in experiments:
        variants = (await db.execute(select(ExperimentVariant).where(ExperimentVariant.experiment_id == experiment.id))).scalars().all()
        variant_rows=[]
        for variant in variants:
            assignments = (await db.execute(select(ExperimentAssignment).where(ExperimentAssignment.variant_id == variant.id))).scalars().all()
            exposed = [a for a in assignments if a.exposed_at]
            actor_users = {a.user_id for a in exposed if a.user_id}
            conversions = 0
            if actor_users:
                conversions = int((await db.execute(select(func.count(func.distinct(ProductEvent.user_id))).where(ProductEvent.user_id.in_(actor_users), ProductEvent.event_name == ("payment_succeeded" if experiment.primary_metric == "payment" else "result_success"), ProductEvent.created_at >= (experiment.started_at or experiment.created_at)))).scalar() or 0)
            enough = len(exposed) >= 200 and conversions >= 20
            variant_rows.append({"id": variant.id, "key": variant.key, "name": variant.name, "payload": _json(variant.payload_json, {}), "weight": variant.weight, "assigned": len(assignments), "exposed": len(exposed), "conversions": conversions, "conversion_pct": round(conversions/max(len(exposed),1)*100,1), "enough_data": enough})
        result.append({"id": experiment.id, "name": experiment.name, "surface": experiment.surface, "status": experiment.status, "primary_metric": experiment.primary_metric, "winner_variant_id": experiment.winner_variant_id, "started_at": experiment.started_at.isoformat() if experiment.started_at else None, "variants": variant_rows})
    return result


@router.post("/admin/growth/experiments")
async def create_experiment(payload: ExperimentPayload, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if (await db.execute(select(Experiment.id).where(Experiment.surface == payload.surface, Experiment.status == "active"))).scalar_one_or_none():
        raise HTTPException(409, "На этой поверхности уже запущен эксперимент")
    item = Experiment(name=payload.name, surface=payload.surface, primary_metric=payload.primary_metric, guardrails_json=json.dumps(payload.guardrails, ensure_ascii=False), status="draft", created_by=admin.id)
    db.add(item); await db.flush()
    total_weight = sum(float(v.get("weight", 0)) for v in payload.variants)
    for index, value in enumerate(payload.variants):
        db.add(ExperimentVariant(experiment_id=item.id, key=str(value.get("key", chr(65+index)))[:40], name=str(value.get("name", f"Вариант {index+1}"))[:100], payload_json=json.dumps(value.get("payload", {}), ensure_ascii=False), weight=float(value.get("weight", 1/len(payload.variants))) / (total_weight or 1)))
    await db.commit(); return {"id": item.id}


@router.post("/admin/growth/experiments/{experiment_id}/{action}")
async def experiment_action(experiment_id: int, action: str, winner_variant_id: int | None = None, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if action not in {"start", "stop", "winner"}: raise HTTPException(422)
    item = await db.get(Experiment, experiment_id)
    if not item: raise HTTPException(404)
    if action == "start":
        active = (await db.execute(select(Experiment.id).where(Experiment.surface == item.surface, Experiment.status == "active", Experiment.id != item.id))).scalar_one_or_none()
        if active: raise HTTPException(409, "На этой поверхности уже запущен эксперимент")
        item.status = "active"; item.started_at = datetime.now(timezone.utc)
    elif action == "stop": item.status = "completed"; item.ended_at = datetime.now(timezone.utc)
    else:
        variant = await db.get(ExperimentVariant, winner_variant_id) if winner_variant_id else None
        if not variant or variant.experiment_id != item.id: raise HTTPException(422, "Некорректный победитель")
        item.winner_variant_id = variant.id; item.status = "completed"; item.ended_at = datetime.now(timezone.utc)
    await db.commit(); return {"ok": True, "status": item.status}
