# Logging Best Practices

## Overview

YouWorker uses structured logging with automatic correlation ID injection for comprehensive observability. This document describes logging standards, patterns, and best practices for the platform.

## Logging Architecture

```
┌─────────────────────────────────────────┐
│      Application Components             │
│  (Routes, Services, Agents, Workers)    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      StructuredLogger                   │
│  - Automatic correlation ID injection   │
│  - JSON formatting                      │
│  - Context enrichment                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Log Handlers                       │
│  - Console (dev): Human-readable        │
│  - JSON (prod): Machine-parseable       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Log Aggregation (Optional)            │
│  - ELK Stack, Grafana Loki, etc.        │
└─────────────────────────────────────────┘
```

## Logger Setup

### Module-Level Logger Pattern

**Always create loggers at module level:**

```python
# ✅ CORRECT
from packages.common import get_logger

logger = get_logger(__name__)

async def process_document(doc_id: int):
    logger.info("Processing document", extra={"doc_id": doc_id})
```

**Never create loggers inside functions:**

```python
# ❌ INCORRECT
async def process_document(doc_id: int):
    import logging
    logger = logging.getLogger(__name__)  # Anti-pattern
    logger.info("Processing document")
```

### Structured Logger Usage

YouWorker provides `StructuredLogger` in `packages/common/logger.py`:

```python
from packages.common import get_logger

logger = get_logger(__name__)

# Automatic correlation ID injection
logger.info(
    "User created",
    extra={
        "user_id": user.id,
        "username": user.username,
        "is_root": user.is_root,
    }
)

# Output (JSON in production):
{
  "timestamp": "2025-10-30T10:15:30.123Z",
  "level": "INFO",
  "logger": "packages.db.crud",
  "message": "User created",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": 42,
  "username": "john",
  "is_root": false
}
```

## Log Levels

### When to Use Each Level

#### DEBUG

**Purpose:** Detailed diagnostic information for development/troubleshooting.

**Use when:**
- Tracing function entry/exit
- Logging variable values during debugging
- Detailed state information

**Examples:**
```python
logger.debug("Entering function", extra={"args": args, "kwargs": kwargs})
logger.debug("Retrieved from cache", extra={"cache_key": key, "hit": True})
logger.debug("Query result", extra={"row_count": len(results)})
```

**Note:** Disabled by default in production (`LOG_LEVEL=INFO`).

#### INFO

**Purpose:** General informational messages about application flow.

**Use when:**
- Recording normal application behavior
- Business logic milestones
- System state changes

**Examples:**
```python
logger.info("User logged in", extra={"user_id": user.id})
logger.info("Document ingested", extra={"doc_id": doc.id, "chunks": 150})
logger.info("MCP server connected", extra={"server": "datetime", "version": "0.1.0"})
```

#### WARNING

**Purpose:** Potentially harmful situations that don't prevent operation.

**Use when:**
- Deprecated feature usage
- Recoverable errors
- Unexpected but handled conditions
- Configuration issues

**Examples:**
```python
logger.warning(
    "Slow query detected",
    extra={
        "duration_ms": 2500,
        "query": query[:200],
        "threshold_ms": 1000,
    }
)

logger.warning(
    "Retry attempt",
    extra={
        "attempt": 2,
        "max_attempts": 3,
        "error": str(e),
    }
)

logger.warning(
    "Cache miss",
    extra={
        "cache_key": key,
        "fallback": "database_query",
    }
)
```

#### ERROR

**Purpose:** Error events that prevent a specific operation from completing.

**Use when:**
- Caught exceptions that affect user requests
- Failed operations that are logged and returned as errors
- Database errors, validation failures

**Examples:**
```python
logger.error(
    "Failed to create user",
    extra={
        "username": username,
        "error": str(e),
        "error_type": type(e).__name__,
    },
    exc_info=True,  # Include traceback
)

logger.error(
    "Qdrant connection failed",
    extra={
        "url": qdrant_url,
        "operation": "search",
        "timeout": 5.0,
    },
    exc_info=True,
)
```

