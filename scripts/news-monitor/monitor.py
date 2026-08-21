#!/usr/bin/env python3
"""
AI-Sphere News Monitor — v3.1 pipeline integration.
Fetches RSS, runs 7-stage pipeline, deploys.
"""

import json
import os
import re
import sys
import time
import datetime
import subprocess
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import socket
socket.setdefaulttimeout(15)

# Paths
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ENV_PATH = os.path.join(ROOT, 'backend', '.env')
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')
SEEN_PATH = os.path.join(os.path.dirname(__file__), 'seen.json')
OUTPUT_DIR = os.path.join(ROOT, 'src', 'content', 'news')
DEPLOY_SCRIPT = os.path.expanduser('/root/.hermes/scripts/deploy-ai-sphere.sh')

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Import v3.1 pipeline
sys.path.insert(0, os.path.dirname(__file__))
from generator_v31 import (
    stage1_keyword_classification,
    stage2_semantic_clustering,
    stage3_seo_brief,
    stage4_research_fact_check,
    stage5_content_writing,
    stage6_quality_gate,
)


def load_config():
    cfg = {'key': None, 'proxy': None}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if line.startswith('OPENROUTER_API_KEY='):
                    cfg['key'] = line.split('=', 1)[1].strip().strip('"').strip("'")
                elif line.startswith('OPENROUTER_PROXY='):
                    cfg['proxy'] = line.split('=', 1)[1].strip().strip('"').strip("'")
    return cfg


def load_sources():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def load_seen():
    if os.path.exists(SEEN_PATH):
        with open(SEEN_PATH) as f:
            return json.load(f)
    return {}


def save_seen(seen):
    with open(SEEN_PATH, 'w') as f:
        json.dump(seen, f, indent=2, ensure_ascii=False)


def fetch_rss(url, proxy=None, timeout=15):
    try:
        if proxy:
            proxy_h = urllib.request.ProxyHandler({
                'http': proxy,
                'https': proxy,
            })
            opener = urllib.request.build_opener(proxy_h)
            urllib.request.install_opener(opener)
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; AI-Sphere/1.0; +https://ai-sphere.ru)'
        })
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read()
    except Exception as e:
        sys.stderr.write("    fetch error: %s\n" % str(e))
        sys.stderr.flush()
        return None


def parse_feed(xml_data, feed_type='rss'):
    items = []
    try:
        root = ET.fromstring(xml_data)
    except Exception:
        return items

    if feed_type == 'atom':
        NS = {'atom': 'http://www.w3.org/2005/Atom'}
        for entry in root.findall('.//atom:entry', NS):
            item = {'title': '', 'link': '', 'description': '', 'published': ''}
            t = entry.find('atom:title', NS)
            if t is not None and t.text:
                item['title'] = t.text.strip()
            l = entry.find('atom:link', NS)
            if l is not None:
                item['link'] = l.get('href', '')
            c = entry.find('atom:content', NS)
            if c is not None and c.text:
                item['description'] = re.sub(r'<[^>]+>', '', c.text).strip()[:1000]
            else:
                s = entry.find('atom:summary', NS)
                if s is not None and s.text:
                    item['description'] = re.sub(r'<[^>]+>', '', s.text).strip()[:1000]
            p = entry.find('atom:published', NS)
            if p is not None and p.text:
                item['published'] = p.text.strip()
            if item['link']:
                items.append(item)
    else:
        for item in root.iter('item'):
            entry = {'title': '', 'link': '', 'description': '', 'published': ''}
            for child in item:
                tag = child.tag.split('}')[-1]
                if tag == 'title' and child.text:
                    entry['title'] = child.text.strip()
                elif tag == 'link' and child.text:
                    entry['link'] = child.text.strip()
                elif tag == 'description' and child.text:
                    entry['description'] = re.sub(r'<[^>]+>', '', child.text).strip()[:1000]
                elif tag == 'pubDate' and child.text:
                    entry['published'] = child.text.strip()
            if entry['link']:
                entry['link'] = entry['link'].strip()
                items.append(entry)
    return items


