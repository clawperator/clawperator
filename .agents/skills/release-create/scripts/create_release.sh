#!/usr/bin/env bash

set -euo pipefail

die() {
  printf 'release-create: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

json_version_field() {
  node -e 'const data = JSON.parse(process.argv[1]); const value = data.version; if (typeof value !== "string" || value.length === 0) process.exit(2); console.log(value);' "$1"
}

json_field() {
  local json="$1"
  local field="$2"
  node -e 'const data = JSON.parse(process.argv[1]); const field = process.argv[2]; const value = data[field]; if (value === undefined || value === null) process.exit(2); if (typeof value === "object") { console.log(JSON.stringify(value)); } else { console.log(String(value)); }' "$json" "$field"
}

await_workflow() {
  local workflow_name="$1"
  local tag_name="$2"
  local target_sha="$3"
  local repo="$4"
  local attempts=18
  local sleep_seconds=10
  local run_json=""
  local status=""

  for ((i = 1; i <= attempts; i++)); do
    run_json="$(gh run list \
      --repo "$repo" \
      --workflow "$workflow_name" \
      --branch "$tag_name" \
      --commit "$target_sha" \
      --event push \
      --limit 1 \
      --json databaseId,workflowName,headBranch,headSha,status,conclusion,url 2>/dev/null || true)"

    if [[ "$run_json" != "[]" && -n "$run_json" ]]; then
      break
    fi

    sleep "$sleep_seconds"
  done

  if [[ "$run_json" == "[]" || -z "$run_json" ]]; then
    die "workflow $workflow_name for tag $tag_name in repo $repo not found after polling"
  fi

  local item_json
  item_json="$(node -e 'const items = JSON.parse(process.argv[1]); if (!Array.isArray(items) || items.length === 0) process.exit(2); console.log(JSON.stringify(items[0]));' "$run_json")"

  status="$(json_field "$item_json" "status" || true)"

  while [[ "$status" != "completed" ]]; do
    sleep "$sleep_seconds"
    item_json="$(gh run list \
      --repo "$repo" \
      --workflow "$workflow_name" \
      --branch "$tag_name" \
      --commit "$target_sha" \
      --event push \
      --limit 1 \
      --json databaseId,workflowName,headBranch,headSha,status,conclusion,url \
      --jq '.[0]')"
    [[ -n "$item_json" && "$item_json" != "null" ]] || die "workflow lookup for $workflow_name became unavailable"
    status="$(json_field "$item_json" "status" || true)"
  done

  printf 'workflow=%s status=%s conclusion=%s url=%s\n' \
    "$workflow_name" \
    "$(json_field "$item_json" "status")" \
    "$(json_field "$item_json" "conclusion")" \
    "$(json_field "$item_json" "url")"
}

main() {
  require_cmd git
  require_cmd npm
  require_cmd node
  require_cmd gh

  [[ $# -ge 1 && $# -le 2 ]] || die "usage: .agents/skills/release-create/scripts/create_release.sh <version> [sha]"

  local version="$1"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]] || die "version must look like semver"
  local target_ref="${2:-HEAD}"
  local repo_root
  repo_root="$(git rev-parse --show-toplevel)"
  cd "$repo_root"

  local tag_name="v${version}"
  local repo_slug
  repo_slug="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
  local target_sha
  target_sha="$(git rev-parse --verify "${target_ref}^{commit}")"

  local git_status
  git_status="$(git status --porcelain)"
  [[ -z "$git_status" ]] || die "working tree has uncommitted or untracked changes"

  local package_version
  package_version="$(json_version_field "$(git show "${target_sha}:apps/node/package.json")")"
  [[ "$package_version" == "$version" ]] || die "apps/node/package.json is $package_version, expected $version"

  local lock_version
  lock_version="$(json_version_field "$(git show "${target_sha}:apps/node/package-lock.json")")"
  [[ "$lock_version" == "$version" ]] || die "apps/node/package-lock.json is $lock_version, expected $version"

  if npm view clawperator@"$version" version >/dev/null 2>&1; then
    die "npm already has clawperator@$version"
  fi

  if gh release view "$tag_name" --repo "$repo_slug" >/dev/null 2>&1; then
    die "GitHub Release $tag_name already exists"
  fi

  if git rev-parse -q --verify "refs/tags/$tag_name" >/dev/null; then
    die "local tag $tag_name already exists"
  fi

  if git ls-remote --exit-code --tags origin "refs/tags/$tag_name" >/dev/null 2>&1; then
    die "remote tag $tag_name already exists on origin"
  fi

  printf 'release_version=%s\n' "$version"
  printf 'tag=%s\n' "$tag_name"
  printf 'target_sha=%s\n' "$target_sha"
  printf 'repo=%s\n' "$repo_slug"

  npm --prefix apps/node ci
  npm --prefix apps/node run build
  npm --prefix apps/node run test

  git tag -a "$tag_name" "$target_sha" -m "Release $tag_name"
  git push origin "refs/tags/$tag_name"

  printf 'tag_push=ok\n'

  await_workflow "Publish npm Package" "$tag_name" "$target_sha" "$repo_slug"
  await_workflow "Release APK" "$tag_name" "$target_sha" "$repo_slug"
}

main "$@"
