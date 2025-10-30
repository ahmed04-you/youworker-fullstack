"""Settings management for the ingestion and processing pipeline."""

from functools import lru_cache
from urllib.parse import urlparse

from pydantic import Field, field_validator
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
    csrf_secret: str | None = None
    csrf_cookie_name: str = "youworker_csrf"
    csrf_header_name: str = "X-CSRF-Token"
    csrf_token_ttl_seconds: int = 3600
    chat_message_encryption_secret: str | None = None
    frontend_origin: str = "http://localhost:8000"
    whitelisted_ips: str = ""  # Comma-separated IPs for production access control

    # Authentik SSO integration
    authentik_enabled: bool = False
    authentik_header_name: str = "x-authentik-api-key"
    authentik_forward_user_header: str | None = None

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/youworker"
    db_echo: bool = False
    db_pool_size: int = Field(default=10, ge=1, le=100, description="Database connection pool size")
    db_max_overflow: int = Field(default=20, ge=0, le=100, description="Max overflow connections beyond pool size")
    db_pool_timeout: int = Field(default=30, ge=5, le=300, description="Seconds to wait for connection")
    db_pool_recycle: int = Field(default=3600, ge=300, le=7200, description="Seconds before recycling connections")
    db_pool_pre_ping: bool = Field(default=True, description="Test connections before using them")
    db_echo_pool: bool = Field(default=False, description="Log connection pool operations")
    db_slow_query_threshold: float = Field(
        default=1.0,
        ge=0.1,
        le=60.0,
        description="Log queries taking longer than this threshold in seconds"
    )

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
    max_agent_iterations: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum tool call iterations before stopping agent loop (prevents infinite loops)"
    )
    agent_default_language: str = "it"

    # Retry configuration
    retry_max_attempts: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Default maximum retry attempts for external service calls"
    )
    retry_min_wait: float = Field(
        default=1.0,
        ge=0.1,
        le=60.0,
        description="Minimum wait time between retries in seconds"
    )
    retry_max_wait: float = Field(
        default=10.0,
        ge=0.5,
        le=300.0,
        description="Maximum wait time between retries in seconds"
    )
    retry_multiplier: float = Field(
        default=2.0,
        ge=1.0,
        le=5.0,
        description="Exponential backoff multiplier for retry wait times"
    )

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate database URL uses asyncpg driver."""
        if not v.startswith("postgresql+asyncpg://"):
            raise ValueError(
                "DATABASE_URL must use asyncpg driver for async support. "
                "Expected format: postgresql+asyncpg://user:pass@host:port/dbname"
            )
        return v

    @field_validator("ollama_base_url", "qdrant_url")
    @classmethod
    def validate_http_url(cls, v: str) -> str:
        """Validate URL is HTTP or HTTPS."""
        if not v.startswith(("http://", "https://")):
            raise ValueError(f"URL must start with http:// or https://, got: {v}")
        try:
            parsed = urlparse(v)
            if not parsed.netloc:
                raise ValueError(f"Invalid URL: missing hostname in {v}")
        except Exception as e:
            raise ValueError(f"Invalid URL format: {e}")
        return v

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level is recognized."""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        v_upper = v.upper()
        if v_upper not in valid_levels:
            raise ValueError(
                f"LOG_LEVEL must be one of {valid_levels}, got: {v}"
            )
        return v_upper

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        """Validate app environment."""
        valid_envs = {"production", "development", "staging"}
        v_lower = v.lower()
        if v_lower not in valid_envs:
            raise ValueError(
                f"APP_ENV must be one of {valid_envs}, got: {v}"
            )
        return v_lower

    @field_validator("frontend_origin")
    @classmethod
    def validate_frontend_origin(cls, v: str) -> str:
        """Validate frontend origin URLs (can be comma-separated)."""
        origins = [origin.strip() for origin in v.split(",") if origin.strip()]
        if not origins:
            raise ValueError("FRONTEND_ORIGIN cannot be empty")

        for origin in origins:
            if not origin.startswith(("http://", "https://")):
                raise ValueError(
                    f"FRONTEND_ORIGIN must be HTTP/HTTPS URL(s), got: {origin}"
                )
            try:
                parsed = urlparse(origin)
                if not parsed.netloc:
                    raise ValueError(f"Invalid origin URL: {origin}")
                # Ensure no path, query, or fragment
                if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
                    raise ValueError(
                        f"FRONTEND_ORIGIN must be origin only (no path/query/fragment), got: {origin}"
                    )
            except Exception as e:
                raise ValueError(f"Invalid FRONTEND_ORIGIN format: {e}")

        return v


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
