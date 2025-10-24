"""
Helper functions for chat endpoints.
"""

import logging
from typing import Any

from apps.api.config import settings
from apps.api.auth.security import sanitize_input
from packages.llm import ChatMessage

logger = logging.getLogger(__name__)

SUPPORTED_ASSISTANT_LANGUAGES = {"it", "en"}


def resolve_assistant_language(requested: str | None) -> str:
    """
    Resolve and validate assistant language.

    Args:
        requested: Requested language code

    Returns:
        Validated language code (defaults to 'it' if invalid)
    """
    candidate = (requested or settings.agent_default_language).strip().lower()
    if candidate in SUPPORTED_ASSISTANT_LANGUAGES:
        return candidate

    fallback = settings.agent_default_language.strip().lower()
    if fallback in SUPPORTED_ASSISTANT_LANGUAGES:
        if candidate:
            logger.debug(
                "Unsupported assistant language '%s'; falling back to '%s'",
                candidate,
                fallback,
            )
        return fallback

    if candidate and candidate in SUPPORTED_ASSISTANT_LANGUAGES:
        return candidate

    if fallback:
        logger.debug(
            "Fallback assistant language '%s' is unsupported; defaulting to 'it'",
            fallback,
        )
    return "it"


def prepare_chat_messages(raw_messages: list[dict[str, Any]]) -> list[ChatMessage]:
    """
    Convert raw payload messages into sanitized ChatMessage objects.

    Args:
        raw_messages: List of raw message dictionaries

    Returns:
        List of ChatMessage objects
    """
    prepared: list[ChatMessage] = []
    for msg in raw_messages or []:
        role = (msg.get("role") or "user").strip().lower()
        if role not in {"user", "assistant", "system", "tool"}:
            role = "user"
        content = msg.get("content", "") or ""
        if role in {"user", "system"}:
            content = sanitize_input(content)
        prepared.append(ChatMessage(role=role, content=content))
    return prepared
