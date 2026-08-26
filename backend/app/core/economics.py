"""Conservative model pricing tied to the currently active credit plans."""

from __future__ import annotations

import math
import re
import json
from datetime import datetime, time, timezone
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.credit_plan import CreditPlan
from app.models.product_event import ProductEvent
from app.models.user import User
from app.core.credits import MOSCOW_TZ


FALLBACK_CREDIT_RUB = 0.08


async def free_program_cost_today(db: AsyncSession) -> float:
    """Authoritative provider cost generated today by users who never paid."""
    local_now = datetime.now(MOSCOW_TZ)
    start = datetime.combine(local_now.date(), time.min, tzinfo=MOSCOW_TZ).astimezone(timezone.utc)
    rows = (await db.execute(
        select(ProductEvent.metadata_json)
        .join(User, User.id == ProductEvent.user_id)
        .where(ProductEvent.event_name == "result_success", ProductEvent.created_at >= start, User.total_paid_rub == 0)
    )).scalars().all()
    total = 0.0
    for raw in rows:
        try:
            value = json.loads(raw or "{}").get("provider_cost_usd")
            if value not in (None, ""):
                total += max(0.0, float(value))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
    return total


async def enforce_free_program_budget(db: AsyncSession, user: User) -> None:
    if user.total_paid_rub > 0 or settings.free_daily_cost_budget_usd <= 0:
        return
    if await free_program_cost_today(db) >= settings.free_daily_cost_budget_usd:
        from fastapi import HTTPException
        raise HTTPException(429, "Р”РЅРµРІРЅРѕР№ Р»РёРјРёС‚ Р±РµСЃРїР»Р°С‚РЅС‹С… РіРµРЅРµСЂР°С†РёР№ РёСЃС‡РµСЂРїР°РЅ")


@dataclass(frozen=True)
class PricingContext:
    credit_rub: float
    plan_id: int | None
    plan_name: str
    target_margin: float
    payment_fee_rate: float
    provider_funding_fee_rate: float
    usd_rub_rate: float
    fx_safety_factor: float

    @property
    def provider_budget_share(self) -> float:
        """Share of gross revenue left for inference while preserving margin."""
        return max(
            0.01,
            1.0 - self.target_margin - self.payment_fee_rate,
        )

    @property
    def effective_usd_rub(self) -> float:
        return self.usd_rub_rate * self.fx_safety_factor * (1.0 + self.provider_funding_fee_rate)

    @property
    def credits_per_provider_usd(self) -> float:
        return self.effective_usd_rub / (self.credit_rub * self.provider_budget_share)


async def pricing_context(db: AsyncSession) -> PricingContext:
    plans = (await db.execute(
        select(CreditPlan).where(CreditPlan.is_active == True).order_by(CreditPlan.sort_order, CreditPlan.id)
    )).scalars().all()
    priced = [
        (plan.price_rub / 100 / (plan.credits + plan.bonus_credits), plan)
        for plan in plans if plan.price_rub > 0 and plan.credits + plan.bonus_credits > 0
    ]
    if priced:
        credit_rub, plan = min(priced, key=lambda item: item[0])
        plan_id, plan_name = plan.id, plan.name
    else:
        credit_rub, plan_id, plan_name = FALLBACK_CREDIT_RUB, None, "СЂРµР·РµСЂРІРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ"
    return PricingContext(
        credit_rub=credit_rub,
        plan_id=plan_id,
        plan_name=plan_name,
        target_margin=settings.target_gross_margin,
        payment_fee_rate=settings.payment_fee_rate,
        provider_funding_fee_rate=settings.openrouter_funding_fee_rate,
        usd_rub_rate=settings.usd_rub_rate,
        fx_safety_factor=settings.fx_safety_factor,
    )


def round_credits(value: float, precision: float = 0.01) -> float:
    if value <= 0:
        return 0.0
    return math.ceil(value / precision) * precision


def credits_for_provider_cost(cost_usd: float, context: PricingContext, *, whole: bool = False) -> float:
    raw = max(0.0, cost_usd) * context.credits_per_provider_usd
    return float(math.ceil(raw)) if whole else round_credits(raw)


def achieved_margin(cost_usd: float, credits: float, context: PricingContext) -> float:
    revenue = max(0.0, credits) * context.credit_rub
    if cost_usd <= 0:
        return 100.0
    if revenue <= 0:
        return -100.0
    provider_cost = cost_usd * context.effective_usd_rub
    payment_cost = revenue * context.payment_fee_rate
    return round((revenue - provider_cost - payment_cost) / revenue * 100, 2)


def text_prices(input_usd_per_million: float, output_usd_per_million: float, context: PricingContext) -> tuple[float, float]:
    return (
        credits_for_provider_cost(max(0.0, input_usd_per_million) / 1000, context),
        credits_for_provider_cost(max(0.0, output_usd_per_million) / 1000, context),
    )


