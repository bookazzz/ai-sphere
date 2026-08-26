"""Admin API вЂ” unified admin panel for AI-Sphere.

Covers MVP (СЌС‚Р°Рї 1): roles, dashboard, users, models, tariffs,
payments, credit operations, logs, system errors.
"""

import asyncio
import json
from urllib.parse import urljoin
from datetime import datetime, timedelta, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select, desc, func, or_, and_, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.models.promo import PromoCode
from app.models.role import Role
from app.models.ai_model import AiModel
from app.models.credit_plan import CreditPlan
from app.models.credit_op import CreditOperation
from app.models.admin_log import AdminLog
from app.models.system_error import SystemError
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.user_query import UserQuery
from app.models.feedback import MessageFeedback, UserFeedback, FeedbackReply
from app.models.app_setting import AppSetting
from app.models.payment_attempt import PaymentAttempt
from app.models.generation_job import GenerationJob
from app.models.product_event import ProductEvent
from app.models.file_record import FileRecord
from app.models.support_ticket import SupportTicket, TicketMessage
from app.models.notification import Notification
from app.models.fraud_alert import FraudAlert
from app.models.seo_page import SeoPage
from app.models.referral import ReferralPartner, ReferralTransaction
from app.core.sanitization import sanitize_rich_content
from app.core.config import settings
from app.core.economics import (
    PricingContext, achieved_margin, credits_for_provider_cost, pricing_context,
    provider_cost_from_snapshot, text_prices, text_task_metrics,
)
from app.models.task_template import TaskTemplate
from app.schemas.auth import LoginRequest, AuthResponse, UserInfo
from app.core.security import create_access_token, password_needs_rehash, hash_password, verify_password
from app.api.auth import _set_auth_cookie

router = APIRouter(prefix="/api/admin", tags=["admin"])

OPENROUTER_CATALOGUES = (
    ("/models?output_modalities=all", None),
    ("/images/models", "image"),
    ("/videos/models", "video"),
)


def _merge_openrouter_catalog_item(
    discovered: dict[str, dict], item: dict, forced_output: str | None = None,
) -> None:
    """Merge a model from one of OpenRouter's modality-specific catalogues."""
    model_id = item.get("id") or item.get("canonical_slug")
    if not model_id:
        return

    normalized = dict(item)
    if forced_output:
        architecture = dict(normalized.get("architecture") or {})
        inputs = list(
            architecture.get("input_modalities")
            or normalized.get("input_modalities")
            or ["text"]
        )
        outputs = list(architecture.get("output_modalities") or [])
        if forced_output not in outputs:
            outputs.append(forced_output)
        architecture["input_modalities"] = inputs
        architecture["output_modalities"] = outputs
        normalized["architecture"] = architecture

    previous = discovered.get(str(model_id), {})
    discovered[str(model_id)] = {**previous, **normalized}


class AdminTicketMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    is_internal: bool = False


class SeoPageCreateRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=500)
    page_type: str = "article"
    content: str = ""
    h1: str = ""
    subtitle: str = ""
    meta_title: str = ""
    meta_description: str = ""
    status: str = "draft"


class SeoPageUpdateRequest(BaseModel):
    model_config = {"populate_by_name": True}

    title: str | None = None
    content: str | None = None
    h1: str | None = None
    subtitle: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    meta_keywords: str | None = None
    canonical: str | None = None
    robots: str | None = None
    schema_markup: str | None = Field(None, alias="schema_json")
    status: str | None = None
    image: str | None = None
    author: str | None = None
    category: str | None = None
    is_visible: bool | None = None
    sort_order: int | None = None
    cta_text: str | None = None
    cta_link: str | None = None
    model_id: str | None = None
    related_slugs: str | None = None


class CreditPlanCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    credits: int = Field(gt=0)
    price_rub: int = Field(gt=0)
    bonus_credits: int = Field(0, ge=0)
    old_price_rub: int | None = Field(None, ge=0)
    badge: str | None = None


class CreditPlanUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    credits: int | None = Field(None, gt=0)
    price_rub: int | None = Field(None, gt=0)
    bonus_credits: int | None = Field(None, ge=0)
    old_price_rub: int | None = Field(None, ge=0)
    badge: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None

# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Admin auth
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

_permission_resources = {
    "dashboard": "*",
    "analytics": "*",
    "seo-pages": "content",
    "promo-codes": "promo",
    "credit-ops": "payments",
    "fraud-alerts": "payments",
    "tickets": "chats",
    "notifications": "users",
    "referrals": "payments",
    "queries": "chats",
    "feedback-stats": "chats",
    "feedbacks": "users",
    "metrica": "*",
    "task-templates": "content",
    "integrations": "models",
    "growth": "analytics",
}


@router.post("/auth/login", response_model=AuthResponse)
async def admin_login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Password authentication reserved exclusively for active administrators."""
    user = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if not user or not user.is_admin or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "РќРµРІРµСЂРЅС‹Рµ РґР°РЅРЅС‹Рµ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°")
    if password_needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(payload.password)
        await db.commit()
    _set_auth_cookie(response, create_access_token(user.id, user.email))
    return AuthResponse(user=UserInfo.model_validate(user))


async def require_admin(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not user.is_admin:
        raise HTTPException(403, "РўСЂРµР±СѓСЋС‚СЃСЏ РїСЂР°РІР° Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°")
    # role_id=None is reserved for the bootstrap super-administrator.
    if user.role_id is not None:
        role = await db.get(Role, user.role_id)
        if role is None:
            raise HTTPException(403, "Р РѕР»СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР° РЅРµ РЅР°Р№РґРµРЅР°")
        try:
            permissions = json.loads(role.permissions or "{}")
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(403, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Рµ РїСЂР°РІР° СЂРѕР»Рё")
        segment = request.url.path.removeprefix("/api/admin/").split("/", 1)[0]
        resource = _permission_resources.get(segment, segment)
        allowed = str(permissions.get(resource, permissions.get("*", ""))).lower()
        operation = {"GET": "r", "POST": "c", "PUT": "u", "PATCH": "u", "DELETE": "d"}.get(request.method, "")
        if operation not in allowed:
            raise HTTPException(403, "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ РґР»СЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РёРІРЅРѕРіРѕ РґРµР№СЃС‚РІРёСЏ")
    return user


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Dashboard
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/dashboard/stats")
async def dashboard_stats(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    period: str = Query("today", pattern="^(today|yesterday|7d|30d|month|prev_month)$"),
):
    """Main dashboard KPIs with period comparison."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_ago = today_start - timedelta(days=7)
    month_ago = today_start - timedelta(days=30)

    def _period_bounds(p: str):
        if p == "today":    return today_start, now
        if p == "yesterday": return yesterday_start, today_start
        if p == "7d":        return week_ago, now
        if p == "30d":       return month_ago, now
        if p == "month":     return today_start.replace(day=1), now
        if p == "prev_month":
            first_this = today_start.replace(day=1)
            prev = first_this - timedelta(days=1)
            return prev.replace(day=1), first_this
        return today_start, now

    cur_start, cur_end = _period_bounds(period)
    prev_end = cur_start
    prev_start = prev_end - (cur_end - cur_start)

    async def _q(query):
        r = await db.execute(query)
        return r.scalar() or 0

    # Current period
    cur_revenue = await _q(select(func.coalesce(func.sum(Transaction.rub_amount), 0)).where(
        and_(Transaction.type == "topup", Transaction.created_at.between(cur_start, cur_end))))
    cur_or_cost = await _q(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        and_(Transaction.type == "spend", Transaction.created_at.between(cur_start, cur_end))))
    cur_regs = await _q(select(func.count(User.id)).where(User.created_at.between(cur_start, cur_end)))
    cur_requests = await _q(select(func.coalesce(func.sum(User.request_count), 0)))
    cur_errors = await _q(select(func.count(SystemError.id)).where(SystemError.created_at.between(cur_start, cur_end)))

    # Previous period
    prev_revenue = await _q(select(func.coalesce(func.sum(Transaction.rub_amount), 0)).where(
        and_(Transaction.type == "topup", Transaction.created_at.between(prev_start, prev_end))))

    def _growth(cur, prev):
        if prev == 0: return 100.0 if cur > 0 else 0.0
        return round((cur - prev) / prev * 100, 1)

    total_users = await _q(select(func.count(User.id)))
    active_now = await _q(select(func.count(User.id)).where(User.last_seen >= (now - timedelta(minutes=15))))
    paying_users = await _q(select(func.count(func.distinct(Transaction.user_id))).where(Transaction.type == "topup"))
    total_revenue = await _q(select(func.coalesce(func.sum(Transaction.rub_amount), 0)).where(Transaction.type == "topup"))

    return {
        "period": period,
        "revenue": cur_revenue,
        "revenue_growth": _growth(cur_revenue, prev_revenue),
        "or_cost": cur_or_cost,
        "registrations": cur_regs,
        "requests": cur_requests,
        "errors": cur_errors,
        "total_users": total_users,
        "active_now": active_now,
        "paying_users": paying_users,
        "total_revenue": total_revenue,
    }


