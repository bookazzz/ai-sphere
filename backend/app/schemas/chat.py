"""Chat-related Pydantic schemas."""

from pydantic import BaseModel


class ChatMessage(BaseModel):
    """A single chat message with role and content."""
    role: str = "user"
    content: str | list = ""


class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    max_tokens: int = 4096
    temperature: float = 0.7
    stream: bool = False


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
    fixed_price: int = 0  # фикс. цена за запрос (0 = по токенам)
    context_window: int
    vision: bool = False,
    image_generation_only: bool = False  # True = умеет только генерировать картинки, не понимает загруженные фото


class FactCheckRequest(BaseModel):
    model_id: str
    prompt: str
    response: str


class FactCheckClaim(BaseModel):
    claim: str
    status: str  # correct | incorrect | uncertain
    correction: str | None = None


class FactCheckResponse(BaseModel):
    errors: list[FactCheckClaim] = []
    confidence: int = 50
    verified_claims: list[FactCheckClaim] = []
    details: str = ""


class SessionSaveRequest(BaseModel):
    """Save/update a chat session on server."""
    id: str
    title: str
    messages: list


class SessionResponse(BaseModel):
    """A chat session with messages."""
    id: str
    title: str
    messages: list
    createdAt: str | None = None
    updatedAt: str | None = None
