#!/usr/bin/env python3
"""Fetch and parse RSS feeds properly, check for recent articles."""
import feedparser
import subprocess
import json
from datetime import datetime, timezone, timedelta
import os

feeds = {
    "simon-willison": "https://simonwillison.net/atom/entries/",
    "nvidia-dev": "https://developer.nvidia.com/blog/feed/",
    "aws-ml": "https://aws.amazon.com/blogs/machine-learning/feed/",
}

now = datetime.now(timezone.utc)
cutoff = now - timedelta(hours=48)

for name, url in feeds.items():
    print(f"\n=== {name} ===")
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "15", url, "-A", "Mozilla/5.0"],
            capture_output=True, text=True, timeout=20
        )
        data = result.stdout
        print(f"  Fetched {len(data)} bytes")
        
        feed = feedparser.parse(data)
        entries = feed.get('entries', [])
        print(f"  Parsed {len(entries)} entries")
        
        recent = []
        for e in entries:
            title = e.get('title', '')
            link = e.get('link', '')
            pub_parsed = e.get('published_parsed')
            
            if pub_parsed:
                pub_dt = datetime(*pub_parsed[:6], tzinfo=timezone.utc)
                age_hours = (now - pub_dt).total_seconds() / 3600
                if age_hours <= 48:
                    recent.append({
                        'title': title,
                        'link': link,
                        'published': e.get('published', ''),
                        'age_hours': round(age_hours, 1),
                        'summary': e.get('summary', '')[:300],
                    })
            
        print(f"  Recent (<=48h): {len(recent)}")
        for r in recent:
            print(f"    - {r['age_hours']}h: {r['title'][:80]}")
            print(f"      Link: {r['link']}")
            
    except Exception as ex:
        print(f"  Error: {ex}")

print("\n---DONE---")
