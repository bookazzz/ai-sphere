#!/usr/bin/env python3
"""Test which RSS feeds are reachable."""
import sys
import subprocess

feeds = {
    "openai": "https://openai.com/news/feed.xml",
    "anthropic": "https://www.anthropic.com/feed.xml",
    "meta-ai": "https://ai.meta.com/blog/feed/",
    "xai": "https://x.ai/feed.xml",
    "mistral": "https://mistral.ai/feed.xml",
    "the-decoder": "https://the-decoder.com/feed/",
    "techcrunch-ai": "https://techcrunch.com/category/artificial-intelligence/feed/",
    "venturebeat-ai": "https://venturebeat.com/category/ai/feed/",
    "simon-willison": "https://simonwillison.net/atom/entries/",
    "the-verge-ai": "https://www.theverge.com/ai-artificial-intelligence/rss.xml",
    "reuters-tech": "https://www.reuters.com/technology/arc/outboundfeeds/rss/",
    "huggingface-papers": "https://huggingface.co/papers/feed.xml",
    "arxiv-cscl": "https://rss.arxiv.org/rss/cs.CL",
    "arxiv-cslg": "https://rss.arxiv.org/rss/cs.LG",
    "nvidia-dev": "https://developer.nvidia.com/blog/feed/",
    "microsoft-ai": "https://azure.microsoft.com/en-us/blog/ai-machine-learning/feed/",
    "aws-ml": "https://aws.amazon.com/blogs/machine-learning/feed/",
    "stability-ai": "https://stability.ai/feed.xml",
    "elevenlabs": "https://elevenlabs.io/feed.xml",
}

success = []
fail = []

for name, url in feeds.items():
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "10", "-o", "/dev/null", "-w", "%{http_code}:%{size_download}", 
             url, "-A", "Mozilla/5.0"],
            capture_output=True, text=True, timeout=12
        )
        if result.stdout:
            code, size = result.stdout.strip().split(":", 1)
            code = int(code)
            size = int(size)
            if code == 200 and size > 100:
                success.append((name, url, code, size))
            else:
                fail.append((name, url, f"HTTP {code}, size={size}"))
        else:
            fail.append((name, url, "no output"))
    except subprocess.TimeoutExpired:
        fail.append((name, url, "timeout"))
    except Exception as e:
        fail.append((name, url, str(e)[:50]))

print("=== WORKING FEEDS ===")
for n, u, c, s in success:
    print(f"  OK {n}: HTTP {c}, {s} bytes")

print(f"\n=== FAILED FEEDS ({len(fail)}) ===")
for n, u, reason in fail:
    print(f"  FAIL {n}: {reason}")
