"""Unified text/image/video dispatch and private generated-media access."""

from __future__ import annotations

import base64
import json
import logging
import math
import re
import uuid
import asyncio
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import case, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.database import async_session
from app.core.deps import get_current_user
from app.core.product_events import record_server_event
from app.core.economics import credits_for_provider_cost, pricing_context, provider_cost_from_snapshot, enforce_free_program_budget
from app.models.ai_model import AiModel
from app.models.generation_job import GenerationJob
from app.models.task_template import TaskTemplate
from app.models.transaction import Transaction
from app.models.user import User
from app.models.credit_op import CreditOperation
from app.core.credits import allocate_buckets, bucket_snapshot, restore_buckets
from app.schemas.chat import ChatRequest, DispatchRequest

logger = logging.getLogger("ai-sphere.generations")
router = APIRouter(tags=["generations"])

IMAGE_COMMAND = re.compile(
    r"(?:^|\b)(?:/image|СЃРіРµРЅРµСЂРёСЂ(?:СѓР№|РѕРІР°С‚СЊ)|СЃРѕР·РґР°(?:Р№|С‚СЊ)|РЅР°СЂРёСЃСѓ(?:Р№|Р№С‚Рµ)|generate|create|draw)"
    r".{0,60}\b(?:РёР·РѕР±СЂР°Р¶РµРЅРё[РµСЏР№]?|РєР°СЂС‚РёРЅ(?:РєСѓ|РєРё|РєР°)|С„РѕС‚Рѕ|image|picture|photo)\b",
    re.IGNORECASE | re.DOTALL,
)
VIDEO_COMMAND = re.compile(
    r"(?:^|\b)(?:/video|СЃРіРµРЅРµСЂРёСЂ(?:СѓР№|РѕРІР°С‚СЊ)|СЃРѕР·РґР°(?:Р№|С‚СЊ)|СЃРґРµР»Р°(?:Р№|С‚СЊ)|generate|create|make)"
    r".{0,60}\b(?:РІРёРґРµРѕ|СЂРѕР»РёРє|РєР»РёРї|video|clip)\b",
    re.IGNORECASE | re.DOTALL,
)
EDUCATIONAL_QUERY = re.compile(
    r"(?:СЂР°СЃСЃРєР°Р¶Рё|РѕР±СЉСЏСЃРЅРё|РєР°Рє\s+(?:РјРѕР¶РЅРѕ\s+)?(?:СЃРѕР·РґР°РІР°С‚СЊ|РіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ)|what\s+is|how\s+to)"
    r".{0,80}(?:РёР·РѕР±СЂР°Р¶РµРЅРё|РєР°СЂС‚РёРЅ|РІРёРґРµРѕ|image|video)",
    re.IGNORECASE | re.DOTALL,
)


def _json(value: str | None, fallback):
    try:
        return json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return fallback


def _modalities(model: AiModel, field: str) -> list[str]:
    values = _json(getattr(model, field, "[]"), [])
    if field == "input_modalities" and model.vision and "image" not in values:
        values.append("image")
    return [str(value).lower() for value in values]


def _latest_prompt(req: DispatchRequest) -> str:
    for message in reversed(req.messages):
        if message.role != "user":
            continue
        if isinstance(message.content, str):
            return message.content.strip()
        if isinstance(message.content, list):
            return " ".join(
                str(part.get("text", "")) for part in message.content
                if isinstance(part, dict) and part.get("type") == "text"
            ).strip()
    return ""


def classify_intent(prompt: str, requested: str = "auto") -> str:
    if requested in {"text", "image", "video"}:
        return requested
    stripped = prompt.lstrip().lower()
    if stripped.startswith("/image"):
        return "image"
    if stripped.startswith("/video"):
        return "video"
    if EDUCATIONAL_QUERY.search(prompt):
        return "text"
    if VIDEO_COMMAND.search(prompt):
        return "video"
    if IMAGE_COMMAND.search(prompt):
        return "image"
    return "text"


def _provider_cost(model: AiModel, kind: str, parameters: dict | None = None) -> float | None:
    pricing = _json(model.openrouter_pricing, {})
    parameters = parameters or {}
    if isinstance(pricing, dict):
        cost = provider_cost_from_snapshot(pricing, kind, parameters, conservative=True)
        if cost is not None:
            return cost
    if model.fixed_price > 0:
        return float(model.fixed_price) / settings.credits_per_usd
    return None


