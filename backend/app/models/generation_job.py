"""Persistent OpenRouter image/video generation job."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(36), index=True, default=None)
    kind: Mapped[str] = mapped_column(String(16), index=True)  # image | video
    requested_model: Mapped[str] = mapped_column(String(200))
    effective_model: Mapped[str] = mapped_column(String(200))
    prompt: Mapped[str] = mapped_column(Text)
    parameters: Mapped[str] = mapped_column(Text, default="{}")
    provider_job_id: Mapped[str | None] = mapped_column(String(200), unique=True, default=None)
    status: Mapped[str] = mapped_column(String(20), index=True, default="pending")
    reserved_credits: Mapped[int] = mapped_column(Integer, default=0)
    reserved_buckets: Mapped[str] = mapped_column(Text, default="{}")
    charged_credits: Mapped[int] = mapped_column(Integer, default=0)
    provider_cost_usd: Mapped[str | None] = mapped_column(String(40), default=None)
    assets: Mapped[str] = mapped_column(Text, default="[]")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("task_templates.id", ondelete="SET NULL"), index=True, default=None)
    task_type: Mapped[str] = mapped_column(String(50), default="")
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    allow_prompt: Mapped[bool] = mapped_column(Boolean, default=False)
    share_slug: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, default=None)