def is_recent(published_str, hours=48):
    if not published_str:
        return True
    for fmt in [
        '%a, %d %b %Y %H:%M:%S %z',
        '%a, %d %b %Y %H:%M:%S %Z',
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d',
    ]:
        try:
            pub = datetime.datetime.strptime(published_str.strip(), fmt)
            if hasattr(pub, 'tzinfo') and pub.tzinfo:
                pub = pub.replace(tzinfo=None)
            now = datetime.datetime.utcnow()
            diff = (now - pub).total_seconds()
            return diff >= 0 and diff <= hours * 3600
        except ValueError:
            continue
    return True


def is_ai_related(title, desc):
    t = "%s %s" % (title, desc)
    t = t.lower()
    kws = [
        'ai', 'llm', 'language model', 'gpt', 'claude', 'gemini', 'chatgpt',
        'openai', 'anthropic', 'deepmind', 'llama', 'mistral', 'neural network',
        'machine learning', 'transformer', 'agent', 'multimodal', 'diffusion',
        'generative', 'copilot', 'nvidia', 'hugging face', 'deepseek',
        'fable', 'opus', 'sonnet', 'haiku', 'grok', 'xai', 'generation',
        'image generation', 'video generation', 'ai model', 'open source',
        'alignment', 'reasoning', 'agi', 'arc-agi',
    ]
    return any(kw in t for kw in kws)


def write_article_file_draft(article_data, source_article):
    """Write markdown file with status: draft."""
    slug = article_data.get('slug', '')
    if not slug:
        slug = re.sub(r'[^a-z0-9-]', '-', article_data.get('title', 'untitled').lower())[:60]

    filepath = os.path.join(OUTPUT_DIR, '%s.md' % slug)
    if os.path.exists(filepath):
        slug = '%s-%d' % (slug, int(time.time()))
        filepath = os.path.join(OUTPUT_DIR, '%s.md' % slug)

    title = article_data.get('title', 'Untitled')
    description = article_data.get('description', '')
    h1_final = article_data.get('h1_final', title)
    category = article_data.get('category', 'general')
    tags = article_data.get('tags', [])
    related_models = article_data.get('relatedModels', [])
    related_companies = article_data.get('relatedCompanies', [])
    content = article_data.get('content', '')
    source_link = source_article.get('link', '')

    date_str = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S+03:00')

    tags_str = ', '.join('"%s"' % t for t in tags) if tags else '[]'
    models_str = ', '.join('"%s"' % m for m in related_models) if related_models else '[]'
    companies_str = ', '.join('"%s"' % c for c in related_companies) if related_companies else '[]'

    frontmatter = (
        '---\n'
        'slug: "%s"\n'
        'title: "%s"\n'
        'h1: "%s"\n'
        'description: "%s"\n'
        'datePublished: "%s"\n'
        'dateModified: "%s"\n'
        'author: "AI-Sphere"\n'
        'category: "%s"\n'
        'tags: [%s]\n'
        'relatedModels: [%s]\n'
        'relatedCompanies: [%s]\n'
        'sourceUrls: ["%s"]\n'
        'primarySourceUrl: "%s"\n'
        'schema_version: "3.1"\n'
        'status: "draft"\n'
        'index: true\n'
        '---\n'
        '\n'
        '%s\n'
    ) % (slug, title, h1_final, description, date_str, date_str,
         category, tags_str, models_str, companies_str,
         source_link, source_link,
         content)

    with open(filepath, 'w') as f:
        f.write(frontmatter)

    return filepath, slug


def publish_file(filepath):
    """Change status from draft to ready (after successful deploy)."""
    with open(filepath, 'r') as f:
        data = f.read()
    if 'status: "draft"' in data:
        data = data.replace('status: "draft"', 'status: "ready"')
        with open(filepath, 'w') as f:
            f.write(data)
        return True
    return False


