"""Chat-related Pydantic schemas."""

from pydantic import BaseModel, Field, field_validator


class ChatMessage(BaseModel):
    """A single chat message with role and content."""
    role: str = "user"
    content: str | list = ""


class ChatRequest(BaseModel):
    model: str = "auto"
    messages: list[ChatMessage]
    max_tokens: int = 4096
    temperature: float = 0.7
    stream: bool = False
    fallback_models: list[str] = []
    requested_model: str | None = None
    template_id: int | None = None
    task_type: str = ""


class DispatchRequest(ChatRequest):
    """One chat entry point for text and generated media."""

    intent: str = "auto"  # auto | text | image | video
    session_id: str | None = None
    media_preferences: dict = {}
    template_id: int | None = None
    task_type: str = ""


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
    price_per_1k_input: float
    price_per_1k_output: float
    fixed_price: float = 0  # фикс. цена за запрос (0 = по токенам)
    context_window: int
    vision: bool = False
    image_generation_only: bool = False  # True = умеет только генерировать картинки, не понимает загруженные фото
    is_active: bool = True
    is_visible: bool = True
    input_modalities: list[str] = ["text"]
    output_modalities: list[str] = ["text"]
    supported_parameters: dict = {}
    auto_route_enabled: bool = False


class PublicModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    price_input: float
    price_output: float
    price_unit: float
    fixed_price: float
    vision: bool
    is_active: bool
    is_visible: bool
    input_modalities: list[str] = ["text"]
    output_modalities: list[str] = ["text"]
    supported_parameters: dict = {}
    auto_route_enabled: bool = False


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


class MessageFeedbackRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=36)
    message_index: int = Field(ge=0)
    feedback_type: str
    model: str = Field(default="", max_length=200)


class VoicePunctuateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Text must not be blank")
        return value


class VoicePunctuateResponse(BaseModel):
    result: str
    applied: bool = False
