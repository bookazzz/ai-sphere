"""AI-Sphere FastAPI backend."""

import logging
logger = logging.getLogger("ai-sphere")
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.database import engine
from app.core.limiter import limiter
from app.models.base import Base
from app.api import auth, billing, chat, admin, public, tickets


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup + migrate existing DB."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _migrate(sync_conn):
            """Add new columns to users table if missing."""
            from sqlalchemy import inspect
            inspector = inspect(sync_conn)
            cols = [c["name"] for c in inspector.get_columns("users")]
            for col, col_type in [
                ("last_daily_reset", "DATE"),
                ("credits_paid", "INTEGER DEFAULT 0"),
                ("credits_free", "INTEGER DEFAULT 0"),
                ("credits_bonus", "INTEGER DEFAULT 0"),
                ("credits_promo", "INTEGER DEFAULT 0"),
                ("free_program_start", "DATE"),
                ("free_program_days", "INTEGER DEFAULT 60"),
                ("role_id", "INTEGER"),
                ("total_spent_credits", "INTEGER DEFAULT 0"),
                ("total_paid_rub", "INTEGER DEFAULT 0"),
                ("request_count", "INTEGER DEFAULT 0"),
                ("chat_count", "INTEGER DEFAULT 0"),
                ("registered_by", "VARCHAR(50) DEFAULT 'email'"),
                ("reg_ip", "VARCHAR(50)"),
                ("reg_ua", "VARCHAR(500)"),
                ("reg_source", "VARCHAR(255)"),
                ("reg_utm", "VARCHAR(500)"),
                ("referrer_id", "INTEGER"),
                ("referral_code", "VARCHAR(50)"),
            ]:
                if col not in cols:
                    sync_conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col} {col_type}")
                    logger.info("Added column users.%s", col)

        await conn.run_sync(_migrate)

        # Seed default data if empty
        from sqlalchemy import text
        from app.models.role import Role
        from app.models.ai_model import AiModel
        from app.models.credit_plan import CreditPlan
        from app.models.promo import PromoCode
        from app.models.seo_page import SeoPage

        role_count = (await conn.execute(text("SELECT COUNT(*) FROM admin_roles"))).scalar()
        if role_count == 0:
            roles = [
                Role(name="Суперадминистратор", description="Полный доступ",
                     permissions='{"*": "crud"}', is_system=True),
                Role(name="Администратор", description="Управление пользователями и моделями",
                     permissions='{"users": "crud", "models": "crud", "plans": "crud", "promo": "crud"}', is_system=True),
                Role(name="Фин. менеджер", description="Финансы и платежи",
                     permissions='{"payments": "crud", "plans": "r", "users": "r"}', is_system=True),
                Role(name="Контент-менеджер", description="SEO и контент",
                     permissions='{"content": "crud"}', is_system=True),
                Role(name="Техподдержка", description="Пользователи и обращения",
                     permissions='{"users": "r", "chats": "r"}', is_system=True),
                Role(name="Аналитик", description="Только чтение",
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
            # Set fixed_price for image models
            await conn.execute(text(
                "UPDATE ai_models SET fixed_price = 40 WHERE or_model_id = 'google/gemini-3.1-flash-lite-image'"
            ))
            logger.info("Set fixed_price=40 for Gemini 3.1 Flash Lite Image")

        plan_count = (await conn.execute(text("SELECT COUNT(*) FROM credit_plans"))).scalar()
        if plan_count == 0:
            plans = [
                ("Стартовый", 5000, 500, 0, None, None, 1),
                ("Базовый", 25000, 2500, 0, None, None, 2),
                ("Популярный", 100000, 10000, 1500, 115000, "+15%", 3),
                ("Премиум", 250000, 25000, 5000, 300000, "+20%", 4),
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
    yield


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

# Routers
app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(public.router)
app.include_router(tickets.router)

# Serve uploaded files
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