#### CRITICAL

**Purpose:** Critical errors that may cause application failure.

**Use when:**
- System-wide failures
- Data corruption
- Service unavailability that affects all users

**Examples:**
```python
logger.critical(
    "Database connection pool exhausted",
    extra={
        "pool_size": 5,
        "overflow": 10,
        "waiting_requests": 50,
    }
)

logger.critical(
    "Configuration validation failed at startup",
    extra={
        "error": "Invalid CORS origins",
        "value": origins_str,
    }
)
```

## Structured Logging Patterns

### Always Use `extra` for Context

```python
# ✅ GOOD - Structured, searchable
logger.info(
    "Message sent",
    extra={
        "session_id": session.id,
        "message_length": len(content),
        "enable_tools": enable_tools,
    }
)

# ❌ BAD - String interpolation, not searchable
logger.info(f"Message sent: session={session.id}, length={len(content)}")
```

### Exception Logging

**Always include `exc_info=True` for ERROR/CRITICAL:**

```python
try:
    result = await process_document(doc_id)
except ValidationError as e:
    logger.error(
        "Document validation failed",
        extra={
            "doc_id": doc_id,
            "validation_errors": e.errors(),
        },
        exc_info=True,  # Includes full traceback
    )
    raise

except Exception as e:
    logger.error(
        "Unexpected error processing document",
        extra={
            "doc_id": doc_id,
            "error_type": type(e).__name__,
        },
        exc_info=True,
    )
    raise
```

### Sensitive Data Redaction

**Never log sensitive information:**

```python
# ❌ BAD - Logs sensitive data
logger.info("User authenticated", extra={"password": password, "api_key": api_key})

# ✅ GOOD - Redact or omit sensitive data
logger.info(
    "User authenticated",
    extra={
        "username": username,
        "auth_method": "api_key",
        # No password or key logged
    }
)

# ✅ GOOD - Hash sensitive identifiers if needed
import hashlib
api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()[:8]
logger.info("API key used", extra={"api_key_prefix": api_key_hash})
```

**Sensitive fields to never log:**
- Passwords, API keys, tokens
- Personal information (email, phone, address) in production
- Credit card numbers, bank account numbers
- Session tokens, cookies
- Encryption keys

### Performance-Sensitive Logging

Use lazy evaluation for expensive operations:

```python
# ❌ BAD - Always evaluates even if DEBUG disabled
logger.debug(f"Large object: {json.dumps(huge_object)}")

# ✅ GOOD - Only evaluates if DEBUG enabled
if logger.isEnabledFor(logging.DEBUG):
    logger.debug("Large object", extra={"data": huge_object})

# ✅ BETTER - Use lazy message formatting
logger.debug(
    "Query result: %(count)d rows",
    {"count": len(results)},
    extra={"sample": results[:5]},
)
```

## Correlation ID Tracking

### Automatic Injection

Correlation IDs are automatically added to all log messages:

```python
# In middleware (apps/api/main.py)
from packages.common.correlation import set_correlation_id, get_correlation_id

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    # Extract or generate correlation ID
    correlation_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    set_correlation_id(correlation_id)

    # All logs in this request context will include correlation_id
    logger.info("Request started", extra={"path": request.url.path})

    response = await call_next(request)
    response.headers["X-Request-ID"] = correlation_id

    logger.info("Request completed", extra={"status": response.status_code})
    return response
```

### Manual Correlation ID Usage

```python
from packages.common.correlation import get_correlation_id, set_correlation_id

async def background_task(task_id: int):
    # Preserve correlation ID in async tasks
    correlation_id = get_correlation_id()

    # In background task, set correlation ID
    set_correlation_id(correlation_id)

    logger.info("Background task started", extra={"task_id": task_id})
    # Logs will include correlation_id
```

### Propagating Correlation ID to External Services