def _supports(model: AiModel, kind: str) -> bool:
    return kind in _modalities(model, "output_modalities")


def _supports_preferences(model: AiModel, kind: str, preferences: dict) -> bool:
    supported = _json(model.supported_parameters, {})
    mapping = {
        "aspect_ratio": "supported_aspect_ratios",
        "duration": "supported_durations",
        "resolution": "supported_resolutions",
    }
    for request_key, supported_key in mapping.items():
        if request_key not in preferences:
            continue
        allowed = supported.get(supported_key)
        descriptor = supported.get(request_key)
        if not allowed and isinstance(descriptor, dict):
            allowed = descriptor.get("values")
        if allowed and preferences[request_key] not in allowed:
            return False
    return True


async def _choose_model(
    db: AsyncSession,
    selected_id: str,
    kind: str,
    preferences: dict,
    *,
    allow_explicit_route: bool = False,
) -> AiModel:
    selected = (await db.execute(
        select(AiModel).where(AiModel.or_model_id == selected_id, AiModel.is_active == True)
    )).scalar_one_or_none()
    if selected and _supports(selected, kind):
        if not _supports_preferences(selected, kind, preferences):
            raise HTTPException(400, "Р’С‹Р±СЂР°РЅРЅР°СЏ РІСЂСѓС‡РЅСѓСЋ РјРѕРґРµР»СЊ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ СѓРєР°Р·Р°РЅРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹")
        return selected

    if not settings.auto_routing_enabled and not allow_explicit_route:
        raise HTTPException(503, "РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ РІС‹Р±РѕСЂ media-РјРѕРґРµР»Рё РІСЂРµРјРµРЅРЅРѕ РѕС‚РєР»СЋС‡С‘РЅ")

    models = (await db.execute(
        select(AiModel).where(
            AiModel.is_active == True,
            AiModel.is_visible == True,
            AiModel.auto_route_enabled == True,
            AiModel.availability_status != "unavailable",
        )
    )).scalars().all()
    compatible = []
    for model in models:
        if not _supports(model, kind) or not _supports_preferences(model, kind, preferences):
            continue
        parameters = _image_parameters(model, preferences) if kind == "image" else _video_parameters(model, preferences)
        cost = _provider_cost(model, kind, parameters)
        if cost is not None:
            compatible.append((cost, model))
    if not compatible:
        raise HTTPException(503, f"РќРµС‚ РґРѕСЃС‚СѓРїРЅРѕР№ РјРѕРґРµР»Рё РґР»СЏ РіРµРЅРµСЂР°С†РёРё {kind}")
    compatible.sort(key=lambda item: (item[0], item[1].sort_order, item[1].name))
    return compatible[0][1]


def _image_parameters(model: AiModel, preferences: dict) -> dict:
    supported = _json(model.supported_parameters, {})
    def value(name: str, default: str) -> str:
        descriptor = supported.get(name)
        allowed = descriptor.get("values") if isinstance(descriptor, dict) else None
        requested = str(preferences.get(name, default))
        return requested if not allowed or requested in allowed else str(allowed[0])
    return {
        "n": min(10, max(1, int(preferences.get("n", 1)))),
        "resolution": value("resolution", "1K"),
        "aspect_ratio": value("aspect_ratio", "1:1"),
        "output_format": value("output_format", "png"),
    }


def _video_parameters(model: AiModel, preferences: dict) -> dict:
    supported = _json(model.supported_parameters, {})
    durations = supported.get("supported_durations") or [5]
    resolutions = supported.get("supported_resolutions") or ["720p"]
    ratios = supported.get("supported_aspect_ratios") or ["16:9"]
    duration = int(preferences.get("duration", min(durations)))
    resolution = str(preferences.get("resolution", "720p" if "720p" in resolutions else resolutions[0]))
    ratio = str(preferences.get("aspect_ratio", "16:9" if "16:9" in ratios else ratios[0]))
    if duration not in durations or resolution not in resolutions or ratio not in ratios:
        raise HTTPException(400, "Р’С‹Р±СЂР°РЅРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ РІРёРґРµРѕ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ РјРѕРґРµР»СЊСЋ")
    return {
        "duration": duration,
        "resolution": resolution,
        "aspect_ratio": ratio,
        "generate_audio": bool(preferences.get("generate_audio", False)),
    }


