#!/usr/bin/env python3
"""Comprehensive RSS fetch - tries ALL known sources, outputs new items as JSON."""
import json, sys, os, subprocess, feedparser
from datetime import datetime, timezone, timedelta

now = datetime.now(timezone.utc)
cutoff = now - timedelta(hours=48)

SEEN_FILE = "/root/ai-sphere/scripts/news-monitor/seen.json"

# Load seen
seen = set()
if os.path.exists(SEEN_FILE):
    with open(SEEN_FILE) as f:
        data = json.load(f)
    if isinstance(data, dict):
        seen = set(data.keys())
    elif isinstance(data, list):
        seen = set(data)

print(f"Seen: {len(seen)} entries", file=sys.stderr)

# All sources to try
sources = {
    "simon-willison": "https://simonwillison.net/atom/entries/",
    "nvidia-dev": "https://developer.nvidia.com/blog/feed/",
    "aws-ml": "https://aws.amazon.com/blogs/machine-learning/feed/",
    "arxiv-cscl": "https://rss.arxiv.org/rss/cs.CL",
    "arxiv-cslg": "https://rss.arxiv.org/rss/cs.LG",
    "arxiv-cv": "https://rss.arxiv.org/rss/cs.CV",
    "arxiv-ai": "https://rss.arxiv.org/rss/cs.AI",
    "arxiv-cr": "https://rss.arxiv.org/rss/cs.CR",
    "arxiv-ir": "https://rss.arxiv.org/rss/cs.IR",
    "arxiv-multimedia": "https://rss.arxiv.org/rss/cs.MM",
    "huggingface-papers": "https://huggingface.co/papers/feed.xml",
    "nvidia-tech": "https://blogs.nvidia.com/feed/",
    "techcrunch-ai": "https://techcrunch.com/category/artificial-intelligence/feed/",
    "the-decoder": "https://the-decoder.com/feed/",
    "venturebeat-ai": "https://venturebeat.com/category/ai/feed/",
}

# Try alternative URLs for failed feeds
alt_sources = {
    "openai-blog": "https://openai.com/news/feed.xml",
    "anthropic-blog": "https://www.anthropic.com/feed.xml",
    "meta-ai-blog": "https://ai.meta.com/blog/feed/",
    "google-ai": "https://blog.google/technology/ai/rss/",
    "deepmind": "https://deepmind.google/blog/rss/",
}

all_sources = {**sources, **alt_sources}

def fetch_feed(name, url):
    """Fetch and parse RSS feed."""
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "20", "-L", url,
             "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"],
            capture_output=True, text=True, timeout=25
        )
        if len(result.stdout) < 200:
            return []
        feed = feedparser.parse(result.stdout)
        entries = feed.get('entries', [])
        return entries
    except Exception as e:
        print(f"  Error fetching {name}: {e}", file=sys.stderr)
        return []

all_new = []

for name, url in all_sources.items():
    entries = fetch_feed(name, url)
    if not entries:
        continue
    
    source_new = []
    for e in entries:
        link = e.get('link', '').strip()
        title = e.get('title', '').strip()
        if not link or not title:
            continue
        if link in seen:
            continue
        
        pub_parsed = e.get('published_parsed')
        if not pub_parsed:
            continue
        
        pub_dt = datetime(*pub_parsed[:6], tzinfo=timezone.utc)
        age_hours = (now - pub_dt).total_seconds() / 3600
        if age_hours > 48:
            continue
        
        summary = (e.get('summary', '') or e.get('description', '') or '')[:3000]
        source_new.append({
            'source': name,
            'title': title,
            'link': link,
            'published': e.get('published', ''),
            'age_hours': round(age_hours, 1),
            'summary': summary,
        })
    
    if source_new:
        print(f"{name}: {len(source_new)} new items", file=sys.stderr)
        for item in source_new:
            print(f"  {item['age_hours']}h: {item['title'][:80]}", file=sys.stderr)
        all_new.extend(source_new)
    else:
        print(f"{name}: 0 new items", file=sys.stderr)

# Output results as JSON to stdout
print(json.dumps(all_new, ensure_ascii=False, indent=2))
print(f"\nTOTAL:{len(all_new)}", file=sys.stderr)
