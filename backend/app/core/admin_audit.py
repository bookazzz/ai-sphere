"""Rate limiting and durable audit records for administrative requests."""

import logging
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import async_session
from app.models.admin_log import AdminLog


logger = logging.getLogger("ai-sphere.admin-audit")
_requests_by_ip: dict[str, deque[float]] = defaultdict(deque)
_mutating_methods = {"POST", "PUT", "PATCH", "DELETE"}


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _is_rate_limited(ip: str) -> bool:
    now = time.monotonic()
    requests = _requests_by_ip[ip]
    while requests and requests[0] <= now - 60:
        requests.popleft()
    if len(requests) >= settings.admin_rate_limit_per_minute:
        return True
    requests.append(now)
    return False


async def _write_audit(request: Request, status_code: int, detail: str = "") -> None:
    user_id = getattr(request.state, "authenticated_user_id", None)
    result = "success" if status_code < 400 else ("blocked" if status_code in {401, 403, 429} else "error")
    action = f"{request.method} {request.url.path}"[:100]
    ip = _client_ip(request)
    if user_id is None:
        logger.warning("Unauthenticated admin request: action=%s result=%s ip=%s", action, result, ip)
        return
    try:
        async with async_session() as db:
            db.add(AdminLog(
                admin_id=user_id,
                action=action,
                target_type="api",
                ip=ip,
                result=result,
                detail=detail[:2000],
            ))
            await db.commit()
    except Exception:
        logger.exception("Could not persist admin audit event: action=%s user_id=%s", action, user_id)


async def admin_security_middleware(request: Request, call_next):
    if not request.url.path.startswith("/api/admin"):
        return await call_next(request)

    ip = _client_ip(request)
    if _is_rate_limited(ip):
        logger.warning("Admin rate limit exceeded: ip=%s path=%s", ip, request.url.path)
        return JSONResponse({"detail": "Слишком много запросов"}, status_code=429)

    try:
        response = await call_next(request)
    except Exception as exc:
        await _write_audit(request, 500, type(exc).__name__)
        raise

    if request.method in _mutating_methods or response.status_code >= 400:
        await _write_audit(request, response.status_code)
    return response
