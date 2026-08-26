import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import bcrypt

os.environ["AISPHERE_DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["AISPHERE_DATABASE_URL_SYNC"] = "sqlite:///:memory:"
os.environ["AISPHERE_COOKIE_SECURE"] = "false"
os.environ["AISPHERE_JWT_SECRET"] = "test-only-secret-that-is-longer-than-thirty-two-characters"
os.environ["AISPHERE_PLATEGA_SECRET_KEY"] = "test-webhook-secret"
os.environ["AISPHERE_PLATEGA_MERCHANT_ID"] = "test-merchant"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import async_session
from app.main import app
from app.models.credit_plan import CreditPlan
from app.models.ai_model import AiModel
from app.models.payment_attempt import PaymentAttempt
from app.models.admin_log import AdminLog
from app.models.user import User
from app.models.chat_session import ChatSession
from app.models.user_query import UserQuery
from app.models.product_event import ProductEvent
from app.models.promo import PromoCode, PromoRedemption
from app.models.credit_op import CreditOperation
from app.models.file_record import FileRecord
from app.models.generation_job import GenerationJob
from app.models.product_growth import RewardLedger, UserProgress
from app.core.sanitization import sanitize_rich_content
from app.api.generations import classify_intent, _choose_model
from app.api.chat import _safe_punctuation_result
from app.api.workspace import resolve_task_model
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.core.gamification import process_product_event
from app.api.growth import FUNNEL_STAGES, _ordered_conversion
from app.api.admin import OPENROUTER_CATALOGUES, _merge_openrouter_catalog_item
from app.core.economics import (
    PricingContext, achieved_margin, credits_for_provider_cost, provider_cost_from_snapshot,
    text_prices, text_task_metrics,
)
from app.core.credits import apply_daily_credits, moscow_today, bucket_snapshot, allocate_buckets, restore_buckets
from app.core.retention import cleanup_expired_history


def make_client() -> TestClient:
    return TestClient(app, headers={"Origin": "http://localhost:3000"})


async def _ensure_user(email: str, password: str = "safe-password", *, is_admin: bool = False) -> User:
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None:
            user = User(email=email, hashed_password=hash_password(password), credits_free=10, is_admin=is_admin)
            db.add(user)
        else:
            user.hashed_password = hash_password(password)
            user.is_admin = is_admin or user.is_admin
        await db.commit()
        await db.refresh(user)
        return user


def authenticate(client: TestClient, email: str, password: str = "safe-password", *, is_admin: bool = False) -> User:
    user = asyncio.run(_ensure_user(email, password, is_admin=is_admin))
    client.cookies.set(settings.auth_cookie_name, create_access_token(user.id, user.email), domain="testserver.local", path="/")
    return user


def authenticate_existing(client: TestClient, user: User) -> None:
    client.cookies.set(settings.auth_cookie_name, create_access_token(user.id, user.email), domain="testserver.local", path="/")


def test_openrouter_media_catalogues_preserve_video_capabilities_and_pricing():
    assert ("/images/models", "image") in OPENROUTER_CATALOGUES
    assert ("/videos/models", "video") in OPENROUTER_CATALOGUES
    discovered = {}
    _merge_openrouter_catalog_item(discovered, {
        "id": "test/video-model",
        "name": "Video model",
        "supported_durations": [5, 10],
        "supported_resolutions": ["720p"],
        "supported_aspect_ratios": ["16:9"],
        "pricing_skus": {"duration_seconds_720p": "0.1"},
    }, "video")
    model = discovered["test/video-model"]
    assert model["architecture"]["input_modalities"] == ["text"]
    assert model["architecture"]["output_modalities"] == ["video"]
    assert model["supported_durations"] == [5, 10]
    assert model["pricing_skus"]["duration_seconds_720p"] == "0.1"


def test_tariff_aware_pricing_never_drops_below_eighty_percent_margin():
    context = PricingContext(
        credit_rub=2500 / 30000,
        plan_id=4,
        plan_name="РџСЂРµРјРёСѓРј",
        target_margin=0.80,
        payment_fee_rate=0.05,
        provider_funding_fee_rate=0.055,
        usd_rub_rate=95,
        fx_safety_factor=1.10,
    )
    price_in, price_out = text_prices(2.5, 10, context)
    metrics = text_task_metrics(2.5, 10, price_in, price_out, 1200, 900, context)
    assert metrics["margin_pct"] >= 80
    media_cost = 0.12
    media_credits = credits_for_provider_cost(media_cost, context, whole=True)
    assert achieved_margin(media_cost, media_credits, context) >= 80


def test_video_pricing_supports_per_second_and_video_token_skus():
    parameters = {
        "duration": 5, "resolution": "720p", "aspect_ratio": "16:9",
        "generate_audio": False,
    }
    assert provider_cost_from_snapshot(
        {"pricing_skus": {"duration_seconds_720p": "0.1"}},
        "video", parameters,
    ) == 0.5
    token_cost = provider_cost_from_snapshot({"pricing_skus": {
        "video_tokens": "0.0000024",
        "video_tokens_without_audio": "0.0000012",
    }}, "video", parameters)
    assert token_cost == 0.1296
    parameters["generate_audio"] = True
    assert provider_cost_from_snapshot({"pricing_skus": {
        "video_tokens": "0.0000024",
        "video_tokens_without_audio": "0.0000012",
    }}, "video", parameters) == 0.2592


def test_health_auth_and_model_contract():
    with make_client() as client:
        assert client.get("/api/health").status_code == 200
        assert client.post("/api/auth/register", json={"email": "user@example.com", "password": "unused"}).status_code == 404
        assert client.post("/api/auth/login", json={"email": "user@example.com", "password": "unused"}).status_code == 404
        authenticate(client, "user@example.com")
        assert client.get("/api/auth/me").status_code == 200
        models = client.get("/api/public/models").json()
        assert models and all(type(model["vision"]) is bool for model in models)
        assert client.post("/api/auth/logout").status_code == 204
        assert client.get("/api/auth/me").status_code == 401


def test_voice_punctuation_contract_preserves_words_and_credits():
    assert _safe_punctuation_result(
        "РїСЂРёРІРµС‚ СЂР°СЃСЃРєР°Р¶Рё РїСЂРѕ РјРѕРґРµР»СЊ 2026",
        "РџСЂРёРІРµС‚! Р Р°СЃСЃРєР°Р¶Рё РїСЂРѕ РјРѕРґРµР»СЊ 2026.",
    )
    assert not _safe_punctuation_result(
        "РїСЂРёРІРµС‚ СЂР°СЃСЃРєР°Р¶Рё РїСЂРѕ РјРѕРґРµР»СЊ 2026",
        "РџСЂРёРІРµС‚! Р Р°СЃСЃРєР°Р¶Рё РїСЂРѕ РЅРѕРІСѓСЋ РјРѕРґРµР»СЊ 2026.",
    )

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": FakeClient.content}}]}

    class FakeClient:
        content = "РџСЂРёРІРµС‚! Р Р°СЃСЃРєР°Р¶Рё, РїРѕР¶Р°Р»СѓР№СЃС‚Р°, РєР°Рє СЂР°Р±РѕС‚Р°РµС‚ РЅРµР№СЂРѕСЃРµС‚СЊ."
        init_kwargs = {}
        post_kwargs = {}

        def __init__(self, **kwargs):
            type(self).init_kwargs = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, **kwargs):
            type(self).post_kwargs = {"url": url, **kwargs}
            return FakeResponse()

    with TestClient(
        app,
        headers={"Origin": "http://localhost:3000"},
        client=("voice-punctuation", 50000),
    ) as client:
        authenticate(client, "voice-punctuation@example.com")
        credits_before = client.get("/api/auth/me").json()["credits"]

        with (
            patch.object(settings, "openrouter_api_key", "test-key"),
            patch.object(settings, "openrouter_proxy", "http://proxy.example:8080"),
            patch("app.api.chat.httpx.AsyncClient", FakeClient),
        ):
            response = client.post("/api/chat/voice/punctuate", json={
                "text": "РїСЂРёРІРµС‚ СЂР°СЃСЃРєР°Р¶Рё РїРѕР¶Р°Р»СѓР№СЃС‚Р° РєР°Рє СЂР°Р±РѕС‚Р°РµС‚ РЅРµР№СЂРѕСЃРµС‚СЊ",
            })
            assert response.status_code == 200
            assert response.json() == {
                "result": FakeClient.content, "applied": True,
            }
            assert FakeClient.init_kwargs["proxy"] == "http://proxy.example:8080"
            assert FakeClient.init_kwargs["timeout"] == 4.0
            assert FakeClient.post_kwargs["json"]["temperature"] == 0

            FakeClient.content = "РџСЂРёРІРµС‚! РћР±СЉСЏСЃРЅРё, РїРѕР¶Р°Р»СѓР№СЃС‚Р°, РєР°Рє СЂР°Р±РѕС‚Р°РµС‚ РЅРµР№СЂРѕСЃРµС‚СЊ."
            unsafe = client.post("/api/chat/voice/punctuate", json={
                "text": "РїСЂРёРІРµС‚ СЂР°СЃСЃРєР°Р¶Рё РїРѕР¶Р°Р»СѓР№СЃС‚Р° РєР°Рє СЂР°Р±РѕС‚Р°РµС‚ РЅРµР№СЂРѕСЃРµС‚СЊ",
            })
            assert unsafe.status_code == 200
            assert unsafe.json() == {
                "result": "РїСЂРёРІРµС‚ СЂР°СЃСЃРєР°Р¶Рё РїРѕР¶Р°Р»СѓР№СЃС‚Р° РєР°Рє СЂР°Р±РѕС‚Р°РµС‚ РЅРµР№СЂРѕСЃРµС‚СЊ",
                "applied": False,
            }

        with patch.object(settings, "openrouter_api_key", ""):
            fallback = client.post("/api/chat/voice/punctuate", json={"text": "РёСЃС…РѕРґРЅС‹Р№ С‚РµРєСЃС‚"})
            assert fallback.status_code == 200
            assert fallback.json() == {"result": "РёСЃС…РѕРґРЅС‹Р№ С‚РµРєСЃС‚", "applied": False}

        assert client.get("/api/auth/me").json()["credits"] == credits_before
        assert client.post("/api/chat/voice/punctuate", json={"text": " "}).status_code == 422
        assert client.post("/api/chat/voice/punctuate", json={"text": "СЏ" * 2001}).status_code == 422

    with TestClient(
        app,
        headers={"Origin": "http://localhost:3000"},
        client=("voice-punctuation-anonymous", 50000),
    ) as anonymous:
        assert anonymous.post("/api/chat/voice/punctuate", json={"text": "РїСЂРѕРІРµСЂРєР°"}).status_code == 401


