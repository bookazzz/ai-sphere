"""SEO pages managed via admin panel."""

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SeoPage(Base, TimestampMixin):
    __tablename__ = "seo_pages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Identification
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    page_type: Mapped[str] = mapped_column(String(50), default="article")
    # Types: article / model_page / task_page / faq_list / static / legal
    category: Mapped[str | None] = mapped_column(String(100), default=None)

    # Content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    h1: Mapped[str | None] = mapped_column(String(255), default=None)
    subtitle: Mapped[str | None] = mapped_column(Text, default=None)
    content: Mapped[str | None] = mapped_column(Text, default=None)  # JSON with sections
    image: Mapped[str | None] = mapped_column(String(500), default=None)
    author: Mapped[str | None] = mapped_column(String(100), default=None)

    # SEO meta
    meta_title: Mapped[str | None] = mapped_column(String(255), default=None)
    meta_description: Mapped[str | None] = mapped_column(String(500), default=None)
    meta_keywords: Mapped[str | None] = mapped_column(String(500), default=None)
    canonical: Mapped[str | None] = mapped_column(String(500), default=None)
    robots: Mapped[str | None] = mapped_column(String(50), default=None)
    schema_json: Mapped[str | None] = mapped_column(Text, default=None)

    # Status
    status: Mapped[str] = mapped_column(String(30), default="draft")
    # draft / review / published / unpublished / scheduled
    published_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    # Relations
    related_slugs: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array
    model_id: Mapped[str | None] = mapped_column(String(100), default=None)
    cta_text: Mapped[str | None] = mapped_column(String(100), default=None)
    cta_link: Mapped[str | None] = mapped_column(String(500), default=None)

    # Display
    sort_order: Mapped[int] = mapped_column(default=0)
    is_visible: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), default=None)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "slug": self.slug, "page_type": self.page_type,
            "category": self.category, "title": self.title, "h1": self.h1,
            "subtitle": self.subtitle, "content": self.content,
            "image": self.image, "author": self.author,
            "meta_title": self.meta_title, "meta_description": self.meta_description,
            "meta_keywords": self.meta_keywords, "canonical": self.canonical,
            "robots": self.robots, "schema_json": self.schema_json,
            "status": self.status,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "related_slugs": self.related_slugs, "model_id": self.model_id,
            "cta_text": self.cta_text, "cta_link": self.cta_link,
            "sort_order": self.sort_order, "is_visible": self.is_visible,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else "",
            "updated_at": self.updated_at.isoformat() if self.updated_at else "",
        }
