"""Admin-managed task templates for the task-first product experience."""

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TaskTemplate(Base, TimestampMixin):
    __tablename__ = "task_templates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(32), index=True)  # text | document | image | video
    task_type: Mapped[str] = mapped_column(String(50), index=True)
    prompt_template: Mapped[str] = mapped_column(Text)
    example_input: Mapped[str] = mapped_column(Text, default="")
    example_output: Mapped[str] = mapped_column(Text, default="")
    required_input: Mapped[str] = mapped_column(String(255), default="Текст запроса")
    preview_url: Mapped[str] = mapped_column(String(500), default="")
    default_parameters: Mapped[str] = mapped_column(Text, default="{}")
    preferred_model: Mapped[str] = mapped_column(String(200), default="")
    fallback_models: Mapped[str] = mapped_column(Text, default="[]")
    estimated_credits_label: Mapped[str] = mapped_column(String(100), default="")
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)