def test_voice_punctuation_rate_limit():
    with TestClient(
        app,
        headers={"Origin": "http://localhost:3000"},
        client=("voice-rate-limit", 50000),
    ) as client:
        authenticate(client, "voice-rate-limit@example.com")
        with patch.object(settings, "openrouter_api_key", ""):
            statuses = [
                client.post("/api/chat/voice/punctuate", json={"text": "РїСЂРѕРІРµСЂРєР°"}).status_code
                for _ in range(21)
            ]
        assert statuses[:20] == [200] * 20
        assert statuses[20] == 429


def test_task_catalogue_estimate_events_and_auto_fallback_contract():
    with make_client() as client:
        templates = client.get("/api/public/task-templates").json()
        assert len(templates) == 12
        assert {item["category"] for item in templates} == {"text", "document", "image", "video"}
        explain = next(item for item in templates if item["task_type"] == "explain")
        estimate = client.post("/api/tasks/estimate", json={
            "template_id": explain["id"], "model": "auto", "prompt": "РџРѕС‡РµРјСѓ РЅРµР±Рѕ СЃРёРЅРµРµ?",
        })
        assert estimate.status_code == 200
        assert estimate.json()["credits_min"] >= 1
        assert client.post("/api/events", json={
            "event_name": "template_view", "template_id": explain["id"],
            "metadata": {"source": "test", "prompt": "must-not-be-stored"},
        }).status_code == 204

    async def verify_routing():
        async with async_session() as db:
            suffix = uuid.uuid4().hex
            primary = AiModel(name="Primary route", or_model_id=f"test/primary-{suffix}", provider="Test", is_active=True, is_visible=True, recommended_priority=-20, or_input_cost=10, or_output_cost=10, input_modalities='["text"]', output_modalities='["text"]')
            backup = AiModel(name="Backup route", or_model_id=f"test/backup-{suffix}", provider="Test", is_active=True, is_visible=True, recommended_priority=100, sort_order=-100, or_input_cost=0, or_output_cost=0, input_modalities='["text"]', output_modalities='["text"]')
            db.add_all([primary, backup])
            await db.commit()
            selected, fallbacks, kind = await resolve_task_model(db, "auto", "text", None, {})
            assert selected.or_model_id == backup.or_model_id
            assert primary.or_model_id != selected.or_model_id
            assert len(fallbacks) <= 3
            assert kind == "text"

    asyncio.run(verify_routing())


