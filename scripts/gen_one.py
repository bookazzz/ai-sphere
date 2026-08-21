#!/usr/bin/env python3
"""Generate a single SEO article from cluster data. Usage: python3 gen_one.py <cluster_id>"""
import json, os, sys
from datetime import datetime
from pathlib import Path

ROOT = '/root/ai-sphere'
OUT_DIR = os.path.join(ROOT, 'src', 'content', 'blog', 'guides')
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'news-monitor'))
from generator_v31 import call_llm

CLUSTER_DEFS = {
    'chatgpt-openai': {
        'h1': 'ChatGPT в России — полный гайд по моделям OpenAI 2026',
        'topic': 'ChatGPT и OpenAI: возможности, модели, инструкции',
        'keywords': ['chatgpt', 'gpt-4o', 'openai', 'chatgpt в россии', 'gpt чат', 'chatgpt модели'],
    },
    'ru-access': {
        'h1': 'ChatGPT в России без VPN — полный гайд 2026',
        'topic': 'Как пользоваться ChatGPT и AI-моделями в России без VPN',
        'keywords': ['chatgpt без впн', 'chatgpt в россии', 'ai без vpn', 'нейросети в россии', 'chatgpt россия'],
    },
    'image-generation': {
        'h1': 'Нейросети для генерации изображений — обзор лучших в 2026',
        'topic': 'Нейросети для генерации изображений: обзор и сравнение моделей',
        'keywords': ['нейросеть для генерации изображений', 'midjourney', 'dall-e', 'image generation ai', 'генерация картинок'],
    },
    'document-processing': {
        'h1': 'Нейросеть для работы с документами — PDF, Excel, Word 2026',
        'topic': 'AI для работы с документами: PDF, Excel, Word, анализ текстов',
        'keywords': ['ai для pdf', 'нейросеть для документов', 'анализ pdf нейросетью', 'ии для excel', 'перевод документов'],
    },
    'coding': {
        'h1': 'AI для программирования — лучшие нейросети для кода 2026',
        'topic': 'AI для программирования: написание кода, деплой, разработка',
        'keywords': ['ai для кода', 'нейросеть для программирования', 'coding ai', 'ai-assisted programming', 'нейросеть код'],
    },
    'pricing': {
        'h1': 'Сколько стоят нейросети — цены на AI-модели 2026',
        'topic': 'Цены на AI-модели: тарифы, подписки, бесплатные варианты',
        'keywords': ['цена chatgpt', 'стоимость нейросетей', 'ai pricing', 'бесплатные нейросети', 'тарифы ai'],
    },
    'comparisons': {
        'h1': 'Какая нейросеть лучше — сравнение AI-моделей 2026',
        'topic': 'Сравнение AI-моделей: ChatGPT vs Claude vs Gemini vs DeepSeek',
        'keywords': ['chatgpt vs claude', 'сравнение нейросетей', 'какая нейросеть лучше', 'gpt или deepseek', 'сравнение ai моделей'],
    },
    'deepseek': {
        'h1': 'DeepSeek AI — полный обзор моделей и возможностей 2026',
        'topic': 'DeepSeek — китайские AI-модели: возможности, цены, инструкции',
        'keywords': ['deepseek', 'deep seek', 'deepseek r1', 'deepseek v3', 'deepseek chat'],
    },
    'claude-anthropic': {
        'h1': 'Claude AI — полный гайд по моделям Anthropic 2026',
        'topic': 'Claude от Anthropic: модели, возможности, как пользоваться',
        'keywords': ['claude ai', 'anthropic claude', 'claude chat', 'claude в россии', 'claude sonnet'],
    },
    'google-gemini': {
        'h1': 'Google Gemini — обзор моделей и возможностей 2026',
        'topic': 'Google Gemini: модели, мультимодальность, инструкции',
        'keywords': ['gemini', 'google gemini', 'gemini ai', 'gemini google', 'gemini модель'],
    },
}

PROMPT_HEAD = """Ты — SEO-копирайтер для сайта ai-sphere.ru.
Напиши SEO-статью на тему: {topic}

Целевые ключевые слова: {keywords}

Заголовок H1: {h1}

Требования:
- Мета-описание: 150-160 символов, с ключевыми словами
- Объём: 2000-3000 символов, 4-6 подзаголовков H2
- В каждом разделе используй ключевые слова
- FAQ (3-5 вопросов) в конце
- Продвигай ai-sphere.ru: регистрация не нужна, оплата в рублях, доступ ко всем моделям
- Язык: русский, деловой стиль, без эмодзи
- Ссылки на /models/, /prices/, /news/
"""

