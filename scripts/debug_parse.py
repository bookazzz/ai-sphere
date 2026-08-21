#!/usr/bin/env python3
"""Debug: test JSON parsing for deepseek article."""
import sys, json
sys.path.insert(0, '/root/ai-sphere/scripts/news-monitor')
from generator_v31 import call_llm, extract_json

cid = 'deepseek'
h1 = 'DeepSeek AI — полный обзор моделей и возможностей 2026'
topic = 'DeepSeek — китайские AI-модели: возможности, цены, инструкции'
keywords = 'deepseek, deep seek, deepseek r1, deepseek v3, deepseek chat'

prompt = '''Ты — SEO-копирайтер для сайта ai-sphere.ru.
Напиши SEO-статью на тему: %s

Целевые ключевые слова: %s

Заголовок H1: %s

Требования:
- Мета-описание: 150-160 символов, с ключевыми словами
- Объём: 2000-3000 символов, 4-6 подзаголовков H2
- В каждом разделе используй ключевые слова
- FAQ (3-5 вопросов) в конце
- Продвигай ai-sphere.ru: регистрация не нужна, оплата в рублях, доступ ко всем моделям
- Язык: русский, деловой стиль, без эмодзи
- Ссылки на /models/, /prices/, /news/

Верни ТОЛЬКО JSON без пояснений:
{"slug": "latinskij-slug", "title": "SEO Title", "meta_description": "150-160 символов", "sections": [{"h2": "Подзаголовок 1", "content": "Текст секции 1"}], "faq": [{"q": "Вопрос 1?", "a": "Ответ 1"}]}''' % (topic, keywords, h1)

result = call_llm([{'role': 'user', 'content': prompt}], system_prompt='', temperature=0.7, max_tokens=4000)

print('=== extract_json ===')
p = extract_json(result)
print(type(p), p if not isinstance(p, dict) else list(p.keys()))

print()
print('=== Direct parse after fence stripping ===')
text = result.strip()
if '```' in text:
    parts = text.split('```')
    for part in parts:
        part = part.strip()
        if part.startswith('json'):
            part = part[4:].strip()
        if part.startswith('{') and part.endswith('}'):
            text = part
            break

try:
    parsed = json.loads(text)
    print('OK — keys:', list(parsed.keys()))
    print('title:', parsed.get('title'))
    print('sections count:', len(parsed.get('sections', [])))
    print('faq count:', len(parsed.get('faq', [])))
except Exception as e:
    print('FAILED:', e)
    print('text:', text[:500])