def test_vision_and_csrf_contracts():
    assert "script" not in sanitize_rich_content('<p>ok</p><script>alert(1)</script>')
    with TestClient(app) as no_origin_client:
        assert no_origin_client.post("/api/auth/register", json={"email": "csrf@example.com", "password": "safe-password"}).status_code == 403
    with make_client() as client:
        authenticate(client, "vision@example.com")
        response = client.post("/api/chat/completions", json={
            "model": "deepseek/deepseek-v4-flash",
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": "Р§С‚Рѕ РЅР° С„РѕС‚Рѕ?"},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,AA=="}},
            ]}],
        })
        assert response.status_code == 400
        assert "РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ" in response.json()["detail"]


def test_database_catalog_changes_are_immediately_public():
    model_id = "test/provider-model-" + uuid.uuid4().hex

    async def create_records():
        async with async_session() as db:
            model = AiModel(name="Live model", or_model_id=model_id, provider="Test", price_input=1.25, price_output=2.5, vision=True, is_active=True, is_visible=True)
            plan = CreditPlan(name="Live plan", price_rub=12345, credits=777, is_active=True)
            db.add_all([model, plan])
            await db.commit()
            return plan.id

    plan_id = asyncio.run(create_records())
    with make_client() as client:
        models = client.get("/api/public/models").json()
        model = next(item for item in models if item["id"] == model_id)
        assert model["price_input"] == 1.25 and model["vision"] is True
        plans = client.get("/api/billing/plans").json()
        assert any(item["id"] == str(plan_id) and item["price"] == 12345 for item in plans)


