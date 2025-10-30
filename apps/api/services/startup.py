"""
Startup and shutdown service for API initialization.
Handles database, clients, and registry setup.
"""

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from apps.api.config import settings
from packages.agent import MCPRegistry, AgentLoop
from packages.common.exceptions import ConfigurationError
from packages.db import init_db as init_database
from packages.ingestion import IngestionPipeline
from packages.llm import OllamaClient
from packages.vectorstore import QdrantStore

logger = logging.getLogger(__name__)


class StartupService:
    """Service for managing API startup and shutdown."""

    def __init__(self):
        self.ollama_client: OllamaClient | None = None
        self.vector_store: QdrantStore | None = None
        self.ingestion_pipeline: IngestionPipeline | None = None
        self.registry: MCPRegistry | None = None
        self.agent_loop: AgentLoop | None = None

    def _validate_encryption_config(self) -> None:
        """Validate that chat message encryption is properly configured."""
        from packages.db.models import _get_message_fernet

        fernet = _get_message_fernet()
        if fernet is None:
            logger.critical(
                "STARTUP FAILED: Chat message encryption is mandatory but "
                "CHAT_MESSAGE_ENCRYPTION_SECRET is not configured in .env. "
                "Generate one with: python -c "
                "'from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())'"
            )
            raise ConfigurationError(
                "Chat encryption secret not configured. "
                "Set CHAT_MESSAGE_ENCRYPTION_SECRET in .env"
            )

        # Test encryption/decryption to ensure key is valid
        try:
            test_data = "encryption_test"
            encrypted = fernet.encrypt(test_data.encode())
            decrypted = fernet.decrypt(encrypted).decode()
            if decrypted != test_data:
                raise ValueError("Encryption test failed: data mismatch")
        except Exception as e:
            logger.critical(
                "STARTUP FAILED: Encryption key validation failed",
                extra={"error": str(e), "error_type": type(e).__name__}
            )
            raise ConfigurationError(f"Invalid encryption configuration: {e}") from e

    def _validate_csrf_config(self) -> None:
        """Ensure CSRF protection has a configured secret."""
        from apps.api.csrf import ensure_csrf_secret

        try:
            ensure_csrf_secret()
        except RuntimeError as exc:
            logger.critical(
                "STARTUP FAILED: CSRF protection requires CSRF_SECRET or JWT_SECRET to be set: %s",
                exc,
            )
            raise

    async def initialize(self, app: FastAPI) -> None:
        """Initialize all services during startup."""
        logger.info("Starting up API service...")

        # CRITICAL: Validate encryption configuration before any operations
        logger.info("Validating encryption configuration...")
        self._validate_encryption_config()
        logger.info("✓ Chat message encryption validated")

        logger.info("Validating CSRF configuration...")
        self._validate_csrf_config()
        logger.info("✓ CSRF protection validated")

        # Ensure ingestion directories exist
        from pathlib import Path

        try:
            Path(settings.ingest_upload_root).mkdir(parents=True, exist_ok=True)
            logger.info(
                "Ensured directory exists",
                extra={"directory": str(settings.ingest_upload_root)}
            )
        except (OSError, PermissionError) as e:
            logger.warning(
                "Could not create directory",
                extra={
                    "directory": str(settings.ingest_upload_root),
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )

        # Initialize database
        logger.info("Initializing database...")
        await init_database(settings)  # type: ignore
        logger.info("Database initialized")

        # Initialize Ollama client
        logger.info("Initializing Ollama client...")
        self.ollama_client = OllamaClient(
            base_url=settings.ollama_base_url,
            auto_pull=settings.ollama_auto_pull,
        )
        logger.info("Ollama client initialized")

        # Initialize vector store
        logger.info("Initializing vector store...")
        self.vector_store = QdrantStore(
            url=settings.qdrant_url,
            embedding_dim=settings.embedding_dim,
            default_collection=settings.qdrant_collection,
        )
        logger.info("Vector store initialized")

        # Initialize ingestion pipeline
        self.ingestion_pipeline = IngestionPipeline(settings=settings)  # type: ignore

        # Parse MCP server URLs
        logger.info("Parsing MCP server URLs...")
        mcp_server_configs = []
        if settings.mcp_server_urls:

            def derive_server_id(raw_url: str) -> str:
                """Derive a stable server_id from a URL."""
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(raw_url)
                    host = (parsed.hostname or "").strip().strip("/")
                    if host:
                        base = host
                    else:
                        # e.g., ws:///mcp_web
                        base = parsed.path.strip("/") or raw_url

                    # Remove common prefixes
                    for prefix in ("mcp-", "mcp_", "mcp"):
                        if base.startswith(prefix):
                            base = base[len(prefix):]
                            break

                    # Final cleanup
                    base = base.split(".")[0]  # drop domain if any
                    base = base or (parsed.hostname or "server").split(".")[0]
                    return base
                except (ValueError, AttributeError):
                    return "server"

            for url in settings.mcp_server_urls.split(","):
                url = url.strip()
                if url:
                    server_id = derive_server_id(url)
                    mcp_server_configs.append({"server_id": server_id, "url": url})

        logger.info(
            "Configured MCP servers",
            extra={"mcp_servers": mcp_server_configs, "count": len(mcp_server_configs)}
        )

        # Initialize MCP registry
        self.registry = MCPRegistry(server_configs=mcp_server_configs)

        # Connect to all MCP servers and discover tools
        logger.info("About to connect to MCP servers...")
        try:
            await self.registry.connect_all()
            logger.info(
                "Connected to MCP servers",
                extra={"server_count": len(self.registry.clients)}
            )

            # Persist MCP servers and tools on refresh
            async def persist_registry(tools: dict[str, Any], clients: dict[str, Any]):
                from packages.db import get_async_session
                from packages.db.repositories import MCPRepository

                async with get_async_session() as db:
                    mcp_repo = MCPRepository(db)

                    # Servers
                    servers = []
                    for sid, client in clients.items():
                        servers.append(
                            (
                                sid,
                                client.ws_url.replace("ws://", "http://").replace("wss://", "https://"),
                                client.is_healthy,
                            )
                        )
                    smap = await mcp_repo.upsert_mcp_servers(servers)

                    # Tools
                    tool_rows = []
                    for qname, tool in tools.items():
                        tool_rows.append((tool.server_id, qname, tool.description, tool.input_schema))
                    await mcp_repo.upsert_tools(smap, tool_rows)

            self.registry.set_refreshed_callback(persist_registry)
            # Trigger initial persist now
            await persist_registry(self.registry.tools, self.registry.clients)
            # Start periodic refresh of tools
            refresh_interval = max(0, settings.mcp_refresh_interval)
            await self.registry.start_periodic_refresh(interval_seconds=refresh_interval)
        except (ConnectionError, TimeoutError, OSError) as e:
            logger.error(
                "Failed to connect to MCP servers",
                extra={"error": str(e), "error_type": type(e).__name__}
            )
            # Continue anyway - some servers may be unavailable

        # Initialize agent loop
        self.agent_loop = AgentLoop(
            ollama_client=self.ollama_client,
            registry=self.registry,
            model=settings.chat_model,
            default_language=settings.agent_default_language,
        )

        # Attach to app state
        app.state.ollama_client = self.ollama_client
        app.state.vector_store = self.vector_store
        app.state.ingestion_pipeline = self.ingestion_pipeline
        app.state.registry = self.registry
        app.state.agent_loop = self.agent_loop

        logger.info("API service ready")

    async def shutdown(self, app: FastAPI) -> None:
        """Clean up resources during shutdown."""
        logger.info("Shutting down API service...")
        if self.ollama_client:
            await self.ollama_client.close()
        if self.registry:
            await self.registry.stop_periodic_refresh()
            await self.registry.close_all()
        if self.vector_store:
            await self.vector_store.close()
