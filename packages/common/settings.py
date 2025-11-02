"""Settings management for the ingestion and processing pipeline."""

from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None  # type: ignore[assignment]
else:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(env_path, override=False)

from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseConfig(BaseModel):
    """Database connection and pool configuration."""

    url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/youworker",
        description="PostgreSQL connection URL with asyncpg driver"
    )
    echo: bool = Field(default=False, description="Log all SQL queries")
    pool_size: int = Field(default=10, ge=1, le=100, description="Connection pool size")
    max_overflow: int = Field(default=20, ge=0, le=100, description="Max overflow connections beyond pool size")
    pool_timeout: int = Field(default=30, ge=5, le=300, description="Seconds to wait for connection")
    pool_recycle: int = Field(default=3600, ge=300, le=7200, description="Seconds before recycling connections")
    pool_pre_ping: bool = Field(default=True, description="Test connections before using them")
    echo_pool: bool = Field(default=False, description="Log connection pool operations")
    slow_query_threshold: float = Field(
        default=1.0,
        ge=0.1,
        le=60.0,
        description="Log queries taking longer than this threshold in seconds"
    )

    @field_validator("url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate database URL uses asyncpg driver."""
        if not v.startswith("postgresql+asyncpg://"):
            raise ValueError(
                "DATABASE_URL must use asyncpg driver for async support. "
                "Expected format: postgresql+asyncpg://user:pass@host:port/dbname"
            )
        return v


class SecurityConfig(BaseModel):
    """Security, authentication, and encryption settings."""

    root_api_key: str = Field(default="rotated-dev-root-key", description="Root API key for admin access")
    jwt_secret: str = Field(default="rotated-dev-jwt-secret", description="JWT signing secret")
    csrf_secret: str | None = Field(default=None, description="CSRF token secret (defaults to JWT secret)")
    csrf_cookie_name: str = Field(default="youworker_csrf", description="CSRF cookie name")
    csrf_header_name: str = Field(default="X-CSRF-Token", description="CSRF header name")
    csrf_token_ttl_seconds: int = Field(default=3600, ge=60, description="CSRF token TTL in seconds")
    chat_message_encryption_secret: str | None = Field(
        default=None,
        description="Fernet key for chat message encryption (defaults to JWT secret)"
    )
    whitelisted_ips: str = Field(default="", description="Comma-separated IPs for production access control")

    # Authentik SSO integration
    authentik_enabled: bool = Field(default=False, description="Enable Authentik SSO")
    authentik_header_name: str = Field(default="x-authentik-api-key", description="Authentik API key header")
    authentik_forward_user_header: str | None = Field(default=None, description="Authentik forwarded user header")


class OllamaConfig(BaseModel):
    """Ollama LLM service configuration."""

    base_url: str = Field(default="http://localhost:11434", description="Ollama API base URL")
    chat_model: str = Field(default="gpt-oss:20b", description="Default chat model")
    embed_model: str = Field(default="embeddinggemma:300m", description="Default embedding model")
    auto_pull: bool = Field(default=True, description="Auto-pull models if not available")

    @field_validator("base_url")
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


class QdrantConfig(BaseModel):
    """Qdrant vector database configuration."""

    url: str = Field(default="http://localhost:6333", description="Qdrant API URL")
    collection: str = Field(default="documents", description="Default collection name")
    embedding_dim: int = Field(default=768, description="Embedding vector dimension")

    @field_validator("url")
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


class IngestionConfig(BaseModel):
    """Document ingestion and processing configuration."""

    max_concurrency: int = Field(default=4, ge=1, description="Max concurrent ingestion jobs")
    chunk_size: int = Field(default=500, ge=50, description="Text chunk size for splitting")
    chunk_overlap: int = Field(default=50, ge=0, description="Overlap between chunks")
    upload_root: str = Field(default="data/uploads", description="Upload directory path")

    # Whisper transcription tuning
    whisper_model: str | None = Field(default=None, description="Whisper model name")
    whisper_compute_type: str | None = Field(default=None, description="Whisper compute type")
    whisper_gpu_compute_type: str | None = Field(default=None, description="Whisper GPU compute type")
    whisper_cpu_threads: int | None = Field(default=None, ge=1, description="Whisper CPU threads")
    whisper_num_workers: int | None = Field(default=None, ge=1, description="Whisper worker count")
    whisper_language: str | None = Field(default=None, description="Whisper language code")
    whisper_accelerator: str | None = Field(default=None, description="Whisper accelerator type")
    whisper_device: str | None = Field(default=None, description="Whisper device ID")

    # Accelerator settings for Docling/OCR
    accelerator: Literal["auto", "cpu", "cuda", "mps"] = Field(default="auto", description="Global accelerator type")
    docling_accelerator: str | None = Field(default=None, description="Docling-specific accelerator")
    ocr_accelerator: str | None = Field(default=None, description="OCR-specific accelerator")
    transcription_accelerator: str | None = Field(default=None, description="Transcription-specific accelerator")

    # GPU device selection
    gpu_device: str | None = Field(default=None, description="Global GPU device ID")
    docling_device: str | None = Field(default=None, description="Docling-specific GPU device")
    ocr_device: str | None = Field(default=None, description="OCR-specific GPU device")
    transcription_device: str | None = Field(default=None, description="Transcription-specific GPU device")

    # HTTP settings
    user_agent: str | None = Field(default=None, description="Custom User-Agent for HTTP requests")

    # Web crawling
    crawl_max_depth: int = Field(default=2, ge=1, description="Max crawl depth")
    crawl_max_pages: int = Field(default=50, ge=1, description="Max pages to crawl")


class AgentConfig(BaseModel):
    """AI agent behavior configuration."""

    max_iterations: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum tool call iterations before stopping agent loop (prevents infinite loops)"
    )
    default_language: str = Field(default="it", description="Default agent response language")


