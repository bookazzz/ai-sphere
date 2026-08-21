#!/usr/bin/env python3
"""Fetch and check ALL entries from NVIDIA blog and other sources for recent items."""
import subprocess, feedparser, json, os
from datetime import datetime, timezone, timedelta

now = datetime.now(timezone.utc)
cutoff = now - timedelta(hours=48)
SEEN_FILE = "/root/ai-sphere/scripts/news-monitor/seen.json"

# Load seen URLs
seen = set()
if os.path.exists(SEEN_FILE):
    with open(SEEN_FILE) as f:
        data = json.load(f)
    if isinstance(data, dict):
        seen = set(data.keys())
    elif isinstance(data, list):
        seen = set(data)

print(f"Seen entries: {len(seen)}")

def check_feed(name, url, max_entries=50):
    """Check a feed and return recent new articles."""
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "20", url,
             "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"],
            capture_output=True, text=True, timeout=25
        )
        if len(result.stdout) < 200:
            return []
        
        feed = feedparser.parse(result.stdout)
        entries = feed.get('entries', [])
        
        new_items = []
        for e in entries[:max_entries]:
            link = e.get('link', '')
            title = e.get('title', '')
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
            
            summary = (e.get('summary', '') or e.get('description', '') or '')[:1000]
            new_items.append({
                'source': name,
                'title': title.strip(),
                'link': link.strip(),
                'published': e.get('published', ''),
                'age_hours': round(age_hours, 2),
                'summary': summary,
            })
        return new_items
    except Exception as ex:
        print(f"  Error: {name}: {ex}")
        return []

all_new = []

# Check NVIDIA all entries
print("\nChecking NVIDIA blog...")
nv_items = check_feed("nvidia-dev", "https://developer.nvidia.com/blog/feed/", 100)
print(f"NVIDIA: {len(nv_items)} new recent items")
for item in nv_items:
    print(f"  {item['age_hours']}h: {item['title'][:80]}")
all_new.extend(nv_items)

# Check Simon Willison all entries  
print("\nChecking Simon Willison...")
sw_items = check_feed("simon-willison", "https://simonwillison.net/atom/entries/", 50)
print(f"Simon Willison: {len(sw_items)} new recent items")
for item in sw_items:
    print(f"  {item['age_hours']}h: {item['title'][:80]}")
all_new.extend(sw_items)

# Try also to access some alternative news sources
# Let's try Hugging Face daily papers via API
print("\nChecking Hugging Face daily papers API...")
try:
    result = subprocess.run(
        ["curl", "-s", "--max-time", "15",
         "https://huggingface.co/api/daily_papers?limit=10",
         "-A", "Mozilla/5.0"],
        capture_output=True, text=True, timeout=20
    )
    if result.stdout and len(result.stdout) > 100:
        papers = json.loads(result.stdout)
        print(f"HF daily papers: {len(papers)} papers")
        for p in papers[:3]:
            title = p.get('title', '') or ''
            print(f"  Paper: {title[:80]}")
except Exception as ex:
    print(f"  HF API error: {ex}")

# Save results
print(f"\nTotal new articles found: {len(all_new)}")
with open('/tmp/all_new_articles.json', 'w') as f:
    json.dump(all_new, f, ensure_ascii=False, indent=2)
print("Saved to /tmp/all_new_articles.json")

# Also save just the titles/links in case we can't read the full JSON
for item in all_new:
    print(f"RESULT:{item['source']}|{item['age_hours']}|{item['title']}")
