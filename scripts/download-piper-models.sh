#!/usr/bin/env bash
set -euo pipefail

# Script to download Piper TTS voice models for Italian
# Usage: ./download-piper-models.sh [voice_name]
# Default voice: it-riccardo_fasol-x-low

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Use temporary directory for now
MODELS_DIR="/tmp/piper-models"

# Default voice model
VOICE_NAME="${1:-it_IT-riccardo-x_low}"

# Piper voices URL from Hugging Face
BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main"

echo -e "${GREEN}=== Piper TTS Model Downloader ===${NC}"
echo ""
echo "Voice: $VOICE_NAME"
echo "Target directory: $MODELS_DIR"
echo ""

# Create models directory
mkdir -p "$MODELS_DIR"

# Check if model already exists
if [ -f "$MODELS_DIR/${VOICE_NAME}.onnx" ] && [ -f "$MODELS_DIR/${VOICE_NAME}.onnx.json" ]; then
    echo -e "${YELLOW}Model already exists!${NC}"
    echo "Files found:"
    ls -lh "$MODELS_DIR/${VOICE_NAME}."*
    echo ""
    read -p "Do you want to re-download? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
fi

# Available Italian voices
case "$VOICE_NAME" in
    "it_IT-riccardo-x_low")
        ONNX_FILE="it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx"
        JSON_FILE="it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx.json"
        ;;
    "it_IT-paola-medium")
        ONNX_FILE="it/it_IT/paola/medium/it_IT-paola-medium.onnx"
        JSON_FILE="it/it_IT/paola/medium/it_IT-paola-medium.onnx.json"
        ;;
    *)
        echo -e "${RED}Unknown voice: $VOICE_NAME${NC}"
        echo ""
        echo "Available Italian voices:"
        echo "  - it_IT-riccardo-x_low (faster, lower quality)"
        echo "  - it_IT-paola-medium (better quality)"
        echo ""
        echo "Usage: $0 [voice_name]"
        exit 1
        ;;
esac

# Download URLs
ONNX_URL="$BASE_URL/$ONNX_FILE"
JSON_URL="$BASE_URL/$JSON_FILE"

echo -e "${GREEN}Downloading model...${NC}"
echo "ONNX URL: $ONNX_URL"
echo "JSON URL: $JSON_URL"
echo ""

# Download with progress
cd "$MODELS_DIR"
if command -v wget &> /dev/null; then
    wget --progress=bar:force "$ONNX_URL" -O "${VOICE_NAME}.onnx"
    wget --progress=bar:force "$JSON_URL" -O "${VOICE_NAME}.onnx.json"
elif command -v curl &> /dev/null; then
    curl -L --progress-bar "$ONNX_URL" -o "${VOICE_NAME}.onnx"
    curl -L --progress-bar "$JSON_URL" -o "${VOICE_NAME}.onnx.json"
else
    echo -e "${RED}Error: Neither wget nor curl is installed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Model installed successfully!${NC}"
echo ""
echo "Files:"
ls -lh "${VOICE_NAME}."*
echo ""
echo "Model location: $MODELS_DIR"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Ensure .env contains:"
echo "   TTS_VOICE=$VOICE_NAME"
echo "   TTS_MODEL_DIR=/app/models/tts"
echo "   TTS_PROVIDER=piper"
echo ""
echo "2. Restart Docker services:"
echo "   cd ops/compose"
echo "   docker-compose down"
echo "   docker-compose up -d"
echo ""
echo -e "${GREEN}Done!${NC}"