def run_v31_pipeline(article):
    """
    Run v3.1 stages 1-6 for one article.
    Returns (article_data, qa_gate, error_string or None)
    """
    print("  [v3.1] Stage 1/6: keyword-classification...", file=sys.stderr)
    stage1 = stage1_keyword_classification(article)
    if "error" in stage1:
        return None, None, "classification: %s" % stage1["error"]

    print("  [v3.1] Stage 2/6: semantic-clustering...", file=sys.stderr)
    stage2 = stage2_semantic_clustering(stage1, article)
    if stage2.get("page_action") == "discard":
        return None, None, "discarded: %s" % stage2.get("reason", "")

    print("  [v3.1] Stage 3/6: seo-brief...", file=sys.stderr)
    stage3 = stage3_seo_brief(stage1, article)

    print("  [v3.1] Stage 4/6: research-fact-check...", file=sys.stderr)
    stage4 = stage4_research_fact_check(stage3, article)

    print("  [v3.1] Stage 5/6: content-writing...", file=sys.stderr)
    stage5 = stage5_content_writing(stage3, stage4, article)
    if "error" in stage5:
        return None, None, "writing: %s" % stage5["error"]

    print("  [v3.1] Stage 6/6: quality-gate...", file=sys.stderr)
    stage6 = stage6_quality_gate(stage5, stage4, article)

    return stage5, stage6, None


