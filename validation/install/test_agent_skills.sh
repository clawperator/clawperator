#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

REPO_ROOT="$(pwd)"
INSTALL_SCRIPT="$REPO_ROOT/sites/landing/public/install.sh"
REAL_NODE_CLI="$REPO_ROOT/apps/node/dist/cli/index.js"
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

assert_occurrence_count() {
    local file="$1"
    local needle="$2"
    local expected_count="$3"
    local label="$4"
    local actual_count
    actual_count="$(grep -Fc "$needle" "$file" || true)"
    assert_equals "$expected_count" "$actual_count" "$label"
}

assert_file_empty() {
    local file="$1"
    local label="$2"
    if [ -s "$file" ]; then
        echo "ERROR: $label expected empty file: $file" >&2
        cat "$file" >&2
        return 1
    fi
}

file_mode() {
    local file="$1"
    if stat -f '%Lp' "$file" >/dev/null 2>&1; then
        stat -f '%Lp' "$file"
        return 0
    fi
    stat -c '%a' "$file"
}

assert_mode() {
    local file="$1"
    local expected_mode="$2"
    local label="$3"
    local actual_mode
    actual_mode="$(file_mode "$file")"
    assert_equals "$expected_mode" "$actual_mode" "$label"
}

# shellcheck source=lib/json_assert.sh
source "$REPO_ROOT/validation/install/lib/json_assert.sh"

run_parser_case() {
    local label="$1"
    local input_json="$2"
    local output_file="$3"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        printf "%s" "$2" | parse_bundled_skills_install_result > "$3"
    ' _ "$INSTALL_SCRIPT" "$input_json" "$output_file"
}

run_operator_metadata_case() {
    local label="$1"
    local metadata_content="$2"
    local output_file="$3"
    local status_file="$4"
    local values_file="$5"
    local metadata_file="$TMP_DIR/$label-metadata.json"

    printf '%s' "$metadata_content" > "$metadata_file"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        set +e
        parse_operator_metadata "$2" > "$3" 2>&1
        status="$?"
        set -e
        printf "%s\n" "$status" > "$4"
        {
          printf "version=%s\n" "${OPERATOR_VERSION:-}"
          printf "apk=%s\n" "${OPERATOR_APK_URL:-}"
          printf "sha_url=%s\n" "${OPERATOR_SHA_URL:-}"
          printf "sha256=%s\n" "${OPERATOR_EXPECTED_SHA256:-}"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$metadata_file" "$output_file" "$status_file" "$values_file"
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
    if [ "\$1" = "--version" ]; then
      printf '%s\n' '1.2.3'
      exit 0
    fi
    if [ "\$1" = "bundled-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      cat <<'JSON'
${payload}
JSON
      exit 0
    fi
    ;;
  failure)
    if [ "\$1" = "--version" ]; then
      printf '%s\n' '1.2.3'
      exit 0
    fi
    if [ "\$1" = "bundled-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      printf '%s\n' '${payload}'
      exit 1
    fi
    ;;
  skills-success)
    if [ "\$1" = "--version" ]; then
      printf '%s\n' '1.2.3'
      exit 0
    fi
    if [ "\$1" = "skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      printf '%s\n' '{"registryPath":"/tmp/skills-registry.json"}'
      exit 0
    fi
    ;;
  version-banner)
    if [ "\$1" = "--version" ]; then
      printf '%s\n' 'Clawperator CLI'
      printf '%s\n' '1.2.3'
      exit 0
    fi
    ;;
  host-partial)
    if [ "\$1" = "--version" ]; then
      printf '%s\n' '1.2.3'
      exit 0
    fi
    if [ "\$1" = "host" ] && [ "\$2" = "setup" ]; then
      printf '%s\n' '{"ok":true,"summary":{"written":1,"updated":0,"skipped":0,"failed":0},"artifacts":[{"artifact":"installState","status":"written","path":"/tmp/install-state.json"},{"artifact":"mcpConfigSnippet","status":"written","path":"/tmp/mcp.json"},{"artifact":"agentGuide","status":"written","path":"/tmp/AGENTS.md"}]}'
      exit 0
    fi
    ;;
esac

if [ "\$1" = "host" ] && [ "\$2" = "setup" ]; then
  exec "$EXPECTED_NODE_BIN" "$REAL_NODE_CLI" "\$@"
fi

exit 99
EOF
    chmod +x "$mock_dir/clawperator"
}

