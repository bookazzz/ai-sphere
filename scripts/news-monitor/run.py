#!/usr/bin/env python3
"""News monitor — full pipeline:
1. Parse RSS feeds → get new articles (with proxy)
2. Extract facts in JSON (Step 1)
3. Write unique Russian article from facts (Step 2)
4. Save as .md to blog
"""
import json, os, sys, subprocess, datetime, tempfile, re, time
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
BLOG_DIR = os.path.join(PROJECT_ROOT, 'src', 'content', 'blog', 'news')
SEEN_FILE = os.path.join(PROJECT_ROOT, 'scripts', 'news-monitor', 'seen.json')
CONFIG_PATH = os.path.join(SCRIPT_DIR, 'config.json')

# ── Config with proxy and working sources ──

WORKING_SOURCES = {
    "the-decoder": {
        "name": "The Decoder", "url": "https://the-decoder.com/feed/",
        "type": "rss", "priority": 8
    },
    "techcrunch-ai": {
        "name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "type": "rss", "priority": 7
    },
    "venturebeat-ai": {
        "name": "VentureBeat AI", "url": "https://venturebeat.com/category/ai/feed/",
        "type": "rss", "priority": 7
    },
    "simon-willison": {
        "name": "Simon Willison", "url": "https://simonwillison.net/atom/entries/",
        "type": "atom", "priority": 6
    },
    "arxiv-cscl": {
        "name": "arXiv cs.CL", "url": "https://rss.arxiv.org/rss/cs.CL",
        "type": "rss", "priority": 8
    },
    "nvidia": {
        "name": "NVIDIA Developer", "url": "https://developer.nvidia.com/blog/feed/",
        "type": "rss", "priority": 7
    }
}

PROXY = "http://booka:ehnjbg@202.43.7.62:8456"

def fetch_url(url, timeout=8):
    p = urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY})
    opener = urllib.request.build_opener(p)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; AI-Sphere/1.0; +https://ai-sphere.ru)'})
    try:
        resp = opener.open(req, timeout=timeout)
        return resp.read()
    except:
        return None

def get_api_key():
    with open(os.path.expanduser('/root/ai-sphere/backend/.env')) as f:
        for line in f:
            if line.startswith('OPENROUTER_API_KEY=') and not line.startswith('#'):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return None

# ── Phase 1: Parse RSS ──

def parse_rss(xml_data):
    items = []
    try:
        root = ET.fromstring(xml_data)
        for item in root.iter('item'):
            e = {'title':'','link':'','description':''}
            for c in item:
                tag = c.tag.split('}')[-1]
                if tag == 'title' and c.text: e['title'] = c.text.strip()
                elif tag == 'link' and c.text: e['link'] = c.text.strip()
                elif tag == 'description' and c.text:
                    e['description'] = re.sub(r'<[^>]+>', '', c.text).strip()[:500]
            if e['link']: items.append(e)
    except: pass
    return items

def parse_atom(xml_data):
    items = []
    NS = {'atom': 'http://www.w3.org/2005/Atom'}
    try:
        root = ET.fromstring(xml_data)
        for entry in root.findall('atom:entry', NS):
            e = {'title':'','link':'','description':''}
            t = entry.find('atom:title', NS)
            if t is not None and t.text: e['title'] = t.text.strip()
            l = entry.find('atom:link', NS)
            if l is not None: e['link'] = l.get('href','')
            c = entry.find('atom:content', NS)
            if c is not None and c.text: e['description'] = re.sub(r'<[^>]+>','',c.text).strip()[:500]
            else:
                s = entry.find('atom:summary', NS)
                if s is not None and s.text: e['description'] = re.sub(r'<[^>]+>','',s.text).strip()[:500]
            if e['link']: items.append(e)
    except: pass
    return items

def is_ai_related(t, d):
    txt = f"{t} {d}".lower()
    kws = ['ai','llm','language model','gpt','claude','gemini','chatgpt',
           'openai','anthropic','deepmind','llama','mistral','neural network',
           'transformer','agent','multimodal','diffusion','generative','copilot',
           'nvidia','hugging face','machine learning','deep learning','model']
    return any(kw in txt for kw in kws)

import xml.etree.ElementTree as ET

