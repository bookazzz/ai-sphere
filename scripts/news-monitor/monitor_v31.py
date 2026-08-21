#!/usr/bin/env python3
"""
AI-Sphere News Monitor — v3.1 pipeline integration.
Fetches RSS, runs 7-stage pipeline, deploys.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import datetime
import subprocess
import urllib.parse
import xml.etree.ElementTree as ET
import logging

import requests
import socket

socket.setdefaulttimeout(15)

# Logging setup
logger = logging.getLogger('news-monitor')
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler(sys.stderr)
    ch.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
    logger.addHandler(ch)

# Paths
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ENV_PATH = os.path.join(ROOT, 'backend', '.env')
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')
SEEN_PATH = os.path.join(os.path.dirname(__file__), 'seen.json')
OUTPUT_DIR = os.path.join(ROOT, 'src', 'content', 'news')
DEPLOY_SCRIPT = os.path.expanduser('/root/.hermes/scripts/deploy-ai-sphere.sh')

os.makedirs(OUTPUT_DIR, exist_ok=True)

RESEARCH_DIR = os.path.join(OUTPUT_DIR, 'research')
os.makedirs(RESEARCH_DIR, exist_ok=True)

FAILURES_DIR = os.path.join(ROOT, 'storage', 'news-failures')

# ── Generic HTTP fetch ──────────────────────────────────────────

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; AI-Sphere-NewsBot/1.0; "
        "+https://ai-sphere.ru/)"
    )
}


RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
MAX_RETRIES = 3
BACKOFF_SECONDS = [2, 5, 12]
MAX_RESPONSE_BYTES = 5 * 1024 * 1024  # 5MB


def fetch_url(
    url: str,
    timeout=20,
    headers=None,
):
    """Fetch URL with requests, proper timeout, retry, and redirect handling.
    
    Retries on 429 (with Retry-After), 502, 503, 504 with exponential backoff.
    On 429, adds source to cooldown (avoid repeated hammering in same run).
    """
    request_headers = {**DEFAULT_HEADERS, **(headers or {})}
    last_exc = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(
                url,
                headers=request_headers,
                timeout=timeout,
                allow_redirects=True,
            )

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                if retry_after:
                    try:
                        wait = min(int(retry_after), 30)
                    except (ValueError, TypeError):
                        wait = BACKOFF_SECONDS[attempt - 1] if attempt - 1 < len(BACKOFF_SECONDS) else 15
                else:
                    wait = BACKOFF_SECONDS[attempt - 1] if attempt - 1 < len(BACKOFF_SECONDS) else 15
                logger.warning(
                    "HTTP 429 for %s, attempt %d/%d, waiting %ds",
                    url[:60], attempt, MAX_RETRIES, wait,
                )
                time.sleep(wait)
                continue

            if response.status_code in RETRY_STATUSES:
                wait = BACKOFF_SECONDS[attempt - 1] if attempt - 1 < len(BACKOFF_SECONDS) else 15
                logger.warning(
                    "HTTP %d for %s, attempt %d/%d, waiting %ds",
                    response.status_code, url[:60], attempt, MAX_RETRIES, wait,
                )
                time.sleep(wait)
                continue

            response.raise_for_status()

            # Check content size
            content = response.text
            if len(content) > MAX_RESPONSE_BYTES:
                logger.warning(
                    "Response too large for %s: %d bytes (max %d), truncating",
                    url[:60], len(content), MAX_RESPONSE_BYTES,
                )
                content = content[:MAX_RESPONSE_BYTES]
            return content

        except (requests.ConnectionError, requests.Timeout) as e:
            last_exc = e
            wait = BACKOFF_SECONDS[attempt - 1] if attempt - 1 < len(BACKOFF_SECONDS) else 15
            logger.warning(
                "Connection error for %s (%s), attempt %d/%d, waiting %ds",
                url[:60], str(e)[:50], attempt, MAX_RETRIES, wait,
            )
            if attempt < MAX_RETRIES:
                time.sleep(wait)
            continue

        except requests.RequestException as e:
            last_exc = e
            logger.error("HTTP error fetching %s: %s", url[:60], str(e)[:100])
            raise

    logger.error("All %d retries exhausted for %s: %s", MAX_RETRIES, url[:60], last_exc)
    raise last_exc or RuntimeError("fetch_url failed after %d retries" % MAX_RETRIES)


# ── arXiv utilities ─────────────────────────────────────────────

ARXIV_DOMAINS = frozenset({"arxiv.org", "www.arxiv.org"})


def is_arxiv_url(url):
    """Check if URL points to arXiv."""
    try:
        host = urllib.parse.urlparse(url).netloc.lower()
        return host in ARXIV_DOMAINS
    except Exception:
        return False


def extract_arxiv_article(feed_item):
    """Extract structured data from arXiv RSS item without fetching HTML."""
    title = feed_item.get("title", "")
    link = feed_item.get("link", "")
    summary = feed_item.get("description", "") or feed_item.get("summary", "")
    authors = feed_item.get("authors", [])
    if not authors and summary:
        m = re.search(r'Authors?:?\s*(.+?)(?:\n|$)', summary)
        if m:
            authors = [a.strip() for a in m.group(1).split(",")]
    arxiv_id = ""
    if link:
        m = re.search(r'arxiv\.org/(?:abs|pdf)/(\d+\.\d+)', link)
        if m:
            arxiv_id = m.group(1)
    categories = []
    if summary:
        m = re.search(r'Subjects?:?\s*(.+?)(?:\n|$)', summary)
        if m:
            categories = [c.strip() for c in m.group(1).split(",")]
    return {
        "title": title,
        "authors": authors,
        "published_at": feed_item.get("published", ""),
        "abstract": summary,
        "article_url": link,
        "arxiv_id": arxiv_id,
        "categories": categories,
        "source_type": "primary_research_preprint",
        "source_label": "arXiv",
    }


# ── RSS Feed fetching ───────────────────────────────────────────


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


# ── Article HTML extraction ──────────────────────────────────

def fetch_article_text(url, proxy=None, timeout=20):
    """Fetch article HTML and extract main text via trafilatura.
    Uses fetch_url() for HTTP (proper timeout support) then trafilatura for extraction.
    """
    import trafilatura
    try:
        logger.info("fetching article HTML: %s", url[:80])
        # Fetch via requests for reliable timeout
        html = fetch_url(url, timeout=timeout)
        if not html:
            logger.warning("fetch_url returned empty: %s", url[:80])
            return None
        # Extract via trafilatura
        text = trafilatura.extract(html, include_links=False, include_images=False,
                                    include_tables=True, include_formatting=False,
                                    output_format='text')
        if text:
            text = text.strip()
            logger.info("extracted %d chars from %s", len(text), url[:80])
        else:
            logger.warning("trafilatura extract returned empty: %s", url[:80])
        return text
    except requests.RequestException as e:
        logger.error("HTTP error fetching %s: %s", url[:80], str(e))
        return None
    except Exception as e:
        logger.error("article extraction error for %s: %s", url[:80], str(e))
        return None


def fetch_article_text_fallback(url, proxy=None, timeout=20):
    """Fallback: basic HTML2text via requests + regex."""
    try:
        html = fetch_url(url, timeout=timeout)
        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL|re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL|re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        logger.info("fallback extracted %d chars from %s", len(text), url[:80])
        return text[:10000]
    except Exception as e:
        logger.error("fallback extraction error: %s", str(e))
        return None


def extract_article(source_article, proxy=None):
    """Try trafilatura first, fall back to regex HTML2text.
    For arXiv, skip HTML extraction and use RSS metadata directly.
    """
    url = source_article.get('link', '') or source_article.get('source_url', '')

    # arXiv — use RSS metadata, no HTML extraction needed
    if url and is_arxiv_url(url):
        logger.info("arXiv article detected, using RSS metadata: %s", url[:80])
        arxiv_data = extract_arxiv_article(source_article)
        source_article['arxiv_data'] = arxiv_data
        desc = source_article.get('description', '') or source_article.get('summary', '')
        logger.info("arXiv fallback text: %d chars", len(desc or ''))
        return desc

    if not url:
        logger.warning("no URL to extract")
        return None
    text = fetch_article_text(url, proxy)
    if text and len(text) > 300:
        return text
    text2 = fetch_article_text_fallback(url, proxy)
    if text2 and len(text2) > 200:
        return text2
    desc = source_article.get('description', '') or source_article.get('summary', '')
    if desc:
        logger.warning("using RSS description as fallback (%d chars)", len(desc))
        return desc
    return None


# ── Helpers ──────────────────────────────────────────────────

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


def write_article_file_draft(article_data, source_article, source_type='news_article'):
    """Write markdown file with status: draft.
    For primary_research_preprint, writes to news/research/ with disclaimer.
    """
    slug = article_data.get('slug', '')
    if not slug:
        slug = re.sub(r'[^a-z0-9-]', '-', article_data.get('title', 'untitled').lower())[:60]

    is_research = (source_type == 'primary_research_preprint')
    out_dir = RESEARCH_DIR if is_research else OUTPUT_DIR
    os.makedirs(out_dir, exist_ok=True)

    filepath = os.path.join(out_dir, '%s.md' % slug)
    if os.path.exists(filepath):
        slug = '%s-%d' % (slug, int(time.time()))
        filepath = os.path.join(out_dir, '%s.md' % slug)

    title = article_data.get('title', 'Untitled')
    description = article_data.get('description', '')
    h1_final = article_data.get('h1_final', title)
    category = 'research' if is_research else article_data.get('category', 'general')
    tags = article_data.get('tags', [])
    related_models = article_data.get('relatedModels', [])
    related_companies = article_data.get('relatedCompanies', [])
    content = article_data.get('content', '')
    source_link = source_article.get('link', '')

    # Prepend research disclaimer for preprints
    if is_research:
        disclaimer = (
            '> **\u26a0\ufe0f Status: preprint\n'
            '> This article is based on a preprint published on arXiv. '
            'The work may not have undergone independent peer review. '
            'Conclusions reflect the authors\' position.\n\n'
        )
        content = disclaimer + content

    date_str = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S+03:00')

    tags_str = ', '.join('"%s"' % t for t in tags) if tags else '[]'
    models_str = ', '.join('"%s"' % m for m in related_models) if related_models else '[]'
    companies_str = ', '.join('"%s"' % c for c in related_companies) if related_companies else '[]'
    is_research_str = 'true' if is_research else 'false'


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
        'isResearch: %s\n'
        'schema_version: "3.2"\n'
        'status: "draft"\n'
        'index: true\n'
        '---\n'
        '\n'
        '%s\n'
    ) % (slug, title, h1_final, description, date_str, date_str,
         category, tags_str, models_str, companies_str,
         source_link, source_link, is_research_str,
         content)

    with open(filepath, 'w') as f:
        f.write(frontmatter)

    return filepath, slug

def set_file_status(filepath, new_status):
    """Set editorial status in file frontmatter.
    Replaces any existing status: "..." with the new one.
    Returns True if changed.
    """
    with open(filepath, 'r') as f:
        data = f.read()
    new_line = 'status: "%s"' % new_status
    # Replace any existing status line
    if re.search(r'status:\s+"[^"]+"', data):
        data = re.sub(r'status:\s+"[^"]+"', new_line, data)
        with open(filepath, 'w') as f:
            f.write(data)
        return True
    return False


def run_v31_pipeline(article, proxy=None):
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

    # Stage 3b: fetch full article HTML for fact-checking (stage 4)
    print("  [v3.1] Stage 3b/6: article-extraction...", file=sys.stderr)
    full_text = extract_article(article, proxy)
    article['full_text'] = full_text or ''
    src_len = len(article.get('description', '') or '')
    ext_len = len(full_text or '')
    logger.info("article_text: source=%s/%d chars extracted=%s/%d chars",
                article.get('source_name', '?'), src_len,
                'OK' if ext_len > 300 else 'FALLBACK', ext_len)

    print("  [v3.1] Stage 4/6: research-fact-check...", file=sys.stderr)
    stage4 = stage4_research_fact_check(stage3, article)
    facts = stage4.get('facts', []) if isinstance(stage4, dict) else []
    facts_count = len(facts)
    logger.info("fact_check: source=%s facts=%d unverifiable=%d",
                article.get('source_name', '?'), facts_count,
                len(stage4.get('unverifiable_claims', [])) if isinstance(stage4, dict) else 0)

    # Block pipeline if no verified facts (no .md files created)
    if facts_count == 0:
        error_msg = "no_verified_facts_available"
        logger.warning("Pipeline blocked: %s for %s", error_msg, article.get('source_name', '?'))
        print("  BLOCKED: %s — нет подтверждённых фактов" % error_msg, file=sys.stderr)
        # Save diagnostic info to failures dir
        try:
            import json as _json
            failures_dir = os.path.join(os.path.dirname(OUTPUT_DIR), '..', 'storage', 'news-failures')
            os.makedirs(failures_dir, exist_ok=True)
            event_id = hashlib.md5((article.get('link', '') + str(time.time())).encode()).hexdigest()[:12]
            diag = {
                "status": "blocked",
                "failed_stage": "research_fact_check",
                "reason": "no_verified_facts_available",
                "source_url": article.get('link', ''),
                "source_name": article.get('source_name', ''),
                "extractor": "arxiv" if article.get('arxiv_data') else "html_or_fallback",
                "extracted_chars": len(article.get('full_text', '') or '') if article.get('full_text') else len(article.get('description', '') or ''),
                "error": error_msg,
            }
            with open(os.path.join(failures_dir, "%s.json" % event_id), 'w') as _f:
                _json.dump(diag, _f, ensure_ascii=False, indent=2)
            logger.info("Failure diagnostic saved: storage/news-failures/%s.json", event_id)
        except Exception as _exc:
            logger.warning("Failed to save failure diagnostic: %s", str(_exc))
        # Return early — no article, no .md file
        return stage4, {"qa_status": "failed", "blocking_errors": [error_msg], "warnings": []}, error_msg

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
            item['tier'] = sc.get('tier', 'media')
            all_new.append(item)
            new_count += 1

        sys.stdout.write(", %d new\n" % new_count)
        sys.stdout.flush()

    print("\n\nTotal new AI articles: %d" % len(all_new))
    sys.stdout.flush()

    if not all_new:
        print("\nНет новых новостей.")
        return

    # ── Relevance scoring and quotas ──
    MIN_GENERATION_SCORE = 0.50  # minimum total score to generate article
    MIN_PRODUCT_RELEVANCE = 0.0  # all news pass pre-filter; scoring handles ranking

    # Boost keywords for product relevance (30% of score)
    # Each keyword is matched case-insensitively as substring
    BOOST_KEYWORDS = [
        'release', 'releases', 'released', 'launch', 'launches', 'launched',
        'unveil', 'unveils', 'unveiled', 'introduces', 'introduced',
        'announces', 'announced', 'new model', 'new models',
        'api', 'pricing', 'chatgpt', 'claude', 'gemini',
        'deepseek', 'grok', 'midjourney', 'sora', 'veo',
        'image generation', 'video generation',
        'ai agent', 'ai agents', 'ai coding', 'ai model',
        'open source', 'open-source', 'openai', 'anthropic',
        'nvidia', 'microsoft', 'google ai', 'meta ai',
        'llama', 'mistral', 'qwen',
    ]
    # Penalty keywords (niche / no product connection)
    PENALTY_KEYWORDS = [
        'medical', 'clinical', 'psychology', 'interpersonal', 'biology',
        'chemistry', 'physics', 'mathematics', 'theoretical',
    ]

    def compute_product_relevance(title_text):
        """Compute product relevance score for filtering ahead of total scoring."""
        t = title_text.lower()
        boost_count = sum(1 for kw in BOOST_KEYWORDS if kw in t)
        penalty_count = sum(1 for kw in PENALTY_KEYWORDS if kw in t)
        score = min(boost_count * 0.10, 0.35)
        score -= penalty_count * 0.10
        return max(score, 0.0)

    # Pre-filter: reject materials with too low product relevance
    product_filtered = []
    for a in all_new:
        title_text = a.get('title', '') + ' ' + (a.get('description', '') or '')
        pr = compute_product_relevance(title_text)
        a['_product_relevance'] = pr
        if pr < MIN_PRODUCT_RELEVANCE:
            logger.info("rejected_before_generation: product_relevance=%.2f < %.2f for \"%s\"",
                        pr, MIN_PRODUCT_RELEVANCE, a.get('title', '')[:50])
            continue
        product_filtered.append(a)
    all_new = product_filtered
    if not all_new:
        print("\nВсе материалы отклонены по product relevance (порог %.2f)." % MIN_PRODUCT_RELEVANCE)
        return

    def relevance_score(item):
        title_text = (item.get('title', '') + ' ' + (item.get('description', '') or '')).lower()
        source_priority = sources.get(item.get('source_id', ''), {}).get('priority', 5)
        tier = item.get('tier', 'media')

        # Product relevance (30%) — reuse pre-computed
        product_score = item.get('_product_relevance', 0.0)

        # Significance (25%) — based on source priority
        significance = min(source_priority / 10.0, 0.25)

        # Freshness (20%) — newer = better
        freshness = 0.20  # default
        published = item.get('published', '')
        if published:
            try:
                for fmt in ['%a, %d %b %Y %H:%M:%S %z', '%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%dT%H:%M:%SZ']:
                    try:
                        pub = datetime.datetime.strptime(published.strip(), fmt)
                        if hasattr(pub, 'tzinfo') and pub.tzinfo:
                            pub = pub.replace(tzinfo=None)
                        hours_ago = (datetime.datetime.utcnow() - pub).total_seconds() / 3600
                        freshness = max(0.20 - hours_ago * 0.005, 0.05)
                        break
                    except ValueError:
                        continue
            except Exception:
                pass

        # Source quality (15%)
        quality_map = {'official': 0.15, 'media': 0.12, 'academic': 0.15, 'discovery': 0.05}
        quality = quality_map.get(tier, 0.10)

        # Search demand (10%)
        tk = (item.get('title', '') + ' ' + (item.get('description', '') or '')).lower()
        boost_count = sum(1 for kw in BOOST_KEYWORDS if kw in tk)
        search_demand = 0.10 if boost_count > 0 else 0.05

        total = product_score + significance + freshness + quality + search_demand
        return max(total, 0.01)

    # Score all articles
    for a in all_new:
        a['_score'] = relevance_score(a)
        logger.debug("score: %.3f — %s", a['_score'], a.get('title', '')[:50])

    all_new.sort(key=lambda a: -a['_score'])
    all_new = all_new[:max_articles * 2]  # keep more before dedup

    # ── Event-key deduplication ──
    # Group articles by event key (company + model/feature + event type + date)
    # Then keep only the best-scoring source per event, merge additional URLs

    def extract_event_key(item):
        """Extract event key for dedup grouping."""
        title = (item.get('title', '') + ' ' + (item.get('description', '') or '')).lower()
        # Normalize: lowercase, strip punctuation, remove common stopwords
        key_text = re.sub(r'[^a-zа-яё0-9\s]', ' ', title)
        key_text = re.sub(r'\s+', ' ', key_text).strip()
        # Take first 80 chars of normalized description as event fingerprint
        return key_text[:80]

    def make_event_key(item):
        """Build event key from title + source."""
        t = item.get('title', '')[:60].lower().strip()
        # Remove trailing punctuation
        t = re.sub(r'[\s,;:.!?]+$', '', t)
        # Add source as tiebreaker
        return t

    seen_events = {}  # event_key -> best article
    deduped = []
    for a in all_new:
        ek = make_event_key(a)
        if not ek:
            deduped.append(a)
            continue
        if ek in seen_events:
            existing = seen_events[ek]
            existing_score = existing.get('_score', 0)
            current_score = a.get('_score', 0)
            if current_score > existing_score:
                deduped.remove(existing)
                deduped.append(a)
                seen_events[ek] = a
                logger.info("dedup: kept higher-score %.3f > %.3f for \"%s\"",
                            current_score, existing_score, a.get('title', '')[:40])
            else:
                logger.info("dedup: skipped \"%s\" (score %.3f < %.3f for same event)",
                            a.get('title', '')[:40], current_score, existing_score)
        else:
            seen_events[ek] = a
            deduped.append(a)

    # ── Filter: remove discovery-tier from generation candidates ──
    # Discovery sources are signal-only; they should not consume generation slots
    generable = [a for a in deduped if a.get('tier', 'media') != 'discovery']
    if not generable:
        logger.info("No generable articles after filtering discovery tier")

    # ── Apply score threshold + quotas: max 1 arXiv, prefer 1 official/media ──
    selected = []
    arxiv_count = 0
    official_media_count = 0
    for a in generable[:max_articles * 2]:
        # Score threshold
        if a.get('_score', 0) < MIN_GENERATION_SCORE:
            logger.info("score_threshold: score=%.3f < %.2f for \"%s\"",
                        a['_score'], MIN_GENERATION_SCORE, a.get('title', '')[:50])
            continue
        is_arxiv = bool(a.get('arxiv_data')) or is_arxiv_url(a.get('link', ''))
        tier = a.get('tier', 'media')
        is_official_media = tier in ('official', 'media', 'academic')

        # Skip if we already have arXiv article
        if is_arxiv and arxiv_count >= 1:
            logger.info("quota: skipping arXiv (max 1 per run): %s", a.get('title', '')[:50])
            continue

        # Count this selection
        if is_arxiv:
            arxiv_count += 1
        if is_official_media:
            official_media_count += 1
        selected.append(a)
        if len(selected) >= max_articles:
            break

    # If we don't have official/media content but still have slots,
    # try to fill with more generable articles
    if official_media_count == 0 and len(selected) < max_articles:
        for a in generable[len(selected):]:
            if a.get('_score', 0) >= MIN_GENERATION_SCORE:
                tier = a.get('tier', 'media')
                if tier in ('official', 'media', 'academic'):
                    selected.append(a)
                    official_media_count += 1
                    logger.info("quota: added official/media source: %s", a.get('title', '')[:50])
                    break

    all_new = selected[:max_articles]

    print("Processing top %d articles..." % len(all_new))
    sys.stdout.flush()

    generated = []
    seen_updates = {}

    for i, article in enumerate(all_new):
        print("\n--- Article %d/%d ---" % (i + 1, len(all_new)))
        print("  Title: %s" % article.get('title', '')[:80])
        print("  Source: %s" % article.get('source_name', ''))
        print("  Link: %s" % article.get('link', '')[:80])
        print("  Tier: %s" % article.get('tier', 'media'))
        sys.stdout.flush()

        # Tier-based handling
        tier = article.get('tier', 'media')
        if tier == 'discovery':
            # Discovery sources: don't auto-publish, just extract canonical source
            print("  DISCOVERY: skip auto-publish, looking for primary source...", file=sys.stderr)
            link = article.get('link', '')
            seen_updates[link] = {
                'title': article.get('title', ''),
                'source': article.get('source_id', ''),
                'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'status': 'discovery_skipped',
            }
            logger.info("discovery_skip: source=%s title=%s", article.get('source_name', ''), article.get('title', '')[:60])
            continue

        # Run v3.1 pipeline (stages 1-6) for official/media/academic
        article_data, qa_gate, error = run_v31_pipeline(article, proxy)
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
        source_type = 'primary_research_preprint' if article.get('arxiv_data') else 'news_article'
        filepath, slug = write_article_file_draft(article_data, article, source_type)
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

    # Stage 7: publish generated articles without rebuild (no build+deploy)
    from pathlib import Path
    published = []
    skipped = []
    for g in generated:
        if g.get('qa_status') != 'passed':
            skipped.append(g['slug'])
            if g['qa_status'] == 'manual_review':
                filepath = g.get('file', '')
                if filepath:
                    set_file_status(filepath, "review")
                    print("  REVIEW: /news/%s → status: review (not published)" % g['slug'], file=sys.stderr)
                else:
                    print("  SKIP publish: /news/%s (QA: %s)" % (g['slug'], g['qa_status']), file=sys.stderr)
            else:
                print("  SKIP publish: /news/%s (QA: %s)" % (g['slug'], g['qa_status']), file=sys.stderr)
            continue
        filepath = g.get('file', '')
        if filepath and Path(filepath).exists():
            if set_file_status(filepath, "ready"):
                published.append(g['slug'])
                print("  Published: /news/%s" % g['slug'], file=sys.stderr)

    if published:
        print("\nPublished %d articles (draft→ready)." % len(published))
    if skipped:
        print("Skipped %d (not passed QA): %s" % (len(skipped), ', '.join(skipped[:5])))
    if not published and not skipped:
        print("\nNo articles to publish.")
    print("Note: build+deploy runs on separate daily cron.")

    print("Done!")

    sys.stdout.flush()


if __name__ == '__main__':
    main()