run_setup_bundled_skills_case() {
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
        setup_bundled_skills_via_cli > "$3"
        printf "%s\n" "$BUNDLED_SKILLS_SETUP_STATUS" > "$4"
        {
          printf "install=%s\n" "$BUNDLED_SKILLS_INSTALL_DIR"
          printf "claude=%s\n" "$BUNDLED_SKILLS_CLAUDE_DIR"
          printf "codex=%s\n" "$BUNDLED_SKILLS_CODEX_DIR"
          printf "agents=%s\n" "$BUNDLED_SKILLS_AGENTS_DIR"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_file" "$status_file" "$values_file"
}

run_skip_case() {
    local output_skills="$1"
    local output_agent_skills="$2"
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
        setup_bundled_skills_via_cli > "$4"
        {
          printf "skills=%s\n" "$SKILLS_SETUP_STATUS"
          printf "bundled=%s\n" "$BUNDLED_SKILLS_SETUP_STATUS"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_skills" "$output_agent_skills" "$status_file"
}

run_durable_summary_case() {
    local label="$1"
    local output_file="$2"

    HOME="$TMP_DIR/home-summary-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        print_durable_artifact_summary > "$2"
    ' _ "$INSTALL_SCRIPT" "$output_file"
}

run_host_artifacts_case() {
    local label="$1"
    local shared_agents_mode="$2"
    local output_file="$3"
    local status_file="$4"
    local cli_log_file="$5"
    local guide_path_file="$6"
    local install_state_path_file="$7"
    local snippet_path_file="$8"
    local shared_agents_path_file="$9"
    local first_bridge_snapshot="${10}"
    local mock_dir="$TMP_DIR/mock-host-$label"
    local registry_path="$TMP_DIR/home-host-$label/.clawperator/skills/skills/skills-registry.json"

    setup_mock_clawperator "$mock_dir" "success" "{}" "$cli_log_file"
    printf '// mock cli entrypoint for installer delegation tests\n' > "$mock_dir/clawperator.cli.js"
    cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF
    chmod +x "$mock_dir/adb"

    HOME="$TMP_DIR/home-host-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    EXPECTED_NODE_BIN="$EXPECTED_NODE_BIN" \
    REAL_NODE_CLI="$REAL_NODE_CLI" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"
        export CLAWPERATOR_CLI_JS_PATH="$3"
        export CLAWPERATOR_HOST_ARTIFACTS_INSTALLED_AT="2026-04-23T10:11:12Z"
        export SKILLS_REGISTRY_PATH="$4"
        export OPERATOR_VERSION="9.9.9"
        export LAST_DEVICE_SERIAL="serial-123"

        mkdir -p "${SKILLS_REGISTRY_PATH%/*}"
        cat > "$SKILLS_REGISTRY_PATH" <<'\''JSON'\''
{"skills":[
  {"id":"com.example.weather.check-status","applicationId":"com.example.weather","intent":"check_status","summary":"Checks the current weather status","contract":{"inputs":{"city_name":{"type":"string"}}}}
]}
JSON

        BUNDLED_DIR="$HOME/.clawperator/bundled-skills"
        mkdir -p "$BUNDLED_DIR/clawperator-agent-orientation"
        mkdir -p "$BUNDLED_DIR/clawperator-upgrade"
        mkdir -p "$BUNDLED_DIR/clawperator-skill-author-by-agent-discovery"
        mkdir -p "$BUNDLED_DIR/clawperator-skill-author-by-recording"
        printf "# clawperator-agent-orientation\n" > "$BUNDLED_DIR/clawperator-agent-orientation/SKILL.md"
        printf "# clawperator-upgrade\n" > "$BUNDLED_DIR/clawperator-upgrade/SKILL.md"
        printf "# clawperator-skill-author-by-agent-discovery\n" > "$BUNDLED_DIR/clawperator-skill-author-by-agent-discovery/SKILL.md"
        printf "# clawperator-skill-author-by-recording\n" > "$BUNDLED_DIR/clawperator-skill-author-by-recording/SKILL.md"
        printf "1.2.3\n" > "$BUNDLED_DIR/version.txt"
        export BUNDLED_SKILLS_INSTALL_DIR="$BUNDLED_DIR"

        case "$5" in
          existing)
            mkdir -p "$HOME/.agents"
            printf "# Shared Agent Guide\n\nExisting host guidance.\n" > "$HOME/.agents/AGENTS.md"
            ;;
          symlink)
            mkdir -p "$HOME/.agents"
            printf "# Shared Agent Guide\n\nExisting host guidance.\n" > "$HOME/.agents/shared-target.md"
            ln -s "$HOME/.agents/shared-target.md" "$HOME/.agents/AGENTS.md"
            ;;
        esac

        set +e
        setup_host_artifacts_via_cli > "$6" 2>&1
        first_status="$?"
        set -e
        if [ -e "$HOME/.agents/AGENTS.md" ]; then
            cp "$HOME/.agents/AGENTS.md" "${11}"
        fi

        set +e
        setup_host_artifacts_via_cli >> "$6" 2>&1
        second_status="$?"
        set -e

        {
          printf "first=%s\n" "$first_status"
          printf "second=%s\n" "$second_status"
        } > "$7"
        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$8"
        printf "%s\n" "$HOME/.clawperator/install-state.json" > "$9"
        printf "%s\n" "$HOME/.clawperator/mcp-config-snippet.json" > "${10}"
        printf "%s\n" "$HOME/.agents/AGENTS.md" > "${12}"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$mock_dir/clawperator.cli.js" "$registry_path" "$shared_agents_mode" "$output_file" "$status_file" "$guide_path_file" "$install_state_path_file" "$snippet_path_file" "$first_bridge_snapshot" "$shared_agents_path_file"
}

