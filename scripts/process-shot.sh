#!/usr/bin/env bash
# Wrapper around process-shot.py using the project venv.
# Usage: scripts/process-shot.sh <input> <output> [extra args]
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/.venv/bin/python" "$DIR/process-shot.py" "$@"
