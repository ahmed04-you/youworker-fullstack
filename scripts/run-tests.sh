#!/bin/bash

# Run consolidated backend + frontend test suites.
# Automatically bootstraps dependencies on first run (via setup-tests.sh).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
PYTEST_ARGS=("$@")

if [ ! -d "${VENV_DIR}" ] || [ ! -f "${VENV_DIR}/bin/activate" ]; then
  echo "ℹ️  Test environment not initialised yet – running setup..."
  "${ROOT_DIR}/scripts/setup-tests.sh"
fi

source "${VENV_DIR}/bin/activate"
export PYTHONPATH="${ROOT_DIR}"

echo "🧪 Running Python test suite (pytest)"
pytest tests/ -v --cov=packages --cov=apps "${PYTEST_ARGS[@]}"

echo "🧪 Running frontend unit tests (Vitest)"
pushd "${ROOT_DIR}/apps/frontend" >/dev/null
npm run test -- --run

if [ "${RUN_WEB_E2E:-0}" = "1" ]; then
  echo "🧪 Running frontend Playwright E2E tests"
  npx playwright test
else
  echo "ℹ️  Skipping Playwright E2E tests (set RUN_WEB_E2E=1 to enable)"
fi
popd >/dev/null

echo "✅ All requested tests completed."
