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

repo_root="$(git rev-parse --show-toplevel)"
policy_file="$repo_root/validation/commit_message_policy.sh"
if [[ ! -f "$policy_file" ]]; then
  echo "commit message policy file not found: $policy_file" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$policy_file"

violations=0

while IFS= read -r commit_sha; do
  [[ -z "$commit_sha" ]] && continue

  commit_message="$(git log -1 --format=%B "$commit_sha")"
  commit_has_violations=0
  line_number=0

  while IFS= read -r message_line || [[ -n "$message_line" ]]; do
    line_number=$((line_number + 1))
    if is_forbidden_attribution_line "$message_line"; then
      if [[ $commit_has_violations -eq 0 ]]; then
        if [[ $violations -eq 0 ]]; then
          echo "Forbidden attribution lines detected in commit messages:"
        fi
        violations=1
        commit_has_violations=1
        echo
        echo "Commit: $commit_sha"
      fi
      printf '%s:%s\n' "$line_number" "$message_line"
    fi
  done <<< "$commit_message"
done < <(git rev-list --reverse "${base_sha}..${head_sha}")

if [[ $violations -ne 0 ]]; then
  echo
  echo "Remove AI attribution trailers from commit messages and retry."
  exit 1
fi

echo "Commit message validation passed."
