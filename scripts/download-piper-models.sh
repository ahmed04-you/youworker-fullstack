#!/usr/bin/env bash
set -euo pipefail

# Script to download Piper TTS voice models for Italian
# Usage: ./download-piper-models.sh [voice_name]
# Default voice: it_IT-paola-medium

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODELS_DIR="$PROJECT_ROOT/data/models/tts"

# Default voice model
VOICE_NAME="${1:-it_IT-paola-medium}"

# Piper releases URL
PIPER_VERSION="v1.2.0"
BASE_URL="https://github.com/rhasspy/piper/releases/download/$PIPER_VERSION"

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
    "it_IT-paola-medium")
        ARCHIVE="voice-it-IT-paola-medium.tar.gz"
        ;;
    "it_IT-riccardo-x_low")
        ARCHIVE="voice-it-IT-riccardo-x_low.tar.gz"
        ;;
    *)
        echo -e "${RED}Unknown voice: $VOICE_NAME${NC}"
        echo ""
        echo "Available Italian voices:"
        echo "  - it_IT-paola-medium (recommended, balanced quality)"
        echo "  - it_IT-riccardo-x_low (faster, lower quality)"
        echo ""
        echo "Usage: $0 [voice_name]"
        exit 1
        ;;
esac

# Download URL
DOWNLOAD_URL="$BASE_URL/$ARCHIVE"

echo -e "${GREEN}Downloading model...${NC}"
echo "URL: $DOWNLOAD_URL"
echo ""

# Download with progress
cd "$MODELS_DIR"
if command -v wget &> /dev/null; then
    wget --progress=bar:force "$DOWNLOAD_URL" -O "$ARCHIVE"
elif command -v curl &> /dev/null; then
    curl -L --progress-bar "$DOWNLOAD_URL" -o "$ARCHIVE"
else
    echo -e "${RED}Error: Neither wget nor curl is installed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Extracting model...${NC}"
tar -xzf "$ARCHIVE"

# Find extracted files
ONNX_FILE=$(find . -name "*.onnx" -type f | head -n1)
JSON_FILE=$(find . -name "*.onnx.json" -type f | head -n1)

if [ -z "$ONNX_FILE" ] || [ -z "$JSON_FILE" ]; then
    echo -e "${RED}Error: Expected model files not found after extraction!${NC}"
    exit 1
fi

# Rename to standard format
mv "$ONNX_FILE" "${VOICE_NAME}.onnx"
mv "$JSON_FILE" "${VOICE_NAME}.onnx.json"

# Clean up
rm -f "$ARCHIVE"
rm -rf $(find . -type d -name "it_IT-*" 2>/dev/null || true)

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
