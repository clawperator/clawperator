#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

REPO_ROOT="$(pwd)"
INSTALL_SCRIPT="$REPO_ROOT/sites/landing/public/install.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

assert_contains() {
    local file="$1"
    local needle="$2"
    local label="$3"
    if ! grep -Fq "$needle" "$file"; then
        echo "ERROR: $label missing expected output: $needle" >&2
        echo "--- $file ---" >&2
        cat "$file" >&2
        echo "-------------" >&2
        return 1
    fi
}

assert_not_contains() {
    local file="$1"
    local needle="$2"
    local label="$3"
    if grep -Fq "$needle" "$file"; then
        echo "ERROR: $label unexpectedly contained: $needle" >&2
        echo "--- $file ---" >&2
        cat "$file" >&2
        echo "-------------" >&2
        return 1
    fi
}

assert_equals() {
    local expected="$1"
    local actual="$2"
    local label="$3"
    if [ "$expected" != "$actual" ]; then
        echo "ERROR: $label expected '$expected' but got '$actual'" >&2
        return 1
    fi
}

run_parser_case() {
    local label="$1"
    local input_json="$2"
    local output_file="$3"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        printf "%s" "$2" | parse_authoring_skills_install_result > "$3"
    ' _ "$INSTALL_SCRIPT" "$input_json" "$output_file"
}

setup_mock_clawperator() {
    local mock_dir="$1"
    local mode="$2"
    local payload="${3:-}"
    local log_file="${4:-}"

    mkdir -p "$mock_dir"
    cat > "$mock_dir/clawperator" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ -n "${log_file}" ]; then
  printf '%s\n' "\$*" >> "${log_file}"
fi

case "${mode}" in
  success)
    if [ "\$1" = "authoring-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      cat <<'JSON'
${payload}
JSON
      exit 0
    fi
    ;;
  failure)
    if [ "\$1" = "authoring-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      printf '%s\n' '${payload}'
      exit 1
    fi
    ;;
  skills-success)
    if [ "\$1" = "skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      printf '%s\n' '{"registryPath":"/tmp/skills-registry.json"}'
      exit 0
    fi
    ;;
esac

exit 99
EOF
    chmod +x "$mock_dir/clawperator"
}

