#!/usr/bin/env python3
"""Debug feed parsing - check individual entry dates."""
import subprocess, feedparser, json, os
from datetime import datetime, timezone, timedelta

now = datetime.now(timezone.utc)
print(f"Current time: {now.isoformat()}")

# NVIDIA feed
result = subprocess.run(
    ["curl", "-s", "--max-time", "20", "https://developer.nvidia.com/blog/feed/",
     "-A", "Mozilla/5.0"],
    capture_output=True, text=True, timeout=25
)
feed = feedparser.parse(result.stdout)
entries = feed.get('entries', [])
print(f"NVIDIA entries: {len(entries)}")

for i, e in enumerate(entries[:20]):
    title = e.get('title', '')[:60]
    link = e.get('link', '')
    pub_parsed = e.get('published_parsed')
    pub = e.get('published', '')
    
    if pub_parsed:
        pub_dt = datetime(*pub_parsed[:6], tzinfo=timezone.utc)
        age = (now - pub_dt).total_seconds() / 3600
        print(f"[{i}] {age:.1f}h | {title} | pub: {pub[:25]}")
    else:
        print(f"[{i}] NO PARSED | {title} | pub: {pub[:25]}")
