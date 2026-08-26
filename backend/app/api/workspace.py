"""Task catalogue, estimates, library, projects, public gallery and funnel events."""

from __future__ import annotations

import json
import math
import secrets
import shutil
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_admin
from app.api.generations import (
    _choose_model,
    _image_parameters,
    _json,
    _quoted_credits,
    _supports,
    _video_parameters,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.ai_model import AiModel
from app.models.chat_session import ChatSession
from app.models.generation_job import GenerationJob
from app.models.product_event import ProductEvent
from app.models.project import Project
from app.models.task_template import TaskTemplate
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/api", tags=["workspace"])

EVENT_NAMES = {
    "landing_view", "template_view", "input_started", "task_started", "auth_prompted",
    "auth_completed", "auth_failed", "estimate_viewed", "generation_started", "first_token",
    "first_result", "result_success", "generation_failed", "result_reused", "result_downloaded",
    "result_saved", "result_feedback", "project_completed", "balance_low", "pricing_view",
    "plan_selected", "checkout_started", "payment_returned", "payment_succeeded", "payment_failed",
    "campaign_shown", "campaign_opened", "campaign_clicked", "campaign_dismissed",
    "survey_shown", "survey_answered", "experiment_exposure", "progress_viewed", "reward_earned",
}
SAFE_EVENT_META = {
    "viewport", "plan_id", "error_code", "result_kind", "step", "project_id", "campaign_id",
    "delivery_id", "survey_id", "question_id", "variant_id", "surface", "credits", "status",
    "route_reason", "metrica_client_id", "referrer", "utm_source", "utm_medium", "utm_campaign",
}
TASK_TOKEN_PROFILES: dict[str, tuple[int, int]] = {
    "explain": (700, 900), "write_text": (900, 1400), "improve_text": (1400, 1200),
    "translate": (1600, 1700), "summarize": (5000, 700), "analyze_document": (9000, 1200),
    "search": (1000, 1100), "compare": (1800, 1300), "create_post": (900, 900),
    "plan": (1000, 1200), "analyze_image": (1200, 900),
}
RECIPE_CATALOGUE = [
    {"slug": "idea-to-image", "title": "РРґРµСЏ в†’ С‚РµРєСЃС‚ в†’ РёР·РѕР±СЂР°Р¶РµРЅРёРµ", "steps": ["brief", "text", "image"]},
    {"slug": "document-to-slides", "title": "Р”РѕРєСѓРјРµРЅС‚ в†’ РІС‹Р¶РёРјРєР° в†’ РїР»Р°РЅ РїСЂРµР·РµРЅС‚Р°С†РёРё", "steps": ["document", "summary", "slides"]},
    {"slug": "product-content-kit", "title": "РўРѕРІР°СЂ в†’ РѕРїРёСЃР°РЅРёРµ в†’ РїРѕСЃС‚ в†’ РёР·РѕР±СЂР°Р¶РµРЅРёРµ", "steps": ["product", "description", "post", "image"]},
    {"slug": "image-to-video", "title": "РР·РѕР±СЂР°Р¶РµРЅРёРµ в†’ СЃС†РµРЅР°СЂРёР№ в†’ РІРёРґРµРѕ", "steps": ["image", "script", "video"]},
]


class EstimateRequest(BaseModel):
    template_id: int | None = None
    task_type: str = Field(default="text", max_length=50)
    model: str = Field(default="auto", max_length=200)
    prompt: str = Field(default="", max_length=100_000)
    media_preferences: dict[str, Any] = {}


class EventRequest(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()), min_length=8, max_length=36)
    event_name: str = Field(max_length=50)
    anonymous_id: str = Field(default="", max_length=80)
    visit_session_id: str = Field(default="", max_length=80)
    page: str = Field(default="", max_length=500)
    source: str = Field(default="", max_length=255)
    device_type: str = Field(default="", max_length=20)
    template_id: int | None = None
    task_type: str = Field(default="", max_length=50)
    model: str = Field(default="", max_length=200)
    experiment_variants: dict[str, str] = {}
    duration_ms: int = Field(default=0, ge=0, le=86_400_000)
    metadata: dict[str, Any] = {}