async def _quoted_credits(db: AsyncSession, model: AiModel, kind: str, parameters: dict) -> int:
    if model.fixed_price > 0:
        return max(1, math.ceil(model.fixed_price))
    provider_cost = _provider_cost(model, kind, parameters)
    if provider_cost is None:
        raise HTTPException(503, "Р”Р»СЏ РјРѕРґРµР»Рё РЅРµ РЅР°СЃС‚СЂРѕРµРЅР° Р°РєС‚СѓР°Р»СЊРЅР°СЏ С†РµРЅР°")
    units = int(parameters.get("n", 1)) if kind == "image" else 1
    context = await pricing_context(db)
    return max(1, int(credits_for_provider_cost(provider_cost * units, context, whole=True)))


async def _reserve_credits(db: AsyncSession, user: User, amount: int, job_id: str) -> dict[str, int]:
    try:
        allocation = allocate_buckets(bucket_snapshot(user), amount)
    except ValueError:
        raise HTTPException(402, "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РєСЂРµРґРёС‚РѕРІ")
    after_free = case((amount > User.credits_free, amount - User.credits_free), else_=0)
    after_bonus = case((after_free > User.credits_bonus, after_free - User.credits_bonus), else_=0)
    after_paid = case((after_bonus > User.credits_paid, after_bonus - User.credits_paid), else_=0)
    result = await db.execute(
        update(User)
        .where(User.id == user.id, User.credits_free + User.credits_bonus + User.credits_paid + User.credits_promo >= amount)
        .values(
            credits_free=case((User.credits_free >= amount, User.credits_free - amount), else_=0),
            credits_bonus=case((User.credits_bonus >= after_free, User.credits_bonus - after_free), else_=0),
            credits_paid=case((User.credits_paid >= after_bonus, User.credits_paid - after_bonus), else_=0),
            credits_promo=User.credits_promo - after_paid,
            total_spent_credits=User.total_spent_credits + amount,
            request_count=User.request_count + 1,
        ).execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        await db.rollback()
        raise HTTPException(402, "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РєСЂРµРґРёС‚РѕРІ")
    before = user.credits
    for bucket, spent in allocation.items():
        if spent:
            db.add(CreditOperation(
                user_id=user.id, op_type="spend", credit_type=bucket, amount=-spent,
                balance_before=before, balance_after=before - amount,
                source="generation", related_id=job_id, comment=f"Р РµР·РµСЂРІ РіРµРЅРµСЂР°С†РёРё {job_id}",
            ))
    db.add(Transaction(user_id=user.id, amount=-amount, type="spend", description=f"Р РµР·РµСЂРІ РіРµРЅРµСЂР°С†РёРё {job_id}"))
    return allocation


async def _refund(db: AsyncSession, job: GenerationJob, reason: str) -> None:
    if job.reserved_credits <= 0 or job.charged_credits > 0:
        return
    allocation = _json(job.reserved_buckets, {})
    restored = await restore_buckets(db, job.user_id, allocation, job.reserved_credits)
    await db.execute(update(User).where(User.id == job.user_id).values(
        total_spent_credits=case((User.total_spent_credits >= job.reserved_credits, User.total_spent_credits - job.reserved_credits), else_=0),
    ))
    db.add(Transaction(user_id=job.user_id, amount=job.reserved_credits, type="refund", description=reason))
    for bucket, value in restored.items():
        if value:
            db.add(CreditOperation(user_id=job.user_id, op_type="refund", credit_type=bucket, amount=value, source="generation", related_id=job.id, comment=reason))
    job.reserved_credits = 0


async def _settle(db: AsyncSession, job: GenerationJob, model: AiModel, provider_cost) -> None:
    """Reconcile a conservative reservation against OpenRouter's actual cost."""
    actual = job.reserved_credits
    try:
        if provider_cost is not None:
            context = await pricing_context(db)
            actual = max(1, int(credits_for_provider_cost(float(provider_cost), context, whole=True)))
            actual = min(actual, job.reserved_credits)
    except (TypeError, ValueError):
        actual = job.reserved_credits
    refund = max(0, job.reserved_credits - actual)
    if refund:
        restored = await restore_buckets(db, job.user_id, _json(job.reserved_buckets, {}), refund)
        await db.execute(update(User).where(User.id == job.user_id).values(
            total_spent_credits=case((User.total_spent_credits >= refund, User.total_spent_credits - refund), else_=0),
        ))
        db.add(Transaction(user_id=job.user_id, amount=refund, type="refund", description=f"РЎРІРµСЂРєР° СЃС‚РѕРёРјРѕСЃС‚Рё РіРµРЅРµСЂР°С†РёРё {job.id}"))
        for bucket, value in restored.items():
            if value:
                db.add(CreditOperation(user_id=job.user_id, op_type="refund", credit_type=bucket, amount=value, source="generation", related_id=job.id, comment="РЎРІРµСЂРєР° СЃС‚РѕРёРјРѕСЃС‚Рё РіРµРЅРµСЂР°С†РёРё"))
    job.charged_credits = actual


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-sphere.ru",
        "X-Title": "AI-Sphere",
    }


