from __future__ import annotations

import base64
import hashlib
import logging
from datetime import datetime, timezone
from functools import lru_cache

import sqlalchemy as sa
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from sqlalchemy.types import TypeDecorator

from .session import Base
from packages.common import get_settings
from packages.common.exceptions import ConfigurationError


@lru_cache(maxsize=1)
def _get_message_fernet() -> Fernet | None:
    settings = get_settings()
    secret_source = (
        settings.chat_message_encryption_secret
        or settings.jwt_secret
        or settings.root_api_key
    )
    if not secret_source:
        return None
    key_material = hashlib.sha256(secret_source.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(key_material)
    return Fernet(key)


class EncryptedContent(TypeDecorator):
    """Fernet-based encryption for chat messages - MANDATORY for security compliance."""

    impl = sa.LargeBinary
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, bytes):
            return value
        if isinstance(value, str):
            fernet = _get_message_fernet()
            # CRITICAL: Encryption is now mandatory
            if fernet is None:
                raise ConfigurationError(
                    "Chat message encryption is mandatory but CHAT_MESSAGE_ENCRYPTION_SECRET "
                    "is not configured. Generate one with: "
                    "python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
                )
            raw = value.encode("utf-8")
            try:
                return fernet.encrypt(raw)
            except Exception as e:
                raise ValueError(f"Encryption failed: {e}") from e
        raise TypeError("content must be str or bytes")

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (bytes, bytearray, memoryview)):
            data = bytes(value)
            fernet = _get_message_fernet()
            # CRITICAL: Decryption requires valid key
            if fernet is None:
                raise ConfigurationError(
                    "Cannot decrypt message: CHAT_MESSAGE_ENCRYPTION_SECRET not configured"
                )
            try:
                decrypted = fernet.decrypt(data)
                return decrypted.decode("utf-8")
            except InvalidToken:
                # Try to decode as plaintext for migration purposes only
                # This allows reading old unencrypted data during migration
                logger = logging.getLogger(__name__)
                logger.warning(
                    "Found unencrypted message data - migration required",
                    extra={"data_length": len(data), "migration_needed": True}
                )
                return data.decode("utf-8", errors="ignore")
            except Exception as e:
                raise ValueError(f"Decryption failed: {e}") from e
        return value


class User(AsyncAttrs, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    is_root: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    api_key_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sessions: Mapped[list["ChatSession"]] = relationship(back_populates="user")


class ChatSession(AsyncAttrs, Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str | None] = mapped_column(String(64), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str | None] = mapped_column(String(256))
    model: Mapped[str | None] = mapped_column(String(128))
    enable_tools: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped[User] = relationship(back_populates="sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )

    __table_args__ = (Index("idx_chat_sessions_user_created", "user_id", created_at.desc()),)


class ChatMessage(AsyncAttrs, Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16), index=True)
    content: Mapped[str | None] = mapped_column(EncryptedContent, nullable=True)
    tool_call_name: Mapped[str | None] = mapped_column(String(256))
    tool_call_id: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    tokens_in: Mapped[int | None] = mapped_column(Integer)
    tokens_out: Mapped[int | None] = mapped_column(Integer)

    session: Mapped[ChatSession] = relationship(back_populates="messages")

    __table_args__ = (
        Index("idx_chat_messages_session_created", "session_id", created_at.desc()),
        Index(
            "idx_chat_messages_tokens",
            "session_id",
            "tokens_in",
            "tokens_out",
            postgresql_where=tokens_in.isnot(None),
        ),
        Index(
            "idx_chat_messages_encrypted",
            "session_id",
            "created_at",
            postgresql_where=sa.text("content IS NOT NULL"),
        ),
    )


class MCPServer(AsyncAttrs, Base):
    __tablename__ = "mcp_servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    url: Mapped[str] = mapped_column(String(512))
    healthy: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tools: Mapped[list["Tool"]] = relationship(
        back_populates="server", cascade="all, delete-orphan"
    )


class Tool(AsyncAttrs, Base):
    __tablename__ = "tools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mcp_server_id: Mapped[int] = mapped_column(
        ForeignKey("mcp_servers.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(256), index=True)  # qualified name like web.search
    description: Mapped[str | None] = mapped_column(Text)
    input_schema: Mapped[dict | None] = mapped_column(JSONB)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    @validates("input_schema")
    def validate_input_schema(self, key, value):
        if value:
            import json

            schema_json = json.dumps(value, ensure_ascii=False)
            if len(schema_json) > 10000:  # 10KB limit
                raise ValueError("input_schema too large (max 10KB)")
        return value

    server: Mapped[MCPServer] = relationship(back_populates="tools")
    __table_args__ = (UniqueConstraint("mcp_server_id", "name", name="uq_tool_server_name"),)


class ToolRun(AsyncAttrs, Base):
    __tablename__ = "tool_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tool_id: Mapped[int | None] = mapped_column(
        ForeignKey("tools.id", ondelete="SET NULL"), index=True, nullable=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=True, index=True
    )
    tool_name: Mapped[str] = mapped_column(String(256), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    start_ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    end_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    args: Mapped[dict | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)
    result_preview: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("idx_tool_runs_user_start", "user_id", start_ts.desc()),
        Index("idx_tool_runs_tool_start", "tool_name", start_ts.desc()),
        Index("idx_tool_runs_analytics", "user_id", "tool_name", "status", start_ts.desc()),
        Index("idx_tool_runs_message", "message_id", start_ts.desc()),
    )


class IngestionRun(AsyncAttrs, Base):
    __tablename__ = "ingestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target: Mapped[str] = mapped_column(Text)
    from_web: Mapped[bool] = mapped_column(Boolean, default=False)
    recursive: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[dict | None] = mapped_column(JSONB)
    collection: Mapped[str | None] = mapped_column(String(128))
    totals_files: Mapped[int] = mapped_column(Integer, default=0)
    totals_chunks: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[dict | None] = mapped_column(JSONB)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="success", index=True)

    __table_args__ = (Index("idx_ingestion_runs_user_started", "user_id", started_at.desc()),)


