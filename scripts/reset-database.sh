#!/bin/bash

# Reset database script for YouWorker.AI (PRE-RELEASE ONLY)
# This script drops all data and recreates the database with the latest schema
# ⚠️  WARNING: This will DELETE ALL DATA!

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║          ⚠️  DATABASE RESET - DATA WILL BE LOST ⚠️          ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This script will:${NC}"
echo "  1. Drop all PostgreSQL data"
echo "  2. Drop all Qdrant vector data"
echo "  3. Recreate database with fresh schema (with encryption)"
echo "  4. Apply alembic migration 0001_init"
echo ""
echo -e "${RED}ALL EXISTING DATA WILL BE PERMANENTLY DELETED!${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
echo ""

if [[ ! $REPLY == "yes" ]]; then
    echo "Database reset cancelled."
    exit 0
fi

echo -e "${YELLOW}Starting database reset...${NC}"
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-youworker}"
POSTGRES_DB="${POSTGRES_DB:-youworker}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-youworker}"
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"

# 1. Stop services
echo "→ Stopping services..."
docker compose -f ops/compose/docker-compose.yml down 2>/dev/null || true

# 2. Remove PostgreSQL data
echo "→ Removing PostgreSQL data..."
rm -rf data/postgres/* 2>/dev/null || true

# 3. Remove Qdrant data
echo "→ Removing Qdrant data..."
rm -rf data/qdrant/* 2>/dev/null || true

# 4. Start services
echo "→ Starting services..."
docker compose -f ops/compose/docker-compose.yml up -d postgres qdrant

# Wait for PostgreSQL to be ready
echo "→ Waiting for PostgreSQL to be ready..."
sleep 5
until docker compose -f ops/compose/docker-compose.yml exec -T postgres pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; do
    echo "  Waiting for PostgreSQL..."
    sleep 2
done
echo "  PostgreSQL is ready ✓"

# Wait for Qdrant to be ready
echo "→ Waiting for Qdrant to be ready..."
sleep 3
until curl -s "$QDRANT_URL/health" > /dev/null 2>&1; do
    echo "  Waiting for Qdrant..."
    sleep 2
done
echo "  Qdrant is ready ✓"

# 5. Create database
echo "→ Creating database..."
docker compose -f ops/compose/docker-compose.yml exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" 2>/dev/null || true
docker compose -f ops/compose/docker-compose.yml exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $POSTGRES_DB;"

# 6. Run alembic migrations
echo "→ Running alembic migrations..."
cd "$(dirname "$0")/.." || exit 1

# Install alembic if needed
if ! command -v alembic &> /dev/null; then
    echo "  Installing alembic..."
    pip install alembic psycopg2-binary > /dev/null 2>&1
fi

# Run migrations
PYTHONPATH=. alembic -c ops/alembic/alembic.ini upgrade head

# 7. Verify
echo ""
echo -e "${GREEN}→ Verifying database schema...${NC}"
docker compose -f ops/compose/docker-compose.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt" | grep -E "chat_messages|users|documents" && echo -e "${GREEN}  Schema verified ✓${NC}" || echo -e "${RED}  Schema verification failed ✗${NC}"

# 8. Start remaining services
echo ""
echo "→ Starting all services..."
docker compose -f ops/compose/docker-compose.yml up -d

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                ✓ Database Reset Complete                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Database is now ready with:"
echo "  • Fresh PostgreSQL schema (with encrypted chat messages)"
echo "  • Empty Qdrant vector store"
echo "  • All services running"
echo ""
echo "Next steps:"
echo "  1. Verify encryption is configured: Check CHAT_MESSAGE_ENCRYPTION_SECRET in .env"
echo "  2. Access the application at: https://localhost:8000"
echo "  3. Check API docs at: https://localhost:8001/docs"
echo ""
