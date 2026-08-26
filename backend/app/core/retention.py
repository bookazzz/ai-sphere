"""Thirty-day cleanup for user chat content and associated private files."""

import asyncio
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, or_, select

from app.core.config import settings
from app.core.database import async_session
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.feedback import MessageFeedback
from app.models.file_record import FileRecord
from app.models.generation_job import GenerationJob
from app.models.user_query import UserQuery


def _remove_file(path: str, root: Path) -> None:
    target = Path(path).resolve()
    if root in target.parents and target.is_file():
        target.unlink(missing_ok=True)


async def cleanup_expired_history() -> dict[str, int]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=settings.history_retention_days)
    async with async_session() as db:
        session_ids = list((await db.execute(select(ChatSession.id).where(ChatSession.updated_at < cutoff))).scalars())
        files = list((await db.execute(select(FileRecord).where(or_(
            FileRecord.expires_at <= now,
            FileRecord.chat_id.in_(session_ids) if session_ids else False,
        )))).scalars())
        jobs = list((await db.execute(select(GenerationJob).where(or_(
            GenerationJob.expires_at <= now,
            GenerationJob.session_id.in_(session_ids) if session_ids else False,
        )))).scalars())
        upload_root = settings.uploads_dir.resolve()
        generation_root = settings.generations_dir.resolve()
        for item in files:
            _remove_file(item.storage_path, upload_root)
            await db.delete(item)
        for job in jobs:
            target = (generation_root / job.id).resolve()
            if generation_root in target.parents and target.is_dir():
                shutil.rmtree(target)
            await db.delete(job)
        if session_ids:
            await db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(session_ids)))
            await db.execute(delete(MessageFeedback).where(MessageFeedback.session_id.in_(session_ids)))
            await db.execute(delete(UserQuery).where(UserQuery.session_id.in_(session_ids)))
            await db.execute(delete(ChatSession).where(ChatSession.id.in_(session_ids)))
        await db.commit()
        return {"sessions": len(session_ids), "files": len(files), "generations": len(jobs)}


async def retention_cleanup_loop() -> None:
    while True:
        await asyncio.sleep(24 * 60 * 60)
        await cleanup_expired_history()

