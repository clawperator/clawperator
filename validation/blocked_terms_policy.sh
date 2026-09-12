#!/usr/bin/env bash

# Shared blocked-terms helpers used by the local Git hooks.

blocked_terms_policy_prepare() {
  if [[ -n "${CLAWPERATOR_BLOCKED_TERMS_FILE:-}" ]]; then
    BLOCKED_TERMS_POLICY_FILE="$CLAWPERATOR_BLOCKED_TERMS_FILE"
  elif [[ -n "${HOME:-}" ]]; then
    BLOCKED_TERMS_POLICY_FILE="${HOME}/.clawperator/blocked-terms.txt"
  else
    BLOCKED_TERMS_POLICY_FILE=""
  fi

  if [[ -z "$BLOCKED_TERMS_POLICY_FILE" || ! -e "$BLOCKED_TERMS_POLICY_FILE" ]]; then
    return 10
  fi

  if [[ ! -f "$BLOCKED_TERMS_POLICY_FILE" || ! -r "$BLOCKED_TERMS_POLICY_FILE" ]]; then
    echo "[blocked-terms] terms file is not a readable regular file: $BLOCKED_TERMS_POLICY_FILE" >&2
    return 1
  fi

  return 0
}

blocked_terms_policy_list_terms() {
  awk '
    {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      if (line != "" && line !~ /^#/) {
        print line
      }
    }
  ' "$BLOCKED_TERMS_POLICY_FILE"
}

blocked_terms_policy_escape_ere() {
  printf '%s' "$1" | sed -e 's/[].[^$*+?(){}|\\]/\\&/g'
}

blocked_terms_policy_file_matches_term() {
  local term="$1"
  local file_path="$2"
  local status=0

  if [[ "$term" =~ ^[[:alpha:]][[:alnum:]_-]*$ ]]; then
    local escaped_term
    escaped_term="$(blocked_terms_policy_escape_ere "$term")"
    if LC_ALL=C grep -E -i -q "(^|[^[:alnum:]_])${escaped_term}([^[:alnum:]_]|$)" "$file_path"; then
      status=0
    else
      status=$?
    fi
  elif LC_ALL=C grep -F -i -q -- "$term" "$file_path"; then
    status=0
  else
    status=$?
  fi

  if [[ $status -eq 0 ]]; then
    return 0
  fi

  if [[ $status -gt 1 ]]; then
    echo "[blocked-terms] unable to scan $file_path" >&2
    return "$status"
  fi

  return 1
}

blocked_terms_policy_scan_file() {
  local display_path="$1"
  local file_path="$2"
  local term
  local match_status=0
  local violations=0

  while IFS= read -r term; do
    if blocked_terms_policy_file_matches_term "$term" "$file_path"; then
      echo "[blocked-terms] blocked term '$term' found in $display_path" >&2
      violations=1
    else
      match_status=$?
      if [[ $match_status -ne 1 ]]; then
        violations=1
      fi
    fi
  done < <(blocked_terms_policy_list_terms)

  if [[ $violations -ne 0 ]]; then
    return 1
  fi

  return 0
}

blocked_terms_policy_scan_commit_message() {
  local message_file="$1"
  local preparation_status=0

  if blocked_terms_policy_prepare; then
    blocked_terms_policy_scan_file "the commit message" "$message_file"
    return $?
  fi

  preparation_status=$?
  if [[ $preparation_status -eq 10 ]]; then
    return 0
  fi

  return "$preparation_status"
}

blocked_terms_policy_scan_staged_content() {
  local staged_file
  local path
  local preparation_status=0
  local violations=0

  if blocked_terms_policy_prepare; then
    :
  else
    preparation_status=$?
    if [[ $preparation_status -eq 10 ]]; then
      return 0
    fi
    return "$preparation_status"
  fi

  staged_file="$(mktemp "${TMPDIR:-/tmp}/clawperator-blocked-terms.XXXXXX")" || {
    echo "[blocked-terms] unable to create a temporary staged-content file" >&2
    return 1
  }

  while IFS= read -r -d '' path; do
    if ! git show ":$path" > "$staged_file"; then
      echo "[blocked-terms] unable to read staged content for $path" >&2
      violations=1
      continue
    fi

    if ! blocked_terms_policy_scan_file "$path" "$staged_file"; then
      violations=1
    fi
  done < <(git diff --cached --name-only --diff-filter=ACMR -z)

  rm -f "$staged_file"

  if [[ $violations -ne 0 ]]; then
    echo "[blocked-terms] commit blocked. Remove the term or update the local terms file." >&2
    return 1
  fi

  return 0
}
