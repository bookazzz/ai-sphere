"""Billing API: plans, top-up, webhook, balance, history."""

import hmac
import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.models.credit_plan import CreditPlan
from app.models.payment_attempt import PaymentAttempt
from app.models.promo import PromoCode, PromoRedemption
from app.models.credit_op import CreditOperation
from app.core.credits import moscow_today
from app.core.product_events import record_server_event
from app.schemas.billing import (
    PlanInfo,
    TopUpRequest,
    TopUpResponse,
    BalanceResponse,
    TransactionInfo,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])

PLATEGA_BASE = "https://app.platega.io"


class PromoRedeemRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)



def _platega_configured() -> bool:
    """Check if Platega credentials are available."""
    return bool(settings.platega_merchant_id and settings.platega_secret_key)


def _platega_headers() -> dict[str, str]:
    """Return auth headers for Platega API."""
    return {
        "X-MerchantId": settings.platega_merchant_id,
        "X-Secret": settings.platega_secret_key,
        "Content-Type": "application/json",
    }


def _verify_platega_callback(merchant_id: str, secret: str) -> bool:
    """Authenticate callback headers exactly as required by Platega."""
    return bool(
        merchant_id
        and secret
        and hmac.compare_digest(merchant_id, settings.platega_merchant_id)
        and hmac.compare_digest(secret, settings.platega_secret_key)
    )


async def _create_platega_payment(
    amount_rub: float,
    description: str,
    metadata: dict,
) -> tuple[str, str]:
    """Create a payment link via Platega API.

    Returns (payment_id, payment_url).
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLATEGA_BASE}/v2/transaction/process",
            headers=_platega_headers(),
            json={
                "paymentDetails": {"amount": amount_rub, "currency": "RUB"},
                "description": description,
                "return": settings.platega_return_url,
                "failedUrl": settings.platega_fail_url or settings.platega_return_url,
                "payload": metadata["attempt_id"],
                "metadata": {
                    "userId": metadata["user_id"],
                    "userName": metadata["email"],
                },
            },
            timeout=15,
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Platega error: {resp.status_code} {resp.text[:200]}",
        )

    data = resp.json()
    payment_id = data.get("transactionId", "")
    payment_url = data.get("url", "")
    if not payment_id or not payment_url:
        raise HTTPException(status_code=502, detail="Platega не вернул идентификатор или ссылку на оплату")
    return payment_id, payment_url


def _plan_is_available(plan: CreditPlan) -> bool:
    today = date.today()
    return bool(
        plan.is_active
        and (plan.start_date is None or plan.start_date <= today)
        and (plan.end_date is None or plan.end_date >= today)
    )


@router.get("/plans", response_model=list[PlanInfo])
async def get_plans(db: AsyncSession = Depends(get_db)):
    """Return available credit plans."""
    result = await db.execute(select(CreditPlan).order_by(CreditPlan.sort_order, CreditPlan.id))
    return [
        PlanInfo(
            id=str(plan.id),
            name=plan.name,
            price=plan.price_rub,
            credits=plan.credits,
            bonus=plan.bonus_credits,
            popular=plan.sort_order == 3,
        )
        for plan in result.scalars().all()
        if _plan_is_available(plan)
    ]


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: User = Depends(get_current_user)):
    """Get current user credit balance."""
    return BalanceResponse(credits=user.credits)


@router.post("/redeem-promo")
async def redeem_promo(
    payload: PromoRedeemRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Atomically redeem an active promo once per user."""
    code = payload.code.strip().upper()
    promo = (await db.execute(select(PromoCode).where(PromoCode.code == code))).scalar_one_or_none()
    if promo is None or not promo.is_active:
        raise HTTPException(404, "Промокод не найден или неактивен")
    if promo.expires_at and promo.expires_at < moscow_today():
        raise HTTPException(410, "Срок действия промокода истёк")
    if promo.credits <= 0:
        raise HTTPException(409, "Промокод настроен некорректно")
    already = (await db.execute(select(PromoRedemption.id).where(
        PromoRedemption.promo_id == promo.id, PromoRedemption.user_id == user.id,
    ))).scalar_one_or_none()
    if already:
        raise HTTPException(409, "Промокод уже активирован")
    if promo.max_uses > 0:
        claimed = await db.execute(
            update(PromoCode)
            .where(PromoCode.id == promo.id, PromoCode.used_count < PromoCode.max_uses)
            .values(used_count=PromoCode.used_count + 1)
            .execution_options(synchronize_session=False)
        )
        if claimed.rowcount != 1:
            await db.rollback()
            raise HTTPException(409, "Лимит активаций промокода исчерпан")
    else:
        await db.execute(update(PromoCode).where(PromoCode.id == promo.id).values(used_count=PromoCode.used_count + 1))
    before = user.credits
    try:
        db.add(PromoRedemption(promo_id=promo.id, user_id=user.id, credits=promo.credits))
        await db.execute(update(User).where(User.id == user.id).values(credits_promo=User.credits_promo + promo.credits))
        db.add(CreditOperation(
            user_id=user.id, op_type="promo", credit_type="promo", amount=promo.credits,
            balance_before=before, balance_after=before + promo.credits,
            source=code, related_id=f"promo:{promo.id}", comment="Активация промокода",
        ))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Промокод уже активирован")
    return {"ok": True, "credits_added": promo.credits, "total_credits": before + promo.credits}


