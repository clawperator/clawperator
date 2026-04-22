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

assert_command_fails() {
    local label="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        echo "ERROR: $label expected command to fail" >&2
        return 1
    fi
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
        printf "%s" "$2" | parse_agent_skills_install_result > "$3"
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
    if [ "\$1" = "agent-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
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
    if [ "\$1" = "agent-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
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
esac

exit 99
EOF
    chmod +x "$mock_dir/clawperator"
}

run_setup_agent_skills_case() {
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
        setup_agent_skills_via_cli > "$3"
        printf "%s\n" "$AGENT_SKILLS_SETUP_STATUS" > "$4"
        {
          printf "install=%s\n" "$AGENT_SKILLS_INSTALL_DIR"
          printf "claude=%s\n" "$AGENT_SKILLS_CLAUDE_DIR"
          printf "codex=%s\n" "$AGENT_SKILLS_CODEX_DIR"
          printf "agents=%s\n" "$AGENT_SKILLS_AGENTS_DIR"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_file" "$status_file" "$values_file"
}

run_guide_case() {
    local label="$1"
    local version_mode="$2"
    local runtime_mode="$3"
    local agent_skills_mode="$4"
    local output_file="$5"
    local guide_file="$6"

    AGENT_SKILLS_MODE="$agent_skills_mode" \
    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        unset CLAWPERATOR_SKILLS_REGISTRY
        unset SKILLS_REGISTRY_PATH
        unset SKILLS_SETUP_STATUS
        export AGENT_SKILLS_INSTALL_DIR="$HOME/.clawperator/agent-skills"
        if [ "$AGENT_SKILLS_MODE" = "complete" ]; then
          mkdir -p "$AGENT_SKILLS_INSTALL_DIR/clawperator-agent-orientation"
          mkdir -p "$AGENT_SKILLS_INSTALL_DIR/clawperator-upgrade"
          mkdir -p "$AGENT_SKILLS_INSTALL_DIR/clawperator-skill-author-by-agent-discovery"
          mkdir -p "$AGENT_SKILLS_INSTALL_DIR/clawperator-skill-author-by-recording"
          mkdir -p "$AGENT_SKILLS_INSTALL_DIR/skill-audit"
          printf "# clawperator-agent-orientation\n" > "$AGENT_SKILLS_INSTALL_DIR/clawperator-agent-orientation/SKILL.md"
          printf "# clawperator-upgrade\n" > "$AGENT_SKILLS_INSTALL_DIR/clawperator-upgrade/SKILL.md"
          printf "# clawperator-skill-author-by-agent-discovery\n" > "$AGENT_SKILLS_INSTALL_DIR/clawperator-skill-author-by-agent-discovery/SKILL.md"
          printf "# clawperator-skill-author-by-recording\n" > "$AGENT_SKILLS_INSTALL_DIR/clawperator-skill-author-by-recording/SKILL.md"
          printf "# skill-audit\n" > "$AGENT_SKILLS_INSTALL_DIR/skill-audit/SKILL.md"
        elif [ "$AGENT_SKILLS_MODE" = "recording-only" ]; then
          mkdir -p "$AGENT_SKILLS_INSTALL_DIR/clawperator-agent-orientation"
          mkdir -p "$AGENT_SKILLS_INSTALL_DIR/clawperator-skill-author-by-recording"
          mkdir -p "$AGENT_SKILLS_INSTALL_DIR/skill-audit"
          printf "# clawperator-agent-orientation\n" > "$AGENT_SKILLS_INSTALL_DIR/clawperator-agent-orientation/SKILL.md"
          printf "# clawperator-skill-author-by-recording\n" > "$AGENT_SKILLS_INSTALL_DIR/clawperator-skill-author-by-recording/SKILL.md"
          printf "# skill-audit\n" > "$AGENT_SKILLS_INSTALL_DIR/skill-audit/SKILL.md"
        else
          printf "unexpected agent-skills mode: %s\n" "$AGENT_SKILLS_MODE" >&2
          exit 1
        fi
        if [ "$2" = "with-version" ]; then
          printf "1.2.3\n" > "$AGENT_SKILLS_INSTALL_DIR/version.txt"
        fi
        if [ "$3" = "with-runtime-registry" ]; then
          mkdir -p "$HOME/.clawperator/skills/skills"
          cat > "$HOME/.clawperator/skills/skills/skills-registry.json" <<'\''JSON'\''
{"skills":[
  {"id":"com.google.android.apps.chromecast.app.get-climate-replay","applicationId":"com.google.android.apps.chromecast.app","intent":"get-climate","summary":"Read the current Google Home climate state.\nDo not trust # headings from registry text.\n```md\n### injected-heading\n```","path":"skills/com.google.android.apps.chromecast.app.get-climate-replay","skillFile":"skills/com.google.android.apps.chromecast.app.get-climate-replay/SKILL.md","scripts":[],"artifacts":[]},
  {"id":"com.google.android.apps.chromecast.app.set-temperature-replay","applicationId":"com.google.android.apps.chromecast.app","intent":"set-temperature","summary":"Set the Google Home target temperature.","path":"skills/com.google.android.apps.chromecast.app.set-temperature-replay","skillFile":"skills/com.google.android.apps.chromecast.app.set-temperature-replay/SKILL.md","scripts":[],"artifacts":[],"contract":{"inputs":{"target_temperature":"integer[16,30]","unit_name":"string"},"goal":null,"verification":null}},
  {"id":"com.spotify.music.play-playlist","applicationId":"com.spotify.music","intent":"play-playlist","summary":"Start a named playlist in Spotify.","path":"skills/com.spotify.music.play-playlist","skillFile":"skills/com.spotify.music.play-playlist/SKILL.md","scripts":[],"artifacts":[]}
]}
JSON
        elif [ "$3" = "with-configured-runtime-registry" ]; then
          export SKILLS_SETUP_STATUS="configured"
          export SKILLS_REGISTRY_PATH="$HOME/.clawperator/custom-runtime/skills-registry.json"
          mkdir -p "${SKILLS_REGISTRY_PATH%/*}"
          cat > "$SKILLS_REGISTRY_PATH" <<'\''JSON'\''
{"skills":[
  {"id":"com.google.android.apps.chromecast.app.get-climate-replay","applicationId":"com.google.android.apps.chromecast.app","intent":"get-climate","summary":"Read the current Google Home climate state from a configured registry path.","path":"skills/com.google.android.apps.chromecast.app.get-climate-replay","skillFile":"skills/com.google.android.apps.chromecast.app.get-climate-replay/SKILL.md","scripts":[],"artifacts":[]}
]}
JSON
        elif [ "$3" = "with-invalid-runtime-registry" ]; then
          mkdir -p "$HOME/.clawperator/skills/skills"
          printf "{\\"skills\\":" > "$HOME/.clawperator/skills/skills/skills-registry.json"
        elif [ "$3" = "with-env-runtime-registry" ]; then
          export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/env-runtime/skills-registry.json"
          mkdir -p "${CLAWPERATOR_SKILLS_REGISTRY%/*}"
          cat > "$CLAWPERATOR_SKILLS_REGISTRY" <<'\''JSON'\''
{"skills":[
  {"id":"com.google.android.apps.chromecast.app.get-climate-replay","applicationId":"com.google.android.apps.chromecast.app","intent":"get-climate","summary":"Read the current Google Home climate state from CLAWPERATOR_SKILLS_REGISTRY.","path":"skills/com.google.android.apps.chromecast.app.get-climate-replay","skillFile":"skills/com.google.android.apps.chromecast.app.get-climate-replay/SKILL.md","scripts":[],"artifacts":[]}
]}
JSON
        fi
        write_agent_guide > "$5"
        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$6"
    ' _ "$INSTALL_SCRIPT" "$version_mode" "$runtime_mode" "$agent_skills_mode" "$output_file" "$guide_file"
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
        unset CLAWPERATOR_SKILLS_REGISTRY
        unset SKILLS_REGISTRY_PATH
        unset SKILLS_SETUP_STATUS
        export AGENT_SKILLS_INSTALL_DIR="$HOME/.clawperator/nonexistent-agent-skills"
        write_agent_guide > "$2"
        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$3"
    ' _ "$INSTALL_SCRIPT" "$output_file" "$guide_file"
}

run_install_state_case() {
    local label="$1"
    local skills_setup_status="$2"
    local registry_path="$3"
    local apk_version="$4"
    local last_device_serial="$5"
    local output_file="$6"
    local state_file="$7"
    local mock_dir="$TMP_DIR/mock-state-$label"

    setup_mock_clawperator "$mock_dir" "success" '{}'

    HOME="$TMP_DIR/home-state-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        unset CLAWPERATOR_SKILLS_REGISTRY
        export CLAWPERATOR_BIN_PATH="$2"
        export SKILLS_SETUP_STATUS="$3"
        export SKILLS_REGISTRY_PATH="$4"
        export OPERATOR_VERSION="$5"
        export LAST_DEVICE_SERIAL="$6"
        if [ -n "$SKILLS_REGISTRY_PATH" ]; then
          mkdir -p "${SKILLS_REGISTRY_PATH%/*}"
          printf "%s\n" "{\"skills\":[]}" > "$SKILLS_REGISTRY_PATH"
        fi
        write_install_state > "$7"
        printf "%s\n" "$HOME/.clawperator/install-state.json" > "$8"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$skills_setup_status" "$registry_path" "$apk_version" "$last_device_serial" "$output_file" "$state_file"
}

run_install_state_with_previous_registry_case() {
    local label="$1"
    local previous_registry_path="$2"
    local output_file="$3"
    local state_file="$4"
    local mock_dir="$TMP_DIR/mock-state-previous-$label"

    setup_mock_clawperator "$mock_dir" "success" '{}'

    HOME="$TMP_DIR/home-state-previous-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        unset CLAWPERATOR_SKILLS_REGISTRY
        unset SKILLS_REGISTRY_PATH
        unset SKILLS_SETUP_STATUS
        export CLAWPERATOR_BIN_PATH="$2"
        mkdir -p "${3%/*}"
        mkdir -p "$HOME/.clawperator"
        printf "%s\n" "{\"schemaVersion\":1,\"installedAt\":\"2026-04-17T00:00:00Z\",\"cliVersion\":\"1.2.3\",\"registryPath\":\"$3\",\"apkVersion\":null,\"lastDeviceSerial\":null}" > "$HOME/.clawperator/install-state.json"
        write_install_state > "$4"
        printf "%s\n" "$HOME/.clawperator/install-state.json" > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$previous_registry_path" "$output_file" "$state_file"
}

run_install_state_version_banner_case() {
    local label="$1"
    local output_file="$2"
    local state_file="$3"
    local mock_dir="$TMP_DIR/mock-state-version-banner-$label"

    setup_mock_clawperator "$mock_dir" "version-banner" '{}'

    HOME="$TMP_DIR/home-state-version-banner-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        unset CLAWPERATOR_SKILLS_REGISTRY
        unset SKILLS_REGISTRY_PATH
        unset SKILLS_SETUP_STATUS
        export CLAWPERATOR_BIN_PATH="$2"
        write_install_state > "$3"
        printf "%s\n" "$HOME/.clawperator/install-state.json" > "$4"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_file" "$state_file"
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
        setup_agent_skills_via_cli > "$4"
        {
          printf "skills=%s\n" "$SKILLS_SETUP_STATUS"
          printf "agent=%s\n" "$AGENT_SKILLS_SETUP_STATUS"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_skills" "$output_agent_skills" "$status_file"
}

run_mcp_config_case() {
    local label="$1"
    local adb_mode="$2"
    local cli_js_mode="$3"
    local output_file="$4"
    local snippet_file="$5"
    local mock_dir="$TMP_DIR/mock-mcp-$label"
    local mock_cli_js="$mock_dir/clawperator-cli.js"

    setup_mock_clawperator "$mock_dir" "success" '{}'
    if [ "$adb_mode" = "with-adb" ]; then
        cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF
        chmod +x "$mock_dir/adb"
    fi

    # A non-empty placeholder JS file is enough: resolve_cli_entrypoint_js
    # only needs a path, it does not execute this file.
    printf '// mock cli entrypoint for tests\n' > "$mock_cli_js"

    local cli_js_value=""
    if [ "$cli_js_mode" = "with-cli-js" ]; then
        cli_js_value="$mock_cli_js"
    fi

    # For the without-adb case, use a narrow PATH that excludes the user's
    # shell PATH so adb lookup fails deterministically even on a developer
    # machine with adb installed elsewhere. node and mkdir come from the
    # mock_dir plus /usr/bin:/bin.
    local node_bin_dir
    node_bin_dir="$(dirname "$(command -v node)")"
    local mcp_path
    if [ "$adb_mode" = "with-adb" ]; then
        mcp_path="$mock_dir:$PATH"
    else
        mcp_path="$mock_dir:$node_bin_dir:/usr/bin:/bin"
    fi

    HOME="$TMP_DIR/home-mcp-$label" \
    OS=Linux \
    PATH="$mcp_path" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"
        export CLAWPERATOR_CLI_JS_PATH="$3"
        write_mcp_config_snippet > "$4"
        printf "%s\n" "$HOME/.clawperator/mcp-config-snippet.json" > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$cli_js_value" "$output_file" "$snippet_file"
}

run_resolve_cli_entrypoint_case() {
    local label="$1"
    local output_file="$2"
    local mock_dir="$TMP_DIR/mock-resolve-cli-$label"
    local cwd_dir="$TMP_DIR/cwd-resolve-cli-$label"
    local global_root="$TMP_DIR/global-root-resolve-cli-$label"
    local local_package_json="$cwd_dir/node_modules/clawperator/package.json"
    local global_package_json="$global_root/clawperator/package.json"
    local local_cli_js="$cwd_dir/node_modules/clawperator/dist/cli/index.js"
    local global_cli_js="$global_root/clawperator/dist/cli/index.js"
    local node_bin_dir

    node_bin_dir="$(dirname "$(command -v node)")"

    mkdir -p "$mock_dir" "${local_cli_js%/*}" "${global_cli_js%/*}"
    printf '%s\n' '{"name":"clawperator","version":"0.0.0-test"}' > "$local_package_json"
    printf '%s\n' '{"name":"clawperator","version":"0.0.0-test"}' > "$global_package_json"
    printf '%s\n' '// local cwd clawperator' > "$local_cli_js"
    printf '%s\n' '// global root clawperator' > "$global_cli_js"

    cat > "$mock_dir/npm" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "root" ] && [ "\${2:-}" = "-g" ]; then
  printf '%s\n' "$global_root"
  exit 0
fi
exit 99
EOF
    chmod +x "$mock_dir/npm"

    HOME="$TMP_DIR/home-resolve-cli-$label" \
    OS=Linux \
    PATH="$mock_dir:$node_bin_dir:/usr/bin:/bin" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        unset CLAWPERATOR_CLI_JS_PATH
        cd "$2"
        printf "%s\n" "$(resolve_cli_entrypoint_js)" > "$3"
    ' _ "$INSTALL_SCRIPT" "$cwd_dir" "$output_file"
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

run_shared_agent_bridge_case() {
    local label="$1"
    local shared_agents_mode="$2"
    local node_mode="$3"
    local output_file="$4"
    local shared_agents_file="$5"
    local first_snapshot_file="$6"

    HOME="$TMP_DIR/home-bridge-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        mkdir -p "$HOME/.clawperator"
        printf "# Clawperator local guide\n" > "$HOME/.clawperator/AGENTS.md"
        if [ "$2" = "existing" ]; then
          mkdir -p "$HOME/.agents"
          cat > "$HOME/.agents/AGENTS.md" <<'\''EOF_SHARED'\''
# Shared Agent Guide

Existing host guidance.
EOF_SHARED
        elif [ "$2" = "symlink" ]; then
          mkdir -p "$HOME/.agents"
          printf "%s\n" "# Shared Agent Guide" "" "Existing host guidance." > "$HOME/.agents/shared-target.md"
          ln -s "$HOME/.agents/shared-target.md" "$HOME/.agents/AGENTS.md"
        fi
        if [ "$3" = "fail-node" ]; then
          node() {
            printf "%s\n" "simulated shared bridge failure" >&2
            return 1
          }
        fi
        write_shared_agent_bridge > "$4" 2>&1
        if [ -f "$HOME/.agents/AGENTS.md" ]; then
          cp "$HOME/.agents/AGENTS.md" "$6"
        fi
        write_shared_agent_bridge >> "$4" 2>&1
        printf "%s\n" "$HOME/.agents/AGENTS.md" > "$5"
    ' _ "$INSTALL_SCRIPT" "$shared_agents_mode" "$node_mode" "$output_file" "$shared_agents_file" "$first_snapshot_file"
}

run_shared_agent_bridge_preservation_case() {
    local label="$1"
    local output_file="$2"
    local shared_agents_file="$3"
    local before_mode_file="$4"
    local expected_prefix_file="$5"

    HOME="$TMP_DIR/home-bridge-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        mkdir -p "$HOME/.clawperator" "$HOME/.agents"
        printf "# Clawperator local guide\n" > "$HOME/.clawperator/AGENTS.md"
        printf "# Shared Agent Guide\n\nExisting host guidance.   \n\n" > "$HOME/.agents/AGENTS.md"
        chmod 640 "$HOME/.agents/AGENTS.md"
        if stat -f "%Lp" "$HOME/.agents/AGENTS.md" >/dev/null 2>&1; then
          stat -f "%Lp" "$HOME/.agents/AGENTS.md" > "$4"
        else
          stat -c "%a" "$HOME/.agents/AGENTS.md" > "$4"
        fi
        printf "# Shared Agent Guide\n\nExisting host guidance.   \n\n" > "$5"
        write_shared_agent_bridge > "$2" 2>&1
        printf "%s\n" "$HOME/.agents/AGENTS.md" > "$3"
    ' _ "$INSTALL_SCRIPT" "$output_file" "$shared_agents_file" "$before_mode_file" "$expected_prefix_file"
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

echo "=== Scenario 3: agent-skills setup succeeds with explicit discovery dirs ==="
AGENT_SKILLS_SUCCESS_OUT="$TMP_DIR/agent-skills-success.out"
AGENT_SKILLS_SUCCESS_STATUS="$TMP_DIR/agent-skills-success.status"
AGENT_SKILLS_SUCCESS_VALUES="$TMP_DIR/agent-skills-success.values"
run_setup_agent_skills_case \
    agent-skills-success \
    success \
    '{"installedDir":"/custom/install","agentDiscoveryDirs":[{"label":"claude","dir":"/custom/claude"},{"label":"codex","dir":"/custom/codex"},{"label":"agents","dir":"/custom/agents"},{"label":"gemini","dir":"/custom/gemini"}]}' \
    "$AGENT_SKILLS_SUCCESS_OUT" \
    "$AGENT_SKILLS_SUCCESS_STATUS" \
    "$AGENT_SKILLS_SUCCESS_VALUES"
assert_equals "configured" "$(cat "$AGENT_SKILLS_SUCCESS_STATUS")" "agent-skills-success status"
assert_contains "$AGENT_SKILLS_SUCCESS_OUT" "Agent-skills setup complete." "agent-skills-success"
assert_contains "$AGENT_SKILLS_SUCCESS_VALUES" "install=/custom/install" "agent-skills-success values"
assert_contains "$AGENT_SKILLS_SUCCESS_VALUES" "claude=/custom/claude" "agent-skills-success values"
assert_contains "$AGENT_SKILLS_SUCCESS_VALUES" "codex=/custom/codex" "agent-skills-success values"
assert_contains "$AGENT_SKILLS_SUCCESS_VALUES" "agents=/custom/agents" "agent-skills-success values"

echo "=== Scenario 4: partial agent-skills JSON falls back to defaults ==="
AGENT_SKILLS_PARTIAL_OUT="$TMP_DIR/agent-skills-partial.out"
AGENT_SKILLS_PARTIAL_STATUS="$TMP_DIR/agent-skills-partial.status"
AGENT_SKILLS_PARTIAL_VALUES="$TMP_DIR/agent-skills-partial.values"
run_setup_agent_skills_case \
    agent-skills-partial \
    success \
    '{"installedDir":"/partial/install","agentDiscoveryDirs":[{"label":"claude","dir":"/partial/claude"}]}' \
    "$AGENT_SKILLS_PARTIAL_OUT" \
    "$AGENT_SKILLS_PARTIAL_STATUS" \
    "$AGENT_SKILLS_PARTIAL_VALUES"
assert_equals "configured" "$(cat "$AGENT_SKILLS_PARTIAL_STATUS")" "agent-skills-partial status"
assert_contains "$AGENT_SKILLS_PARTIAL_VALUES" "install=/partial/install" "agent-skills-partial values"
assert_contains "$AGENT_SKILLS_PARTIAL_VALUES" "claude=/partial/claude" "agent-skills-partial values"
assert_contains "$AGENT_SKILLS_PARTIAL_VALUES" "codex=$TMP_DIR/home-agent-skills-partial/.codex/skills/" "agent-skills-partial values"
assert_contains "$AGENT_SKILLS_PARTIAL_VALUES" "agents=$TMP_DIR/home-agent-skills-partial/.agents/skills/" "agent-skills-partial values"

echo "=== Scenario 5: CODEX_HOME fallback is used when codex dir is omitted ==="
AGENT_SKILLS_CODEX_HOME_OUT="$TMP_DIR/agent-skills-codex-home.out"
AGENT_SKILLS_CODEX_HOME_STATUS="$TMP_DIR/agent-skills-codex-home.status"
AGENT_SKILLS_CODEX_HOME_VALUES="$TMP_DIR/agent-skills-codex-home.values"
EXPECTED_CODEX_HOME_DIR="$TMP_DIR/home-agent-skills-codex-home/custom-codex-home/skills/"
run_setup_agent_skills_case \
    agent-skills-codex-home \
    success \
    '{"installedDir":"/codex-home/install","agentDiscoveryDirs":[{"label":"claude","dir":"/codex-home/claude"}]}' \
    "$AGENT_SKILLS_CODEX_HOME_OUT" \
    "$AGENT_SKILLS_CODEX_HOME_STATUS" \
    "$AGENT_SKILLS_CODEX_HOME_VALUES" \
    'export CODEX_HOME="$HOME/custom-codex-home"'
assert_equals "configured" "$(cat "$AGENT_SKILLS_CODEX_HOME_STATUS")" "agent-skills-codex-home status"
assert_contains "$AGENT_SKILLS_CODEX_HOME_VALUES" "codex=$EXPECTED_CODEX_HOME_DIR" "agent-skills-codex-home values"
assert_contains "$AGENT_SKILLS_CODEX_HOME_VALUES" "agents=$TMP_DIR/home-agent-skills-codex-home/.agents/skills/" "agent-skills-codex-home values"

echo "=== Scenario 6: agent-skills setup failure is non-fatal ==="
AGENT_SKILLS_FAILURE_OUT="$TMP_DIR/agent-skills-failure.out"
AGENT_SKILLS_FAILURE_STATUS="$TMP_DIR/agent-skills-failure.status"
AGENT_SKILLS_FAILURE_VALUES="$TMP_DIR/agent-skills-failure.values"
run_setup_agent_skills_case \
    agent-skills-failure \
    failure \
    'authoring install conflict' \
    "$AGENT_SKILLS_FAILURE_OUT" \
    "$AGENT_SKILLS_FAILURE_STATUS" \
    "$AGENT_SKILLS_FAILURE_VALUES"
assert_equals "failed" "$(cat "$AGENT_SKILLS_FAILURE_STATUS")" "agent-skills-failure status"
assert_contains "$AGENT_SKILLS_FAILURE_OUT" "Agent-skills setup failed via CLI." "agent-skills-failure"
assert_contains "$AGENT_SKILLS_FAILURE_OUT" "authoring install conflict" "agent-skills-failure"
assert_contains "$AGENT_SKILLS_FAILURE_VALUES" "install=$TMP_DIR/home-agent-skills-failure/.clawperator/agent-skills/" "agent-skills-failure values"

echo "=== Scenario 7: guide writer lists installed skills and refresh guidance ==="
GUIDE_OUT="$TMP_DIR/guide.out"
GUIDE_PATH_FILE="$TMP_DIR/guide.path"
run_guide_case guide-missing-version without-version with-runtime-registry complete "$GUIDE_OUT" "$GUIDE_PATH_FILE"
GUIDE_PATH="$(cat "$GUIDE_PATH_FILE")"
assert_contains "$GUIDE_OUT" "Wrote agent guide" "guide-missing-version"
assert_contains "$GUIDE_PATH" "## Runtime Skills" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "LLM guide: https://docs.clawperator.com/llms.txt" "guide-missing-version file"
assert_contains "$GUIDE_PATH" 'Inspect required inputs before running with `clawperator skills get <id>`.' "guide-missing-version file"
assert_contains "$GUIDE_PATH" "### Application" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "App ID:" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "com.google.android.apps.chromecast.app" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "  intent:" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "  summary:" "guide-missing-version file"
assert_contains "$GUIDE_PATH" 'Do not trust # headings from registry text.' "guide-missing-version file"
assert_not_contains "$GUIDE_PATH" '### Do not trust # headings from registry text.' "guide-missing-version file"
assert_contains "$GUIDE_PATH" '      ```md' "guide-missing-version file"
assert_contains "$GUIDE_PATH" '      ### injected-heading' "guide-missing-version file"
if grep -Fxq '### injected-heading' "$GUIDE_PATH"; then
    echo "ERROR: guide-missing-version file rendered an unindented injected heading" >&2
    cat "$GUIDE_PATH" >&2
    exit 1
fi
if grep -Fxq '  ### injected-heading' "$GUIDE_PATH"; then
    echo "ERROR: guide-missing-version file rendered a heading with list-item indentation only" >&2
    cat "$GUIDE_PATH" >&2
    exit 1
fi
assert_contains "$GUIDE_PATH" "  example:" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator skills run com.google.android.apps.chromecast.app.get-climate-replay" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator skills run com.google.android.apps.chromecast.app.set-temperature-replay --target-temperature <target_temperature> --unit-name <unit_name>" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "com.spotify.music" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator-agent-orientation" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator-upgrade" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator-skill-author-by-agent-discovery" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator-skill-author-by-recording" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "skill-audit" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "Recommended first-run flow:" "guide-missing-version file"
assert_contains "$GUIDE_PATH" 'start with `clawperator-agent-orientation`' "guide-missing-version file"
assert_contains "$GUIDE_PATH" 'use `clawperator-upgrade`' "guide-missing-version file"
assert_contains "$GUIDE_PATH" 'Choose one runtime-skill discovery probe' "guide-missing-version file"
assert_contains "$GUIDE_PATH" 'Start the guided route with `clawperator-skill-author-by-agent-discovery`' "guide-missing-version file"
assert_contains "$GUIDE_PATH" 'Use `clawperator-skill-author-by-recording` only after discovery returns `proceed_to_recording`' "guide-missing-version file"
assert_contains "$GUIDE_PATH" "Version metadata is missing for this install." "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator agent-skills update" "guide-missing-version file"

echo "=== Scenario 8: guide writer with version omits refresh guidance ==="
GUIDE_WITH_VERSION_OUT="$TMP_DIR/guide-with-version.out"
GUIDE_WITH_VERSION_PATH_FILE="$TMP_DIR/guide-with-version.path"
run_guide_case guide-with-version with-version with-runtime-registry complete "$GUIDE_WITH_VERSION_OUT" "$GUIDE_WITH_VERSION_PATH_FILE"
GUIDE_WITH_VERSION_PATH="$(cat "$GUIDE_WITH_VERSION_PATH_FILE")"
assert_contains "$GUIDE_WITH_VERSION_OUT" "Wrote agent guide" "guide-with-version"
assert_not_contains "$GUIDE_WITH_VERSION_PATH" "Runtime skills not available on this host right now." "guide-with-version file"
assert_contains "$GUIDE_WITH_VERSION_PATH" "clawperator-agent-orientation" "guide-with-version file"
assert_contains "$GUIDE_WITH_VERSION_PATH" "clawperator-upgrade" "guide-with-version file"
assert_contains "$GUIDE_WITH_VERSION_PATH" "clawperator-skill-author-by-agent-discovery" "guide-with-version file"
assert_contains "$GUIDE_WITH_VERSION_PATH" "clawperator-skill-author-by-recording" "guide-with-version file"
assert_contains "$GUIDE_WITH_VERSION_PATH" 'Choose one runtime-skill discovery probe' "guide-with-version file"
assert_contains "$GUIDE_WITH_VERSION_PATH" 'Start the guided route with `clawperator-skill-author-by-agent-discovery`' "guide-with-version file"
assert_not_contains "$GUIDE_WITH_VERSION_PATH" "Version metadata is missing for this install." "guide-with-version file"
assert_not_contains "$GUIDE_WITH_VERSION_PATH" "clawperator agent-skills update" "guide-with-version file"
assert_mode "$GUIDE_WITH_VERSION_PATH" "600" "guide-with-version mode"
assert_mode "$TMP_DIR/home-guide-with-version/.clawperator" "700" "guide-with-version dir mode"

echo "=== Scenario 8b: guide writer falls back when the discovery front door is missing ==="
GUIDE_PARTIAL_OUT="$TMP_DIR/guide-partial.out"
GUIDE_PARTIAL_PATH_FILE="$TMP_DIR/guide-partial.path"
run_guide_case guide-partial without-version with-runtime-registry recording-only "$GUIDE_PARTIAL_OUT" "$GUIDE_PARTIAL_PATH_FILE"
GUIDE_PARTIAL_PATH="$(cat "$GUIDE_PARTIAL_PATH_FILE")"
assert_contains "$GUIDE_PARTIAL_OUT" "Wrote agent guide" "guide-partial"
assert_contains "$GUIDE_PARTIAL_PATH" "clawperator-agent-orientation" "guide-partial file"
assert_not_contains "$GUIDE_PARTIAL_PATH" 'clawperator-skill-author-by-agent-discovery`: zero-results front door when' "guide-partial file"
assert_contains "$GUIDE_PARTIAL_PATH" "clawperator-skill-author-by-recording" "guide-partial file"
assert_contains "$GUIDE_PARTIAL_PATH" "Installed agent-skill front doors are incomplete on this host." "guide-partial file"
assert_contains "$GUIDE_PARTIAL_PATH" 'missing `clawperator-upgrade`' "guide-partial file"
assert_contains "$GUIDE_PARTIAL_PATH" 'missing `clawperator-skill-author-by-agent-discovery`' "guide-partial file"
assert_contains "$GUIDE_PARTIAL_PATH" "clawperator agent-skills update" "guide-partial file"
assert_contains "$GUIDE_PARTIAL_PATH" "Version metadata is missing for this install." "guide-partial file"
assert_not_contains "$GUIDE_PARTIAL_PATH" 'Start the guided route with `clawperator-skill-author-by-agent-discovery`' "guide-partial file"

echo "=== Scenario 9: guide writer prefers configured runtime registry path ==="
GUIDE_CONFIGURED_OUT="$TMP_DIR/guide-configured.out"
GUIDE_CONFIGURED_PATH_FILE="$TMP_DIR/guide-configured.path"
run_guide_case guide-configured without-version with-configured-runtime-registry complete "$GUIDE_CONFIGURED_OUT" "$GUIDE_CONFIGURED_PATH_FILE"
GUIDE_CONFIGURED_PATH="$(cat "$GUIDE_CONFIGURED_PATH_FILE")"
assert_contains "$GUIDE_CONFIGURED_OUT" "Wrote agent guide" "guide-configured"
assert_contains "$GUIDE_CONFIGURED_PATH" "$TMP_DIR/home-guide-configured/.clawperator/custom-runtime/skills-registry.json" "guide-configured file"
assert_contains "$GUIDE_CONFIGURED_PATH" "configured registry path." "guide-configured file"
assert_not_contains "$GUIDE_CONFIGURED_PATH" "Runtime skills not available on this host right now." "guide-configured file"

echo "=== Scenario 10: guide writer uses readable CLAWPERATOR_SKILLS_REGISTRY on rerun paths ==="
GUIDE_ENV_OUT="$TMP_DIR/guide-env.out"
GUIDE_ENV_PATH_FILE="$TMP_DIR/guide-env.path"
run_guide_case guide-env without-version with-env-runtime-registry complete "$GUIDE_ENV_OUT" "$GUIDE_ENV_PATH_FILE"
GUIDE_ENV_PATH="$(cat "$GUIDE_ENV_PATH_FILE")"
assert_contains "$GUIDE_ENV_OUT" "Wrote agent guide" "guide-env"
assert_contains "$GUIDE_ENV_PATH" "$TMP_DIR/home-guide-env/.clawperator/env-runtime/skills-registry.json" "guide-env file"
assert_contains "$GUIDE_ENV_PATH" "from CLAWPERATOR_SKILLS_REGISTRY." "guide-env file"
assert_not_contains "$GUIDE_ENV_PATH" "Runtime skills not available on this host right now." "guide-env file"

echo "=== Scenario 11: guide writer shows fallback when agent-skills are absent ==="
GUIDE_MISSING_OUT="$TMP_DIR/guide-missing.out"
GUIDE_MISSING_PATH_FILE="$TMP_DIR/guide-missing.path"
run_missing_guide_case guide-absent "$GUIDE_MISSING_OUT" "$GUIDE_MISSING_PATH_FILE"
GUIDE_MISSING_PATH="$(cat "$GUIDE_MISSING_PATH_FILE")"
assert_contains "$GUIDE_MISSING_PATH" "Runtime skills not available on this host right now." "guide-absent file"
assert_contains "$GUIDE_MISSING_PATH" "First-party Clawperator agent-skills are not currently configured on this host." "guide-absent file"
assert_contains "$GUIDE_MISSING_PATH" "clawperator-agent-orientation" "guide-absent file"
assert_contains "$GUIDE_MISSING_PATH" "clawperator-upgrade" "guide-absent file"
assert_contains "$GUIDE_MISSING_PATH" "clawperator agent-skills install" "guide-absent file"

echo "=== Scenario 12: guide writer degrades cleanly when runtime registry is unreadable ==="
GUIDE_INVALID_OUT="$TMP_DIR/guide-invalid.out"
GUIDE_INVALID_PATH_FILE="$TMP_DIR/guide-invalid.path"
run_guide_case guide-invalid-runtime without-version with-invalid-runtime-registry complete "$GUIDE_INVALID_OUT" "$GUIDE_INVALID_PATH_FILE"
GUIDE_INVALID_PATH="$(cat "$GUIDE_INVALID_PATH_FILE")"
assert_contains "$GUIDE_INVALID_OUT" "Wrote agent guide" "guide-invalid-runtime"
assert_contains "$GUIDE_INVALID_PATH" "Runtime skills not available on this host right now." "guide-invalid-runtime file"
assert_contains "$GUIDE_INVALID_PATH" "The registry exists but could not be read." "guide-invalid-runtime file"

echo "=== Scenario 13: install-state writer persists configured outputs ==="
INSTALL_STATE_FULL_OUT="$TMP_DIR/install-state-full.out"
INSTALL_STATE_FULL_PATH_FILE="$TMP_DIR/install-state-full.path"
run_install_state_case \
    configured \
    configured \
    "$TMP_DIR/runtime-registry.json" \
    "9.9.9" \
    "serial-123" \
    "$INSTALL_STATE_FULL_OUT" \
    "$INSTALL_STATE_FULL_PATH_FILE"
INSTALL_STATE_FULL_PATH="$(cat "$INSTALL_STATE_FULL_PATH_FILE")"
assert_contains "$INSTALL_STATE_FULL_OUT" "Wrote install state" "install-state-full"
assert_json_field_equals "$INSTALL_STATE_FULL_PATH" "schemaVersion" "1" "install-state-full schemaVersion"
assert_json_field_is_iso_timestamp "$INSTALL_STATE_FULL_PATH" "installedAt" "install-state-full installedAt"
assert_json_field_equals "$INSTALL_STATE_FULL_PATH" "cliVersion" "1.2.3" "install-state-full cliVersion"
assert_json_field_equals "$INSTALL_STATE_FULL_PATH" "registryPath" "$TMP_DIR/runtime-registry.json" "install-state-full registryPath"
assert_json_field_equals "$INSTALL_STATE_FULL_PATH" "apkVersion" "9.9.9" "install-state-full apkVersion"
assert_json_field_equals "$INSTALL_STATE_FULL_PATH" "lastDeviceSerial" "serial-123" "install-state-full lastDeviceSerial"
assert_mode "$INSTALL_STATE_FULL_PATH" "600" "install-state-full mode"

echo "=== Scenario 14: install-state writer preserves last known readable registry path on rerun ==="
PREVIOUS_REGISTRY_PATH="$TMP_DIR/previous-runtime/skills-registry.json"
mkdir -p "${PREVIOUS_REGISTRY_PATH%/*}"
printf '%s\n' '{"skills":[]}' > "$PREVIOUS_REGISTRY_PATH"
INSTALL_STATE_PREVIOUS_OUT="$TMP_DIR/install-state-previous.out"
INSTALL_STATE_PREVIOUS_PATH_FILE="$TMP_DIR/install-state-previous.path"
run_install_state_with_previous_registry_case \
    previous \
    "$PREVIOUS_REGISTRY_PATH" \
    "$INSTALL_STATE_PREVIOUS_OUT" \
    "$INSTALL_STATE_PREVIOUS_PATH_FILE"
INSTALL_STATE_PREVIOUS_PATH="$(cat "$INSTALL_STATE_PREVIOUS_PATH_FILE")"
assert_contains "$INSTALL_STATE_PREVIOUS_OUT" "Wrote install state" "install-state-previous"
assert_json_field_equals "$INSTALL_STATE_PREVIOUS_PATH" "registryPath" "$PREVIOUS_REGISTRY_PATH" "install-state-previous registryPath"

echo "=== Scenario 15: install-state writer preserves nullable fields ==="
INSTALL_STATE_NULL_OUT="$TMP_DIR/install-state-null.out"
INSTALL_STATE_NULL_PATH_FILE="$TMP_DIR/install-state-null.path"
run_install_state_case \
    nullable \
    failed \
    "" \
    "" \
    "" \
    "$INSTALL_STATE_NULL_OUT" \
    "$INSTALL_STATE_NULL_PATH_FILE"
INSTALL_STATE_NULL_PATH="$(cat "$INSTALL_STATE_NULL_PATH_FILE")"
assert_contains "$INSTALL_STATE_NULL_OUT" "Wrote install state" "install-state-null"
assert_json_field_equals "$INSTALL_STATE_NULL_PATH" "schemaVersion" "1" "install-state-null schemaVersion"
assert_json_field_is_iso_timestamp "$INSTALL_STATE_NULL_PATH" "installedAt" "install-state-null installedAt"
assert_json_field_equals "$INSTALL_STATE_NULL_PATH" "cliVersion" "1.2.3" "install-state-null cliVersion"
assert_json_field_null "$INSTALL_STATE_NULL_PATH" "registryPath" "install-state-null registryPath"
assert_json_field_null "$INSTALL_STATE_NULL_PATH" "apkVersion" "install-state-null apkVersion"
assert_json_field_null "$INSTALL_STATE_NULL_PATH" "lastDeviceSerial" "install-state-null lastDeviceSerial"

echo "=== Scenario 15b: install-state writer emits null cliVersion when CLI is unresolvable ==="
INSTALL_STATE_NO_CLI_OUT="$TMP_DIR/install-state-no-cli.out"
INSTALL_STATE_NO_CLI_PATH="$TMP_DIR/home-state-no-cli/.clawperator/install-state.json"
HOME="$TMP_DIR/home-state-no-cli" \
OS=Linux \
bash -c '
    source "$1" >/dev/null 2>&1
    trap - ERR
    unset CLAWPERATOR_SKILLS_REGISTRY
    unset SKILLS_REGISTRY_PATH
    unset SKILLS_SETUP_STATUS
    unset CLAWPERATOR_BIN_PATH
    write_install_state > "$2"
' _ "$INSTALL_SCRIPT" "$INSTALL_STATE_NO_CLI_OUT"
assert_contains "$INSTALL_STATE_NO_CLI_OUT" "Wrote install state" "install-state-no-cli output"
assert_json_field_equals "$INSTALL_STATE_NO_CLI_PATH" "schemaVersion" "1" "install-state-no-cli schemaVersion"
assert_json_field_is_iso_timestamp "$INSTALL_STATE_NO_CLI_PATH" "installedAt" "install-state-no-cli installedAt"
assert_json_field_null "$INSTALL_STATE_NO_CLI_PATH" "cliVersion" "install-state-no-cli cliVersion"

echo "=== Scenario 15c: install-state writer uses the last non-empty version line ==="
INSTALL_STATE_VERSION_BANNER_OUT="$TMP_DIR/install-state-version-banner.out"
INSTALL_STATE_VERSION_BANNER_PATH_FILE="$TMP_DIR/install-state-version-banner.path"
run_install_state_version_banner_case \
    version-banner \
    "$INSTALL_STATE_VERSION_BANNER_OUT" \
    "$INSTALL_STATE_VERSION_BANNER_PATH_FILE"
INSTALL_STATE_VERSION_BANNER_PATH="$(cat "$INSTALL_STATE_VERSION_BANNER_PATH_FILE")"
assert_contains "$INSTALL_STATE_VERSION_BANNER_OUT" "Wrote install state" "install-state-version-banner output"
assert_json_field_equals "$INSTALL_STATE_VERSION_BANNER_PATH" "cliVersion" "1.2.3" "install-state-version-banner cliVersion"

echo "=== Scenario 15d: ISO timestamp assertion rejects non-Z parseable timestamps ==="
NON_ISO_TIMESTAMP_JSON="$TMP_DIR/non-iso-timestamp.json"
cat > "$NON_ISO_TIMESTAMP_JSON" <<'EOF'
{"installedAt":"2026-04-17T10:11:12+10:00"}
EOF
assert_command_fails \
    "install-state timestamp format rejection" \
    assert_json_field_is_iso_timestamp "$NON_ISO_TIMESTAMP_JSON" "installedAt" "non-iso-timestamp"

echo "=== Scenario 16: skip flag suppresses both runtime and agent-skills setup ==="
SKIP_SKILLS_OUT="$TMP_DIR/skip-skills.out"
SKIP_AGENT_SKILLS_OUT="$TMP_DIR/skip-agent-skills.out"
SKIP_STATUS="$TMP_DIR/skip.status"
SKIP_LOG="$TMP_DIR/skip.log"
touch "$SKIP_LOG"
run_skip_case "$SKIP_SKILLS_OUT" "$SKIP_AGENT_SKILLS_OUT" "$SKIP_STATUS" "$SKIP_LOG"
assert_contains "$SKIP_SKILLS_OUT" "Skipping skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1." "skip-skills"
assert_contains "$SKIP_AGENT_SKILLS_OUT" "Skipping agent-skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1." "skip-agent-skills"
assert_contains "$SKIP_STATUS" "skills=skipped" "skip-status"
assert_contains "$SKIP_STATUS" "agent=skipped" "skip-status"
assert_equals "" "$(cat "$SKIP_LOG")" "skip command log"

echo "=== Scenario 17: MCP config writer emits paste-ready node-form snippet ==="
MCP_CONFIG_OUT="$TMP_DIR/mcp-config.out"
MCP_CONFIG_PATH_FILE="$TMP_DIR/mcp-config.path"
run_mcp_config_case authoring with-adb with-cli-js "$MCP_CONFIG_OUT" "$MCP_CONFIG_PATH_FILE"
MCP_CONFIG_PATH="$(cat "$MCP_CONFIG_PATH_FILE")"
MCP_CLI_JS_PATH="$TMP_DIR/mock-mcp-authoring/clawperator-cli.js"
assert_contains "$MCP_CONFIG_OUT" "Wrote MCP config snippet" "mcp-config"
assert_json_field_equals "$MCP_CONFIG_PATH" "claudeDesktop.mergeKey" "mcpServers" "mcp-config claude mergeKey"
assert_json_field_equals "$MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.command" "$EXPECTED_NODE_BIN" "mcp-config claude command"
assert_json_field_equals "$MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.args.0" "$MCP_CLI_JS_PATH" "mcp-config claude args.0"
assert_json_field_equals "$MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.args.1" "mcp" "mcp-config claude args.1"
assert_json_field_equals "$MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.args.2" "serve" "mcp-config claude args.2"
assert_json_field_equals "$MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.env.ADB_PATH" "$TMP_DIR/mock-mcp-authoring/adb" "mcp-config claude env.ADB_PATH"
assert_json_field_equals "$MCP_CONFIG_PATH" "codex.configPath" "$TMP_DIR/home-mcp-authoring/.codex/config.toml" "mcp-config codex configPath"
assert_json_field_equals "$MCP_CONFIG_PATH" "notes.0" "This snippet is generated for the current host." "mcp-config notes.0"
assert_equals "mcp" "$(json_field_value "$MCP_CONFIG_PATH" "genericStdioConsumer.server.args.1")" "mcp-config helper direct call"
assert_json_field_equals "$MCP_CONFIG_PATH" "genericStdioConsumer.server.args.2" "serve" "mcp-config generic args.2"
assert_contains "$MCP_CONFIG_PATH" '[mcp_servers.clawperator]' "mcp-config codex entryToml"
assert_contains "$MCP_CONFIG_PATH" "args = [\\\"$MCP_CLI_JS_PATH\\\", \\\"mcp\\\", \\\"serve\\\"]" "mcp-config codex entryToml"
assert_json_field_equals "$MCP_CONFIG_PATH" "genericStdioConsumer.serverName" "clawperator" "mcp-config generic serverName"
assert_json_field_equals "$MCP_CONFIG_PATH" "genericStdioConsumer.server.command" "$EXPECTED_NODE_BIN" "mcp-config generic command"
assert_not_contains "$MCP_CONFIG_PATH" "npm shell wrapper" "mcp-config no wrapper note when node-form resolved"
assert_not_contains "$MCP_CONFIG_PATH" "<set ADB_PATH" "mcp-config no adb placeholder when adb resolved"
assert_mode "$MCP_CONFIG_PATH" "600" "mcp-config mode"

echo "=== Scenario 17d: CLI entrypoint resolver prefers npm global root over cwd node_modules ==="
RESOLVE_CLI_ENTRYPOINT_OUT="$TMP_DIR/resolve-cli-entrypoint.out"
run_resolve_cli_entrypoint_case global-root "$RESOLVE_CLI_ENTRYPOINT_OUT"
assert_equals \
    "$TMP_DIR/global-root-resolve-cli-global-root/clawperator/dist/cli/index.js" \
    "$(cat "$RESOLVE_CLI_ENTRYPOINT_OUT")" \
    "resolve-cli-entrypoint global-root"

echo "=== Scenario 17b: MCP config writer falls back to npm wrapper when CLI JS unresolvable ==="
MCP_FALLBACK_OUT="$TMP_DIR/mcp-fallback.out"
MCP_FALLBACK_PATH_FILE="$TMP_DIR/mcp-fallback.path"
run_mcp_config_case fallback with-adb without-cli-js "$MCP_FALLBACK_OUT" "$MCP_FALLBACK_PATH_FILE"
MCP_FALLBACK_PATH="$(cat "$MCP_FALLBACK_PATH_FILE")"
assert_json_field_equals "$MCP_FALLBACK_PATH" "claudeDesktop.entry.clawperator.command" "$TMP_DIR/mock-mcp-fallback/clawperator" "mcp-fallback claude command"
assert_json_field_equals "$MCP_FALLBACK_PATH" "claudeDesktop.entry.clawperator.args.0" "mcp" "mcp-fallback claude args.0"
assert_json_field_equals "$MCP_FALLBACK_PATH" "claudeDesktop.entry.clawperator.args.1" "serve" "mcp-fallback claude args.1"
assert_contains "$MCP_FALLBACK_PATH" "npm shell wrapper" "mcp-fallback includes wrapper fallback note"
assert_contains "$MCP_FALLBACK_PATH" 'args = [\"mcp\", \"serve\"]' "mcp-fallback codex entryToml wrapper args"

echo "=== Scenario 17c: MCP config writer emits placeholder when adb is missing ==="
MCP_NOADB_OUT="$TMP_DIR/mcp-noadb.out"
MCP_NOADB_PATH_FILE="$TMP_DIR/mcp-noadb.path"
run_mcp_config_case noadb without-adb with-cli-js "$MCP_NOADB_OUT" "$MCP_NOADB_PATH_FILE"
MCP_NOADB_PATH="$(cat "$MCP_NOADB_PATH_FILE")"
assert_json_field_equals "$MCP_NOADB_PATH" "claudeDesktop.entry.clawperator.env.ADB_PATH" "<set ADB_PATH to your adb binary>" "mcp-noadb claude env.ADB_PATH placeholder"
assert_contains "$MCP_NOADB_PATH" "adb was not found on PATH" "mcp-noadb includes adb note"

echo "=== Scenario 18: durable summary points at local artifacts ==="
DURABLE_SUMMARY_OUT="$TMP_DIR/durable-summary.out"
run_durable_summary_case authoring "$DURABLE_SUMMARY_OUT"
assert_contains "$DURABLE_SUMMARY_OUT" "$TMP_DIR/home-summary-authoring/.clawperator/AGENTS.md" "durable-summary"
assert_contains "$DURABLE_SUMMARY_OUT" "$TMP_DIR/home-summary-authoring/.clawperator/install-state.json" "durable-summary"
assert_contains "$DURABLE_SUMMARY_OUT" "$TMP_DIR/home-summary-authoring/.clawperator/mcp-config-snippet.json" "durable-summary"
assert_contains "$DURABLE_SUMMARY_OUT" "AI agents should start with the local guide" "durable-summary"

echo "=== Scenario 19: shared agent bridge appends once and stays bounded ==="
BRIDGE_EXISTING_OUT="$TMP_DIR/bridge-existing.out"
BRIDGE_EXISTING_PATH_FILE="$TMP_DIR/bridge-existing.path"
BRIDGE_EXISTING_FIRST="$TMP_DIR/bridge-existing.first"
run_shared_agent_bridge_case existing existing ok "$BRIDGE_EXISTING_OUT" "$BRIDGE_EXISTING_PATH_FILE" "$BRIDGE_EXISTING_FIRST"
BRIDGE_EXISTING_PATH="$(cat "$BRIDGE_EXISTING_PATH_FILE")"
assert_contains "$BRIDGE_EXISTING_OUT" "Updated shared agent guide bridge" "bridge-existing output"
assert_contains "$BRIDGE_EXISTING_PATH" "# Shared Agent Guide" "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" "Existing host guidance." "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:START -->" "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:END -->" "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" "$TMP_DIR/home-bridge-existing/.clawperator/AGENTS.md" "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" 'start with `clawperator-agent-orientation`' "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" 'clawperator skills for-app <package_id>' "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" 'clawperator skills search --keyword "<term>"' "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" 'clawperator skills get <skill_id>' "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" 'Do not mirror them into shared agent skill directories.' "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" 'follow the local guide for the agent-skill front doors installed on this host.' "bridge-existing file"
assert_contains "$BRIDGE_EXISTING_PATH" 'Confirm the local guide lists `clawperator-agent-orientation`, `clawperator-upgrade`, `clawperator-skill-author-by-agent-discovery`, and `clawperator-skill-author-by-recording` before starting the discovery-to-proving route.' "bridge-existing file"
assert_not_contains "$BRIDGE_EXISTING_PATH" "### Application" "bridge-existing file"
assert_occurrence_count "$BRIDGE_EXISTING_PATH" "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:START -->" "1" "bridge-existing start marker count"
assert_occurrence_count "$BRIDGE_EXISTING_PATH" "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:END -->" "1" "bridge-existing end marker count"
assert_equals "$(cat "$BRIDGE_EXISTING_FIRST")" "$(cat "$BRIDGE_EXISTING_PATH")" "bridge-existing idempotent rerun"

echo "=== Scenario 19b: shared agent bridge preserves file mode and trailing whitespace ==="
BRIDGE_PRESERVE_OUT="$TMP_DIR/bridge-preserve.out"
BRIDGE_PRESERVE_PATH_FILE="$TMP_DIR/bridge-preserve.path"
BRIDGE_PRESERVE_MODE_BEFORE="$TMP_DIR/bridge-preserve.mode-before"
BRIDGE_PRESERVE_PREFIX="$TMP_DIR/bridge-preserve.prefix"
run_shared_agent_bridge_preservation_case \
    preserve \
    "$BRIDGE_PRESERVE_OUT" \
    "$BRIDGE_PRESERVE_PATH_FILE" \
    "$BRIDGE_PRESERVE_MODE_BEFORE" \
    "$BRIDGE_PRESERVE_PREFIX"
BRIDGE_PRESERVE_PATH="$(cat "$BRIDGE_PRESERVE_PATH_FILE")"
assert_contains "$BRIDGE_PRESERVE_OUT" "Updated shared agent guide bridge" "bridge-preserve output"
assert_mode "$BRIDGE_PRESERVE_PATH" "$(cat "$BRIDGE_PRESERVE_MODE_BEFORE")" "bridge-preserve mode"
python - "$BRIDGE_PRESERVE_PATH" "$BRIDGE_PRESERVE_PREFIX" <<'PY'
from pathlib import Path
import sys

actual = Path(sys.argv[1]).read_text()
expected_prefix = Path(sys.argv[2]).read_text()
if not actual.startswith(expected_prefix):
    raise SystemExit("bridge-preserve prefix changed unexpectedly")
PY

echo "=== Scenario 20: shared agent bridge skips missing shared guide ==="
BRIDGE_MISSING_OUT="$TMP_DIR/bridge-missing.out"
BRIDGE_MISSING_PATH_FILE="$TMP_DIR/bridge-missing.path"
BRIDGE_MISSING_FIRST="$TMP_DIR/bridge-missing.first"
run_shared_agent_bridge_case missing absent ok "$BRIDGE_MISSING_OUT" "$BRIDGE_MISSING_PATH_FILE" "$BRIDGE_MISSING_FIRST"
BRIDGE_MISSING_PATH="$(cat "$BRIDGE_MISSING_PATH_FILE")"
assert_contains "$BRIDGE_MISSING_OUT" "Shared agent guide not found" "bridge-missing output"
if [ -e "$BRIDGE_MISSING_PATH" ]; then
    echo "ERROR: bridge-missing should not create $BRIDGE_MISSING_PATH" >&2
    cat "$BRIDGE_MISSING_PATH" >&2
    exit 1
fi
if [ -e "$BRIDGE_MISSING_FIRST" ]; then
    echo "ERROR: bridge-missing should not create first-run snapshot $BRIDGE_MISSING_FIRST" >&2
    exit 1
fi

echo "=== Scenario 21: shared agent bridge failure is non-fatal ==="
BRIDGE_FAILURE_OUT="$TMP_DIR/bridge-failure.out"
BRIDGE_FAILURE_PATH_FILE="$TMP_DIR/bridge-failure.path"
BRIDGE_FAILURE_FIRST="$TMP_DIR/bridge-failure.first"
run_shared_agent_bridge_case bridge-failure existing fail-node "$BRIDGE_FAILURE_OUT" "$BRIDGE_FAILURE_PATH_FILE" "$BRIDGE_FAILURE_FIRST"
BRIDGE_FAILURE_PATH="$(cat "$BRIDGE_FAILURE_PATH_FILE")"
assert_contains "$BRIDGE_FAILURE_OUT" "Failed to update shared agent bridge" "bridge-failure output"
assert_contains "$BRIDGE_FAILURE_OUT" "simulated shared bridge failure" "bridge-failure output"
assert_contains "$BRIDGE_FAILURE_PATH" "# Shared Agent Guide" "bridge-failure file"
assert_contains "$BRIDGE_FAILURE_PATH" "Existing host guidance." "bridge-failure file"
assert_not_contains "$BRIDGE_FAILURE_PATH" "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:START -->" "bridge-failure file"
assert_not_contains "$BRIDGE_FAILURE_PATH" "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:END -->" "bridge-failure file"
assert_equals "$(cat "$BRIDGE_FAILURE_FIRST")" "$(cat "$BRIDGE_FAILURE_PATH")" "bridge-failure leaves shared guide unchanged"

echo "=== Scenario 22: shared agent bridge refuses symlink targets ==="
BRIDGE_SYMLINK_OUT="$TMP_DIR/bridge-symlink.out"
BRIDGE_SYMLINK_PATH_FILE="$TMP_DIR/bridge-symlink.path"
BRIDGE_SYMLINK_FIRST="$TMP_DIR/bridge-symlink.first"
run_shared_agent_bridge_case bridge-symlink symlink ok "$BRIDGE_SYMLINK_OUT" "$BRIDGE_SYMLINK_PATH_FILE" "$BRIDGE_SYMLINK_FIRST"
BRIDGE_SYMLINK_PATH="$(cat "$BRIDGE_SYMLINK_PATH_FILE")"
assert_contains "$BRIDGE_SYMLINK_OUT" "Failed to update shared agent bridge" "bridge-symlink output"
assert_contains "$BRIDGE_SYMLINK_OUT" "must be a regular file" "bridge-symlink output"
if [ ! -L "$BRIDGE_SYMLINK_PATH" ]; then
    echo "ERROR: bridge-symlink should leave $BRIDGE_SYMLINK_PATH as a symlink" >&2
    exit 1
fi
assert_equals "$(cat "$BRIDGE_SYMLINK_FIRST")" "$(cat "$BRIDGE_SYMLINK_PATH")" "bridge-symlink leaves target unchanged"
assert_not_contains "$BRIDGE_SYMLINK_PATH" "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:START -->" "bridge-symlink file"

echo "=== Scenario 23: operator metadata parser extracts all expected fields ==="
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

echo "=== Scenario 24: operator metadata parser allows missing inline checksum ==="
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

echo "=== Scenario 25: operator metadata parser rejects missing required fields ==="
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

echo "=== Scenario 26: operator metadata parser rejects malformed JSON ==="
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

echo "=== install.sh agent-skills harness passed ==="