class EventBatchRequest(BaseModel):
    events: list[EventRequest] = Field(min_length=1, max_length=100)


class LibraryUpdate(BaseModel):
    is_favorite: bool | None = None
    is_public: bool | None = None
    allow_prompt: bool | None = None


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    recipe_slug: str = Field(max_length=100)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = Field(default=None, pattern="^(draft|active|completed)$")
    current_step: int | None = Field(default=None, ge=0, le=20)
    data: dict[str, Any] | None = None
    is_public: bool | None = None
    allow_prompt: bool | None = None


class TemplatePayload(BaseModel):
    slug: str = Field(min_length=2, max_length=100, pattern="^[a-z0-9-]+$")
    title: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    category: str = Field(pattern="^(text|document|image|video)$")
    task_type: str = Field(min_length=2, max_length=50)
    prompt_template: str = Field(min_length=1, max_length=20_000)
    example_input: str = Field(default="", max_length=2000)
    example_output: str = Field(default="", max_length=2000)
    required_input: str = Field(default="РўРµРєСЃС‚ Р·Р°РїСЂРѕСЃР°", max_length=255)
    preview_url: str = Field(default="", max_length=500)
    default_parameters: dict[str, Any] = {}
    preferred_model: str = Field(default="", max_length=200)
    fallback_models: list[str] = []
    estimated_credits_label: str = Field(default="", max_length=100)
    is_featured: bool = False
    is_active: bool = True
    sort_order: int = Field(default=100, ge=0, le=10000)


def _template_payload(template: TaskTemplate) -> dict:
    return {
        "id": template.id, "slug": template.slug, "title": template.title,
        "description": template.description, "category": template.category,
        "task_type": template.task_type, "prompt_template": template.prompt_template,
        "example_input": template.example_input, "example_output": template.example_output,
        "required_input": template.required_input, "preview_url": template.preview_url,
        "default_parameters": _json(template.default_parameters, {}),
        "preferred_model": template.preferred_model,
        "fallback_models": _json(template.fallback_models, []),
        "estimated_credits_label": template.estimated_credits_label,
        "is_featured": template.is_featured, "is_active": template.is_active,
        "sort_order": template.sort_order, "usage_count": template.usage_count,
    }


def _kind_for_task(task_type: str, template: TaskTemplate | None = None) -> str:
    category = template.category if template else ""
    if category == "video" or task_type in {"video", "create_video"}:
        return "video"
    if task_type in {"image", "create_image"}:
        return "image"
    return "text"


async def _text_model(db: AsyncSession, requested: str, template: TaskTemplate | None) -> tuple[AiModel, list[str]]:
    query = select(AiModel).where(AiModel.is_active == True, AiModel.is_visible == True)
    needs_image_input = bool(template and template.task_type == "analyze_image")
    candidates = [
        m for m in (await db.execute(query)).scalars().all()
        if _supports(m, "text") and (not needs_image_input or "image" in _json(m.input_modalities, []))
    ]
    if not candidates:
        raise HTTPException(503, "РЎРµР№С‡Р°СЃ РЅРµС‚ РґРѕСЃС‚СѓРїРЅРѕР№ С‚РµРєСЃС‚РѕРІРѕР№ РјРѕРґРµР»Рё")
    by_id = {model.or_model_id: model for model in candidates}
    preferred = []
    if requested and requested != "auto":
        preferred.append(requested)
    input_tokens, output_tokens = TASK_TOKEN_PROFILES.get(
        template.task_type if template else "", (6000, 1000) if template and template.category == "document" else (1000, 1000),
    )
    candidates = [model for model in candidates if model.availability_status != "unavailable"]
    candidates.sort(key=lambda model: (
        (input_tokens * max(0.0, model.or_input_cost or 0.0) + output_tokens * max(0.0, model.or_output_cost or 0.0)) / 1_000_000,
        model.sort_order, model.name,
    ))
    if not candidates:
        raise HTTPException(503, "РЎРµР№С‡Р°СЃ РЅРµС‚ РґРѕСЃС‚СѓРїРЅРѕР№ С‚РµРєСЃС‚РѕРІРѕР№ РјРѕРґРµР»Рё")
    by_id = {model.or_model_id: model for model in candidates}
    chosen = next((by_id[item] for item in preferred if item in by_id), candidates[0])
    fallback = [model.or_model_id for model in candidates if model.id != chosen.id][:3]
    return chosen, fallback


