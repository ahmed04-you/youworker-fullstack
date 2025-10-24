from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .session import Base


class User(AsyncAttrs, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    is_root: Mapped[bool] = mapped_column(Boolean, default=False)
    api_key_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    sessions: Mapped[list["ChatSession"]] = relationship(back_populates="user")


class ChatSession(AsyncAttrs, Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[Optional[str]] = mapped_column(String(256))
    model: Mapped[Optional[str]] = mapped_column(String(128))
    enable_tools: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(AsyncAttrs, Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    tool_call_name: Mapped[Optional[str]] = mapped_column(String(256))
    tool_call_id: Mapped[Optional[str]] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    tokens_in: Mapped[Optional[int]] = mapped_column(Integer)
    tokens_out: Mapped[Optional[int]] = mapped_column(Integer)

    session: Mapped[ChatSession] = relationship(back_populates="messages")


class MCPServer(AsyncAttrs, Base):
    __tablename__ = "mcp_servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    url: Mapped[str] = mapped_column(String(512))
    healthy: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

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
    description: Mapped[Optional[str]] = mapped_column(Text)
    input_schema: Mapped[Optional[dict]] = mapped_column(JSONB)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    server: Mapped[MCPServer] = relationship(back_populates="tools")
    __table_args__ = (UniqueConstraint("mcp_server_id", "name", name="uq_tool_server_name"),)


class ToolRun(AsyncAttrs, Base):
    __tablename__ = "tool_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tool_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tools.id", ondelete="SET NULL"), index=True, nullable=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True
    )
    tool_name: Mapped[str] = mapped_column(String(256))
    status: Mapped[str] = mapped_column(String(32))
    start_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    end_ts: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    args: Mapped[Optional[dict]] = mapped_column(JSONB)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    result_preview: Mapped[Optional[str]] = mapped_column(Text)


class IngestionRun(AsyncAttrs, Base):
    __tablename__ = "ingestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    target: Mapped[str] = mapped_column(Text)
    from_web: Mapped[bool] = mapped_column(Boolean, default=False)
    recursive: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[Optional[dict]] = mapped_column(JSONB)
    collection: Mapped[Optional[str]] = mapped_column(String(128))
    totals_files: Mapped[int] = mapped_column(Integer, default=0)
    totals_chunks: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[Optional[dict]] = mapped_column(JSONB)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="success")


class Document(AsyncAttrs, Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uri: Mapped[Optional[str]] = mapped_column(Text)
    path: Mapped[Optional[str]] = mapped_column(Text)
    mime: Mapped[Optional[str]] = mapped_column(String(128))
    bytes_size: Mapped[Optional[int]] = mapped_column(BigInteger)
    source: Mapped[Optional[str]] = mapped_column(String(32))
    tags: Mapped[Optional[dict]] = mapped_column(JSONB)
    collection: Mapped[Optional[str]] = mapped_column(String(128))
    path_hash: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_ingested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class UserCollectionAccess(AsyncAttrs, Base):
    __tablename__ = "user_collection_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("document_collections.id", ondelete="CASCADE")
    )
    __table_args__ = (UniqueConstraint("user_id", "collection_id", name="uq_user_collection"),)