class Document(AsyncAttrs, Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    uri: Mapped[str | None] = mapped_column(Text)
    path: Mapped[str | None] = mapped_column(Text)
    mime: Mapped[str | None] = mapped_column(String(128))
    bytes_size: Mapped[int | None] = mapped_column(BigInteger)
    source: Mapped[str | None] = mapped_column(String(32))
    tags: Mapped[dict | None] = mapped_column(JSONB)
    collection: Mapped[str | None] = mapped_column(String(128), index=True)
    path_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    last_ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship("User")

    @validates("tags")
    def validate_tags(self, key, value):
        if value:
            import json

            tags_json = json.dumps(value, ensure_ascii=False)
            if len(tags_json) > 5000:  # 5KB limit for tags
                raise ValueError("tags too large (max 5KB)")
        return value

    __table_args__ = (
        Index("idx_documents_collection_created", "collection", created_at.desc()),
        Index("idx_documents_user_created", "user_id", created_at.desc()),
        # path_hash is unique per user, not globally
        UniqueConstraint("user_id", "path_hash", name="uq_user_document_path"),
    )


class UserToolAccess(AsyncAttrs, Base):
    __tablename__ = "user_tool_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    tool_id: Mapped[int] = mapped_column(ForeignKey("tools.id", ondelete="CASCADE"))
    __table_args__ = (UniqueConstraint("user_id", "tool_id", name="uq_user_tool"),)


class DocumentCollection(AsyncAttrs, Base):
    __tablename__ = "document_collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class UserCollectionAccess(AsyncAttrs, Base):
    __tablename__ = "user_collection_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("document_collections.id", ondelete="CASCADE")
    )
    __table_args__ = (UniqueConstraint("user_id", "collection_id", name="uq_user_collection"),)


class UserDocumentAccess(AsyncAttrs, Base):
    __tablename__ = "user_document_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))

    __table_args__ = (UniqueConstraint("user_id", "document_id", name="uq_user_document"),)


class AuditLog(AsyncAttrs, Base):
    """
    Audit log for tracking sensitive operations and security events.

    Records user actions, administrative operations, and security-relevant events
    for compliance, debugging, and security monitoring purposes.
    """

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="User who performed the action (NULL for system actions)",
    )
    action: Mapped[str] = mapped_column(
        String(128),
        index=True,
        comment="Action type (e.g., 'user.login', 'document.delete', 'api_key.regenerate')",
    )
    resource_type: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="Type of resource affected (e.g., 'user', 'document', 'tool')",
    )
    resource_id: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        index=True,
        comment="ID of the affected resource",
    )
    changes: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="JSON object containing before/after values or action details",
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="IP address of the client (supports IPv6)",
    )
    user_agent: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="User agent string from the request",
    )
    correlation_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True,
        comment="Request correlation ID for tracing",
    )
    success: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
        comment="Whether the action succeeded",
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Error message if action failed",
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Relationships
    user: Mapped[User | None] = relationship("User")

    __table_args__ = (
        Index("idx_audit_logs_user_timestamp", "user_id", "timestamp"),
        Index("idx_audit_logs_action_timestamp", "action", "timestamp"),
        Index("idx_audit_logs_resource", "resource_type", "resource_id"),
    )
