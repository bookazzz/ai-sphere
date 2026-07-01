"""Auth API: register, login, OAuth (Yandex, VK), profile."""

from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    OAuthRedirectResponse,
    RegisterRequest,
    TokenResponse,
    UserInfo,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ──────────────────── Email/Password ────────────────────


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
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
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
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
    }
    url = f"https://oauth.yandex.ru/authorize?{urlencode(params)}"
    return RedirectResponse(url=url)


@router.get("/oauth/yandex/callback")
async def oauth_yandex_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle Yandex OAuth callback — exchange code for token, get user info, return JWT."""
    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth.yandex.ru/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.yandex_client_id,
                "client_secret": settings.yandex_client_secret,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Ошибка авторизации Яндекс")

        token_data = token_resp.json()
        access_token = token_data["access_token"]

        # Get user info from Yandex
        user_resp = await client.get(
            "https://login.yandex.ru/info",
            headers={"Authorization": f"OAuth {access_token}"},
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Не удалось получить данные пользователя Яндекс")

        yandex_user = user_resp.json()
        yandex_id = str(yandex_user["id"])
        email = yandex_user.get("default_email", f"yandex_{yandex_id}@placeholder.local")
        name = yandex_user.get("display_name") or yandex_user.get("real_name")

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
    # Redirect to frontend with token
    return RedirectResponse(
        url=f"{settings.frontend_url}?token={token}&provider=yandex"
    )


# ──────────────────── VK OAuth ────────────────────


@router.get("/oauth/vk")
async def oauth_vk():
    """Redirect user to VK OAuth consent screen."""
    params = {
        "client_id": settings.vk_client_id,
        "redirect_uri": settings.vk_redirect_uri,
        "display": "page",
        "scope": "email",
        "response_type": "code",
        "v": "5.131",
    }
    url = f"https://oauth.vk.com/authorize?{urlencode(params)}"
    return RedirectResponse(url=url)


@router.get("/oauth/vk/callback")
async def oauth_vk_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle VK OAuth callback — exchange code for token, get user info, return JWT."""
    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        token_resp = await client.get(
            "https://oauth.vk.com/access_token",
            params={
                "client_id": settings.vk_client_id,
                "client_secret": settings.vk_client_secret,
                "redirect_uri": settings.vk_redirect_uri,
                "code": code,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Ошибка авторизации ВК")

        token_data = token_resp.json()

        if "error" in token_data:
            raise HTTPException(
                status_code=400,
                detail=f"Ошибка ВК: {token_data.get('error_description', token_data['error'])}",
            )

        access_token = token_data["access_token"]
        vk_user_id = str(token_data["user_id"])
        email = token_data.get("email", f"vk_{vk_user_id}@placeholder.local")

    # Find or create user
    result = await db.execute(select(User).where(User.vk_id == vk_user_id))
    user = result.scalar_one_or_none()

    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user:
        if not user.vk_id:
            user.vk_id = vk_user_id
    else:
        user = User(
            email=email,
            hashed_password=hash_password(f"oauth_vk_{vk_user_id}"),
            name=None,
            vk_id=vk_user_id,
            credits=50,
        )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email)
    return RedirectResponse(
        url=f"{settings.frontend_url}?token={token}&provider=vk"
    )
