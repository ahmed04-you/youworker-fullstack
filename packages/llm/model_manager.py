"""
Ollama model lifecycle management for ingestion pipeline.

Handles loading, unloading, and swapping models to optimize memory usage
during document ingestion with vision models.
"""

import asyncio
import logging
from typing import Literal

import httpx

from packages.common import Settings, get_settings

logger = logging.getLogger(__name__)


ModelName = Literal["chat", "vision", "embedding", "stt"]


class OllamaModelManager:
    """
    Manages Ollama model lifecycle for efficient memory usage.

    Strategy:
    - Chat mode: Keep gpt-oss:20b loaded in GPU
    - Ingestion mode: Unload chat, load qwen3-vl:4b-instruct + embeddinggemma:300m
    - STT model stays in system RAM throughout
    """

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.base_url = self.settings.ollama_base_url
        self._client = httpx.AsyncClient(timeout=300.0)
        self._loaded_models: set[str] = set()

        # Model configurations
        self.models = {
            "chat": self.settings.chat_model,  # gpt-oss:20b
            "vision": "qwen3-vl:4b-instruct",
            "embedding": self.settings.embed_model,  # embeddinggemma:300m
        }

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._client.aclose()

    async def unload_model(self, model_name: str, max_retries: int = 3) -> bool:
        """
        Unload a model from Ollama by setting keep_alive=0.

        Args:
            model_name: Name of the model to unload (e.g., "gpt-oss:20b")
            max_retries: Number of retry attempts

        Returns:
            True if successfully unloaded, False otherwise
        """
        logger.info(f"Unloading model: {model_name}")

        for attempt in range(max_retries):
            try:
                # Send a minimal request with keep_alive=0 to unload immediately
                response = await self._client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": "",  # Empty prompt to minimize processing
                        "stream": False,
                        "keep_alive": 0,  # Unload immediately after response
                    },
                    timeout=60.0,
                )

                if response.status_code == 200:
                    self._loaded_models.discard(model_name)
                    logger.info(f"Successfully unloaded model: {model_name}")
                    return True
                else:
                    logger.warning(
                        f"Failed to unload model {model_name}: "
                        f"status={response.status_code}, attempt={attempt + 1}/{max_retries}"
                    )
            except Exception as e:
                logger.error(
                    f"Error unloading model {model_name}: {e}, attempt={attempt + 1}/{max_retries}"
                )

            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

        return False

    async def preload_model(self, model_name: str, keep_alive_minutes: int = -1) -> bool:
        """
        Preload a model into memory.

        Args:
            model_name: Name of the model to preload
            keep_alive_minutes: How long to keep in memory (-1 = forever, 0 = unload immediately)

        Returns:
            True if successfully loaded
        """
        logger.info(f"Preloading model: {model_name} (keep_alive={keep_alive_minutes}m)")

        try:
            # Use keep_alive to control how long model stays in memory
            keep_alive_str = f"{keep_alive_minutes}m" if keep_alive_minutes >= 0 else "-1"

            response = await self._client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model_name,
                    "prompt": "Hello",  # Minimal prompt to trigger load
                    "stream": False,
                    "keep_alive": keep_alive_str,
                },
                timeout=300.0,  # Models can take time to load
            )

            if response.status_code == 200:
                self._loaded_models.add(model_name)
                logger.info(f"Successfully preloaded model: {model_name}")
                return True
            else:
                logger.error(
                    f"Failed to preload model {model_name}: status={response.status_code}"
                )
                return False

        except Exception as e:
            logger.error(f"Error preloading model {model_name}: {e}")
            return False

    async def switch_to_ingestion_mode(self) -> bool:
        """
        Switch from chat mode to ingestion mode.

        Unloads: gpt-oss:20b (chat model)
        Loads: qwen3-vl:4b-instruct (vision), embeddinggemma:300m (embedding)
        Keeps: STT model in system RAM (managed separately)

        Returns:
            True if successful
        """
        logger.info("Switching to ingestion mode")

        # Step 1: Unload chat model
        chat_model = self.models["chat"]
        if not await self.unload_model(chat_model):
            logger.warning(f"Failed to unload chat model {chat_model}, continuing anyway")

        # Wait a bit for memory to free up
        await asyncio.sleep(2)

        # Step 2: Preload vision model
        vision_model = self.models["vision"]
        if not await self.preload_model(vision_model, keep_alive_minutes=30):
            logger.error("Failed to preload vision model")
            return False

        # Step 3: Ensure embedding model is loaded
        embedding_model = self.models["embedding"]
        if not await self.preload_model(embedding_model, keep_alive_minutes=30):
            logger.error("Failed to preload embedding model")
            return False

        logger.info("Successfully switched to ingestion mode")
        return True

    async def switch_to_chat_mode(self) -> bool:
        """
        Switch from ingestion mode back to chat mode.

        Unloads: qwen3-vl:4b-instruct (vision)
        Loads: gpt-oss:20b (chat model)
        Keeps: embeddinggemma:300m (for RAG), STT model in system RAM

        Returns:
            True if successful
        """
        logger.info("Switching to chat mode")

        # Step 1: Unload vision model
        vision_model = self.models["vision"]
        if not await self.unload_model(vision_model):
            logger.warning(f"Failed to unload vision model {vision_model}, continuing anyway")

        # Wait a bit for memory to free up
        await asyncio.sleep(2)

        # Step 2: Reload chat model
        chat_model = self.models["chat"]
        if not await self.preload_model(chat_model, keep_alive_minutes=-1):  # Keep forever
            logger.error("Failed to reload chat model")
            return False

        logger.info("Successfully switched to chat mode")
        return True

    async def get_loaded_models(self) -> list[dict]:
        """
        Get list of currently loaded models from Ollama.

        Returns:
            List of loaded model info dicts
        """
        try:
            response = await self._client.get(f"{self.base_url}/api/ps")
            if response.status_code == 200:
                data = response.json()
                return data.get("models", [])
        except Exception as e:
            logger.error(f"Error getting loaded models: {e}")

        return []

    async def ensure_startup_models_loaded(self) -> None:
        """
        Ensure required models are loaded on application startup.

        Loads:
        - gpt-oss:20b (chat model) on GPU
        - STT model is loaded separately via audio_pipeline
        """
        logger.info("Ensuring startup models are loaded")

        chat_model = self.models["chat"]
        await self.preload_model(chat_model, keep_alive_minutes=-1)  # Keep indefinitely

        # Note: STT model (faster-whisper) is managed separately via audio_pipeline
        # and loads into system RAM automatically on first use

        logger.info("Startup models ready")


# Global instance
_model_manager: OllamaModelManager | None = None


async def get_model_manager() -> OllamaModelManager:
    """Get or create global model manager instance."""
    global _model_manager
    if _model_manager is None:
        _model_manager = OllamaModelManager()
    return _model_manager