run_host_artifacts_env_registry_case() {
    local label="$1"
    local output_file="$2"
    local status_file="$3"
    local cli_log_file="$4"
    local guide_path_file="$5"
    local install_state_path_file="$6"
    local registry_path_file="$7"
    local mock_dir="$TMP_DIR/mock-host-$label"
    local env_registry_path="$TMP_DIR/home-host-$label/custom/skills-registry.json"

    setup_mock_clawperator "$mock_dir" "success" "{}" "$cli_log_file"
    printf '// mock cli entrypoint for installer delegation tests\n' > "$mock_dir/clawperator.cli.js"
    cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF
    chmod +x "$mock_dir/adb"

    HOME="$TMP_DIR/home-host-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    EXPECTED_NODE_BIN="$EXPECTED_NODE_BIN" \
    REAL_NODE_CLI="$REAL_NODE_CLI" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"
        export CLAWPERATOR_CLI_JS_PATH="$3"
        export CLAWPERATOR_HOST_ARTIFACTS_INSTALLED_AT="2026-04-23T10:11:12Z"
        export CLAWPERATOR_SKILLS_REGISTRY="$4"
        unset SKILLS_REGISTRY_PATH

        mkdir -p "${CLAWPERATOR_SKILLS_REGISTRY%/*}"
        cat > "$CLAWPERATOR_SKILLS_REGISTRY" <<'\''JSON'\''
{"skills":[
  {"id":"com.example.weather.check-status","applicationId":"com.example.weather","intent":"check_status","summary":"Checks the current weather status","contract":{"inputs":{"city_name":{"type":"string"}}}}
]}
JSON

        BUNDLED_DIR="$HOME/.clawperator/bundled-skills"
        mkdir -p "$BUNDLED_DIR/clawperator-agent-orientation"
        mkdir -p "$BUNDLED_DIR/clawperator-upgrade"
        mkdir -p "$BUNDLED_DIR/clawperator-skill-author-by-agent-discovery"
        mkdir -p "$BUNDLED_DIR/clawperator-skill-author-by-recording"
        printf "# clawperator-agent-orientation\n" > "$BUNDLED_DIR/clawperator-agent-orientation/SKILL.md"
        printf "# clawperator-upgrade\n" > "$BUNDLED_DIR/clawperator-upgrade/SKILL.md"
        printf "# clawperator-skill-author-by-agent-discovery\n" > "$BUNDLED_DIR/clawperator-skill-author-by-agent-discovery/SKILL.md"
        printf "# clawperator-skill-author-by-recording\n" > "$BUNDLED_DIR/clawperator-skill-author-by-recording/SKILL.md"
        printf "1.2.3\n" > "$BUNDLED_DIR/version.txt"
        export BUNDLED_SKILLS_INSTALL_DIR="$BUNDLED_DIR"

        mkdir -p "$HOME/.agents"
        printf "# Shared Agent Guide\n\nExisting host guidance.\n" > "$HOME/.agents/AGENTS.md"

        set +e
        setup_host_artifacts_via_cli > "$5" 2>&1
        status="$?"
        set -e

        printf "first=%s\n" "$status" > "$6"
        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$7"
        printf "%s\n" "$HOME/.clawperator/install-state.json" > "$8"
        printf "%s\n" "$CLAWPERATOR_SKILLS_REGISTRY" > "$9"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$mock_dir/clawperator.cli.js" "$env_registry_path" "$output_file" "$status_file" "$guide_path_file" "$install_state_path_file" "$registry_path_file"
}

run_host_artifacts_incomplete_case() {
    local label="$1"
    local output_file="$2"
    local status_file="$3"
    local cli_log_file="$4"
    local mock_dir="$TMP_DIR/mock-host-$label"

    setup_mock_clawperator "$mock_dir" "host-partial" "{}" "$cli_log_file"
    printf '// mock cli entrypoint for installer delegation tests\n' > "$mock_dir/clawperator.cli.js"

    HOME="$TMP_DIR/home-host-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    EXPECTED_NODE_BIN="$EXPECTED_NODE_BIN" \
    REAL_NODE_CLI="$REAL_NODE_CLI" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"
        export CLAWPERATOR_CLI_JS_PATH="$3"
        export CLAWPERATOR_HOST_ARTIFACTS_INSTALLED_AT="2026-04-23T10:11:12Z"

        set +e
        setup_host_artifacts_via_cli > "$4" 2>&1
        status="$?"
        set -e

        printf "first=%s\n" "$status" > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$mock_dir/clawperator.cli.js" "$output_file" "$status_file"
}

EXPECTED_NODE_BIN="$(node -p 'process.execPath')"

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