def main():
    print("=" * 60)
    print("AI-Sphere News Monitor — v3.1 Pipeline")
    print("Started: %s" % datetime.datetime.now().isoformat())
    print("=" * 60)
    sys.stdout.flush()

    cfg = load_config()
    sources_cfg = load_sources()
    sources = sources_cfg.get('sources', {})
    settings = sources_cfg.get('settings', {})
    max_articles = settings.get('max_articles_per_run', 3)

    proxy = cfg.get('proxy')
    api_key = cfg.get('key')

    if not api_key:
        print("ERROR: No OpenRouter API key found in .env")
        return

    print("Proxy: %s" % ('configured' if proxy else 'none'))
    print("Sources: %d" % len(sources))
    print("Max articles: %d" % max_articles)
    sys.stdout.flush()

    seen = load_seen()
    print("Already seen: %d entries" % len(seen))
    sys.stdout.flush()

    all_new = []

    for source_id, sc in sorted(sources.items()):
        name = sc.get('name', source_id)
        url = sc.get('url', '')
        feed_type = sc.get('type', 'rss')

        sys.stdout.write("\n  [%s] " % name)
        sys.stdout.flush()

        xml_data = fetch_rss(url, proxy)
        if not xml_data:
            sys.stdout.write("fetch failed\n")
            sys.stdout.flush()
            continue

        items = parse_feed(xml_data, feed_type)
        sys.stdout.write("%d items" % len(items))
        sys.stdout.flush()

        new_count = 0
        for item in items:
            link = item.get('link', '')
            if not link:
                continue
            if link in seen:
                continue
            if not is_ai_related(item.get('title', ''), item.get('description', '')):
                continue
            if not is_recent(item.get('published', ''), 48):
                continue

            item['source_id'] = source_id
            item['source_name'] = name
            all_new.append(item)
            new_count += 1

        sys.stdout.write(", %d new\n" % new_count)
        sys.stdout.flush()

    print("\n\nTotal new AI articles: %d" % len(all_new))
    sys.stdout.flush()

    if not all_new:
        print("\nНет новых новостей.")
        return

    all_new.sort(key=lambda a: -sources.get(a.get('source_id', ''), {}).get('priority', 5))
    all_new = all_new[:max_articles]

    print("Processing top %d articles..." % len(all_new))
    sys.stdout.flush()

    generated = []
    seen_updates = {}

    for i, article in enumerate(all_new):
        print("\n--- Article %d/%d ---" % (i + 1, len(all_new)))
        print("  Title: %s" % article.get('title', '')[:80])
        print("  Source: %s" % article.get('source_name', ''))
        print("  Link: %s" % article.get('link', '')[:80])
        sys.stdout.flush()

        # Run v3.1 pipeline (stages 1-6)
        article_data, qa_gate, error = run_v31_pipeline(article)

        if error:
            if error.startswith("discarded"):
                print("  SKIP: %s" % error, file=sys.stderr)
            else:
                print("  ERROR: %s" % error, file=sys.stderr)
            # Still mark as seen to avoid re-processing
            link = article.get('link', '')
            seen_updates[link] = {
                'title': article.get('title', ''),
                'source': article.get('source_id', ''),
                'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'status': error[:50],
            }
            continue

        # Write draft file
        print("  Writing draft file...", file=sys.stderr)
        filepath, slug = write_article_file_draft(article_data, article)
        print("  File: %s" % filepath, file=sys.stderr)

        link = article.get('link', '')
        seen_updates[link] = {
            'title': article.get('title', ''),
            'source': article.get('source_id', ''),
            'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }

        qa_status = qa_gate.get("qa_status", "unknown") if qa_gate else "unknown"
        print("  QA: %s" % qa_status, file=sys.stderr)
        if qa_gate and qa_gate.get("warnings"):
            for w in qa_gate["warnings"][:3]:
                print("    ⚠ %s" % w, file=sys.stderr)
        if qa_gate and qa_gate.get("blocking_errors"):
            for e in qa_gate["blocking_errors"][:3]:
                print("    ✗ %s" % e, file=sys.stderr)

        generated.append({
            'title': article_data.get('title', ''),
            'slug': slug,
            'file': filepath,
            'source_link': link,
            'qa_status': qa_status,
        })

    # Update seen
    seen.update(seen_updates)
    save_seen(seen)
    print("\nSeen.json updated: %d total entries" % len(seen))
    sys.stdout.flush()

    if not generated:
        print("\nНе удалось сгенерировать ни одной статьи.")
        return

    print("\n" + "=" * 60)
    print("Generated %d articles (drafts):" % len(generated))
    for g in generated:
        status_mark = "✓" if g['qa_status'] == "passed" else "?"
        print("  %s %s (%s) — QA: %s" % (status_mark, g['title'], g['slug'], g['qa_status']))
    print("=" * 60)
    sys.stdout.flush()

    # Stage 7: build + deploy (one batch for all articles)
    print("\n[Stage 7/7] Build & Deploy...")
    sys.stdout.flush()

    print("Running npm run build...")
    sys.stdout.flush()
    try:
        build = subprocess.run(
            ['npm', 'run', 'build'],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except subprocess.TimeoutExpired:
        print("BUILD TIMEOUT. Articles saved as drafts.")
        return

    if build.returncode != 0:
        print("BUILD FAILED:")
        print(build.stderr[-500:])
        print("Articles saved as drafts. Fix build and publish manually.")
        return

    print("Build successful!")
    sys.stdout.flush()

    print("Deploying...")
    sys.stdout.flush()
    if os.path.exists(DEPLOY_SCRIPT):
        try:
            deploy = subprocess.run(
                ['bash', DEPLOY_SCRIPT],
                capture_output=True,
                text=True,
                timeout=180,
            )
        except subprocess.TimeoutExpired:
            print("DEPLOY TIMEOUT. Attempting rollback...")
            # Rebuild previous version
            subprocess.run(['npm', 'run', 'build'], cwd=ROOT, capture_output=True, timeout=180)
            print("Rolled back to previous build. Articles saved as drafts.")
            return

        if deploy.returncode != 0:
            print("DEPLOY FAILED:")
            print(deploy.stderr[:500])
            print("Rolling back to previous build...")
            subprocess.run(['npm', 'run', 'build'], cwd=ROOT, capture_output=True, timeout=180)
            print("Rolled back. Articles saved as drafts.")
            return

        # Post-deploy check
        print("Deploy output: %s" % deploy.stdout[:300])
        print("Deploy successful!")

        # Publish all articles (draft → ready)
        published = []
        for g in generated:
            if publish_file(g['file']):
                published.append(g['slug'])
                print("  Published: /news/%s" % g['slug'], file=sys.stderr)

        print("\nPublished %d articles." % len(published))
        print("Done!")
    else:
        print("Deploy script not found: %s" % DEPLOY_SCRIPT)
        print("Articles saved as drafts. Deploy manually.")
        print("Done!")

    sys.stdout.flush()


if __name__ == '__main__':
    main()
