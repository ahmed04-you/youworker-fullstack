#!/bin/bash

# Bootstrap everything needed to run the consolidated test suites.
# - Provisions a local Python runtime (via uv)
# - Installs backend/runtime + test dependencies
# - Installs frontend dependencies and optional Playwright tooling

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_VERSION="${PYTHON_VERSION:-3.11}"
VENV_DIR="${ROOT_DIR}/.venv"
FRONTEND_DIR="${ROOT_DIR}/apps/frontend"
BOOTSTRAP_DIR="${ROOT_DIR}/.cache/test-bootstrap"
PYTHON_SENTINEL="${BOOTSTRAP_DIR}/python-ready"
FRONTEND_SENTINEL="${BOOTSTRAP_DIR}/frontend-ready"
PLAYWRIGHT_SENTINEL="${BOOTSTRAP_DIR}/playwright-ready"

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
require_command "npm" "Install Node.js (18+) which provides npm." >/dev/null

# Reset sentinels so partial runs do not look successful.
rm -f "${PYTHON_SENTINEL}" "${FRONTEND_SENTINEL}" "${PLAYWRIGHT_SENTINEL}"

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

echo "➡️  Installing frontend dependencies"
pushd "${FRONTEND_DIR}" >/dev/null
if [ -f "package-lock.json" ]; then
  npm ci
else
  npm install
fi
printf "ok\n" >"${FRONTEND_SENTINEL}"

if [ "${INSTALL_PLAYWRIGHT_BROWSERS:-1}" = "1" ]; then
  echo "➡️  Ensuring Playwright browsers are installed"
  if npx playwright install --with-deps; then
    printf "ok\n" >"${PLAYWRIGHT_SENTINEL}"
  else
    echo "⚠️  Playwright --with-deps failed (missing privileges or unsupported distro). Falling back to browser-only install."
    if npx playwright install; then
      printf "deps-missing\n" >"${PLAYWRIGHT_SENTINEL}"
      echo "⚠️  Playwright browsers installed, but system dependencies may still be missing."
    else
      printf "failed\n" >"${PLAYWRIGHT_SENTINEL}"
      echo "❌  Playwright browser installation failed."
      exit 1
    fi
  fi
else
  printf "skipped\n" >"${PLAYWRIGHT_SENTINEL}"
  echo "ℹ️  Skipping Playwright browser installation (INSTALL_PLAYWRIGHT_BROWSERS=0)"
fi
popd >/dev/null

echo "✅ Test tooling setup complete."
