# Database Connection Pooling Configuration

## Overview

YouWorker uses SQLAlchemy's async connection pooling with asyncpg to efficiently manage PostgreSQL database connections. Proper pool configuration is essential for optimal performance, resource utilization, and handling concurrent requests.

## Connection Pool Architecture

```
┌───────────────────────────────────────┐
│         FastAPI Application           │
│  (Multiple Worker Processes/Threads)  │
└──────────────┬────────────────────────┘
               │
               ▼
┌───────────────────────────────────────┐
│      SQLAlchemy AsyncEngine           │
│         (per process)                 │
└──────────────┬────────────────────────┘
               │
               ▼
┌───────────────────────────────────────┐
│       AsyncPG Connection Pool         │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │Conn│ │Conn│ │Conn│ │Conn│ │Conn│   │
│  └────┘ └────┘ └────┘ └────┘ └────┘   │
│          (pool_size = 5)              │
└──────────────┬────────────────────────┘
               │
               ▼
┌───────────────────────────────────────┐
│          PostgreSQL Server            │
│       (max_connections = 100)         │
└───────────────────────────────────────┘
```

## Configuration Parameters

### Environment Variables

Configure pool parameters via environment variables in `.env`:

```bash
# Database Connection
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/youworker

# Connection Pool Settings
DB_POOL_SIZE=5              # Number of connections to maintain
DB_MAX_OVERFLOW=10          # Additional connections allowed beyond pool_size
DB_POOL_PRE_PING=true       # Test connections before using
DB_POOL_RECYCLE=3600        # Recycle connections after N seconds
DB_ECHO=false               # Log all SQL statements (dev only)
DB_ECHO_POOL=false          # Log pool checkouts/checkins (debug)

# Query Performance Monitoring
DB_SLOW_QUERY_THRESHOLD=1.0  # Log queries slower than N seconds
```

### Parameter Details

#### `DB_POOL_SIZE` (default: 5)

Number of connections maintained in the pool.

**Calculation:**
```
pool_size = (Number of CPU cores × 2) + effective_spindle_count

For typical deployment:
- 4 CPU cores, SSD storage
- pool_size = (4 × 2) + 1 = 9

For multi-process setup (e.g., 4 uvicorn workers):
- pool_size = 5 per worker
- Total connections = 5 × 4 = 20
```

**Guidelines:**
- **Too small**: Requests wait for available connections, increased latency
- **Too large**: Wastes PostgreSQL resources, may exceed `max_connections`
- **Recommended**: Start with 5, monitor and adjust based on load

#### `DB_MAX_OVERFLOW` (default: 10)

Additional connections beyond `pool_size` during traffic spikes.

**Behavior:**
- Overflow connections are created on-demand when pool is exhausted
- Closed after use (not returned to pool)
- Total max connections = `pool_size + max_overflow`

**Guidelines:**
- Set to 2× pool_size for bursty traffic
- Monitor overflow usage - frequent overflow indicates pool_size too small
- Set to 0 in environments with strict connection limits

#### `DB_POOL_PRE_PING` (default: true)

Test each connection before use to detect stale connections.

**Behavior:**
```sql
-- Executed before each connection checkout
SELECT 1
```

**Pros:**
- Prevents errors from closed/stale connections
- Automatic recovery from network issues or database restarts

**Cons:**
- Slight overhead per checkout (~1ms)
- Acceptable trade-off for reliability

**When to disable:**
- Very high-frequency, low-latency requirements
- When using external connection monitoring

#### `DB_POOL_RECYCLE` (default: 3600 seconds / 1 hour)

Automatically close and replace connections after specified age.

**Purpose:**
- Prevent issues with long-lived connections
- Mitigate PostgreSQL connection state accumulation
- Handle database-side connection limits

**Guidelines:**
- Default 1 hour suitable for most applications
- Reduce to 600s (10 min) if experiencing connection issues
- Increase to 7200s (2 hours) for very stable environments

#### `DB_ECHO` (default: false)

Log all SQL statements (development/debugging only).

**Example output:**
```
INFO sqlalchemy.engine.Engine SELECT users.id, users.username ...
INFO sqlalchemy.engine.Engine [generated in 0.00123s] {}
```

**Warning:** Significant performance impact and log volume. Never enable in production.

#### `DB_ECHO_POOL` (default: false)

Log connection pool events (checkout, checkin, overflow).

**Example output:**
```
DEBUG sqlalchemy.pool.impl.AsyncAdaptedQueuePool Connection <AsyncAdapt(asyncpg.Connection)> checked out from pool
DEBUG sqlalchemy.pool.impl.AsyncAdaptedQueuePool Connection <AsyncAdapt(asyncpg.Connection)> being returned to pool
```

**Use case:** Debugging pool exhaustion or connection leaks.

## Implementation

### SQLAlchemy Engine Configuration

Located in `packages/db/session.py`:

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from packages.common import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    echo_pool=settings.db_echo_pool,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=settings.db_pool_pre_ping,
    pool_recycle=settings.db_pool_recycle,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_async_session() -> AsyncSession:
    """FastAPI dependency for database sessions."""
    async with async_session_maker() as session:
        yield session
```

### Query Performance Monitoring

Slow query logging is implemented via SQLAlchemy event listeners:

```python
import time
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.time())

@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total_time = time.time() - conn.info["query_start_time"].pop()

    if total_time > settings.db_slow_query_threshold:
        logger.warning(
            "Slow query detected",
            extra={
                "query": statement,
                "duration_ms": int(total_time * 1000),
                "threshold_ms": int(settings.db_slow_query_threshold * 1000),
            }
        )
