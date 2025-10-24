from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    User,
    MCPServer,
    Tool,
    ChatSession,
    ChatMessage,
    ToolRun,
    IngestionRun,
    Document,
    DocumentCollection,
    UserCollectionAccess,
)


def _hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


async def ensure_root_user(session, *, username: str, api_key: str) -> User:
    q = await session.execute(select(User).where(User.username == username))
    user = q.scalar_one_or_none()
    if user:
        # Update api key hash if changed
        h = _hash_api_key(api_key)
        if user.api_key_hash != h:
            user.api_key_hash = h
            await session.flush()
        return user
    user = User(username=username, is_root=True, api_key_hash=_hash_api_key(api_key))
    session.add(user)
    await session.flush()
    return user


async def upsert_mcp_servers(
    session: AsyncSession, servers: Iterable[tuple[str, str, bool]]
) -> dict[str, MCPServer]:
    """Upsert MCP servers by server_id.

    Args:
        servers: iterable of (server_id, url, healthy)
    Returns: mapping server_id -> MCPServer
    """
    existing = (await session.execute(select(MCPServer))).scalars().all()
    by_id = {s.server_id: s for s in existing}
    result: dict[str, MCPServer] = {}
    now = datetime.utcnow()
    for server_id, url, healthy in servers:
        s = by_id.get(server_id)
        if s:
            s.url = url
            s.healthy = healthy
            s.last_seen = now
            result[server_id] = s
        else:
            s = MCPServer(server_id=server_id, url=url, healthy=healthy, last_seen=now)
            session.add(s)
            await session.flush()
            result[server_id] = s
    return result


async def upsert_tools(
    session: AsyncSession,
    server_map: dict[str, MCPServer],
    tools: Iterable[tuple[str, str, str, dict | None]],
) -> None:
    """Upsert tools by (server_id, qualified_name).

    Args:
        server_map: mapping server_id -> MCPServer rows
        tools: iterable of (server_id, qualified_name, description, input_schema)
    """
    # We could optimize by querying by server, but simplicity is fine
    existing = (await session.execute(select(Tool))).scalars().all()
    index = {(t.mcp_server_id, t.name): t for t in existing}
    now = datetime.utcnow()
    for server_id, name, description, schema in tools:
        server = server_map.get(server_id)
        if not server:
            continue
        key = (server.id, name)
        t = index.get(key)
        if t:
            t.description = description
            t.input_schema = schema
            t.last_discovered_at = now
        else:
            session.add(
                Tool(
                    mcp_server_id=server.id,
                    name=name,
                    description=description,
                    input_schema=schema,
                    last_discovered_at=now,
                )
            )
    await session.flush()


async def get_or_create_session(
    session: AsyncSession,
    *,
    user_id: int,
    external_id: str | None,
    model: str | None,
    enable_tools: bool,
) -> ChatSession:
    if external_id:
        q = await session.execute(
            select(ChatSession).where(
                ChatSession.user_id == user_id, ChatSession.external_id == external_id
            )
        )
        cs = q.scalar_one_or_none()
        if cs:
            cs.updated_at = datetime.utcnow()
            cs.model = model or cs.model
            cs.enable_tools = enable_tools
            await session.flush()
            return cs
    cs = ChatSession(
        user_id=user_id, external_id=external_id, model=model, enable_tools=enable_tools
    )
    session.add(cs)
    await session.flush()
    return cs


async def add_message(
    session: AsyncSession,
    *,
    session_id: int,
    role: str,
    content: str,
    tool_call_name: str | None = None,
    tool_call_id: str | None = None,
) -> ChatMessage:
    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        tool_call_name=tool_call_name,
        tool_call_id=tool_call_id,
    )
    session.add(msg)
    await session.flush()
    return msg


async def start_tool_run(
    session: AsyncSession,
    *,
    user_id: int,
    session_id: int | None,
    tool_name: str,
    args: dict | None,
    start_ts: datetime,
) -> ToolRun:
    # Try resolve tool_id
    tool_id = None
    try:
        q = await session.execute(select(Tool).where(Tool.name == tool_name))
        t = q.scalar_one_or_none()
        if t:
            tool_id = t.id
    except Exception:
        pass
    tr = ToolRun(
        user_id=user_id,
        session_id=session_id,
        tool_name=tool_name,
        tool_id=tool_id,
        status="start",
        args=args,
        start_ts=start_ts,
    )
    session.add(tr)
    await session.flush()
    return tr


async def finish_tool_run(
    session: AsyncSession,
    *,
    run_id: int,
    status: str,
    end_ts: datetime,
    latency_ms: int | None,
    result_preview: str | None = None,
    error_message: str | None = None,
    tool_name: str | None = None,
) -> None:
    q = await session.execute(select(ToolRun).where(ToolRun.id == run_id))
    tr = q.scalar_one_or_none()
    if not tr:
        return
    tr.status = status
    tr.end_ts = end_ts
    tr.latency_ms = latency_ms
    tr.result_preview = result_preview
    tr.error_message = error_message
    if tr.tool_id is None and tool_name:
        try:
            q2 = await session.execute(select(Tool).where(Tool.name == tool_name))
            t = q2.scalar_one_or_none()
            if t:
                tr.tool_id = t.id
        except Exception:
            pass
    await session.flush()


async def record_ingestion_run(
    session: AsyncSession,
    *,
    user_id: int,
    target: str,
    from_web: bool,
    recursive: bool,
    tags: list[str] | None,
    collection: str | None,
    totals_files: int,
    totals_chunks: int,
    errors: list[str] | None,
    started_at: datetime,
    finished_at: datetime,
    status: str = "success",
) -> IngestionRun:
    run = IngestionRun(
        user_id=user_id,
        target=target,
        from_web=from_web,
        recursive=recursive,
        tags={"tags": tags or []},
        collection=collection,
        totals_files=totals_files,
        totals_chunks=totals_chunks,
        errors={"errors": errors or []} if errors else None,
        started_at=started_at,
        finished_at=finished_at,
        status=status,
    )
    session.add(run)
    await session.flush()
    return run


