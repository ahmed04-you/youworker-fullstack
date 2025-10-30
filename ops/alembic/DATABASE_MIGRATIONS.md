# Database Migration Strategy

This document describes the database migration strategy for the YouWorker platform using Alembic.

## Table of Contents

- [Overview](#overview)
- [Pre-Release Strategy](#pre-release-strategy)
- [Post-Release Strategy](#post-release-strategy)
- [Migration Best Practices](#migration-best-practices)
- [Common Migration Scenarios](#common-migration-scenarios)
- [Rollback Strategy](#rollback-strategy)
- [Testing Migrations](#testing-migrations)

## Overview

YouWorker uses [Alembic](https://alembic.sqlalchemy.org/) for database schema migrations. Alembic is a lightweight database migration tool that works with SQLAlchemy.

**Key Concepts:**
- **Migration**: A script that describes changes to the database schema
- **Revision**: A unique identifier for each migration
- **Head**: The most recent migration in the chain
- **Upgrade**: Apply migrations to move forward in the revision chain
- **Downgrade**: Revert migrations to move backward in the revision chain

## Pre-Release Strategy

**Status:** Currently in pre-release (v0.x.x)

During the pre-release phase, we use a **single initial migration** approach to simplify development:

### When to Modify the Initial Migration

You can modify the initial migration (`0001_init.py`) directly when:
- Adding new models or fields
- Changing column types or constraints
- Adding indexes or relationships
- The application is not yet deployed to production

### Steps to Update Schema (Pre-Release)

```bash
# 1. Update your models in packages/db/models.py
vim packages/db/models.py

# 2. Stop the database if running
docker-compose down

# 3. Delete the database volume to start fresh
docker-compose down -v

# 4. Modify the initial migration directly
vim ops/alembic/versions/0001_init.py

# 5. Recreate database with updated schema
docker-compose up -d postgres

# 6. Apply the updated migration
make db-migrate

# 7. Verify schema
make db-verify
```

### Advantages of This Approach (Pre-Release)
- ✅ Keeps migration history clean and simple
- ✅ Avoids accumulation of development migrations
- ✅ Easier to understand schema evolution
- ✅ Fast iteration during development

### Disadvantages
- ❌ Cannot be used once in production
- ❌ Requires dropping and recreating database
- ❌ All data is lost on each schema change

## Post-Release Strategy

**When to switch:** Once the application is deployed to production or when data preservation becomes critical.

### Creating New Migrations

Once in production, **never modify existing migrations**. Instead, create new migrations for each schema change:

```bash
# 1. Update your models in packages/db/models.py
vim packages/db/models.py

# 2. Auto-generate a new migration
alembic revision --autogenerate -m "add user groups support"

# This creates a new file: ops/alembic/versions/XXXX_add_user_groups_support.py

# 3. Review the generated migration carefully
vim ops/alembic/versions/XXXX_add_user_groups_support.py

# 4. Test the migration on a copy of production data
# (See "Testing Migrations" section)

# 5. Apply migration to development database
alembic upgrade head

# 6. Commit the migration file to version control
git add ops/alembic/versions/XXXX_add_user_groups_support.py
git commit -m "Add migration for user groups support"
```

### Migration Review Checklist

Before applying a migration to production, review:

- [ ] **Data Safety:** Does the migration preserve existing data?
- [ ] **Performance:** Will the migration lock tables for a long time?
- [ ] **Reversibility:** Does the `downgrade()` function correctly undo changes?
- [ ] **Indexes:** Are new indexes created concurrently (PostgreSQL)?
- [ ] **Constraints:** Are constraints validated appropriately?
- [ ] **Dependencies:** Does the migration depend on application code changes?

### Auto-generation Limitations

Alembic's autogenerate is powerful but not perfect. It **cannot detect**:
- Changes to table names (sees as drop + create)
- Changes to column names (sees as drop + create)
- Changes to constraint names
- Custom SQL functions or triggers
- Changes to server defaults

**Always review generated migrations manually** and test them thoroughly.

## Migration Best Practices

### 1. Use Descriptive Migration Names

```bash
# Good
alembic revision -m "add email_verified column to users"
alembic revision -m "create audit_log table"
alembic revision -m "add index on documents.created_at"

# Bad
alembic revision -m "update db"
alembic revision -m "changes"
alembic revision -m "fix"
```

### 2. One Logical Change Per Migration

Each migration should represent a single logical change:

```python
# Good: Single focused change
def upgrade():
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), default=False))
    op.create_index('idx_users_email_verified', 'users', ['email_verified'])

# Bad: Multiple unrelated changes
def upgrade():
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), default=False))
    op.create_table('audit_logs', ...)
    op.alter_column('documents', 'title', type_=sa.Text())  # Unrelated changes
```

### 3. Always Implement downgrade()

Every migration should have a working `downgrade()` function:

```python
def upgrade():
    op.add_column('users', sa.Column('phone_number', sa.String(20), nullable=True))

def downgrade():
    op.drop_column('users', 'phone_number')
```

### 4. Handle Nullable Columns Carefully

When adding a non-nullable column to an existing table:

```python
def upgrade():
    # Step 1: Add column as nullable
    op.add_column('users', sa.Column('status', sa.String(20), nullable=True))

    # Step 2: Populate default values
    op.execute("UPDATE users SET status = 'active' WHERE status IS NULL")

    # Step 3: Make column non-nullable
    op.alter_column('users', 'status', nullable=False)

def downgrade():
    op.drop_column('users', 'status')
```

### 5. Use Batch Operations for Large Tables

For tables with millions of rows, use batch operations:

```python
from alembic import op
import sqlalchemy as sa

def upgrade():
    # For PostgreSQL, use concurrent index creation
    op.create_index(
        'idx_documents_user_id',
        'documents',
        ['user_id'],
        postgresql_concurrently=True
    )

def downgrade():
    op.drop_index('idx_documents_user_id', table_name='documents')
```

### 6. Add Comments for Complex Migrations

```python
def upgrade():
    """
    Add support for document versioning.

    This migration:
    1. Adds version and parent_id columns to documents table
    2. Creates an index for efficient version queries
    3. Populates initial version numbers for existing documents
    """
    op.add_column('documents', sa.Column('version', sa.Integer(), default=1))
    op.add_column('documents', sa.Column('parent_id', sa.Integer(), nullable=True))

    # Set version 1 for all existing documents
    op.execute("UPDATE documents SET version = 1 WHERE version IS NULL")

    op.create_index('idx_documents_parent_version', 'documents', ['parent_id', 'version'])
```

## Common Migration Scenarios

### Adding a New Table

```python
def upgrade():
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(128), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
    )
    op.create_index('idx_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('idx_audit_logs_timestamp', 'audit_logs', ['timestamp'])

def downgrade():
    op.drop_index('idx_audit_logs_timestamp')
    op.drop_index('idx_audit_logs_user_id')
    op.drop_table('audit_logs')
```

### Renaming a Column

```python
def upgrade():
    op.alter_column('users', 'api_key', new_column_name='api_key_hash')

def downgrade():
    op.alter_column('users', 'api_key_hash', new_column_name='api_key')
```

### Changing Column Type

```python
def upgrade():
    # For PostgreSQL, we might need to use USING clause
    op.execute("""
        ALTER TABLE documents
        ALTER COLUMN size TYPE bigint
        USING size::bigint
    """)

def downgrade():
    op.execute("""
        ALTER TABLE documents
        ALTER COLUMN size TYPE integer
        USING size::integer
    """)
```

### Adding a Foreign Key

```python
def upgrade():
    op.add_column('documents', sa.Column('group_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_documents_group_id',
        'documents', 'groups',
        ['group_id'], ['id'],
        ondelete='CASCADE'
    )

def downgrade():
    op.drop_constraint('fk_documents_group_id', 'documents', type_='foreignkey')
    op.drop_column('documents', 'group_id')
```

## Rollback Strategy

### Production Rollback Procedure

If a migration causes issues in production:

```bash
# 1. Identify the problematic revision
alembic current

# 2. Rollback to the previous revision
alembic downgrade -1

# 3. Or rollback to a specific revision
alembic downgrade abc123

# 4. Verify database state
alembic current
```

### Rollback Safety Guidelines

- ⚠️ **Never rollback if data has been deleted** - Data loss is permanent
- ✅ **Safe to rollback**: Adding columns, indexes, tables (if not yet populated)
- ⚠️ **Risky to rollback**: Dropping columns, changing types, deleting data
- ✅ **Test rollbacks** on staging before assuming they work

### Creating a Backup Before Migration

```bash
# Always backup before applying migrations to production
pg_dump -h localhost -U youworker -d youworker > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migration
alembic upgrade head

# If problems occur, restore from backup
psql -h localhost -U youworker -d youworker < backup_YYYYMMDD_HHMMSS.sql
```

## Testing Migrations

### Manual Testing

```bash
# 1. Create a test database with production schema
createdb youworker_test
pg_dump -h prod_host -U youworker -d youworker --schema-only | psql -d youworker_test

# 2. Apply new migration
ALEMBIC_CONFIG=test_alembic.ini alembic upgrade head

# 3. Test downgrade
ALEMBIC_CONFIG=test_alembic.ini alembic downgrade -1

# 4. Verify schema
psql -d youworker_test -c "\d"
```

### Automated Testing

Create a test script to verify migrations:

```python
# tests/integration/test_migrations.py
import pytest
from alembic import command
from alembic.config import Config

def test_migration_upgrade_downgrade():
    """Test that migrations can be applied and rolled back."""
    alembic_cfg = Config("ops/alembic/alembic.ini")

    # Get current revision
    command.current(alembic_cfg)

    # Upgrade to head
    command.upgrade(alembic_cfg, "head")

    # Downgrade one revision
    command.downgrade(alembic_cfg, "-1")

    # Re-upgrade
    command.upgrade(alembic_cfg, "head")

def test_migration_idempotency():
    """Test that applying a migration twice doesn't cause errors."""
    alembic_cfg = Config("ops/alembic/alembic.ini")

    # Upgrade to head twice
    command.upgrade(alembic_cfg, "head")
    command.upgrade(alembic_cfg, "head")  # Should be a no-op
```

## Migration Workflow Summary

### Pre-Release (Development)

```
Update models.py → Modify 0001_init.py → Drop DB → Recreate DB → Test
```

### Post-Release (Production)

```
Update models.py → Generate migration → Review migration → Test on staging →
Backup production → Apply to production → Verify → Monitor
```

## Troubleshooting

### "Target database is not up to date"

```bash
# Check current revision
alembic current

# Check migration history
alembic history

# Upgrade to latest
alembic upgrade head
```

### "Can't locate revision identified by 'XXXX'"

This usually means the migration file is missing or the alembic_version table is out of sync:

```bash
# Check alembic_version table
psql -d youworker -c "SELECT * FROM alembic_version"

# Manually update if needed (dangerous!)
psql -d youworker -c "UPDATE alembic_version SET version_num = 'correct_revision_id'"
```

### Migration Generates Too Many Changes

If autogenerate detects unexpected changes:

```bash
# Check for differences between models and database
alembic revision --autogenerate -m "check" --head-only

# Review the generated migration carefully
# It might indicate model definitions don't match the database
```

## References

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Alembic Cookbook](https://alembic.sqlalchemy.org/en/latest/cookbook.html)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)

## Additional Notes

- Migration files are located in: `ops/alembic/versions/`
- Migration configuration: `ops/alembic/alembic.ini`
- Database models: `packages/db/models.py`
- Always test migrations on a copy of production data before applying to production
- Document any manual steps required alongside migrations (e.g., data backfills)
- Consider using database migration locks for distributed deployments
