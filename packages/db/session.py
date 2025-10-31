from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from packages.common.exceptions import DatabaseError
from packages.common.settings import Settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_query_monitoring_enabled = False
_pool_monitoring_enabled = False


def _setup_query_monitoring(engine, slow_query_threshold: float = 1.0) -> None:
    """
    Setup query performance monitoring with slow query logging.

    Args:
        engine: SQLAlchemy engine to monitor
        slow_query_threshold: Log queries taking longer than this (in seconds)
    """
    global _query_monitoring_enabled
    if _query_monitoring_enabled:
        return

    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Record query start time."""
        conn.info.setdefault("query_start_time", []).append(time.perf_counter())

    @event.listens_for(engine.sync_engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Log slow queries after execution."""
        start_times = conn.info.get("query_start_time", [])
        if not start_times:
            return

        total_time = time.perf_counter() - start_times.pop()
        duration_ms = int(total_time * 1000)

        if total_time > slow_query_threshold:
            # Truncate statement for logging (max 500 chars)
            truncated_statement = statement[:500] + "..." if len(statement) > 500 else statement

            logger.warning(
                "Slow query detected: %dms - %s",
                duration_ms,
                truncated_statement,
                extra={
                    "duration_ms": duration_ms,
                    "query": statement,
                    "parameters": str(parameters)[:200] if parameters else None,
                    "slow_query": True,
                }
            )

    _query_monitoring_enabled = True
    logger.info("Query performance monitoring enabled (threshold: %.1fs)", slow_query_threshold)


def _setup_pool_monitoring(engine, pool_size: int, max_overflow: int) -> None:
    """
    Setup connection pool monitoring with exhaustion detection.

    Args:
        engine: SQLAlchemy engine to monitor
        pool_size: Configured pool size
        max_overflow: Configured max overflow
    """
    global _pool_monitoring_enabled
    if _pool_monitoring_enabled:
        return

    @event.listens_for(engine.sync_engine, "connect")
    def on_connect(dbapi_conn, connection_record):
        """Log new database connections."""
        pool = engine.pool
        logger.debug(
            "Database connection established",
            extra={
                "pool_size": pool.size(),
                "pool_checked_in": pool.checkedin(),
                "pool_checked_out": pool.checkedout(),
                "pool_overflow": pool.overflow(),
            }
        )

    @event.listens_for(engine.sync_engine.pool, "checkout")
    def on_checkout(dbapi_conn, connection_record, connection_proxy):
        """Monitor pool usage on connection checkout."""
        pool = engine.pool
        checked_out = pool.checkedout()
        total_available = pool_size + max_overflow

        # Calculate pool utilization percentage
        utilization = (checked_out / total_available * 100) if total_available > 0 else 0

        # Log warning/error if pool utilization is high
        if utilization >= 90:
            logger.error(
                "Database pool near exhaustion: %.1f%% (%d/%d connections in use)",
                utilization,
                checked_out,
                total_available,
                extra={
                    "pool_utilization_pct": utilization,
                    "pool_checked_out": checked_out,
                    "pool_size": pool.size(),
                    "pool_overflow": pool.overflow(),
                    "pool_max_overflow": max_overflow,
                    "pool_exhaustion_critical": True,
                }
            )
        elif utilization >= 80:
            logger.warning(
                "Database pool utilization high: %.1f%% (%d/%d connections in use)",
                utilization,
                checked_out,
                total_available,
                extra={
                    "pool_utilization_pct": utilization,
                    "pool_checked_out": checked_out,
                    "pool_size": pool.size(),
                    "pool_overflow": pool.overflow(),
                    "pool_max_overflow": max_overflow,
                    "pool_exhaustion_warning": True,
                }
            )

    @event.listens_for(engine.sync_engine.pool, "checkin")
    def on_checkin(dbapi_conn, connection_record):
        """Log pool status on connection return."""
        pool = engine.pool
        logger.debug(
            "Database connection returned to pool",
            extra={
                "pool_size": pool.size(),
                "pool_checked_in": pool.checkedin(),
                "pool_checked_out": pool.checkedout(),
                "pool_overflow": pool.overflow(),
            }
        )

    _pool_monitoring_enabled = True
    logger.info(
        "Connection pool monitoring enabled (size: %d, max_overflow: %d)",
        pool_size,
        max_overflow
    )


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
    Initialize the database engine and session factory with configurable connection pooling.

    Connection pool parameters are configured via settings:
    - db_pool_size: Number of persistent connections (default: 10)
    - db_max_overflow: Max additional connections beyond pool_size (default: 20)
    - db_pool_timeout: Seconds to wait for a connection (default: 30)
    - db_pool_pre_ping: Test connections before using them (default: True)
    - db_pool_recycle: Recycle connections after N seconds (default: 3600)
    - db_echo: Log SQL statements (default: False)
    - db_echo_pool: Log connection pool operations (default: False)
    """
    global _engine, _session_factory
    if _engine is not None:
        return

    database_url = settings.database_url
    _engine = create_async_engine(
        database_url,
        echo=settings.db_echo,
        pool_pre_ping=settings.db_pool_pre_ping,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_recycle=settings.db_pool_recycle,
        echo_pool=settings.db_echo_pool,
    )
    _session_factory = async_sessionmaker(bind=_engine, expire_on_commit=False)

    # Setup query performance monitoring
    _setup_query_monitoring(_engine, slow_query_threshold=settings.db_slow_query_threshold)

    # Setup connection pool monitoring
    _setup_pool_monitoring(_engine, pool_size=settings.db_pool_size, max_overflow=settings.db_max_overflow)

    # NOTE: Migrations disabled for pre-release version
    # Database schema is created automatically by SQLAlchemy
    # Uncomment below to enable Alembic migrations in production

    # # Run database migrations to ensure schema is up to date.
    # try:
    #     loop = asyncio.get_running_loop()
    # except RuntimeError:
    #     loop = None

    # try:
    #     if loop and loop.is_running():
    #         await loop.run_in_executor(None, _run_alembic_migrations, database_url)
    #     else:
    #         _run_alembic_migrations(database_url)
    # except Exception as exc:
    #     raise RuntimeError("Failed to run database migrations") from exc

    # Create tables automatically (for pre-release only)
    async with _engine.begin() as conn:

        def create_tables_sync(connection):
            Base.metadata.create_all(bind=connection)

        await conn.run_sync(create_tables_sync)


def get_async_engine():
    """
    Get the async database engine.

    Returns:
        The initialized async engine

    Raises:
        DatabaseError: If the database has not been initialized
    """
    if _engine is None:
        raise DatabaseError("DB not initialized")
    return _engine


# Function alias for backward compatibility - call get_async_engine()
async_engine = get_async_engine


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
        raise DatabaseError("DB not initialized")
    session = _session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
