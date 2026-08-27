"""Public API: pages content for frontend."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.seo_page import SeoPage
from app.models.ai_model import AiModel
from app.models.app_setting import AppSetting
from app.core.sanitization import sanitize_rich_content
from app.schemas.chat import PublicModelInfo

router = APIRouter(prefix="/api/public", tags=["public"])
logger = logging.getLogger("ai-sphere.public")


@router.get("/settings")
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    metrica = await db.get(AppSetting, "yandex_metrica_id")
    return {
        "yandex_metrica_id": metrica.value if metrica else "110850288",
        "features": {
            "analytics_v2": settings.analytics_v2_enabled,
            "campaigns": settings.campaigns_enabled,
            "gamification": settings.gamification_enabled,
            "experiments": settings.experiments_enabled,
        },
    }


@router.get("/stats")
async def get_public_stats(db: AsyncSession = Depends(get_db)):
    model_count = (await db.execute(select(func.count(AiModel.id)).where(
        AiModel.is_active == True, AiModel.is_visible == True,
    ))).scalar() or 0
    return {
        "model_count": model_count,
        "payment_provider": "Platega",
        "credits_expire": False,
        "subscription_required": False,
    }


def _json_field(value: str, fallback):
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


@router.get("/models", response_model=list[PublicModelInfo])
async def get_public_models(db: AsyncSession = Depends(get_db)):
    """Return the DB-backed public model catalogue."""
    result = await db.execute(
        select(AiModel)
        .where(AiModel.is_active == True, AiModel.is_visible == True)
        .order_by(AiModel.sort_order, AiModel.name)
    )
    return [
        {
            "id": model.or_model_id,
            "name": model.name,
            "provider": model.provider,
            "price_input": model.price_input,
            "price_output": model.price_output,
            "price_unit": model.price_unit,
            "fixed_price": model.fixed_price,
            "vision": bool(model.vision),
            "is_active": bool(model.is_active),
            "is_visible": bool(model.is_visible),
            "input_modalities": _json_field(model.input_modalities, ["text"]),
            "output_modalities": _json_field(model.output_modalities, ["text"]),
            "supported_parameters": _json_field(model.supported_parameters, {}),
            "auto_route_enabled": bool(model.auto_route_enabled),
        }
        for model in result.scalars().all()
    ]


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
        "content": json.loads(sanitize_rich_content(json.dumps(content_parsed, ensure_ascii=False))) if isinstance(content_parsed, (dict, list)) else sanitize_rich_content(content_parsed),
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
