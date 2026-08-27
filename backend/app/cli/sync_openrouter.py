"""Synchronize the full OpenRouter catalogue and re-apply margin guardrails."""

import asyncio
import json

from app.api.admin import _reprice_catalog, auto_update_prices
from app.core.database import async_session


async def run() -> None:
    async with async_session() as db:
        await _reprice_catalog(db)
        await db.commit()
        result = await auto_update_prices(None, db)
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(run())