def test_admin_is_role_protected():
    with make_client() as client:
        authenticate(client, "plain@example.com", "correct horse battery staple")
        assert client.get("/api/admin/dashboard/stats").status_code == 403

        async def promote_and_check_audit():
            async with async_session() as db:
                user = (await db.execute(select(User).where(User.email == "plain@example.com"))).scalar_one()
                blocked = (await db.execute(select(AdminLog).where(AdminLog.admin_id == user.id))).scalars().all()
                user.is_admin = True
                user.role_id = None
                await db.commit()
                return bool(blocked)

        assert asyncio.run(promote_and_check_audit())
        assert client.get("/api/admin/dashboard/stats").status_code == 200
        slug = "audit-" + uuid.uuid4().hex
        created = client.post("/api/admin/seo-pages", json={
            "slug": slug,
            "title": "Audit page",
            "status": "published",
            "content": '<p>safe</p><script>alert(1)</script>',
        })
        assert created.status_code == 200
        assert "script" not in client.get(f"/api/public/pages/{slug}").json()["content"]
        plan = client.post("/api/admin/plans", json={"name": "Admin live", "credits": 321, "price_rub": 6543})
        assert plan.status_code == 200
        plan_id = plan.json()["id"]
        assert client.patch(f"/api/admin/plans/{plan_id}", json={"price_rub": 7654}).status_code == 200
        assert any(item["id"] == str(plan_id) and item["price"] == 7654 for item in client.get("/api/billing/plans").json())

        async def successful_audit_exists():
            async with async_session() as db:
                return (await db.execute(select(AdminLog).where(
                    AdminLog.action == "POST /api/admin/seo-pages",
                    AdminLog.result == "success",
                ))).scalar_one_or_none() is not None

        assert asyncio.run(successful_audit_exists())


def test_admin_can_review_user_queries_chats_and_feedback():
    email = f"observer-{uuid.uuid4().hex}@example.com"
    session_id = str(uuid.uuid4())
    messages = [
        {"role": "user", "content": "РЎРѕСЃС‚Р°РІСЊ РїР»Р°РЅ Р·Р°РїСѓСЃРєР° РЅРѕРІРѕРіРѕ РїСЂРѕРґСѓРєС‚Р°"},
        {
            "role": "assistant", "content": "Р’РѕС‚ РїРѕС€Р°РіРѕРІС‹Р№ РїР»Р°РЅ.",
            "requested_model": "deepseek/deepseek-chat", "credits_spent": 2,
        },
    ]
    async def create_observed_user():
        async with async_session() as db:
            db.add(User(email=email, hashed_password=hash_password("safe-password-123")))
            await db.commit()

    asyncio.run(create_observed_user())
    with make_client() as client:
        user = asyncio.run(_ensure_user(email, "safe-password-123"))
        authenticate_existing(client, user)
        assert client.put("/api/chat/sessions", json={
            "id": session_id, "title": "Р—Р°РїСѓСЃРє РїСЂРѕРґСѓРєС‚Р°", "messages": messages,
        }).status_code == 200
        assert client.post("/api/chat/feedback", json={
            "session_id": session_id, "message_index": 1,
            "feedback_type": "like", "model": "deepseek/deepseek-chat",
        }).status_code == 200
        assert client.post("/api/feedback", json={
            "type": "idea", "subject": "РЈР»СѓС‡С€РµРЅРёРµ", "message": "Р”РѕР±Р°РІСЊС‚Рµ СЌРєСЃРїРѕСЂС‚", "rating": 5,
        }).status_code == 200

        async def promote():
            async with async_session() as db:
                user = (await db.execute(select(User).where(User.email == email))).scalar_one()
                user.is_admin = True
                user.role_id = None
                await db.commit()

        asyncio.run(promote())

        queries = client.get("/api/admin/queries?search=Р·Р°РїСѓСЃРєР°").json()
        assert queries["total"] == 1
        assert queries["queries"][0]["content"] == messages[0]["content"]
        assert queries["queries"][0]["user_email"] == email
        assert queries["queries"][0]["model"] == "deepseek/deepseek-chat"

        chats = client.get("/api/admin/chats?search=РїСЂРѕРґСѓРєС‚Р°").json()
        assert chats["total"] == 1
        assert chats["chats"][0]["message_count"] == 2
        assert chats["chats"][0]["credits_spent"] == 2
        chat = client.get(f"/api/admin/chats/{session_id}").json()
        assert chat["total"] == 2
        assert chat["messages"][0]["content"] == messages[0]["content"]

        ratings = client.get("/api/admin/feedback-stats").json()
        assert ratings["likes"] >= 1
        feedback = client.get("/api/admin/feedbacks?type=idea").json()
        item_id = next(item["id"] for item in feedback["feedbacks"] if item["user_email"] == email)
        assert client.patch(f"/api/admin/feedbacks/{item_id}?status=read").status_code == 200
        assert client.post(f"/api/admin/feedbacks/{item_id}/reply?message=РЎРїР°СЃРёР±Рѕ").status_code == 200
        detail = client.get(f"/api/admin/feedbacks/{item_id}").json()
        assert detail["feedback"]["status"] == "replied"
        assert detail["replies"][0]["message"] == "РЎРїР°СЃРёР±Рѕ"

        assert client.put("/api/admin/metrica?counter_id=12345678").status_code == 200
        assert client.get("/api/public/settings").json()["yandex_metrica_id"] == "12345678"

        working_sections = (
            "/api/admin/analytics/problems",
            "/api/admin/analytics/user-segments",
            "/api/admin/analytics/request-categories",
            "/api/admin/analytics/models-feedback",
            "/api/admin/surveys/results",
            "/api/admin/payments/abandoned",
        )
        for path in working_sections:
            assert client.get(path).status_code == 200, path

        victim_email = f"delete-{uuid.uuid4().hex}@example.com"
        victim_session = str(uuid.uuid4())

        async def create_victim():
            async with async_session() as db:
                victim = User(email=victim_email, hashed_password=hash_password("unused-password"))
                db.add(victim)
                await db.flush()
                db.add(ChatSession(id=victim_session, user_id=victim.id, title="РЈРґР°Р»СЏРµРјС‹Р№ С‡Р°С‚", messages="[]"))
                db.add(UserQuery(
                    session_id=victim_session, user_id=victim.id, message_index=0,
                    content="РЈРґР°Р»СЏРµРјС‹Р№ Р·Р°РїСЂРѕСЃ",
                ))
                await db.commit()
                return victim.id

        victim_id = asyncio.run(create_victim())
        assert client.delete(f"/api/admin/users/{victim_id}").status_code == 200

        async def victim_was_deleted():
            async with async_session() as db:
                return await db.get(User, victim_id), await db.get(ChatSession, victim_session)

        assert asyncio.run(victim_was_deleted()) == (None, None)


