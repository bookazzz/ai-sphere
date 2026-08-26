"""AI-Sphere FastAPI backend."""

import logging
import asyncio
import json
from datetime import datetime, timezone
logger = logging.getLogger("ai-sphere")
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.database import engine, async_session
from app.core.limiter import limiter
from app.core.admin_audit import admin_security_middleware
from app.models.base import Base
from app.api import auth, billing, chat, admin, public, tickets, generations, feedback, workspace, growth


async def catalogue_sync_loop() -> None:
    """Refresh OpenRouter in the background without delaying application startup."""
    if not settings.openrouter_api_key:
        return
    await asyncio.sleep(60)
    while True:
        try:
            async with async_session() as db:
                result = await admin.auto_update_prices(None, db)
                logger.info("Scheduled OpenRouter sync: %s", result)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Scheduled OpenRouter sync failed: %s", exc)
        await asyncio.sleep(6 * 60 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables for fresh development databases and seed missing defaults.

    Existing production databases must be upgraded with Alembic before startup.
    """
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.generations_dir.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        if settings.environment.lower() != "production":
            await conn.run_sync(Base.metadata.create_all)

        # Seed default data if empty
        from sqlalchemy import text
        from app.models.role import Role
        from app.models.ai_model import AiModel
        from app.models.credit_plan import CreditPlan
        from app.models.promo import PromoCode
        from app.models.seo_page import SeoPage
        from app.models.task_template import TaskTemplate
        from app.models.product_growth import Mission, Survey, SurveyQuestion, Achievement
        from app.models.app_setting import AppSetting
        from app.core.gamification import DEFAULT_MISSIONS, DEFAULT_SURVEYS

        role_count = (await conn.execute(text("SELECT COUNT(*) FROM admin_roles"))).scalar()
        if role_count == 0:
            roles = [
                Role(name="РЎСѓРїРµСЂР°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ", description="РџРѕР»РЅС‹Р№ РґРѕСЃС‚СѓРї",
                     permissions='{"*": "crud"}', is_system=True),
                Role(name="РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ", description="РЈРїСЂР°РІР»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё Рё РјРѕРґРµР»СЏРјРё",
                     permissions='{"users": "crud", "models": "crud", "plans": "crud", "promo": "crud"}', is_system=True),
                Role(name="Р¤РёРЅ. РјРµРЅРµРґР¶РµСЂ", description="Р¤РёРЅР°РЅСЃС‹ Рё РїР»Р°С‚РµР¶Рё",
                     permissions='{"payments": "crud", "plans": "r", "users": "r"}', is_system=True),
                Role(name="РљРѕРЅС‚РµРЅС‚-РјРµРЅРµРґР¶РµСЂ", description="SEO Рё РєРѕРЅС‚РµРЅС‚",
                     permissions='{"content": "crud"}', is_system=True),
                Role(name="РўРµС…РїРѕРґРґРµСЂР¶РєР°", description="РџРѕР»СЊР·РѕРІР°С‚РµР»Рё Рё РѕР±СЂР°С‰РµРЅРёСЏ",
                     permissions='{"users": "r", "chats": "r"}', is_system=True),
                Role(name="РђРЅР°Р»РёС‚РёРє", description="РўРѕР»СЊРєРѕ С‡С‚РµРЅРёРµ",
                     permissions='{"*": "r"}', is_system=True),
            ]
            for r in roles:
                await conn.execute(text(
                    "INSERT INTO admin_roles (name, description, permissions, is_system, created_at) "
                    "VALUES (:name, :desc, :perms, 1, datetime('now'))"
                ), {"name": r.name, "desc": r.description, "perms": r.permissions})
            logger.info("Seeded %d default roles", len(roles))

        model_count = (await conn.execute(text("SELECT COUNT(*) FROM ai_models"))).scalar()
        if model_count == 0:
            models = [
                ("Claude Sonnet 4", "claude-sonnet-4-20250514", "Anthropic", "universal", 3, 15, 128000, 8192, True),
                ("Claude Haiku 3.5", "claude-3-5-haiku-20241022", "Anthropic", "fast", 1, 5, 128000, 4096, True),
                ("GPT-4o", "gpt-4o", "OpenAI", "universal", 2.5, 10, 128000, 4096, True),
                ("GPT-4o Mini", "gpt-4o-mini", "OpenAI", "fast", 0.15, 0.6, 128000, 4096, False),
                ("DeepSeek V3", "deepseek/deepseek-chat", "DeepSeek", "universal", 0.5, 2, 128000, 4096, False),
                ("DeepSeek R1", "deepseek/deepseek-r1", "DeepSeek", "reasoning", 0.55, 2.19, 128000, 4096, False),
                ("Gemini 2.5 Pro", "google/gemini-2.5-pro-preview-03-25", "Google", "universal", 1.25, 5, 128000, 8192, True),
                ("Gemini 2.5 Flash", "google/gemini-2.5-flash-preview-04-17", "Google", "fast", 0.15, 0.6, 128000, 4096, True),
                ("Mistral Large", "mistralai/mistral-large-2411", "Mistral", "universal", 2, 6, 128000, 4096, False),
                ("Llama 3.3 70B", "meta-llama/llama-3.3-70b-instruct", "Meta", "fast", 0.25, 1, 128000, 4096, False),
                ("Qwen 2.5 72B", "qwen/qwen-2.5-72b-instruct", "Qwen", "universal", 0.35, 1.4, 128000, 4096, False),
                ("Grok 2", "x-ai/grok-2-1212", "xAI", "universal", 2, 10, 128000, 4096, False),
                ("GPT-4.1", "gpt-4.1", "OpenAI", "premium", 2, 8, 128000, 4096, True),
                ("GPT-4.1 Mini", "gpt-4.1-mini", "OpenAI", "fast", 0.4, 1.6, 128000, 4096, True),
                ("Claude Opus 4", "claude-opus-4-20250514", "Anthropic", "premium", 15, 75, 128000, 4096, True),
                ("Gemini 2.5 Pro (Safety)", "google/gemini-2.5-pro-preview-03-25:she", "Google", "universal", 1.25, 5, 128000, 8192, True),
                ("Gemini 3.1 Flash Lite Image", "google/gemini-3.1-flash-lite-image", "Google", "fast", 0, 0, 65536, 4096, True),
            ]
            for m in models:
                await conn.execute(text(
                    "INSERT INTO ai_models (name, description, or_model_id, provider, category, "
                    "price_input, price_output, price_unit, price_mode, "
                    "or_input_cost, or_output_cost, or_auto_update, "
                    "max_input_tokens, max_output_tokens, max_context, "
                    "max_files, max_file_size_mb, "
                    "fixed_price, min_cost, markup_factor, margin, margin_min, is_unprofitable, "
                    "daily_limit_per_user, spend_limit_per_user, total_spend_limit, "
                    "min_balance, show_cost_warning, "
                    "is_active, is_visible, is_free_available, is_guest_available, is_paid_only, "
                    "request_count, total_cost_or, total_revenue, error_count, avg_response_time, "
                    "vision, sort_order, created_at) "
                    "VALUES (:name, :name, :or_id, :prov, :cat, "
                    ":pi, :po, 0, '', "
                    "0, 0, 0, "
                    ":max_in, :max_out, 0, "
                    "0, 0, "
                    "0, 0, 0, 0, 0, 0, "
                    "0, 0, 0, "
                    "0, 0, "
                    "1, 1, 0, 0, 0, "
                    "0, 0, 0, 0, 0, "
                    ":vis, 100, datetime('now'))"
                ), {"name": m[0], "or_id": m[1], "prov": m[2], "cat": m[3],
                    "pi": m[4], "po": m[5], "max_in": m[6], "max_out": m[7], "vis": m[8]})
            logger.info("Seeded %d initial models", len(models))
            await conn.execute(text("UPDATE ai_models SET input_modalities = '[\"text\",\"image\"]' WHERE vision = 1"))
            # Set fixed_price for image models
            await conn.execute(text(
                "UPDATE ai_models SET fixed_price = 40, output_modalities = '[\"image\"]', "
                "input_modalities = '[\"text\"]', auto_route_enabled = 1 "
                "WHERE or_model_id = 'google/gemini-3.1-flash-lite-image'"
            ))
            logger.info("Set fixed_price=40 for Gemini 3.1 Flash Lite Image")

        # Idempotent seed by stable provider ID. Never overwrite admin changes.
        default_model_id = "deepseek/deepseek-v4-flash"
        default_exists = (await conn.execute(
            text("SELECT COUNT(*) FROM ai_models WHERE or_model_id = :model_id"),
            {"model_id": default_model_id},
        )).scalar()
        if not default_exists:
            await conn.execute(AiModel.__table__.insert().values(
                name="DeepSeek V4 Flash", description="DeepSeek V4 Flash",
                or_model_id=default_model_id, provider="DeepSeek", category="fast",
                price_input=1, price_output=2, max_input_tokens=65536,
                max_output_tokens=4096, max_context=65536, is_active=True,
                is_visible=True, vision=False, sort_order=10,
            ))
            logger.info("Seeded missing default model %s", default_model_id)

        plan_count = (await conn.execute(text("SELECT COUNT(*) FROM credit_plans"))).scalar()
        if plan_count == 0:
            plans = [
                ("РЎС‚Р°СЂС‚РѕРІС‹Р№", 5000, 500, 0, None, None, 1),
                ("Р‘Р°Р·РѕРІС‹Р№", 25000, 2500, 0, None, None, 2),
                ("РџРѕРїСѓР»СЏСЂРЅС‹Р№", 100000, 10000, 1500, 115000, "+15%", 3),
                ("РџСЂРµРјРёСѓРј", 250000, 25000, 5000, 300000, "+20%", 4),
            ]
            for p in plans:
                await conn.execute(text(
                    "INSERT INTO credit_plans (name, description, price_rub, credits, bonus_credits, "
                    "old_price_rub, badge, sort_order, is_active, created_at, "
                    "is_new_users_only, purchase_limit, purchase_count, total_revenue_rub) "
                    "VALUES (:name, :name, :price, :credits, :bonus, :old_price, :badge, :order, 1, datetime('now'), "
                    "0, 0, 0, 0)"
                ), {"name": p[0], "price": p[1], "credits": p[2], "bonus": p[3],
                    "old_price": p[4], "badge": p[5], "order": p[6]})
            logger.info("Seeded %d credit plans", len(plans))
        template_count = (await conn.execute(text("SELECT COUNT(*) FROM task_templates"))).scalar()
        if template_count == 0:
            from app.core.task_templates import DEFAULT_TASK_TEMPLATES
            templates = [template for template in DEFAULT_TASK_TEMPLATES if template["slug"] != "improve-text"]
            for template in templates:
                await conn.execute(TaskTemplate.__table__.insert().values(**template))
            logger.info("Seeded %d task templates", len(templates))
        # The launch catalogue intentionally contains twelve mass-market tasks.
        # Editing is covered by the combined write/improve scenario.
        await conn.execute(text("UPDATE task_templates SET is_active = 0 WHERE slug = 'improve-text'"))
        await conn.execute(text("UPDATE task_templates SET title = :title, description = :description WHERE slug = 'write-text'"), {
            "title": "РќР°РїРёСЃР°С‚СЊ РёР»Рё СѓР»СѓС‡С€РёС‚СЊ С‚РµРєСЃС‚",
            "description": "РЎРѕР·РґР°С‚СЊ РЅРѕРІС‹Р№ С‚РµРєСЃС‚ РёР»Рё РѕС‚СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РіРѕС‚РѕРІС‹Р№",
        })
        mission_count = (await conn.execute(text("SELECT COUNT(*) FROM missions"))).scalar()
        if mission_count == 0:
            for item in DEFAULT_MISSIONS:
                await conn.execute(Mission.__table__.insert().values(
                    code=item["code"], title=item["title"], description=item["description"],
                    criteria_json=json.dumps(item["criteria"], ensure_ascii=False),
                    reward_credits=item["credits"], reward_xp=item["xp"], period=item["period"],
                    is_active=True, sort_order=item["order"],
                ))
        survey_count = (await conn.execute(text("SELECT COUNT(*) FROM surveys"))).scalar()
        if survey_count == 0:
            for item in DEFAULT_SURVEYS:
                result = await conn.execute(Survey.__table__.insert().values(
                    code=item["code"], title=item["title"], trigger_event=item["trigger"],
                    status="active", is_critical=item["critical"], frequency_days=14,
                ))
                survey_id = result.inserted_primary_key[0]
                await conn.execute(SurveyQuestion.__table__.insert().values(
                    survey_id=survey_id, prompt=item["question"], question_type="single",
                    options_json=json.dumps(item["options"], ensure_ascii=False), sort_order=10,
                ))
        achievement_count = (await conn.execute(text("SELECT COUNT(*) FROM achievements"))).scalar()
        if achievement_count == 0:
            for code, title, description, icon in (
                ("first-result", "РџРµСЂРІС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚", "РџРѕР»СѓС‡РµРЅ РїРµСЂРІС‹Р№ РїРѕР»РµР·РЅС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚", "вњ¦"),
                ("explorer", "РСЃСЃР»РµРґРѕРІР°С‚РµР»СЊ", "РћСЃРІРѕРµРЅС‹ С‚СЂРё СЂР°Р·РЅС‹С… СЃС†РµРЅР°СЂРёСЏ", "в—‡"),
                ("project-master", "РњР°СЃС‚РµСЂ РїСЂРѕС†РµСЃСЃРѕРІ", "Р—Р°РІРµСЂС€С‘РЅ РјРЅРѕРіРѕС€Р°РіРѕРІС‹Р№ РїСЂРѕРµРєС‚", "в—†"),
            ):
                await conn.execute(Achievement.__table__.insert().values(
                    code=code, title=title, description=description, icon=icon,
                    criteria_json="{}", is_active=True,
                ))
        baseline_exists = (await conn.execute(text("SELECT COUNT(*) FROM app_settings WHERE key = 'analytics_v2_baseline'"))).scalar()
        if not baseline_exists:
            await conn.execute(AppSetting.__table__.insert().values(
                key="analytics_v2_baseline", value=datetime.now(timezone.utc).isoformat(),
            ))

    from app.api.generations import media_cleanup_loop
    from app.core.retention import cleanup_expired_history, retention_cleanup_loop
    await cleanup_expired_history()
    cleanup_task = asyncio.create_task(media_cleanup_loop())
    retention_task = asyncio.create_task(retention_cleanup_loop())
    catalogue_task = asyncio.create_task(catalogue_sync_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        retention_task.cancel()
        catalogue_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
        try:
            await retention_task
        except asyncio.CancelledError:
            pass
        try:
            await catalogue_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(admin_security_middleware)


@app.middleware("http")
async def enforce_allowed_origin(request: Request, call_next):
    """Require an allowlisted Origin for mutations, except provider callbacks."""
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.url.path != "/api/billing/webhook":
        origin = request.headers.get("origin")
        if not origin or origin.rstrip("/") not in settings.allowed_origins:
            return JSONResponse({"detail": "Origin is not allowed"}, status_code=403)
    return await call_next(request)

# Routers
app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(public.router)
app.include_router(tickets.router)
app.include_router(generations.router)
app.include_router(feedback.router)
app.include_router(workspace.router)
app.include_router(growth.router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name}

