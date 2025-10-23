from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from packages.common.settings import Settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _run_alembic_migrations(database_url: str) -> None:
    """Run Alembic migrations up to head for the configured database."""
    from alembic import command
    from alembic.config import Config

    base_path = Path(__file__).resolve().parents[2]
    alembic_dir = base_path / "ops" / "alembic"
    ini_path = alembic_dir / "alembic.ini"

    os.environ["DATABASE_URL"] = database_url

    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("script_location", str(alembic_dir))
    command.upgrade(alembic_cfg, "head")


async def init_db(settings: Settings) -> None:
    """
    Initialize the database engine and session factory with connection pooling.

    Connection pool parameters:
    - pool_size=5: Number of persistent connections
    - max_overflow=10: Max additional connections beyond pool_size
    - pool_timeout=30: Seconds to wait for a connection
    - pool_pre_ping=True: Test connections before using them
    - pool_recycle=3600: Recycle connections after 1 hour
    """
    global _engine, _session_factory
    if _engine is not None:
        return

    database_url = settings.database_url
    _engine = create_async_engine(
        database_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=3600,
    )
    _session_factory = async_sessionmaker(bind=_engine, expire_on_commit=False)

    # Run database migrations to ensure schema is up to date.
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    try:
        if loop and loop.is_running():
            await loop.run_in_executor(None, _run_alembic_migrations, database_url)
        else:
            _run_alembic_migrations(database_url)
    except Exception as exc:
        raise RuntimeError("Failed to run database migrations") from exc


@asynccontextmanager
async def get_async_session() -> AsyncIterator[AsyncSession]:
    """
    Context manager for database sessions.

    Automatically commits on successful completion and rolls back on exceptions.
    This pattern is suitable for single-transaction operations where all database
    operations within the context should be atomic.

    Usage:
        async with get_async_session() as db:
            # Perform database operations
            await some_crud_operation(db, ...)
            # Commit happens automatically on exit if no exception
    """
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
