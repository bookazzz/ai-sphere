"""Shared proxy handling for the news pipeline."""

import os
import re
import urllib.parse


def normalize_proxy_url(value):
    """Accept common proxy notations and return a requests-compatible URL."""
    value = str(value or '').strip().strip('"').strip("'")
    if not value:
        return None
    value = value.replace('\\@', '@')
    value = re.sub(r'^(https?)\s+', r'\1://', value, flags=re.IGNORECASE)
    if '://' not in value:
        value = 'http://' + value
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or not parsed.port:
        raise ValueError('proxy must have the form http://user:password@host:port')
    return value


def news_proxy_from_env(fallback=None):
    value = (
        os.environ.get('AISPHERE_NEWS_PROXY')
        or os.environ.get('NEWS_PROXY_URL')
        or os.environ.get('AISPHERE_OPENROUTER_PROXY')
        or os.environ.get('OPENROUTER_PROXY')
        or fallback
    )
    return normalize_proxy_url(value)


def proxy_is_required():
    return os.environ.get('NEWS_PROXY_REQUIRED', '1').strip().lower() not in ('0', 'false', 'no')


def redact_secrets(value):
    """Remove credentials from URLs before writing exceptions to logs."""
    return re.sub(r'(?i)(https?://)[^\s/@:]+:[^\s/@]+@', r'\1***:***@', str(value or ''))


def proxy_public_label(proxy):
    if not proxy:
        return 'none'
    parsed = urllib.parse.urlsplit(proxy)
    return '%s://%s:%s' % (parsed.scheme, parsed.hostname, parsed.port)
