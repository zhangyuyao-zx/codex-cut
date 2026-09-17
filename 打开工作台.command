#!/bin/zsh
set -euo pipefail
SCRIPT_DIR="${0:A:h}"
exec "$SCRIPT_DIR/workbench-local/打开工作台.command" "$@"