PROMPT_FORMAT = """
Верни ТОЛЬКО JSON без пояснений:
{"slug": "latinskij-slug", "title": "SEO Title", "meta_description": "150-160 символов", "sections": [{"h2": "Подзаголовок 1", "content": "Текст секции 1"}, {"h2": "Подзаголовок 2", "content": "Текст секции 2"}], "faq": [{"q": "Вопрос 1?", "a": "Ответ 1"}, {"q": "Вопрос 2?", "a": "Ответ 2"}]}
"""

def generate(cid):
    cdef = CLUSTER_DEFS[cid]
    print(f'[{cid}] Generating...', flush=True)
    
    prompt = PROMPT_HEAD.format(
        h1=cdef['h1'],
        topic=cdef['topic'],
        keywords=', '.join(cdef['keywords']),
    )
    prompt += PROMPT_FORMAT
    
    result = call_llm(
        [{'role': 'user', 'content': prompt}],
        system_prompt='',
        temperature=0.7,
        max_tokens=4000,
    )
    
    if result is None:
        print(f'[{cid}] ERROR: LLM returned None', flush=True)
        return
    if isinstance(result, dict) and 'error' in result:
        print(f'[{cid}] ERROR: {result["error"]}', flush=True)
        return
    
    raw_text = result if isinstance(result, str) else str(result)
    
    # Parse JSON from LLM response
    def parse_llm_json(text):
        if not text:
            return None
        t = text.strip()
        # Remove markdown fences if present
        for fence in ['```json', '```']:
            if fence in t:
                parts = t.split(fence)
                for p in parts:
                    p = p.strip()
                    if p.startswith('{'):
                        t = p
                        break
        # Extract outermost JSON object
        start = t.find('{')
        end = t.rfind('}')
        if start < 0 or end <= start:
            return None
        t = t[start:end+1]
        try:
            return json.loads(t)
        except json.JSONDecodeError as e:
            print(f'    JSON decode error: {e}', flush=True)
            return None
    
    parsed = parse_llm_json(raw_text)
    if not parsed:
        print(f'[{cid}] ERROR: JSON parsing failed', flush=True)
        print(f'  Raw: {raw_text[:500]}', flush=True)
        return
    if not isinstance(parsed, dict) or 'sections' not in parsed:
        print(f'[{cid}] WARNING: missing sections key, keys={list(parsed.keys()) if isinstance(parsed, dict) else type(parsed)}', flush=True)
        parsed = {'slug': cid, 'title': cid, 'meta_description': '', 'sections': [], 'faq': []}
    
    slug = parsed.get('slug', cid)
    title = parsed.get('title', cid) or cid
    meta = parsed.get('meta_description', '') or ''
    sections = parsed.get('sections', []) or []
    faq = parsed.get('faq', []) or []
    
    # If sections is a string (double-encoded), parse it
    if isinstance(sections, str):
        try:
            sections = json.loads(sections)
        except:
            sections = []
    if isinstance(faq, str):
        try:
            faq = json.loads(faq)
        except:
            faq = []
    
    os.makedirs(OUT_DIR, exist_ok=True)
    tags = [cid] + cdef['keywords'][:3]
    tag_str = ', '.join(f'"{t}"' for t in tags)
    
    lines = [
        '---',
        f'slug: "{slug}"',
        f'title: "{title}"',
        f'description: "{meta}"',
        f'date: "{datetime.utcnow().strftime("%Y-%m-%d")}"',
        'author: "AI-Sphere"',
        'category: "guides"',
        f'tags: [{tag_str}]',
        'status: "ready"',
        'index: true',
        '---',
        '',
    ]
    for sec in sections:
        h2 = sec.get('h2', '') if isinstance(sec, dict) else ''
        content = sec.get('content', '') if isinstance(sec, dict) else str(sec)
        lines.append(f'## {h2}')
        lines.append('')
        lines.append(content)
        lines.append('')
    if faq:
        lines.append('## Часто задаваемые вопросы')
        lines.append('')
        for item in faq:
            q = item.get('q', '') if isinstance(item, dict) else ''
            a = item.get('a', '') if isinstance(item, dict) else str(item)
            lines.append(f'### {q}')
            lines.append('')
            lines.append(a)
            lines.append('')
    
    fpath = os.path.join(OUT_DIR, f'{slug}.md')
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'[{cid}] Saved: {fpath}', flush=True)

if __name__ == '__main__':
    cid = sys.argv[1] if len(sys.argv) > 1 else 'chatgpt-openai'
    generate(cid)
