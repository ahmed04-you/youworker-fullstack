COMPOSE_FILE ?= ops/compose/docker-compose.yml
COMPOSE_CMD ?= docker compose -f $(COMPOSE_FILE)

.PHONY: help compose-up compose-down compose-logs compose-restart build clean test lint format ssl-setup start-ssl

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

# Start all services
compose-up:
	$(COMPOSE_CMD) up -d

# Stop all services
compose-down:
	$(COMPOSE_CMD) down

# View logs
compose-logs:
	$(COMPOSE_CMD) logs -f

# Restart services
compose-restart:
	$(COMPOSE_CMD) restart

# Build images
build:
	$(COMPOSE_CMD) build

# Clean everything
clean:
	$(COMPOSE_CMD) down -v --rmi all
	@echo "Cleaned up all containers, volumes, and images"

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
			echo "MCP_SERVER_URLS=http://mcp_web:7001,http://mcp_semantic:7002,http://mcp_datetime:7003,http://mcp_ingest:7004,http://mcp_units:7005" >> .env; \
		echo "MCP_REFRESH_INTERVAL=90" >> .env; \
		echo "LOG_LEVEL=INFO" >> .env; \
		echo ".env file created"; \
	else \
		echo ".env file already exists"; \
	fi

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
	mkdir -p data/{postgres,qdrant,ollama,nginx/ssl,uploads,models}
	mkdir -p examples/ingestion

# Full setup (directories + SSL + start)
setup-full: setup-dirs ssl-setup compose-up
	@echo "Full setup completed!"
	@echo "Access YouWorker.AI at: https://localhost:8000"
	@echo "API documentation at: https://localhost:8001/docs"
