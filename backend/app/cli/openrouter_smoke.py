"""Opt-in paid OpenRouter text/image/video staging smoke test.

The command never submits a paid request until discovery produced a price and
the cumulative conservative estimate fits AISPHERE_OPENROUTER_SMOKE_MAX_USD.
Paid POST requests are intentionally never retried.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from urllib.parse import urljoin

import httpx

from app.core.config import settings


def _enabled() -> bool:
    return os.getenv("AISPHERE_OPENROUTER_SMOKE", "").lower() in {"1", "true", "yes"}


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-sphere.ru",
        "X-Title": "AI-Sphere staging smoke",
    }


async def _json(client: httpx.AsyncClient, method: str, url: str, **kwargs) -> dict:
    response = await client.request(method, url, **kwargs)
    if response.is_error:
        detail = response.text[:500].replace("\n", " ")
        raise RuntimeError(f"OpenRouter {method} {url} failed ({response.status_code}): {detail}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected JSON response from {url}")
    return payload


def _number(value) -> float | None:
    try:
        number = float(value)
        return number if number > 0 else None
    except (TypeError, ValueError):
        return None


async def _choose_text(client: httpx.AsyncClient) -> tuple[dict, float]:
    catalog = await _json(client, "GET", f"{settings.openrouter_base_url}/models", headers=_headers())
    candidates = []
    for model in catalog.get("data", []):
        pricing = model.get("pricing") or {}
        prompt = _number(pricing.get("prompt"))
        completion = _number(pricing.get("completion"))
        outputs = (model.get("architecture") or {}).get("output_modalities") or ["text"]
        if prompt is not None and completion is not None and "text" in outputs:
            # Conservative allowance for a tiny prompt and 16 output tokens.
            candidates.append((prompt * 256 + completion * 16, model["id"]))
    if not candidates:
        raise RuntimeError("No priced text model discovered")
    estimate, model_id = min(candidates)
    return {
        "model": model_id,
        "messages": [{"role": "user", "content": "Reply with exactly: ok"}],
        "max_tokens": 16,
        "temperature": 0,
    }, estimate


async def _choose_image(client: httpx.AsyncClient) -> tuple[dict, float]:
    catalog = await _json(client, "GET", f"{settings.openrouter_base_url}/images/models", headers=_headers())
    base_origin = settings.openrouter_base_url.removesuffix("/api/v1") + "/"
    candidates: list[tuple[float, str, str | None, dict]] = []
    semaphore = asyncio.Semaphore(8)

    async def inspect(model: dict) -> None:
        endpoint_path = model.get("endpoints")
        if not isinstance(endpoint_path, str) or not model.get("id"):
            return
        url = endpoint_path if endpoint_path.startswith("http") else urljoin(base_origin, endpoint_path.lstrip("/"))
        async with semaphore:
            detail = await _json(client, "GET", url, headers=_headers())
        for endpoint in detail.get("endpoints", []):
            for line in endpoint.get("pricing", []):
                cost = _number(line.get("cost_usd"))
                if cost is None or line.get("billable") != "output_image" or line.get("unit") != "image":
                    continue
                variant = str(line.get("variant") or "").lower()
                if variant and variant != "1k":
                    continue
                candidates.append((cost, model["id"], endpoint.get("provider_tag"), endpoint.get("supported_parameters") or {}))

    await asyncio.gather(*(inspect(model) for model in catalog.get("data", [])))
    if not candidates:
        raise RuntimeError("No image endpoint with per-image pricing discovered")
    estimate, model_id, provider_tag, supported = min(candidates, key=lambda item: item[0])
    body: dict = {"model": model_id, "prompt": "A small blue circle on a white background", "n": 1}
    for key, default in (("resolution", "1K"), ("aspect_ratio", "1:1"), ("output_format", "png")):
        descriptor = supported.get(key)
        values = descriptor.get("values", []) if isinstance(descriptor, dict) else []
        if descriptor:
            body[key] = default if not values or default in values else values[0]
    if provider_tag:
        body["provider"] = {"only": [provider_tag], "allow_fallbacks": False}
    else:
        body["provider"] = {"sort": "price"}
    return body, estimate


def _video_estimate(model: dict, duration: int, resolution: str) -> float | None:
    skus = model.get("pricing_skus") or {}
    values = []
    for key, raw in skus.items():
        lowered = key.lower()
        if "second" not in lowered:
            continue
        if any(marker in lowered for marker in ("720p", "1080p")) and resolution.lower() not in lowered:
            continue
        price = _number(raw)
        if price is not None:
            values.append(price * duration)
    return min(values) if values else None


async def _choose_video(client: httpx.AsyncClient) -> tuple[dict, float]:
    catalog = await _json(client, "GET", f"{settings.openrouter_base_url}/videos/models", headers=_headers())
    candidates = []
    for model in catalog.get("data", []):
        durations = [int(value) for value in model.get("supported_durations", []) if int(value) > 0]
        resolutions = model.get("supported_resolutions") or []
        ratios = model.get("supported_aspect_ratios") or []
        if not durations or not resolutions or not ratios:
            continue
        duration = min(durations)
        resolution = "720p" if "720p" in resolutions else resolutions[0]
        ratio = "16:9" if "16:9" in ratios else ratios[0]
        estimate = _video_estimate(model, duration, resolution)
        if estimate is not None:
            candidates.append((estimate, model["id"], duration, resolution, ratio))
    if not candidates:
        raise RuntimeError("No priced video model discovered")
    estimate, model_id, duration, resolution, ratio = min(candidates)
    return {
        "model": model_id,
        "prompt": "A static blue circle on a white background",
        "duration": duration,
        "resolution": resolution,
        "aspect_ratio": ratio,
        "generate_audio": False,
        "provider": {"sort": "price"},
    }, estimate


def _check_budget(spent: float, estimate: float) -> None:
    if spent + estimate > settings.openrouter_smoke_max_usd:
        raise RuntimeError(
            f"Smoke request skipped: ${spent + estimate:.4f} estimate exceeds "
            f"${settings.openrouter_smoke_max_usd:.2f} budget"
        )


async def main() -> None:
    if not _enabled():
        raise SystemExit("Set AISPHERE_OPENROUTER_SMOKE=true to allow paid smoke requests")
    if not settings.openrouter_api_key:
        raise SystemExit("AISPHERE_OPENROUTER_API_KEY is required")

    if os.getenv("AISPHERE_OPENROUTER_CATALOG_ONLY", "").lower() in {"1", "true", "yes"}:
        async with httpx.AsyncClient(timeout=60, proxy=settings.openrouter_proxy or None) as client:
            counts = {}
            for path in ("/models", "/images/models", "/videos/models"):
                payload = await _json(client, "GET", f"{settings.openrouter_base_url}{path}", headers=_headers())
                counts[path] = len(payload.get("data") or [])
        print(json.dumps({"ok": True, "catalog_counts": counts}, ensure_ascii=False))
        return

    spent = 0.0
    results = []
    async with httpx.AsyncClient(timeout=180, proxy=settings.openrouter_proxy or None, follow_redirects=True) as client:
        text_body, text_estimate = await _choose_text(client)
        _check_budget(spent, text_estimate)
        text_result = await _json(client, "POST", f"{settings.openrouter_base_url}/chat/completions", headers=_headers(), json=text_body)
        if not text_result.get("choices"):
            raise RuntimeError("Text smoke returned no choices")
        text_cost = float((text_result.get("usage") or {}).get("cost") or text_estimate)
        spent += text_cost
        results.append({"kind": "text", "model": text_body["model"], "cost": text_cost})

        image_body, image_estimate = await _choose_image(client)
        _check_budget(spent, image_estimate)
        image_result = await _json(client, "POST", f"{settings.openrouter_base_url}/images", headers=_headers(), json=image_body)
        if not (image_result.get("data") or [{}])[0].get("b64_json"):
            raise RuntimeError("Image smoke returned no b64_json")
        image_cost = float((image_result.get("usage") or {}).get("cost") or image_estimate)
        spent += image_cost
        results.append({"kind": "image", "model": image_body["model"], "cost": image_cost})

        video_body, video_estimate = await _choose_video(client)
        _check_budget(spent, video_estimate)
        video_job = await _json(client, "POST", f"{settings.openrouter_base_url}/videos", headers=_headers(), json=video_body)
        job_id = video_job.get("id")
        if not job_id:
            raise RuntimeError("Video smoke returned no job id")
        deadline = time.monotonic() + 20 * 60
        while time.monotonic() < deadline:
            await asyncio.sleep(10)
            status = await _json(client, "GET", f"{settings.openrouter_base_url}/videos/{job_id}", headers=_headers())
            if status.get("status") == "completed":
                content_urls = status.get("unsigned_urls") or []
                content_url = content_urls[0] if content_urls else f"{settings.openrouter_base_url}/videos/{job_id}/content?index=0"
                response = await client.get(content_url, headers={} if content_urls else _headers())
                response.raise_for_status()
                if not response.content:
                    raise RuntimeError("Video smoke returned empty content")
                video_cost = float((status.get("usage") or {}).get("cost") or video_estimate)
                spent += video_cost
                results.append({"kind": "video", "model": video_body["model"], "cost": video_cost})
                break
            if status.get("status") in {"failed", "error", "cancelled", "canceled"}:
                raise RuntimeError(f"Video smoke failed: {status.get('error')}")
        else:
            raise RuntimeError("Video smoke timed out")

    print(json.dumps({"ok": True, "spent_usd": spent, "results": results}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())

