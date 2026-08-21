#!/usr/bin/env python3
"""Generate Russian news article — unique rewrite, not translation"""
import json
import os
import re
import sys
import urllib.request
import datetime

def get_config():
    """Read API key and proxy from backend .env"""
    config = {'key': None, 'proxy': None}
    env_path = os.path.expanduser('/root/ai-sphere/backend/.env')
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith('OPENROUTER_API_KEY=') and not line.startswith('#'):
                config['key'] = line.split('=', 1)[1].strip().strip('"').strip("'")
            elif line.startswith('OPENROUTER_PROXY=') and not line.startswith('#'):
                config['proxy'] = line.split('=', 1)[1].strip().strip('"').strip("'")
    return config

def call_llm(prompt, system_prompt):
    """Call OpenRouter API via proxy"""
    cfg = get_config()
    key = cfg['key']
    if not key:
        return json.dumps({"error": "No API key"})
    
    payload = json.dumps({
        "model": "deepseek/deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 4000,
        "temperature": 0.7
    }).encode('utf-8')
    
    # Setup proxy if available
    if cfg['proxy']:
        proxy_h = urllib.request.ProxyHandler({
            'http': cfg['proxy'],
            'https': cfg['proxy'],
        })
        opener = urllib.request.build_opener(proxy_h)
        urllib.request.install_opener(opener)
    
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
            'HTTP-Referer': 'https://ai-sphere.ru',
        }
    )
    
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        data = json.loads(resp.read())
        return data['choices'][0]['message']['content']
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:500]
        return json.dumps({"error": f"HTTP {e.code}: {body}"})
    except Exception as e:
        return json.dumps({"error": str(e)})

def generate_article(source_article):
    """Generate unique Russian article"""
    title = source_article.get('title', '')
    description = source_article.get('description', '')[:1000]
    source_name = source_article.get('source_name', '')
    source_link = source_article.get('link', '')
    
    prompt = f"""Ты — русскоязычный редактор AI-новостей для сайта AI-Sphere (ai-sphere.ru). Напиши УНИКАЛЬНУЮ статью, используя ТОЛЬКО ФАКТЫ из источника.

⚠️ КЛЮЧЕВОЕ ПРАВИЛО: Это НЕ перевод. Это полностью оригинальный текст.
- Возьми факты, но изложи их полностью иначе
- Не переводи предложения — перескажи смысл
- Добавь контекст для российской аудитории
- Напиши живым языком тех-блогера
- Google считает дословный перевод спам-контентом

Факты источника:
- Откуда: {source_name}
- Заголовок: {title}
- Суть: {description}
- Оригинал: {source_link}

Структура статьи (Markdown):
1. H1: цепляющий заголовок для РФ (не копируй оригинал)
2. Абзац "Кратко": 2-3 предложения
3. Абзац "Что произошло": детали
4. Характеристики (если есть факты)
5. Цены / доступность (если есть)
6. Для России: можно ли использовать, есть ли аналоги
7. Блок "AI-Sphere": 1-2 предложения CTA (в AI-Sphere можно получить доступ к моделям, платить рублями, без VPN)
8. "Наш вывод": 1 абзац

Технически:
- slug: транслит, макс 60 символов, латиница + дефисы
- description: SEO meta, 50-160 символов
- content: Markdown, 800-2000 слов
- НИКАКИХ эмодзи в тексте
- Только JSON в ответе:
{{{{
  "title": "заголовок",
  "slug": "transliterated-slug",  
  "h1": "H1 заголовок",
  "description": "meta description",
  "content": "весь текст в markdown",
  "source_name": "{source_name}",
  "source_link": "{source_link}"
}}}}"""
    
    system = """Ты — редактор AI-новостей. Правила:
1. НЕ переводить — создавать УНИКАЛЬНЫЙ контент на основе фактов
2. Писать как российский тех-блогер, а не как корпоративный журнал
3. Добавлять практическую пользу: как это применить, сколько стоит, работает ли в РФ
4. Не начинать с "Компания X объявила" — ищи живой заход
5. Каждый абзац должен нести новую информацию
6. В CTA блоке — мягко, 1-2 предложения, не навязчиво"""
    
    result = call_llm(prompt, system)
    
    # Try extract JSON from response
    json_match = re.search(r'\{[^{}]*\}', result, re.DOTALL)
    if json_match:
        result = json_match.group(0)
    
    # Try to parse
    try:
        return json.loads(result)
    except:
        return {"error": f"Failed to parse LLM output: {result[:200]}"}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        input_data = sys.stdin.read()
    else:
        with open(sys.argv[1]) as f:
            input_data = f.read()
    
    try:
        articles = json.loads(input_data)
    except:
        articles = [json.loads(input_data)]
    
    if not isinstance(articles, list):
        articles = [articles]
    
    results = []
    for art in articles:
        print(f"Generating: {art.get('title', '')[:60]}...", file=sys.stderr)
        result = generate_article(art)
        results.append(result)
        if 'error' in result:
            print(f"  ERROR: {result['error'][:100]}", file=sys.stderr)
        else:
            print(f"  OK: {result.get('slug', '?')}", file=sys.stderr)
    
    print(json.dumps(results, ensure_ascii=False, indent=2))
