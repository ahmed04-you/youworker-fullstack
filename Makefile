COMPOSE_FILE ?= ops/compose/docker-compose.yml
COMPOSE_BIN ?= docker compose
COMPOSE_CMD ?= $(COMPOSE_BIN) -f $(COMPOSE_FILE)

.PHONY: help compose-up compose-down compose-logs compose-restart build clean test lint format ssl-setup start-ssl backup

# Default target
help:
	@echo "Available targets:"
	@echo "  compose-up       - Start all services with docker compose"
	@echo "  compose-down     - Stop all services"
	@echo "  compose-logs     - View logs from all services"
	@echo "  compose-restart  - Restart all services"
	@echo "  build            - Build all Docker images"
	@echo "  clean            - Remove containers, volumes, and images"
	@echo "  test             - Run tests"
	@echo "  lint             - Run linters"
	@echo "  format           - Format code with black"
	@echo "  pull-models      - Pull Ollama models"
	@echo "  status           - Show service status"
	@echo "  dev-frontend     - Run frontend in development mode"
	@echo "  frontend-logs    - View frontend logs"
	@echo "  ssl-setup        - Generate SSL certificates"
	@echo "  start-ssl        - Start services with SSL setup"

# Start all services (GPU auto-detected and used if available)
compose-up:
	@# Ensure SSL certs exist for nginx
	@if [ ! -f data/nginx/ssl/cert.pem ] || [ ! -f data/nginx/ssl/key.pem ]; then \
		echo "[compose-up] Generating local SSL certificates..."; \
		./scripts/generate-ssl-cert.sh localhost 127.0.0.1; \
	fi
	@if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then \
		echo "[compose-up] GPU detected and will be used for acceleration"; \
	else \
		echo "[compose-up] No GPU detected; services will run on CPU"; \
	fi
	@$(COMPOSE_CMD) up -d

# Stop all services
compose-down:
	$(COMPOSE_CMD) --env-file .env down

# View logs
compose-logs:
	$(COMPOSE_CMD) --env-file .env logs -f

# Restart services
compose-restart:
	$(COMPOSE_CMD) --env-file .env restart

# Build images
build:
	$(COMPOSE_CMD) --env-file .env build

# Clean everything
clean:
	$(COMPOSE_CMD) --env-file .env down -v --rmi all
	@echo "Cleaned up all containers, volumes, and images"

# Reset persisted data and start fresh
reset-data:
	@echo "This will remove all persisted data under ./data"; \
	read -p "Type 'yes' to proceed: " ans; \
	if [ "$$ans" = "yes" ]; then \
		echo "Stopping stack..."; \
		$(COMPOSE_CMD) down; \
		echo "Removing data directories as root (handles permissions)..."; \
		docker run --rm -v "$(shell pwd)/data:/data" alpine:3 sh -c 'rm -rf /data/*'; \
		echo "Re-creating expected directories..."; \
		mkdir -p data/postgres data/qdrant data/ollama data/nginx/ssl data/uploads data/models data/grafana data/prometheus; \
		chmod -R u+rwX,go+rwX data; \
		echo "Data reset complete."; \
	else \
		echo "Aborted."; \
	fi

# Show service status
status:
	$(COMPOSE_CMD) ps

# Pull Ollama models
pull-models:
	$(COMPOSE_CMD) exec ollama ollama pull gpt-oss:20b
	$(COMPOSE_CMD) exec ollama ollama pull embeddinggemma:300m
	@echo "Models pulled successfully"

# Run tests
test:
	pytest tests/ -v --cov=packages --cov=apps

# Lint code
lint:
	ruff check packages/ apps/
	black --check packages/ apps/

# Format code
format:
	black packages/ apps/
	ruff check --fix packages/ apps/

# Development: run API locally (requires services running)
dev-api:
	PYTHONPATH=. python -m uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8001

# Development: run MCP servers locally
dev-mcp-web:
	PYTHONPATH=. python apps/mcp_servers/web/server.py

dev-mcp-semantic:
	PYTHONPATH=. python apps/mcp_servers/semantic/server.py

dev-mcp-datetime:
	PYTHONPATH=. python apps/mcp_servers/datetime/server.py

dev-mcp-ingest:
	PYTHONPATH=. python apps/mcp_servers/ingest/server.py

dev-mcp-units:
	PYTHONPATH=. python apps/mcp_servers/units/server.py

# Install dependencies
install:
	uv pip install --requirement requirements.txt

# Install frontend dependencies
install-frontend:
	cd apps/frontend && npm install

