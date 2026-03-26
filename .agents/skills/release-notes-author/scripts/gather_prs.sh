#!/usr/bin/env bash

set -euo pipefail

usage() {
  printf 'usage: .agents/skills/release-notes-author/scripts/gather_prs.sh <start-tag> <end-ref>\n' >&2
  printf '  <start-tag>  must be an existing git tag (exclusive lower bound)\n' >&2
  printf '  <end-ref>    a git tag, branch name, or commit SHA (inclusive upper bound)\n' >&2
}

die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$repo_root" ]] || die "not inside a git repository"
cd "$repo_root"

if [[ $# -ne 2 ]]; then
  usage
  exit 1
fi

START_TAG="$1"
END_REF="$2"

require_cmd git
require_cmd gh

git rev-parse -q --verify "refs/tags/$START_TAG" >/dev/null || die "tag '$START_TAG' not found"
START_COMMIT="$(git rev-parse -q --verify "refs/tags/$START_TAG^{commit}")"
git rev-parse -q --verify "${END_REF}^{commit}" >/dev/null || die "ref '$END_REF' not found or resolves to no commits"
END_COMMIT="$(git rev-parse -q --verify "${END_REF}^{commit}")"

repo_slug="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"

TMP_PR_MAP="$(mktemp "${TMPDIR:-/tmp}/release-notes-pr-map.XXXXXX")"
cleanup_pr_map() {
  rm -f "$TMP_PR_MAP"
}
trap cleanup_pr_map EXIT

gh pr list --repo "$repo_slug" --state merged --limit 1000 --json mergeCommit,number --jq '.[] | select(.mergeCommit.oid != null) | [.mergeCommit.oid, (.number|tostring)] | @tsv' >"$TMP_PR_MAP"

pr_numbers=()
seen_prs="|"

while IFS= read -r commit_sha; do
  [[ -n "$commit_sha" ]] || continue
  pr_number="$(awk -F '\t' -v sha="$commit_sha" '$1 == sha { print $2; exit }' "$TMP_PR_MAP")"
  if [[ -n "$pr_number" && "$seen_prs" != *"|$pr_number|"* ]]; then
    seen_prs="${seen_prs}${pr_number}|"
    pr_numbers+=("$pr_number")
  fi
done < <(git rev-list --first-parent --reverse "$START_COMMIT..$END_COMMIT")

printf 'Pull requests:\n'
if [[ "${#pr_numbers[@]}" -eq 0 ]]; then
  printf 'None found\n'
  exit 0
fi

for pr_number in "${pr_numbers[@]}"; do
  pr_line="$(gh pr view "$pr_number" --repo "$repo_slug" --json title,url --jq '[.title, .url] | @tsv')"
  pr_title="${pr_line%%$'\t'*}"
  pr_url="${pr_line#*$'\t'}"
  printf -- '- [%s](%s)\n' "$pr_title" "$pr_url"
done
