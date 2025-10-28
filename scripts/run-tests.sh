#!/bin/bash

# Run consolidated backend + frontend test suites.
# Automatically bootstraps dependencies on first run (via setup-tests.sh).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
BOOTSTRAP_DIR="${ROOT_DIR}/.cache/test-bootstrap"
PYTHON_SENTINEL="${BOOTSTRAP_DIR}/python-ready"
FRONTEND_SENTINEL="${BOOTSTRAP_DIR}/frontend-ready"
PLAYWRIGHT_SENTINEL="${BOOTSTRAP_DIR}/playwright-ready"
PYTEST_ARGS=("$@")

needs_bootstrap="false"

if [ ! -d "${VENV_DIR}" ] || [ ! -f "${VENV_DIR}/bin/activate" ] || [ ! -f "${PYTHON_SENTINEL}" ]; then
  needs_bootstrap="true"
fi

if [ ! -d "${ROOT_DIR}/apps/frontend/node_modules" ] || [ ! -f "${FRONTEND_SENTINEL}" ]; then
  needs_bootstrap="true"
fi

if [ "${RUN_WEB_E2E:-0}" = "1" ]; then
  if [ ! -f "${PLAYWRIGHT_SENTINEL}" ]; then
    needs_bootstrap="true"
  else
    playwright_status="$(cat "${PLAYWRIGHT_SENTINEL}" 2>/dev/null || echo "")"
    if [ "${playwright_status}" != "ok" ]; then
      needs_bootstrap="true"
    fi
  fi
fi

if [ "${needs_bootstrap}" = "true" ]; then
  echo "ℹ️  Test environment not initialised yet – running setup..."
  "${ROOT_DIR}/scripts/setup-tests.sh"
fi

if [ "${RUN_WEB_E2E:-0}" = "1" ]; then
  playwright_status="$(cat "${PLAYWRIGHT_SENTINEL}" 2>/dev/null || echo "")"
  if [ "${playwright_status}" != "ok" ]; then
    echo "❌ Playwright browsers are not ready (status: ${playwright_status:-unknown})."
    echo "   Re-run INSTALL_PLAYWRIGHT_BROWSERS=1 ./scripts/setup-tests.sh after installing system dependencies."
    exit 1
  fi
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