echo "=== Scenario 3: bundled-skills setup succeeds with explicit discovery dirs ==="
BUNDLED_SKILLS_SUCCESS_OUT="$TMP_DIR/bundled-skills-success.out"
BUNDLED_SKILLS_SUCCESS_STATUS="$TMP_DIR/bundled-skills-success.status"
BUNDLED_SKILLS_SUCCESS_VALUES="$TMP_DIR/bundled-skills-success.values"
run_setup_bundled_skills_case \
    bundled-skills-success \
    success \
    '{"installedDir":"/custom/install","agentDiscoveryDirs":[{"label":"claude","dir":"/custom/claude"},{"label":"codex","dir":"/custom/codex"},{"label":"agents","dir":"/custom/agents"},{"label":"gemini","dir":"/custom/gemini"}]}' \
    "$BUNDLED_SKILLS_SUCCESS_OUT" \
    "$BUNDLED_SKILLS_SUCCESS_STATUS" \
    "$BUNDLED_SKILLS_SUCCESS_VALUES"
assert_equals "configured" "$(cat "$BUNDLED_SKILLS_SUCCESS_STATUS")" "bundled-skills-success status"
assert_contains "$BUNDLED_SKILLS_SUCCESS_OUT" "Bundled-skills setup complete." "bundled-skills-success"
assert_contains "$BUNDLED_SKILLS_SUCCESS_VALUES" "install=/custom/install" "bundled-skills-success values"
assert_contains "$BUNDLED_SKILLS_SUCCESS_VALUES" "claude=/custom/claude" "bundled-skills-success values"
assert_contains "$BUNDLED_SKILLS_SUCCESS_VALUES" "codex=/custom/codex" "bundled-skills-success values"
assert_contains "$BUNDLED_SKILLS_SUCCESS_VALUES" "agents=/custom/agents" "bundled-skills-success values"

echo "=== Scenario 4: partial bundled-skills JSON falls back to defaults ==="
BUNDLED_SKILLS_PARTIAL_OUT="$TMP_DIR/bundled-skills-partial.out"
BUNDLED_SKILLS_PARTIAL_STATUS="$TMP_DIR/bundled-skills-partial.status"
BUNDLED_SKILLS_PARTIAL_VALUES="$TMP_DIR/bundled-skills-partial.values"
run_setup_bundled_skills_case \
    bundled-skills-partial \
    success \
    '{"installedDir":"/partial/install","agentDiscoveryDirs":[{"label":"claude","dir":"/partial/claude"}]}' \
    "$BUNDLED_SKILLS_PARTIAL_OUT" \
    "$BUNDLED_SKILLS_PARTIAL_STATUS" \
    "$BUNDLED_SKILLS_PARTIAL_VALUES"
assert_equals "configured" "$(cat "$BUNDLED_SKILLS_PARTIAL_STATUS")" "bundled-skills-partial status"
assert_contains "$BUNDLED_SKILLS_PARTIAL_VALUES" "install=/partial/install" "bundled-skills-partial values"
assert_contains "$BUNDLED_SKILLS_PARTIAL_VALUES" "claude=/partial/claude" "bundled-skills-partial values"
assert_contains "$BUNDLED_SKILLS_PARTIAL_VALUES" "codex=$TMP_DIR/home-bundled-skills-partial/.codex/skills/" "bundled-skills-partial values"
assert_contains "$BUNDLED_SKILLS_PARTIAL_VALUES" "agents=$TMP_DIR/home-bundled-skills-partial/.agents/skills/" "bundled-skills-partial values"

echo "=== Scenario 5: CODEX_HOME fallback is used when codex dir is omitted ==="
BUNDLED_SKILLS_CODEX_HOME_OUT="$TMP_DIR/bundled-skills-codex-home.out"
BUNDLED_SKILLS_CODEX_HOME_STATUS="$TMP_DIR/bundled-skills-codex-home.status"
BUNDLED_SKILLS_CODEX_HOME_VALUES="$TMP_DIR/bundled-skills-codex-home.values"
EXPECTED_CODEX_HOME_DIR="$TMP_DIR/home-bundled-skills-codex-home/custom-codex-home/skills/"
run_setup_bundled_skills_case \
    bundled-skills-codex-home \
    success \
    '{"installedDir":"/codex-home/install","agentDiscoveryDirs":[{"label":"claude","dir":"/codex-home/claude"}]}' \
    "$BUNDLED_SKILLS_CODEX_HOME_OUT" \
    "$BUNDLED_SKILLS_CODEX_HOME_STATUS" \
    "$BUNDLED_SKILLS_CODEX_HOME_VALUES" \
    'export CODEX_HOME="$HOME/custom-codex-home"'
assert_equals "configured" "$(cat "$BUNDLED_SKILLS_CODEX_HOME_STATUS")" "bundled-skills-codex-home status"
assert_contains "$BUNDLED_SKILLS_CODEX_HOME_VALUES" "codex=$EXPECTED_CODEX_HOME_DIR" "bundled-skills-codex-home values"
assert_contains "$BUNDLED_SKILLS_CODEX_HOME_VALUES" "agents=$TMP_DIR/home-bundled-skills-codex-home/.agents/skills/" "bundled-skills-codex-home values"

