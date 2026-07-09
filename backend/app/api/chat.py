"""Chat API: model listing, chat completion proxy via OpenRouter, file upload."""

import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.chat import ChatRequest, ChatResponse, ModelInfo

router = APIRouter(prefix="/api/chat", tags=["chat"])

# ──────────────── File upload ────────────────

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/webp", "image/gif",
    "application/pdf",
    "text/plain", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip", "application/x-rar-compressed",
}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload a file (max 20 MB). Returns file metadata."""
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл слишком большой. Максимум 20 МБ")

    # Basic extension-based type detection
    ext = Path(file.filename or "file").suffix.lower()
    file_id = str(uuid.uuid4())
    saved_name = f"{file_id}{ext}"
    save_path = UPLOAD_DIR / saved_name

    with open(save_path, "wb") as f:
        f.write(content)

    return {
        "id": file_id,
        "name": file.filename or "unnamed",
        "size": len(content),
        "type": file.content_type or "application/octet-stream",
        "url": f"/uploads/{saved_name}",
    }

MODELS = [
    # DeepSeek
    ModelInfo(id="deepseek/deepseek-chat",           name="DeepSeek V4 Flash",  provider="DeepSeek",    price_per_1k_input=1,  price_per_1k_output=2,  context_window=65536),
    ModelInfo(id="deepseek/deepseek-chat-v3",        name="DeepSeek V3",       provider="DeepSeek",    price_per_1k_input=2,  price_per_1k_output=4,  context_window=65536),
    ModelInfo(id="deepseek/deepseek-r1",             name="DeepSeek R1",       provider="DeepSeek",    price_per_1k_input=2,  price_per_1k_output=9,  context_window=65536),
    ModelInfo(id="deepseek/deepseek-v4-pro",         name="DeepSeek V4 Pro",   provider="DeepSeek",    price_per_1k_input=2,  price_per_1k_output=3,  context_window=65536),
    # Anthropic
    ModelInfo(id="anthropic/claude-sonnet-4", vision=True,        name="Claude Sonnet 4",   provider="Anthropic",   price_per_1k_input=7,  price_per_1k_output=44, context_window=200000),
    ModelInfo(id="anthropic/claude-haiku-4.5", vision=True,     name="Claude Haiku 4.5",  provider="Anthropic",   price_per_1k_input=1,  price_per_1k_output=16, context_window=200000),
    ModelInfo(id="anthropic/claude-3-haiku", vision=True,         name="Claude 3 Haiku",    provider="Anthropic",   price_per_1k_input=1,  price_per_1k_output=4,  context_window=200000),
    ModelInfo(id="anthropic/claude-sonnet-4.6", vision=True,      name="Claude Sonnet 4.6", provider="Anthropic",   price_per_1k_input=12, price_per_1k_output=60, context_window=200000),
    ModelInfo(id="anthropic/claude-sonnet-5", vision=True,        name="Claude Sonnet 5",   provider="Anthropic",   price_per_1k_input=4,  price_per_1k_output=20, context_window=1000000),
    # OpenAI
    ModelInfo(id="openai/gpt-4o", vision=True,                    name="GPT-4o",            provider="OpenAI",      price_per_1k_input=11, price_per_1k_output=42, context_window=128000),
    ModelInfo(id="openai/gpt-4o-mini", vision=True,               name="GPT-4o Mini",       provider="OpenAI",      price_per_1k_input=1,  price_per_1k_output=2,  context_window=128000),
    ModelInfo(id="openai/gpt-4.1", vision=True,                   name="GPT-4.1",           provider="OpenAI",      price_per_1k_input=8,  price_per_1k_output=32, context_window=1048576),
    ModelInfo(id="openai/gpt-4.1-mini", vision=True,              name="GPT-4.1 Mini",      provider="OpenAI",      price_per_1k_input=2,  price_per_1k_output=6,  context_window=1048576),
    ModelInfo(id="openai/o4-mini", vision=True,                   name="o4-mini",           provider="OpenAI",      price_per_1k_input=4,  price_per_1k_output=18, context_window=128000),
    ModelInfo(id="openai/o3-mini",                   name="o3-mini",           provider="OpenAI",      price_per_1k_input=4,  price_per_1k_output=18, context_window=128000),
    # Google
    ModelInfo(id="google/gemini-2.5-flash", vision=True,          name="Gemini 2.5 Flash",  provider="Google",      price_per_1k_input=2,  price_per_1k_output=6,  context_window=1048576),
    ModelInfo(id="google/gemini-2.5-pro", vision=True,            name="Gemini 2.5 Pro",    provider="Google",      price_per_1k_input=4,  price_per_1k_output=31, context_window=1048576),
    ModelInfo(id="google/gemini-3.5-flash", vision=True,          name="Gemini 3.5 Flash",  provider="Google",      price_per_1k_input=4,  price_per_1k_output=18, context_window=1000000),
    ModelInfo(id="google/gemini-3.1-pro", vision=True,            name="Gemini 3.1 Pro",    provider="Google",      price_per_1k_input=8,  price_per_1k_output=48, context_window=1048576),
    # Meta
    ModelInfo(id="meta-llama/llama-4-maverick", vision=True,      name="Llama 4 Maverick",  provider="Meta",        price_per_1k_input=1,  price_per_1k_output=2,  context_window=131072),
    ModelInfo(id="meta-llama/llama-4-scout", vision=True,         name="Llama 4 Scout",     provider="Meta",        price_per_1k_input=1,  price_per_1k_output=1,  context_window=131072),
    ModelInfo(id="meta-llama/llama-3.3-70b-instruct",name="Llama 3.3 70B",     provider="Meta",        price_per_1k_input=1,  price_per_1k_output=2,  context_window=131072),
    ModelInfo(id="meta-llama/llama-3.1-70b-instruct",name="Llama 3.1 70B",     provider="Meta",        price_per_1k_input=1,  price_per_1k_output=4,  context_window=131072),
    ModelInfo(id="meta-llama/llama-3.1-8b-instruct", name="Llama 3.1 8B",      provider="Meta",        price_per_1k_input=1,  price_per_1k_output=1,  context_window=131072),
    ModelInfo(id="meta-llama/llama-3.2-3b-instruct", name="Llama 3.2 3B",      provider="Meta",        price_per_1k_input=1,  price_per_1k_output=1,  context_window=131072),
    ModelInfo(id="meta-llama/llama-3.2-11b-vision-instruct", vision=True, name="Llama 3.2 11B Vision", provider="Meta", price_per_1k_input=1, price_per_1k_output=1, context_window=131072),
    # Qwen
    ModelInfo(id="qwen/qwen3-235b-a22b",             name="Qwen 3 235B A22B",  provider="Qwen",        price_per_1k_input=2,  price_per_1k_output=8,  context_window=131072),
    ModelInfo(id="qwen/qwen-plus",                   name="Qwen Plus",         provider="Qwen",        price_per_1k_input=2,  price_per_1k_output=7,  context_window=131072),
    ModelInfo(id="qwen/qwen3.7-max",                 name="Qwen 3.7 Max",      provider="Qwen",        price_per_1k_input=5,  price_per_1k_output=15, context_window=131072),
    ModelInfo(id="qwen/qwen3-coder-next",            name="Qwen 3 Coder Next", provider="Qwen",        price_per_1k_input=1,  price_per_1k_output=3,  context_window=131072),
    # Mistral
    ModelInfo(id="mistralai/mistral-large",           name="Mistral Large",     provider="Mistral",     price_per_1k_input=4,  price_per_1k_output=20, context_window=131072),
    ModelInfo(id="mistralai/mistral-nemo",            name="Mistral Nemo",      provider="Mistral",     price_per_1k_input=1,  price_per_1k_output=1,  context_window=32768),
    ModelInfo(id="mistralai/mistral-saba-2502",       name="Mistral Saba",      provider="Mistral",     price_per_1k_input=1,  price_per_1k_output=3,  context_window=32768),
    ModelInfo(id="mistralai/mistral-medium-3-5",      name="Mistral Medium 3.5",provider="Mistral",     price_per_1k_input=6,  price_per_1k_output=30, context_window=131072),
    ModelInfo(id="mistralai/mistral-small-2603",      name="Mistral Small",     provider="Mistral",     price_per_1k_input=1,  price_per_1k_output=2,  context_window=131072),
    # Cohere
    ModelInfo(id="cohere/command-a",                 name="Command A",         provider="Cohere",      price_per_1k_input=10, price_per_1k_output=26, context_window=256000),
    ModelInfo(id="cohere/command-r-08-2024",         name="Command R",         provider="Cohere",      price_per_1k_input=1,  price_per_1k_output=3,  context_window=128000),
    ModelInfo(id="cohere/command-r7b-12-2024",       name="Command R 7B",      provider="Cohere",      price_per_1k_input=1,  price_per_1k_output=1,  context_window=131072),
    # Amazon
    ModelInfo(id="amazon/nova-pro-v1:0", vision=True,             name="Nova Pro 1.0",      provider="Amazon",      price_per_1k_input=1,  price_per_1k_output=1,  context_window=131072),
    ModelInfo(id="amazon/nova-lite-v1:0", vision=True,            name="Nova Lite 1.0",     provider="Amazon",      price_per_1k_input=1,  price_per_1k_output=1,  context_window=131072),
    ModelInfo(id="amazon/nova-micro-v1:0",           name="Nova Micro 1.0",    provider="Amazon",      price_per_1k_input=1,  price_per_1k_output=1,  context_window=131072),
    # Nous Research
    ModelInfo(id="nousresearch/hermes-3-llama-3.1-405b", name="Hermes 3 405B", provider="Nous Research", price_per_1k_input=2, price_per_1k_output=4, context_window=131072),
    # Microsoft
    ModelInfo(id="microsoft/phi-4",                  name="Phi-4",             provider="Microsoft",   price_per_1k_input=1,  price_per_1k_output=1,  context_window=16384),
    # MiniMax
    ModelInfo(id="minimax/minimax-01",               name="MiniMax-01",        provider="MiniMax",     price_per_1k_input=1,  price_per_1k_output=3,  context_window=1048576),
    # xAI
    ModelInfo(id="x-ai/grok-4.5",                    name="Grok 4.5",          provider="xAI",         price_per_1k_input=8,  price_per_1k_output=24, context_window=131072),
    ModelInfo(id="x-ai/grok-4.20",                   name="Grok 4.20",         provider="xAI",         price_per_1k_input=5,  price_per_1k_output=10, context_window=131072),
    # ── New models (2026-07) ──
    ModelInfo(id="openai/gpt-5-mini", vision=True,                name="GPT-5",             provider="OpenAI",      price_per_1k_input=1,  price_per_1k_output=4,  context_window=65536),
    ModelInfo(id="openai/gpt-5.4-nano",              name="GPT-5.4 Nano",      provider="OpenAI",      price_per_1k_input=1,  price_per_1k_output=2,  context_window=65536),
    ModelInfo(id="openai/gpt-5-image-mini", vision=True,          name="GPT-5 Image Mini",  provider="OpenAI",      price_per_1k_input=6,  price_per_1k_output=3,  context_window=65536),
    ModelInfo(id="google/gemini-3.1-flash-lite-image", vision=True, name="Gemini 3.1 Flash Lite Image", provider="Google", price_per_1k_input=1, price_per_1k_output=3, context_window=65536),
    ModelInfo(id="x-ai/grok-4.3",                    name="Grok 4.3",          provider="xAI",         price_per_1k_input=2,  price_per_1k_output=6,  context_window=131072),
]


@router.get("/models", response_model=list[ModelInfo])
async def get_models():
    """Return available models with pricing."""
    return MODELS


@router.post("/completions")
async def chat_completion(
    req: ChatRequest,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Proxy chat completion to OpenRouter. Auth optional (guests get free tier)."""
    model_info = next((m for m in MODELS if m.id == req.model), None)
    if model_info is None:
        raise HTTPException(status_code=400, detail=f"Unknown model: {req.model}")

    # Check if model supports vision when images are attached
    for m in req.messages:
        if isinstance(m.content, list):
            has_images = any(
                isinstance(part, dict) and part.get("type") == "image_url"
                for part in m.content
            )
            if has_images and not model_info.vision:
                raise HTTPException(
                    status_code=400,
                    detail=f"Модель «{model_info.name}» не поддерживает изображения. "
                           f"Выберите модель с поддержкой vision: GPT-4o, Claude, Gemini, Llama Vision или другую."
                )

    # Credit check for authenticated users
    if user and user.credits <= 0 and model_info.price_per_1k_input > 0:
        raise HTTPException(status_code=402, detail="Недостаточно кредитов. Пополните баланс.")

    # Estimate cost (for list content, count text parts only)
    estimated_input_tokens = 0
    for m in req.messages:
        if isinstance(m.content, str):
            estimated_input_tokens += len(m.content) // 4
        elif isinstance(m.content, list):
            for part in m.content:
                if isinstance(part, dict) and part.get("type") == "text":
                    estimated_input_tokens += len(part.get("text", "")) // 4
    estimated_output_tokens = min(estimated_input_tokens * 2, 500)
    estimated_cost = (estimated_input_tokens * model_info.price_per_1k_input / 1000) + (estimated_output_tokens * model_info.price_per_1k_output / 1000)

    if user and user.credits < estimated_cost and model_info.price_per_1k_input > 0:
        raise HTTPException(status_code=402, detail="Недостаточно кредитов для этого запроса")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-sphere.ru",
        "X-Title": "AI-Sphere",
    }

    # System prompt with model identity — strong Russian instruction to override training biases
    system_prompt = (
        f"Ты — {model_info.name}, ИИ-ассистент от {model_info.provider}. "
        f"Твоё имя — {model_info.name}, тебя создала компания {model_info.provider}. "
        f"Ты НЕ ChatGPT, НЕ GPT, НЕ OpenAI и НЕ ассистент от OpenAI. "
        "Никогда не называй себя ChatGPT, GPT или ассистентом OpenAI. "
        "Отвечай на языке пользователя. Будь полезным, точным и вежливым."
    )

    body = {
        "model": req.model,
        "messages": [
            {"role": "system", "content": system_prompt},
        ] + [{"role": m.role, "content": m.content} for m in req.messages],
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
    }

    proxy = settings.openrouter_proxy or None
    async with httpx.AsyncClient(timeout=120.0, proxy=proxy) as client:
        response = await client.post(
            f"{settings.openrouter_base_url}/chat/completions",
            headers=headers,
            json=body,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])

    data = response.json()
    choice = data["choices"][0]
    content = choice["message"].get("content") or choice["message"].get("text", "") or f"[{model_info.name} не вернул текстовый ответ]"
    finish_reason = choice.get("finish_reason")
    usage = data.get("usage", {})

    # Deduct credits
    credits_spent = 0
    if user and model_info.price_per_1k_input > 0:
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        credits_spent = max(1, int(
            input_tokens * model_info.price_per_1k_input / 1000
            + output_tokens * model_info.price_per_1k_output / 1000
        ))
        # Always deduct at least 1 credit if any tokens were used
        if credits_spent > 0:
            user.credits = max(0, user.credits - credits_spent)
            tx = Transaction(
                user_id=user.id,
                amount=-credits_spent,
                type="spend",
                description=f"Чат: {req.model}",
            )
            db.add(tx)
            await db.commit()

    return ChatResponse(
        id=data["id"],
        model=data["model"],
        content=content,
        credits_spent=credits_spent,
        finish_reason=finish_reason,
    )