async def resolve_task_model(db: AsyncSession, requested: str, task_type: str, template: TaskTemplate | None, preferences: dict) -> tuple[AiModel, list[str], str]:
    kind = _kind_for_task(task_type, template)
    if kind == "text":
        model, fallback = await _text_model(db, requested, template)
        return model, fallback, kind
    selected = requested if requested != "auto" else ""
    model = await _choose_model(db, selected, kind, preferences, allow_explicit_route=True)
    others = (await db.execute(select(AiModel).where(AiModel.is_active == True, AiModel.is_visible == True))).scalars().all()
    fallback = [m.or_model_id for m in others if m.id != model.id and _supports(m, kind)][:3]
    return model, fallback, kind


@router.get("/public/task-templates")
async def task_templates(category: str = "", db: AsyncSession = Depends(get_db)):
    query = select(TaskTemplate).where(TaskTemplate.is_active == True)
    if category:
        query = query.where(TaskTemplate.category == category)
    result = await db.execute(query.order_by(TaskTemplate.sort_order, TaskTemplate.id))
    return [_template_payload(item) for item in result.scalars().all()]


@router.get("/public/popular")
async def popular_templates(limit: int = Query(12, ge=1, le=50), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TaskTemplate).where(TaskTemplate.is_active == True)
        .order_by(desc(TaskTemplate.usage_count), TaskTemplate.sort_order).limit(limit)
    )
    return [_template_payload(item) for item in result.scalars().all()]


