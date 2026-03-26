#!/usr/bin/env bash

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/gather_commits.sh"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [[ -z "$REPO_ROOT" ]]; then
  printf 'FAIL: not inside a git repository\n' >&2
  exit 1
fi

cd "$REPO_ROOT"

failures=0

path_type() {
  local path="$1"
  case "$path" in
    apps/node/src/test/**|\
      apps/android/app/src/test/**|\
      apps/android/app/src/androidTest/**|\
      apps/android/app-conformance/**|\
      apps/node/node_modules/**|\
      apps/node/dist/**|\
      apps/node/coverage/**|\
      apps/android/build/**|\
      apps/android/app/build/**|\
      apps/android/**/generated/**|\
      .agents/**|\
      .github/**|\
      tasks/**|\
      docs/internal/**|\
      sites/docs/AGENTS.md|\
      sites/docs/requirements.txt|\
      sites/landing/public/sitemap.xml|\
      sites/landing/public/landing-sitemap.xml|\
      sites/docs/.build/**|\
      sites/docs/site/**|\
      sites/landing/.next/**|\
      sites/landing/out/**|\
      detekt*.yml|\
      detekt-baseline.xml)
      printf 'infra'
      ;;
    apps/node/package-lock.json|\
      sites/docs/static/llms-full.txt|\
      sites/docs/static/llms.txt|\
      sites/landing/public/llms-full.txt|\
      sites/landing/public/llms.txt)
      printf 'generated'
      ;;
    apps/node/package.json|\
      sites/docs/mkdocs.yml|\
      sites/docs/source-map.yaml|\
      gradle/**|\
      build.gradle.kts|\
      settings.gradle.kts|\
      gradle.properties|\
      local.properties)
      printf 'config'
      ;;
    *)
      case "$path" in
        apps/node/**|apps/android/**|docs/**|sites/docs/**|sites/landing/**)
          printf 'src'
          ;;
        *)
          printf 'infra'
          ;;
      esac
      ;;
  esac
}

run_script() {
  local output_file="$1"
  local stderr_file="$2"
  shift 2
  bash "$SCRIPT" "$@" >"$output_file" 2>"$stderr_file"
}

first_non_empty_line() {
  awk 'NF {print; exit}' "$1"
}

case1_out="$(mktemp)"
case1_err="$(mktemp)"
if run_script "$case1_out" "$case1_err" v0.5.0 v0.5.1; then
  first_line="$(first_non_empty_line "$case1_out")"
  if [[ "$first_line" =~ ^RELEASE_DATE:\ [0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    printf 'PASS: gather_commits.sh emits RELEASE_DATE first\n'
  else
    printf 'FAIL: gather_commits.sh first non-empty line was: %s\n' "$first_line"
    failures=$((failures + 1))
  fi
else
  printf 'FAIL: gather_commits.sh v0.5.0 v0.5.1 exited non-zero\n'
  failures=$((failures + 1))
fi
rm -f "$case1_out" "$case1_err"

case2_out="$(mktemp)"
case2_err="$(mktemp)"
if run_script "$case2_out" "$case2_err" v0.5.0 v0.5.1; then
  if grep -q '^=== COMMIT ' "$case2_out" && grep -q '^CLASSIFICATION: ' "$case2_out"; then
    printf 'PASS: gather_commits.sh emits commit blocks with classifications\n'
  else
    printf 'FAIL: gather_commits.sh output missing commit block or classification line\n'
    failures=$((failures + 1))
  fi
else
  printf 'FAIL: gather_commits.sh v0.5.0 v0.5.1 exited non-zero for classification check\n'
  failures=$((failures + 1))
fi
rm -f "$case2_out" "$case2_err"

case3_out="$(mktemp)"
case3_err="$(mktemp)"
if run_script "$case3_out" "$case3_err" v0.5.0 v0.5.1; then
  if awk '
    /^=== COMMIT b2f72345/ { in_block = 1; next }
    /^=== COMMIT / && in_block { exit }
    in_block && /^CLASSIFICATION: drop:no-src$/ { found = 1 }
    END { exit(found ? 0 : 1) }
  ' "$case3_out"; then
    printf 'PASS: b2f7234 is classified as drop:no-src\n'
  else
    printf 'FAIL: b2f7234 was not classified as drop:no-src\n'
    failures=$((failures + 1))
  fi
else
  printf 'FAIL: gather_commits.sh v0.5.0 v0.5.1 exited non-zero for b2f7234 check\n'
  failures=$((failures + 1))
fi
rm -f "$case3_out" "$case3_err"

case4_out="$(mktemp)"
case4_err="$(mktemp)"
if run_script "$case4_out" "$case4_err" v0.5.0 v0.5.1; then
  if grep -q '^CLASSIFICATION: keep$' "$case4_out"; then
    printf 'PASS: at least one commit in the range is classified as keep\n'
  else
    printf 'FAIL: no keep commit found in the range\n'
    failures=$((failures + 1))
  fi
else
  printf 'FAIL: gather_commits.sh v0.5.0 v0.5.1 exited non-zero for keep check\n'
  failures=$((failures + 1))
fi
rm -f "$case4_out" "$case4_err"

case5_path='apps/node/src/test/unit/foo.test.ts'
if [[ "$(path_type "$case5_path")" == "infra" ]]; then
  printf 'PASS: %s is classified as infra\n' "$case5_path"
else
  printf 'FAIL: %s was not classified as infra\n' "$case5_path"
  failures=$((failures + 1))
fi

case6_out="$(mktemp)"
case6_err="$(mktemp)"
if run_script "$case6_out" "$case6_err"; then
  printf 'FAIL: gather_commits.sh with no args unexpectedly succeeded\n'
  failures=$((failures + 1))
else
  printf 'PASS: gather_commits.sh with no args exits non-zero\n'
fi
rm -f "$case6_out" "$case6_err"

case7_out="$(mktemp)"
case7_err="$(mktemp)"
if run_script "$case7_out" "$case7_err" invalid-tag v0.5.1; then
  printf 'FAIL: gather_commits.sh with invalid tag unexpectedly succeeded\n'
  failures=$((failures + 1))
else
  printf 'PASS: gather_commits.sh with an invalid tag exits non-zero\n'
fi
rm -f "$case7_out" "$case7_err"

if [[ "$failures" -ne 0 ]]; then
  printf 'FAIL: %s test case(s) failed\n' "$failures" >&2
  exit 1
fi

exit 0
