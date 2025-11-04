#!/usr/bin/env bash
set -euo pipefail

# Script to download Kokoro TTS assets (ONNX model + voice embeddings).
# Usage: ./download-kokoro-assets.sh [release_version] [target_dir]
# Defaults to release v1.0.0 and target directory /tmp/kokoro-assets.

RELEASE_VERSION="${1:-${KOKORO_RELEASE_VERSION:-v1.0.0}}"
TARGET_DIR="${2:-/tmp/kokoro-assets}"
MODEL_FILENAME="${KOKORO_MODEL_FILENAME:-kokoro-v1.0.onnx}"
VOICES_FILENAME="${KOKORO_VOICES_FILENAME:-voices-v1.0.bin}"
BASE_URL="${KOKORO_ASSETS_BASE_URL:-https://github.com/nazdridoy/kokoro-tts/releases/download/${RELEASE_VERSION}}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Kokoro TTS Asset Downloader ===${NC}"
echo "Release: ${RELEASE_VERSION}"
echo "Base URL: ${BASE_URL}"
echo "Target directory: ${TARGET_DIR}"
echo ""

mkdir -p "${TARGET_DIR}"

download_file() {
    local filename="$1"
    local url="$2"
    local output_path="${TARGET_DIR}/${filename}"

    if [[ -f "${output_path}" ]]; then
        echo -e "${YELLOW}File already exists:${NC} ${output_path}"
        read -p "Re-download ${filename}? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping ${filename}"
            return
        fi
    fi

    echo -e "${GREEN}Downloading ${filename}${NC}"
    echo "URL: ${url}"
    if command -v wget >/dev/null 2>&1; then
        wget --progress=bar:force "${url}" -O "${output_path}"
    elif command -v curl >/dev/null 2>&1; then
        curl -L --progress-bar "${url}" -o "${output_path}"
    else
        echo -e "${RED}Error: neither wget nor curl found on PATH${NC}"
        exit 1
    fi
}

download_file "${MODEL_FILENAME}" "${BASE_URL}/${MODEL_FILENAME}"
download_file "${VOICES_FILENAME}" "${BASE_URL}/${VOICES_FILENAME}"

echo ""
echo -e "${GREEN}✓ Kokoro assets ready${NC}"
ls -lh "${TARGET_DIR}/${MODEL_FILENAME}" "${TARGET_DIR}/${VOICES_FILENAME}"
echo ""
echo "Next steps:"
echo "1. Move the files into your runtime models directory (e.g. /app/models/tts)."
echo "2. Set environment variables if needed:"
echo "   TTS_PROVIDER=kokoro"
echo "   TTS_MODEL_DIR=/app/models/tts"
echo "   TTS_VOICE=if_sara"
echo ""
echo "Optional overrides:"
echo "   export KOKORO_MODEL_FILENAME=${MODEL_FILENAME}"
echo "   export KOKORO_VOICES_FILENAME=${VOICES_FILENAME}"
echo "   export KOKORO_ASSETS_BASE_URL=${BASE_URL}"
echo ""
echo -e "${GREEN}Done!${NC}"
