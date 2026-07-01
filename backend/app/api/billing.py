"""Billing API: plans, top-up, webhook, balance, history."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from yookassa import Configuration, Payment

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

# Configure YooKassa
Configuration.account_id = settings.yookassa_shop_id
Configuration.secret_key = settings.yookassa_secret_key

CREDIT_PLANS = [
    {"id": "starter",  "name": "Стартовый",  "price": 50,   "credits": 500,   "bonus": 0},
    {"id": "basic",    "name": "Базовый",    "price": 250,  "credits": 2500,  "bonus": 0},
    {"id": "popular",  "name": "Популярный", "price": 1000, "credits": 10000, "bonus": 1500, "popular": True},
    {"id": "premium",  "name": "Премиум",    "price": 2500, "credits": 25000, "bonus": 5000},
]


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
    """Create YooKassa payment and return redirect URL."""
    plan = next((p for p in CREDIT_PLANS if p["id"] == req.plan_id), None)
    if plan is None:
        raise HTTPException(status_code=400, detail="Неизвестный тариф")

    rub_amount = plan["price"]
    credits = plan["credits"] + plan["bonus"]

    # Bonus for large top-ups
    if rub_amount >= 1000:
        credits += int(credits * 0.10)

    idempotence_key = str(uuid.uuid4())
    payment = Payment.create({
        "amount": {"value": f"{rub_amount:.2f}", "currency": "RUB"},
        "confirmation": {"type": "redirect", "return_url": settings.yookassa_return_url},
        "capture": True,
        "description": f"AI-Sphere: {plan['name']} ({credits} кредитов)",
        "metadata": {
            "user_id": str(user.id),
            "plan_id": plan["id"],
            "credits": str(credits),
            "rub_amount": str(rub_amount),
        },
        "test": settings.yookassa_test,
    }, idempotence_key)

    return TopUpResponse(
        payment_id=payment.id,
        payment_url=payment.confirmation.confirmation_url,
    )


@router.post("/webhook")
async def yookassa_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle YooKassa payment notifications."""
    body = await request.json()
    event = body.get("event")
    obj = body.get("object", {})

    if event != "payment.succeeded":
        return {"ok": True}

    payment_id = obj.get("id")
    if not payment_id:
        return {"ok": True}

    # Duplicate check
    result = await db.execute(select(Transaction).where(Transaction.payment_id == payment_id))
    if result.scalar_one_or_none():
        return {"ok": True}

    metadata = obj.get("metadata", {})
    user_id = int(metadata.get("user_id", 0))
    credits_to_add = int(metadata.get("credits", 0))
    rub_amount = int(float(metadata.get("rub_amount", 0)) * 100)

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user:
        user.credits += credits_to_add
        user.total_spent_rub += rub_amount
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
