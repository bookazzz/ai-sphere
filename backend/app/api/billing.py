"""Billing API: plans, top-up, webhook, balance, history."""

import hashlib
import hmac
import json
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.billing import (
    PlanInfo,
    TopUpRequest,
    TopUpResponse,
    BalanceResponse,
    TransactionInfo,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])

PLATEGA_BASE = "https://app.platega.io"

CREDIT_PLANS = [
    {"id": "starter",  "name": "Стартовый",  "price": 50,   "credits": 500,   "bonus": 0},
    {"id": "basic",    "name": "Базовый",    "price": 250,  "credits": 2500,  "bonus": 0},
    {"id": "popular",  "name": "Популярный", "price": 1000, "credits": 10000, "bonus": 1500, "popular": True},
    {"id": "premium",  "name": "Премиум",    "price": 2500, "credits": 25000, "bonus": 5000},
]


def _platega_configured() -> bool:
    """Check if Platega credentials are available."""
    return bool(settings.platega_merchant_id and settings.platega_secret_key)


def _platega_headers() -> dict[str, str]:
    """Return auth headers for Platega API."""
    return {
        "Merchant": settings.platega_merchant_id,
        "Secret": settings.platega_secret_key,
        "Content-Type": "application/json",
    }


def _verify_platega_signature(payload: bytes, signature: str) -> bool:
    """Verify Platega webhook signature using HMAC-SHA256."""
    expected = hmac.new(
        settings.platega_secret_key.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def _create_platega_payment(
    amount_rub: int,
    description: str,
    metadata: dict,
) -> tuple[str, str]:
    """Create a payment link via Platega API.

    Returns (payment_id, payment_url).
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLATEGA_BASE}/api/v1/payment",
            headers=_platega_headers(),
            json={
                "amount": amount_rub,
                "currency": "RUB",
                "description": description,
                "metadata": metadata,
                "return_url": settings.platega_return_url,
                "fail_url": settings.platega_fail_url or settings.platega_return_url,
            },
            timeout=15,
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Platega error: {resp.status_code} {resp.text[:200]}",
        )

    data = resp.json()
    payment_id = data.get("id", "")
    payment_url = data.get("url", "")
    if not payment_url:
        raise HTTPException(status_code=502, detail="Platega не вернул ссылку на оплату")
    return payment_id, payment_url


@router.get("/plans", response_model=list[PlanInfo])
async def get_plans():
    """Return available credit plans."""
    return [
        PlanInfo(
            id=p["id"],
            name=p["name"],
            price=p["price"] * 100,  # rub → kopecks
            credits=p["credits"],
            bonus=p["bonus"],
            popular=p.get("popular", False),
        )
        for p in CREDIT_PLANS
    ]


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: User = Depends(get_current_user)):
    """Get current user credit balance."""
    return BalanceResponse(credits=user.credits)


@router.post("/top-up", response_model=TopUpResponse)
async def top_up(
    req: TopUpRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create payment request — Platega with email, or fallback if not configured."""
    plan = next((p for p in CREDIT_PLANS if p["id"] == req.plan_id), None)
    if plan is None:
        raise HTTPException(status_code=400, detail="Неизвестный тариф")

    rub_amount = plan["price"]
    credits = plan["credits"] + plan["bonus"]

    # Bonus for large top-ups
    if rub_amount >= 1000:
        credits += int(credits * 0.10)

    # If Platega not configured, return fallback
    if not _platega_configured():
        return TopUpResponse(
            payment_id="fallback",
            payment_url=settings.frontend_url + "/billing?plan=" + req.plan_id,
        )

    # Create payment via Platega with email in payload
    payment_id, payment_url = await _create_platega_payment(
        amount_rub=rub_amount,
        description=f"AI-Sphere: {plan['name']} ({credits} кредитов)",
        metadata={
            "user_id": str(user.id),
            "email": user.email,
            "plan_id": plan["id"],
            "credits": str(credits),
            "rub_amount": str(rub_amount),
        },
    )

    return TopUpResponse(
        payment_id=payment_id,
        payment_url=payment_url,
    )


@router.post("/webhook")
async def billing_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Platega payment notifications."""
    body_bytes = await request.body()

    # Verify signature if provided
    signature = request.headers.get("X-Signature") or request.headers.get("X-Platega-Signature", "")
    if signature and settings.platega_secret_key:
        if not _verify_platega_signature(body_bytes, signature):
            raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        data = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Platega may send different event types
    status_val = data.get("status", data.get("event", ""))
    if status_val not in ("succeeded", "paid", "completed", "payment.succeeded"):
        return {"ok": True}

    payment_id = data.get("id", data.get("payment_id", ""))
    if not payment_id:
        return {"ok": True}

    # Duplicate check
    result = await db.execute(select(Transaction).where(Transaction.payment_id == payment_id))
    if result.scalar_one_or_none():
        return {"ok": True}

    # Extract metadata — try top-level first, then nested
    metadata = data.get("metadata", data.get("object", {}).get("metadata", {}))
    user_id = int(metadata.get("user_id", 0))
    email = metadata.get("email", "")
    credits_to_add = int(metadata.get("credits", 0))
    rub_amount = int(float(metadata.get("rub_amount", 0)) * 100)

    if not user_id or not credits_to_add:
        return {"ok": True}

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user and email:
        # Fallback: find user by email
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()

    if user:
        user.credits += credits_to_add
        user.total_spent_rub = (user.total_spent_rub or 0) + rub_amount
        tx = Transaction(
            user_id=user.id,
            amount=credits_to_add,
            rub_amount=rub_amount,
            type="topup",
            description=f"Пополнение: {credits_to_add} кредитов",
            payment_id=payment_id,
        )
        db.add(tx)
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
