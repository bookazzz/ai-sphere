"""Chat API: model listing, chat completion proxy via OpenRouter."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.chat import ChatRequest, ChatResponse, ModelInfo

router = APIRouter(prefix="/api/chat", tags=["chat"])

MODELS = [
    ModelInfo(id="deepseek/deepseek-chat",           name="DeepSeek V3",       provider="DeepSeek",    price_per_1k_input=0,  price_per_1k_output=0,  context_window=65536),
    ModelInfo(id="deepseek/deepseek-r1",             name="DeepSeek R1",       provider="DeepSeek",    price_per_1k_input=2,  price_per_1k_output=8,  context_window=65536),
    ModelInfo(id="anthropic/claude-sonnet-4",        name="Claude Sonnet 4",   provider="Anthropic",   price_per_1k_input=10, price_per_1k_output=40, context_window=200000),
    ModelInfo(id="anthropic/claude-3.5-haiku",       name="Claude 3.5 Haiku",  provider="Anthropic",   price_per_1k_input=3,  price_per_1k_output=12, context_window=200000),
    ModelInfo(id="openai/gpt-4o",                    name="GPT-4o",            provider="OpenAI",      price_per_1k_input=8,  price_per_1k_output=24, context_window=128000),
    ModelInfo(id="openai/gpt-4o-mini",               name="GPT-4o Mini",       provider="OpenAI",      price_per_1k_input=1,  price_per_1k_output=4,  context_window=128000),
    ModelInfo(id="google/gemini-2.5-flash",          name="Gemini 2.5 Flash",  provider="Google",      price_per_1k_input=1,  price_per_1k_output=4,  context_window=1048576),
    ModelInfo(id="google/gemini-2.5-pro",            name="Gemini 2.5 Pro",    provider="Google",      price_per_1k_input=4,  price_per_1k_output=16, context_window=1048576),
    ModelInfo(id="meta-llama/llama-4-maverick",      name="Llama 4 Maverick",  provider="Meta",        price_per_1k_input=1,  price_per_1k_output=4,  context_window=131072),
    ModelInfo(id="qwen/qwen3-235b-a22b",             name="Qwen 3 235B",       provider="Qwen",        price_per_1k_input=2,  price_per_1k_output=8,  context_window=131072),
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

    # Credit check for authenticated users
    if user and user.credits <= 0 and model_info.price_per_1k_input > 0:
        raise HTTPException(status_code=402, detail="Недостаточно кредитов. Пополните баланс.")

    # Estimate cost
    estimated_input_tokens = sum(len(m.content) // 4 for m in req.messages)
    estimated_cost = (estimated_input_tokens * model_info.price_per_1k_input / 1000) + (req.max_tokens * model_info.price_per_1k_output / 1000)

    if user and user.credits < estimated_cost and model_info.price_per_1k_input > 0:
        raise HTTPException(status_code=402, detail="Недостаточно кредитов для этого запроса")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-sphere.ru",
        "X-Title": "AI-Sphere",
    }

    body = {
        "model": req.model,
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{settings.openrouter_base_url}/chat/completions",
            headers=headers,
            json=body,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])

    data = response.json()
    choice = data["choices"][0]
    content = choice["message"]["content"]
    finish_reason = choice.get("finish_reason")
    usage = data.get("usage", {})

    # Deduct credits
    credits_spent = 0
    if user and model_info.price_per_1k_input > 0:
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        credits_spent = int(
            input_tokens * model_info.price_per_1k_input / 1000
            + output_tokens * model_info.price_per_1k_output / 1000
        )
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
