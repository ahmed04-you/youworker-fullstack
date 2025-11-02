#!/bin/bash
# Quick start script for frontend development

set -e

echo "🚀 Starting YouWorker Frontend..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from apps/frontend directory"
    exit 1
fi

# Clean up any permission issues from Docker
if [ -d ".next" ] && [ ! -w ".next" ]; then
    echo "🔧 Fixing permissions on .next directory..."
    docker run --rm -v "$(pwd)/.next:/data" alpine sh -c "chmod -R 777 /data" 2>/dev/null || true
    rm -rf .next
    echo "✅ Permissions fixed"
fi

if [ -d ".next-dev" ] && [ ! -w ".next-dev" ]; then
    echo "🔧 Fixing permissions on .next-dev directory..."
    docker run --rm -v "$(pwd)/.next-dev:/data" alpine sh -c "chmod -R 777 /data" 2>/dev/null || true
    rm -rf .next-dev
    echo "✅ Permissions fixed"
fi

# Check if backend is running
echo "🔍 Checking backend status..."
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "⚠️  Warning: Backend doesn't seem to be running at localhost:8001"
    echo "   Start it with: cd ../../ops/compose && docker-compose up -d"
    echo ""
fi

# Kill any existing dev servers on port 3000
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "🛑 Stopping existing process on port 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

echo ""
echo "✨ Starting Next.js dev server..."
echo "   Local: http://localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""

npm run dev
