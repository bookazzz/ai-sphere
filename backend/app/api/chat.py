"""Chat API: model listing, chat completion proxy via OpenRouter, file upload."""

import json
import re
import logging
import uuid
from pathlib import Path
from sqlalchemy import select

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.chat import ChatRequest, ModelInfo, SessionSaveRequest, SessionResponse, FactCheckRequest, FactCheckResponse, FactCheckClaim
from app.api.web_search import web_search, needs_search

logger = logging.getLogger("ai-sphere.chat")

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
    ModelInfo(id="deepseek/deepseek-v4-flash",       name="DeepSeek V4 Flash",  provider="DeepSeek",    price_per_1k_input=1,  price_per_1k_output=2,  context_window=65536),
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
    ModelInfo(id="google/gemini-3.1-flash-lite-image", vision=False, image_generation_only=True, name="Gemini 3.1 Flash Lite Image", provider="Google", price_per_1k_input=6, price_per_1k_output=3, context_window=65536, fixed_price=40),
    ModelInfo(id="x-ai/grok-4.3",                    name="Grok 4.3",          provider="xAI",         price_per_1k_input=2,  price_per_1k_output=6,  context_window=131072),
]


@router.get("/models", response_model=list[ModelInfo])
async def get_models():
    """Return available models with pricing."""
    return MODELS


def _prepare_message(msg, model_supports_vision: bool) -> dict:
    """Prepare a message for the API call. Strip images from old messages if model doesn't support vision."""
    content = msg.content
    if not model_supports_vision and isinstance(content, list):
        # Strip image_url parts, keep only text
        text_parts = [p for p in content if isinstance(p, dict) and p.get("type") == "text"]
        content = " ".join(p.get("text", "") for p in text_parts).strip() or "(изображение удалено)"
    return {"role": msg.role, "content": content}


