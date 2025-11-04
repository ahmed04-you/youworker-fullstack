# YouWorker Database Schema

**Version:** 1.0.0-pre-release
**Status:** 🚧 Pre-Release - Schema Under Active Development
**Database:** PostgreSQL 14+
**ORM:** SQLAlchemy 2.0 (Async)
**Last Updated:** 2025-10-30

---

## ⚠️ Pre-Release Notice

This document describes the target database schema for YouWorker v1.0. While the core schema is stable, some optimizations and migrations are still in progress.

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Core Tables](#core-tables)
3. [Relationships](#relationships)
4. [Indexes](#indexes)
5. [Constraints](#constraints)
6. [Encryption](#encryption)
7. [Migrations](#migrations)
8. [Query Patterns](#query-patterns)

---

## Schema Overview

### Entity-Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    users    │───────│user_group_       │───────│   groups    │
│             │ 1   * │memberships       │ *   1 │             │
└─────────────┘       └──────────────────┘       └─────────────┘
      │ 1                      │ *                       │ 1
      │                        │                         │
      │ *                      │                         │ *
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│chat_sessions│       │   tool_runs      │       │  documents  │
│             │       │                  │       │             │
└─────────────┘       └──────────────────┘       └─────────────┘
      │ 1
      │
      │ *
┌─────────────┐
│chat_messages│
│  (encrypted)│
└─────────────┘

┌──────────────┐       ┌──────────────────┐
│ mcp_servers  │───────│      tools       │
│              │ 1   * │                  │
└──────────────┘       └──────────────────┘

┌──────────────┐       ┌──────────────────┐
│ ingestion_   │       │   audit_logs     │
│    runs      │       │                  │
└──────────────┘       └──────────────────┘
```

### Tables Summary

| Table | Purpose | Records (typical) |
|-------|---------|-------------------|
| users | User accounts | 100-10K |
| groups | Multi-tenancy groups | 10-1K |
| user_group_memberships | User-group associations | 100-50K |
| chat_sessions | Conversation containers | 1K-1M |
| chat_messages | Chat messages (encrypted) | 10K-10M |
| mcp_servers | MCP tool servers | 5-20 |
| tools | Available tools | 20-100 |
| tool_runs | Tool execution history | 10K-1M |
| ingestion_runs | Document processing logs | 1K-100K |
| documents | Document metadata | 1K-1M |
| audit_logs | Security audit trail | 10K-10M |

---

## Core Tables

### users

User accounts and authentication.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(128) UNIQUE NOT NULL,
    is_root BOOLEAN DEFAULT FALSE,
    api_key_hash VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_root ON users(is_root) WHERE is_root = true;
```

**Columns:**
- `id`: Primary key
- `username`: Unique username/email
- `is_root`: Root/superuser flag
- `api_key_hash`: SHA-256 hashed API key
- `created_at`: Account creation timestamp

**Security:**
- API keys stored as SHA-256 hashes
- No plaintext passwords (uses external auth)

### groups

Multi-tenancy groups for team collaboration.

```sql
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_groups_name ON groups(name);
CREATE INDEX idx_groups_created ON groups(created_at DESC);
```

**Columns:**
- `id`: Primary key
- `name`: Unique group name
- `description`: Optional description
- `created_at`: Group creation timestamp
- `updated_at`: Last modification timestamp

### user_group_memberships

Many-to-many relationship between users and groups.

```sql
CREATE TABLE user_group_memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role VARCHAR(32) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, group_id)
);

CREATE INDEX idx_memberships_user ON user_group_memberships(user_id);
CREATE INDEX idx_memberships_group ON user_group_memberships(group_id);
CREATE INDEX idx_memberships_user_group ON user_group_memberships(user_id, group_id);
```

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users
- `group_id`: Foreign key to groups
- `role`: `member` or `admin`
- `joined_at`: Membership creation timestamp

**Constraints:**
- Unique constraint on (user_id, group_id)
- Cascading delete when user or group deleted

### chat_sessions

Conversation containers.

```sql
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(64),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(256),
    model VARCHAR(128),
    enable_tools BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_external_id ON chat_sessions(external_id);
CREATE INDEX idx_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_sessions_user_created ON chat_sessions(user_id, created_at DESC);
```

**Columns:**
- `id`: Primary key
- `external_id`: Client-provided session identifier
- `user_id`: Foreign key to users
- `title`: Optional session title
- `model`: LLM model used
- `enable_tools`: Tool usage flag
- `created_at`: Session creation timestamp
- `updated_at`: Last activity timestamp

### chat_messages

Chat messages with Fernet encryption.

```sql
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,
    content BYTEA,  -- Fernet encrypted
    tool_call_name VARCHAR(256),
    tool_call_id VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tokens_in INTEGER,
    tokens_out INTEGER
);

CREATE INDEX idx_messages_session ON chat_messages(session_id);
CREATE INDEX idx_messages_session_created ON chat_messages(session_id, created_at DESC);
CREATE INDEX idx_messages_tokens ON chat_messages(session_id, tokens_in, tokens_out)
    WHERE tokens_in IS NOT NULL;
CREATE INDEX idx_messages_encrypted ON chat_messages(session_id, created_at)
    WHERE content IS NOT NULL;
```

**Columns:**
- `id`: Primary key
- `session_id`: Foreign key to chat_sessions
- `role`: Message role (user, assistant, system, tool)
- `content`: **ENCRYPTED** message content (Fernet)
- `tool_call_name`: Tool name if tool call
- `tool_call_id`: Tool call identifier
- `created_at`: Message timestamp
- `tokens_in`: Input tokens consumed
- `tokens_out`: Output tokens generated

**Security:**
- Content encrypted with Fernet (AES-128)
- Encryption key derived from `CHAT_MESSAGE_ENCRYPTION_SECRET`
- Mandatory encryption (no plaintext fallback)

### mcp_servers

MCP tool server registry.

```sql
CREATE TABLE mcp_servers (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(64) UNIQUE NOT NULL,
    url VARCHAR(512) NOT NULL,
    healthy BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_servers_server_id ON mcp_servers(server_id);
CREATE INDEX idx_servers_healthy ON mcp_servers(healthy);
```

**Columns:**
- `id`: Primary key
- `server_id`: Unique server identifier
- `url`: Server URL
- `healthy`: Health status flag
- `last_seen`: Last heartbeat timestamp

### tools

Available tools from MCP servers.

```sql
CREATE TABLE tools (
    id SERIAL PRIMARY KEY,
    mcp_server_id INTEGER NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    input_schema JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    last_discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mcp_server_id, name)
);

CREATE INDEX idx_tools_name ON tools(name);
CREATE INDEX idx_tools_enabled ON tools(enabled);
CREATE INDEX idx_tools_server ON tools(mcp_server_id);
```

**Columns:**
- `id`: Primary key
- `mcp_server_id`: Foreign key to mcp_servers
- `name`: Qualified tool name (e.g., "web.web_search")
- `description`: Tool description
- `input_schema`: JSON Schema for tool inputs
- `enabled`: Tool enabled flag
- `last_discovered_at`: Discovery timestamp

**Constraints:**
- Unique constraint on (mcp_server_id, name)
- input_schema limited to 10KB

### tool_runs

Tool execution history and analytics.

```sql
CREATE TABLE tool_runs (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER REFERENCES tools(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE SET NULL,
    message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
    tool_name VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL,
    start_ts TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_ts TIMESTAMP WITH TIME ZONE,
    latency_ms INTEGER,
    args JSONB,
    error_message TEXT,
    result_preview TEXT
);

CREATE INDEX idx_tool_runs_user ON tool_runs(user_id, start_ts DESC);
CREATE INDEX idx_tool_runs_tool ON tool_runs(tool_name, start_ts DESC);
CREATE INDEX idx_tool_runs_analytics ON tool_runs(user_id, tool_name, status, start_ts DESC);
CREATE INDEX idx_tool_runs_message ON tool_runs(message_id, start_ts DESC);
```

**Columns:**
- `id`: Primary key
- `tool_id`: Foreign key to tools (nullable)
- `user_id`: Foreign key to users
- `session_id`: Foreign key to chat_sessions (nullable)
- `message_id`: Foreign key to chat_messages (nullable)
- `tool_name`: Tool name (denormalized for analytics)
- `status`: Execution status (start, success, error)
- `start_ts`: Execution start timestamp
- `end_ts`: Execution end timestamp
- `latency_ms`: Execution duration
- `args`: Tool arguments (JSONB)
- `error_message`: Error details if failed
- `result_preview`: Truncated result (first 2KB)

### ingestion_runs

Document processing history.

```sql
CREATE TABLE ingestion_runs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    from_web BOOLEAN DEFAULT FALSE,
    recursive BOOLEAN DEFAULT FALSE,
    tags JSONB,
    collection VARCHAR(128),
    totals_files INTEGER DEFAULT 0,
    totals_chunks INTEGER DEFAULT 0,
    errors JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(32) DEFAULT 'success'
);

CREATE INDEX idx_ingestion_user ON ingestion_runs(user_id, started_at DESC);
CREATE INDEX idx_ingestion_status ON ingestion_runs(status);
```

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users
- `target`: Path or URL ingested
- `from_web`: Web ingestion flag
- `recursive`: Recursive processing flag
- `tags`: Tags applied (JSONB)
- `collection`: Collection name
- `totals_files`: Files processed count
- `totals_chunks`: Chunks created count
- `errors`: Error details (JSONB)
- `started_at`: Processing start timestamp
- `finished_at`: Processing end timestamp
- `status`: Status (success, partial, failed)

### documents

Document metadata and vector references.

```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    is_private BOOLEAN DEFAULT FALSE,
    uri TEXT,
    path TEXT,
    mime VARCHAR(128),
    bytes_size BIGINT,
    source VARCHAR(32),
    tags JSONB,
    collection VARCHAR(128),
    path_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ingested_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, path_hash)
);

CREATE INDEX idx_documents_user ON documents(user_id, created_at DESC);
CREATE INDEX idx_documents_collection ON documents(collection, created_at DESC);
CREATE INDEX idx_documents_group_private ON documents(group_id, is_private);
CREATE INDEX idx_documents_path_hash ON documents(path_hash);
```

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users
- `group_id`: Foreign key to groups (nullable)
- `is_private`: Privacy flag
- `uri`: Web URI if from web
- `path`: Local path if from file
- `mime`: MIME type
- `bytes_size`: File size in bytes
- `source`: Source type (file, web)
- `tags`: Document tags (JSONB)
- `collection`: Collection name
- `path_hash`: SHA-256 hash of path/URI
- `created_at`: First ingestion timestamp
- `last_ingested_at`: Last reingestion timestamp

**Constraints:**
- Unique constraint on (user_id, path_hash)
- Tags limited to 5KB

### audit_logs

Security audit trail.

```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64),
    resource_id VARCHAR(128),
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    correlation_id VARCHAR(36),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user_ts ON audit_logs(user_id, timestamp);
CREATE INDEX idx_audit_action_ts ON audit_logs(action, timestamp);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_correlation ON audit_logs(correlation_id);
```

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users (nullable for system actions)
- `action`: Action identifier (e.g., "group.create", "user.login")
- `resource_type`: Resource type affected
- `resource_id`: Resource identifier
- `changes`: Before/after values (JSONB)
- `ip_address`: Client IP address
- `user_agent`: Client user agent
- `correlation_id`: Request correlation ID
- `success`: Operation success flag
- `error_message`: Error details if failed
- `timestamp`: Action timestamp

---

## Relationships

### User → Groups (Many-to-Many)

```python
# User model
class User(Base):
    group_memberships: Mapped[list["UserGroupMembership"]] = relationship(
        back_populates="user"
    )

# Group model
class Group(Base):
    members: Mapped[list["UserGroupMembership"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan"
    )
```

**Query Example:**
```python
# Get all groups for a user
user_groups = await session.execute(
    select(Group)
    .join(UserGroupMembership)
    .where(UserGroupMembership.user_id == user_id)
    .options(selectinload(Group.members))
)
```

### User → Chat Sessions (One-to-Many)

```python
class User(Base):
    sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="user"
    )

class ChatSession(Base):
    user: Mapped[User] = relationship(back_populates="sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )
```

**Query Example:**
```python
# Get session with messages
session = await session.execute(
    select(ChatSession)
    .options(joinedload(ChatSession.messages))
    .where(ChatSession.id == session_id)
)
```

### MCP Server → Tools (One-to-Many)

```python
class MCPServer(Base):
    tools: Mapped[list["Tool"]] = relationship(
        back_populates="server",
        cascade="all, delete-orphan"
    )
```

---

## Indexes

### Performance Indexes

Critical indexes for query performance:

1. **User lookups:**
   - `idx_users_username` - Username login
   - `idx_users_root` - Root user queries

2. **Group operations:**
   - `idx_groups_name` - Group name lookups
   - `idx_memberships_user_group` - Membership checks

3. **Chat queries:**
   - `idx_sessions_user_created` - User session list
   - `idx_messages_session_created` - Message history

4. **Analytics:**
   - `idx_tool_runs_analytics` - Tool usage analytics
   - `idx_audit_user_ts` - User audit trail

### Covering Indexes

Indexes that cover entire queries:

```sql
-- Session list query covered by index
CREATE INDEX idx_sessions_user_created
ON chat_sessions(user_id, created_at DESC);

-- Analytics query covered by index
CREATE INDEX idx_tool_runs_analytics
ON tool_runs(user_id, tool_name, status, start_ts DESC);
```

---

## Constraints

### Foreign Key Constraints

All foreign keys use appropriate `ON DELETE` actions:

- **CASCADE**: Dependent data deleted with parent
  - `chat_messages.session_id` → `chat_sessions.id`
  - `user_group_memberships.user_id` → `users.id`

- **SET NULL**: Reference nullified when parent deleted
  - `documents.group_id` → `groups.id`
  - `tool_runs.tool_id` → `tools.id`

### Unique Constraints

Prevent duplicate data:

```sql
-- User-group membership uniqueness
UNIQUE(user_id, group_id)

-- Document path uniqueness per user
UNIQUE(user_id, path_hash)

-- Tool uniqueness per server
UNIQUE(mcp_server_id, name)

-- MCP server uniqueness
UNIQUE(server_id)
```

### Check Constraints

Data validation at database level:

```sql
-- Valid role values
CHECK (role IN ('member', 'admin'))

-- Valid status values
CHECK (status IN ('pending', 'success', 'partial', 'failed'))

-- Positive values
CHECK (totals_files >= 0)
CHECK (totals_chunks >= 0)
```

---

## Encryption

### Fernet Encryption for Messages

Chat messages use Fernet (AES-128) encryption:

**Encryption Process:**
```python
from cryptography.fernet import Fernet
import hashlib
import base64

# Derive key from secret
secret = settings.chat_message_encryption_secret
key_material = hashlib.sha256(secret.encode()).digest()
key = base64.urlsafe_b64encode(key_material)
fernet = Fernet(key)

# Encrypt message
encrypted = fernet.encrypt(message.encode('utf-8'))

# Store in database
message.content = encrypted
```

**Decryption Process:**
```python
# Read from database
encrypted_content = message.content

# Decrypt
decrypted = fernet.decrypt(encrypted_content)
plaintext = decrypted.decode('utf-8')
```

**Key Rotation:**
```python
# Generate new Fernet key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Update CHAT_MESSAGE_ENCRYPTION_SECRET in .env
# Old messages can be migrated with dual-key decryption
```

---

## Migrations

### Alembic Setup

```bash
# Initialize Alembic
alembic init ops/alembic

# Configure alembic.ini
sqlalchemy.url = postgresql+asyncpg://...

# Generate migration
alembic revision --autogenerate -m "Add audit logs table"

# Review and edit migration
vim ops/alembic/versions/xxx_add_audit_logs.py

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Migration Example

```python
# ops/alembic/versions/xxx_add_audit_logs.py
def upgrade():
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(128), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_user_ts', 'audit_logs', ['user_id', 'timestamp'])

def downgrade():
    op.drop_index('idx_audit_user_ts', 'audit_logs')
    op.drop_table('audit_logs')
```

---

## Query Patterns

### Efficient Queries

#### Get User with Groups

```python
# ✅ Good: Eager loading
user = await session.execute(
    select(User)
    .options(
        selectinload(User.group_memberships)
        .selectinload(UserGroupMembership.group)
    )
    .where(User.id == user_id)
)

# ❌ Bad: N+1 queries
user = await session.get(User, user_id)
for membership in user.group_memberships:  # Triggers query
    print(membership.group.name)  # Triggers query
```

#### Get Session with Messages

```python
# ✅ Good: Joined eager loading
session = await session.execute(
    select(ChatSession)
    .options(joinedload(ChatSession.messages))
    .where(ChatSession.id == session_id)
)

# Unique() required for joined eager loading
result = result.unique().scalar_one()
```

#### Analytics Query

```python
# ✅ Good: Aggregation with proper indexes
stats = await session.execute(
    select(
        func.count(ToolRun.id).label('total_runs'),
        func.avg(ToolRun.latency_ms).label('avg_latency')
    )
    .where(
        ToolRun.user_id == user_id,
        ToolRun.start_ts >= start_date,
        ToolRun.status == 'success'
    )
    .group_by(ToolRun.tool_name)
)
```

### Bulk Operations

```python
# Bulk insert
users = [
    User(username=f"user{i}@example.com")
    for i in range(100)
]
session.add_all(users)
await session.flush()

# Bulk update
await session.execute(
    update(Tool)
    .where(Tool.mcp_server_id == server_id)
    .values(enabled=False)
)
```

---

## Database Maintenance

### Vacuum and Analyze

```sql
-- Regular maintenance
VACUUM ANALYZE chat_messages;
VACUUM ANALYZE tool_runs;

-- Full vacuum (requires downtime)
VACUUM FULL chat_messages;
```

### Index Maintenance

```sql
-- Rebuild indexes
REINDEX TABLE chat_messages;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

### Monitoring Queries

```sql
-- Active queries
SELECT pid, usename, query, state, query_start
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Table sizes
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Backup & Recovery

### Backup

```bash
# Full database backup
pg_dump -U postgres youworker > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -U postgres youworker | gzip > backup_$(date +%Y%m%d).sql.gz

# Schema only
pg_dump -U postgres --schema-only youworker > schema.sql
```

### Restore

```bash
# Restore from backup
psql -U postgres youworker < backup_20251030.sql

# Restore from compressed
gunzip -c backup_20251030.sql.gz | psql -U postgres youworker
```

---

## Performance Tips

1. **Use Indexes**: All foreign keys and frequently queried columns indexed
2. **Eager Loading**: Always use `selectinload()` or `joinedload()` to prevent N+1
3. **Connection Pooling**: Configure pool size based on load
4. **Query Limits**: Always limit query results with `.limit()`
5. **Explain Plans**: Use `EXPLAIN ANALYZE` for slow queries
6. **Partial Indexes**: Use `WHERE` clauses on indexes for filtered queries
7. **JSON Indexes**: Index JSONB columns with GIN for better performance

```sql
-- GIN index for JSONB
CREATE INDEX idx_tools_input_schema_gin ON tools USING GIN(input_schema);

-- Query with JSONB
SELECT * FROM tools WHERE input_schema @> '{"type": "object"}';
```

---

## Summary

The YouWorker database schema is designed for:

✅ **Performance**: Comprehensive indexing, eager loading support
✅ **Security**: Encrypted messages, audit logging
✅ **Scalability**: Partitioning-ready, efficient queries
✅ **Maintainability**: Clear relationships, proper constraints
✅ **Multi-tenancy**: Group-based isolation
✅ **Analytics**: Denormalized fields for fast aggregation

Key features:
- Fernet encryption for chat messages
- Comprehensive audit trail
- Multi-tenancy via groups
- Tool execution analytics
- Document ingestion tracking