@router.post("/tasks/estimate")
async def estimate_task(payload: EstimateRequest, db: AsyncSession = Depends(get_db)):
    template = await db.get(TaskTemplate, payload.template_id) if payload.template_id else None
    if payload.template_id and (not template or not template.is_active):
        raise HTTPException(404, "РЎС†РµРЅР°СЂРёР№ РЅРµ РЅР°Р№РґРµРЅ")
    preferences = {**(_json(template.default_parameters, {}) if template else {}), **payload.media_preferences}
    task_type = template.task_type if template else payload.task_type
    model, fallback, kind = await resolve_task_model(db, payload.model, task_type, template, preferences)
    if kind == "image":
        parameters = _image_parameters(model, preferences)
        minimum = maximum = await _quoted_credits(db, model, kind, parameters)
    elif kind == "video":
        parameters = _video_parameters(model, preferences)
        minimum = maximum = await _quoted_credits(db, model, kind, parameters)
    else:
        parameters = {}
        input_tokens = max(1, len(payload.prompt) // 4)
        minimum = max(1, math.ceil(input_tokens * model.price_input / 1000 + 150 * model.price_output / 1000))
        maximum = max(minimum, math.ceil(input_tokens * model.price_input / 1000 + min(model.max_output_tokens, 1200) * model.price_output / 1000))
    return {
        "task_type": task_type, "kind": kind,
        "effective_model": model.or_model_id, "effective_model_name": model.name,
        "credits_min": minimum, "credits_max": maximum, "exact": minimum == maximum,
        "parameters": parameters, "fallback_models": fallback,
    }


async def _store_event(payload: EventRequest, user: User | None, db: AsyncSession) -> bool:
    if payload.event_name not in EVENT_NAMES:
        raise HTTPException(400, "РќРµРёР·РІРµСЃС‚РЅРѕРµ СЃРѕР±С‹С‚РёРµ")
    exists = (await db.execute(select(ProductEvent.id).where(ProductEvent.event_id == payload.event_id))).scalar_one_or_none()
    if exists:
        return False
    if user and payload.anonymous_id:
        await db.execute(
            update(ProductEvent)
            .where(ProductEvent.anonymous_id == payload.anonymous_id, ProductEvent.user_id.is_(None))
            .values(user_id=user.id)
        )
    safe_meta = {key: str(value)[:200] for key, value in payload.metadata.items() if key in SAFE_EVENT_META}
    db.add(ProductEvent(
        event_id=payload.event_id, user_id=user.id if user else None, anonymous_id=payload.anonymous_id,
        visit_session_id=payload.visit_session_id, page=payload.page, source=payload.source,
        device_type=payload.device_type,
        event_name=payload.event_name, template_id=payload.template_id,
        task_type=payload.task_type, model=payload.model,
        experiment_variants=json.dumps(payload.experiment_variants, ensure_ascii=False),
        duration_ms=payload.duration_ms,
        metadata_json=json.dumps(safe_meta, ensure_ascii=False),
    ))
    return True


@router.post("/events", status_code=204)
async def record_event(payload: EventRequest, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    await _store_event(payload, user, db)
    await db.commit()


@router.post("/events/batch")
async def record_events_batch(payload: EventBatchRequest, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    accepted = 0
    for event in payload.events:
        accepted += int(await _store_event(event, user, db))
    await db.commit()
    return {"accepted": accepted, "duplicates": len(payload.events) - accepted}


def _job_item(job: GenerationJob) -> dict:
    return {
        "id": job.id, "type": job.kind, "title": job.prompt[:90], "prompt": job.prompt,
        "model": job.effective_model, "status": job.status,
        "assets": _json(job.assets, []), "parameters": _json(job.parameters, {}),
        "credits_spent": job.charged_credits, "is_favorite": job.is_favorite,
        "is_public": job.is_public, "allow_prompt": job.allow_prompt,
        "share_slug": job.share_slug, "template_id": job.template_id,
        "task_type": job.task_type, "created_at": job.created_at.isoformat() if job.created_at else None,
    }


@router.get("/library")
async def library(kind: str = "all", favorite: bool = False, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items: list[dict] = []
    if kind in {"all", "chat", "document"} and not favorite:
        sessions = (await db.execute(
            select(ChatSession).where(ChatSession.user_id == user.id).order_by(desc(ChatSession.updated_at))
        )).scalars().all()
        items.extend({
            "id": session.id, "type": "chat", "title": session.title,
            "status": "completed", "created_at": session.created_at.isoformat() if session.created_at else None,
            "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        } for session in sessions)
    if kind in {"all", "image", "video"}:
        query = select(GenerationJob).where(GenerationJob.user_id == user.id)
        if kind in {"image", "video"}:
            query = query.where(GenerationJob.kind == kind)
        if favorite:
            query = query.where(GenerationJob.is_favorite == True)
        jobs = (await db.execute(query.order_by(desc(GenerationJob.created_at)))).scalars().all()
        items.extend(_job_item(job) for job in jobs)
    items.sort(key=lambda item: item.get("created_at") or item.get("updated_at") or "", reverse=True)
    return items


@router.patch("/library/{job_id}")
async def update_library_item(job_id: str, payload: LibraryUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(GenerationJob).where(GenerationJob.id == job_id, GenerationJob.user_id == user.id))).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Р Р°Р±РѕС‚Р° РЅРµ РЅР°Р№РґРµРЅР°")
    if payload.is_favorite is not None:
        job.is_favorite = payload.is_favorite
    if payload.is_public is not None:
        job.is_public = payload.is_public
        job.share_slug = job.share_slug or secrets.token_urlsafe(12) if payload.is_public else None
    if payload.allow_prompt is not None:
        job.allow_prompt = payload.allow_prompt
    await db.commit()
    return _job_item(job)


@router.post("/library/{item_id}/reuse")
async def reuse_library_item(item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(GenerationJob).where(GenerationJob.id == item_id, GenerationJob.user_id == user.id))).scalar_one_or_none()
    session = None if job else (await db.execute(select(ChatSession).where(ChatSession.id == item_id, ChatSession.user_id == user.id))).scalar_one_or_none()
    if not job and not session:
        raise HTTPException(404, "Р Р°Р±РѕС‚Р° РЅРµ РЅР°Р№РґРµРЅР°")
    from app.core.product_events import record_server_event
    await record_server_event(
        db, user, "result_reused", template_id=job.template_id if job else None,
        task_type=job.task_type if job else "chat", model=job.effective_model if job else "",
        metadata={"result_kind": job.kind if job else "text"},
    )
    await db.commit()
    return {"ok": True}


@router.delete("/library/{job_id}", status_code=204)
async def delete_library_item(job_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(GenerationJob).where(GenerationJob.id == job_id, GenerationJob.user_id == user.id))).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Р Р°Р±РѕС‚Р° РЅРµ РЅР°Р№РґРµРЅР°")
    root = settings.generations_dir.resolve()
    target = (root / job.id).resolve()
    if root in target.parents and target.exists():
        shutil.rmtree(target)
    await db.delete(job)
    await db.commit()


@router.get("/public/gallery")
async def public_gallery(limit: int = Query(24, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    jobs = (await db.execute(
        select(GenerationJob).where(GenerationJob.is_public == True, GenerationJob.status == "completed")
        .order_by(desc(GenerationJob.created_at)).limit(limit)
    )).scalars().all()
    result = []
    for job in jobs:
        item = _job_item(job)
        if not job.allow_prompt:
            item.pop("prompt", None)
        for asset in item.get("assets", []):
            asset["url"] = f"/api/public/gallery/{job.share_slug}/assets/{asset.get('id')}"
        result.append(item)
    return result


@router.get("/public/gallery/{share_slug}/assets/{asset_id}")
async def public_gallery_asset(share_slug: str, asset_id: str, db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(GenerationJob).where(
        GenerationJob.share_slug == share_slug, GenerationJob.is_public == True,
    ))).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ")
    asset = next((item for item in _json(job.assets, []) if str(item.get("id")) == asset_id), None)
    root = settings.generations_dir.resolve()
    candidates = list((root / job.id).resolve().glob(f"{asset_id}.*"))
    if not asset or not candidates or root not in candidates[0].resolve().parents:
        raise HTTPException(404, "Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ")
    return FileResponse(candidates[0], media_type=asset.get("media_type"))


@router.get("/recipes")
async def recipes():
    return RECIPE_CATALOGUE


def _project_payload(project: Project) -> dict:
    return {
        "id": project.id, "name": project.name, "recipe_slug": project.recipe_slug,
        "status": project.status, "current_step": project.current_step,
        "data": _json(project.data_json, {}), "is_public": project.is_public,
        "allow_prompt": project.allow_prompt, "share_slug": project.share_slug,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


@router.get("/projects")
async def projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.user_id == user.id).order_by(desc(Project.updated_at)))
    return [_project_payload(project) for project in result.scalars().all()]


@router.get("/public/projects")
async def public_projects(limit: int = Query(24, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Project).where(Project.is_public == True).order_by(desc(Project.updated_at)).limit(limit)
    )).scalars().all()
    result = []
    for project in rows:
        item = _project_payload(project)
        if not project.allow_prompt:
            item["data"] = {}
        result.append(item)
    return result


@router.post("/projects")
async def create_project(payload: ProjectCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if payload.recipe_slug not in {recipe["slug"] for recipe in RECIPE_CATALOGUE}:
        raise HTTPException(400, "РќРµРёР·РІРµСЃС‚РЅС‹Р№ СЂРµС†РµРїС‚")
    project = Project(id=str(uuid.uuid4()), user_id=user.id, name=payload.name, recipe_slug=payload.recipe_slug)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _project_payload(project)


@router.patch("/projects/{project_id}")
async def update_project(project_id: str, payload: ProjectUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))).scalar_one_or_none()
    if not project:
        raise HTTPException(404, "РџСЂРѕРµРєС‚ РЅРµ РЅР°Р№РґРµРЅ")
    was_completed = project.status == "completed"
    changes = payload.model_dump(exclude_none=True)
    data = changes.pop("data", None)
    for field, value in changes.items():
        setattr(project, field, value)
    if data is not None:
        project.data_json = json.dumps(data, ensure_ascii=False)
    if project.is_public:
        project.share_slug = project.share_slug or secrets.token_urlsafe(12)
    else:
        project.share_slug = None
    project.updated_at = datetime.now(timezone.utc)
    if project.status == "completed" and not was_completed:
        from app.core.product_events import record_server_event
        await record_server_event(
            db, user, "project_completed", task_type="project",
            metadata={"project_id": project.id},
        )
    await db.commit()
    return _project_payload(project)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))).scalar_one_or_none()
    if not project:
        raise HTTPException(404, "РџСЂРѕРµРєС‚ РЅРµ РЅР°Р№РґРµРЅ")
    await db.delete(project)
    await db.commit()


