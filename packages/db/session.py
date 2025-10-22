from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from packages.common.settings import Settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


async def init_db(settings: Settings) -> None:
    global _engine, _session_factory
    if _engine is not None:
        return

    database_url = settings.database_url
    _engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
    _session_factory = async_sessionmaker(bind=_engine, expire_on_commit=False)
    # Fail hard if DB is down and run migrations to head
    try:
        # TODO: Fix Alembic migration hanging issue
        # For now, just ensure tables exist using SQLAlchemy
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        raise


@asynccontextmanager
async def get_async_session() -> AsyncIterator[AsyncSession]:
    if _session_factory is None:
        raise RuntimeError("DB not initialized")
    session = _session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