echo "=== Scenario 6: bundled-skills setup failure is non-fatal ==="
BUNDLED_SKILLS_FAILURE_OUT="$TMP_DIR/bundled-skills-failure.out"
BUNDLED_SKILLS_FAILURE_STATUS="$TMP_DIR/bundled-skills-failure.status"
BUNDLED_SKILLS_FAILURE_VALUES="$TMP_DIR/bundled-skills-failure.values"
run_setup_bundled_skills_case \
    bundled-skills-failure \
    failure \
    'authoring install conflict' \
    "$BUNDLED_SKILLS_FAILURE_OUT" \
    "$BUNDLED_SKILLS_FAILURE_STATUS" \
    "$BUNDLED_SKILLS_FAILURE_VALUES"
assert_equals "failed" "$(cat "$BUNDLED_SKILLS_FAILURE_STATUS")" "bundled-skills-failure status"
assert_contains "$BUNDLED_SKILLS_FAILURE_OUT" "Bundled-skills setup failed via CLI." "bundled-skills-failure"
assert_contains "$BUNDLED_SKILLS_FAILURE_OUT" "authoring install conflict" "bundled-skills-failure"
assert_contains "$BUNDLED_SKILLS_FAILURE_VALUES" "install=$TMP_DIR/home-bundled-skills-failure/.clawperator/bundled-skills/" "bundled-skills-failure values"

echo "=== Scenario 7: delegated host artifacts invoke the CLI and materialize files ==="
HOST_ARTIFACTS_OUT="$TMP_DIR/host-artifacts.out"
HOST_ARTIFACTS_STATUS="$TMP_DIR/host-artifacts.status"
HOST_ARTIFACTS_CLI_LOG="$TMP_DIR/host-artifacts.cli.log"
HOST_GUIDE_PATH_FILE="$TMP_DIR/host-artifacts.guide.path"
HOST_INSTALL_STATE_PATH_FILE="$TMP_DIR/host-artifacts.install-state.path"
HOST_SNIPPET_PATH_FILE="$TMP_DIR/host-artifacts.mcp.path"
HOST_SHARED_PATH_FILE="$TMP_DIR/host-artifacts.shared.path"
HOST_FIRST_BRIDGE="$TMP_DIR/host-artifacts.shared.first"
run_host_artifacts_case \
    delegated \
    existing \
    "$HOST_ARTIFACTS_OUT" \
    "$HOST_ARTIFACTS_STATUS" \
    "$HOST_ARTIFACTS_CLI_LOG" \
    "$HOST_GUIDE_PATH_FILE" \
    "$HOST_INSTALL_STATE_PATH_FILE" \
    "$HOST_SNIPPET_PATH_FILE" \
    "$HOST_SHARED_PATH_FILE" \
    "$HOST_FIRST_BRIDGE"