run_setup_authoring_case() {
    local label="$1"
    local mode="$2"
    local payload="$3"
    local output_file="$4"
    local status_file="$5"
    local values_file="$6"
    local extra_env="${7:-}"
    local mock_dir="$TMP_DIR/mock-$label"

    setup_mock_clawperator "$mock_dir" "$mode" "$payload"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"
        '"$extra_env"'
        setup_authoring_skills_via_cli > "$3"
        printf "%s\n" "$AUTHORING_SKILLS_SETUP_STATUS" > "$4"
        {
          printf "install=%s\n" "$AUTHORING_SKILLS_INSTALL_DIR"
          printf "claude=%s\n" "$AUTHORING_SKILLS_CLAUDE_DIR"
          printf "codex=%s\n" "$AUTHORING_SKILLS_CODEX_DIR"
          printf "agents=%s\n" "$AUTHORING_SKILLS_AGENTS_DIR"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_file" "$status_file" "$values_file"
}

run_guide_case() {
    local label="$1"
    local version_mode="$2"
    local output_file="$3"
    local guide_file="$4"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export AUTHORING_SKILLS_INSTALL_DIR="$HOME/.clawperator/authoring-skills"
        mkdir -p "$AUTHORING_SKILLS_INSTALL_DIR/skill-author-by-recording"
        mkdir -p "$AUTHORING_SKILLS_INSTALL_DIR/skill-audit"
        printf "# skill-author-by-recording\n" > "$AUTHORING_SKILLS_INSTALL_DIR/skill-author-by-recording/SKILL.md"
        printf "# skill-audit\n" > "$AUTHORING_SKILLS_INSTALL_DIR/skill-audit/SKILL.md"
        if [ "$2" = "with-version" ]; then
          printf "1.2.3\n" > "$AUTHORING_SKILLS_INSTALL_DIR/version.txt"
        fi
        write_agent_guide > "$3"
        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$4"
    ' _ "$INSTALL_SCRIPT" "$version_mode" "$output_file" "$guide_file"
}

run_missing_guide_case() {
    local label="$1"
    local output_file="$2"
    local guide_file="$3"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export AUTHORING_SKILLS_INSTALL_DIR="$HOME/.clawperator/nonexistent-authoring-skills"
        write_agent_guide > "$2"
        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$3"
    ' _ "$INSTALL_SCRIPT" "$output_file" "$guide_file"
}

run_skip_case() {
    local output_skills="$1"
    local output_authoring="$2"
    local status_file="$3"
    local log_file="$4"
    local mock_dir="$TMP_DIR/mock-skip"

    setup_mock_clawperator "$mock_dir" "skills-success" "" "$log_file"

    HOME="$TMP_DIR/home-skip" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"
        export CLAWPERATOR_INSTALL_SKIP_SKILLS=1
        setup_skills_via_cli > "$3"
        setup_authoring_skills_via_cli > "$4"
        {
          printf "skills=%s\n" "$SKILLS_SETUP_STATUS"
          printf "authoring=%s\n" "$AUTHORING_SKILLS_SETUP_STATUS"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_skills" "$output_authoring" "$status_file"
}

echo "=== Scenario 1: parser extracts installed and discovery dirs ==="
PARSE_SUCCESS_OUT="$TMP_DIR/parse-success.out"
run_parser_case \
    parse-success \
    '{"installedDir":"/tmp/installed","agentDiscoveryDirs":[{"label":"claude","dir":"/tmp/claude"},{"label":"codex","dir":"/tmp/codex"},{"label":"agents","dir":"/tmp/agents"},{"label":"gemini","dir":"/tmp/gemini"}]}' \
    "$PARSE_SUCCESS_OUT"
assert_contains "$PARSE_SUCCESS_OUT" "installedDir=/tmp/installed" "parse-success"
assert_contains "$PARSE_SUCCESS_OUT" "agentDiscoveryDir:claude=/tmp/claude" "parse-success"
assert_contains "$PARSE_SUCCESS_OUT" "agentDiscoveryDir:codex=/tmp/codex" "parse-success"
assert_contains "$PARSE_SUCCESS_OUT" "agentDiscoveryDir:agents=/tmp/agents" "parse-success"
assert_contains "$PARSE_SUCCESS_OUT" "agentDiscoveryDir:gemini=/tmp/gemini" "parse-success"

echo "=== Scenario 2: parser ignores malformed JSON ==="
PARSE_BAD_OUT="$TMP_DIR/parse-bad.out"
run_parser_case parse-bad '{"installedDir":' "$PARSE_BAD_OUT"
if [ -s "$PARSE_BAD_OUT" ]; then
    echo "ERROR: parse-bad should not emit output for malformed JSON" >&2
    cat "$PARSE_BAD_OUT" >&2
    exit 1
fi

echo "=== Scenario 3: authoring skills setup succeeds and honors CODEX_HOME ==="
AUTHORING_SUCCESS_OUT="$TMP_DIR/authoring-success.out"
AUTHORING_SUCCESS_STATUS="$TMP_DIR/authoring-success.status"
AUTHORING_SUCCESS_VALUES="$TMP_DIR/authoring-success.values"
run_setup_authoring_case \
    authoring-success \
    success \
    '{"installedDir":"/custom/install","agentDiscoveryDirs":[{"label":"claude","dir":"/custom/claude"},{"label":"codex","dir":"/custom/codex"},{"label":"agents","dir":"/custom/agents"},{"label":"gemini","dir":"/custom/gemini"}]}' \
    "$AUTHORING_SUCCESS_OUT" \
    "$AUTHORING_SUCCESS_STATUS" \
    "$AUTHORING_SUCCESS_VALUES" \
    'export CODEX_HOME="$HOME/custom-codex-home"'
assert_equals "configured" "$(cat "$AUTHORING_SUCCESS_STATUS")" "authoring-success status"
assert_contains "$AUTHORING_SUCCESS_OUT" "Authoring skills setup complete." "authoring-success"
assert_contains "$AUTHORING_SUCCESS_VALUES" "install=/custom/install" "authoring-success values"
assert_contains "$AUTHORING_SUCCESS_VALUES" "claude=/custom/claude" "authoring-success values"
assert_contains "$AUTHORING_SUCCESS_VALUES" "codex=/custom/codex" "authoring-success values"
assert_contains "$AUTHORING_SUCCESS_VALUES" "agents=/custom/agents" "authoring-success values"

echo "=== Scenario 4: partial authoring JSON falls back to defaults ==="
AUTHORING_PARTIAL_OUT="$TMP_DIR/authoring-partial.out"
AUTHORING_PARTIAL_STATUS="$TMP_DIR/authoring-partial.status"
AUTHORING_PARTIAL_VALUES="$TMP_DIR/authoring-partial.values"
run_setup_authoring_case \
    authoring-partial \
    success \
    '{"installedDir":"/partial/install","agentDiscoveryDirs":[{"label":"claude","dir":"/partial/claude"}]}' \
    "$AUTHORING_PARTIAL_OUT" \
    "$AUTHORING_PARTIAL_STATUS" \
    "$AUTHORING_PARTIAL_VALUES"
assert_equals "configured" "$(cat "$AUTHORING_PARTIAL_STATUS")" "authoring-partial status"
assert_contains "$AUTHORING_PARTIAL_VALUES" "install=/partial/install" "authoring-partial values"
assert_contains "$AUTHORING_PARTIAL_VALUES" "claude=/partial/claude" "authoring-partial values"
assert_contains "$AUTHORING_PARTIAL_VALUES" "codex=$TMP_DIR/home-authoring-partial/.codex/skills/" "authoring-partial values"
assert_contains "$AUTHORING_PARTIAL_VALUES" "agents=$TMP_DIR/home-authoring-partial/.agents/skills/" "authoring-partial values"

echo "=== Scenario 5: authoring skills setup failure is non-fatal ==="
AUTHORING_FAILURE_OUT="$TMP_DIR/authoring-failure.out"
AUTHORING_FAILURE_STATUS="$TMP_DIR/authoring-failure.status"
AUTHORING_FAILURE_VALUES="$TMP_DIR/authoring-failure.values"
run_setup_authoring_case \
    authoring-failure \
    failure \
    'authoring install conflict' \
    "$AUTHORING_FAILURE_OUT" \
    "$AUTHORING_FAILURE_STATUS" \
    "$AUTHORING_FAILURE_VALUES"
assert_equals "failed" "$(cat "$AUTHORING_FAILURE_STATUS")" "authoring-failure status"
assert_contains "$AUTHORING_FAILURE_OUT" "Authoring skills setup failed via CLI." "authoring-failure"
assert_contains "$AUTHORING_FAILURE_OUT" "authoring install conflict" "authoring-failure"
assert_contains "$AUTHORING_FAILURE_VALUES" "install=$TMP_DIR/home-authoring-failure/.clawperator/authoring-skills/" "authoring-failure values"

echo "=== Scenario 6: guide writer lists installed skills and refresh guidance ==="
GUIDE_OUT="$TMP_DIR/guide.out"
GUIDE_PATH_FILE="$TMP_DIR/guide.path"
run_guide_case guide-missing-version without-version "$GUIDE_OUT" "$GUIDE_PATH_FILE"
GUIDE_PATH="$(cat "$GUIDE_PATH_FILE")"
assert_contains "$GUIDE_OUT" "Wrote agent guide" "guide-missing-version"
assert_contains "$GUIDE_PATH" "skill-author-by-recording" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "skill-audit" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "Version metadata is missing for this install." "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator authoring-skills update" "guide-missing-version file"

echo "=== Scenario 7: guide writer shows fallback when authoring skills are absent ==="
GUIDE_MISSING_OUT="$TMP_DIR/guide-missing.out"
GUIDE_MISSING_PATH_FILE="$TMP_DIR/guide-missing.path"
run_missing_guide_case guide-absent "$GUIDE_MISSING_OUT" "$GUIDE_MISSING_PATH_FILE"
GUIDE_MISSING_PATH="$(cat "$GUIDE_MISSING_PATH_FILE")"
assert_contains "$GUIDE_MISSING_PATH" "First-party Clawperator authoring skills are not currently configured on this host." "guide-absent file"
assert_contains "$GUIDE_MISSING_PATH" "clawperator authoring-skills install" "guide-absent file"

echo "=== Scenario 8: skip flag suppresses both runtime and authoring skills setup ==="
SKIP_SKILLS_OUT="$TMP_DIR/skip-skills.out"
SKIP_AUTHORING_OUT="$TMP_DIR/skip-authoring.out"
SKIP_STATUS="$TMP_DIR/skip.status"
SKIP_LOG="$TMP_DIR/skip.log"
touch "$SKIP_LOG"
run_skip_case "$SKIP_SKILLS_OUT" "$SKIP_AUTHORING_OUT" "$SKIP_STATUS" "$SKIP_LOG"
assert_contains "$SKIP_SKILLS_OUT" "Skipping skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1." "skip-skills"
assert_contains "$SKIP_AUTHORING_OUT" "Skipping authoring skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1." "skip-authoring"
assert_contains "$SKIP_STATUS" "skills=skipped" "skip-status"
assert_contains "$SKIP_STATUS" "authoring=skipped" "skip-status"
assert_equals "" "$(cat "$SKIP_LOG")" "skip command log"

echo "=== install.sh authoring-skills harness passed ==="
