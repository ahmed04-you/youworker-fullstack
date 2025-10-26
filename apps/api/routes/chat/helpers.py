"""
Helper functions for unified chat API.
"""

from typing import List
from packages.llm import ChatMessage as LLMChatMessage


def prepare_chat_messages(history: List[dict]) -> List[LLMChatMessage]:
    """Prepare chat messages for agent loop."""
    messages = []
    for msg in history:
        if isinstance(msg, dict) and "role" in msg and "content" in msg:
            messages.append(LLMChatMessage(role=msg["role"], content=msg["content"]))
    return messages


def resolve_assistant_language(language: str) -> str:
    """Resolve assistant language from request."""
    # Default to English if not specified
    return language or "en"