def parse_sources():
    seen = {}
    if os.path.exists(SEEN_FILE):
        with open(SEEN_FILE) as f: seen = json.load(f)
    
    all_new = []
    for sid, sc in WORKING_SOURCES.items():
        sys.stdout.write(f"  [{sc['name']}] "); sys.stdout.flush()
        data = fetch_url(sc['url'])
        if not data: sys.stdout.write("SKIP\n"); sys.stdout.flush(); continue
        
        arts = parse_atom(data) if sc.get('type') == 'atom' else parse_rss(data)
        for a in arts:
            a['source_id'] = sid; a['source_name'] = sc['name']
            link = a.get('link','')
            if link and link not in seen and is_ai_related(a.get('title',''), a.get('description','')):
                all_new.append(a)
            if link and link not in seen:
                seen[link] = {'title': a.get('title',''), 'source': sid, 'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        
        sys.stdout.write(f"{len(arts)} items, {sum(1 for a in arts if a.get('link') and a['link'] in seen and is_ai_related(a.get('title',''), a.get('description','')))} new\n")
        sys.stdout.flush()
    
    with open(SEEN_FILE, 'w') as f: json.dump(seen, f, indent=2)
    all_new.sort(key=lambda a: -WORKING_SOURCES.get(a.get('source_id',''), {}).get('priority',5))
    return all_new[:3]

# ── Phase 2: Extract facts (Step 1) ──

def call_llm(messages, system, max_tok=4000, temp=0.7):
    """Call OpenRouter via proxy"""
    key = get_api_key()
    if not key: return json.dumps({"error": "no key"})
    
    p = urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY})
    opener = urllib.request.build_opener(p)
    
    payload = json.dumps({
        "model": "deepseek/deepseek-v4-flash",
        "messages": [{"role": "system", "content": system}] + [{"role": "user", "content": m} for m in messages],
        "max_tokens": max_tok, "temperature": temp, "top_p": 0.9,
        "frequency_penalty": 0.3, "presence_penalty": 0.2
    }).encode()
    
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions", data=payload,
        headers={'Content-Type':'application/json', 'Authorization':f'Bearer {key}', 'HTTP-Referer':'https://ai-sphere.ru'}
    )
    try:
        resp = opener.open(req, timeout=120)
        return json.loads(resp.read())['choices'][0]['message']['content']
    except Exception as e:
        return json.dumps({"error": str(e)})

EXTRACTOR_SYSTEM = """Ты — аналитик, который извлекает факты из новостей об AI. Твоя задача — прочитать исходный материал и выдать только проверяемые факты в JSON.

Извлекай:
- компания / продукт
- что произошло
- дата события
- характеристики (числа, параметры, размеры)
- цены (если есть)
- доступность (страны, платформы)
- ограничения
- цитаты (только ключевые)
- сравнения с конкурентами

Запрещено:
- добавлять информацию, которой нет в источнике
- делать предположения
- придумывать цифры
- оценивать или комментировать

Выдай строгий JSON:
{"facts": [{"entity": "название", "type": "company|product|feature|price|availability|date|comparison", "detail": "факт"}]}"""

EXTRACTOR_PROMPT = """Извлеки факты из этой статьи.

Заголовок: {title}
Содержание: {description}
Источник: {source_name} ({link})

Только JSON с фактами, без пояснений."""

# ── Phase 3: Write article from facts (Step 2) ──

WRITER_SYSTEM = """Ты — редактор русскоязычного издания о нейросетях, AI и технологиях.

Твоя задача — создавать самостоятельные русскоязычные новостные материалы на основе фактов.

Ты не переводчик. Не переводи исходный текст и не делай поверхностный рерайт.

## Основной принцип
У тебя есть только JSON с фактами. Ты НЕ видишь исходную статью. Используй только эти факты для написания.

## Требования к статье
1. Сразу сообщай главное событие
2. Объясняй простым языком
3. Давай практическое понимание
4. Содержи конкретные характеристики, цифры, даты
5. Добавляй контекст для русскоязычной аудитории
6. Отделяй факты от предположений
7. Нейтральный информационный стиль
8. Без канцелярита, воды и повторов
9. Без кликбейта
10. Не выглядеть как машинный перевод

## Запрещено
- Дословно переводить
- Придумывать факты, цены, функции, даты
- Писать о доступности в РФ, если не подтверждено
- Придумывать результаты тестов
- Выдавать слухи за факты
- Копировать композицию исходного материала

## Структура
- Заголовок: до 90 символов, с названием компании/продукта и главным событием
- Краткий анонс: 2 предложения, суть
- Основной текст: что произошло → характеристики → чем отличается → кому полезно → цена/доступность → вывод
- Вывод: 1 абзац, практическое значение
- Источники: URL всех источников

## SEO
- SEO title: до 60 символов
- Meta description: 130-160 символов
- Slug: латиница, без даты, макс 60 символов

Выводи только готовую статью. Не показывай анализ и промежуточные шаги."""