HOST_GUIDE_PATH="$(cat "$HOST_GUIDE_PATH_FILE")"
HOST_INSTALL_STATE_PATH="$(cat "$HOST_INSTALL_STATE_PATH_FILE")"
HOST_SNIPPET_PATH="$(cat "$HOST_SNIPPET_PATH_FILE")"
HOST_SHARED_PATH="$(cat "$HOST_SHARED_PATH_FILE")"
assert_contains "$HOST_ARTIFACTS_STATUS" "first=0" "host-artifacts status"
assert_contains "$HOST_ARTIFACTS_STATUS" "second=0" "host-artifacts status"
assert_contains "$HOST_ARTIFACTS_OUT" "Setting up durable host artifacts via the CLI..." "host-artifacts output"
assert_contains "$HOST_ARTIFACTS_OUT" "Local AGENTS.md: written" "host-artifacts output"
assert_contains "$HOST_ARTIFACTS_OUT" "Install state: written" "host-artifacts output"
assert_contains "$HOST_ARTIFACTS_OUT" "MCP config snippet: written" "host-artifacts output"
assert_contains "$HOST_ARTIFACTS_OUT" "Shared agent bridge: updated" "host-artifacts output"
assert_contains "$HOST_ARTIFACTS_OUT" "Host setup complete." "host-artifacts output"
assert_contains "$HOST_ARTIFACTS_CLI_LOG" "host setup --output json --installed-at 2026-04-23T10:11:12Z --cli-version 1.2.3 --apk-version 9.9.9 --last-device-serial serial-123" "host-artifacts cli log"
assert_occurrence_count "$HOST_ARTIFACTS_CLI_LOG" "host setup" "2" "host-artifacts cli invocation count"
assert_contains "$HOST_GUIDE_PATH" "## Runtime Skills" "host-artifacts guide"
assert_contains "$HOST_GUIDE_PATH" "com.example.weather.check-status" "host-artifacts guide"
assert_contains "$HOST_GUIDE_PATH" "clawperator-agent-orientation" "host-artifacts guide"
assert_json_field_equals "$HOST_INSTALL_STATE_PATH" "schemaVersion" "1" "host-artifacts install-state schemaVersion"
assert_json_field_equals "$HOST_INSTALL_STATE_PATH" "installedAt" "2026-04-23T10:11:12Z" "host-artifacts install-state installedAt"
assert_json_field_equals "$HOST_INSTALL_STATE_PATH" "cliVersion" "1.2.3" "host-artifacts install-state cliVersion"
assert_json_field_equals "$HOST_INSTALL_STATE_PATH" "registryPath" "$TMP_DIR/home-host-delegated/.clawperator/skills/skills/skills-registry.json" "host-artifacts install-state registryPath"
assert_json_field_equals "$HOST_INSTALL_STATE_PATH" "apkVersion" "9.9.9" "host-artifacts install-state apkVersion"
assert_json_field_equals "$HOST_INSTALL_STATE_PATH" "lastDeviceSerial" "serial-123" "host-artifacts install-state lastDeviceSerial"
assert_json_field_equals "$HOST_SNIPPET_PATH" "claudeDesktop.entry.clawperator.args.0" "$TMP_DIR/mock-host-delegated/clawperator.cli.js" "host-artifacts mcp args.0"
assert_json_field_equals "$HOST_SNIPPET_PATH" "claudeDesktop.entry.clawperator.env.ADB_PATH" "$TMP_DIR/mock-host-delegated/adb" "host-artifacts mcp ADB_PATH"
assert_json_field_equals "$HOST_SNIPPET_PATH" "notes.1" "Regenerate it with clawperator host setup if the clawperator binary path or adb path changes." "host-artifacts mcp notes.1"
assert_contains "$HOST_SHARED_PATH" "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:START -->" "host-artifacts shared guide"
assert_contains "$HOST_SHARED_PATH" "Existing host guidance." "host-artifacts shared guide"
assert_mode "$HOST_GUIDE_PATH" "600" "host-artifacts guide mode"
assert_mode "$HOST_INSTALL_STATE_PATH" "600" "host-artifacts install-state mode"
assert_mode "$HOST_SNIPPET_PATH" "600" "host-artifacts mcp mode"
assert_mode "$TMP_DIR/home-host-delegated/.clawperator" "700" "host-artifacts clawperator dir mode"

echo "=== Scenario 8: delegated host artifacts stay idempotent on rerun ==="
assert_occurrence_count "$HOST_ARTIFACTS_OUT" "Local AGENTS.md: skipped" "1" "host-artifacts rerun guide skipped"
assert_occurrence_count "$HOST_ARTIFACTS_OUT" "Install state: skipped" "1" "host-artifacts rerun install-state skipped"
assert_occurrence_count "$HOST_ARTIFACTS_OUT" "MCP config snippet: skipped" "1" "host-artifacts rerun mcp skipped"
assert_occurrence_count "$HOST_ARTIFACTS_OUT" "Shared agent bridge: skipped" "1" "host-artifacts rerun bridge skipped"
assert_equals "$(cat "$HOST_FIRST_BRIDGE")" "$(cat "$HOST_SHARED_PATH")" "host-artifacts rerun bridge content"

echo "=== Scenario 9: delegated host artifacts preserve non-fatal shared bridge failure semantics ==="
HOST_BRIDGE_FAIL_OUT="$TMP_DIR/host-bridge-fail.out"
HOST_BRIDGE_FAIL_STATUS="$TMP_DIR/host-bridge-fail.status"
HOST_BRIDGE_FAIL_CLI_LOG="$TMP_DIR/host-bridge-fail.cli.log"
HOST_BRIDGE_FAIL_GUIDE_FILE="$TMP_DIR/host-bridge-fail.guide.path"
HOST_BRIDGE_FAIL_STATE_FILE="$TMP_DIR/host-bridge-fail.state.path"
HOST_BRIDGE_FAIL_SNIPPET_FILE="$TMP_DIR/host-bridge-fail.mcp.path"
HOST_BRIDGE_FAIL_SHARED_FILE="$TMP_DIR/host-bridge-fail.shared.path"
HOST_BRIDGE_FAIL_FIRST="$TMP_DIR/host-bridge-fail.shared.first"
run_host_artifacts_case \
    bridge-fail \
    symlink \
    "$HOST_BRIDGE_FAIL_OUT" \
    "$HOST_BRIDGE_FAIL_STATUS" \
    "$HOST_BRIDGE_FAIL_CLI_LOG" \
    "$HOST_BRIDGE_FAIL_GUIDE_FILE" \
    "$HOST_BRIDGE_FAIL_STATE_FILE" \
    "$HOST_BRIDGE_FAIL_SNIPPET_FILE" \
    "$HOST_BRIDGE_FAIL_SHARED_FILE" \
    "$HOST_BRIDGE_FAIL_FIRST"
