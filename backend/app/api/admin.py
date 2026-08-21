"""Admin API — unified admin panel for AI-Sphere.

Covers MVP (этап 1): roles, dashboard, users, models, tariffs,
payments, credit operations, logs, system errors.
"""

from datetime import datetime, timedelta, timezone, date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from jose import jwt
from sqlalchemy import select, desc, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
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
from app.models.file_record import FileRecord
from app.models.support_ticket import SupportTicket, TicketMessage
from app.models.notification import Notification
from app.models.fraud_alert import FraudAlert
from app.models.seo_page import SeoPage
from app.models.referral import ReferralPartner, ReferralTransaction

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ═══════════════════════════════════════════════
# Admin auth
# ═══════════════════════════════════════════════

def create_admin_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=8)
    return jwt.encode({"sub": "admin", "role": "admin", "exp": expire},
                      settings.secret_key, algorithm=settings.algorithm)

def decode_admin_token(token: str) -> dict | None:
    try:
        p = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return p if p.get("role") == "admin" else None
    except Exception:
        return None


async def require_admin(authorization: Annotated[str | None, Header()] = None) -> None:
    if not authorization:
        raise HTTPException(401, "Требуется авторизация администратора")
    token = authorization.removeprefix("Bearer ")
    if decode_admin_token(token) is None:
        raise HTTPException(401, "Недействительный токен администратора")


# ── Login ──

@router.post("/login")
async def admin_login(login: str = Query(...), password: str = Query(...)):
    if login != settings.admin_login or password != settings.admin_password:
        raise HTTPException(401, "Неверный логин или пароль")
    return {"token": create_admin_token(), "expires_in": 8 * 3600}


# ── Helper: log admin action ──

async def log_action(db: AsyncSession, admin_id: int, action: str, **kw):
    log = AdminLog(admin_id=admin_id, action=action, **kw)
    db.add(log)
    await db.flush()


# ═══════════════════════════════════════════════
# Dashboard
# ═══════════════════════════════════════════════

@router.get("/dashboard/stats")
async def dashboard_stats(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    period: str = Query("today", regex="^(today|yesterday|7d|30d|month|prev_month)$"),
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
            "message": f"Модель «{m.name}» работает в минус (маржа {m.margin:.1f}%)",
        })

    # OpenRouter balance low (check not possible without OR API call — placeholder)
    warnings.append({
        "type": "info",
        "severity": "info",
        "message": f"Моделей с отрицательной маржой: {len(bad_models)}",
    })

    return {"warnings": warnings}


# ═══════════════════════════════════════════════
# Roles
# ═══════════════════════════════════════════════

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
    if role.is_system: raise HTTPException(400, "Нельзя удалить системную роль")
    # Unassign users with this role
    await db.execute(User.__table__.update().where(User.role_id == role_id).values(role_id=None))
    await db.delete(role)
    await db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════
# Users
# ═══════════════════════════════════════════════

