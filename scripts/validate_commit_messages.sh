#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <base-sha> <head-sha>" >&2
  exit 1
fi

base_sha="$1"
head_sha="$2"

if [[ "$base_sha" == "$head_sha" ]]; then
  echo "No commits to validate."
  exit 0
fi

pattern='^(Co-Authored-By:[[:space:]]*Claude .*$|Made[[:space:]]+With:[[:space:]]*Cursor([[:space:]].*)?$|Made[[:space:]]+with[[:space:]]+Cursor([[:space:]].*)?$|Generated[[:space:]]+with[[:space:]]+Cursor([[:space:]].*)?$|Co-Authored-By:[[:space:]]*Cursor([[:space:]].*)?$)'

violations=0

while IFS= read -r commit_sha; do
  [[ -z "$commit_sha" ]] && continue

  commit_message="$(git log -1 --format=%B "$commit_sha")"
  scan_output_file="$(mktemp)"
  if printf '%s\n' "$commit_message" | rg -n "$pattern" >"$scan_output_file"; then
    if [[ $violations -eq 0 ]]; then
      echo "Forbidden attribution lines detected in commit messages:"
    fi
    violations=1
    echo
    echo "Commit: $commit_sha"
    while IFS= read -r matched_line; do
      printf '%s\n' "$matched_line"
    done < "$scan_output_file"
  fi
  rm -f "$scan_output_file"
done < <(git rev-list --reverse "${base_sha}..${head_sha}")

if [[ $violations -ne 0 ]]; then
  echo
  echo "Remove AI attribution trailers from commit messages and retry."
  exit 1
fi

echo "Commit message validation passed."
