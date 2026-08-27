"""Privacy-minimised product events (never stores prompt content)."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ProductEvent(Base, TimestampMixin):
    __tablename__ = "product_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    anonymous_id: Mapped[str] = mapped_column(String(80), default="", index=True)
    visit_session_id: Mapped[str] = mapped_column(String(80), default="", index=True)
    event_name: Mapped[str] = mapped_column(String(50), index=True)
    page: Mapped[str] = mapped_column(String(500), default="")
    source: Mapped[str] = mapped_column(String(255), default="", index=True)
    device_type: Mapped[str] = mapped_column(String(20), default="", index=True)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("task_templates.id", ondelete="SET NULL"), index=True)
    task_type: Mapped[str] = mapped_column(String(50), default="", index=True)
    model: Mapped[str] = mapped_column(String(200), default="")
    experiment_variants: Mapped[str] = mapped_column(Text, default="{}")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
