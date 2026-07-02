"""Auth API: register, login, OAuth (Yandex, VK), profile."""

import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.core.limiter import limiter
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    OAuthRedirectResponse,
    RegisterRequest,
    TokenResponse,
    UserInfo,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

logger = logging.getLogger("ai-sphere.auth")

OAUTH_SUCCESS_HTML = """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Вход выполнен</title></head>
<body>
<script>
(function(){
  var token = "TOKEN_PLACEHOLDER";
  var provider = "PROVIDER_PLACEHOLDER";
  if (token) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_provider', provider);
  }
  window.location.replace('/');
})();
</script>
</body>
</html>"""


# ──────────────────── Email/Password ────────────────────


@router.post("/register", response_model=TokenResponse)
@limiter.limit("3/minute")
async def register(
    request: Request,
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register new user with email and password."""
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 6 символов")

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        name=req.name,
        credits=50,  # welcome bonus
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user=UserInfo.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    req: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт заблокирован")

    token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user=UserInfo.model_validate(user),
    )


@router.get("/me", response_model=UserInfo)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserInfo.model_validate(user)


# ──────────────────── Yandex OAuth ────────────────────


@router.get("/oauth/yandex")
async def oauth_yandex():
    """Redirect user to Yandex OAuth consent screen."""
    params = {
        "response_type": "code",
        "client_id": settings.yandex_client_id,
        "redirect_uri": settings.yandex_redirect_uri,
        "force_confirm": 1,
    }
    url = f"https://oauth.yandex.ru/authorize?{urlencode(params)}"
    return RedirectResponse(url=url)


@router.get("/oauth/yandex/callback")
async def oauth_yandex_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle Yandex OAuth callback — exchange code for token, get user info, return JWT."""
    logger.info("Yandex callback: code received")
    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        token_resp = await client.post(
            "https://oauth.yandex.ru/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.yandex_client_id,
                "client_secret": settings.yandex_client_secret,
            },
        )
        logger.info("Yandex token exchange status=%d", token_resp.status_code)
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Ошибка авторизации Яндекс")

        token_data = token_resp.json()
        access_token = token_data["access_token"]

        # Get user info from Yandex
        user_resp = await client.get(
            "https://login.yandex.ru/info",
            headers={"Authorization": f"OAuth {access_token}"},
        )
        logger.info("Yandex user info status=%d", user_resp.status_code)
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Не удалось получить данные пользователя Яндекс")

        yandex_user = user_resp.json()
        yandex_id = str(yandex_user["id"])
        email = yandex_user.get("default_email", f"yandex_{yandex_id}@placeholder.local")
        name = yandex_user.get("display_name") or yandex_user.get("real_name")
        logger.info("Yandex auth success: yandex_id=%s email=%s", yandex_id, email)

    # Find or create user
    result = await db.execute(select(User).where(User.yandex_id == yandex_id))
    user = result.scalar_one_or_none()

    if not user:
        # Check if email already exists (linked to another account)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user:
        # Link Yandex to existing account
        if not user.yandex_id:
            user.yandex_id = yandex_id
            if yandex_user.get("display_name") and not user.name:
                user.name = yandex_user["display_name"]
    else:
        # Create new user
        user = User(
            email=email,
            hashed_password=hash_password(f"oauth_yandex_{yandex_id}"),
            name=name,
            yandex_id=yandex_id,
            credits=50,  # welcome bonus
        )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email)
    return HTMLResponse(
        content=OAUTH_SUCCESS_HTML.replace("TOKEN_PLACEHOLDER", token).replace("PROVIDER_PLACEHOLDER", "yandex"),
        status_code=200,
    )


# ──────────────────── VK OAuth (VK ID SDK) ────────────────────


class VKTokenRequest(BaseModel):
    access_token: str


@router.post("/oauth/vk/token")
async def oauth_vk_token(
    req: VKTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange VK ID access token for user data and create/login user.

    Called after client-side VK ID SDK exchangeCode().
    """
    async with httpx.AsyncClient() as client:
        # Get user info from VK API
        user_resp = await client.get(
            "https://api.vk.com/method/users.get",
            params={
                "access_token": req.access_token,
                "fields": "first_name,last_name,photo_200,screen_name",
                "v": "5.131",
            },
        )
        logger.info("VK users.get status=%d", user_resp.status_code)

        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Ошибка проверки токена ВК")

        vk_data = user_resp.json()

        if "error" in vk_data:
            logger.error("VK API error: %s", vk_data)
            raise HTTPException(
                status_code=400,
                detail=f"Ошибка ВК: {vk_data.get('error', {}).get('error_msg', 'Неизвестная ошибка')}",
            )

        users = vk_data.get("response", [])
        if not users:
            raise HTTPException(status_code=400, detail="Пользователь ВК не найден")

        vk_user = users[0]
        vk_user_id = str(vk_user["id"])
        first_name = vk_user.get("first_name", "")
        last_name = vk_user.get("last_name", "")
        name = f"{first_name} {last_name}".strip() or None
        logger.info("VK ID auth success: user_id=%s name=%s", vk_user_id, name)

    # Find or create user
    result = await db.execute(select(User).where(User.vk_id == vk_user_id))
    user = result.scalar_one_or_none()

    if user:
        if not user.vk_id:
            user.vk_id = vk_user_id
        if name and not user.name:
            user.name = name
    else:
        user = User(
            email=f"vk_{vk_user_id}@placeholder.local",
            hashed_password=hash_password(f"oauth_vk_{vk_user_id}"),
            name=name,
            vk_id=vk_user_id,
            credits=50,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user=UserInfo.model_validate(user),
    )