@router.get("/dashboard/warnings")
async def dashboard_warnings(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Unprofitable models and other warnings."""
    warnings = []

    # Unprofitable models
    bad_models = (await db.execute(
        select(AiModel).where(AiModel.is_unprofitable == True, AiModel.is_active == True)
    )).scalars().all()
    for m in bad_models:
        warnings.append({
            "type": "negative_margin",
            "severity": "critical",
            "model_id": m.id,
            "model_name": m.name,
            "margin": m.margin,
            "message": f"РњРѕРґРµР»СЊ В«{m.name}В» СЂР°Р±РѕС‚Р°РµС‚ РІ РјРёРЅСѓСЃ (РјР°СЂР¶Р° {m.margin:.1f}%)",
        })

    # OpenRouter balance low (check not possible without OR API call вЂ” placeholder)
    warnings.append({
        "type": "info",
        "severity": "info",
        "message": f"РњРѕРґРµР»РµР№ СЃ РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№ РјР°СЂР¶РѕР№: {len(bad_models)}",
    })

    return {"warnings": warnings}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Roles
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/roles")
async def list_roles(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Role).order_by(Role.name))
    return [{"id": r.id, "name": r.name, "description": r.description,
             "permissions": r.permissions, "is_system": r.is_system}
            for r in result.scalars().all()]


@router.post("/roles")
async def create_role(name: str = Query(...), description: str = Query(""),
                      permissions: str = Query("{}"), _=Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    import json
    try:
        perms = json.loads(permissions)
    except json.JSONDecodeError:
        raise HTTPException(400, "permissions must be valid JSON")
    role = Role(name=name, description=description, permissions=perms)
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return {"id": role.id, "name": role.name, "permissions": perms}


@router.delete("/roles/{role_id}")
async def delete_role(role_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    role = await db.get(Role, role_id)
    if not role: raise HTTPException(404)
    if role.is_system: raise HTTPException(400, "РќРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ СЃРёСЃС‚РµРјРЅСѓСЋ СЂРѕР»СЊ")
    # Unassign users with this role
    await db.execute(User.__table__.update().where(User.role_id == role_id).values(role_id=None))
    await db.delete(role)
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Users
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/users")
async def list_users(
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
    search: str = "", limit: int = 50, offset: int = 0,
):
    q = select(User).order_by(desc(User.created_at))
    cq = select(func.count(User.id))
    if search:
        like = f"%{search}%"
        q = q.where(or_(User.email.ilike(like), User.name.ilike(like)))
        cq = cq.where(or_(User.email.ilike(like), User.name.ilike(like)))
    result = await db.execute(q.offset(offset).limit(limit))
    total = (await db.execute(cq)).scalar()
    return {
        "total": total,
        "users": [_user_json(u) for u in result.scalars().all()],
    }


@router.get("/users/{user_id}")
async def get_user_card(user_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user: raise HTTPException(404, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ")

    # Payments
    payments = (await db.execute(
        select(Transaction).where(Transaction.user_id == user_id, Transaction.type == "topup")
        .order_by(desc(Transaction.created_at)).limit(20)
    )).scalars().all()

    # Credit operations
    ops = (await db.execute(
        select(CreditOperation).where(CreditOperation.user_id == user_id)
        .order_by(desc(CreditOperation.created_at)).limit(50)
    )).scalars().all()

    # Request stats
    total_spent = await db.execute(
        select(func.coalesce(func.sum(CreditOperation.amount), 0))
        .where(CreditOperation.user_id == user_id, CreditOperation.op_type == "spend")
    )

    return {
        "user": _user_json(user),
        "payments": [
            {"id": t.id, "amount": t.amount, "rub_amount": t.rub_amount,
             "type": t.type, "description": t.description, "payment_id": t.payment_id,
             "created_at": t.created_at.isoformat() if t.created_at else ""}
            for t in payments
        ],
        "credit_ops": [
            {"id": o.id, "op_type": o.op_type, "credit_type": o.credit_type,
             "amount": o.amount, "balance_before": o.balance_before,
             "balance_after": o.balance_after, "source": o.source,
             "comment": o.comment, "created_at": o.created_at.isoformat() if o.created_at else ""}
            for o in ops
        ],
    }


@router.post("/users/{user_id}/credits")
async def adjust_credits(
    user_id: int,
    op_type: str = Query(...),        # manual_add, manual_remove, bonus, compensation
    credit_type: str = Query("paid"), # paid, free, bonus, promo
    amount: int = Query(...),
    comment: str = Query(""),
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    if amount <= 0: raise HTTPException(400, "РЎСѓРјРјР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РїРѕР»РѕР¶РёС‚РµР»СЊРЅРѕР№")
    user = await db.get(User, user_id)
    if not user: raise HTTPException(404)

    col = {"paid": "credits_paid", "free": "credits_free",
           "bonus": "credits_bonus", "promo": "credits_promo"}
    col_name = col.get(credit_type)
    if not col_name: raise HTTPException(400, "РќРµРёР·РІРµСЃС‚РЅС‹Р№ С‚РёРї РєСЂРµРґРёС‚РѕРІ")

    sign = -1 if op_type == "manual_remove" else 1
    old_val = getattr(user, col_name)
    setattr(user, col_name, old_val + sign * amount)
    if getattr(user, col_name) < 0:
        setattr(user, col_name, 0)

    total_before = user.credits - sign * amount
    total_after = user.credits

    # Log operation
    op = CreditOperation(
        user_id=user_id, op_type=op_type, credit_type=credit_type,
        amount=sign * amount,
        balance_before=total_before, balance_after=total_after,
        comment=comment,
    )
    db.add(op)
    await db.commit()
    return {"ok": True, "new_balance": user.credits}


@router.post("/users/{user_id}/toggle-block")
async def toggle_block(user_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user: raise HTTPException(404)
    user.is_active = not user.is_active
    await db.commit()
    return {"ok": True, "is_active": user.is_active}


@router.delete("/users/{user_id}")
async def delete_user_account(
    user_id: int, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ")
    if user.id == admin.id or user.is_admin:
        raise HTTPException(400, "РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР° РЅРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ С‡РµСЂРµР· СЌС‚РѕС‚ СЂР°Р·РґРµР»")

    feedback_ids = select(UserFeedback.id).where(UserFeedback.user_id == user_id)
    ticket_ids = select(SupportTicket.id).where(SupportTicket.user_id == user_id)
    partner_ids = select(ReferralPartner.id).where(ReferralPartner.user_id == user_id)
    transaction_ids = select(Transaction.id).where(Transaction.user_id == user_id)

    await db.execute(delete(FeedbackReply).where(FeedbackReply.feedback_id.in_(feedback_ids)))
    await db.execute(delete(MessageFeedback).where(MessageFeedback.user_id == user_id))
    await db.execute(delete(UserFeedback).where(UserFeedback.user_id == user_id))
    await db.execute(delete(UserQuery).where(UserQuery.user_id == user_id))
    await db.execute(delete(TicketMessage).where(or_(TicketMessage.user_id == user_id, TicketMessage.ticket_id.in_(ticket_ids))))
    await db.execute(delete(SupportTicket).where(SupportTicket.user_id == user_id))
    await db.execute(delete(FileRecord).where(FileRecord.user_id == user_id))
    await db.execute(delete(ChatMessage).where(ChatMessage.user_id == user_id))
    await db.execute(delete(ChatSession).where(ChatSession.user_id == user_id))
    await db.execute(delete(GenerationJob).where(GenerationJob.user_id == user_id))
    await db.execute(delete(PaymentAttempt).where(PaymentAttempt.user_id == user_id))
    await db.execute(delete(CreditOperation).where(CreditOperation.user_id == user_id))
    await db.execute(update(ReferralTransaction).where(
        ReferralTransaction.related_payment_id.in_(transaction_ids)
    ).values(related_payment_id=None))
    await db.execute(delete(ReferralTransaction).where(or_(
        ReferralTransaction.referred_user_id == user_id,
        ReferralTransaction.partner_id.in_(partner_ids),
    )))
    await db.execute(delete(ReferralPartner).where(ReferralPartner.user_id == user_id))
    await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    await db.execute(update(User).where(User.referrer_id == user_id).values(referrer_id=None))
    await db.execute(update(Notification).where(Notification.audience_user_id == user_id).values(audience_user_id=None))
    await db.execute(update(FraudAlert).where(FraudAlert.user_id == user_id).values(user_id=None))
    await db.execute(update(SystemError).where(SystemError.user_id == user_id).values(user_id=None))
    await db.delete(user)
    await db.commit()
    return {"ok": True}


def _user_json(u: User) -> dict:
    return {
        "id": u.id, "email": u.email, "name": u.name,
        "credits": u.credits, "credits_paid": u.credits_paid,
        "credits_free": u.credits_free, "credits_bonus": u.credits_bonus,
        "credits_promo": u.credits_promo,
        "is_active": u.is_active, "is_admin": u.is_admin,
        "role_id": u.role_id,
        "total_spent_rub": u.total_spent_rub,
        "request_count": u.request_count,
        "chat_count": u.chat_count,
        "last_seen": u.last_seen.isoformat() if u.last_seen else None,
        "created_at": u.created_at.isoformat() if u.created_at else "",
        "registered_by": u.registered_by,
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# AI Models
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

def _media_pricing_parameters(model: AiModel, kind: str) -> dict:
    """Return a real, supported unit for media economics and sync guards."""
    try:
        supported = json.loads(model.supported_parameters or "{}")
    except (TypeError, json.JSONDecodeError):
        supported = {}
    if not isinstance(supported, dict):
        supported = {}
    if kind == "video":
        durations = supported.get("supported_durations") or [5]
        resolutions = supported.get("supported_resolutions") or ["720p"]
        ratios = supported.get("supported_aspect_ratios") or ["16:9"]
        return {
            "duration": 5 if 5 in durations else min(durations),
            "resolution": "720p" if "720p" in resolutions else resolutions[0],
            "aspect_ratio": "16:9" if "16:9" in ratios else ratios[0],
            "generate_audio": False,
        }
    return {"n": 1, "resolution": "1K", "aspect_ratio": "1:1"}


def _calc_margin(model: AiModel, context: PricingContext) -> float:
    """Conservative margin after FX/funding buffer and payment commission."""
    provider_cost = (
        max(0.0, model.or_input_cost or 0.0)
        + max(0.0, model.or_output_cost or 0.0)
    ) / 1000
    outputs = set(json.loads(model.output_modalities or "[]"))
    media_kind = "video" if "video" in outputs else "image" if "image" in outputs else ""
    if media_kind:
        snapshot = json.loads(model.openrouter_pricing or "{}")
        media_parameters = _media_pricing_parameters(model, media_kind)
        provider_cost = provider_cost_from_snapshot(snapshot, media_kind, media_parameters, conservative=True) or 0
        credits = credits_for_provider_cost(provider_cost, context, whole=True) if provider_cost else 0
    elif model.price_mode == "fixed" and (model.fixed_price or 0) > 0:
        provider_cost = model.fixed_price / max(context.credits_per_provider_usd, 1)
        credits = model.fixed_price
    elif model.price_mode == "unified":
        credits = (model.price_unit or 0) * 2
    else:
        credits = (model.price_input or 0) + (model.price_output or 0)
    return achieved_margin(provider_cost, credits, context)


def _model_unit_economics(model: AiModel, context: PricingContext) -> dict:
    """Transparent cost/revenue figures for the unit shown in the admin table."""
    try:
        outputs = set(json.loads(model.output_modalities or "[]"))
    except (TypeError, json.JSONDecodeError):
        outputs = set()
    if "text" in outputs:
        provider_cost_usd = (
            max(0.0, model.or_input_cost or 0.0)
            + max(0.0, model.or_output_cost or 0.0)
        ) / 1000  # one thousand input plus one thousand output tokens
        credits = (model.price_input or 0.0) + (model.price_output or 0.0)
        basis = "1K input + 1K output"
    else:
        kind = "video" if "video" in outputs else "image" if "image" in outputs else ""
        try:
            snapshot = json.loads(model.openrouter_pricing or "{}")
        except (TypeError, json.JSONDecodeError):
            snapshot = {}
        media_parameters = _media_pricing_parameters(model, kind) if kind else {}
        provider_cost_usd = provider_cost_from_snapshot(snapshot, kind, media_parameters, conservative=True) if kind else None
        credits = credits_for_provider_cost(provider_cost_usd, context, whole=True) if provider_cost_usd else 0.0
        basis = "1 Р·Р°РїСЂРѕСЃ" if provider_cost_usd else "РЅРµС‚ СЂР°СЃС‡С‘С‚Р°"
    provider_cost_rub = (provider_cost_usd or 0.0) * context.effective_usd_rub
    revenue_rub = credits * context.credit_rub
    payment_fee_rub = revenue_rub * context.payment_fee_rate
    profit_rub = revenue_rub - provider_cost_rub - payment_fee_rub
    return {
        "unit_basis": basis,
        "provider_cost_usd_unit": round(provider_cost_usd, 8) if provider_cost_usd is not None else None,
        "provider_cost_rub_unit": round(provider_cost_rub, 6) if provider_cost_usd is not None else None,
        "revenue_credits_unit": round(credits, 4),
        "revenue_rub_unit": round(revenue_rub, 6),
        "payment_fee_rub_unit": round(payment_fee_rub, 6),
        "profit_rub_unit": round(profit_rub, 6) if provider_cost_usd is not None else None,
    }


@router.get("/models")
async def list_models(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    category: str = "", provider: str = "",
):
    context = await pricing_context(db)
    q = select(AiModel).order_by(AiModel.sort_order, AiModel.name)
    if category: q = q.where(AiModel.category == category)
    if provider: q = q.where(AiModel.provider == provider)
    result = await db.execute(q)
    return [
        {
            "id": m.id, "name": m.name, "provider": m.provider,
            "or_model_id": m.or_model_id, "category": m.category,
            "price_input": m.price_input, "price_output": m.price_output,
            "price_unit": m.price_unit, "price_mode": m.price_mode,
            "or_input_cost": m.or_input_cost,
            "or_output_cost": m.or_output_cost,
            "margin": _calc_margin(m, context),
            "margin_min": max(m.margin_min, settings.target_gross_margin),
            "is_unprofitable": m.is_unprofitable,
            "is_active": m.is_active, "is_visible": m.is_visible,
            "is_free_available": m.is_free_available,
            "vision": m.vision, "request_count": m.request_count,
            "error_count": m.error_count, "avg_response_time": m.avg_response_time,
            "sort_order": m.sort_order,
            "input_modalities": json.loads(m.input_modalities or '["text"]'),
            "output_modalities": json.loads(m.output_modalities or '["text"]'),
            "supported_parameters": json.loads(m.supported_parameters or '{}'),
            "openrouter_pricing": json.loads(m.openrouter_pricing or '{}'),
            "auto_route_enabled": m.auto_route_enabled,
            "or_last_synced_at": m.or_last_synced_at.isoformat() if m.or_last_synced_at else None,
            "availability_status": m.availability_status,
            "catalog_miss_count": m.catalog_miss_count,
            "recommended_priority": m.recommended_priority,
            "last_provider_error": m.last_provider_error,
            "fixed_price": m.fixed_price,
            "markup_factor": m.markup_factor,
            "credits_in_1k": m.price_input,
            "credits_out_1k": m.price_output,
            **_model_unit_economics(m, context),
        }
        for m in result.scalars().all()
    ]


TASK_TOKEN_PROFILES: dict[str, tuple[int, int]] = {
    "explain": (700, 900), "write_text": (900, 1400), "improve_text": (1400, 1200),
    "translate": (1600, 1700), "summarize": (5000, 700), "analyze_document": (9000, 1200),
    "search": (1000, 1100), "compare": (1800, 1300), "create_post": (900, 900),
    "plan": (1000, 1200), "analyze_image": (1200, 900),
}


@router.get("/models/economics")
async def model_economics(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Task/model economics using the lowest-value active tariff as the guardrail."""
    from app.api.generations import _image_parameters, _provider_cost, _video_parameters

    context = await pricing_context(db)
    plans = (await db.execute(select(CreditPlan).where(CreditPlan.is_active == True).order_by(CreditPlan.sort_order))).scalars().all()
    models = (await db.execute(select(AiModel).order_by(AiModel.name))).scalars().all()
    templates = (await db.execute(select(TaskTemplate).where(TaskTemplate.is_active == True).order_by(TaskTemplate.sort_order))).scalars().all()

    def outputs(model: AiModel) -> set[str]:
        try:
            return set(json.loads(model.output_modalities or "[]"))
        except (TypeError, json.JSONDecodeError):
            return set()

    model_rows = []
    for model in models:
        kinds = outputs(model)
        margin = _calc_margin(model, context)
        model_rows.append({
            "id": model.id, "model": model.or_model_id, "name": model.name,
            "provider": model.provider, "outputs": sorted(kinds),
            "active": model.is_active, "visible": model.is_visible,
            "input_usd_per_million": model.or_input_cost,
            "output_usd_per_million": model.or_output_cost,
            "input_credits_per_1k": model.price_input,
            "output_credits_per_1k": model.price_output,
            "margin_pct": margin,
            "safe": margin + 0.01 >= context.target_margin * 100,
        })

    task_rows = []
    usable = [model for model in models if model.is_active and model.is_visible]
    for template in templates:
        kind = template.category if template.category in {"image", "video"} else "text"
        compatible = [model for model in usable if kind in outputs(model)]
        preferred = next((model for model in compatible if model.or_model_id == template.preferred_model), None)
        if kind == "text":
            input_tokens, output_tokens = TASK_TOKEN_PROFILES.get(
                template.task_type, (6000, 1000) if template.category == "document" else (1000, 1000),
            )
            compatible.sort(key=lambda item: (
                (input_tokens * item.or_input_cost + output_tokens * item.or_output_cost) / 1_000_000,
                item.recommended_priority, item.name,
            ))
            selected = preferred or (compatible[0] if compatible else None)
            metrics = text_task_metrics(
                selected.or_input_cost, selected.or_output_cost,
                selected.price_input, selected.price_output,
                input_tokens, output_tokens, context,
            ) if selected else None
            parameters = {}
        else:
            cost_candidates = []
            for candidate in compatible:
                defaults = json.loads(template.default_parameters or "{}")
                try:
                    parameters_for_model = _image_parameters(candidate, defaults) if kind == "image" else _video_parameters(candidate, defaults)
                    cost = _provider_cost(candidate, kind, parameters_for_model)
                    if cost is not None:
                        cost_candidates.append((cost, candidate, parameters_for_model))
                except (HTTPException, TypeError, ValueError):
                    continue
            cost_candidates.sort(key=lambda item: (item[0], item[1].recommended_priority, item[1].name))
            chosen = next((item for item in cost_candidates if preferred and item[1].id == preferred.id), None)
            chosen = chosen or (cost_candidates[0] if cost_candidates else None)
            selected = chosen[1] if chosen else None
            parameters = chosen[2] if chosen else {}
            provider_cost = chosen[0] * int(parameters.get("n", 1)) if chosen else 0
            credits = int(credits_for_provider_cost(provider_cost, context, whole=True)) if provider_cost else 0
            metrics = {
                "provider_cost_usd": round(provider_cost, 6), "credits": credits,
                "customer_price_rub": round(credits * context.credit_rub, 2),
                "margin_pct": achieved_margin(provider_cost, credits, context),
            } if selected else None
        task_rows.append({
            "template_id": template.id, "task": template.title, "task_type": template.task_type,
            "kind": kind, "model": selected.or_model_id if selected else None,
            "model_name": selected.name if selected else None, "parameters": parameters,
            "status": "safe" if metrics and metrics["margin_pct"] + 0.01 >= context.target_margin * 100 else "unavailable",
            **(metrics or {}),
        })

    # Actual unit economics for completed tasks. Product events intentionally keep
    # only safe numeric metadata here; prompt text remains in UserQuery.
    actual_events = (await db.execute(
        select(ProductEvent).where(
            ProductEvent.event_name == "result_success",
            ProductEvent.created_at >= datetime.now(timezone.utc) - timedelta(days=30),
        ).order_by(ProductEvent.created_at.desc())
    )).scalars().all()
    actual_groups: dict[tuple[str, str], dict] = {}
    for event in actual_events:
        try:
            metadata = json.loads(event.metadata_json or "{}")
        except (TypeError, json.JSONDecodeError):
            metadata = {}
        try:
            provider_cost = float(metadata.get("provider_cost_usd"))
            credits = float(metadata.get("credits"))
        except (TypeError, ValueError):
            provider_cost = credits = 0.0
        key = (event.task_type or "chat", event.model or "unknown")
        group = actual_groups.setdefault(key, {
            "task_type": key[0], "model": key[1], "generations": 0,
            "priced_generations": 0, "provider_cost_usd": 0.0, "credits": 0.0,
            "users": set(),
        })
        group["generations"] += 1
        if event.user_id is not None:
            group["users"].add(event.user_id)
        if provider_cost >= 0 and credits > 0 and metadata.get("provider_cost_usd") not in (None, ""):
            group["priced_generations"] += 1
            group["provider_cost_usd"] += provider_cost
            group["credits"] += credits

    actual_rows = []
    for group in sorted(actual_groups.values(), key=lambda item: (-item["generations"], item["task_type"], item["model"])):
        provider_cost = group["provider_cost_usd"]
        credits = group["credits"]
        actual_rows.append({
            "task_type": group["task_type"], "model": group["model"],
            "generations": group["generations"], "priced_generations": group["priced_generations"],
            "unique_users": len(group["users"]),
            "provider_cost_usd": round(provider_cost, 6), "credits": round(credits, 2),
            "customer_price_rub": round(credits * context.credit_rub, 2),
            "margin_pct": achieved_margin(provider_cost, credits, context) if group["priced_generations"] else None,
        })

    period_start = datetime.now(timezone.utc) - timedelta(days=30)
    revenue_kopecks = int((await db.execute(select(func.coalesce(func.sum(Transaction.rub_amount), 0)).where(
        Transaction.type == "topup", Transaction.created_at >= period_start,
    ))).scalar() or 0)
    provider_cost_usd = sum(float(row["provider_cost_usd"]) for row in actual_rows)
    free_events = (await db.execute(
        select(ProductEvent.metadata_json).join(User, User.id == ProductEvent.user_id).where(
            ProductEvent.event_name == "result_success", ProductEvent.created_at >= period_start, User.total_paid_rub == 0,
        )
    )).scalars().all()
    free_cost_usd = 0.0
    for raw in free_events:
        try:
            value = json.loads(raw or "{}").get("provider_cost_usd")
            if value not in (None, ""):
                free_cost_usd += max(0.0, float(value))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
    revenue_rub = revenue_kopecks / 100
    provider_cost_rub = provider_cost_usd * context.effective_usd_rub
    payment_cost_rub = revenue_rub * context.payment_fee_rate
    fixed_cost_rub = settings.monthly_fixed_cost_rub
    contribution_rub = revenue_rub - provider_cost_rub - payment_cost_rub - fixed_cost_rub
    pnl = {
        "period_days": 30, "revenue_rub": round(revenue_rub, 2),
        "provider_cost_usd": round(provider_cost_usd, 6), "provider_cost_rub": round(provider_cost_rub, 2),
        "free_program_cost_usd": round(free_cost_usd, 6),
        "payment_fees_rub": round(payment_cost_rub, 2), "fixed_costs_rub": round(fixed_cost_rub, 2),
        "contribution_rub": round(contribution_rub, 2), "break_even": contribution_rub >= 0,
    }

    return {
        "assumptions": {
            "target_margin_pct": context.target_margin * 100,
            "cheapest_credit_rub": round(context.credit_rub, 6),
            "guard_plan_id": context.plan_id, "guard_plan_name": context.plan_name,
            "usd_rub_rate": context.usd_rub_rate, "fx_safety_factor": context.fx_safety_factor,
            "payment_fee_pct": context.payment_fee_rate * 100,
            "openrouter_funding_fee_pct": context.provider_funding_fee_rate * 100,
            "credits_per_provider_usd": round(context.credits_per_provider_usd, 2),
        },
        "plans": [{
            "id": plan.id, "name": plan.name, "price_rub": plan.price_rub / 100,
            "total_credits": plan.credits + plan.bonus_credits,
            "rub_per_credit": round(plan.price_rub / 100 / (plan.credits + plan.bonus_credits), 6),
        } for plan in plans if plan.credits + plan.bonus_credits > 0],
        "tasks": task_rows, "models": model_rows,
        "actual_period_days": 30, "actual": actual_rows,
        "guard_passed": all(row["safe"] for row in model_rows if row["active"]),
        "pnl": pnl,
    }


@router.get("/models/{model_id}")
async def get_model(model_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    model = await db.get(AiModel, model_id)
    if not model: raise HTTPException(404)
    context = await pricing_context(db)
    return {
        "id": model.id, "name": model.name, "description": model.description,
        "provider": model.provider, "or_model_id": model.or_model_id,
        "category": model.category,
        "price_input": model.price_input, "price_output": model.price_output,
        "price_unit": model.price_unit, "price_mode": model.price_mode,
        "fixed_price": model.fixed_price, "min_cost": model.min_cost,
        "markup_factor": model.markup_factor,
        "or_input_cost": model.or_input_cost, "or_output_cost": model.or_output_cost,
        "or_auto_update": model.or_auto_update,
        "margin": _calc_margin(model, context),
        "margin_min": max(model.margin_min, settings.target_gross_margin),
        "is_unprofitable": model.is_unprofitable,
        "max_input_tokens": model.max_input_tokens,
        "max_output_tokens": model.max_output_tokens,
        "max_files": model.max_files, "max_file_size_mb": model.max_file_size_mb,
        "daily_limit_per_user": model.daily_limit_per_user,
        "spend_limit_per_user": model.spend_limit_per_user,
        "is_active": model.is_active, "is_visible": model.is_visible,
        "is_free_available": model.is_free_available,
        "is_guest_available": model.is_guest_available,
        "is_paid_only": model.is_paid_only, "min_balance": model.min_balance,
        "show_cost_warning": model.show_cost_warning,
        "vision": model.vision, "sort_order": model.sort_order,
        "input_modalities": json.loads(model.input_modalities or '["text"]'),
        "output_modalities": json.loads(model.output_modalities or '["text"]'),
        "supported_parameters": json.loads(model.supported_parameters or '{}'),
        "openrouter_pricing": json.loads(model.openrouter_pricing or '{}'),
        "auto_route_enabled": model.auto_route_enabled,
        "recommended_priority": model.recommended_priority,
        "availability_status": model.availability_status,
        "catalog_miss_count": model.catalog_miss_count,
        "last_provider_error": model.last_provider_error,
        "or_last_synced_at": model.or_last_synced_at.isoformat() if model.or_last_synced_at else None,
    }


@router.patch("/models/{model_id}")
async def update_model(model_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
                       price_input: float | None = None, price_output: float | None = None,
                       price_unit: float | None = None, price_mode: str | None = None,
                       fixed_price: float | None = None,
                       markup_factor: float | None = None,
                       is_active: bool | None = None, is_visible: bool | None = None,
                       is_free_available: bool | None = None,
                       margin_min: float | None = None,
                       sort_order: int | None = None,
                       recommended_priority: int | None = None,
                       input_modalities: str | None = None,
                       output_modalities: str | None = None,
                       auto_route_enabled: bool | None = None):
    model = await db.get(AiModel, model_id)
    if not model: raise HTTPException(404)
    for k, v in {"price_input": price_input, "price_output": price_output,
                 "price_unit": price_unit, "price_mode": price_mode,
                 "fixed_price": fixed_price,
                 "markup_factor": markup_factor,
                 "is_active": is_active, "is_visible": is_visible,
                 "is_free_available": is_free_available,
                 "margin_min": margin_min, "sort_order": sort_order,
                 "recommended_priority": recommended_priority,
                 "input_modalities": input_modalities,
                 "output_modalities": output_modalities,
                 "auto_route_enabled": auto_route_enabled}.items():
        if v is not None:
            if k in {"input_modalities", "output_modalities"}:
                parsed = json.loads(v)
                if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
                    raise HTTPException(400, f"{k} must be a JSON string array")
            setattr(model, k, v)
    if (price_input is not None or price_output is not None) and model.price_mode == "separate":
        model.price_unit = round(((model.price_input or 0) + (model.price_output or 0)) / 2, 2)
    # Recalculate margin
    context = await pricing_context(db)
    model.margin_min = max(model.margin_min, settings.target_gross_margin)
    model.margin = _calc_margin(model, context)
    model.is_unprofitable = model.margin + 0.01 < settings.target_gross_margin * 100
    if model.is_unprofitable and (model.is_active or model.is_visible):
        rejected_margin = model.margin
        await db.rollback()
        raise HTTPException(422, f"Р¦РµРЅР° РґР°С‘С‚ РјР°СЂР¶Сѓ {rejected_margin:.2f}%. РњРёРЅРёРјСѓРј вЂ” {settings.target_gross_margin * 100:.0f}%")
    await db.commit()
    return {"ok": True, "margin": model.margin, "is_unprofitable": model.is_unprofitable}


@router.post("/models/{model_id}/recalc")
async def recalc_model(model_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    model = await db.get(AiModel, model_id)
    if not model: raise HTTPException(404)
    context = await pricing_context(db)
    model.margin_min = max(model.margin_min, settings.target_gross_margin)
    model.margin = _calc_margin(model, context)
    model.is_unprofitable = model.margin + 0.01 < settings.target_gross_margin * 100
    await db.commit()
    return {"ok": True, "margin": model.margin, "is_unprofitable": model.is_unprofitable}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Credit Plans (Tariffs)
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

async def _reprice_catalog(db: AsyncSession) -> None:
    """Apply the current tariff guard to every synchronized model."""
    context = await pricing_context(db)
    models = (await db.execute(select(AiModel))).scalars().all()
    for model in models:
        try:
            outputs = set(json.loads(model.output_modalities or "[]"))
        except (TypeError, json.JSONDecodeError):
            outputs = set()
        if "text" in outputs:
            model.price_input, model.price_output = text_prices(
                model.or_input_cost, model.or_output_cost, context,
            )
            model.price_mode = "separate"
            model.price_unit = round((model.price_input + model.price_output) / 2, 2)
        model.margin_min = settings.target_gross_margin
        model.margin = _calc_margin(model, context)
        model.is_unprofitable = model.margin + 0.01 < settings.target_gross_margin * 100
        if model.is_unprofitable:
            model.is_active = False
            model.is_visible = False
            model.auto_route_enabled = False

@router.get("/plans")
async def list_plans(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CreditPlan).order_by(CreditPlan.sort_order))
    return [
        {
            "id": p.id, "name": p.name, "description": p.description,
            "price_rub": p.price_rub, "credits": p.credits,
            "bonus_credits": p.bonus_credits, "old_price_rub": p.old_price_rub,
            "badge": p.badge, "is_active": p.is_active,
            "sort_order": p.sort_order, "purchase_count": p.purchase_count,
            "credit_price": p.credit_price,
        }
        for p in result.scalars().all()
    ]


@router.post("/plans")
async def create_plan(
    payload: CreditPlanCreateRequest,
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    plan = CreditPlan(**payload.model_dump())
    db.add(plan)
    await _reprice_catalog(db)
    await db.commit()
    await db.refresh(plan)
    return {"id": plan.id, "name": plan.name, "credit_price": plan.credit_price}


@router.patch("/plans/{plan_id}")
async def update_plan(
    plan_id: int, payload: CreditPlanUpdateRequest,
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    plan = await db.get(CreditPlan, plan_id)
    if not plan: raise HTTPException(404)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    await _reprice_catalog(db)
    await db.commit()
    return {"ok": True}


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    plan = await db.get(CreditPlan, plan_id)
    if not plan: raise HTTPException(404)
    await db.delete(plan)
    await _reprice_catalog(db)
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Payments / Transactions
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/payments")
async def list_payments(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status_filter: str = "", limit: int = 50, offset: int = 0,
):
    q = select(Transaction).where(Transaction.type == "topup").order_by(desc(Transaction.created_at))
    if status_filter:
        q = q.where(Transaction.description.ilike(f"%{status_filter}%"))
    result = await db.execute(q.offset(offset).limit(limit))
    total = (await db.execute(select(func.count(Transaction.id)).where(Transaction.type == "topup"))).scalar()
    # Load user emails
    txs = result.scalars().all()
    user_ids = list(set(t.user_id for t in txs))
    users_r = await db.execute(select(User.id, User.email).where(User.id.in_(user_ids)))
    user_map = dict(users_r.fetchall())
    return {
        "total": total,
        "payments": [
            {"id": t.id, "user_id": t.user_id, "user_email": user_map.get(t.user_id, f"#{t.user_id}"),
             "amount": t.amount, "rub_amount": t.rub_amount, "type": t.type,
             "description": t.description, "payment_id": t.payment_id,
             "created_at": t.created_at.isoformat() if t.created_at else ""}
            for t in txs
        ],
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Credit Operations Journal
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/credit-ops")
async def list_credit_ops(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    user_id: int | None = None, limit: int = 50, offset: int = 0,
):
    q = select(CreditOperation).order_by(desc(CreditOperation.created_at))
    if user_id: q = q.where(CreditOperation.user_id == user_id)
    result = await db.execute(q.offset(offset).limit(limit))
    total = (await db.execute(select(func.count(CreditOperation.id)))).scalar()
    return {
        "total": total,
        "ops": [
            {"id": o.id, "user_id": o.user_id, "op_type": o.op_type,
             "credit_type": o.credit_type, "amount": o.amount,
             "balance_before": o.balance_before, "balance_after": o.balance_after,
             "source": o.source, "related_id": o.related_id,
             "admin_id": o.admin_id, "comment": o.comment,
             "created_at": o.created_at.isoformat() if o.created_at else ""}
            for o in result.scalars().all()
        ],
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Admin Log
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/logs")
async def list_logs(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    limit: int = 100, offset: int = 0,
):
    result = await db.execute(select(AdminLog).order_by(desc(AdminLog.created_at)).offset(offset).limit(limit))
    total = (await db.execute(select(func.count(AdminLog.id)))).scalar()
    # Admin names
    admin_ids = list(set(l.admin_id for l in result.scalars().all()))
    admins_r = await db.execute(select(User.id, User.email).where(User.id.in_(admin_ids)))
    admin_map = dict(admins_r.fetchall())
    result = await db.execute(select(AdminLog).order_by(desc(AdminLog.created_at)).offset(offset).limit(limit))
    return {
        "total": total,
        "logs": [
            {"id": l.id, "admin_id": l.admin_id, "admin_email": admin_map.get(l.admin_id, f"#{l.admin_id}"),
             "action": l.action, "target_type": l.target_type, "target_id": l.target_id,
             "old_value": l.old_value, "new_value": l.new_value,
             "ip": l.ip, "result": l.result, "detail": l.detail,
             "created_at": l.created_at.isoformat() if l.created_at else ""}
            for l in result.scalars().all()
        ],
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# System Errors
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/errors")
async def list_errors(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    service: str = "", status_filter: str = "", limit: int = 50, offset: int = 0,
):
    q = select(SystemError).order_by(desc(SystemError.created_at))
    if service: q = q.where(SystemError.service == service)
    if status_filter: q = q.where(SystemError.status == status_filter)
    result = await db.execute(q.offset(offset).limit(limit))
    total = (await db.execute(select(func.count(SystemError.id)))).scalar()
    return {
        "total": total,
        "errors": [
            {"id": e.id, "error_code": e.error_code, "error_text": e.error_text,
             "service": e.service, "repeat_count": e.repeat_count, "status": e.status,
             "created_at": e.created_at.isoformat() if e.created_at else ""}
            for e in result.scalars().all()
        ],
    }


@router.patch("/errors/{error_id}")
async def update_error(error_id: int, status: str = Query(...),
                       _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    err = await db.get(SystemError, error_id)
    if not err: raise HTTPException(404)
    err.status = status
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# Promo codes (enhanced)
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/promo-codes")
async def list_promos(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromoCode).order_by(desc(PromoCode.created_at)))
    return [
        {"id": p.id, "code": p.code, "credits": p.credits,
         "max_uses": p.max_uses, "used_count": p.used_count,
         "description": p.description, "is_active": p.is_active,
         "expires_at": p.expires_at.isoformat() if p.expires_at else None,
         "created_at": p.created_at.isoformat() if p.created_at else ""}
        for p in result.scalars().all()
    ]


@router.post("/promo-codes")
async def create_promo(
    code: str = Query(...), credits: int = Query(...),
    max_uses: int = Query(0), description: str = Query(""),
    expires_in_days: int = Query(0),
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    code = code.strip().upper()
    existing = await db.execute(select(PromoCode).where(PromoCode.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "РўР°РєРѕР№ РєРѕРґ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚")
    expires_at = date.today() + timedelta(days=expires_in_days) if expires_in_days > 0 else None
    promo = PromoCode(code=code, credits=credits, max_uses=max_uses,
                      description=description, is_active=True, expires_at=expires_at)
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    return {"id": promo.id, "code": promo.code, "credits": promo.credits}


@router.post("/promo-codes/{promo_id}/toggle")
async def toggle_promo(promo_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    promo = await db.get(PromoCode, promo_id)
    if not promo: raise HTTPException(404)
    promo.is_active = not promo.is_active
    await db.commit()
    return {"ok": True, "is_active": promo.is_active}


@router.delete("/promo-codes/{promo_id}")
async def delete_promo(promo_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    promo = await db.get(PromoCode, promo_id)
    if not promo: raise HTTPException(404)
    await db.delete(promo)
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 2: Chats
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/chats")
async def list_chats(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    search: str = "", model: str = "", user_id: int | None = None,
    limit: int = 50, offset: int = 0,
):
    q = select(ChatSession, User.email).join(User, User.id == ChatSession.user_id).order_by(desc(ChatSession.updated_at))
    cq = select(func.count(ChatSession.id))
    if search:
        like = f"%{search}%"
        q = q.where(or_(ChatSession.title.ilike(like), User.email.ilike(like)))
        cq = cq.join(User, User.id == ChatSession.user_id).where(
            or_(ChatSession.title.ilike(like), User.email.ilike(like))
        )
    if user_id:
        q = q.where(ChatSession.user_id == user_id)
        cq = cq.where(ChatSession.user_id == user_id)
    total = int((await db.execute(cq)).scalar() or 0)
    result = await db.execute(q.offset(offset).limit(limit))
    chat_rows = []
    for session, email in result.all():
        try:
            messages = json.loads(session.messages or "[]")
        except (TypeError, json.JSONDecodeError):
            messages = []
        session_model = next((
            message.get("effective_model") or message.get("requested_model")
            for message in reversed(messages)
            if isinstance(message, dict) and (message.get("effective_model") or message.get("requested_model"))
        ), "")
        if model and session_model != model:
            continue
        credits_spent = sum(
            int(message.get("credits_spent") or 0)
            for message in messages if isinstance(message, dict)
        )
        chat_rows.append((session, email, messages, session_model, credits_spent))

    return {
        "total": total,
        "chats": [{
            "id": session.id,
            "session_id": session.id,
            "user_id": session.user_id,
            "user_email": email,
            "title": session.title or "(Р±РµР· РЅР°Р·РІР°РЅРёСЏ)",
            "model": session_model,
            "credits_spent": credits_spent,
            "or_cost": 0.0,
            "message_count": len(messages),
            "created_at": session.created_at.isoformat() if session.created_at else "",
            "updated_at": session.updated_at.isoformat() if session.updated_at else "",
        } for session, email, messages, session_model, credits_spent in chat_rows],
    }

    # Get message counts per session
    sess_ids = []
    msg_counts = {}
    if sess_ids:
        count_rows = await db.execute(
            select(ChatMessage.session_id, func.count(ChatMessage.id)).where(
                ChatMessage.session_id.in_(sess_ids), ChatMessage.is_deleted == False
            ).group_by(ChatMessage.session_id)
        )
        msg_counts = dict(count_rows.fetchall() or [])

    return {
        "total": total,
        "chats": [{
            "id": c.id, "session_id": c.session_id, "user_id": c.user_id,
            "title": c.title or "(Р±РµР· РЅР°Р·РІР°РЅРёСЏ)", "model": c.model,
            "credits_spent": c.credits_spent, "or_cost": c.or_cost,
            "message_count": msg_counts.get(c.session_id, 0),
            "created_at": c.created_at.isoformat() if c.created_at else "",
            "updated_at": c.updated_at.isoformat() if c.updated_at else "",
        } for c in []],
    }


@router.get("/chats/{session_id}")
async def get_chat_messages(
    session_id: str, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    limit: int = 100, offset: int = 0,
):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(404, "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ")
    try:
        all_messages = json.loads(session.messages or "[]")
    except (TypeError, json.JSONDecodeError):
        all_messages = []
    messages = all_messages[offset:offset + min(limit, 500)]
    session_model = next((
        message.get("effective_model") or message.get("requested_model")
        for message in reversed(all_messages)
        if isinstance(message, dict) and (message.get("effective_model") or message.get("requested_model"))
    ), "")

    def message_content(value):
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts = []
            for item in value:
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "text":
                    parts.append(str(item.get("text") or ""))
                elif item.get("type") in {"image_url", "video_url"}:
                    parts.append("[РІР»РѕР¶РµРЅРёРµ]")
            return " ".join(filter(None, parts))
        return str(value or "")

    return {
        "total": len(all_messages),
        "session": {
            "session_id": session.id,
            "title": session.title,
            "model": session_model,
            "user_id": session.user_id,
            "created_at": session.created_at.isoformat() if session.created_at else "",
        },
        "messages": [{
            "id": f"{session.id}:{offset + index}",
            "role": message.get("role", "unknown"),
            "content": message_content(message.get("content")),
            "model": message.get("effective_model") or message.get("requested_model") or "",
            "tokens_in": message.get("tokens_in", 0),
            "tokens_out": message.get("tokens_out", 0),
            "cost_or": message.get("cost_or", 0),
            "credits_spent": message.get("credits_spent", 0),
            "or_request_id": message.get("or_request_id"),
            "error": message.get("error"),
            "created_at": message.get("createdAt") or message.get("created_at") or (
                session.created_at.isoformat() if session.created_at else ""
            ),
        } for index, message in enumerate(messages) if isinstance(message, dict)],
    }

    session = await db.execute(select(ChatSession).where(ChatSession.session_id == session_id))
    session = session.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ")

    q = select(ChatMessage).where(
        ChatMessage.session_id == session_id, ChatMessage.is_deleted == False
    ).order_by(ChatMessage.created_at).offset(offset).limit(limit)
    result = await db.execute(q)
    total = (await db.execute(
        select(func.count(ChatMessage.id)).where(ChatMessage.session_id == session_id, ChatMessage.is_deleted == False)
    )).scalar()
    return {
        "total": total,
        "session": {
            "session_id": session.session_id, "title": session.title,
            "model": session.model, "user_id": session.user_id,
            "created_at": session.created_at.isoformat() if session.created_at else "",
        },
        "messages": [{
            "id": m.id, "role": m.role, "content": m.content,
            "model": m.model, "tokens_in": m.tokens_in, "tokens_out": m.tokens_out,
            "cost_or": m.cost_or, "credits_spent": m.credits_spent,
            "or_request_id": m.or_request_id, "error": m.error,
            "created_at": m.created_at.isoformat() if m.created_at else "",
        } for m in result.scalars().all()],
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 2: Files
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/queries")
async def list_user_queries(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    search: str = "", model: str = "", user_id: int | None = None,
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
):
    filters = []
    if search:
        like = f"%{search}%"
        filters.append(or_(UserQuery.content.ilike(like), User.email.ilike(like), ChatSession.title.ilike(like)))
    if model:
        filters.append(UserQuery.model == model)
    if user_id:
        filters.append(UserQuery.user_id == user_id)

    base = select(UserQuery, User.email, ChatSession.title).join(
        User, User.id == UserQuery.user_id
    ).join(ChatSession, ChatSession.id == UserQuery.session_id)
    count_q = select(func.count(UserQuery.id)).join(
        User, User.id == UserQuery.user_id
    ).join(ChatSession, ChatSession.id == UserQuery.session_id)
    if filters:
        base = base.where(*filters)
        count_q = count_q.where(*filters)
    rows = (await db.execute(
        base.order_by(desc(UserQuery.created_at), desc(UserQuery.id)).offset(offset).limit(limit)
    )).all()
    total = int((await db.execute(count_q)).scalar() or 0)
    models = (await db.execute(
        select(UserQuery.model).where(UserQuery.model.is_not(None), UserQuery.model != "").distinct().order_by(UserQuery.model)
    )).scalars().all()
    return {
        "total": total,
        "models": list(models),
        "queries": [{
            "id": query.id,
            "session_id": query.session_id,
            "title": title,
            "user_id": query.user_id,
            "user_email": email,
            "content": query.content,
            "model": query.model or "",
            "has_attachments": query.has_attachments,
            "created_at": query.created_at.isoformat() if query.created_at else "",
        } for query, email, title in rows],
    }


@router.get("/files")
async def list_files(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status: str = "", user_id: int | None = None, limit: int = 50, offset: int = 0,
):
    q = select(FileRecord).order_by(desc(FileRecord.created_at))
    cq = select(func.count(FileRecord.id))
    if status:
        q = q.where(FileRecord.status == status)
        cq = cq.where(FileRecord.status == status)
    if user_id:
        q = q.where(FileRecord.user_id == user_id)
        cq = cq.where(FileRecord.user_id == user_id)
    total = (await db.execute(cq)).scalar()
    result = await db.execute(q.offset(offset).limit(limit))
    return {
        "total": total,
        "files": [{
            "id": f.id, "user_id": f.user_id, "chat_id": f.chat_id,
            "original_name": f.original_name, "mime_type": f.mime_type,
            "size_bytes": f.size_bytes, "status": f.status,
            "is_blocked": f.is_blocked, "error_text": f.error_text,
            "created_at": f.created_at.isoformat() if f.created_at else "",
        } for f in result.scalars().all()],
    }


@router.patch("/files/{file_id}")
async def update_file(
    file_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status: str | None = None, is_blocked: bool | None = None,
):
    f = await db.get(FileRecord, file_id)
    if not f: raise HTTPException(404)
    if status: f.status = status
    if is_blocked is not None: f.is_blocked = is_blocked
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 2: Support Tickets
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/tickets")
async def list_tickets(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status: str = "", category: str = "", priority: str = "",
    limit: int = 50, offset: int = 0,
):
    q = select(SupportTicket).order_by(desc(SupportTicket.created_at))
    cq = select(func.count(SupportTicket.id))
    if status:
        q = q.where(SupportTicket.status == status)
        cq = cq.where(SupportTicket.status == status)
    if category:
        q = q.where(SupportTicket.category == category)
        cq = cq.where(SupportTicket.category == category)
    if priority:
        q = q.where(SupportTicket.priority == priority)
        cq = cq.where(SupportTicket.priority == priority)
    total = (await db.execute(cq)).scalar()
    result = await db.execute(q.offset(offset).limit(limit))
    tickets = result.scalars().all()

    # Resolve user emails
    uids = list(set(t.user_id for t in tickets) | set(t.assigned_to for t in tickets if t.assigned_to))
    users_map = {}
    if uids:
        u_rows = await db.execute(select(User.id, User.email).where(User.id.in_(uids)))
        users_map = dict(u_rows.fetchall())

    return {
        "total": total,
        "tickets": [{
            "id": t.id, "user_id": t.user_id, "user_email": users_map.get(t.user_id, f"#{t.user_id}"),
            "subject": t.subject, "category": t.category, "priority": t.priority,
            "status": t.status, "assigned_to": t.assigned_to,
            "assigned_email": users_map.get(t.assigned_to) if t.assigned_to else None,
            "message_count": None,  # filled below
            "last_message_at": t.last_message_at.isoformat() if t.last_message_at else None,
            "created_at": t.created_at.isoformat() if t.created_at else "",
        } for t in tickets],
    }


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket: raise HTTPException(404)
    user = await db.get(User, ticket.user_id)

    messages = (await db.execute(
        select(TicketMessage).where(TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.created_at)
    )).scalars().all()

    return {
        "ticket": {
            "id": ticket.id, "user_id": ticket.user_id,
            "user_email": user.email if user else f"#{ticket.user_id}",
            "subject": ticket.subject, "category": ticket.category,
            "priority": ticket.priority, "status": ticket.status,
            "assigned_to": ticket.assigned_to,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else "",
        },
        "messages": [{
            "id": m.id, "user_id": m.user_id, "content": m.content,
            "is_internal": m.is_internal,
            "created_at": m.created_at.isoformat() if m.created_at else "",
        } for m in messages],
    }


@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status: str | None = None, priority: str | None = None,
    assigned_to: int | None = None,
):
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket: raise HTTPException(404)
    if status: ticket.status = status
    if priority: ticket.priority = priority
    if assigned_to is not None: ticket.assigned_to = assigned_to
    await db.commit()
    return {"ok": True}


@router.post("/tickets/{ticket_id}/message")
async def add_ticket_message(
    ticket_id: int, req: AdminTicketMessageRequest,
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket: raise HTTPException(404)
    msg = TicketMessage(ticket_id=ticket_id, user_id=admin.id, content=req.content.strip(), is_internal=req.is_internal)
    ticket.status = "in_progress" if ticket.status == "new" else ticket.status
    ticket.last_message_at = datetime.now(timezone.utc)
    db.add(msg)
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 2: Notifications
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/notifications")
async def list_notifications(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).order_by(desc(Notification.created_at)).limit(100))
    return [{
        "id": n.id, "title": n.title, "text": n.text[:100],
        "audience": n.audience, "channel": n.channel,
        "is_active": n.is_active, "sent_count": n.sent_count,
        "opened_count": n.opened_count,
        "starts_at": n.starts_at.isoformat() if n.starts_at else None,
        "ends_at": n.ends_at.isoformat() if n.ends_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else "",
    } for n in result.scalars().all()]


@router.post("/notifications")
async def create_notification(
    title: str = Query(...), text: str = Query(...),
    audience: str = Query("all"), channel: str = Query("site"),
    button_text: str = "", button_url: str = "",
    audience_user_id: int | None = None,
    starts_in_days: int = 0, ends_in_days: int = 0,
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    starts_at = now + timedelta(days=starts_in_days) if starts_in_days > 0 else now
    ends_at = now + timedelta(days=ends_in_days) if ends_in_days > 0 else None
    notif = Notification(
        title=title, text=text, audience=audience, channel=channel,
        button_text=button_text or None, button_url=button_url or None,
        audience_user_id=audience_user_id,
        starts_at=starts_at, ends_at=ends_at, created_by=0, is_active=True,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return {"id": notif.id, "title": notif.title}


@router.delete("/notifications/{notif_id}")
async def delete_notification(notif_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    n = await db.get(Notification, notif_id)
    if not n: raise HTTPException(404)
    await db.delete(n)
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 2: Fraud Alerts
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/fraud-alerts")
async def list_fraud_alerts(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status: str = "", risk_level: str = "", limit: int = 50, offset: int = 0,
):
    q = select(FraudAlert).order_by(desc(FraudAlert.created_at))
    cq = select(func.count(FraudAlert.id))
    if status:
        q = q.where(FraudAlert.status == status)
        cq = cq.where(FraudAlert.status == status)
    if risk_level:
        q = q.where(FraudAlert.risk_level == risk_level)
        cq = cq.where(FraudAlert.risk_level == risk_level)
    total = (await db.execute(cq)).scalar()
    result = await db.execute(q.offset(offset).limit(limit))
    return {
        "total": total,
        "alerts": [{
            "id": a.id, "user_id": a.user_id, "alert_type": a.alert_type,
            "risk_level": a.risk_level, "ip_address": a.ip_address,
            "description": a.description, "status": a.status,
            "action_taken": a.action_taken,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        } for a in result.scalars().all()],
    }


@router.patch("/fraud-alerts/{alert_id}")
async def update_fraud_alert(
    alert_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status: str | None = None, action_taken: str | None = None,
):
    a = await db.get(FraudAlert, alert_id)
    if not a: raise HTTPException(404)
    if status: a.status = status
    if action_taken: a.action_taken = action_taken
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 2: Advanced analytics
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/analytics/overview")
async def analytics_overview(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    days: int = 30,
):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    # Revenue & cost by day
    rev_rows = await db.execute(
        select(
            func.date(Transaction.created_at).label("day"),
            func.coalesce(func.sum(Transaction.rub_amount), 0).label("revenue"),
        ).where(Transaction.type == "topup", Transaction.created_at >= since)
        .group_by(func.date(Transaction.created_at)).order_by("day")
    )
    revenue_by_day = [{"day": str(r.day), "value": r.revenue} for r in rev_rows.fetchall()]

    cost_rows = await db.execute(
        select(
            func.date(Transaction.created_at).label("day"),
            func.coalesce(func.sum(Transaction.amount), 0).label("cost"),
        ).where(Transaction.type == "spend", Transaction.created_at >= since)
        .group_by(func.date(Transaction.created_at)).order_by("day")
    )
    cost_by_day = [{"day": str(r.day), "value": r.cost} for r in cost_rows.fetchall()]

    # Registrations by day
    reg_rows = await db.execute(
        select(func.date(User.created_at).label("day"), func.count(User.id).label("cnt"))
        .where(User.created_at >= since).group_by(func.date(User.created_at)).order_by("day")
    )
    reg_by_day = [{"day": str(r.day), "value": r.cnt} for r in reg_rows.fetchall()]

    # Payments by day
    pay_rows = await db.execute(
        select(func.date(Transaction.created_at).label("day"), func.count(Transaction.id).label("cnt"))
        .where(Transaction.type == "topup", Transaction.created_at >= since)
        .group_by(func.date(Transaction.created_at)).order_by("day")
    )
    pay_by_day = [{"day": str(r.day), "value": r.cnt} for r in pay_rows.fetchall()]

    # Top models by cost
    cost_model_rows = await db.execute(
        select(ChatMessage.model, func.coalesce(func.sum(ChatMessage.cost_or), 0).label("cost"))
        .where(ChatMessage.created_at >= since, ChatMessage.model.isnot(None))
        .group_by(ChatMessage.model).order_by(desc("cost")).limit(10)
    )
    top_models = [{"model": r.model, "cost": r.cost} for r in cost_model_rows.fetchall()]

    # Free vs paid credit usage
    paid_ops = await db.execute(
        select(func.coalesce(func.sum(CreditOperation.amount), 0))
        .where(CreditOperation.credit_type == "paid", CreditOperation.op_type == "spend",
               CreditOperation.created_at >= since)
    )
    free_ops = await db.execute(
        select(func.coalesce(func.sum(CreditOperation.amount), 0))
        .where(CreditOperation.credit_type == "free", CreditOperation.op_type == "spend",
               CreditOperation.created_at >= since)
    )
    bonus_ops = await db.execute(
        select(func.coalesce(func.sum(CreditOperation.amount), 0))
        .where(CreditOperation.credit_type == "bonus", CreditOperation.op_type == "spend",
               CreditOperation.created_at >= since)
    )

    # OR errors count
    or_errors = await db.execute(
        select(func.count(SystemError.id)).where(
            SystemError.service == "openrouter", SystemError.created_at >= since))

    return {
        "revenue_by_day": revenue_by_day,
        "cost_by_day": cost_by_day,
        "reg_by_day": reg_by_day,
        "pay_by_day": pay_by_day,
        "top_models_by_cost": top_models,
        "credit_usage": {
            "paid": paid_ops.scalar() or 0,
            "free": free_ops.scalar() or 0,
            "bonus": bonus_ops.scalar() or 0,
        },
        "or_error_count": or_errors.scalar() or 0,
    }


@router.get("/analytics/funnel")
async def analytics_funnel(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Conversion funnel: visitor -> registration -> payment -> repeat payment."""
    now = datetime.now(timezone.utc)

    # Total registrations
    total_reg = (await db.execute(select(func.count(User.id)))).scalar() or 0

    # Users who made a payment
    paid_users = (await db.execute(
        select(func.count(func.distinct(Transaction.user_id)))
        .where(Transaction.type == "topup")
    )).scalar() or 0

    # Users with 2+ payments
    repeat_payers = (await db.execute(
        select(func.count()).select_from(
            select(Transaction.user_id, func.count(Transaction.id).label("cnt"))
            .where(Transaction.type == "topup")
            .group_by(Transaction.user_id).having(func.count(Transaction.id) >= 2).subquery()
        )
    )).scalar() or 0

    # Users who spent some credits (at least one request)
    active_users = (await db.execute(
        select(func.count(func.distinct(CreditOperation.user_id)))
        .where(CreditOperation.op_type == "spend")
    )).scalar() or 0

    event_counts = dict((await db.execute(
        select(ProductEvent.event_name, func.count(ProductEvent.id)).group_by(ProductEvent.event_name)
    )).all())
    event_stages = [
        ("Р’С‹Р±СЂР°Р»Рё СЃС†РµРЅР°СЂРёР№", "template_view"),
        ("РќР°С‡Р°Р»Рё Р·Р°РґР°С‡Сѓ", "task_started"),
        ("РџРѕР»СѓС‡РёР»Рё РїРµСЂРІС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚", "first_result"),
        ("РћС‚РєСЂС‹Р»Рё С‚Р°СЂРёС„С‹", "pricing_view"),
        ("РќР°С‡Р°Р»Рё РѕРїР»Р°С‚Сѓ", "checkout_started"),
        ("РЈСЃРїРµС€РЅРѕ РѕРїР»Р°С‚РёР»Рё", "payment_succeeded"),
    ]
    product_funnel = []
    previous = 0
    for index, (label, event_name) in enumerate(event_stages):
        count = int(event_counts.get(event_name, 0))
        conversion = 100.0 if index == 0 and count else (round(count / previous * 100, 1) if previous else 0)
        product_funnel.append({"stage": label, "count": count, "conversion": conversion, "dropped": max(0, previous - count) if index else 0})
        previous = count
    total_revenue_kop = (await db.execute(
        select(func.coalesce(func.sum(Transaction.rub_amount), 0)).where(Transaction.type == "topup")
    )).scalar() or 0

    return {
        "funnel": product_funnel,
        "summary": {
            "total_users": total_reg,
            "paying_users": paid_users,
            "overall_conversion_pct": round(paid_users / total_reg * 100, 1) if total_reg else 0,
            "total_revenue_rub": round(total_revenue_kop / 100, 2),
            "avg_revenue_per_payer_rub": round(total_revenue_kop / paid_users / 100, 2) if paid_users else 0,
        },
        "legacy_funnel": [
            {"stage": "Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРѕ", "count": total_reg},
            {"stage": "РЎРѕРІРµСЂС€РёР»Рё Р·Р°РїСЂРѕСЃ", "count": active_users},
            {"stage": "РћРїР»Р°С‚РёР»Рё С…РѕС‚СЏ Р±С‹ СЂР°Р·", "count": paid_users,
             "conversion": round(paid_users / total_reg * 100, 1) if total_reg else 0},
            {"stage": "РџРѕРІС‚РѕСЂРЅР°СЏ РѕРїР»Р°С‚Р°", "count": repeat_payers,
             "conversion": round(repeat_payers / paid_users * 100, 1) if paid_users else 0},
        ],
        "total_registrations": total_reg,
        "active_users": active_users,
        "paying_users": paid_users,
        "repeat_payers": repeat_payers,
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 3: SEO Pages
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

SEO_PAGE_TYPES = ["article", "model_page", "task_page", "faq_list", "static", "legal"]
SEO_STATUSES = ["draft", "review", "published", "unpublished", "scheduled"]


@router.get("/seo-pages")
async def list_seo_pages(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status: str = "", page_type: str = "", search: str = "",
    limit: int = 50, offset: int = 0,
):
    q = select(SeoPage).order_by(desc(SeoPage.updated_at))
    cq = select(func.count(SeoPage.id))
    if status and status in SEO_STATUSES:
        q = q.where(SeoPage.status == status)
        cq = cq.where(SeoPage.status == status)
    if page_type and page_type in SEO_PAGE_TYPES:
        q = q.where(SeoPage.page_type == page_type)
        cq = cq.where(SeoPage.page_type == page_type)
    if search:
        like = f"%{search}%"
        q = q.where(or_(SeoPage.title.ilike(like), SeoPage.slug.ilike(like)))
        cq = cq.where(or_(SeoPage.title.ilike(like), SeoPage.slug.ilike(like)))
    total = (await db.execute(cq)).scalar()
    result = await db.execute(q.offset(offset).limit(limit))
    return {"total": total, "pages": [p.to_dict() for p in result.scalars().all()]}


@router.get("/seo-pages/{page_id}")
async def get_seo_page(page_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    p = await db.get(SeoPage, page_id)
    if not p: raise HTTPException(404)
    return p.to_dict()


@router.post("/seo-pages")
async def create_seo_page(
    payload: SeoPageCreateRequest,
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    slug, title, page_type, status = payload.slug, payload.title, payload.page_type, payload.status
    if slug in ("admin", "api", "login", "register", ""):
        raise HTTPException(400, "РќРµРґРѕРїСѓСЃС‚РёРјС‹Р№ slug")
    existing = await db.execute(select(SeoPage).where(SeoPage.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"РЎС‚СЂР°РЅРёС†Р° СЃ slug '{slug}' СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚")
    now = datetime.now(timezone.utc)
    page = SeoPage(
        slug=slug, title=title, page_type=page_type,
        content=sanitize_rich_content(payload.content) or None, h1=payload.h1 or None, subtitle=payload.subtitle or None,
        meta_title=payload.meta_title or None, meta_description=payload.meta_description or None,
        status=status, created_by=admin.id,
        published_at=now if status == "published" else None,
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return page.to_dict()


@router.patch("/seo-pages/{page_id}")
async def update_seo_page(
    page_id: int, payload: SeoPageUpdateRequest,
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    page = await db.get(SeoPage, page_id)
    if not page: raise HTTPException(404)
    updates = payload.model_dump(exclude_none=True, by_alias=True)
    if "content" in updates:
        updates["content"] = sanitize_rich_content(updates["content"])
    if payload.status == "published" and page.status != "published":
        updates["published_at"] = datetime.now(timezone.utc)
    for k, v in updates.items():
        setattr(page, k, v)
    await db.commit()
    await db.refresh(page)
    return page.to_dict()


@router.delete("/seo-pages/{page_id}")
async def delete_seo_page(page_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    p = await db.get(SeoPage, page_id)
    if not p: raise HTTPException(404)
    await db.delete(p)
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 3: Referral / Affiliate Program
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/referrals")
async def list_referral_partners(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    limit: int = 50, offset: int = 0,
):
    q = select(ReferralPartner).order_by(desc(ReferralPartner.total_earned))
    total = (await db.execute(select(func.count(ReferralPartner.id)))).scalar()
    result = await db.execute(q.offset(offset).limit(limit))
    partners = result.scalars().all()

    uids = [p.user_id for p in partners]
    users_map = {}
    if uids:
        rows = await db.execute(select(User.id, User.email).where(User.id.in_(uids)))
        users_map = dict(rows.fetchall())

    # Get recent transactions per partner
    partner_ids = [p.id for p in partners]
    txn_rows = {}
    if partner_ids:
        txn_result = await db.execute(
            select(ReferralTransaction).where(ReferralTransaction.partner_id.in_(partner_ids))
            .order_by(desc(ReferralTransaction.created_at)).limit(200)
        )
        for t in txn_result.scalars().all():
            txn_rows.setdefault(t.partner_id, []).append(t)

    return {
        "total": total,
        "partners": [{
            "id": p.id, "user_id": p.user_id,
            "user_email": users_map.get(p.user_id, f"#{p.user_id}"),
            "referral_code": p.referral_code,
            "commission_rate": p.commission_rate,
            "total_earned": p.total_earned,
            "total_paid": p.total_paid,
            "referral_count": p.referral_count,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat() if p.created_at else "",
            "recent_transactions": [
                {"id": t.id, "type": t.type, "amount": t.amount,
                 "description": t.description, "status": t.status,
                 "created_at": t.created_at.isoformat() if t.created_at else ""}
                for t in (txn_rows.get(p.id, [])[:5])
            ],
        } for p in partners],
    }


@router.patch("/referrals/{partner_id}")
async def update_referral_partner(
    partner_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    commission_rate: float = None, is_active: bool = None,
):
    p = await db.get(ReferralPartner, partner_id)
    if not p: raise HTTPException(404)
    if commission_rate is not None: p.commission_rate = commission_rate
    if is_active is not None: p.is_active = is_active
    await db.commit()
    return {"ok": True}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 3: Auto-update model prices from OpenRouter
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.post("/models/auto-update-prices")
async def auto_update_prices(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    """Synchronize OpenRouter text, image and video capability snapshots."""
    import httpx
    headers = {
        "User-Agent": "AI-Sphere/1.0 (+https://ai-sphere.ru)",
        "HTTP-Referer": "https://ai-sphere.ru",
        "X-Title": "AI-Sphere",
    }
    if settings.openrouter_api_key:
        headers["Authorization"] = f"Bearer {settings.openrouter_api_key}"
    discovered: dict[str, dict] = {}
    endpoint_errors: list[str] = []
    catalogue_endpoints_ok = True

    async with httpx.AsyncClient(timeout=30, proxy=settings.openrouter_proxy or None) as client:
        for path, forced_output in OPENROUTER_CATALOGUES:
            try:
                response = await client.get(f"{settings.openrouter_base_url}{path}", headers=headers)
                response.raise_for_status()
                for item in response.json().get("data", []):
                    if isinstance(item, dict):
                        _merge_openrouter_catalog_item(discovered, item, forced_output)
            except Exception as exc:
                catalogue_endpoints_ok = False
                endpoint_errors.append(f"{path}: {exc}")

        # Image catalog records expose definitive prices on their per-provider
        # endpoint resource. Hydrate those snapshots with bounded concurrency.
        semaphore = asyncio.Semaphore(8)

        async def hydrate_image_pricing(model_id: str, item: dict) -> None:
            architecture = item.get("architecture") or {}
            outputs = architecture.get("output_modalities") or []
            links = item.get("links") or {}
            endpoint_path = links.get("details") if isinstance(links, dict) else None
            if not set(outputs) & {"image", "video"} or not isinstance(endpoint_path, str):
                return
            base_origin = settings.openrouter_base_url.removesuffix("/api/v1") + "/"
            endpoint_url = endpoint_path if endpoint_path.startswith("http") else urljoin(base_origin, endpoint_path.lstrip("/"))
            try:
                async with semaphore:
                    response = await client.get(endpoint_url, headers=headers)
                response.raise_for_status()
                payload = response.json()
                data = payload.get("data", {}) if isinstance(payload, dict) else {}
                records = data.get("endpoints", []) if isinstance(data, dict) else []
                if not records and isinstance(payload, dict):
                    records = payload.get("endpoints", [])
                item["_endpoint_pricing"] = [
                    record for record in records
                    if isinstance(record, dict)
                ]
            except Exception as exc:
                endpoint_errors.append(f"{model_id}/endpoints: {exc}")

        await asyncio.gather(*(hydrate_image_pricing(model_id, item) for model_id, item in discovered.items()))

    if not discovered:
        error_text = "; ".join(endpoint_errors) or "OpenRouter returned no models"
        db.add(SystemError(
            error_code="ERR_OPENROUTER_CATALOG_SYNC", error_text=error_text[:4000],
            service="openrouter", status="new",
        ))
        await db.commit()
        return {"ok": False, "error": error_text, "catalog_models": 0, "updated": 0, "imported": 0, "enabled": 0, "endpoint_errors": endpoint_errors}

    existing = {
        model.or_model_id: model
        for model in (await db.execute(select(AiModel))).scalars().all()
    }
    updated = 0
    imported = 0
    enabled = 0
    context = await pricing_context(db)
    now = datetime.now(timezone.utc)
    for model_id, item in discovered.items():
        architecture = item.get("architecture") or {}
        input_modalities = architecture.get("input_modalities") or item.get("input_modalities") or ["text"]
        output_modalities = architecture.get("output_modalities") or ["text"]
        pricing = item.get("pricing") or item.get("pricing_skus") or {}
        parameters = {
            key: item[key] for key in (
                "supported_aspect_ratios", "supported_durations",
                "supported_resolutions", "supported_sizes", "supported_frame_images", "generate_audio",
            ) if key in item
        }
        supported = item.get("supported_parameters")
        if isinstance(supported, dict):
            parameters.update(supported)
        elif isinstance(supported, list):
            parameters["api_parameters"] = supported
        model = existing.get(model_id)
        if model is None:
            model = AiModel(
                name=item.get("name") or model_id,
                description=item.get("description") or "",
                provider=model_id.split("/", 1)[0],
                category="media" if set(output_modalities) & {"image", "video"} else "general",
                or_model_id=model_id,
                is_active=False, is_visible=False,
                auto_route_enabled=False,
            )
            db.add(model)
            existing[model_id] = model
            imported += 1
        raw_prompt = pricing.get("prompt", 0) if isinstance(pricing, dict) else 0
        raw_completion = pricing.get("completion", 0) if isinstance(pricing, dict) else 0
        try:
            model.or_input_cost = float(raw_prompt or 0) * 1_000_000
            model.or_output_cost = float(raw_completion or 0) * 1_000_000
        except (TypeError, ValueError):
            pass
        model.name = item.get("name") or model_id
        model.description = item.get("description") or ""
        model.provider = model_id.split("/", 1)[0]
        model.max_context = int(item.get("context_length") or model.max_context or 0)
        model.max_input_tokens = model.max_context
        if "text" in output_modalities:
            model.price_input, model.price_output = text_prices(model.or_input_cost, model.or_output_cost, context)
            model.price_mode = "separate"
            model.price_unit = round((model.price_input + model.price_output) / 2, 2)
            model.fixed_price = 0
        model.input_modalities = json.dumps(input_modalities)
        model.output_modalities = json.dumps(output_modalities)
        model.supported_parameters = json.dumps(parameters)
        pricing_snapshot = {
            "catalog": item.get("pricing", {}),
            "endpoints": item.get("_endpoint_pricing", []),
            "pricing_skus": item.get("pricing_skus", {}),
        }
        model.openrouter_pricing = json.dumps(pricing_snapshot)
        model.vision = "image" in input_modalities
        supported_by_product = bool(set(output_modalities) & {"text", "image", "video"})
        text_priced = "text" in output_modalities and isinstance(pricing, dict) and (
            "prompt" in pricing or "completion" in pricing
        )
        media_kind = "video" if "video" in output_modalities else "image" if "image" in output_modalities else ""
        media_parameters = _media_pricing_parameters(model, media_kind) if media_kind else {}
        media_priced = bool(media_kind and provider_cost_from_snapshot(
            pricing_snapshot, media_kind, media_parameters, conservative=True,
        ) is not None)
        safely_priced = text_priced or media_priced
        model.is_active = supported_by_product and safely_priced
        model.is_visible = model.is_active
        model.auto_route_enabled = model.is_active and bool(set(output_modalities) & {"image", "video"})
        model.margin_min = settings.target_gross_margin
        model.margin = _calc_margin(model, context)
        model.is_unprofitable = model.margin + 0.01 < settings.target_gross_margin * 100
        if model.is_unprofitable:
            model.is_active = False
            model.is_visible = False
            model.auto_route_enabled = False
        else:
            enabled += int(model.is_active)
        model.or_last_updated = str(item.get("created") or item.get("updated") or "") or None
        model.or_last_synced_at = now
        model.catalog_miss_count = 0
        model.availability_status = "available"
        model.last_provider_error = ""
        updated += 1

    hidden = 0
    if catalogue_endpoints_ok:
        for model_id, model in existing.items():
            if model_id in discovered:
                continue
            model.catalog_miss_count = int(model.catalog_miss_count or 0) + 1
            model.or_last_synced_at = now
            if model.catalog_miss_count >= 2:
                model.availability_status = "unavailable"
                model.is_visible = False
                model.is_active = False
                hidden += 1

    await db.commit()
    return {
        "ok": True, "catalog_models": len(discovered), "updated": updated,
        "imported": imported, "enabled": enabled, "hidden_unavailable": hidden,
        "credit_rub_floor": round(context.credit_rub, 6),
        "target_margin_pct": context.target_margin * 100,
        "endpoint_errors": endpoint_errors,
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 3: Forecast analytics
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/analytics/forecast")
async def analytics_forecast(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    days: int = 30,
):
    """Simple forecast based on last N days trend."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    # Daily revenue for last N days
    rev_rows = await db.execute(
        select(
            func.date(Transaction.created_at).label("day"),
            func.coalesce(func.sum(Transaction.rub_amount), 0).label("revenue"),
        ).where(Transaction.type == "topup",
                Transaction.created_at >= since)
        .group_by(func.date(Transaction.created_at)).order_by("day")
    )
    daily_revenue = [{"day": str(r.day), "value": r.revenue} for r in rev_rows.fetchall()]

    # Daily costs
    cost_rows = await db.execute(
        select(
            func.date(Transaction.created_at).label("day"),
            func.coalesce(func.sum(Transaction.amount), 0).label("cost"),
        ).where(Transaction.type == "spend", Transaction.created_at >= since)
        .group_by(func.date(Transaction.created_at)).order_by("day")
    )
    daily_cost = [{"day": str(r.day), "value": r.cost} for r in cost_rows.fetchall()]

    # Simple averages
    rev_values = [r["value"] for r in daily_revenue]
    cost_values = [r["cost"] for r in daily_cost]

    avg_daily_revenue = round(sum(rev_values) / len(rev_values), 2) if rev_values else 0
    avg_daily_cost = round(sum(cost_values) / len(cost_values), 2) if cost_values else 0

    # User growth rate
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    users_before = (await db.execute(
        select(func.count(User.id)).where(User.created_at < since)
    )).scalar() or 0
    growth_rate = round((total_users - users_before) / users_before * 100, 1) if users_before else 0

    return {
        "avg_daily_revenue_kop": avg_daily_revenue,
        "avg_daily_cost_kop": avg_daily_cost,
        "projected_monthly_revenue_kop": round(avg_daily_revenue * 30),
        "projected_monthly_cost_kop": round(avg_daily_cost * 30),
        "user_growth_rate_pct": growth_rate,
        "total_users": total_users,
        "daily_revenue": daily_revenue[-30:],
        "daily_cost": daily_cost[-30:],
        "days_analyzed": len(rev_values),
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 3: Cohort analysis
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/analytics/cohorts")
async def analytics_cohorts(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    """Cohort analysis: users grouped by registration week, with retention."""
    # Get all users with their registration week and first payment info
    users = (await db.execute(
        select(User.id, User.created_at,
               func.coalesce(func.sum(Transaction.rub_amount), 0).label("total_revenue"))
        .outerjoin(Transaction, and_(
            Transaction.user_id == User.id,
            Transaction.type == "topup",
        ))
        .group_by(User.id, User.created_at)
        .order_by(User.created_at)
    )).all()

    # Group by week
    from collections import defaultdict
    cohorts = defaultdict(lambda: {"users": 0, "paying": 0, "revenue": 0, "requests": 0})

    for u in users:
        week_start = u.created_at - timedelta(days=u.created_at.weekday())
        week_key = week_start.strftime("%Y-%m-%d")
        cohorts[week_key]["users"] += 1
        if u.total_revenue > 0:
            cohorts[week_key]["paying"] += 1
        cohorts[week_key]["revenue"] += u.total_revenue

    result = sorted(
        [{"cohort": k, **v} for k, v in cohorts.items()],
        key=lambda x: x["cohort"], reverse=True
    )[:20]  # last 20 weeks

    return {"cohorts": result, "total_cohorts": len(result)}


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 3: LTV Analytics
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/analytics/ltv")
async def analytics_ltv(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    """Customer Lifetime Value analysis."""
    now = datetime.now(timezone.utc)

    # Average revenue per paying user
    paying_users = (await db.execute(
        select(func.count(func.distinct(Transaction.user_id)))
        .where(Transaction.type == "topup")
    )).scalar() or 0

    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(Transaction.rub_amount), 0))
        .where(Transaction.type == "topup")
    )).scalar() or 0

    avg_ltv = round(total_revenue / paying_users, 2) if paying_users else 0

    # Repeat purchase rate
    repeat_payers = (await db.execute(
        select(func.count()).select_from(
            select(Transaction.user_id, func.count(Transaction.id).label("cnt"))
            .where(Transaction.type == "topup")
            .group_by(Transaction.user_id)
            .having(func.count(Transaction.id) >= 2).subquery()
        )
    )).scalar() or 0

    repeat_rate = round(repeat_payers / paying_users * 100, 1) if paying_users else 0

    # Average order value
    total_payments = (await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.type == "topup")
    )).scalar() or 0
    avg_order = round(total_revenue / total_payments, 2) if total_payments else 0

    # Revenue cohorts (new vs returning)
    first_payments = (await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.type == "topup",
               Transaction.user_id.in_(
                   select(User.id).where(
                       User.created_at >= Transaction.created_at - timedelta(hours=1),
                       User.created_at <= Transaction.created_at + timedelta(hours=1),
                   )
               ))
    )).scalar() or 0

    return {
        "avg_ltv_kop": avg_ltv,
        "avg_order_kop": avg_order,
        "paying_users": paying_users,
        "total_revenue_kop": total_revenue,
        "repeat_payers": repeat_payers,
        "repeat_purchase_rate_pct": repeat_rate,
        "first_payment_users": first_payments,
    }


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
# STAGE 3: Retention Analytics
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

@router.get("/analytics/retention")
async def analytics_retention(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    """User retention: D1/D7/D30 after first activity."""
    now = datetime.now(timezone.utc)

    # Users who registered at least 30 days ago
    cutoff = now - timedelta(days=31)
    users = (await db.execute(
        select(User.id, User.created_at)
        .where(User.created_at < cutoff)
        .order_by(User.created_at)
    )).all()

    d1 = d7 = d30 = 0
    total = len(users)

    for u in users:
        if not u.created_at:
            continue
        d1_target = u.created_at + timedelta(days=1)
        d7_target = u.created_at + timedelta(days=7)
        d30_target = u.created_at + timedelta(days=30)

        # Check if user had any activity (transaction or request) by these dates
        activity = (await db.execute(
            select(func.count(Transaction.id))
            .where(Transaction.user_id == u.id,
                   Transaction.created_at > u.created_at,
                   Transaction.created_at <= d1_target)
        )).scalar() or 0
        if activity > 0:
            d1 += 1

        activity_7 = (await db.execute(
            select(func.count(Transaction.id))
            .where(Transaction.user_id == u.id,
                   Transaction.created_at > u.created_at,
                   Transaction.created_at <= d7_target)
        )).scalar() or 0
        if activity_7 > 0:
            d7 += 1

        activity_30 = (await db.execute(
            select(func.count(Transaction.id))
            .where(Transaction.user_id == u.id,
                   Transaction.created_at > u.created_at,
                   Transaction.created_at <= d30_target)
        )).scalar() or 0
        if activity_30 > 0:
            d30 += 1

    return {
        "total_users_analyzed": total,
        "retention": {
            "d1": {"count": d1, "rate": round(d1 / total * 100, 1) if total else 0},
            "d7": {"count": d7, "rate": round(d7 / total * 100, 1) if total else 0},
            "d30": {"count": d30, "rate": round(d30 / total * 100, 1) if total else 0},
        },
    }


# Administrative observability and product-feedback endpoints.

@router.get("/feedback-stats")
async def feedback_stats(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
):
    feedback = (await db.execute(
        select(MessageFeedback).order_by(desc(MessageFeedback.created_at)).limit(limit)
    )).scalars().all()
    totals = {"like": 0, "dislike": 0, "regenerate": 0}
    per_model: dict[str, dict] = {}
    for item in feedback:
        totals[item.feedback_type] = totals.get(item.feedback_type, 0) + 1
        bucket = per_model.setdefault(item.model or "РќРµ СѓРєР°Р·Р°РЅР°", {"total": 0, "likes": 0, "dislikes": 0})
        bucket["total"] += 1
        if item.feedback_type == "like":
            bucket["likes"] += 1
        elif item.feedback_type == "dislike":
            bucket["dislikes"] += 1
    rated = totals["like"] + totals["dislike"]
    return {
        "total": len(feedback),
        "likes": totals["like"],
        "dislikes": totals["dislike"],
        "regenerations": totals["regenerate"],
        "satisfaction_rate": totals["like"] / rated if rated else 0,
        "per_model": [{
            "model": model,
            **values,
            "satisfaction": values["likes"] / (values["likes"] + values["dislikes"])
            if values["likes"] + values["dislikes"] else 0,
        } for model, values in sorted(per_model.items())],
        "recent": [{
            "id": item.id,
            "session_id": item.session_id,
            "message_index": item.message_index,
            "user_id": item.user_id,
            "feedback_type": item.feedback_type,
            "model": item.model,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        } for item in feedback],
    }


@router.get("/feedbacks")
async def list_feedbacks(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    status: str = "", type: str = "", limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
):
    filters = []
    if status:
        filters.append(UserFeedback.status == status)
    if type:
        filters.append(UserFeedback.type == type)
    query = select(UserFeedback, User.email).join(User, User.id == UserFeedback.user_id)
    count_q = select(func.count(UserFeedback.id))
    if filters:
        query = query.where(*filters)
        count_q = count_q.where(*filters)
    rows = (await db.execute(
        query.order_by(desc(UserFeedback.created_at)).offset(offset).limit(limit)
    )).all()
    total = int((await db.execute(count_q)).scalar() or 0)
    return {
        "total": total,
        "feedbacks": [{
            "id": item.id, "user_id": item.user_id, "user_email": email,
            "type": item.type, "subject": item.subject, "message": item.message,
            "rating": item.rating, "source": item.source, "status": item.status,
            "created_at": item.created_at.isoformat() if item.created_at else "",
        } for item, email in rows],
    }


@router.get("/feedbacks/{feedback_id}")
async def get_feedback(feedback_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(
        select(UserFeedback, User.email).join(User, User.id == UserFeedback.user_id).where(UserFeedback.id == feedback_id)
    )).one_or_none()
    if not row:
        raise HTTPException(404, "РћС‚Р·С‹РІ РЅРµ РЅР°Р№РґРµРЅ")
    item, email = row
    replies = (await db.execute(
        select(FeedbackReply).where(FeedbackReply.feedback_id == feedback_id).order_by(FeedbackReply.created_at)
    )).scalars().all()
    return {
        "feedback": {
            "id": item.id, "user_id": item.user_id, "user_email": email,
            "type": item.type, "subject": item.subject, "message": item.message,
            "rating": item.rating, "source": item.source, "status": item.status,
            "created_at": item.created_at.isoformat() if item.created_at else "",
        },
        "replies": [{
            "id": reply.id, "admin_id": reply.admin_id, "message": reply.message,
            "created_at": reply.created_at.isoformat() if reply.created_at else "",
        } for reply in replies],
    }


@router.patch("/feedbacks/{feedback_id}")
async def update_feedback_status(
    feedback_id: int, status: str = Query(pattern="^(new|read|replied|closed)$"),
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    item = await db.get(UserFeedback, feedback_id)
    if not item:
        raise HTTPException(404, "РћС‚Р·С‹РІ РЅРµ РЅР°Р№РґРµРЅ")
    item.status = status
    await db.commit()
    return {"ok": True, "status": status}


@router.post("/feedbacks/{feedback_id}/reply")
async def reply_to_feedback(
    feedback_id: int, message: str = Query(min_length=1, max_length=10000),
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    item = await db.get(UserFeedback, feedback_id)
    if not item:
        raise HTTPException(404, "РћС‚Р·С‹РІ РЅРµ РЅР°Р№РґРµРЅ")
    reply = FeedbackReply(feedback_id=feedback_id, admin_id=admin.id, message=message.strip())
    db.add(reply)
    item.status = "replied"
    await db.commit()
    return {"ok": True}


@router.get("/metrica")
async def get_metrica(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    item = await db.get(AppSetting, "yandex_metrica_id")
    return {"counter_id": item.value if item else "110850288"}


@router.put("/metrica")
async def save_metrica(
    counter_id: str = Query(min_length=1, max_length=20),
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    if not counter_id.isdigit():
        raise HTTPException(422, "ID СЃС‡С‘С‚С‡РёРєР° РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ С‚РѕР»СЊРєРѕ С†РёС„СЂС‹")
    item = await db.get(AppSetting, "yandex_metrica_id")
    if item:
        item.value = counter_id
    else:
        db.add(AppSetting(key="yandex_metrica_id", value=counter_id))
    await db.commit()
    return {"counter_id": counter_id}


@router.get("/analytics/models-feedback")
async def models_feedback_analytics(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    feedback = (await db.execute(select(MessageFeedback))).scalars().all()
    by_model: dict[str, list[int]] = {}
    rating = {"like": 5, "regenerate": 3, "dislike": 1}
    for item in feedback:
        by_model.setdefault(item.model or "РќРµ СѓРєР°Р·Р°РЅР°", []).append(rating.get(item.feedback_type, 3))
    return [{
        "model_name": model,
        "feedback_count": len(values),
        "avg_rating": round(sum(values) / len(values), 1),
    } for model, values in sorted(by_model.items())]


@router.get("/analytics/problems")
async def analytics_problems(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    errors = (await db.execute(
        select(SystemError).where(SystemError.created_at >= cutoff).order_by(desc(SystemError.repeat_count))
    )).scalars().all()
    grouped: dict[str, dict] = {}
    for error in errors:
        label = error.error_text or error.error_code or error.service
        bucket = grouped.setdefault(label, {"problem": label, "users": set(), "count": 0})
        bucket["count"] += max(error.repeat_count or 1, 1)
        if error.user_id:
            bucket["users"].add(error.user_id)
    result = [{
        "problem": value["problem"],
        "users_count": len(value["users"]),
        "lost_revenue": 0,
        "priority": "high" if value["count"] >= 10 else "medium",
    } for value in grouped.values()]
    failed = (await db.execute(
        select(PaymentAttempt).where(PaymentAttempt.status == "failed", PaymentAttempt.created_at >= cutoff)
    )).scalars().all()
    if failed:
        result.insert(0, {
            "problem": "РќРµСѓСЃРїРµС€РЅС‹Рµ РїР»Р°С‚РµР¶Рё",
            "users_count": len({item.user_id for item in failed}),
            "lost_revenue": round(sum(item.amount_kopecks for item in failed) / 100, 2),
            "priority": "high",
        })
    return result


@router.get("/analytics/user-segments")
async def user_segments(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(User).where(User.is_admin == False))).scalars().all()
    now = datetime.now(timezone.utc)
    segments = {name: {"count": 0, "users": []} for name in (
        "inactive", "new", "activated", "interested", "almost_buying", "active_free", "paying", "vip"
    )}
    for user in users:
        age_days = (now.replace(tzinfo=None) - user.created_at.replace(tzinfo=None)).days if user.created_at else 0
        if user.total_paid_rub >= 100000:
            segment = "vip"
        elif user.total_paid_rub > 0:
            segment = "paying"
        elif user.request_count >= 10:
            segment = "active_free"
        elif user.request_count >= 5:
            segment = "almost_buying"
        elif user.request_count >= 2:
            segment = "interested"
        elif user.request_count == 1:
            segment = "activated"
        elif age_days <= 7:
            segment = "new"
        else:
            segment = "inactive"
        row = {
            "id": user.id, "email": user.email, "credits": user.credits,
            "request_count": user.request_count, "total_paid_rub": round(user.total_paid_rub / 100, 2),
            "last_seen": user.last_seen.isoformat() if user.last_seen else None,
        }
        segments[segment]["users"].append(row)
        segments[segment]["count"] += 1
    return segments


@router.get("/analytics/request-categories")
async def request_categories(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(UserQuery, User.total_paid_rub).join(User, User.id == UserQuery.user_id)
        .order_by(desc(UserQuery.created_at)).limit(500)
    )).all()
    definitions = [
        ("РџСЂРѕРіСЂР°РјРјРёСЂРѕРІР°РЅРёРµ", ("РєРѕРґ", "python", "javascript", "api", "РѕС€РёР±Рє", "С„СѓРЅРєС†Рё")),
        ("РўРµРєСЃС‚С‹ Рё РєРѕРЅС‚РµРЅС‚", ("РЅР°РїРёС€Рё", "С‚РµРєСЃС‚", "СЃС‚Р°С‚СЊ", "РїРѕСЃС‚", "РїРµСЂРµРІРѕРґ", "СЂРµР·СЋРјРµ")),
        ("РњР°СЂРєРµС‚РёРЅРі", ("РјР°СЂРєРµС‚", "СЂРµРєР»Р°Рј", "РїСЂРѕРґР°Р¶", "Р°СѓРґРёС‚РѕСЂ", "seo")),
        ("РђРЅР°Р»РёС‚РёРєР°", ("Р°РЅР°Р»РёР·", "С‚Р°Р±Р»РёС†", "РґР°РЅРЅ", "РѕС‚С‡С‘С‚", "СЃСЂР°РІРЅРё")),
        ("РР·РѕР±СЂР°Р¶РµРЅРёСЏ", ("РёР·РѕР±СЂР°Р¶", "РєР°СЂС‚РёРЅ", "С„РѕС‚Рѕ", "РЅР°СЂРёСЃ", "Р»РѕРіРѕС‚РёРї")),
    ]
    buckets: dict[str, dict] = {}
    for query, paid in rows:
        text = query.content.lower()
        category = next((name for name, words in definitions if any(word in text for word in words)), "Р”СЂСѓРіРѕРµ")
        bucket = buckets.setdefault(category, {"count": 0, "paying": set(), "revenue": 0})
        bucket["count"] += 1
        if paid > 0:
            bucket["paying"].add(query.user_id)
            bucket["revenue"] += paid
    total = len(rows)
    return [{
        "category": category,
        "count": value["count"],
        "share_pct": round(value["count"] / total * 100, 1) if total else 0,
        "paying_users": len(value["paying"]),
        "avg_cheque": round(value["revenue"] / max(len(value["paying"]), 1) / 100, 2),
        "potential": "high" if value["count"] >= max(total * .25, 5) else "medium" if value["count"] >= 2 else "low",
    } for category, value in sorted(buckets.items(), key=lambda item: item[1]["count"], reverse=True)]


@router.get("/payments/abandoned")
async def abandoned_payments(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
):
    rows = (await db.execute(
        select(PaymentAttempt, User.email).join(User, User.id == PaymentAttempt.user_id)
        .where(PaymentAttempt.status.in_(("pending", "failed")))
        .order_by(desc(PaymentAttempt.created_at)).limit(limit)
    )).all()
    return [{
        "id": item.id, "user_email": email, "amount_rub": round(item.amount_kopecks / 100, 2),
        "credits": item.credits, "status": item.status, "error": item.failure_reason,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    } for item, email in rows]


@router.get("/surveys/results")
async def survey_results(_=Depends(require_admin)):
    return {}

