#!/bin/bash

# Bootstrap everything needed to run the consolidated test suites.
# - Provisions a local Python 3.11 virtual environment (via uv)
# - Installs backend/runtime + test dependencies
# - Installs frontend dependencies and Playwright browsers

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_VERSION="${PYTHON_VERSION:-3.11}"
VENV_DIR="${ROOT_DIR}/.venv"
FRONTEND_DIR="${ROOT_DIR}/apps/frontend"

echo "➡️  Ensuring Python ${PYTHON_VERSION} runtime is available..."
uv python install "${PYTHON_VERSION}" >/dev/null

if [ ! -d "${VENV_DIR}" ]; then
  echo "➡️  Creating virtual environment in ${VENV_DIR}"
  uv venv --python "${PYTHON_VERSION}" "${VENV_DIR}"
fi

source "${VENV_DIR}/bin/activate"

echo "➡️  Installing backend dependencies from requirements/dev.txt"
uv pip install --requirement "${ROOT_DIR}/requirements/dev.txt"

mkdir -p "${VENV_DIR}/.bootstrap"
touch "${VENV_DIR}/.bootstrap/pytest-ready"

echo "➡️  Installing frontend dependencies"
pushd "${FRONTEND_DIR}" >/dev/null
npm install

if [ "${INSTALL_PLAYWRIGHT_BROWSERS:-1}" = "1" ]; then
  echo "➡️  Ensuring Playwright browsers are installed"
  if ! npx playwright install; then
    echo "⚠️  Playwright browser installation failed. Install system deps manually if required."
  fi
fi
popd >/dev/null

echo "✅ Test tooling setup complete."
