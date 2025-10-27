"""Settings management for the ingestion and processing pipeline."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with defaults for ingestion pipeline."""

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    chat_model: str = "gpt-oss:20b"
    embed_model: str = "embeddinggemma:300m"
    ollama_auto_pull: bool = True

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "documents"
    embedding_dim: int = 768  # embeddinggemma:300m dimension

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    log_level: str = "INFO"
    app_env: str = "development"  # production, development, staging
    root_api_key: str = "rotated-dev-root-key"
    jwt_secret: str = "rotated-dev-jwt-secret"
    frontend_origin: str = "http://localhost:8000"
    whitelisted_ips: str = ""  # Comma-separated IPs for production access control

    # Authentik SSO integration
    authentik_enabled: bool = False
    authentik_header_name: str = "x-authentik-api-key"
    authentik_forward_user_header: str | None = None

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/youworker"

    # Ingestion
    ingest_max_concurrency: int = 4
    ingest_chunk_size: int = 500
    ingest_chunk_overlap: int = 50

    # Whisper transcription tuning
    ingest_whisper_model: str | None = None
    ingest_whisper_compute_type: str | None = None
    ingest_whisper_gpu_compute_type: str | None = None
    ingest_whisper_cpu_threads: int | None = None
    ingest_whisper_num_workers: int | None = None
    ingest_whisper_language: str | None = None
    ingest_whisper_accelerator: str | None = None
    ingest_whisper_device: str | None = None

    # Accelerator settings for Docling/OCR
    ingest_accelerator: str = "auto"  # auto, cpu, cuda, mps
    ingest_docling_accelerator: str | None = None
    ingest_ocr_accelerator: str | None = None
    ingest_transcription_accelerator: str | None = None

    # GPU device selection
    ingest_gpu_device: str | None = None
    ingest_docling_device: str | None = None
    ingest_ocr_device: str | None = None
    ingest_transcription_device: str | None = None

    # Ingest HTTP settings
    ingest_user_agent: str | None = None
    ingest_upload_root: str = "data/uploads"

    # Web crawling
    crawl_max_depth: int = 2
    crawl_max_pages: int = 50

    # MCP Servers
    mcp_server_urls: str = ""
    mcp_refresh_interval: int = 90

    # Agent
    max_agent_iterations: int = 10
    agent_default_language: str = "it"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