@router.get("/users")
async def list_users(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
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
    if not user: raise HTTPException(404, "Пользователь не найден")

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
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    if amount <= 0: raise HTTPException(400, "Сумма должна быть положительной")
    user = await db.get(User, user_id)
    if not user: raise HTTPException(404)

    col = {"paid": "credits_paid", "free": "credits_free",
           "bonus": "credits_bonus", "promo": "credits_promo"}
    col_name = col.get(credit_type)
    if not col_name: raise HTTPException(400, "Неизвестный тип кредитов")

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


# ═══════════════════════════════════════════════
# AI Models
# ═══════════════════════════════════════════════

def _calc_margin(model: AiModel) -> float:
    """Рассчитать маржу по минимальной цене кредита (0.0833₽)."""
    credit_rate = 0.0833  # рублей за кредит (премиум-тариф)
    usd_rate = 95.0       # примерный курс — будет из настроек
    # Средняя себестоимость на 1K токенов (input + output) / 2
    avg_cost_usd = (model.or_input_cost + model.or_output_cost) / 2 / 1000  # per 1K
    cost_rub = avg_cost_usd * usd_rate
    # Цена в кредитах за 1K токенов
    if model.price_mode == "separate":
        price = (model.price_input + model.price_output) / 2
    else:
        price = model.price_unit
    revenue = price * credit_rate
    if cost_rub <= 0: return 100.0
    margin = (revenue - cost_rub) / revenue * 100 if revenue > 0 else 0
    return round(margin, 2)


@router.get("/models")
async def list_models(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    category: str = "", provider: str = "",
):
    q = select(AiModel).order_by(AiModel.sort_order, AiModel.name)
    if category: q = q.where(AiModel.category == category)
    if provider: q = q.where(AiModel.provider == provider)
    result = await db.execute(q)
    return [
        {
            "id": m.id, "name": m.name, "provider": m.provider,
            "or_model_id": m.or_model_id, "category": m.category,
            "price_input": m.price_input, "price_output": m.price_output,
            "price_unit": m.price_unit, "or_input_cost": m.or_input_cost,
            "or_output_cost": m.or_output_cost,
            "margin": _calc_margin(m),
            "is_unprofitable": m.is_unprofitable,
            "is_active": m.is_active, "is_visible": m.is_visible,
            "is_free_available": m.is_free_available,
            "vision": m.vision, "request_count": m.request_count,
            "error_count": m.error_count, "avg_response_time": m.avg_response_time,
            "sort_order": m.sort_order,
        }
        for m in result.scalars().all()
    ]


@router.get("/models/{model_id}")
async def get_model(model_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    model = await db.get(AiModel, model_id)
    if not model: raise HTTPException(404)
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
        "margin": _calc_margin(model),
        "margin_min": model.margin_min,
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
    }


@router.patch("/models/{model_id}")
async def update_model(model_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
                       price_input: float | None = None, price_output: float | None = None,
                       price_unit: float | None = None, price_mode: str | None = None,
                       markup_factor: float | None = None,
                       is_active: bool | None = None, is_visible: bool | None = None,
                       is_free_available: bool | None = None,
                       margin_min: float | None = None,
                       sort_order: int | None = None):
    model = await db.get(AiModel, model_id)
    if not model: raise HTTPException(404)
    for k, v in {"price_input": price_input, "price_output": price_output,
                 "price_unit": price_unit, "price_mode": price_mode,
                 "markup_factor": markup_factor,
                 "is_active": is_active, "is_visible": is_visible,
                 "is_free_available": is_free_available,
                 "margin_min": margin_min, "sort_order": sort_order}.items():
        if v is not None:
            setattr(model, k, v)
    # Recalculate margin
    model.margin = _calc_margin(model)
    model.is_unprofitable = model.margin < model.margin_min * 100
    await db.commit()
    return {"ok": True, "margin": model.margin, "is_unprofitable": model.is_unprofitable}


@router.post("/models/{model_id}/recalc")
async def recalc_model(model_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    model = await db.get(AiModel, model_id)
    if not model: raise HTTPException(404)
    model.margin = _calc_margin(model)
    model.is_unprofitable = model.margin < model.margin_min * 100
    await db.commit()
    return {"ok": True, "margin": model.margin, "is_unprofitable": model.is_unprofitable}


# ═══════════════════════════════════════════════
# Credit Plans (Tariffs)
# ═══════════════════════════════════════════════

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
    name: str = Query(...), credits: int = Query(...), price_rub: int = Query(...),
    bonus_credits: int = Query(0), old_price_rub: int | None = None,
    badge: str | None = None, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    plan = CreditPlan(name=name, credits=credits, price_rub=price_rub,
                      bonus_credits=bonus_credits, old_price_rub=old_price_rub, badge=badge)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return {"id": plan.id, "name": plan.name, "credit_price": plan.credit_price}


@router.patch("/plans/{plan_id}")
async def update_plan(plan_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
                      is_active: bool | None = None, sort_order: int | None = None):
    plan = await db.get(CreditPlan, plan_id)
    if not plan: raise HTTPException(404)
    if is_active is not None: plan.is_active = is_active
    if sort_order is not None: plan.sort_order = sort_order
    await db.commit()
    return {"ok": True}


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    plan = await db.get(CreditPlan, plan_id)
    if not plan: raise HTTPException(404)
    await db.delete(plan)
    await db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════
# Payments / Transactions
# ═══════════════════════════════════════════════

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
    user_map = dict(await users_r.fetchall())
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


# ═══════════════════════════════════════════════
# Credit Operations Journal
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# Admin Log
# ═══════════════════════════════════════════════

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
    admin_map = dict(await admins_r.fetchall())
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


# ═══════════════════════════════════════════════
# System Errors
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# Promo codes (enhanced)
# ═══════════════════════════════════════════════

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
    existing = await db.execute(select(PromoCode).where(PromoCode.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Такой код уже существует")
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


# ═══════════════════════════════════════════════
# STAGE 2: Chats
# ═══════════════════════════════════════════════

@router.get("/chats")
async def list_chats(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    search: str = "", model: str = "", user_id: int | None = None,
    limit: int = 50, offset: int = 0,
):
    q = select(ChatSession).order_by(desc(ChatSession.updated_at))
    cq = select(func.count(ChatSession.id))
    if search:
        like = f"%{search}%"
        q = q.where(ChatSession.title.ilike(like))
        cq = cq.where(ChatSession.title.ilike(like))
    if model:
        q = q.where(ChatSession.model == model)
        cq = cq.where(ChatSession.model == model)
    if user_id:
        q = q.where(ChatSession.user_id == user_id)
        cq = cq.where(ChatSession.user_id == user_id)
    total = (await db.execute(cq)).scalar()
    result = await db.execute(q.offset(offset).limit(limit))
    chats = result.scalars().all()

    # Get message counts per session
    sess_ids = [c.session_id for c in chats]
    msg_counts = {}
    if sess_ids:
        count_rows = await db.execute(
            select(ChatMessage.session_id, func.count(ChatMessage.id)).where(
                ChatMessage.session_id.in_(sess_ids), ChatMessage.is_deleted == False
            ).group_by(ChatMessage.session_id)
        )
        msg_counts = dict(await count_rows.fetchall() or [])

    return {
        "total": total,
        "chats": [{
            "id": c.id, "session_id": c.session_id, "user_id": c.user_id,
            "title": c.title or "(без названия)", "model": c.model,
            "credits_spent": c.credits_spent, "or_cost": c.or_cost,
            "message_count": msg_counts.get(c.session_id, 0),
            "created_at": c.created_at.isoformat() if c.created_at else "",
            "updated_at": c.updated_at.isoformat() if c.updated_at else "",
        } for c in chats],
    }


@router.get("/chats/{session_id}")
async def get_chat_messages(
    session_id: str, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    limit: int = 100, offset: int = 0,
):
    session = await db.execute(select(ChatSession).where(ChatSession.session_id == session_id))
    session = session.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Чат не найден")

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


# ═══════════════════════════════════════════════
# STAGE 2: Files
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# STAGE 2: Support Tickets
# ═══════════════════════════════════════════════

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
        users_map = dict(await u_rows.fetchall())

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
    ticket_id: int, content: str = Query(...),
    is_internal: bool = False,
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket: raise HTTPException(404)
    msg = TicketMessage(ticket_id=ticket_id, user_id=0, content=content, is_internal=is_internal)
    ticket.status = "in_progress" if ticket.status == "new" else ticket.status
    ticket.last_message_at = datetime.now(timezone.utc)
    db.add(msg)
    await db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════
# STAGE 2: Notifications
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# STAGE 2: Fraud Alerts
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# STAGE 2: Advanced analytics
# ═══════════════════════════════════════════════

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
    revenue_by_day = [{"day": str(r.day), "value": r.revenue} for r in await rev_rows.fetchall()]

    cost_rows = await db.execute(
        select(
            func.date(Transaction.created_at).label("day"),
            func.coalesce(func.sum(Transaction.amount), 0).label("cost"),
        ).where(Transaction.type == "spend", Transaction.created_at >= since)
        .group_by(func.date(Transaction.created_at)).order_by("day")
    )
    cost_by_day = [{"day": str(r.day), "value": r.cost} for r in await cost_rows.fetchall()]

    # Registrations by day
    reg_rows = await db.execute(
        select(func.date(User.created_at).label("day"), func.count(User.id).label("cnt"))
        .where(User.created_at >= since).group_by(func.date(User.created_at)).order_by("day")
    )
    reg_by_day = [{"day": str(r.day), "value": r.cnt} for r in await reg_rows.fetchall()]

    # Payments by day
    pay_rows = await db.execute(
        select(func.date(Transaction.created_at).label("day"), func.count(Transaction.id).label("cnt"))
        .where(Transaction.type == "topup", Transaction.created_at >= since)
        .group_by(func.date(Transaction.created_at)).order_by("day")
    )
    pay_by_day = [{"day": str(r.day), "value": r.cnt} for r in await pay_rows.fetchall()]

    # Top models by cost
    cost_model_rows = await db.execute(
        select(ChatMessage.model, func.coalesce(func.sum(ChatMessage.cost_or), 0).label("cost"))
        .where(ChatMessage.created_at >= since, ChatMessage.model.isnot(None))
        .group_by(ChatMessage.model).order_by(desc("cost")).limit(10)
    )
    top_models = [{"model": r.model, "cost": r.cost} for r in await cost_model_rows.fetchall()]

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

    return {
        "funnel": [
            {"stage": "Зарегистрировано", "count": total_reg},
            {"stage": "Совершили запрос", "count": active_users},
            {"stage": "Оплатили хотя бы раз", "count": paid_users,
             "conversion": round(paid_users / total_reg * 100, 1) if total_reg else 0},
            {"stage": "Повторная оплата", "count": repeat_payers,
             "conversion": round(repeat_payers / paid_users * 100, 1) if paid_users else 0},
        ],
        "total_registrations": total_reg,
        "active_users": active_users,
        "paying_users": paid_users,
        "repeat_payers": repeat_payers,
    }


# ═══════════════════════════════════════════════
# STAGE 3: SEO Pages
# ═══════════════════════════════════════════════

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
    slug: str = Query(...), title: str = Query(...),
    page_type: str = Query("article"),
    content: str = Query(""), h1: str = "", subtitle: str = "",
    meta_title: str = "", meta_description: str = "",
    status: str = Query("draft"),
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    if slug in ("admin", "api", "login", "register", ""):
        raise HTTPException(400, "Недопустимый slug")
    existing = await db.execute(select(SeoPage).where(SeoPage.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Страница с slug '{slug}' уже существует")
    now = datetime.now(timezone.utc)
    page = SeoPage(
        slug=slug, title=title, page_type=page_type,
        content=content or None, h1=h1 or None, subtitle=subtitle or None,
        meta_title=meta_title or None, meta_description=meta_description or None,
        status=status, created_by=0,
        published_at=now if status == "published" else None,
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return page.to_dict()


@router.patch("/seo-pages/{page_id}")
async def update_seo_page(
    page_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db),
    title: str = None, content: str = None, h1: str = None,
    subtitle: str = None, meta_title: str = None,
    meta_description: str = None, meta_keywords: str = None,
    canonical: str = None, robots: str = None, schema_json: str = None,
    status: str = None, image: str = None, author: str = None,
    category: str = None, is_visible: bool = None,
    sort_order: int = None, cta_text: str = None, cta_link: str = None,
    model_id: str = None, related_slugs: str = None,
):
    page = await db.get(SeoPage, page_id)
    if not page: raise HTTPException(404)
    updates = {
        k: v for k, v in {
            "title": title, "content": content, "h1": h1,
            "subtitle": subtitle, "meta_title": meta_title,
            "meta_description": meta_description, "meta_keywords": meta_keywords,
            "canonical": canonical, "robots": robots, "schema_json": schema_json,
            "status": status, "image": image, "author": author,
            "category": category, "is_visible": is_visible,
            "sort_order": sort_order, "cta_text": cta_text,
            "cta_link": cta_link, "model_id": model_id,
            "related_slugs": related_slugs,
        }.items() if v is not None
    }
    if status == "published" and page.status != "published":
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


# ═══════════════════════════════════════════════
# STAGE 3: Referral / Affiliate Program
# ═══════════════════════════════════════════════

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
        users_map = dict(await rows.fetchall())

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


# ═══════════════════════════════════════════════
# STAGE 3: Auto-update model prices from OpenRouter
# ═══════════════════════════════════════════════

@router.post("/models/auto-update-prices")
async def auto_update_prices(
    _=Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    """Fetch current prices from OpenRouter and update cost prices.
    Only updates cost prices (or_cost_in / or_cost_out), not user-facing prices.
    """
    import httpx
    models = (await db.execute(select(AiModel).where(AiModel.is_active == True))).scalars().all()
    updated = 0
    errors = []

    proxy = settings.openrouter_proxy or None
    async with httpx.AsyncClient(timeout=15, proxy=proxy) as client:
        try:
            resp = await client.get("https://openrouter.ai/api/v1/models")
            if resp.status_code != 200:
                return {"ok": False, "error": f"OpenRouter API returned {resp.status_code}"}
            or_models = {m["id"]: m for m in resp.json().get("data", [])}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    for model in models:
        if model.or_model_id in or_models:
            om = or_models[model.or_model_id]
            pricing = om.get("pricing", {})
            new_in = float(pricing.get("prompt", 0))
            new_out = float(pricing.get("completion", 0))
            if new_in > 0 or new_out > 0:
                model.or_cost_in = new_in
                model.or_cost_out = new_out
                updated += 1
        else:
            errors.append(model.or_model_id)

    await db.commit()
    return {
        "ok": True,
        "updated": updated,
        "not_found": errors[:10],
        "total_models": len(models),
    }


# ═══════════════════════════════════════════════
# STAGE 3: Forecast analytics
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# STAGE 3: Cohort analysis
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# STAGE 3: LTV Analytics
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# STAGE 3: Retention Analytics
# ═══════════════════════════════════════════════

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