def text_task_metrics(
    input_usd_per_million: float,
    output_usd_per_million: float,
    input_credits_per_1k: float,
    output_credits_per_1k: float,
    input_tokens: int,
    output_tokens: int,
    context: PricingContext,
) -> dict[str, float | int]:
    provider_cost = (
        max(0, input_tokens) * max(0.0, input_usd_per_million)
        + max(0, output_tokens) * max(0.0, output_usd_per_million)
    ) / 1_000_000
    raw_credits = (
        max(0, input_tokens) * max(0.0, input_credits_per_1k)
        + max(0, output_tokens) * max(0.0, output_credits_per_1k)
    ) / 1000
    charged_credits = max(1, math.ceil(raw_credits)) if provider_cost > 0 else 0
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "provider_cost_usd": round(provider_cost, 6),
        "credits": charged_credits,
        "customer_price_rub": round(charged_credits * context.credit_rub, 2),
        "margin_pct": achieved_margin(provider_cost, charged_credits, context),
    }


def provider_cost_from_snapshot(
    snapshot: dict,
    kind: str,
    parameters: dict | None = None,
    *,
    conservative: bool = True,
) -> float | None:
    """Extract a per-request media cost from current and legacy OR snapshots."""
    parameters = parameters or {}
    candidates: list[float] = []

    def video_token_count() -> float | None:
        """Estimate OpenRouter video tokens from output dimensions and duration."""
        size = str(parameters.get("size", ""))
        match = re.fullmatch(r"(\d+)x(\d+)", size, flags=re.IGNORECASE)
        if match:
            width, height = int(match.group(1)), int(match.group(2))
        else:
            resolution = str(parameters.get("resolution", "")).lower()
            resolution_match = re.fullmatch(r"(\d{3,4})p", resolution)
            short_edge = int(resolution_match.group(1)) if resolution_match else {
                "1k": 1080, "2k": 1440, "4k": 2160,
            }.get(resolution)
            ratio_match = re.fullmatch(r"(\d+):(\d+)", str(parameters.get("aspect_ratio", "")))
            if not short_edge or not ratio_match:
                return None
            ratio_width, ratio_height = int(ratio_match.group(1)), int(ratio_match.group(2))
            if ratio_width >= ratio_height:
                height = short_edge
                width = round(short_edge * ratio_width / ratio_height)
            else:
                width = short_edge
                height = round(short_edge * ratio_height / ratio_width)
        duration = max(1, int(parameters.get("duration", 1)))
        # OpenRouter defines video tokens as pixels * seconds * 24 / 1024.
        return width * height * duration * 24 / 1024

    def add(value, key: str = "") -> None:
        try:
            cost = float(value)
        except (TypeError, ValueError):
            return
        if cost <= 0:
            return
        lower = key.lower()
        if kind == "video":
            if "video_token" in lower or "video-token" in lower:
                tokens = video_token_count()
                if tokens is None:
                    return
                cost *= tokens
            elif "second" in lower or "sec" in lower:
                cost *= max(1, int(parameters.get("duration", 1)))
        candidates.append(cost)

    catalog = snapshot.get("catalog", snapshot)
    if isinstance(catalog, dict):
        # Request/output-media prices are usable for fixed-cost generation.
        for key in ("request", "image", "video", "output_image", "generate", "cost_usd"):
            if key in catalog:
                add(catalog[key], key)

    skus = snapshot.get("pricing_skus", {})
    if isinstance(skus, dict):
        requested_resolution = str(parameters.get("resolution", "")).lower()
        matching = {
            key: value for key, value in skus.items()
            if not requested_resolution or requested_resolution in key.lower() or not re.search(r"\d{3,4}p", key.lower())
        } or skus
        token_skus = {key: value for key, value in matching.items() if "video_token" in key.lower() or "video-token" in key.lower()}
        if token_skus:
            without_audio = {key: value for key, value in token_skus.items() if "without_audio" in key.lower() or "no_audio" in key.lower()}
            with_audio = {key: value for key, value in token_skus.items() if key not in without_audio}
            if parameters.get("generate_audio") is False and without_audio:
                matching = without_audio
            elif parameters.get("generate_audio") is True and with_audio:
                matching = with_audio
        for key, value in matching.items():
            add(value, key)

    endpoints = snapshot.get("endpoints", [])
    if isinstance(endpoints, list):
        for endpoint in endpoints:
            if not isinstance(endpoint, dict):
                continue
            pricing = endpoint.get("pricing", {})
            if isinstance(pricing, dict):
                for key in ("request", "image", "video", "output_image", "generate", "cost_usd"):
                    if key in pricing:
                        add(pricing[key], key)

    # Compatibility with the earlier image endpoint snapshot format.
    lines = snapshot.get("pricing", [])
    if isinstance(lines, list):
        for line in lines:
            if not isinstance(line, dict):
                continue
            requested_resolution = str(parameters.get("resolution", "")).lower()
            variant = str(line.get("variant") or "").lower()
            if variant and requested_resolution and variant != requested_resolution:
                continue
            add(line.get("cost_usd"), str(line.get("unit") or line.get("billable") or ""))

    if not candidates:
        return None
    return max(candidates) if conservative else min(candidates)