def test_legacy_bcrypt_password_is_upgraded_on_login():
    async def prepare():
        async with async_session() as db:
            legacy_hash = bcrypt.hashpw(b"legacy-password-123", bcrypt.gensalt()).decode()
            db.add(User(email="legacy@example.com", hashed_password=legacy_hash, is_admin=True))
            await db.commit()

    asyncio.run(prepare())
    with make_client() as client:
        response = client.post("/api/admin/auth/login", json={"email": "legacy@example.com", "password": "legacy-password-123"})
        assert response.status_code == 200
        assert response.cookies.get("ai_sphere_session")

    async def upgraded():
        async with async_session() as db:
            user = (await db.execute(select(User).where(User.email == "legacy@example.com"))).scalar_one()
            return user.hashed_password

    assert asyncio.run(upgraded()).startswith("$argon2")


def test_webhook_rejects_unsigned_and_is_idempotent():
    with make_client() as client:
        assert client.post("/api/billing/webhook", json={}).status_code == 401

        async def prepare():
            async with async_session() as db:
                user = User(email="payer@example.com", hashed_password="unused", credits_paid=0)
                db.add(user)
                await db.flush()
                plan = (await db.execute(select(CreditPlan).order_by(CreditPlan.id))).scalars().first()
                payment_id = "provider-" + uuid.uuid4().hex
                db.add(PaymentAttempt(
                    id=str(uuid.uuid4()), provider_payment_id=payment_id, user_id=user.id,
                    plan_id=plan.id, amount_kopecks=plan.price_rub, currency="RUB",
                    credits=plan.credits + plan.bonus_credits, status="pending",
                ))
                await db.commit()
                return payment_id, plan.price_rub, user.id, plan.credits + plan.bonus_credits

        payment_id, amount_kopecks, user_id, credits = asyncio.run(prepare())
        headers = {"Content-Type":"application/json", "X-MerchantId":"test-merchant", "X-Secret":"test-webhook-secret"}
        wrong_headers = {**headers, "X-Secret": "wrong"}
        payload = json.dumps({"status":"CONFIRMED", "id":payment_id, "amount":amount_kopecks / 100, "currency":"RUB"}).encode()
        assert client.post("/api/billing/webhook", content=payload, headers=wrong_headers).status_code == 401
        unknown = json.dumps({"status":"CONFIRMED", "id":"unknown", "amount":amount_kopecks / 100, "currency":"RUB"}).encode()
        assert client.post("/api/billing/webhook", content=unknown, headers=headers).status_code == 404
        wrong_amount = json.dumps({"status":"CONFIRMED", "id":payment_id, "amount":amount_kopecks / 100 + 1, "currency":"RUB"}).encode()
        assert client.post("/api/billing/webhook", content=wrong_amount, headers=headers).status_code == 400
        assert client.post("/api/billing/webhook", content=payload, headers=headers).status_code == 200
        assert client.post("/api/billing/webhook", content=payload, headers=headers).status_code == 200

        async def balance():
            async with async_session() as db:
                return (await db.get(User, user_id)).credits_paid
        assert asyncio.run(balance()) == credits


