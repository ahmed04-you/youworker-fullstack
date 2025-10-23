"""Configuration management for the API service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    chat_model: str = "gpt-oss:20b"
    embed_model: str = "embeddinggemma:300m"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "documents"
    embedding_dim: int = 768

    # MCP Servers
    mcp_server_urls: str = ""  # Comma-separated URLs
    mcp_refresh_interval: int = 90  # Seconds between tool refreshes

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    log_level: str = "INFO"
    frontend_origin: str = "http://localhost:8000"
    root_api_key: str = "dev-root-key"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/youworker"

    # Agent
    max_agent_iterations: int = 10

    # Ingestion paths
    ingest_upload_root: str = "/data/uploads"
    ingest_examples_dir: str = "/data/examples"
    ingest_user_agent: str | None = None

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()