def _job_payload(job: GenerationJob, model_name: str | None = None) -> dict:
    return {
        "id": job.id,
        "kind": job.kind,
        "status": job.status,
        "requested_model": job.requested_model,
        "effective_model": job.effective_model,
        "effective_model_name": model_name or job.effective_model,
        "parameters": _json(job.parameters, {}),
        "assets": _json(job.assets, []),
        "error": job.error,
        "credits_spent": job.charged_credits,
        "expires_at": job.expires_at.isoformat() if job.expires_at else None,
    }


async def cleanup_expired_media() -> int:
    """Expire database records and delete only their bounded job directories."""
    now = datetime.now(timezone.utc)
    async with async_session() as db:
        jobs = (await db.execute(
            select(GenerationJob).where(GenerationJob.expires_at <= now, GenerationJob.status == "completed")
        )).scalars().all()
        root = settings.generations_dir.resolve()
        for job in jobs:
            target = (root / job.id).resolve()
            if root in target.parents and target.exists():
                shutil.rmtree(target)
            job.status = "expired"
            job.assets = "[]"
        await db.commit()
        return len(jobs)


async def media_cleanup_loop() -> None:
    while True:
        await asyncio.sleep(24 * 60 * 60)
        try:
            await cleanup_expired_media()
        except Exception:
            logger.exception("Generated-media cleanup failed")


async def _create_job(db: AsyncSession, user: User, req: DispatchRequest, model: AiModel, kind: str, prompt: str, parameters: dict) -> GenerationJob:
    await enforce_free_program_budget(db, user)
    job = GenerationJob(
        id=str(uuid.uuid4()), user_id=user.id, session_id=req.session_id,
        kind=kind, requested_model=req.model, effective_model=model.or_model_id,
        prompt=prompt, parameters=json.dumps(parameters, ensure_ascii=False),
        template_id=req.template_id, task_type=req.task_type,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.media_retention_days),
    )
    job.reserved_credits = await _quoted_credits(db, model, kind, parameters)
    job.reserved_buckets = json.dumps(await _reserve_credits(db, user, job.reserved_credits, job.id))
    db.add(job)
    await record_server_event(
        db, user, "generation_started", template_id=req.template_id,
        task_type=req.task_type or kind, model=model.or_model_id,
        metadata={"result_kind": kind, "credits": job.reserved_credits},
    )
    await db.commit()
    await db.refresh(job)
    return job