HOST_BRIDGE_FAIL_SHARED_PATH="$(cat "$HOST_BRIDGE_FAIL_SHARED_FILE")"
assert_contains "$HOST_BRIDGE_FAIL_STATUS" "first=0" "host-bridge-fail status"
assert_contains "$HOST_BRIDGE_FAIL_STATUS" "second=0" "host-bridge-fail status"
assert_contains "$HOST_BRIDGE_FAIL_OUT" "Shared agent bridge: failed" "host-bridge-fail output"
assert_contains "$HOST_BRIDGE_FAIL_OUT" "Host setup completed with a shared-agent bridge warning; continuing." "host-bridge-fail output"
if [ ! -L "$HOST_BRIDGE_FAIL_SHARED_PATH" ]; then
    echo "ERROR: host-bridge-fail should leave $HOST_BRIDGE_FAIL_SHARED_PATH as a symlink" >&2
    exit 1
fi
assert_equals "$(cat "$HOST_BRIDGE_FAIL_FIRST")" "$(cat "$HOST_BRIDGE_FAIL_SHARED_PATH")" "host-bridge-fail shared guide unchanged"

echo "=== Scenario 10: delegated host artifacts preserve env-only registry overrides ==="
HOST_ENV_REGISTRY_OUT="$TMP_DIR/host-env-registry.out"
HOST_ENV_REGISTRY_STATUS="$TMP_DIR/host-env-registry.status"
HOST_ENV_REGISTRY_CLI_LOG="$TMP_DIR/host-env-registry.cli.log"
HOST_ENV_REGISTRY_GUIDE_FILE="$TMP_DIR/host-env-registry.guide.path"
HOST_ENV_REGISTRY_STATE_FILE="$TMP_DIR/host-env-registry.state.path"
HOST_ENV_REGISTRY_PATH_FILE="$TMP_DIR/host-env-registry.registry.path"
run_host_artifacts_env_registry_case \
    env-registry \
    "$HOST_ENV_REGISTRY_OUT" \
    "$HOST_ENV_REGISTRY_STATUS" \
    "$HOST_ENV_REGISTRY_CLI_LOG" \
    "$HOST_ENV_REGISTRY_GUIDE_FILE" \
    "$HOST_ENV_REGISTRY_STATE_FILE" \
    "$HOST_ENV_REGISTRY_PATH_FILE"
HOST_ENV_REGISTRY_GUIDE_PATH="$(cat "$HOST_ENV_REGISTRY_GUIDE_FILE")"
HOST_ENV_REGISTRY_STATE_PATH="$(cat "$HOST_ENV_REGISTRY_STATE_FILE")"
HOST_ENV_REGISTRY_PATH="$(cat "$HOST_ENV_REGISTRY_PATH_FILE")"
assert_contains "$HOST_ENV_REGISTRY_STATUS" "first=0" "host-env-registry status"
assert_json_field_equals "$HOST_ENV_REGISTRY_STATE_PATH" "registryPath" "$HOST_ENV_REGISTRY_PATH" "host-env-registry install-state registryPath"
assert_contains "$HOST_ENV_REGISTRY_GUIDE_PATH" "$HOST_ENV_REGISTRY_PATH" "host-env-registry guide"

echo "=== Scenario 11: delegated host artifacts reject incomplete parsed results ==="
HOST_INCOMPLETE_OUT="$TMP_DIR/host-incomplete.out"
HOST_INCOMPLETE_STATUS="$TMP_DIR/host-incomplete.status"
HOST_INCOMPLETE_CLI_LOG="$TMP_DIR/host-incomplete.cli.log"
run_host_artifacts_incomplete_case \
    incomplete \
    "$HOST_INCOMPLETE_OUT" \
    "$HOST_INCOMPLETE_STATUS" \
    "$HOST_INCOMPLETE_CLI_LOG"
assert_contains "$HOST_INCOMPLETE_STATUS" "first=1" "host-incomplete status"
assert_contains "$HOST_INCOMPLETE_OUT" "Host setup via CLI returned incomplete artifact results." "host-incomplete output"

echo "=== Scenario 12: skip flag suppresses both runtime and bundled-skills setup ==="
SKIP_SKILLS_OUT="$TMP_DIR/skip-skills.out"
SKIP_BUNDLED_SKILLS_OUT="$TMP_DIR/skip-bundled-skills.out"
SKIP_STATUS="$TMP_DIR/skip.status"
SKIP_LOG="$TMP_DIR/skip.log"
touch "$SKIP_LOG"
run_skip_case "$SKIP_SKILLS_OUT" "$SKIP_BUNDLED_SKILLS_OUT" "$SKIP_STATUS" "$SKIP_LOG"
assert_contains "$SKIP_SKILLS_OUT" "Skipping skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1." "skip-skills"
assert_contains "$SKIP_BUNDLED_SKILLS_OUT" "Skipping bundled-skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1." "skip-bundled-skills"
assert_contains "$SKIP_STATUS" "skills=skipped" "skip-status"
assert_contains "$SKIP_STATUS" "bundled=skipped" "skip-status"
assert_equals "" "$(cat "$SKIP_LOG")" "skip command log"

