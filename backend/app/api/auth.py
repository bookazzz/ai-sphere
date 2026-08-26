"""OAuth-only user authentication (Yandex and VK)."""

import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.credits import moscow_today
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.schemas.auth import UserInfo

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("ai-sphere.auth")


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name, value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/",
    )


def _state_cookie(provider: str) -> str:
    return f"ai_sphere_oauth_{provider}"


def _set_oauth_state(response: Response, provider: str, state: str) -> None:
    response.set_cookie(
        key=_state_cookie(provider), value=state, max_age=600,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/api/auth/oauth",
    )


def _check_oauth_state(request: Request, provider: str, state: str | None) -> None:
    expected = request.cookies.get(_state_cookie(provider))
    if not state or not expected or not secrets.compare_digest(state, expected):
        raise HTTPException(400, "РќРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ OAuth")


async def _existing_by_verified_email(db: AsyncSession, email: str) -> User | None:
    if not email or email.endswith("@placeholder.local"):
        return None
    return (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()


def _new_oauth_user(**values) -> User:
    return User(
        hashed_password=hash_password(secrets.token_urlsafe(48)),
        credits_free=10, last_daily_reset=moscow_today(), **values,
    )


@router.post("/logout", status_code=204)
async def logout(response: Response):
    response.delete_cookie(settings.auth_cookie_name, path="/", secure=settings.cookie_secure, samesite="lax")
    response.status_code = 204


@router.get("/me", response_model=UserInfo)
async def get_me(user: User = Depends(get_current_user)):
    return UserInfo.model_validate(user)


@router.get("/oauth/yandex")
async def oauth_yandex():
    if not settings.yandex_client_id:
        raise HTTPException(503, "РђРІС‚РѕСЂРёР·Р°С†РёСЏ РЇРЅРґРµРєСЃ РЅРµ РЅР°СЃС‚СЂРѕРµРЅР°")
    state = secrets.token_urlsafe(32)
    url = "https://oauth.yandex.ru/authorize?" + urlencode({
        "response_type": "code", "client_id": settings.yandex_client_id,
        "redirect_uri": settings.yandex_redirect_uri, "force_confirm": 1, "state": state,
    })
    response = RedirectResponse(url=url)
    _set_oauth_state(response, "yandex", state)
    return response


@router.get("/oauth/yandex/callback")
async def oauth_yandex_callback(
    request: Request, code: str = Query(...), state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    _check_oauth_state(request, "yandex", state)
    async with httpx.AsyncClient(timeout=15) as client:
        token_response = await client.post("https://oauth.yandex.ru/token", data={
            "grant_type": "authorization_code", "code": code,
            "client_id": settings.yandex_client_id, "client_secret": settings.yandex_client_secret,
            "redirect_uri": settings.yandex_redirect_uri,
        })
        if token_response.status_code != 200:
            logger.warning("Yandex token exchange failed status=%s", token_response.status_code)
            raise HTTPException(400, "РћС€РёР±РєР° Р°РІС‚РѕСЂРёР·Р°С†РёРё РЇРЅРґРµРєСЃ")
        profile_response = await client.get(
            "https://login.yandex.ru/info",
            headers={"Authorization": f"OAuth {token_response.json().get('access_token')}"},
        )
        if profile_response.status_code != 200:
            raise HTTPException(400, "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЇРЅРґРµРєСЃ")
        profile = profile_response.json()
    yandex_id = str(profile["id"])
    email = profile.get("default_email") or f"yandex_{yandex_id}@placeholder.local"
    user = (await db.execute(select(User).where(User.yandex_id == yandex_id))).scalar_one_or_none()
    user = user or await _existing_by_verified_email(db, email)
    if user:
        if user.yandex_id and user.yandex_id != yandex_id:
            raise HTTPException(409, "Email СѓР¶Рµ СЃРІСЏР·Р°РЅ СЃ РґСЂСѓРіРёРј РЇРЅРґРµРєСЃ ID")
        user.yandex_id = yandex_id
        user.name = user.name or profile.get("display_name") or profile.get("real_name")
    else:
        user = _new_oauth_user(email=email, name=profile.get("display_name") or profile.get("real_name"), yandex_id=yandex_id, registered_by="yandex")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    response = RedirectResponse(settings.frontend_url, status_code=303)
    response.delete_cookie(_state_cookie("yandex"), path="/api/auth/oauth")
    _set_auth_cookie(response, create_access_token(user.id, user.email))
    return response


@router.get("/oauth/vk")
async def oauth_vk():
    if not settings.vk_client_id:
        raise HTTPException(503, "РђРІС‚РѕСЂРёР·Р°С†РёСЏ VK РЅРµ РЅР°СЃС‚СЂРѕРµРЅР°")
    state = secrets.token_urlsafe(32)
    url = "https://oauth.vk.com/authorize?" + urlencode({
        "response_type": "code", "client_id": settings.vk_client_id,
        "redirect_uri": settings.vk_redirect_uri, "v": "5.131", "scope": "email", "state": state,
    })
    response = RedirectResponse(url=url)
    _set_oauth_state(response, "vk", state)
    return response


@router.get("/oauth/vk/callback")
async def oauth_vk_callback(
    request: Request, code: str | None = Query(None), state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    _check_oauth_state(request, "vk", state)
    if not code:
        raise HTTPException(400, "РљРѕРґ Р°РІС‚РѕСЂРёР·Р°С†РёРё РЅРµ РїРѕР»СѓС‡РµРЅ")
    async with httpx.AsyncClient(timeout=15) as client:
        token_response = await client.get("https://oauth.vk.com/access_token", params={
            "client_id": settings.vk_client_id, "client_secret": settings.vk_client_secret,
            "redirect_uri": settings.vk_redirect_uri, "code": code,
        })
        token_data = token_response.json()
        if token_response.status_code != 200 or not token_data.get("access_token") or not token_data.get("user_id"):
            logger.warning("VK token exchange failed status=%s", token_response.status_code)
            raise HTTPException(400, "РћС€РёР±РєР° Р°РІС‚РѕСЂРёР·Р°С†РёРё VK")
        vk_id = str(token_data["user_id"])
        profile_response = await client.get("https://api.vk.com/method/users.get", params={
            "access_token": token_data["access_token"], "user_ids": vk_id, "v": "5.131",
        })
        profiles = profile_response.json().get("response", [])
        if not profiles:
            raise HTTPException(400, "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ VK")
        profile = profiles[0]
    email = token_data.get("email") or f"vk_{vk_id}@placeholder.local"
    name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip() or None
    user = (await db.execute(select(User).where(User.vk_id == vk_id))).scalar_one_or_none()
    user = user or await _existing_by_verified_email(db, email)
    if user:
        if user.vk_id and user.vk_id != vk_id:
            raise HTTPException(409, "Email СѓР¶Рµ СЃРІСЏР·Р°РЅ СЃ РґСЂСѓРіРёРј VK ID")
        user.vk_id = vk_id
        user.name = user.name or name
    else:
        user = _new_oauth_user(email=email, name=name, vk_id=vk_id, registered_by="vk")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    response = RedirectResponse(settings.frontend_url, status_code=303)
    response.delete_cookie(_state_cookie("vk"), path="/api/auth/oauth")
    _set_auth_cookie(response, create_access_token(user.id, user.email))
    return response

