#!/usr/bin/env python3
"""Check working RSS feeds for recent entries."""
import feedparser
import subprocess
import json
from datetime import datetime, timezone, timedelta

feeds = {
    "simon-willison": "https://simonwillison.net/atom/entries/",
    "nvidia-dev": "https://developer.nvidia.com/blog/feed/",
    "aws-ml": "https://aws.amazon.com/blogs/machine-learning/feed/",
}

for name, url in feeds.items():
    result = subprocess.run(
        ["curl", "-s", "--max-time", "15", url, "-A", "Mozilla/5.0"],
        capture_output=True, text=True, timeout=20
    )
    data = result.stdout
    if not data:
        print(f"{name}: no data")
        continue
    
    feed = feedparser.parse(data)
    entries = feed.get('entries', [])
    print(f"\n=== {name}: {len(entries)} entries ===")
    
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=48)
    
    recent = 0
    for e in entries[:10]:
        title = e.get('title', 'N/A')[:100]
        link = e.get('link', '')
        published = e.get('published', '')
        pub_parsed = e.get('published_parsed')
        
        if pub_parsed:
            pub_dt = datetime(*pub_parsed[:6], tzinfo=timezone.utc)
            age_hours = (now - pub_dt).total_seconds() / 3600
            is_recent = age_hours <= 48
            if is_recent:
                recent += 1
                print(f"\n  RECENT ({age_hours:.1f}h ago):")
                print(f"  Title: {title}")
                print(f"  Link: {link}")
                print(f"  Published: {published}")
                print(f"  Age: {age_hours:.1f} hours")
        else:
            print(f"\n  (no date): {title}")
    
    print(f"\n  Recent entries (<=48h): {recent}")