WRITER_PROMPT = """Напиши новость для русскоязычного сайта об искусственном интеллекте на основе фактов ниже.

Факты:
{facts_json}

Источники:
- {source_name}: {link}

Требования:
- Не переводи исходную статью (ты её не видишь)
- Начни с главного события
- Измени композицию относительно того, как факты расположены в JSON
- Объясни технические детали понятно
- Добавь практическое значение
- Не придумывай доступность в России
- Не используй рекламные формулировки

Формат ответа — ТОЛЬКО JSON:
{{
  "title": "заголовок до 90 символов",
  "slug": "transliterated-slug-60-symbols",
  "h1": "H1 заголовок",
  "seo_title": "SEO title до 60 символов",
  "meta_description": "Meta description 130-160 символов",
  "announce": "Краткий анонс из 2 предложений",
  "content": "полный текст статьи в Markdown",
  "conclusion": "вывод 1 абзац",
  "source_name": "{source_name}",
  "source_link": "{link}"
}}"""

# ── Main ──

def main():
    print("=== News Monitor ===")
    
    # Phase 1: Parse RSS
    print("\n[Phase 1] Parsing RSS feeds...")
    new_articles = parse_sources()
    print(f"New AI articles: {len(new_articles)}")
    
    if not new_articles:
        print("No new articles. Done.")
        return
    
    for a in new_articles:
        print(f"  - {a.get('title','')[:70]}")
    
    # Phase 2-3: For each article
    for art in new_articles:
        print(f"\n[Phase 2-3] Processing: {art['title'][:60]}...")
        
        # Step 1: Extract facts
        print("  Extracting facts...")
        facts_raw = call_llm(
            [EXTRACTOR_PROMPT.format(**art)], 
            EXTRACTOR_SYSTEM, 
            max_tok=2000, temp=0.4
        )
        try:
            facts_data = json.loads(facts_raw)
            facts_json = json.dumps(facts_data, ensure_ascii=False)
        except:
            print(f"  Failed to parse facts: {facts_raw[:100]}")
            continue
        
        # Count facts
        n_facts = len(facts_data.get('facts', []))
        print(f"  Extracted {n_facts} facts")
        
        # Step 2: Write article
        print("  Writing article...")
        art_raw = call_llm(
            [WRITER_PROMPT.format(facts_json=facts_json, **art)], 
            WRITER_SYSTEM, 
            max_tok=4000, temp=0.7
        )
        
        try:
            article = json.loads(art_raw)
        except:
            # Try to extract JSON
            m = re.search(r'\{[^{}]*\}', art_raw, re.DOTALL)
            if m:
                try: article = json.loads(m.group(0))
                except: article = {"error": f"parse: {art_raw[:200]}"}
            else:
                article = {"error": f"nojson: {art_raw[:200]}"}
        
        if 'error' in article:
            print(f"  FAILED: {article['error'][:100]}")
            continue
        
        # Save as .md
        slug = article.get('slug', '')
        if not slug:
            print("  No slug, skipping")
            continue
        
        filepath = os.path.join(BLOG_DIR, f"{slug}.md")
        if os.path.exists(filepath):
            print(f"  Already exists: {slug}.md")
            continue
        
        today = datetime.date.today().strftime('%Y-%m-%d')
        content = article.get('content', '')
        announce = article.get('announce', '')
        conclusion = article.get('conclusion', '')
        
        # Add CTA block
        cta = f"""
---
*Источник: [{article.get('source_name', '')}]({article.get('source_link', '')})*
*Дата: {today}*

**Хотите попробовать AI-модели из новости?** В [AI-Sphere](https://ai-sphere.ru) собраны десятки моделей — ChatGPT, Claude, Gemini, DeepSeek, Mistral и другие. Оплата в рублях, без VPN и подписок."""
        
        md = f"""---
title: "{article['title']}"
slug: {slug}
category: news
description: "{article.get('meta_description', article['title'][:150])}"
date: {today}
author: "AI-Sphere News"
status: ready
index: true
---

# {article.get('h1', article['title'])}

{announce}

{content}

{conclusion}

{cta}
"""
        
        os.makedirs(BLOG_DIR, exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md)
        
        print(f"  ✅ Published: {slug}.md")
    
    # Build
    print("\n[Phase 4] Building...")
    r = subprocess.run(['npm', 'run', 'build'], cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=300)
    if r.returncode == 0:
        print("  ✅ Build OK")
    else:
        print(f"  Build FAILED: {r.stdout[-300:]}" if r.stdout else "") 

if __name__ == '__main__':
    main()