```python
from packages.common.correlation import get_correlation_id

async def call_external_service(url: str, data: dict):
    headers = {
        "X-Request-ID": get_correlation_id(),
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)

    logger.info(
        "External service called",
        extra={
            "url": url,
            "status": response.status_code,
        }
    )
```

## Log Configuration

### Environment Variables

```bash
# .env

# Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_LEVEL=INFO

# Environment: development, staging, production
APP_ENV=production

# JSON logging (production) or human-readable (development)
LOG_FORMAT=json  # or "console"
```

### Configuration in Code

```python
# packages/common/logger.py
from packages.common.settings import get_settings

settings = get_settings()

def setup_logging():
    """Configure logging based on environment."""
    if settings.app_env == "production":
        # JSON logging for production
        formatter = JSONFormatter()
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
    else:
        # Human-readable for development
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)

    logging.root.addHandler(handler)
    logging.root.setLevel(settings.log_level)
```

## Testing Logs

### Capturing Logs in Tests

```python
import logging
import pytest

def test_user_creation_logs(caplog):
    """Test that user creation logs correctly."""
    caplog.set_level(logging.INFO)

    user = create_user(username="test")

    # Assert log message exists
    assert "User created" in caplog.text

    # Assert structured data
    assert any(
        record.user_id == user.id and record.username == "test"
        for record in caplog.records
    )
```

### Asserting Log Levels

```python
def test_error_logging(caplog):
    """Test that errors are logged at ERROR level."""
    caplog.set_level(logging.ERROR)

    with pytest.raises(ValueError):
        validate_input("invalid")

    # Assert ERROR level used
    assert any(record.levelname == "ERROR" for record in caplog.records)

    # Assert exception info included
    assert any(record.exc_info for record in caplog.records)
```

## Log Aggregation

### ELK Stack (Elasticsearch, Logstash, Kibana)

**Docker Compose Setup:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    # ... existing config
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.x
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.x
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.x
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
```

**Logstash Pipeline:**

```ruby
# logstash.conf
input {
  tcp {
    port => 5044
    codec => json_lines
  }
}

filter {
  # Parse correlation_id for tracing
  if [correlation_id] {
    mutate {
      add_field => { "trace_id" => "%{correlation_id}" }
    }
  }

  # Add timestamp
  date {
    match => [ "timestamp", "ISO8601" ]
    target => "@timestamp"
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "youworker-logs-%{+YYYY.MM.dd}"
  }
}
```

### Grafana Loki (Lightweight Alternative)

```yaml
# docker-compose.yml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Performance Considerations

### Avoid Logging in Tight Loops

```python
# ❌ BAD - Logs on every iteration
for doc in documents:
    logger.debug("Processing document", extra={"doc_id": doc.id})
    process(doc)

# ✅ GOOD - Log batch summary
logger.info("Processing documents", extra={"count": len(documents)})
for doc in documents:
    process(doc)
logger.info("Documents processed", extra={"count": len(documents)})
```

### Asynchronous Logging (Advanced)

For high-throughput applications:

```python
from logging.handlers import QueueHandler, QueueListener
import queue

# Create queue for async logging
log_queue = queue.Queue(-1)
queue_handler = QueueHandler(log_queue)

# Setup listener in background
listener = QueueListener(log_queue, console_handler, json_handler)
listener.start()

# Add queue handler to logger
logger.addHandler(queue_handler)
```

## Checklist

- [ ] Logger created at module level
- [ ] Appropriate log level used (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- [ ] Structured logging with `extra` dict
- [ ] Sensitive data redacted
- [ ] Exceptions logged with `exc_info=True`
- [ ] Correlation ID propagated to external services
- [ ] Logs tested in unit tests
- [ ] Production JSON logging configured
- [ ] Log aggregation setup (if applicable)

## See Also

- [Correlation ID Implementation](../packages/common/correlation.py)
- [Structured Logger](../packages/common/logger.py)
- [Request ID Propagation (P0-8)](../REFACTORING_GUIDE.md#p0-8-no-request-id-propagation-to-child-services)
- [Python Logging Documentation](https://docs.python.org/3/library/logging.html)
