"""AI-Sphere FastAPI backend."""

import logging
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
from app.api import auth, billing, chat, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup + migrate existing DB."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migration: add last_daily_reset column if missing
        from sqlalchemy import inspect
        def _migrate(sync_conn):  # noqa: PLR1714
            inspector = inspect(sync_conn)
            columns = [c["name"] for c in inspector.get_columns("users")]
            if "last_daily_reset" not in columns:
                sync_conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN last_daily_reset DATE DEFAULT NULL"
                )
        await conn.run_sync(_migrate)
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

# Serve uploaded files
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