async def upsert_document(
    session: AsyncSession,
    *,
    path_hash: str,
    uri: str | None,
    path: str | None,
    mime: str | None,
    bytes_size: int | None,
    source: str | None,
    tags: list[str] | None,
    collection: str | None,
) -> Document:
    q = await session.execute(select(Document).where(Document.path_hash == path_hash))
    doc = q.scalar_one_or_none()
    now = datetime.utcnow()
    if doc:
        doc.uri = uri or doc.uri
        doc.path = path or doc.path
        doc.mime = mime or doc.mime
        doc.bytes_size = bytes_size or doc.bytes_size
        doc.source = source or doc.source
        doc.tags = {"tags": tags or []}
        doc.collection = collection or doc.collection
        doc.last_ingested_at = now
        await session.flush()
        return doc
    doc = Document(
        uri=uri,
        path=path,
        mime=mime,
        bytes_size=bytes_size,
        source=source,
        tags={"tags": tags or []},
        collection=collection,
        path_hash=path_hash,
        last_ingested_at=now,
    )
    session.add(doc)
    await session.flush()
    return doc


async def ensure_collection(session: AsyncSession, name: str) -> DocumentCollection:
    q = await session.execute(select(DocumentCollection).where(DocumentCollection.name == name))
    col = q.scalar_one_or_none()
    if col:
        return col
    col = DocumentCollection(name=name)
    session.add(col)
    await session.flush()
    return col


async def grant_user_collection_access(
    session: AsyncSession, user_id: int, collection_name: str
) -> None:
    col = await ensure_collection(session, collection_name)
    q = await session.execute(
        select(UserCollectionAccess).where(
            UserCollectionAccess.user_id == user_id, UserCollectionAccess.collection_id == col.id
        )
    )
    uca = q.scalar_one_or_none()
    if not uca:
        session.add(UserCollectionAccess(user_id=user_id, collection_id=col.id))
        await session.flush()


# ==================== READ OPERATIONS ====================


async def get_user_sessions(
    session: AsyncSession, user_id: int, limit: int = 50
) -> list[ChatSession]:
    """Get user's chat sessions ordered by most recent."""
    q = await session.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
    )
    return list(q.scalars().all())


async def get_session_with_messages(
    session: AsyncSession, session_id: int, user_id: int
) -> ChatSession | None:
    """Get a chat session with all its messages."""
    q = await session.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    chat_session = q.scalar_one_or_none()
    if not chat_session:
        return None

    # Load messages
    q = await session.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    chat_session.messages = list(q.scalars().all())
    return chat_session


async def get_user_documents(
    session: AsyncSession,
    user_id: int | None = None,
    collection: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Document]:
    """Get documents, optionally filtered by collection."""
    query = select(Document).order_by(Document.last_ingested_at.desc())

    if collection:
        query = query.where(Document.collection == collection)

    query = query.limit(limit).offset(offset)

    q = await session.execute(query)
    return list(q.scalars().all())


async def get_user_ingestion_runs(
    session: AsyncSession,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[IngestionRun]:
    """Get user's ingestion runs ordered by most recent."""
    q = await session.execute(
        select(IngestionRun)
        .where(IngestionRun.user_id == user_id)
        .order_by(IngestionRun.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(q.scalars().all())


async def get_user_tool_runs(
    session: AsyncSession,
    user_id: int,
    limit: int = 100,
    offset: int = 0,
) -> list[ToolRun]:
    """Get user's tool execution logs ordered by most recent."""
    q = await session.execute(
        select(ToolRun)
        .where(ToolRun.user_id == user_id)
        .order_by(ToolRun.start_ts.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(q.scalars().all())


# ==================== DELETE OPERATIONS ====================


async def delete_session(session: AsyncSession, session_id: int, user_id: int) -> bool:
    """Delete a chat session and all its messages (cascade)."""
    q = await session.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    chat_session = q.scalar_one_or_none()
    if not chat_session:
        return False

    await session.delete(chat_session)
    await session.flush()
    return True


async def delete_document(session: AsyncSession, document_id: int) -> bool:
    """Delete a document from the catalog."""
    q = await session.execute(select(Document).where(Document.id == document_id))
    doc = q.scalar_one_or_none()
    if not doc:
        return False

    await session.delete(doc)
    await session.flush()
    return True


async def delete_document_by_path_hash(session: AsyncSession, path_hash: str) -> bool:
    """Delete a document by its path hash."""
    q = await session.execute(select(Document).where(Document.path_hash == path_hash))
    doc = q.scalar_one_or_none()
    if not doc:
        return False

    await session.delete(doc)
    await session.flush()
    return True


async def delete_ingestion_run(session: AsyncSession, run_id: int, user_id: int) -> bool:
    """Delete an ingestion run record."""
    q = await session.execute(
        select(IngestionRun).where(IngestionRun.id == run_id, IngestionRun.user_id == user_id)
    )
    run = q.scalar_one_or_none()
    if not run:
        return False

    await session.delete(run)
    await session.flush()
    return True


# ==================== UPDATE OPERATIONS ====================


async def update_session_title(
    session: AsyncSession, session_id: int, user_id: int, title: str
) -> bool:
    """Update a chat session's title."""
    q = await session.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    chat_session = q.scalar_one_or_none()
    if not chat_session:
        return False

    chat_session.title = title
    chat_session.updated_at = datetime.utcnow()
    await session.flush()
    return True
