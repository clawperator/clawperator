#!/usr/bin/env bash

# Shared commit-message policy helpers used by:
# - .githooks/commit-msg (local convenience sanitization)
# - scripts/validate_commit_messages.sh (repo-wide PR guard)

is_forbidden_attribution_line() {
  local line="${1-}"
  local had_nocasematch=0
  local matched=1

  if shopt -q nocasematch; then
    had_nocasematch=1
  fi
  shopt -s nocasematch

  if [[ "$line" =~ ^[[:space:]]*Co-Authored-By:[[:space:]]*Claude[[:space:]].*$ ]]; then
    matched=0
  elif [[ "$line" =~ ^[[:space:]]*Co-Authored-By:[[:space:]]*Cursor([[:space:]].*)?$ ]]; then
    matched=0
  elif [[ "$line" =~ ^[[:space:]]*Made[[:space:]]+With:?[[:space:]]*Cursor([[:space:]].*)?$ ]]; then
    matched=0
  elif [[ "$line" =~ ^[[:space:]]*Generated[[:space:]]+With:?[[:space:]]*Cursor([[:space:]].*)?$ ]]; then
    matched=0
  fi

  if [[ $had_nocasematch -eq 0 ]]; then
    shopt -u nocasematch
  fi

  return "$matched"
}
