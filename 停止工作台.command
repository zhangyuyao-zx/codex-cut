#!/bin/zsh
set -euo pipefail
SCRIPT_DIR="${0:A:h}"
exec "$SCRIPT_DIR/workbench-local/停止工作台.command" "$@"
