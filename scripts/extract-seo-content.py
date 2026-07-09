#!/usr/bin/env python3
"""Извлекает контент из существующих SEO page.tsx и генерирует content/seo/{type}/{slug}.ts"""
import re, os, json

SRC = '/root/ai-sphere/src/app'
DST = '/root/ai-sphere/src/content/seo'

PAGE_TYPES = {
    'chat-gpt-online': 'models', 'deepseek-chat': 'models', 'gpt-4-chat': 'models',
    'midjourney-nejroset': 'models', 'kandinsky-nejroset': 'models',
    'stable-diffusion': 'models', 'dalle-nejroset': 'models',
    'generaciya-izobrazhenij': 'tools', 'nejroset-perevodchik': 'tools',
    'prezentaciya-nejroset': 'tools', 'ozvuchka-teksta-nejroset': 'tools',
    'nejroset-video': 'tools', 'nejroset-muzyka': 'tools',
    'nejroset-risovanie': 'tools', 'nejroset-foto-obrabotka': 'tools',
    'nejroset-oboji': 'tools', 'logo-nejroset': 'tools',
    'nejroset-dlya-teksta': 'use-cases', 'sochinenie-nejroset': 'use-cases',
    'nejroset-dlya-koda': 'use-cases', 'voprosy-nejroseti': 'use-cases',
    'nejroset-online': 'use-cases', 'nejroset-kalkulyator': 'use-cases',
    'nejroset-sozdat': 'use-cases', 'nejroset-yandex-alisa': 'use-cases',
    'gpt-besplatno': 'use-cases',
    'chat-gpt-rossiya': 'guides', 'vpn-dlya-nejrosetej': 'guides',
    'chatgpt-skachat': 'guides', 'chatgpt-rasshirenie': 'guides',
    'nejroset-telegram-bot': 'guides', 'nejroset-novosti': 'guides',
    'rossijskie-nejroseti': 'comparisons', 'reajt-nejroset': 'comparisons',
    'generator-nejroset': 'comparisons',
}

def j(data):
    """json.dumps with unicode support"""
    return json.dumps(data, ensure_ascii=False)

def parse_file(path):
    with open(path) as f:
        return f.read()

def extract_hero(text):
    h1 = re.search(r'<h1[^>]*>([^<]+)</h1>', text)
    sub = re.search(r'className="seo-hero__subtitle"[^>]*>([^<]+)</p>', text)
    return (h1.group(1).strip() if h1 else "", sub.group(1).strip() if sub else "")

def extract_sections(text):
    sections = []
    for m in re.finditer(r'<h2[^>]*className="seo-section__title"[^>]*>(.+?)</h2>\s*<p[^>]*className="seo-section__text"[^>]*>(.+?)</p>', text, re.DOTALL):
        sections.append({"title": m.group(1).strip(), "text": m.group(2).strip()})
    return sections

def extract_faq(text):
    faq = []
    for m in re.finditer(r'<h3[^>]*className="seo-faq__question"[^>]*>(.+?)</h3>.*?<p[^>]*itemProp="text"[^>]*>(.+?)</p>', text, re.DOTALL):
        faq.append({"question": m.group(1).strip(), "answer": m.group(2).strip()})
    return faq

def extract_cta(text):
    btn = "Попробовать сейчас"
    link = "/"
    cta_text = "Зарегистрируйтесь и получите 10 бесплатных запросов. Без VPN, без привязки карты, с оплатой в рублях."
    m = re.search(r'<p[^>]*className="seo-cta__text"[^>]*>(.+?)</p>', text)
    if m: cta_text = m.group(1).strip()
    m = re.search(r'<a[^>]*href="([^"]+)"[^>]*className="btn[^"]*"[^>]*>(.+?)</a>', text)
    if m: link, btn = m.group(1).strip(), m.group(2).strip()
    return btn, link, cta_text

def extract_related(text):
    return {m.group(1).strip(): m.group(2).strip() for m in re.finditer(r'<Link\s+href="/([^"]+)"[^>]*>([^<]+)</Link>', text)}

def extract_desc(text):
    m = re.search(r'"description":\s*"([^"]+)"', text)
    return m.group(1).strip() if m else ""

def make_content(slug, page_type, title, subtitle, desc, sections, faq, btn, link, cta_text, related):
    var = slug.replace('-', '_')
    type_map = {'models': 'model', 'tools': 'tool', 'use-cases': 'use-case', 'guides': 'guide', 'comparisons': 'comparison'}
    seo_type = type_map.get(page_type, 'guide')

    sec_js = ",\n    ".join(f'  {{ title: {j(s["title"])}, text: {j(s["text"])} }}' for s in sections)
    faq_js = ",\n    ".join(f'  {{ question: {j(f["question"])}, answer: {j(f["answer"])} }}' for f in faq)
    rel_js = ",\n    ".join(f'  "{s}": {j(l)}' for s, l in related.items())

    return f"""import {{ SeoPageContent }} from '@/types/seo-page';

export const {var}: SeoPageContent = {{
  slug: {j(slug)},
  type: {j(seo_type)},
  title: {j(title)},
  description: {j(desc)},
  subtitle: {j(subtitle)},
  sections: [
    {sec_js}
  ],
  faq: [
    {faq_js}
  ],
  cta: {j(btn)},
  ctaLink: {j(link)},
  ctaText: {j(cta_text)},
  related: {{
    {rel_js}
  }},
}};
"""

def main():
    for slug, page_type in PAGE_TYPES.items():
        src = os.path.join(SRC, slug, 'page.tsx')
        if not os.path.exists(src):
            print(f"SKIP {slug}: file not found")
            continue
        text = parse_file(src)
        title, subtitle = extract_hero(text)
        if not title:
            print(f"SKIP {slug}: no h1")
            continue
        desc = extract_desc(text)
        sections = extract_sections(text)
        faq = extract_faq(text)
        btn, link, cta_text = extract_cta(text)
        related = extract_related(text)

        out_dir = os.path.join(DST, page_type)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f'{slug}.ts')
        with open(out_path, 'w') as f:
            f.write(make_content(slug, page_type, title, subtitle, desc, sections, faq, btn, link, cta_text, related))
        print(f"OK {slug} ({page_type}) — sec:{len(sections)} faq:{len(faq)} rel:{len(related)}")

if __name__ == '__main__':
    main()
    print("Done!")