class MCPConfig(BaseModel):
    """Model Context Protocol server configuration."""

    server_urls: str = Field(default="", description="Comma-separated MCP server URLs")
    refresh_interval: int = Field(default=90, ge=10, description="Health check interval in seconds")


class RetryConfig(BaseModel):
    """Retry behavior for external service calls."""

    max_attempts: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Default maximum retry attempts for external service calls"
    )
    min_wait: float = Field(
        default=1.0,
        ge=0.1,
        le=60.0,
        description="Minimum wait time between retries in seconds"
    )
    max_wait: float = Field(
        default=10.0,
        ge=0.5,
        le=300.0,
        description="Maximum wait time between retries in seconds"
    )
    multiplier: float = Field(
        default=2.0,
        ge=1.0,
        le=5.0,
        description="Exponential backoff multiplier for retry wait times"
    )


class APIConfig(BaseModel):
    """API server configuration."""

    host: str = Field(default="0.0.0.0", description="API server host")
    port: int = Field(default=8001, ge=1, le=65535, description="API server port")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO",
        description="Logging level"
    )
    app_env: Literal["development", "staging", "production"] = Field(
        default="development",
        description="Application environment"
    )
    frontend_origin: str = Field(
        default="http://localhost:8000",
        description="Comma-separated CORS allowed origins"
    )

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


