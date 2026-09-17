#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h}"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  for CANDIDATE in /usr/local/bin/node /opt/homebrew/bin/node; do
    if [[ -x "$CANDIDATE" ]]; then
      NODE_BIN="$CANDIDATE"
      break
    fi
  done
  if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
    print -u2 "找不到 Node.js。请把 node 加入 PATH，或安装到 /usr/local/bin/node 或 /opt/homebrew/bin/node。"
    exit 1
  fi
fi

exec "$NODE_BIN" "$SCRIPT_DIR/launcher.mjs" stop "$@"