def test_media_intent_and_cheapest_allowed_model():
    assert classify_intent("РЎРіРµРЅРµСЂРёСЂСѓР№ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РєРѕС‚Р°") == "image"
    assert classify_intent("РЎРѕР·РґР°Р№ РєРѕСЂРѕС‚РєРѕРµ РІРёРґРµРѕ СЃ РјРѕСЂРµРј") == "video"
    assert classify_intent("Р Р°СЃСЃРєР°Р¶Рё, РєР°Рє РіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РєР°СЂС‚РёРЅРєРё") == "text"
    assert classify_intent("/video Р·Р°РєР°С‚") == "video"

    async def choose():
        async with async_session() as db:
            expensive = AiModel(
                name="Image expensive", or_model_id="test/image-expensive", provider="Test",
                output_modalities='["image"]', openrouter_pricing='{"cost_usd": 0.08}',
                auto_route_enabled=True, is_active=True, is_visible=True,
            )
            cheap = AiModel(
                name="Image cheap", or_model_id="test/image-cheap", provider="Test",
                output_modalities='["image"]', openrouter_pricing='{"cost_usd": 0.01}',
                auto_route_enabled=True, is_active=True, is_visible=True,
            )
            db.add_all([expensive, cheap])
            await db.commit()
            selected = await _choose_model(db, "deepseek/deepseek-v4-flash", "image", {})
            return selected.or_model_id

    assert asyncio.run(choose()) == "test/image-cheap"