```

## Monitoring and Troubleshooting

### Monitor Connection Pool Health

Add health check endpoint:

```python
from sqlalchemy import text

@router.get("/health/database")
async def database_health(db: AsyncSession = Depends(get_async_session)):
    """Check database connectivity and pool status."""
    try:
        await db.execute(text("SELECT 1"))

        pool = engine.pool
        return {
            "status": "healthy",
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "total_connections": pool.size() + pool.overflow(),
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
```

### Common Issues

#### Issue 1: Pool Exhausted

**Symptom:**
```
sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached
```

**Causes:**
- Too many concurrent requests
- Long-running transactions
- Connection leaks (sessions not closed)

**Solutions:**
1. Increase `DB_POOL_SIZE` and `DB_MAX_OVERFLOW`
2. Check for missing `await session.close()` or context manager usage
3. Optimize slow queries reducing transaction time
4. Add connection timeout monitoring

#### Issue 2: Too Many Connections at Database

**Symptom:**
```
psycopg.errors.TooManyConnections: FATAL:  sorry, too many clients already
```

**Causes:**
- Multiple workers × pool_size exceeds PostgreSQL `max_connections`
- Pool size not accounting for other services

**PostgreSQL Configuration:**
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check max_connections setting
SHOW max_connections;  -- Default: 100

-- Update if needed (requires restart)
ALTER SYSTEM SET max_connections = 200;
```

**Application Solution:**
```
Total connections needed = (workers × pool_size × services) + buffer

Example:
- 4 uvicorn workers
- pool_size = 5
- 2 services (API + background tasks)
- Buffer = 20

Total = (4 × 5 × 2) + 20 = 60 connections
```

Set PostgreSQL `max_connections >= 80` (with safety margin).

#### Issue 3: Stale Connections

**Symptom:**
```
asyncpg.exceptions.ConnectionDoesNotExistError: connection was closed in the middle of operation
```

**Causes:**
- Firewall closing idle connections
- Database restart
- Network interruption

**Solutions:**
1. Enable `DB_POOL_PRE_PING=true` (default)
2. Reduce `DB_POOL_RECYCLE` to 600s
3. Implement retry logic with `tenacity`

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10)
)
async def execute_with_retry(session: AsyncSession, query):
    """Execute query with automatic retry on connection errors."""
    return await session.execute(query)
```

## Production Recommendations

### Sizing Guidelines

| Deployment Scale | Workers | Pool Size | Max Overflow | PostgreSQL Max Connections |
|------------------|---------|-----------|--------------|---------------------------|
| Small (1 node)   | 2       | 5         | 10           | 50                        |
| Medium (2-4 nodes)| 4       | 5         | 10           | 100                       |
| Large (5+ nodes) | 8       | 5         | 10           | 200+                      |

### Performance Tuning

1. **Start Conservative**
   ```bash
   DB_POOL_SIZE=5
   DB_MAX_OVERFLOW=10
   ```

2. **Monitor Metrics**
   - Average connection checkout time
   - Pool exhaustion events
   - Overflow connection usage
   - Query latency (p50, p95, p99)

3. **Optimize Queries First**
   - Add indexes for common queries
   - Use `EXPLAIN ANALYZE` for slow queries
   - Implement caching for frequent reads

4. **Scale Pool Size Last**
   - Only after query optimization
   - Monitor PostgreSQL connection count
   - Consider read replicas before increasing pool size

### Multi-Process Deployment

When using multiple uvicorn workers:

```bash
# docker-compose.yml
command: uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Connection calculation:**
```
Each worker has independent connection pool
Total connections = workers × (pool_size + max_overflow)

Example: 4 workers × (5 + 10) = 60 connections
```

**Recommended Settings:**
```bash
# For 4 workers
DB_POOL_SIZE=3           # Lower per-worker pool
DB_MAX_OVERFLOW=7        # Still allows burst capacity
# Total: 4 × (3 + 7) = 40 connections
```

## Testing

### Load Testing Connection Pool

```python
# tests/load/test_connection_pool.py
import asyncio
import pytest

@pytest.mark.asyncio
async def test_concurrent_queries():
    """Simulate high concurrent load on connection pool."""
    async def query():
        async with get_async_session() as db:
            result = await db.execute(text("SELECT pg_sleep(0.1), 1"))
            return result.scalar()

    # Create 100 concurrent queries
    tasks = [query() for _ in range(100)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Check for pool exhaustion errors
    errors = [r for r in results if isinstance(r, Exception)]
    assert len(errors) == 0, f"Pool exhausted: {errors}"
```

### Integration Test

```python
@pytest.mark.asyncio
async def test_connection_pool_recovery():
    """Test pool recovery after database restart."""
    # Simulate database connection failure
    await engine.dispose()

    # Should automatically reconnect
    async with get_async_session() as db:
        result = await db.execute(text("SELECT 1"))
        assert result.scalar() == 1
```

## Related Documentation

- [PostgreSQL Connection Management](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [SQLAlchemy Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- [asyncpg Performance](https://magicstack.github.io/asyncpg/current/usage.html#connection-pools)

## See Also

- [Database Migrations](../ops/alembic/DATABASE_MIGRATIONS.md)
- [Architecture Overview](./ARCHITETTURA.md)
- [Performance Optimization](./PERFORMANCE.md)
