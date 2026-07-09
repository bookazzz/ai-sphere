"""Chat schemas."""

from typing import Any

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # user / assistant / system
    content: str | list[dict[str, Any]]


class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    max_tokens: int = 4096
    temperature: float = 0.7


class ChatResponse(BaseModel):
    id: str
    model: str
    content: str
    credits_spent: int = 0
    finish_reason: str | None = None


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    price_per_1k_input: int
    price_per_1k_output: int
    context_window: int
    vision: bool = False
