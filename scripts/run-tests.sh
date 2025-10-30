#!/bin/bash

# Run backend test suite.
# Automatically bootstraps dependencies on first run (via setup-tests.sh).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
BOOTSTRAP_DIR="${ROOT_DIR}/.cache/test-bootstrap"
PYTHON_SENTINEL="${BOOTSTRAP_DIR}/python-ready"
PYTEST_ARGS=("$@")

needs_bootstrap="false"

if [ ! -d "${VENV_DIR}" ] || [ ! -f "${VENV_DIR}/bin/activate" ] || [ ! -f "${PYTHON_SENTINEL}" ]; then
  needs_bootstrap="true"
fi

if [ "${needs_bootstrap}" = "true" ]; then
  echo "ℹ️  Test environment not initialised yet – running setup..."
  "${ROOT_DIR}/scripts/setup-tests.sh"
fi

source "${VENV_DIR}/bin/activate"
export PYTHONPATH="${ROOT_DIR}"

echo "🧪 Running Python test suite (pytest)"
pytest tests/ -v --cov=packages --cov=apps "${PYTEST_ARGS[@]}"

echo "✅ All requested tests completed."