# Create .env file
setup-env:
	@if [ ! -f .env ]; then \
		echo "Creating .env file..."; \
		echo "OLLAMA_BASE_URL=http://localhost:11434" > .env; \
		echo "CHAT_MODEL=gpt-oss:20b" >> .env; \
		echo "EMBED_MODEL=embeddinggemma:300m" >> .env; \
			echo "QDRANT_URL=http://localhost:6333" >> .env; \
			echo "DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/youworker" >> .env; \
			echo "ROOT_API_KEY=dev-root-key" >> .env; \
			echo "JWT_SECRET=dev-jwt-secret" >> .env; \
			echo "MCP_SERVER_URLS=http://mcp_web:7001,http://mcp_semantic:7002,http://mcp_datetime:7003,http://mcp_ingest:7004,http://mcp_units:7005" >> .env; \
		echo "MCP_REFRESH_INTERVAL=90" >> .env; \
		echo "LOG_LEVEL=INFO" >> .env; \
		echo ".env file created"; \
	else \
		echo ".env file already exists"; \
	fi

# Run database migrations using Alembic
db-migrate:
	@if [ -z "$$DATABASE_URL" ]; then \
		if [ -f .env ]; then \
			export DATABASE_URL=$$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d'=' -f2-); \
		fi; \
	fi; \
	if [ -z "$$DATABASE_URL" ]; then \
		echo "DATABASE_URL not set. Export DATABASE_URL or add it to .env"; \
		exit 1; \
	fi; \
	DATABASE_URL=$$DATABASE_URL alembic -c ops/alembic/alembic.ini upgrade head

# Development: run frontend locally (requires API running)
dev-frontend:
	cd apps/frontend && npm run dev

# View frontend logs
frontend-logs:
	$(COMPOSE_CMD) logs -f frontend

# Build frontend for production
build-frontend:
	cd apps/frontend && npm run build

# SSL certificate generation
ssl-setup:
	@echo "Generating SSL certificates..."
	./scripts/generate-ssl-cert.sh localhost 127.0.0.1

# Start with SSL setup
start-ssl:
	@echo "Starting YouWorker.AI with SSL..."
	./scripts/start-with-ssl.sh localhost 127.0.0.1

# Start with SSL for production domain
start-ssl-prod:
	@echo "Starting YouWorker.AI with SSL for production..."
	./scripts/start-with-ssl.sh $(DOMAIN) $(IP)

# Create necessary directories
setup-dirs:
	@echo "Creating necessary directories..."
	mkdir -p data/postgres data/qdrant data/ollama data/nginx/ssl data/uploads data/models
	mkdir -p examples/ingestion

# Full setup (directories + SSL + start)
setup-full: setup-dirs ssl-setup compose-up
	@echo "Full setup completed!"
	@echo "Access YouWorker.AI at: https://localhost:8000"
	@echo "API documentation at: https://localhost:8001/docs"

# Create database backup
backup:
	@echo "Creating database backup..."
	@mkdir -p data/backups
	$(COMPOSE_CMD) exec -T postgres pg_dump -U $${POSTGRES_USER:-postgres} $${POSTGRES_DB:-youworker} > data/backups/postgres_backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup created in data/backups/"

# Restore database from backup
restore:
	@if [ -z "$(BACKUP_FILE)" ]; then echo "Usage: make restore BACKUP_FILE=<path_to_backup>"; exit 1; fi
	@echo "Restoring database from $(BACKUP_FILE)..."
	$(COMPOSE_CMD) exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS youworker_temp;"
	$(COMPOSE_CMD) exec -T postgres psql -U postgres -c "CREATE DATABASE youworker_temp;"
	$(COMPOSE_CMD) exec -T postgres psql -U postgres youworker_temp < $(BACKUP_FILE)
	$(COMPOSE_CMD) exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS youworker;"
	$(COMPOSE_CMD) exec -T postgres psql -U postgres -c "ALTER DATABASE youworker_temp RENAME TO youworker;"
	@echo "Database restored from $(BACKUP_FILE)"

# Setup automated backups
setup-backup:
	@echo "Setting up automated backups..."
	@mkdir -p data/backups
	@chmod +x ops/scripts/backup-database.sh
	@echo "Adding cron job for daily backups..."
	@crontab -l 2>/dev/null; crontab -; echo "0 2 * * * $(shell pwd)/ops/scripts/backup-database.sh >> $(shell pwd)/data/backups/backup.log 2>&1" | crontab -
	@echo "Automated backups configured. Backups will run daily at 2:00 AM."
	@echo "Backup directory: $(shell pwd)/data/backups"
