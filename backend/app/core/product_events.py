"""Server-authoritative product events and campaign conversions."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.gamification import process_product_event
from app.models.product_event import ProductEvent
from app.models.product_growth import Campaign, CampaignDelivery
from app.models.user import User


async def record_server_event(
    db: AsyncSession,
    user: User | None,
    event_name: str,
    *,
    template_id: int | None = None,
    task_type: str = "",
    model: str = "",
    metadata: dict[str, Any] | None = None,
) -> ProductEvent:
    """Record a trusted event produced by business logic, not by the browser."""
    event_id = str(uuid.uuid4())
    safe_metadata = {**(metadata or {}), "_authoritative": True}
    context: ProductEvent | None = None
    if user:
        context = (await db.execute(
            select(ProductEvent).where(
                ProductEvent.user_id == user.id,
                or_(ProductEvent.anonymous_id != "", ProductEvent.visit_session_id != ""),
            ).order_by(ProductEvent.id.desc()).limit(1)
        )).scalar_one_or_none()
    event = ProductEvent(
        event_id=event_id,
        user_id=user.id if user else None,
        anonymous_id=context.anonymous_id if context else "",
        visit_session_id=context.visit_session_id if context else "",
        event_name=event_name,
        page=context.page if context else "",
        source=context.source if context else "",
        device_type=context.device_type if context else "server",
        experiment_variants=context.experiment_variants if context else "{}",
        template_id=template_id,
        task_type=task_type,
        model=model,
        metadata_json=json.dumps(safe_metadata, ensure_ascii=False),
    )
    db.add(event)
    await process_product_event(
        db,
        user,
        event_id=event_id,
        event_name=event_name,
        template_id=template_id,
        task_type=task_type,
        metadata=safe_metadata,
    )

    campaign_ids = select(Campaign.id).where(
        Campaign.goal_event == event_name,
        Campaign.status == "active",
    )
    filters = [
        CampaignDelivery.campaign_id.in_(campaign_ids),
        CampaignDelivery.converted_at.is_(None),
    ]
    if user:
        filters.append(CampaignDelivery.user_id == user.id)
        await db.execute(
            update(CampaignDelivery)
            .where(*filters)
            .values(converted_at=datetime.now(timezone.utc))
        )
    return event