def test_image_dispatch_uses_image_api_and_private_asset(monkeypatch, tmp_path):
    captured = {}

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            import base64
            return {"data": [{"b64_json": base64.b64encode(b"fake-png").decode()}], "usage": {"cost": 0.001}}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            captured["url"] = url
            captured["json"] = kwargs["json"]
            return FakeResponse()

    import app.api.generations as generations
    monkeypatch.setattr(generations.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(settings, "data_dir", tmp_path)

    async def prepare_model():
        async with async_session() as db:
            model = (await db.execute(select(AiModel).where(AiModel.or_model_id == "test/image-cheap"))).scalar_one()
            model.fixed_price = 1
            await db.commit()

    asyncio.run(prepare_model())
    with make_client() as client:
        authenticate(client, "plain@example.com", "correct horse battery staple")
        response = client.post("/api/chat/dispatch", json={
            "model": "deepseek/deepseek-v4-flash",
            "messages": [{"role": "user", "content": "РЎРіРµРЅРµСЂРёСЂСѓР№ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РєРѕС‚Р°"}],
            "stream": True,
        })
        assert response.status_code == 200
        event = next(json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: {") and '"generation"' in line)
        generation = event["generation"]
        assert generation["status"] == "completed"
        assert generation["effective_model"] == "test/image-cheap"
        assert captured["url"].endswith("/images")
        assert captured["json"]["aspect_ratio"] == "1:1"
        assert client.get(generation["assets"][0]["url"]).content == b"fake-png"

    with make_client() as other:
        authenticate(other, "vision@example.com")
        assert other.get(generation["assets"][0]["url"]).status_code == 404


def test_event_batch_is_idempotent_and_anonymous_history_links_after_auth():
    anon = "anon-" + uuid.uuid4().hex
    visit = "visit-" + uuid.uuid4().hex
    first_id = str(uuid.uuid4())
    with make_client() as client:
        response = client.post("/api/events/batch", json={"events": [
            {"event_id": first_id, "event_name": "landing_view", "anonymous_id": anon, "visit_session_id": visit, "page": "/", "source": "test", "device_type": "mobile"},
            {"event_id": first_id, "event_name": "landing_view", "anonymous_id": anon, "visit_session_id": visit, "page": "/", "source": "test", "device_type": "mobile"},
        ]})
        assert response.status_code == 200
        assert response.json() == {"accepted": 1, "duplicates": 1}
        email = f"linked-{uuid.uuid4().hex}@example.com"

        async def create_linked_user():
            async with async_session() as db:
                user = User(email=email, hashed_password=hash_password("safe-password-123"))
                db.add(user); await db.commit(); return user.id

        user_id = asyncio.run(create_linked_user())
        token = create_access_token(user_id, email)
        assert client.post("/api/events", headers={"Authorization": f"Bearer {token}"}, json={
            "event_id": str(uuid.uuid4()), "event_name": "auth_completed",
            "anonymous_id": anon, "visit_session_id": visit,
        }).status_code == 204

    async def verify():
        async with async_session() as db:
            user = (await db.execute(select(User).where(User.email == email))).scalar_one()
            rows = (await db.execute(select(ProductEvent).where(ProductEvent.anonymous_id == anon))).scalars().all()
            assert len(rows) == 2
            assert {item.user_id for item in rows} == {user.id}
            assert all("prompt" not in item.metadata_json for item in rows)

    asyncio.run(verify())


def test_funnel_requires_order_and_respects_conversion_window():
    start = datetime.now(timezone.utc)
    ordered = [SimpleNamespace(event_name=name, created_at=start + timedelta(minutes=index)) for index, (_, name) in enumerate(FUNNEL_STAGES)]
    assert _ordered_conversion(ordered, FUNNEL_STAGES, timedelta(days=7)) == [True] * len(FUNNEL_STAGES)
    out_of_order = [ordered[1], ordered[0], *ordered[2:]]
    assert _ordered_conversion(out_of_order, FUNNEL_STAGES, timedelta(days=7))[1] is False
    too_late = [*ordered[:3], SimpleNamespace(event_name="result_success", created_at=start + timedelta(days=8))]
    assert _ordered_conversion(too_late, FUNNEL_STAGES, timedelta(days=7))[:4] == [True, True, True, False]


def test_gamification_rewards_are_idempotent_and_monthly_cap_is_enforced():
    email = f"player-{uuid.uuid4().hex}@example.com"

    async def exercise():
        async with async_session() as db:
            user = User(email=email, hashed_password=hash_password("safe-password-123"))
            db.add(user); await db.flush()
            now = datetime.now(timezone.utc)
            events = [
                ("result_success", 101, "text", now - timedelta(days=2)),
                ("result_success", 102, "document", now - timedelta(days=1)),
                ("result_success", 103, "image", now),
                ("result_reused", None, "text", now),
                ("project_completed", None, "project", now),
            ]
            for index, (name, template_id, kind, at) in enumerate(events):
                await process_product_event(
                    db, user, event_id=f"growth-{user.id}-{index}", event_name=name,
                    template_id=template_id, task_type=kind,
                    metadata={"result_kind": kind, "project_id": "project-1"}, now=at,
                )
            # Replaying the same authoritative event must not add XP or credits.
            await process_product_event(
                db, user, event_id=f"growth-{user.id}-0", event_name="result_success",
                template_id=101, task_type="text", metadata={"result_kind": "text"}, now=now,
            )
            await db.commit()
            await db.refresh(user)
            progress = await db.get(UserProgress, user.id)
            ledgers = (await db.execute(select(RewardLedger).where(RewardLedger.user_id == user.id))).scalars().all()
            assert progress.monthly_bonus_credits == 20
            assert user.credits_bonus == 20
            assert sum(item.credit_amount for item in ledgers) == 20
            assert len({item.reward_key for item in ledgers}) == len(ledgers)
            assert progress.xp == 135

    asyncio.run(exercise())


def test_campaign_frequency_cap_and_experiment_assignment_survive_login():
    admin_email = f"growth-admin-{uuid.uuid4().hex}@example.com"
    with make_client() as admin_client:
        async def create_admin():
            async with async_session() as db:
                user = User(email=admin_email, hashed_password=hash_password("safe-password-123"), is_admin=True, role_id=None)
                db.add(user); await db.commit(); return user.id

        admin_id = asyncio.run(create_admin())
        admin_client.headers["Authorization"] = f"Bearer {create_access_token(admin_id, admin_email)}"
        campaign = admin_client.post("/api/admin/growth/campaigns", json={
            "name": "Frequency test", "placement": "notification", "title": "Test",
            "body": "Campaign body", "audience": {"include_anonymous": True},
            "frequency_cap": 1, "holdout_pct": 0, "goal_event": "result_success",
        }).json()
        assert admin_client.post(f"/api/admin/growth/campaigns/{campaign['id']}/activate").status_code == 200
        experiment = admin_client.post("/api/admin/growth/experiments", json={
            "name": "Stable assignment", "surface": "test_surface", "primary_metric": "activation",
            "variants": [{"key": "A", "name": "A", "weight": .5}, {"key": "B", "name": "B", "weight": .5}],
        }).json()
        assert admin_client.post(f"/api/admin/growth/experiments/{experiment['id']}/start").status_code == 200

    anon = "stable-" + uuid.uuid4().hex
    with make_client() as visitor:
        deliveries = visitor.get(f"/api/engagement/campaigns?anonymous_id={anon}").json()
        delivery = next(item for item in deliveries if item["id"] == campaign["id"])
        assert visitor.post(f"/api/engagement/campaigns/{delivery['delivery_id']}/shown?anonymous_id={anon}").status_code == 200
        assert visitor.post(f"/api/engagement/campaigns/{delivery['delivery_id']}/shown?anonymous_id={anon}").json().get("capped") is True
        assert all(item["id"] != campaign["id"] for item in visitor.get(f"/api/engagement/campaigns?anonymous_id={anon}").json())
        before = visitor.get(f"/api/experiments/assignments?surface=test_surface&anonymous_id={anon}").json()["assignment"]
        assert before
        assigned_email = f"assigned-{uuid.uuid4().hex}@example.com"
        async def create_assigned_user():
            async with async_session() as db:
                user = User(email=assigned_email, hashed_password=hash_password("safe-password-123"))
                db.add(user); await db.commit(); return user.id
        assigned_id = asyncio.run(create_assigned_user())
        after = visitor.get(f"/api/experiments/assignments?surface=test_surface&anonymous_id={anon}", headers={"Authorization": f"Bearer {create_access_token(assigned_id, assigned_email)}"}).json()["assignment"]
        assert after["variant_id"] == before["variant_id"]


def test_daily_free_credits_reset_once_and_skip_paying_users():
    async def exercise():
        async with async_session() as db:
            free = User(email=f"daily-{uuid.uuid4().hex}@example.com", hashed_password=hash_password("test-password"), credits_free=2,
                        last_daily_reset=moscow_today() - timedelta(days=1))
            paid = User(email=f"paid-{uuid.uuid4().hex}@example.com", hashed_password=hash_password("test-password"), credits_free=2,
                        credits_paid=7, total_paid_rub=100, last_daily_reset=moscow_today() - timedelta(days=1))
            db.add_all([free, paid]); await db.flush()
            await apply_daily_credits(free, db)
            await apply_daily_credits(free, db)
            await apply_daily_credits(paid, db)
            await db.refresh(free); await db.refresh(paid)
            assert free.credits_free == 10 and free.last_daily_reset == moscow_today()
            assert paid.credits_free == 2 and paid.last_daily_reset != moscow_today()
            ops = (await db.execute(select(CreditOperation).where(CreditOperation.user_id == free.id, CreditOperation.op_type == "daily_free"))).scalars().all()
            assert len(ops) == 1
    asyncio.run(exercise())


def test_bucket_allocation_and_refund_preserve_entitlements():
    snapshot = {"free": 2, "bonus": 3, "paid": 10, "promo": 4}
    allocation = allocate_buckets(snapshot, 7)
    assert allocation == {"free": 2, "bonus": 3, "paid": 2, "promo": 0}
    async def exercise():
        async with async_session() as db:
            user = User(email=f"bucket-{uuid.uuid4().hex}@example.com", hashed_password=hash_password("test-password"), credits_free=0, credits_bonus=0, credits_paid=0, credits_promo=0)
            db.add(user); await db.flush()
            restored = await restore_buckets(db, user.id, allocation)
            await db.commit(); await db.refresh(user)
            assert restored == {"free": 2, "bonus": 3, "paid": 2, "promo": 0}
            assert bucket_snapshot(user) == {"free": 2, "bonus": 3, "paid": 2, "promo": 0}
    asyncio.run(exercise())


def test_promo_is_case_insensitive_and_single_use_per_user():
    email = f"promo-{uuid.uuid4().hex}@example.com"
    async def seed():
        async with async_session() as db:
            promo = PromoCode(code="WELCOME10", credits=10, max_uses=1, is_active=True)
            db.add(promo); await db.commit()
    asyncio.run(seed())
    with make_client() as client:
        user = authenticate(client, email)
        first = client.post("/api/billing/redeem-promo", json={"code": "welcome10"})
        assert first.status_code == 200 and first.json()["credits_added"] == 10
        second = client.post("/api/billing/redeem-promo", json={"code": "WELCOME10"})
        assert second.status_code == 409
    async def verify():
        async with async_session() as db:
            user = (await db.execute(select(User).where(User.email == email))).scalar_one()
            assert user.credits_promo == 10
            assert len((await db.execute(select(PromoRedemption).where(PromoRedemption.user_id == user.id))).scalars().all()) == 1
    asyncio.run(verify())


def test_private_upload_is_owner_scoped():
    first_email = f"upload-a-{uuid.uuid4().hex}@example.com"
    second_email = f"upload-b-{uuid.uuid4().hex}@example.com"
    with make_client() as owner:
        authenticate(owner, first_email)
        response = owner.post("/api/chat/upload", files={"file": ("note.txt", b"private text", "text/plain")})
        assert response.status_code == 200
        file_id = response.json()["file_id"]
        assert owner.get(f"/api/chat/files/{file_id}").status_code == 200
    with make_client() as other:
        authenticate(other, second_email)
        assert other.get(f"/api/chat/files/{file_id}").status_code == 404
    with make_client() as anonymous:
        assert anonymous.get(f"/api/chat/files/{file_id}").status_code == 401


def test_retention_removes_old_chat_content_but_not_financial_journal():
    async def exercise():
        async with async_session() as db:
            user = User(email=f"retention-{uuid.uuid4().hex}@example.com", hashed_password=hash_password("test-password"))
            session = ChatSession(id=str(uuid.uuid4()), user_id=1, title="old", messages="[]", updated_at=datetime.now(timezone.utc) - timedelta(days=31))
            db.add(user); await db.flush(); session.user_id = user.id; db.add(session); await db.commit()
            session_id = session.id
            result = await cleanup_expired_history()
            assert result["sessions"] >= 1
            db.expire_all()
            assert await db.get(ChatSession, session_id) is None
    asyncio.run(exercise())

