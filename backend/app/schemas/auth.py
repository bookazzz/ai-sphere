"""Auth schemas."""

from datetime import datetime

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserInfo(BaseModel):
    id: int
    email: str
    name: str | None
    credits: int
    yandex_id: str | None = None
    vk_id: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class OAuthRedirectResponse(BaseModel):
    """Response for the OAuth authorize endpoint — the frontend redirects to this URL."""
    redirect_url: str
