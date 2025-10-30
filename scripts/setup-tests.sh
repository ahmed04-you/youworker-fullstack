#!/bin/bash

# Bootstrap everything needed to run the consolidated test suites.
# - Provisions a local Python runtime (via uv)
# - Installs backend/runtime + test dependencies

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_VERSION="${PYTHON_VERSION:-3.11}"
VENV_DIR="${ROOT_DIR}/.venv"
BOOTSTRAP_DIR="${ROOT_DIR}/.cache/test-bootstrap"
PYTHON_SENTINEL="${BOOTSTRAP_DIR}/python-ready"

mkdir -p "${BOOTSTRAP_DIR}"

require_command() {
  local cmd="$1"
  local install_hint="${2:-}"

  if command -v "${cmd}" >/dev/null 2>&1; then
    return 0
  fi

  if [ -n "${install_hint}" ]; then
    echo "❌ Missing required tool '${cmd}'. ${install_hint}"
  else
    echo "❌ Missing required tool '${cmd}'."
  fi
  return 1
}

ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    return 0
  fi

  echo "➡️  Installing uv CLI (not found in PATH)"
  if command -v curl >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- https://astral.sh/uv/install.sh | sh >/dev/null
  else
    echo "❌ Neither curl nor wget is available to install uv automatically."
    return 1
  fi

  export PATH="${HOME}/.local/bin:${PATH}"

  if ! command -v uv >/dev/null 2>&1; then
    echo "❌ Unable to locate uv after installation attempt. Add ${HOME}/.local/bin to PATH or install uv manually."
    return 1
  fi
}

ensure_uv

# Reset sentinels so partial runs do not look successful.
rm -f "${PYTHON_SENTINEL}"

echo "➡️  Ensuring Python ${PYTHON_VERSION} runtime is available..."
uv python install "${PYTHON_VERSION}" >/dev/null

if [ ! -d "${VENV_DIR}" ]; then
  echo "➡️  Creating virtual environment in ${VENV_DIR}"
  uv venv --python "${PYTHON_VERSION}" "${VENV_DIR}"
fi

source "${VENV_DIR}/bin/activate"

echo "➡️  Installing backend dependencies from requirements/dev.txt"
uv pip install --requirement "${ROOT_DIR}/requirements/dev.txt"
printf "ok\n" >"${PYTHON_SENTINEL}"

echo "✅ Test tooling setup complete."
