"""Public API: pages content for frontend."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.seo_page import SeoPage

router = APIRouter(prefix="/api/public", tags=["public"])
logger = logging.getLogger("ai-sphere.public")


@router.get("/pages/{slug}")
async def get_public_page(slug: str, db: AsyncSession = Depends(get_db)):
    """Return published SeoPage content by slug for public frontend."""
    result = await db.execute(
        select(SeoPage).where(
            SeoPage.slug == slug,
            SeoPage.status == "published",
        )
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Страница не найдена")

    data = page.to_dict()

    # Parse content JSON if present
    content_parsed = None
    if data.get("content"):
        try:
            content_parsed = json.loads(data["content"])
        except (json.JSONDecodeError, TypeError):
            content_parsed = data["content"]  # fallback to raw text

    # Parse related_slugs JSON if present
    related = []
    if data.get("related_slugs"):
        try:
            related = json.loads(data["related_slugs"])
        except (json.JSONDecodeError, TypeError):
            related = []

    return {
        "slug": data["slug"],
        "page_type": data["page_type"],
        "title": data["title"],
        "h1": data.get("h1") or data["title"],
        "subtitle": data.get("subtitle") or "",
        "content": content_parsed,
        "image": data.get("image"),
        "author": data.get("author"),
        "meta_title": data.get("meta_title") or data["title"],
        "meta_description": data.get("meta_description") or "",
        "canonical": data.get("canonical") or "",
        "robots": data.get("robots") or "",
        "cta_text": data.get("cta_text") or "Попробовать бесплатно",
        "cta_link": data.get("cta_link") or "/",
        "status": data["status"],
        "published_at": data.get("published_at"),
        "updated_at": data.get("updated_at"),
        "related_slugs": related,
    }
