#!/usr/bin/env python3
"""Fix JSON and save deepseek article."""
import sys, json
sys.path.insert(0, '/root/ai-sphere/scripts/news-monitor')
from generator_v31 import call_llm

prompt = 'Напиши SEO-статью про DeepSeek AI (2000-3000 символов, 4-6 H2, FAQ). Верни ТОЛЬКО JSON: {"slug":"deepseek-ai","title":"DeepSeek AI","meta_description":"...","sections":[{"h2":"...","content":"..."}],"faq":[{"q":"...","a":"..."}]}'

result = call_llm([{'role': 'user', 'content': prompt}], system_prompt='', temperature=0.7, max_tokens=4000)

if isinstance(result, dict) and 'error' in result:
    print('ERROR:', result['error'])
    sys.exit(1)

t = result.strip()
s = t.find('{')
e = t.rfind('}') + 1
if s < 0 or e <= s:
    print('No JSON found')
    sys.exit(1)

segment = t[s:e]

# Clean common LLM JSON issues
import re
# Fix trailing commas before } or ]
segment = re.sub(r',\s*([}\]])', r'\1', segment)

try:
    data = json.loads(segment)
    print('Parse OK:', list(data.keys()))
except Exception as ex:
    print('Parse failed:', ex)
    # Show problem area
    problem_pos = 645
    print('Around problem:', repr(segment[problem_pos-50:problem_pos+50]))
    sys.exit(1)

slug = data.get('slug', 'deepseek-ai')
title = data.get('title', 'DeepSeek AI')
meta = data.get('meta_description', '')
sections = data.get('sections', []) or []
faq = data.get('faq', []) or []

if isinstance(sections, str):
    sections = json.loads(sections)
if isinstance(faq, str):
    faq = json.loads(faq)

lines = [
    '---',
    'slug: "%s"' % slug,
    'title: "%s"' % title,
    'description: "%s"' % meta,
    'datePublished: "2026-07-28T20:30:00Z"',
    'author: "AI-Sphere"',
    'category: "guides"',
    'tags: ["deepseek", "deepseek r1", "deepseek v3"]',
    'status: "ready"',
    'index: true',
    '---',
    '',
]
for sec in (sections or []):
    if isinstance(sec, dict):
        lines.append('## %s' % sec.get('h2', ''))
        lines.append('')
        lines.append(sec.get('content', ''))
        lines.append('')
if faq:
    lines.append('## Часто задаваемые вопросы')
    lines.append('')
    for item in faq:
        if isinstance(item, dict):
            lines.append('### %s' % item.get('q', ''))
            lines.append('')
            lines.append(item.get('a', ''))
            lines.append('')

content = '\n'.join(lines)
fpath = '/root/ai-sphere/src/content/blog/guides/%s.md' % slug
with open(fpath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Saved: %s (%d chars)' % (fpath, len(content)))