@router.post("/completions")
async def chat_completion(
    req: ChatRequest,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Proxy chat completion to OpenRouter. Requires auth."""
    model_info = next((m for m in MODELS if m.id == req.model), None)
    if model_info is None:
        raise HTTPException(status_code=400, detail=f"Unknown model: {req.model}")

    # Check if model supports vision — only check the last user message
    for m in reversed(req.messages):
        if m.role == "user":
            if isinstance(m.content, list):
                has_images = any(
                    isinstance(part, dict) and part.get("type") == "image_url"
                    for part in m.content
                )
                if has_images and model_info.image_generation_only:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Модель «{model_info.name}» создаёт изображения из текста, но не умеет редактировать загруженные фото. "
                               f"Используйте GPT-4o, Claude, Gemini 2.5 Flash или другую модель с пониманием изображений."
                    )
                if has_images and not model_info.vision:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Модель «{model_info.name}» не поддерживает изображения. "
                               f"Выберите модель с поддержкой vision: GPT-4o, Claude, Gemini, Llama Vision или другую."
                    )
            break  # only check the latest user message

    # Block guests — auth required
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация для отправки сообщений")

    # Credit check for authenticated users
    if user and user.credits <= 0 and (model_info.price_per_1k_input > 0 or model_info.fixed_price > 0):
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
    if model_info.fixed_price > 0:
        estimated_cost = model_info.fixed_price
    else:
        estimated_cost = (estimated_input_tokens * model_info.price_per_1k_input / 1000) + (estimated_output_tokens * model_info.price_per_1k_output / 1000)

    if user and user.credits < estimated_cost and (model_info.price_per_1k_input > 0 or model_info.fixed_price > 0):
        raise HTTPException(status_code=402, detail="Недостаточно кредитов для этого запроса")

    # ── Web search (актуальные данные из интернета) ─────────────────
    search_context = ""
    last_query = ""
    try:
        user_msgs = [m for m in req.messages if getattr(m, "role", "") == "user"]
        if user_msgs and needs_search(req.messages):
            last_query = getattr(user_msgs[-1], "content", "")
            if isinstance(last_query, str) and len(last_query) > 10:
                search_context = await web_search(last_query[:200], max_results=5)
                if search_context:
                    logger.info("Web search returned %d chars for: %s", len(search_context), last_query[:60])
                else:
                    logger.info("Web search returned empty for: %s", last_query[:60])
    except Exception as exc:
        logger.warning("Web search error: %s", exc)

    # Фильтр релевантности
    if search_context and isinstance(last_query, str) and len(last_query) > 10:
        topic_words = {w.lower() for w in last_query.split() if len(w) > 3}
        items = search_context.split("\n**")
        relevant_count = 0
        for item in items:
            item_lower = item.lower()
            if any(tw in item_lower for tw in topic_words):
                relevant_count += 1
        if relevant_count < 2:
            logger.info("Search filtered: only %d/%d items relevant", relevant_count, len(items))
            search_context = ""

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-sphere.ru",
        "X-Title": "AI-Sphere",
    }

    # System prompt with model identity
    system_prompt = (
        f"Ты — {model_info.name}, ИИ-ассистент от {model_info.provider}. "
        f"Твоё имя — {model_info.name}, тебя создала компания {model_info.provider}. "
        f"Ты НЕ ChatGPT, НЕ GPT, НЕ OpenAI и НЕ ассистент от OpenAI. "
        "Никогда не называй себя ChatGPT, GPT или ассистентом OpenAI. "
        "Отвечай на языке пользователя. Будь полезным, точным и вежливым. "
        "Сегодня 29 июля 2026 года. Учитывай актуальную дату в ответах."
    )
    if search_context:
        system_prompt += (
            "\n\nВот актуальная информация из интернета (используй её, если она относится к вопросу пользователя):\n"
            f"{search_context}\n"
            "Если среди результатов поиска нет релевантной информации — отвечай из своих знаний, не выдумывай."
        )

    base_body = {
        "model": req.model,
        "messages": [
            {"role": "system", "content": system_prompt},
        ] + [_prepare_message(m, model_info.vision) for m in req.messages],
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
    }

    proxy = settings.openrouter_proxy or None

    # ── Streaming path (skip for image models — images don't stream) ──
    if req.stream and model_info.fixed_price == 0:
        async def event_stream():
            body = {**base_body, "stream": True}
            full_content = ""
            final_usage = {}
            async with httpx.AsyncClient(timeout=120.0, proxy=proxy) as client:
                async with client.stream(
                    "POST",
                    f"{settings.openrouter_base_url}/chat/completions",
                    headers=headers,
                    json=body,
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if not data_str or data_str == "[DONE]":
                                continue
                            try:
                                chunk = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue
                            if "choices" in chunk and chunk["choices"]:
                                delta = chunk["choices"][0].get("delta", {})
                                token = delta.get("content", "")
                                if token:
                                    full_content += token
                                    yield f"data: {json.dumps({'type': 'content', 'content': token})}\n\n"
                            if "usage" in chunk:
                                final_usage = chunk["usage"]

            # Deduct credits after streaming
            credits_spent = 0
            if user and (model_info.price_per_1k_input > 0 or model_info.fixed_price > 0) and final_usage:
                if model_info.fixed_price > 0:
                    credits_spent = model_info.fixed_price
                else:
                    input_tokens = final_usage.get("prompt_tokens", 0)
                    output_tokens = final_usage.get("completion_tokens", 0)
                    if input_tokens or output_tokens:
                        credits_spent = max(1, int(
                            input_tokens * model_info.price_per_1k_input / 1000
                            + output_tokens * model_info.price_per_1k_output / 1000
                        ))
                    if credits_spent > 0:
                        remaining = credits_spent
                        for field in ['credits_free', 'credits_bonus', 'credits_paid', 'credits_promo']:
                            avail = getattr(user, field, 0)
                            if remaining <= 0:
                                break
                            deduct = min(avail, remaining)
                            if deduct > 0:
                                setattr(user, field, avail - deduct)
                                remaining -= deduct
                        tx = Transaction(
                            user_id=user.id,
                            amount=-credits_spent,
                            type="spend",
                            description=f"Чат: {req.model}",
                        )
                        db.add(tx)
                        try:
                            await db.commit()
                        except Exception:
                            await db.rollback()

            yield f"data: {json.dumps({'type': 'done', 'credits_spent': credits_spent})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    # ── Non-streaming path returns SSE too (for fixed_price models) ──
    async def non_streaming_as_sse():
        async with httpx.AsyncClient(timeout=120.0, proxy=proxy) as client:
            response = await client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json=base_body,
            )

        if response.status_code != 200:
            yield f"data: {json.dumps({'type': 'error', 'content': response.text[:500]})}\n\n"
            yield "data: [DONE]\n\n"
            return

        data = response.json()
        choice = data["choices"][0]
        msg = choice["message"]
        content = msg.get("content") or msg.get("text", "") or ""
        # Handle image generation models (Gemini, etc.) — images come in separate field
        images = msg.get("images")
        if images and isinstance(images, list) and len(images) > 0:
            img_url = images[0].get("image_url", {}).get("url", "") if isinstance(images[0], dict) else ""
            if img_url:
                if content:
                    content += f"\n\n![generated]({img_url})"
                else:
                    content = img_url
        if not content:
            content = f"[{model_info.name} не вернул ответ]"

        # Deduct credits
        credits_spent = 0
        if user and (model_info.price_per_1k_input > 0 or model_info.fixed_price > 0):
            if model_info.fixed_price > 0:
                credits_spent = model_info.fixed_price
            else:
                input_tokens = data.get("usage", {}).get("prompt_tokens", 0)
                output_tokens = data.get("usage", {}).get("completion_tokens", 0)
                credits_spent = max(1, int(
                    input_tokens * model_info.price_per_1k_input / 1000
                    + output_tokens * model_info.price_per_1k_output / 1000
                ))
            if credits_spent > 0:
                remaining = credits_spent
                for field in ['credits_free', 'credits_bonus', 'credits_paid', 'credits_promo']:
                    avail = getattr(user, field, 0)
                    if remaining <= 0:
                        break
                    deduct = min(avail, remaining)
                    if deduct > 0:
                        setattr(user, field, avail - deduct)
                        remaining -= deduct
                tx = Transaction(
                    user_id=user.id,
                    amount=-credits_spent,
                    type="spend",
                    description=f"Чат: {req.model}",
                )
                db.add(tx)
                await db.commit()

        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'credits_spent': credits_spent})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(non_streaming_as_sse(), media_type="text/event-stream")


# ──────────────── Session sync (cross-device history) ────────────────


@router.get("/sessions")
async def get_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all sessions for current user, newest first."""
    from app.models.chat_session import ChatSession as ChatSessionModel
    result = await db.execute(
        select(ChatSessionModel)
        .where(ChatSessionModel.user_id == user.id)
        .order_by(ChatSessionModel.updated_at.desc())
    )
    return [s.to_dict() for s in result.scalars().all()]


@router.put("/sessions")
async def save_session(
    req: SessionSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update a session on the server."""
    from app.models.chat_session import ChatSession as ChatSessionModel
    import json

    existing = await db.get(ChatSessionModel, req.id)
    if existing:
        if existing.user_id != user.id:
            raise HTTPException(status_code=403, detail="Session belongs to another user")
        existing.title = req.title[:200]
        existing.messages = json.dumps(req.messages, ensure_ascii=False)
    else:
        session = ChatSessionModel(
            id=req.id,
            user_id=user.id,
            title=req.title[:200],
            messages=json.dumps(req.messages, ensure_ascii=False),
        )
        db.add(session)
    await db.commit()
    return {"ok": True}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a session."""
    from app.models.chat_session import ChatSession as ChatSessionModel
    session = await db.get(ChatSessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user.id:
        raise HTTPException(status_code=403, detail="Session belongs to another user")
    await db.delete(session)
    await db.commit()
    return {"ok": True}


FACTCHECK_MODEL = "openai/gpt-4o-mini"

FACTCHECK_SYSTEM_PROMPT = """Ты — факт-чекер. Проверяешь факты в ответах ИИ-ассистента.

Пользователь задал вопрос, ИИ-ассистент дал ответ. Проверь факты в ответе.

Правила:
1. Найди фактические ошибки, неточности, устаревшие данные
2. Отметь подтверждённые факты
3. Укажи неуверенные утверждения, которые требуют проверки
4. Оцени общую достоверность ответа в процентах (confidence)

Ответь ТОЛЬКО JSON без пояснений:
{
  "errors": [
    {"claim": "утверждение с ошибкой", "status": "incorrect", "correction": "как правильно"}
  ],
  "confidence": 85,
  "verified_claims": [
    {"claim": "подтверждённый факт", "status": "correct", "correction": null}
  ],
  "details": "краткое резюме проверки на русском"
}"""


@router.post("/factcheck", response_model=FactCheckResponse)
async def factcheck(
    req: FactCheckRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check facts in an AI response using another model. Cost: 1 credit."""
    # Credit check
    if user.credits < 1:
        raise HTTPException(status_code=402, detail="Недостаточно кредитов. Пополните баланс.")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-sphere.ru",
        "X-Title": "AI-Sphere",
    }

    body = {
        "model": FACTCHECK_MODEL,
        "messages": [
            {"role": "system", "content": FACTCHECK_SYSTEM_PROMPT},
            {"role": "user", "content": f"Вопрос пользователя: {req.prompt}\n\nОтвет ИИ:\n{req.response}"},
        ],
        "max_tokens": 2048,
        "temperature": 0.1,
    }

    proxy = settings.openrouter_proxy or None
    try:
        async with httpx.AsyncClient(timeout=60.0, proxy=proxy) as client:
            response = await client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json=body,
            )

        if response.status_code != 200:
            return FactCheckResponse(
                errors=[],
                confidence=50,
                verified_claims=[],
                details=f"Ошибка проверки: {response.status_code}",
            )

        data = response.json()
        content = data["choices"][0]["message"].get("content", "{}")

        # Extract JSON from response (handles markdown-wrapped JSON)
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            fc_response = FactCheckResponse(
                errors=[FactCheckClaim(**e) for e in result.get("errors", [])],
                confidence=result.get("confidence", 50),
                verified_claims=[FactCheckClaim(**c) for c in result.get("verified_claims", [])],
                details=result.get("details", "Проверка выполнена."),
            )
        else:
            fc_response = FactCheckResponse(details="Не удалось распарсить результат проверки.")

        # Deduct 1 credit
        remaining = 1
        for fld in ['credits_free', 'credits_bonus', 'credits_paid', 'credits_promo']:
            avail = getattr(user, fld, 0)
            if remaining <= 0:
                break
            deduct = min(avail, remaining)
            if deduct > 0:
                setattr(user, fld, avail - deduct)
                remaining -= deduct
        tx = Transaction(
            user_id=user.id,
            amount=-1,
            type="spend",
            description=f"Факт-чек: {req.model_id[:30]}",
        )
        db.add(tx)
        await db.commit()

        return fc_response
    except Exception as e:
        return FactCheckResponse(
            errors=[],
            confidence=50,
            verified_claims=[],
            details=f"Ошибка проверки: {str(e)[:200]}",
        )
