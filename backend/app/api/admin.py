"""Admin API: user management, transactions overview."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.transaction import Transaction

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return user


@router.get("/users")
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """List all users."""
    result = await db.execute(
        select(User).order_by(desc(User.created_at)).offset(offset).limit(limit)
    )
    users = result.scalars().all()
    total = (await db.execute(select(func.count(User.id)))).scalar()
    return {
        "total": total,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "credits": u.credits,
                "is_active": u.is_active,
                "is_admin": u.is_admin,
                "created_at": u.created_at.isoformat() if u.created_at else "",
            }
            for u in users
        ],
    }


@router.get("/transactions")
async def list_transactions(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """List all transactions."""
    result = await db.execute(
        select(Transaction).order_by(desc(Transaction.created_at)).offset(offset).limit(limit)
    )
    txs = result.scalars().all()
    total = (await db.execute(select(func.count(Transaction.id)))).scalar()
    return {
        "total": total,
        "transactions": [
            {
                "id": tx.id,
                "user_id": tx.user_id,
                "amount": tx.amount,
                "rub_amount": tx.rub_amount,
                "type": tx.type,
                "description": tx.description,
                "created_at": tx.created_at.isoformat() if tx.created_at else "",
            }
            for tx in txs
        ],
    }