async def _generate_image(db: AsyncSession, user: User, req: DispatchRequest, model: AiModel, prompt: str) -> GenerationJob:
    parameters = _image_parameters(model, req.media_preferences)
    job = await _create_job(db, user, req, model, "image", prompt, parameters)
    body = {
        "model": model.or_model_id,
        "prompt": re.sub(r"^/image\s*", "", prompt, flags=re.I),
        "provider": {"sort": "price"},
        **parameters,
    }
    try:
        async with httpx.AsyncClient(timeout=180.0, proxy=settings.openrouter_proxy or None) as client:
            response = await client.post(f"{settings.openrouter_base_url}/images", headers=_headers(), json=body)
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data")
        if not isinstance(data, list) or not data:
            raise ValueError("OpenRouter РЅРµ РІРµСЂРЅСѓР» РёР·РѕР±СЂР°Р¶РµРЅРёРµ")
        target_dir = settings.generations_dir / job.id
        target_dir.mkdir(parents=True, exist_ok=True)
        assets = []
        for index, item in enumerate(data):
            encoded = item.get("b64_json") if isinstance(item, dict) else None
            if not encoded:
                continue
            media_type = str(item.get("media_type") or "image/png")
            extension = {"image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg"}.get(media_type, "png")
            filename = f"{index}.{extension}"
            (target_dir / filename).write_bytes(base64.b64decode(encoded, validate=True))
            assets.append({"id": str(index), "type": "image", "media_type": media_type, "url": f"/api/generations/{job.id}/assets/{index}"})
        if not assets:
            raise ValueError("OpenRouter РІРµСЂРЅСѓР» РїСѓСЃС‚РѕР№ СЂРµР·СѓР»СЊС‚Р°С‚")
        usage = payload.get("usage") or {}
        provider_cost = usage.get("cost")
        job.provider_cost_usd = str(provider_cost) if provider_cost is not None else None
        job.assets = json.dumps(assets, ensure_ascii=False)
        job.status = "completed"
        await _settle(db, job, model, provider_cost)
        await record_server_event(
            db, user, "result_success", template_id=req.template_id,
            task_type=req.task_type or "image", model=model.or_model_id,
            metadata={
                "result_kind": "image",
                "credits": job.charged_credits,
                "provider_cost_usd": provider_cost if provider_cost is not None else "",
            },
        )
        await db.commit()
        return job
    except Exception as exc:
        logger.warning("Image generation failed job=%s: %s", job.id, exc)
        job.status = "failed"
        job.error = str(exc)[:1000]
        await _refund(db, job, f"Р’РѕР·РІСЂР°С‚ Р·Р° РЅРµСѓСЃРїРµС€РЅСѓСЋ РіРµРЅРµСЂР°С†РёСЋ {job.id}")
        await record_server_event(
            db, user, "generation_failed", template_id=req.template_id,
            task_type=req.task_type or "image", model=model.or_model_id,
            metadata={"result_kind": "image", "error_code": type(exc).__name__},
        )
        await db.commit()
        return job


async def _submit_video(db: AsyncSession, user: User, req: DispatchRequest, model: AiModel, prompt: str) -> GenerationJob:
    parameters = _video_parameters(model, req.media_preferences)
    job = await _create_job(db, user, req, model, "video", prompt, parameters)
    body = {
        "model": model.or_model_id,
        "prompt": re.sub(r"^/video\s*", "", prompt, flags=re.I),
        "provider": {"sort": "price"},
        **parameters,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0, proxy=settings.openrouter_proxy or None) as client:
            response = await client.post(f"{settings.openrouter_base_url}/videos", headers=_headers(), json=body)
        response.raise_for_status()
        payload = response.json()
        provider_id = payload.get("id")
        if not provider_id:
            raise ValueError("OpenRouter РЅРµ РІРµСЂРЅСѓР» ID РІРёРґРµРѕ-Р·Р°РґР°РЅРёСЏ")
        job.provider_job_id = str(provider_id)
        upstream_status = str(payload.get("status") or "pending")
        job.status = "processing" if upstream_status in {"processing", "in_progress"} else upstream_status
        if job.status not in {"pending", "processing", "completed"}:
            job.status = "pending"
        await db.commit()
        return job
    except Exception as exc:
        logger.warning("Video submission failed job=%s: %s", job.id, exc)
        job.status = "failed"
        job.error = str(exc)[:1000]
        await _refund(db, job, f"Р’РѕР·РІСЂР°С‚ Р·Р° РЅРµСѓСЃРїРµС€РЅСѓСЋ РіРµРЅРµСЂР°С†РёСЋ {job.id}")
        await record_server_event(
            db, user, "generation_failed", template_id=req.template_id,
            task_type=req.task_type or "video", model=model.or_model_id,
            metadata={"result_kind": "video", "error_code": type(exc).__name__},
        )
        await db.commit()
        return job


