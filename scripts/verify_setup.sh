#!/bin/bash
# Verification script to check if all services are healthy

set -e

COMPOSE_FILE_PATH="${COMPOSE_FILE:-ops/compose/docker-compose.yml}"
COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE_PATH")

echo "🔍 Verifying YouWorker AI Agent Backend Setup..."
echo ""

# Check if docker compose is running
echo "1️⃣ Checking if services are running..."
if "${COMPOSE_CMD[@]}" ps | grep -q "Up"; then
    echo "✅ Services are running"
else
    echo "❌ Services are not running. Start with: make compose-up"
    exit 1
fi

echo ""
echo "2️⃣ Checking individual service health..."

# Check Ollama
echo -n "   Ollama: "
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

# Check Qdrant
echo -n "   Qdrant: "
if curl -s http://localhost:6333/health > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

# Check MCP Web
echo -n "   MCP Web: "
if curl -s http://localhost:7001/health > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

# Check MCP Semantic
echo -n "   MCP Semantic: "
if curl -s http://localhost:7002/health > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

# Check MCP Datetime
echo -n "   MCP Datetime: "
if curl -s http://localhost:7003/health > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

# Check API
echo -n "   API: "
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

echo ""
echo "3️⃣ Checking Ollama models..."
if "${COMPOSE_CMD[@]}" exec -T ollama ollama list | grep -q "gpt-oss:20b"; then
    echo "✅ gpt-oss:20b model is available"
else
    echo "⚠️  gpt-oss:20b model not found. Run: make pull-models"
fi

if "${COMPOSE_CMD[@]}" exec -T ollama ollama list | grep -q "embeddinggemma:300m"; then
    echo "✅ embeddinggemma:300m model is available"
else
    echo "⚠️  embeddinggemma:300m model not found. Run: make pull-models"
fi

echo ""
echo "4️⃣ Testing chat endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:8001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Say hi"}],
    "stream": false,
    "enable_tools": false
  }')

if echo "$RESPONSE" | grep -q "content"; then
    echo "✅ Chat endpoint is working"
else
    echo "❌ Chat endpoint failed"
fi

echo ""
echo "✨ Setup verification complete!"
echo ""
echo "📚 Next steps:"
echo "   - View logs: make compose-logs"
echo "   - Run tests: make test"
echo "   - Read API docs: http://localhost:8001/docs"