class Settings(BaseSettings):
    """Application settings with domain-specific configuration groups."""

    # Domain-specific configuration groups
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    ollama: OllamaConfig = Field(default_factory=OllamaConfig)
    qdrant: QdrantConfig = Field(default_factory=QdrantConfig)
    ingestion: IngestionConfig = Field(default_factory=IngestionConfig)
    agent: AgentConfig = Field(default_factory=AgentConfig)
    mcp: MCPConfig = Field(default_factory=MCPConfig)
    retry: RetryConfig = Field(default_factory=RetryConfig)
    api: APIConfig = Field(default_factory=APIConfig)

    # Flat legacy fields for backward compatibility (mapped from nested configs)
    @property
    def database_url(self) -> str:
        return self.database.url

    @property
    def db_echo(self) -> bool:
        return self.database.echo

    @property
    def db_pool_size(self) -> int:
        return self.database.pool_size

    @property
    def db_max_overflow(self) -> int:
        return self.database.max_overflow

    @property
    def db_pool_timeout(self) -> int:
        return self.database.pool_timeout

    @property
    def db_pool_recycle(self) -> int:
        return self.database.pool_recycle

    @property
    def db_pool_pre_ping(self) -> bool:
        return self.database.pool_pre_ping

    @property
    def db_echo_pool(self) -> bool:
        return self.database.echo_pool

    @property
    def db_slow_query_threshold(self) -> float:
        return self.database.slow_query_threshold

    @property
    def root_api_key(self) -> str:
        return self.security.root_api_key

    @property
    def jwt_secret(self) -> str:
        return self.security.jwt_secret

    @property
    def csrf_secret(self) -> str | None:
        return self.security.csrf_secret

    @property
    def csrf_cookie_name(self) -> str:
        return self.security.csrf_cookie_name

    @property
    def csrf_header_name(self) -> str:
        return self.security.csrf_header_name

    @property
    def csrf_token_ttl_seconds(self) -> int:
        return self.security.csrf_token_ttl_seconds

    @property
    def chat_message_encryption_secret(self) -> str | None:
        return self.security.chat_message_encryption_secret

    @property
    def whitelisted_ips(self) -> str:
        return self.security.whitelisted_ips

    @property
    def authentik_enabled(self) -> bool:
        return self.security.authentik_enabled

    @property
    def authentik_header_name(self) -> str:
        return self.security.authentik_header_name

    @property
    def authentik_forward_user_header(self) -> str | None:
        return self.security.authentik_forward_user_header

    @property
    def ollama_base_url(self) -> str:
        return self.ollama.base_url

    @property
    def chat_model(self) -> str:
        return self.ollama.chat_model

    @property
    def embed_model(self) -> str:
        return self.ollama.embed_model

    @property
    def ollama_auto_pull(self) -> bool:
        return self.ollama.auto_pull

    @property
    def qdrant_url(self) -> str:
        return self.qdrant.url

    @property
    def qdrant_collection(self) -> str:
        return self.qdrant.collection

    @property
    def embedding_dim(self) -> int:
        return self.qdrant.embedding_dim

    @property
    def ingest_max_concurrency(self) -> int:
        return self.ingestion.max_concurrency

    @property
    def ingest_chunk_size(self) -> int:
        return self.ingestion.chunk_size

    @property
    def ingest_chunk_overlap(self) -> int:
        return self.ingestion.chunk_overlap

    @property
    def ingest_upload_root(self) -> str:
        return self.ingestion.upload_root

    @property
    def ingest_whisper_model(self) -> str | None:
        return self.ingestion.whisper_model

    @property
    def ingest_whisper_compute_type(self) -> str | None:
        return self.ingestion.whisper_compute_type

    @property
    def ingest_whisper_gpu_compute_type(self) -> str | None:
        return self.ingestion.whisper_gpu_compute_type

    @property
    def ingest_whisper_cpu_threads(self) -> int | None:
        return self.ingestion.whisper_cpu_threads

    @property
    def ingest_whisper_num_workers(self) -> int | None:
        return self.ingestion.whisper_num_workers

    @property
    def ingest_whisper_language(self) -> str | None:
        return self.ingestion.whisper_language

    @property
    def ingest_whisper_accelerator(self) -> str | None:
        return self.ingestion.whisper_accelerator

    @property
    def ingest_whisper_device(self) -> str | None:
        return self.ingestion.whisper_device

    @property
    def ingest_accelerator(self) -> str:
        return self.ingestion.accelerator

    @property
    def ingest_docling_accelerator(self) -> str | None:
        return self.ingestion.docling_accelerator

    @property
    def ingest_ocr_accelerator(self) -> str | None:
        return self.ingestion.ocr_accelerator

    @property
    def ingest_transcription_accelerator(self) -> str | None:
        return self.ingestion.transcription_accelerator

    @property
    def ingest_gpu_device(self) -> str | None:
        return self.ingestion.gpu_device

    @property
    def ingest_docling_device(self) -> str | None:
        return self.ingestion.docling_device

    @property
    def ingest_ocr_device(self) -> str | None:
        return self.ingestion.ocr_device

    @property
    def ingest_transcription_device(self) -> str | None:
        return self.ingestion.transcription_device

    @property
    def ingest_user_agent(self) -> str | None:
        return self.ingestion.user_agent

    @property
    def crawl_max_depth(self) -> int:
        return self.ingestion.crawl_max_depth

    @property
    def crawl_max_pages(self) -> int:
        return self.ingestion.crawl_max_pages

    @property
    def max_agent_iterations(self) -> int:
        return self.agent.max_iterations

    @property
    def agent_default_language(self) -> str:
        return self.agent.default_language

    @property
    def mcp_server_urls(self) -> str:
        return self.mcp.server_urls

    @property
    def mcp_refresh_interval(self) -> int:
        return self.mcp.refresh_interval

    @property
    def retry_max_attempts(self) -> int:
        return self.retry.max_attempts

    @property
    def retry_min_wait(self) -> float:
        return self.retry.min_wait

    @property
    def retry_max_wait(self) -> float:
        return self.retry.max_wait

    @property
    def retry_multiplier(self) -> float:
        return self.retry.multiplier

    @property
    def api_host(self) -> str:
        return self.api.host

    @property
    def api_port(self) -> int:
        return self.api.port

    @property
    def log_level(self) -> str:
        return self.api.log_level

    @property
    def app_env(self) -> str:
        return self.api.app_env

    @property
    def frontend_origin(self) -> str:
        return self.api.frontend_origin

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
        env_nested_delimiter="__"  # Support DATABASE__URL style env vars
    )

    def model_post_init(self, __context) -> None:
        """Post-initialization to handle flat environment variables for backward compatibility."""
        import os

        # Map flat env vars to nested config objects
        env_mappings = {
            # Database
            "DATABASE_URL": ("database", "url"),
            "DB_ECHO": ("database", "echo"),
            "DB_POOL_SIZE": ("database", "pool_size"),
            "DB_MAX_OVERFLOW": ("database", "max_overflow"),
            "DB_POOL_TIMEOUT": ("database", "pool_timeout"),
            "DB_POOL_RECYCLE": ("database", "pool_recycle"),
            "DB_POOL_PRE_PING": ("database", "pool_pre_ping"),
            "DB_ECHO_POOL": ("database", "echo_pool"),
            "DB_SLOW_QUERY_THRESHOLD": ("database", "slow_query_threshold"),

            # Security
            "ROOT_API_KEY": ("security", "root_api_key"),
            "JWT_SECRET": ("security", "jwt_secret"),
            "CSRF_SECRET": ("security", "csrf_secret"),
            "CSRF_COOKIE_NAME": ("security", "csrf_cookie_name"),
            "CSRF_HEADER_NAME": ("security", "csrf_header_name"),
            "CSRF_TOKEN_TTL_SECONDS": ("security", "csrf_token_ttl_seconds"),
            "CHAT_MESSAGE_ENCRYPTION_SECRET": ("security", "chat_message_encryption_secret"),
            "WHITELISTED_IPS": ("security", "whitelisted_ips"),
            "AUTHENTIK_ENABLED": ("security", "authentik_enabled"),
            "AUTHENTIK_HEADER_NAME": ("security", "authentik_header_name"),
            "AUTHENTIK_FORWARD_USER_HEADER": ("security", "authentik_forward_user_header"),

            # Ollama
            "OLLAMA_BASE_URL": ("ollama", "base_url"),
            "CHAT_MODEL": ("ollama", "chat_model"),
            "EMBED_MODEL": ("ollama", "embed_model"),
            "OLLAMA_AUTO_PULL": ("ollama", "auto_pull"),

            # Qdrant
            "QDRANT_URL": ("qdrant", "url"),
            "QDRANT_COLLECTION": ("qdrant", "collection"),
            "EMBEDDING_DIM": ("qdrant", "embedding_dim"),

            # Ingestion
            "INGEST_MAX_CONCURRENCY": ("ingestion", "max_concurrency"),
            "INGEST_CHUNK_SIZE": ("ingestion", "chunk_size"),
            "INGEST_CHUNK_OVERLAP": ("ingestion", "chunk_overlap"),
            "INGEST_UPLOAD_ROOT": ("ingestion", "upload_root"),
            "INGEST_WHISPER_MODEL": ("ingestion", "whisper_model"),
            "INGEST_WHISPER_COMPUTE_TYPE": ("ingestion", "whisper_compute_type"),
            "INGEST_WHISPER_GPU_COMPUTE_TYPE": ("ingestion", "whisper_gpu_compute_type"),
            "INGEST_WHISPER_CPU_THREADS": ("ingestion", "whisper_cpu_threads"),
            "INGEST_WHISPER_NUM_WORKERS": ("ingestion", "whisper_num_workers"),
            "INGEST_WHISPER_LANGUAGE": ("ingestion", "whisper_language"),
            "INGEST_WHISPER_ACCELERATOR": ("ingestion", "whisper_accelerator"),
            "INGEST_WHISPER_DEVICE": ("ingestion", "whisper_device"),
            "INGEST_ACCELERATOR": ("ingestion", "accelerator"),
            "INGEST_DOCLING_ACCELERATOR": ("ingestion", "docling_accelerator"),
            "INGEST_OCR_ACCELERATOR": ("ingestion", "ocr_accelerator"),
            "INGEST_TRANSCRIPTION_ACCELERATOR": ("ingestion", "transcription_accelerator"),
            "INGEST_GPU_DEVICE": ("ingestion", "gpu_device"),
            "INGEST_DOCLING_DEVICE": ("ingestion", "docling_device"),
            "INGEST_OCR_DEVICE": ("ingestion", "ocr_device"),
            "INGEST_TRANSCRIPTION_DEVICE": ("ingestion", "transcription_device"),
            "INGEST_USER_AGENT": ("ingestion", "user_agent"),
            "CRAWL_MAX_DEPTH": ("ingestion", "crawl_max_depth"),
            "CRAWL_MAX_PAGES": ("ingestion", "crawl_max_pages"),

            # Agent
            "MAX_AGENT_ITERATIONS": ("agent", "max_iterations"),
            "AGENT_DEFAULT_LANGUAGE": ("agent", "default_language"),

            # MCP
            "MCP_SERVER_URLS": ("mcp", "server_urls"),
            "MCP_REFRESH_INTERVAL": ("mcp", "refresh_interval"),

            # Retry
            "RETRY_MAX_ATTEMPTS": ("retry", "max_attempts"),
            "RETRY_MIN_WAIT": ("retry", "min_wait"),
            "RETRY_MAX_WAIT": ("retry", "max_wait"),
            "RETRY_MULTIPLIER": ("retry", "multiplier"),

            # API
            "API_HOST": ("api", "host"),
            "API_PORT": ("api", "port"),
            "LOG_LEVEL": ("api", "log_level"),
            "APP_ENV": ("api", "app_env"),
            "FRONTEND_ORIGIN": ("api", "frontend_origin"),
        }

        # Apply flat env vars to nested configs
        for env_var, (config_group, config_field) in env_mappings.items():
            env_value = os.getenv(env_var)
            if env_value is not None:
                config_obj = getattr(self, config_group)
                current_value = getattr(config_obj, config_field)

                # Type conversion
                if isinstance(current_value, bool):
                    env_value = env_value.lower() in ("true", "1", "yes")
                elif isinstance(current_value, int):
                    env_value = int(env_value)
                elif isinstance(current_value, float):
                    env_value = float(env_value)

                # Update the nested config
                setattr(config_obj, config_field, env_value)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
