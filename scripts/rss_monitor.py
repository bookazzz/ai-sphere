#!/usr/bin/env python3
"""Comprehensive RSS monitor that writes results to JSON."""
import json
import subprocess
import feedparser
from datetime import datetime, timezone, timedelta
import os
import sys
import traceback

RESULTS_FILE = "/tmp/rss_monitor_results.json"
SEEN_FILE = "/root/ai-sphere/scripts/news-monitor/seen.json"
OUTPUT_DIR = "/root/ai-sphere/src/content/news"

now = datetime.now(timezone.utc)
cutoff = now - timedelta(hours=48)

# Load seen URLs
seen = set()
if os.path.exists(SEEN_FILE):
    try:
        with open(SEEN_FILE) as f:
            data = json.load(f)
        if isinstance(data, list):
            seen = set(data)
        elif isinstance(data, dict):
            # Could be {seen: [...]} or other format
            if 'seen' in data:
                seen = set(data['seen'])
            else:
                seen = set(data.keys())
    except Exception as e:
        print(f"Error loading seen file: {e}", file=sys.stderr)

print(f"Loaded {len(seen)} seen entries", file=sys.stderr)

# Try multiple ways to fetch each source
sources = {
    "simon-willison": "https://simonwillison.net/atom/entries/",
    "nvidia-dev": "https://developer.nvidia.com/blog/feed/",
    "arxiv-cscl": "https://export.arxiv.org/rss/cs.CL",
    "arxiv-cslg": "https://export.arxiv.org/rss/cs.LG",
}

all_new = []
errors = []

for name, url in sources.items():
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "15", url, 
             "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"],
            capture_output=True, text=True, timeout=20
        )
        data = result.stdout
        if len(data) < 50:
            errors.append((name, "too short"))
            continue
        
        feed = feedparser.parse(data)
        entries = feed.get('entries', [])
        print(f"{name}: {len(entries)} entries", file=sys.stderr)
        
        for e in entries:
            link = e.get('link', '')
            title = e.get('title', '')
            pub_parsed = e.get('published_parsed')
            
            if not link or not title:
                continue
            
            # Check if we've seen this
            if link in seen:
                continue
            
            # Check age
            if pub_parsed:
                pub_dt = datetime(*pub_parsed[:6], tzinfo=timezone.utc)
                age_hours = (now - pub_dt).total_seconds() / 3600
                if age_hours > 48:
                    continue
            else:
                # No date info - skip if we can't verify recency
                continue
            
            summary = e.get('summary', '') or e.get('description', '') or ''
            
            new_item = {
                'source': name,
                'title': title,
                'link': link,
                'published': e.get('published', ''),
                'age_hours': round(age_hours, 1),
                'summary': summary[:2000],
            }
            all_new.append(new_item)
            seen.add(link)
            
    except Exception as ex:
        errors.append((name, str(ex)[:100]))
        print(f"  Error: {ex}", file=sys.stderr)

# Save results
results = {
    'timestamp': now.isoformat(),
    'new_articles': all_new,
    'errors': errors,
    'summary': {
        'total_new': len(all_new),
        'total_errors': len(errors),
    }
}

with open(RESULTS_FILE, 'w') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(all_new)} new articles to {RESULTS_FILE}", file=sys.stderr)
print(f"Errors: {len(errors)}", file=sys.stderr)

# Print summary to stdout
print(f"TOTAL_NEW:{len(all_new)}")
for item in all_new:
    print(f"NEW:{item['source']}|{item['age_hours']}h|{item['title'][:100]}")
