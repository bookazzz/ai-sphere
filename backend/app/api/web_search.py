"""Optional web-search integration boundary."""

from app.core.config import settings


def needs_search(messages: list) -> bool:
    return settings.web_search_enabled and bool(messages)


async def web_search(query: str, max_results: int = 5) -> str:
    # Fail closed until a server-side provider with credentials is configured.
    return ""