@router.get("/billing/usage")
async def usage_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db), limit: int = Query(50, ge=1, le=200)):
    rows = (await db.execute(
        select(Transaction).where(Transaction.user_id == user.id, Transaction.type.in_(["spend", "refund"]))
        .order_by(desc(Transaction.created_at)).limit(limit)
    )).scalars().all()
    return [{
        "id": row.id, "amount": row.amount, "type": row.type,
        "description": row.description, "created_at": row.created_at.isoformat() if row.created_at else None,
    } for row in rows]


@router.get("/admin/task-templates")
async def admin_templates(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(TaskTemplate).order_by(TaskTemplate.sort_order))).scalars().all()
    return [_template_payload(row) for row in rows]


@router.post("/admin/task-templates")
async def create_template(payload: TemplatePayload, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if (await db.execute(select(TaskTemplate.id).where(TaskTemplate.slug == payload.slug))).scalar_one_or_none():
        raise HTTPException(409, "РўР°РєРѕР№ slug СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚")
    data = payload.model_dump()
    data["default_parameters"] = json.dumps(data["default_parameters"], ensure_ascii=False)
    data["fallback_models"] = json.dumps(data["fallback_models"], ensure_ascii=False)
    template = TaskTemplate(**data)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_payload(template)


@router.put("/admin/task-templates/{template_id}")
async def update_template(template_id: int, payload: TemplatePayload, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    template = await db.get(TaskTemplate, template_id)
    if not template:
        raise HTTPException(404, "РЎС†РµРЅР°СЂРёР№ РЅРµ РЅР°Р№РґРµРЅ")
    data = payload.model_dump()
    data["default_parameters"] = json.dumps(data["default_parameters"], ensure_ascii=False)
    data["fallback_models"] = json.dumps(data["fallback_models"], ensure_ascii=False)
    for field, value in data.items():
        setattr(template, field, value)
    await db.commit()
    return _template_payload(template)


@router.delete("/admin/task-templates/{template_id}", status_code=204)
async def delete_template(template_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    template = await db.get(TaskTemplate, template_id)
    if not template:
        raise HTTPException(404, "РЎС†РµРЅР°СЂРёР№ РЅРµ РЅР°Р№РґРµРЅ")
    template.is_active = False
    await db.commit()


@router.get("/admin/integrations/status")
async def integration_status(_=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    from app.models.app_setting import AppSetting
    total = (await db.execute(select(func.count(AiModel.id)))).scalar() or 0
    visible = (await db.execute(select(func.count(AiModel.id)).where(AiModel.is_active == True, AiModel.is_visible == True))).scalar() or 0
    unavailable = (await db.execute(select(func.count(AiModel.id)).where(AiModel.availability_status == "unavailable"))).scalar() or 0
    last_sync = (await db.execute(select(func.max(AiModel.or_last_synced_at)))).scalar()
    event_counts = dict((await db.execute(
        select(ProductEvent.event_name, func.count(ProductEvent.id)).group_by(ProductEvent.event_name)
    )).all())
    baseline = await db.get(AppSetting, "analytics_v2_baseline")
    return {
        "openrouter": {"configured": bool(settings.openrouter_api_key), "total_models": total, "visible_models": visible, "unavailable_models": unavailable, "last_sync": last_sync.isoformat() if last_sync else None},
        "payments": {"provider": "Platega", "configured": bool(settings.platega_merchant_id and settings.platega_secret_key)},
        "funnel": event_counts,
        "analytics": {"baseline": baseline.value if baseline else None, "enabled": settings.analytics_v2_enabled},
        "features": {"campaigns": settings.campaigns_enabled, "gamification": settings.gamification_enabled, "experiments": settings.experiments_enabled},
    }

