"""Allowlist sanitization for administrator-authored rich content."""

import json

import bleach


ALLOWED_TAGS = {
    "p", "br", "strong", "em", "u", "s", "blockquote", "code", "pre",
    "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "table", "thead",
    "tbody", "tr", "th", "td", "span", "div",
}
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height"],
    "*": ["class"],
}


def _clean_string(value: str) -> str:
    return bleach.clean(value, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, protocols={"http", "https", "mailto"}, strip=True)


def _clean_json(value):
    if isinstance(value, str):
        return _clean_string(value)
    if isinstance(value, list):
        return [_clean_json(item) for item in value]
    if isinstance(value, dict):
        return {key: _clean_json(item) for key, item in value.items()}
    return value


def sanitize_rich_content(content: str | None) -> str | None:
    if not content:
        return content
    try:
        parsed = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return _clean_string(content)
    return json.dumps(_clean_json(parsed), ensure_ascii=False)
