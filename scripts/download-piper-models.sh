#!/usr/bin/env bash
set -euo pipefail

# Downloader for Piper Italian voices (defaults to it_IT-paola-medium).
# Usage:
#   ./download-piper-models.sh                # download default voice to /tmp/piper-models
#   ./download-piper-models.sh <voice> <dir>  # specify voice and target directory

VOICE_NAME="${1:-it_IT-paola-medium}"
TARGET_DIR="${2:-/tmp/piper-models}"

BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main"

# Registry of available Italian voices
declare -A VOICE_MAP=(
  ["it_IT-paola-medium"]="it/it_IT/paola/medium/it_IT-paola-medium.onnx|it/it_IT/paola/medium/it_IT-paola-medium.onnx.json"
  ["it_IT-riccardo-x_low"]="it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx|it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx.json"
)

if [[ -z "${VOICE_MAP[$VOICE_NAME]:-}" ]]; then
  echo "Voice '$VOICE_NAME' is not in the supported Italian set."
  echo "Available voices:"
  for key in "${!VOICE_MAP[@]}"; do
    printf "  - %s\n" "$key"
  done
  exit 1
fi

IFS="|" read -r ONNX_PATH CONFIG_PATH <<<"${VOICE_MAP[$VOICE_NAME]}"

mkdir -p "$TARGET_DIR"

download() {
  local url="$1"
  local dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -L --progress-bar "$url" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget --progress=bar:force "$url" -O "$dest"
  else
    echo "Neither curl nor wget found. Please install one of them."
    exit 1
  fi
}

echo "Downloading Piper voice '$VOICE_NAME' into $TARGET_DIR ..."
download "${BASE_URL}/${ONNX_PATH}" "${TARGET_DIR}/${VOICE_NAME}.onnx"
download "${BASE_URL}/${CONFIG_PATH}" "${TARGET_DIR}/${VOICE_NAME}.onnx.json"

echo "Done."
ls -lh "${TARGET_DIR}/${VOICE_NAME}."*