@router.post("/api/chat/dispatch")
async def dispatch(
    req: DispatchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prompt = _latest_prompt(req)
    if not prompt:
        raise HTTPException(400, "Р’РІРµРґРёС‚Рµ Р·Р°РїСЂРѕСЃ")
    template = await db.get(TaskTemplate, req.template_id) if req.template_id else None
    if req.template_id and (not template or not template.is_active):
        raise HTTPException(404, "РЎС†РµРЅР°СЂРёР№ РЅРµ РЅР°Р№РґРµРЅ")
    if template:
        req.task_type = template.task_type
        req.media_preferences = {**_json(template.default_parameters, {}), **req.media_preferences}
        for message in reversed(req.messages):
            if message.role == "user" and isinstance(message.content, str):
                message.content = template.prompt_template.replace("{input}", message.content)
                prompt = message.content.strip()
                break
        template.usage_count += 1
    classified_intent = classify_intent(prompt, req.intent)
    from app.api.workspace import resolve_task_model
    requested_model = req.model
    resolved, fallbacks, resolved_kind = await resolve_task_model(
        db, req.model, req.task_type or classified_intent, template, req.media_preferences,
    )
    req.model = resolved.or_model_id
    req.requested_model = requested_model
    req.fallback_models = fallbacks
    intent = resolved_kind
    selected = (await db.execute(
        select(AiModel).where(AiModel.or_model_id == req.model, AiModel.is_active == True)
    )).scalar_one_or_none()
    selected_outputs = set(_modalities(selected, "output_modalities")) if selected else set()
    if req.intent == "auto" and selected_outputs & {"image", "video"}:
        # Choosing a media model is itself an explicit, paid-generation action.
        intent = "video" if "video" in selected_outputs else "image"
    explicit_override = req.intent in {"image", "video"} or prompt.lstrip().lower().startswith(("/image", "/video"))
    if intent in {"image", "video"} and not settings.auto_routing_enabled and intent not in selected_outputs and not explicit_override:
        intent = "text"
    if intent == "text":
        from app.api.chat import chat_completion
        text_req = ChatRequest(
            model=req.model, messages=req.messages, max_tokens=req.max_tokens,
            temperature=req.temperature, stream=req.stream,
            fallback_models=req.fallback_models, requested_model=requested_model,
            template_id=req.template_id, task_type=req.task_type or "text",
        )
        response = await chat_completion(text_req, user=user, db=db)
        await db.commit()
        return response
    if not settings.media_generation_enabled:
        raise HTTPException(503, "Р“РµРЅРµСЂР°С†РёСЏ РјРµРґРёР° РІСЂРµРјРµРЅРЅРѕ РѕС‚РєР»СЋС‡РµРЅР°")
    if intent == "video" and not settings.video_generation_enabled:
        raise HTTPException(503, "Р“РµРЅРµСЂР°С†РёСЏ РІРёРґРµРѕ РІСЂРµРјРµРЅРЅРѕ РѕС‚РєР»СЋС‡РµРЅР°")

    model = await _choose_model(
        db,
        req.model,
        intent,
        req.media_preferences,
        allow_explicit_route=explicit_override,
    )
    job = await (_generate_image(db, user, req, model, prompt) if intent == "image" else _submit_video(db, user, req, model, prompt))

    async def events():
        yield f"data: {json.dumps({'type': 'route', 'intent': intent, 'requested_model': requested_model, 'effective_model': model.or_model_id, 'effective_model_name': model.name}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'generation', 'generation': _job_payload(job, model.name)}, ensure_ascii=False)}\n\n"
        if job.status == "failed":
            yield f"data: {json.dumps({'type': 'error', 'content': job.error or 'РћС€РёР±РєР° РіРµРЅРµСЂР°С†РёРё'}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'credits_spent': job.charged_credits}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


async def _refresh_video(db: AsyncSession, job: GenerationJob) -> None:
    if job.kind != "video" or job.status not in {"pending", "processing"} or not job.provider_job_id:
        return
    try:
        async with httpx.AsyncClient(timeout=30.0, proxy=settings.openrouter_proxy or None) as client:
            response = await client.get(f"{settings.openrouter_base_url}/videos/{job.provider_job_id}", headers=_headers())
        response.raise_for_status()
        payload = response.json()
        upstream_status = str(payload.get("status") or job.status)
        if upstream_status in {"failed", "error", "cancelled", "canceled"}:
            job.status = "failed"
            job.error = str(payload.get("error") or "OpenRouter РЅРµ СЃРјРѕРі СЃРѕР·РґР°С‚СЊ РІРёРґРµРѕ")[:1000]
            await _refund(db, job, f"Р’РѕР·РІСЂР°С‚ Р·Р° РЅРµСѓСЃРїРµС€РЅСѓСЋ РіРµРЅРµСЂР°С†РёСЋ {job.id}")
            event_user = await db.get(User, job.user_id)
            await record_server_event(
                db, event_user, "generation_failed", template_id=job.template_id,
                task_type=job.task_type or "video", model=job.effective_model,
                metadata={"result_kind": "video", "error_code": upstream_status},
            )
        elif upstream_status == "completed":
            urls = payload.get("unsigned_urls") or []
            content_url = urls[0] if urls else f"{settings.openrouter_base_url}/videos/{job.provider_job_id}/content"
            async with httpx.AsyncClient(timeout=180.0, proxy=settings.openrouter_proxy or None, follow_redirects=True) as client:
                media = await client.get(content_url, headers=_headers() if not urls else None)
            media.raise_for_status()
            target_dir = settings.generations_dir / job.id
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / "0.mp4").write_bytes(media.content)
            job.assets = json.dumps([{"id": "0", "type": "video", "media_type": media.headers.get("content-type", "video/mp4"), "url": f"/api/generations/{job.id}/assets/0"}])
            job.status = "completed"
            usage = payload.get("usage") or {}
            provider_cost = usage.get("cost")
            job.provider_cost_usd = str(provider_cost) if provider_cost is not None else None
            model = (await db.execute(select(AiModel).where(AiModel.or_model_id == job.effective_model))).scalar_one_or_none()
            if model:
                await _settle(db, job, model, provider_cost)
            else:
                job.charged_credits = job.reserved_credits
            event_user = await db.get(User, job.user_id)
            await record_server_event(
                db, event_user, "result_success", template_id=job.template_id,
                task_type=job.task_type or "video", model=job.effective_model,
                metadata={
                    "result_kind": "video",
                    "credits": job.charged_credits,
                    "provider_cost_usd": provider_cost if provider_cost is not None else "",
                },
            )
        else:
            job.status = "processing" if upstream_status in {"processing", "in_progress"} else "pending"
        await db.commit()
    except httpx.HTTPError as exc:
        logger.info("Video polling deferred job=%s: %s", job.id, exc)


