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

  author_name="$(git log -1 --format=%an "$commit_sha")"
  author_email="$(git log -1 --format=%ae "$commit_sha")"
  committer_name="$(git log -1 --format=%cn "$commit_sha")"
  committer_email="$(git log -1 --format=%ce "$commit_sha")"

  if is_forbidden_identity "$author_name" "$author_email"; then
    if [[ $violations -eq 0 ]]; then
      echo "Forbidden attribution markers detected in PR commit range:"
    fi
    violations=1
    echo
    echo "Commit: $commit_sha"
    echo "Author identity triggers policy: $author_name <$author_email>"
  fi

  if is_forbidden_identity "$committer_name" "$committer_email"; then
    if [[ $violations -eq 0 ]]; then
      echo "Forbidden attribution markers detected in PR commit range:"
    fi
    violations=1
    echo
    echo "Commit: $commit_sha"
    echo "Committer identity triggers policy: $committer_name <$committer_email>"
  fi

  commit_message="$(git log -1 --format=%B "$commit_sha")"
  commit_has_violations=0
  line_number=0

  while IFS= read -r message_line || [[ -n "$message_line" ]]; do
    line_number=$((line_number + 1))
    if is_forbidden_attribution_line "$message_line"; then
      if [[ $commit_has_violations -eq 0 ]]; then
        if [[ $violations -eq 0 ]]; then
          echo "Forbidden attribution markers detected in PR commit range:"
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
  echo "Remove AI attribution markers from commit messages and commit identities, then retry."
  exit 1
fi

echo "Commit message validation passed."