@router.post("/top-up", response_model=TopUpResponse)
async def top_up(
    req: TopUpRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create payment request — Platega with email, or fallback if not configured."""
    try:
        plan_id = int(req.plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неизвестный тариф")
    plan = await db.get(CreditPlan, plan_id)
    if plan is None or not _plan_is_available(plan):
        raise HTTPException(status_code=400, detail="Неизвестный тариф")

    if plan.is_new_users_only and user.total_paid_rub > 0:
        raise HTTPException(status_code=400, detail="Тариф доступен только новым пользователям")
    if plan.purchase_limit and plan.purchase_count >= plan.purchase_limit:
        raise HTTPException(status_code=409, detail="Лимит покупок тарифа исчерпан")

    amount_kopecks = plan.price_rub
    amount_rub = amount_kopecks / 100
    credits = plan.credits + plan.bonus_credits

    if not _platega_configured():
        raise HTTPException(status_code=503, detail="Платёжный сервис временно недоступен")

    attempt = PaymentAttempt(
        id=str(uuid.uuid4()), user_id=user.id, plan_id=plan.id,
        amount_kopecks=amount_kopecks, currency="RUB", credits=credits, status="pending",
    )
    db.add(attempt)
    await record_server_event(
        db, user, "checkout_started", task_type="billing",
        metadata={"plan_id": str(plan.id)},
    )
    await db.commit()

    try:
        payment_id, payment_url = await _create_platega_payment(
            amount_rub=amount_rub,
            description=f"AI-Sphere: {plan.name} ({credits} кредитов)",
            metadata={
                "attempt_id": attempt.id,
                "user_id": str(user.id),
                "email": user.email,
            },
        )
    except Exception as exc:
        attempt.status = "failed"
        attempt.failure_reason = f"provider_create: {type(exc).__name__}"[:500]
        attempt.processed_at = datetime.now(timezone.utc)
        await record_server_event(
            db, user, "payment_failed", task_type="billing",
            metadata={"plan_id": str(plan.id), "error_code": "provider_create"},
        )
        await db.commit()
        raise
    attempt.provider_payment_id = payment_id
    await db.commit()

    return TopUpResponse(
        payment_id=payment_id,
        payment_url=payment_url,
    )


@router.post("/webhook")
async def billing_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Platega payment notifications."""
    body_bytes = await request.body()

    if not settings.platega_secret_key:
        raise HTTPException(status_code=503, detail="Webhook secret is not configured")
    merchant_id = request.headers.get("X-MerchantId", "")
    callback_secret = request.headers.get("X-Secret", "")
    if not _verify_platega_callback(merchant_id, callback_secret):
        raise HTTPException(status_code=401, detail="Invalid callback credentials")

    try:
        data = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    status_val = str(data.get("status", "")).upper()
    if status_val not in {"CONFIRMED", "CANCELED", "CHARGEBACKED"}:
        raise HTTPException(status_code=400, detail="Unknown payment status")

    payment_id = data.get("id", "")
    if not payment_id:
        raise HTTPException(status_code=400, detail="Missing payment id")

    attempt = (await db.execute(select(PaymentAttempt).where(PaymentAttempt.provider_payment_id == str(payment_id)))).scalar_one_or_none()
    if attempt is None:
        raise HTTPException(status_code=404, detail="Unknown payment")

    raw_amount = data.get("amount")
    currency = str(data.get("currency", "")).upper()
    try:
        kopecks_decimal = Decimal(str(raw_amount)) * 100
        if kopecks_decimal != kopecks_decimal.to_integral_value():
            raise InvalidOperation
        webhook_kopecks = int(kopecks_decimal)
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid amount")
    if webhook_kopecks != attempt.amount_kopecks or currency != attempt.currency:
        raise HTTPException(status_code=400, detail="Payment amount or currency mismatch")

    if attempt.status == "succeeded" and status_val == "CONFIRMED":
        return {"ok": True}
    if attempt.status != "pending":
        raise HTTPException(status_code=409, detail="Payment is not pending")

    if status_val != "CONFIRMED":
        attempt.status = "failed"
        attempt.failure_reason = status_val.lower()
        attempt.processed_at = datetime.now(timezone.utc)
        failed_user = await db.get(User, attempt.user_id)
        await record_server_event(
            db, failed_user, "payment_failed", task_type="billing",
            metadata={"plan_id": str(attempt.plan_id), "error_code": status_val.lower()},
        )
        await db.commit()
        return {"ok": True}

    claimed = await db.execute(
        update(PaymentAttempt)
        .where(PaymentAttempt.id == attempt.id, PaymentAttempt.status == "pending")
        .values(status="processing")
    )
    if claimed.rowcount != 1:
        await db.rollback()
        return {"ok": True}

    await db.execute(
        update(User).where(User.id == attempt.user_id).values(
            credits_paid=User.credits_paid + attempt.credits,
            total_paid_rub=User.total_paid_rub + attempt.amount_kopecks,
        )
    )
    plan = await db.get(CreditPlan, attempt.plan_id)
    if plan:
        plan.purchase_count += 1
        plan.total_revenue_rub += attempt.amount_kopecks
    db.add(Transaction(
        user_id=attempt.user_id, amount=attempt.credits, rub_amount=attempt.amount_kopecks,
        type="topup", description=f"Пополнение: {attempt.credits} кредитов", payment_id=str(payment_id),
    ))
    attempt.status = "succeeded"
    attempt.processed_at = datetime.now(timezone.utc)
    payment_user = await db.get(User, attempt.user_id)
    await record_server_event(
        db, payment_user, "payment_succeeded", task_type="billing",
        metadata={"plan_id": str(attempt.plan_id)},
    )
    await db.commit()

    return {"ok": True}


@router.get("/history", response_model=list[TransactionInfo])
async def get_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
):
    """Get last N transactions for current user."""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(desc(Transaction.created_at))
        .limit(limit)
    )
    txs = result.scalars().all()
    return [
        TransactionInfo(
            id=tx.id,
            amount=tx.amount,
            rub_amount=tx.rub_amount,
            type=tx.type,
            description=tx.description,
            created_at=tx.created_at.isoformat() if tx.created_at else "",
        )
        for tx in txs
    ]
