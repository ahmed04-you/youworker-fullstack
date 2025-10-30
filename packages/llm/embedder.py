"""
Embedder client for generating text embeddings via Ollama.
"""

import asyncio
import logging
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from packages.common import Settings

logger = logging.getLogger(__name__)


class Embedder:
    """
    Client for generating embeddings using Ollama.

    Supports batch processing for efficiency.
    """

    def __init__(self, settings: "Settings", batch_size: int = 32):
        """
        Initialize embedder.

        Args:
            settings: Application settings
            batch_size: Number of texts to embed in each batch
        """
        self.settings = settings
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.embed_model
        self.batch_size = batch_size
        self.client = httpx.AsyncClient(timeout=300.0)
        self._sem = asyncio.Semaphore(8)

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()

    async def embed_text(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector
        """
        embeddings = await self.embed_texts([text])
        return embeddings[0] if embeddings else []

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts in batches.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        # Process in batches for efficiency
        all_embeddings: list[list[float]] = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            batch_embeddings = await self._embed_batch(batch)
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    async def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Embed a batch of texts.

        Args:
            texts: Batch of texts

        Returns:
            List of embeddings
        """
        # Create tasks for parallel embedding
        tasks = [self._embed_single(text) for text in texts]
        embeddings = await asyncio.gather(*tasks)
        return embeddings

    async def _embed_single(self, text: str) -> list[float]:
        """
        Generate embedding for a single text via Ollama API.

        Args:
            text: Text to embed

        Returns:
            Embedding vector
        """
        payload = {
            "model": self.model,
            "prompt": text,
        }

        try:
            async with self._sem:
                response = await self.client.post(
                    f"{self.base_url}/api/embeddings",
                    json=payload,
                )
            response.raise_for_status()

            data = response.json()
            embedding = data.get("embedding", [])

            if not embedding:
                logger.warning(
                    "Empty embedding received from Ollama",
                    extra={"text_preview": text[:100], "model": self.model}
                )
                return []

            return embedding

        except httpx.HTTPStatusError as e:
            logger.error(
                "Ollama API error",
                extra={
                    "status_code": e.response.status_code,
                    "response_text": e.response.text,
                    "model": self.model,
                    "base_url": self.base_url
                }
            )
            raise
        except Exception as e:
            logger.error(
                "Failed to generate embedding",
                extra={"error": str(e), "error_type": type(e).__name__, "model": self.model}
            )
            raise