echo "=== Scenario 13: durable summary points at local artifacts ==="
DURABLE_SUMMARY_OUT="$TMP_DIR/durable-summary.out"
run_durable_summary_case authoring "$DURABLE_SUMMARY_OUT"
assert_contains "$DURABLE_SUMMARY_OUT" "$TMP_DIR/home-summary-authoring/.clawperator/AGENTS.md" "durable-summary"
assert_contains "$DURABLE_SUMMARY_OUT" "$TMP_DIR/home-summary-authoring/.clawperator/install-state.json" "durable-summary"
assert_contains "$DURABLE_SUMMARY_OUT" "$TMP_DIR/home-summary-authoring/.clawperator/mcp-config-snippet.json" "durable-summary"
assert_contains "$DURABLE_SUMMARY_OUT" "AI agents should start with the local guide" "durable-summary"

echo "=== Scenario 12: operator metadata parser extracts all expected fields ==="
METADATA_SUCCESS_OUT="$TMP_DIR/metadata-success.out"
METADATA_SUCCESS_STATUS="$TMP_DIR/metadata-success.status"
METADATA_SUCCESS_VALUES="$TMP_DIR/metadata-success.values"
run_operator_metadata_case \
    metadata-success \
    '{"version":"0.6.1","apk_url":"https://example.com/operator.apk","sha256_url":"https://example.com/operator.apk.sha256","sha256":"deadbeef"}' \
    "$METADATA_SUCCESS_OUT" \
    "$METADATA_SUCCESS_STATUS" \
    "$METADATA_SUCCESS_VALUES"
assert_equals "0" "$(cat "$METADATA_SUCCESS_STATUS")" "metadata-success status"
assert_contains "$METADATA_SUCCESS_VALUES" "version=0.6.1" "metadata-success values"
assert_contains "$METADATA_SUCCESS_VALUES" "apk=https://example.com/operator.apk" "metadata-success values"
assert_contains "$METADATA_SUCCESS_VALUES" "sha_url=https://example.com/operator.apk.sha256" "metadata-success values"
assert_contains "$METADATA_SUCCESS_VALUES" "sha256=deadbeef" "metadata-success values"
assert_file_empty "$METADATA_SUCCESS_OUT" "metadata-success output"

echo "=== Scenario 13: operator metadata parser allows missing inline checksum ==="
METADATA_NO_SHA_OUT="$TMP_DIR/metadata-no-sha.out"
METADATA_NO_SHA_STATUS="$TMP_DIR/metadata-no-sha.status"
METADATA_NO_SHA_VALUES="$TMP_DIR/metadata-no-sha.values"
run_operator_metadata_case \
    metadata-no-sha \
    '{"version":"0.6.1","apk_url":"https://example.com/operator.apk","sha256_url":"https://example.com/operator.apk.sha256"}' \
    "$METADATA_NO_SHA_OUT" \
    "$METADATA_NO_SHA_STATUS" \
    "$METADATA_NO_SHA_VALUES"
assert_equals "0" "$(cat "$METADATA_NO_SHA_STATUS")" "metadata-no-sha status"
assert_contains "$METADATA_NO_SHA_VALUES" "sha256=" "metadata-no-sha values"
assert_file_empty "$METADATA_NO_SHA_OUT" "metadata-no-sha output"

echo "=== Scenario 14: operator metadata parser rejects missing required fields ==="
METADATA_MISSING_OUT="$TMP_DIR/metadata-missing.out"
METADATA_MISSING_STATUS="$TMP_DIR/metadata-missing.status"
METADATA_MISSING_VALUES="$TMP_DIR/metadata-missing.values"
run_operator_metadata_case \
    metadata-missing \
    '{"version":"0.6.1","apk_url":"https://example.com/operator.apk"}' \
    "$METADATA_MISSING_OUT" \
    "$METADATA_MISSING_STATUS" \
    "$METADATA_MISSING_VALUES"
assert_equals "1" "$(cat "$METADATA_MISSING_STATUS")" "metadata-missing status"
assert_contains "$METADATA_MISSING_OUT" "Failed to parse APK metadata" "metadata-missing output"

echo "=== Scenario 15: operator metadata parser rejects malformed JSON ==="
METADATA_BAD_OUT="$TMP_DIR/metadata-bad.out"
METADATA_BAD_STATUS="$TMP_DIR/metadata-bad.status"
METADATA_BAD_VALUES="$TMP_DIR/metadata-bad.values"
run_operator_metadata_case \
    metadata-bad \
    '{"version":' \
    "$METADATA_BAD_OUT" \
    "$METADATA_BAD_STATUS" \
    "$METADATA_BAD_VALUES"
assert_equals "1" "$(cat "$METADATA_BAD_STATUS")" "metadata-bad status"
assert_contains "$METADATA_BAD_OUT" "Failed to parse APK metadata" "metadata-bad output"

echo "=== install.sh bundled-skills and host-artifact harness passed ==="
