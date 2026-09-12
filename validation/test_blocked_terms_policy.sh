#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/clawperator-blocked-terms-test.XXXXXX")"
test_repo="$test_root/repo"
terms_file="$test_root/blocked-terms.txt"

cleanup() {
  rm -rf "$test_root"
}
trap cleanup EXIT

mkdir -p "$test_repo/.githooks" "$test_repo/validation"
cp "$repo_root/.githooks/pre-commit" "$test_repo/.githooks/pre-commit"
cp "$repo_root/.githooks/commit-msg" "$test_repo/.githooks/commit-msg"
cp "$repo_root/validation/blocked_terms_policy.sh" "$test_repo/validation/blocked_terms_policy.sh"
cp "$repo_root/validation/commit_message_policy.sh" "$test_repo/validation/commit_message_policy.sh"
chmod +x "$test_repo/.githooks/pre-commit" "$test_repo/.githooks/commit-msg"

git -C "$test_repo" init --quiet
git -C "$test_repo" config user.name "Blocked Terms Test"
git -C "$test_repo" config user.email "blocked-terms-test@example.invalid"
git -C "$test_repo" config core.hooksPath .githooks
git -C "$test_repo" commit --allow-empty --no-verify -m "test: fixture" --quiet
blocked_lower="$(printf '%s%s' 'bra' 've')"
blocked_upper="$(printf '%s' "$blocked_lower" | tr '[:lower:]' '[:upper:]')"
blocked_mixed="$(printf '%s%s' 'bRa' 'Ve')"
printf '%s\n' "$blocked_mixed" > "$terms_file"
export CLAWPERATOR_BLOCKED_TERMS_FILE="$terms_file"

assert_rejected() {
  if "$@"; then
    echo "Expected blocked-terms hook to reject: $*" >&2
    exit 1
  fi
}

assert_rejected git -C "$test_repo" commit --allow-empty -m "test: $blocked_lower"
assert_rejected git -C "$test_repo" commit --allow-empty -m "test: $blocked_upper"
assert_rejected git -C "$test_repo" commit --allow-empty -m "test: $blocked_mixed"

git -C "$test_repo" commit --allow-empty -m "test: allowed message" --quiet
git -C "$test_repo" rev-parse --verify HEAD >/dev/null

printf 'const blocked = "%s";\n' "$blocked_lower" > "$test_repo/blocked-content.js"
git -C "$test_repo" add blocked-content.js
assert_rejected git -C "$test_repo" commit -m "test: staged content"
git -C "$test_repo" reset --quiet -- blocked-content.js
rm "$test_repo/blocked-content.js"

echo "blocked-terms policy tests passed"
