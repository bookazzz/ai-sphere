#!/usr/bin/env python3
"""Generate SEO blog articles from keywords_multidim.xlsx clusters."""
import json, os, sys
from datetime import datetime
from pathlib import Path

ROOT = '/root/ai-sphere'
OUT_DIR = os.path.join(ROOT, 'src', 'content', 'blog', 'guides')

# Import LLM from project
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'news-monitor'))
from generator_v31 import call_llm, extract_json

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

PROMPT_TEMPLATE = """Ты — SEO-копирайтер для сайта ai-sphere.ru (агрегатор AI-моделей для России).
Напиши SEO-статью на тему: {topic}

Целевые ключевые слова: {keywords}

Заголовок H1: {h1}

Требования к статье:
- Мета-описание: 150-160 символов, включает ключевые слова
- Объём: 2000-3000 символов, 4-6 подзаголовков H2
- В каждом разделе естественно используй целевые ключевые слова
- Добавь раздел FAQ (3-5 вопросов) в конце
- Продвигай ai-sphere.ru: регистрация не нужна, оплата в рублях, доступ к ChatGPT, Claude, DeepSeek, Gemini и другим
- Язык: русский, деловой стиль, без эмодзи
- Ссылки на страницы сайта: /models/, /prices/, /news/
- Без воды, без общих фраз, без «в современном мире»

Формат ответа — строгий JSON (без пояснений):
{{
  "slug": "latinskij-slug-s-defisami",
  "title": "SEO Title (до 60 символов)",
  "meta_description": "150-160 символов meta description",
  "sections": [
    {{"h2": "Подзаголовок 1", "content": "Текст секции, 2-3 абзаца"}},
    {{"h2": "Подзаголовок 2", "content": "Текст секции, 2-3 абзаца"}}
  ],
  "faq": [
    {{"q": "Вопрос?", "a": "Развёрнутый ответ"}},
    {{"q": "Вопрос 2?", "a": "Развёрнутый ответ"}}
  ]
}}
"""

def generate_article(cluster_id, cdef):
    print(f'  [{cluster_id}] Calling LLM...', flush=True)
    prompt = PROMPT_TEMPLATE.format(
        h1=cdef['h1'],
        topic=cdef['topic'],
        keywords=', '.join(cdef['keywords']),
    )
    system = 'Ты — SEO-копирайтер. Отвечаешь только JSON, без пояснений и markdown-разметки.'
    
    result = call_llm(
        [{'role': 'user', 'content': prompt}],
        system_prompt=system,
        temperature=0.7,
        max_tokens=4000,
    )
    
    if result is None:
        print('  ERROR: LLM returned None', flush=True)
        return None
    
    if isinstance(result, dict) and 'error' in result:
        print(f'  ERROR: {result["error"]}', flush=True)
        return None
    
    try:
        parsed = extract_json(result)
        if not parsed:
            print(f'  extract_json returned None', flush=True)
            print(f'  Response: {result[:300]}', flush=True)
            return None
        data = parsed
    except Exception as e:
        print(f'  JSON parse error: {e}', flush=True)
        print(f'  Response: {result[:200]}', flush=True)
        return None
    
    return data

def save_article(cid, data):
    slug = data.get('slug', cid)
    title = data.get('title', cid)
    meta_desc = data.get('meta_description', '')
    sections = data.get('sections', [])
    faq = data.get('faq', [])
    
    tags = [cid] + [w for kw in CLUSTER_DEFS[cid]['keywords'][:3] for w in [kw.split()[0]]]
    tag_str = ', '.join(f'"{t}"' for t in tags if t)
    
    lines = [
        '---',
        f'slug: "{slug}"',
        f'title: "{title}"',
        f'description: "{meta_desc}"',
        f'datePublished: "{datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}"',
        'author: "AI-Sphere"',
        'category: "guides"',
        f'tags: [{tag_str}]',
        'status: "ready"',
        'index: true',
        '---',
        '',
    ]
    
    for sec in sections:
        lines.append(f'## {sec["h2"]}')
        lines.append('')
        lines.append(sec['content'])
        lines.append('')
    
    if faq:
        lines.append('## Часто задаваемые вопросы')
        lines.append('')
        for item in faq:
            lines.append(f'### {item["q"]}')
            lines.append('')
            lines.append(item['a'])
            lines.append('')
    
    content = '\n'.join(lines)
    fpath = os.path.join(OUT_DIR, f'{slug}.md')
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'  Saved: {fpath} ({len(content)} chars)', flush=True)
    return fpath

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    
    total = len(CLUSTER_DEFS)
    for i, (cid, cdef) in enumerate(CLUSTER_DEFS.items(), 1):
        print(f'\n[{i}/{total}] {cid}...', flush=True)
        data = generate_article(cid, cdef)
        if data:
            save_article(cid, data)
        else:
            print(f'  FAILED: {cid}', flush=True)
    
    print(f'\nDone! Generated in {OUT_DIR}', flush=True)

if __name__ == '__main__':
    main()