@router.get("/api/generations/{job_id}")
async def generation_status(job_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(GenerationJob).where(GenerationJob.id == job_id, GenerationJob.user_id == user.id))).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Р—Р°РґР°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ")
    now = datetime.now(timezone.utc)
    expires_at = job.expires_at if job.expires_at.tzinfo else job.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now and job.status == "completed":
        job.status = "expired"
        await db.commit()
    await _refresh_video(db, job)
    model = (await db.execute(select(AiModel).where(AiModel.or_model_id == job.effective_model))).scalar_one_or_none()
    return _job_payload(job, model.name if model else None)


@router.get("/api/generations/{job_id}/assets/{asset_id}")
async def generation_asset(job_id: str, asset_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(GenerationJob).where(GenerationJob.id == job_id, GenerationJob.user_id == user.id))).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ")
    now = datetime.now(timezone.utc)
    expires_at = job.expires_at if job.expires_at.tzinfo else job.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now and job.status == "completed":
        job.status = "expired"
        await db.commit()
    if job.status == "expired":
        raise HTTPException(410, "РЎСЂРѕРє С…СЂР°РЅРµРЅРёСЏ С„Р°Р№Р»Р° РёСЃС‚С‘Рє")
    asset = next((item for item in _json(job.assets, []) if str(item.get("id")) == asset_id), None)
    if not asset:
        raise HTTPException(404, "Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ")
    target_dir = (settings.generations_dir / job.id).resolve()
    candidates = list(target_dir.glob(f"{asset_id}.*"))
    if not candidates or target_dir not in candidates[0].resolve().parents:
        raise HTTPException(404, "Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ")
    return FileResponse(candidates[0], media_type=asset.get("media_type"), filename=candidates[0].name)

