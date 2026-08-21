#!/usr/bin/env python3
"""Create SEO pages for static routes."""
import urllib.request
import urllib.parse
import json
import sys

TOKEN = sys.argv[1] if len(sys.argv) > 1 else ""

pages = [
    ("", "Главная - AI-Sphere", "static"),
    ("prices", "Тарифы - AI-Sphere", "prices"),
    ("models", "Модели ИИ - AI-Sphere", "models"),
    ("security", "Безопасность - AI-Sphere", "security"),
    ("faq", "FAQ - AI-Sphere", "faq"),
    ("about", "О проекте - AI-Sphere", "about"),
    ("contacts", "Контакты - AI-Sphere", "contacts"),
    ("privacy", "Политика конфиденциальности - AI-Sphere", "legal"),
    ("offer", "Публичная оферта - AI-Sphere", "legal"),
]

headers = {"Authorization": f"Bearer {TOKEN}"}

for slug, title, page_type in pages:
    try:
        params = urllib.parse.urlencode({
            "slug": slug, "title": title,
            "page_type": page_type, "status": "published",
            "meta_title": title,
        })
        url = f"http://127.0.0.1:8080/api/admin/seo-pages?{params}"
        req = urllib.request.Request(url, method="POST", headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            print(f"OK: {slug} -> id={data.get('id')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "уже существует" in body:
            print(f"EXISTS: {slug}")
        else:
            print(f"ERR: {slug} -> {e.code}: {body[:120]}")
    except Exception as e:
        print(f"FAIL: {slug} -> {e}")
