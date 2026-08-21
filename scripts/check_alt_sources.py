#!/usr/bin/env python3
"""Extended feed checking - try more sources and alternative URLs."""
import subprocess
from datetime import datetime, timezone, timedelta
import feedparser

now = datetime.now(timezone.utc)
cutoff = now - timedelta(hours=48)
headers = '-A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"'

# Try more alternative sources
sources = {
    "arxiv-cscl-new": "https://export.arxiv.org/rss/cs.CL",
    "arxiv-cslg-new": "https://export.arxiv.org/rss/cs.LG",
    "huggingface-daily": "https://huggingface.co/api/daily_papers?limit=20",
    "techcrunch-ai-atom": "https://techcrunch.com/category/artificial-intelligence/feed/",
}

for name, url in sources.items():
    print(f"\n=== {name} ===")
    try:
        cmd = ['curl', '-s', '--max-time', '15']
        cmd += ['-H', 'Accept: application/rss+xml, application/xml, application/atom+xml, text/xml, application/json']
        cmd += ['-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36']
        cmd += [url]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        data = result.stdout
        print(f"  Size: {len(data)} bytes, Status: {result.returncode}")
        
        if len(data) < 100:
            print(f"  Content: {data[:100]}")
            continue
        
        # Try parsing as RSS/Atom
        feed = feedparser.parse(data)
        if feed.get('entries'):
            entries = feed.entries
            print(f"  Entries: {len(entries)}")
            for e in entries[:3]:
                pub = e.get('published_parsed')
                if pub:
                    pub_dt = datetime(*pub[:6], tzinfo=timezone.utc)
                    age = (now - pub_dt).total_seconds() / 3600
                    print(f"  - {age:.1f}h: {e.get('title','')[:80]}")
                else:
                    print(f"  - (no date): {e.get('title','')[:80]}")
        else:
            # Try JSON
            try:
                import json
                obj = json.loads(data)
                print(f"  JSON object, keys: {list(obj.keys()) if isinstance(obj, dict) else 'list of len ' + str(len(obj))}")
            except:
                print(f"  Not RSS/JSON. First 200: {data[:200]}")
    except Exception as ex:
        print(f"  Error: {ex}")

print("\n---DONE---")
