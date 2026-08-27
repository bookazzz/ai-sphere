"""Authenticated product feedback intake."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.feedback import UserFeedback
from app.models.user import User


router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    type: str = Field(default="other", pattern="^(idea|bug|feature|complaint|praise|other)$")
    subject: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1, max_length=10000)
    rating: int | None = Field(default=None, ge=1, le=5)
    source: str = Field(default="site", max_length=50)


@router.post("")
async def submit_feedback(
    req: FeedbackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = UserFeedback(
        user_id=user.id,
        type=req.type,
        subject=req.subject.strip(),
        message=req.message.strip(),
        rating=req.rating,
        source=req.source.strip() or "site",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"ok": True, "id": item.id}

