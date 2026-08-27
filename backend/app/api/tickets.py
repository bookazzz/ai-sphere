"""Support tickets API."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.support_ticket import SupportTicket, TicketMessage

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


class TicketMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)


@router.post("")
async def create_ticket(
    subject: str = Body(..., min_length=1, max_length=255),
    category: str = Body("other"),
    priority: str = Body("normal"),
    message: str = Body(..., min_length=1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new support ticket."""
    valid_categories = {"general", "billing", "technical", "feature", "bug", "other"}
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Недопустимая категория: {category}")

    valid_priorities = {"low", "normal", "high", "urgent"}
    if priority not in valid_priorities:
        raise HTTPException(status_code=400, detail=f"Недопустимый приоритет: {priority}")

    now = datetime.now(timezone.utc)

    ticket = SupportTicket(
        user_id=user.id,
        subject=subject.strip(),
        category=category,
        priority=priority,
        status="new",
        last_message_at=now,
    )
    db.add(ticket)
    await db.flush()

    msg = TicketMessage(
        ticket_id=ticket.id,
        user_id=user.id,
        content=message.strip(),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(ticket)

    return {
        "ok": True,
        "ticket_id": ticket.id,
        "status": ticket.status,
    }


@router.get("")
async def list_tickets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List current user's tickets."""
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.user_id == user.id)
        .order_by(desc(SupportTicket.last_message_at))
    )
    tickets = result.scalars().all()
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "category": t.category,
            "status": t.status,
            "priority": t.priority,
            "last_message_at": t.last_message_at.isoformat() if t.last_message_at else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tickets
    ]


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get ticket details with messages."""
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == user.id,
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    msgs_result = await db.execute(
        select(TicketMessage)
        .where(
            TicketMessage.ticket_id == ticket_id,
            TicketMessage.is_internal == False,
        )
        .order_by(TicketMessage.created_at)
    )
    messages = msgs_result.scalars().all()

    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "category": ticket.category,
        "status": ticket.status,
        "priority": ticket.priority,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "messages": [
            {
                "id": m.id,
                "user_id": m.user_id,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


@router.post("/{ticket_id}/messages")
async def add_message(
    ticket_id: int,
    payload: TicketMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a message to an existing ticket."""
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == user.id,
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    if ticket.status in ("resolved", "closed"):
        raise HTTPException(status_code=400, detail="Тикет закрыт")

    now = datetime.now(timezone.utc)

    msg = TicketMessage(
        ticket_id=ticket_id,
        user_id=user.id,
        content=payload.message.strip(),
    )
    db.add(msg)

    ticket.status = "in_progress"
    ticket.last_message_at = now
    await db.commit()
    await db.refresh(msg)

    return {
        "ok": True,
        "message_id": msg.id,
    }
