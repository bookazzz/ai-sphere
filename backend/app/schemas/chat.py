"""Chat schemas."""

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # user / assistant / system
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    max_tokens: int = 2048
    temperature: float = 0.7


class ChatResponse(BaseModel):
    id: str
    model: str
    content: str
    credits_spent: int
    finish_reason: str | None = None


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    price_per_1k_input: int   # кредиты
    price_per_1k_output: int  # кредиты
    context_window: int
