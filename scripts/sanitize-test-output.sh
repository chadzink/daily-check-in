#!/usr/bin/env bash
# Sanitizes test log output by stripping absolute host paths, personal usernames, and machine-specific directories.
# Usage:
#   ./scripts/sanitize-test-output.sh <logfile1> [logfile2...]
#   OR piped: command | ./scripts/sanitize-test-output.sh > test-results/output.log

set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(dirname "$WORKSPACE_DIR")"
USER_HOME="${HOME:-}"
CURRENT_USER="${USER:-$(whoami 2>/dev/null || echo '')}"

sanitize_stream() {
  local filter="cat"
  
  # Strip workspace directory
  if [ -n "$WORKSPACE_DIR" ]; then
    filter="sed -e 's|${WORKSPACE_DIR}/||g' -e 's|${WORKSPACE_DIR}||g'"
  fi

  # Apply sed pipeline
  eval "$filter" | sed \
    -e "s|${PARENT_DIR}/||g" \
    -e "s|${USER_HOME}|~|g" \
    -e "s|/Users/[a-zA-Z0-9._-]*/|/~/|g" \
    -e "s|/home/[a-zA-Z0-9._-]*/|/~/|g" \
    ${CURRENT_USER:+-e "s|${CURRENT_USER}|user|g"}
}

if [ "$#" -gt 0 ]; then
  for target_file in "$@"; do
    if [ -f "$target_file" ]; then
      tmp_file="$(mktemp)"
      sanitize_stream < "$target_file" > "$tmp_file"
      mv "$tmp_file" "$target_file"
    fi
  done
else
  sanitize_stream
fi
