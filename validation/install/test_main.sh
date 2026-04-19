#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

REPO_ROOT="$(pwd)"
INSTALL_SCRIPT="$REPO_ROOT/sites/landing/public/install.sh"
SYSTEM_NODE_BIN_DIR="$(dirname "$(command -v node)")"
SYSTEM_PATH_BASE="$SYSTEM_NODE_BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
EXPECTED_NODE_BIN="$(node -p 'process.execPath')"

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

assert_exit_code() {
    local actual="$1"
    local expected="$2"
    local label="$3"
    if [ "$actual" -ne "$expected" ]; then
        echo "ERROR: $label expected exit code $expected, got $actual" >&2
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

setup_mock_clawperator() {
    local mock_dir="$1"
    local log_file="$2"

    mkdir -p "$mock_dir"
    cat > "$mock_dir/clawperator" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "\$*" >> "$log_file"

STATE_FILE="\${MOCK_MAIN_STATE_FILE:?}"
SCENARIO="\${MOCK_MAIN_SCENARIO:?}"

if [ "\$1" = "doctor" ] && [ "\$2" = "--format" ] && [ "\$3" = "json" ]; then
  count=0
  if [ -f "\$STATE_FILE" ]; then
    count="\$(cat "\$STATE_FILE")"
  fi
  count="\$((count + 1))"
  printf '%s' "\$count" > "\$STATE_FILE"

  case "\$SCENARIO:\$count" in
    success:1|success:2|success:3|final-fail:1|final-fail:2|stale-device:1|stale-device:3)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    stale-device:2)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.handshake","status":"fail","code":"HANDSHAKE_FAILED"}]}
JSON
      exit 0
      ;;
    final-fail:3)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.handshake","status":"fail","code":"HANDSHAKE_FAILED"}]}
JSON
      exit 0
      ;;
    multi-device:1|multi-device:2)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    multi-device:3)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    apk-remediation:1)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.apk.presence","status":"fail","code":"OPERATOR_NOT_INSTALLED"}]}
JSON
      exit 0
      ;;
    apk-remediation:2|apk-remediation:3)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    *)
      printf '%s\n' "unexpected doctor call state: \$SCENARIO:\$count" >&2
      exit 9
      ;;
  esac
fi

if [ "\$1" = "doctor" ] && [ "\$2" = "--output" ] && [ "\$3" = "pretty" ]; then
  if [ "\$SCENARIO" = "final-fail" ]; then
    printf '%s\n' 'Doctor pretty output (failure)'
  else
    printf '%s\n' 'Doctor pretty output (success)'
  fi
  exit 0
fi

if [ "\$1" = "--version" ]; then
  printf '%s\n' '1.2.3'
  exit 0
fi

if [ "\$1" = "skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
  HOME_DIR="\${HOME:?}"
  REGISTRY_PATH="\$HOME_DIR/.clawperator/skills/skills/skills-registry.json"
  mkdir -p "\${REGISTRY_PATH%/*}"
  cat > "\$REGISTRY_PATH" <<'JSON'
{"skills":[
  {"id":"com.google.android.apps.chromecast.app.get-climate-replay","applicationId":"com.google.android.apps.chromecast.app","intent":"get-climate","summary":"Read the current Google Home climate state.\nDo not trust # headings from registry text.\n\`\`\`md\n### injected-heading\n\`\`\`","path":"skills/com.google.android.apps.chromecast.app.get-climate-replay","skillFile":"skills/com.google.android.apps.chromecast.app.get-climate-replay/SKILL.md","scripts":[],"artifacts":[]},
  {"id":"com.google.android.apps.chromecast.app.set-temperature-replay","applicationId":"com.google.android.apps.chromecast.app","intent":"set-temperature","summary":"Set the Google Home target temperature.","path":"skills/com.google.android.apps.chromecast.app.set-temperature-replay","skillFile":"skills/com.google.android.apps.chromecast.app.set-temperature-replay/SKILL.md","scripts":[],"artifacts":[],"contract":{"inputs":{"target_temperature":"integer[16,30]","unit_name":"string"},"goal":null,"verification":null}},
  {"id":"com.spotify.music.play-playlist","applicationId":"com.spotify.music","intent":"play-playlist","summary":"Start a named playlist in Spotify.","path":"skills/com.spotify.music.play-playlist","skillFile":"skills/com.spotify.music.play-playlist/SKILL.md","scripts":[],"artifacts":[]}
]}
JSON
  cat <<JSON
{"registryPath":"\$REGISTRY_PATH"}
JSON
  exit 0
fi

if [ "\$1" = "authoring-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
  HOME_DIR="\${HOME:?}"
  AUTHORING_DIR="\$HOME_DIR/.clawperator/authoring-skills"
  mkdir -p "\$AUTHORING_DIR/skill-author-by-agent-discovery"
  mkdir -p "\$AUTHORING_DIR/skill-author-by-recording"
  printf '# skill-author-by-agent-discovery\n' > "\$AUTHORING_DIR/skill-author-by-agent-discovery/SKILL.md"
  printf '# skill-author-by-recording\n' > "\$AUTHORING_DIR/skill-author-by-recording/SKILL.md"
  printf '1.2.3\n' > "\$AUTHORING_DIR/version.txt"
  cat <<JSON
{"installedDir":"\$AUTHORING_DIR","agentDiscoveryDirs":[{"label":"claude","dir":"\$HOME_DIR/.claude/skills"},{"label":"codex","dir":"\$HOME_DIR/.codex/skills"},{"label":"agents","dir":"\$HOME_DIR/.agents/skills"}]}
JSON
  exit 0
fi

printf '%s\n' "unexpected mock clawperator invocation: \$*" >&2
exit 99
EOF
    chmod +x "$mock_dir/clawperator"
}

setup_mock_adb() {
    local mock_dir="$1"

    mkdir -p "$mock_dir"
    cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [ "$1" = "devices" ]; then
  case "${MOCK_MAIN_SCENARIO:-}" in
    multi-device)
      cat <<'OUT'
List of devices attached
serial-alpha	device
serial-beta	device
OUT
      ;;
    stale-device)
      cat <<'OUT'
List of devices attached
serial-solo	device
stale-emulator	offline
OUT
      ;;
    *)
      cat <<'OUT'
List of devices attached
serial-solo	device
OUT
      ;;
  esac
  exit 0
fi

printf '%s\n' "unexpected mock adb invocation: $*" >&2
exit 99
EOF
    chmod +x "$mock_dir/adb"
}

run_main_case() {
    local label="$1"
    local scenario="$2"
    local expected_exit="$3"
    local stdout_file="$4"
    local stderr_file="$5"
    local trace_file="$6"
    local cli_log_file="$7"
    local guide_path_file="$8"
    local state_file="$9"
    local mock_dir="$TMP_DIR/mock-$label"

    setup_mock_clawperator "$mock_dir" "$cli_log_file"
    setup_mock_adb "$mock_dir"
    : > "$cli_log_file"
    : > "$trace_file"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    PATH="$mock_dir:$SYSTEM_PATH_BASE" \
    MOCK_MAIN_STATE_FILE="$state_file" \
    MOCK_MAIN_SCENARIO="$scenario" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR

        trace() {
            printf "%s\n" "$1" >> "$2"
        }

        validate_os() { trace validate_os "$TRACE_FILE"; return 0; }
        check_java() { trace check_java "$TRACE_FILE"; return 0; }
        check_node() { trace check_node "$TRACE_FILE"; return 0; }
        check_curl() { trace check_curl "$TRACE_FILE"; return 0; }
        check_adb() { trace check_adb "$TRACE_FILE"; return 0; }
        check_git() { trace check_git "$TRACE_FILE"; return 0; }
        install_cli() {
            trace install_cli "$TRACE_FILE"
            export CLAWPERATOR_BIN_PATH="$MOCK_CLAWPERATOR_BIN"
            # Force the node-form MCP snippet path deterministically even on
            # hosts without a real global clawperator install. The file does
            # not need to exist; resolve_cli_entrypoint_js only forwards the
            # path, it does not execute it.
            export CLAWPERATOR_CLI_JS_PATH="$MOCK_CLAWPERATOR_BIN.cli.js"
            return 0
        }
        download_operator_apk() {
            trace download_operator_apk "$TRACE_FILE"
            mkdir -p "$(dirname "$APK_LOCAL_PATH")"
            printf "mock apk\n" > "$APK_LOCAL_PATH"
            printf "mock sha\n" > "$APK_SHA_PATH"
            OPERATOR_VERSION="9.9.9"
            echo "Mock download_operator_apk"
            return 0
        }
        verify_operator_apk() {
            trace verify_operator_apk "$TRACE_FILE"
            echo "Mock verify_operator_apk"
            return 0
        }
        maybe_install_operator_apk() {
            trace maybe_install_operator_apk "$TRACE_FILE"
            echo "Mock maybe_install_operator_apk"
            return 0
        }
        show_star_hint() { trace show_star_hint "$TRACE_FILE"; return 0; }

        export TRACE_FILE="$2"
        export MOCK_CLAWPERATOR_BIN="$3"

        set +e
        main > "$4" 2> "$5"
        status="$?"
        set -e

        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$6"
        printf "%s\n" "$status"
    ' _ "$INSTALL_SCRIPT" "$trace_file" "$mock_dir/clawperator" "$stdout_file" "$stderr_file" "$guide_path_file" > "$TMP_DIR/$label.status"

    local actual_exit
    actual_exit="$(cat "$TMP_DIR/$label.status")"
    assert_exit_code "$actual_exit" "$expected_exit" "$label"
}

run_stdin_entrypoint_case() {
    local stdout_file="$1"
    local stderr_file="$2"
    local status_file="$3"

    set +e
    cat "$INSTALL_SCRIPT" | OS=Plan9 bash >"$stdout_file" 2>"$stderr_file"
    local actual_exit=$?
    set -e

    printf '%s\n' "$actual_exit" > "$status_file"
}

echo "=== Scenario 1: main success path completes and writes summary ==="
SUCCESS_STDOUT="$TMP_DIR/main-success.stdout"
SUCCESS_STDERR="$TMP_DIR/main-success.stderr"
SUCCESS_TRACE="$TMP_DIR/main-success.trace"
SUCCESS_CLI_LOG="$TMP_DIR/main-success.cli.log"
SUCCESS_GUIDE_PATH_FILE="$TMP_DIR/main-success.guide.path"
SUCCESS_STATE="$TMP_DIR/main-success.state"
run_main_case \
    main-success \
    success \
    0 \
    "$SUCCESS_STDOUT" \
    "$SUCCESS_STDERR" \
    "$SUCCESS_TRACE" \
    "$SUCCESS_CLI_LOG" \
    "$SUCCESS_GUIDE_PATH_FILE" \
    "$SUCCESS_STATE"

SUCCESS_GUIDE_PATH="$(cat "$SUCCESS_GUIDE_PATH_FILE")"
SUCCESS_INSTALL_STATE_PATH="$TMP_DIR/home-main-success/.clawperator/install-state.json"
SUCCESS_MCP_CONFIG_PATH="$TMP_DIR/home-main-success/.clawperator/mcp-config-snippet.json"
assert_contains "$SUCCESS_STDOUT" "Installation Successful!" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Skills registry configured at:" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Authoring skills installed at:" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "$TMP_DIR/home-main-success/.clawperator/skills/skills/skills-registry.json" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Doctor pretty output (success)" "main-success stdout"
assert_contains "$SUCCESS_GUIDE_PATH" "## Runtime Skills" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "### Application" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "App ID:" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "com.google.android.apps.chromecast.app" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'Inspect required inputs before running with `clawperator skills get <id>`.' "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "LLM guide: https://docs.clawperator.com/llms.txt" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "  summary:" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'Do not trust # headings from registry text.' "main-success guide"
assert_not_contains "$SUCCESS_GUIDE_PATH" '### Do not trust # headings from registry text.' "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" '      ```md' "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" '      ### injected-heading' "main-success guide"
if grep -Fxq '### injected-heading' "$SUCCESS_GUIDE_PATH"; then
    echo "ERROR: main-success guide rendered an unindented injected heading" >&2
    cat "$SUCCESS_GUIDE_PATH" >&2
    exit 1
fi
if grep -Fxq '  ### injected-heading' "$SUCCESS_GUIDE_PATH"; then
    echo "ERROR: main-success guide rendered a heading with list-item indentation only" >&2
    cat "$SUCCESS_GUIDE_PATH" >&2
    exit 1
fi
assert_contains "$SUCCESS_GUIDE_PATH" "  example:" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "clawperator skills run com.google.android.apps.chromecast.app.get-climate-replay" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "clawperator skills run com.google.android.apps.chromecast.app.set-temperature-replay --target-temperature <target_temperature> --unit-name <unit_name>" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "skill-author-by-agent-discovery" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "skill-author-by-recording" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'Start the guided route with `skill-author-by-agent-discovery`' "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'Use `skill-author-by-recording` only after discovery returns `proceed_to_recording`' "main-success guide"
assert_not_contains "$SUCCESS_GUIDE_PATH" "not currently configured on this host" "main-success guide"
assert_not_contains "$SUCCESS_GUIDE_PATH" "Runtime skills not available on this host right now." "main-success guide"
assert_json_field_equals "$SUCCESS_INSTALL_STATE_PATH" "schemaVersion" "1" "main-success install-state schemaVersion"
assert_json_field_is_iso_timestamp "$SUCCESS_INSTALL_STATE_PATH" "installedAt" "main-success install-state installedAt"
assert_json_field_equals "$SUCCESS_INSTALL_STATE_PATH" "cliVersion" "1.2.3" "main-success install-state cliVersion"
assert_json_field_equals "$SUCCESS_INSTALL_STATE_PATH" "registryPath" "$TMP_DIR/home-main-success/.clawperator/skills/skills/skills-registry.json" "main-success install-state registryPath"
assert_json_field_equals "$SUCCESS_INSTALL_STATE_PATH" "apkVersion" "null" "main-success install-state apkVersion"
assert_json_field_equals "$SUCCESS_INSTALL_STATE_PATH" "lastDeviceSerial" "serial-solo" "main-success install-state lastDeviceSerial"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.command" "$EXPECTED_NODE_BIN" "main-success mcp claude command"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.args.0" "$TMP_DIR/mock-main-success/clawperator.cli.js" "main-success mcp claude args.0"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.args.1" "mcp" "main-success mcp claude args.1"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.args.2" "serve" "main-success mcp claude args.2"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.env.ADB_PATH" "$TMP_DIR/mock-main-success/adb" "main-success mcp claude env.ADB_PATH"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "notes.1" "Regenerate it with install.sh if the clawperator binary path or adb path changes." "main-success mcp notes.1"
assert_equals "mcp" "$(json_field_value "$SUCCESS_MCP_CONFIG_PATH" "genericStdioConsumer.server.args.1")" "main-success mcp helper direct call"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "genericStdioConsumer.server.args.2" "serve" "main-success mcp generic args.2"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "genericStdioConsumer.server.command" "$EXPECTED_NODE_BIN" "main-success mcp generic command"
assert_contains "$SUCCESS_MCP_CONFIG_PATH" '[mcp_servers.clawperator]' "main-success mcp codex entryToml"
assert_contains "$SUCCESS_STDOUT" "$TMP_DIR/home-main-success/.clawperator/AGENTS.md" "main-success stdout durable guide"
assert_contains "$SUCCESS_STDOUT" "$TMP_DIR/home-main-success/.clawperator/install-state.json" "main-success stdout durable install-state"
assert_contains "$SUCCESS_STDOUT" "$TMP_DIR/home-main-success/.clawperator/mcp-config-snippet.json" "main-success stdout durable mcp"
assert_contains "$SUCCESS_STDOUT" "AI agents should start with the local guide" "main-success stdout durable guidance"
assert_contains "$SUCCESS_STDOUT" "LLM guide:" "main-success stdout llm guide label"
assert_contains "$SUCCESS_STDOUT" "https://docs.clawperator.com/llms.txt" "main-success stdout llm guide url"
assert_mode "$SUCCESS_GUIDE_PATH" "600" "main-success guide mode"
assert_mode "$SUCCESS_INSTALL_STATE_PATH" "600" "main-success install-state mode"
assert_mode "$SUCCESS_MCP_CONFIG_PATH" "600" "main-success mcp mode"
assert_mode "$TMP_DIR/home-main-success/.clawperator" "700" "main-success clawperator dir mode"
if [ -e "$TMP_DIR/home-main-success/.agents/AGENTS.md" ]; then
    echo "ERROR: main-success should not create $TMP_DIR/home-main-success/.agents/AGENTS.md" >&2
    cat "$TMP_DIR/home-main-success/.agents/AGENTS.md" >&2
    exit 1
fi
assert_contains "$SUCCESS_TRACE" "validate_os" "main-success trace"
assert_contains "$SUCCESS_TRACE" "install_cli" "main-success trace"
assert_contains "$SUCCESS_TRACE" "show_star_hint" "main-success trace"
assert_contains "$SUCCESS_CLI_LOG" "doctor --format json" "main-success cli log"
assert_contains "$SUCCESS_CLI_LOG" "skills install --output json" "main-success cli log"
assert_contains "$SUCCESS_CLI_LOG" "authoring-skills install --output json" "main-success cli log"
assert_contains "$SUCCESS_CLI_LOG" "doctor --output pretty" "main-success cli log"

echo "=== Scenario 2: final doctor failure aborts after setup ==="
FAIL_STDOUT="$TMP_DIR/main-fail.stdout"
FAIL_STDERR="$TMP_DIR/main-fail.stderr"
FAIL_TRACE="$TMP_DIR/main-fail.trace"
FAIL_CLI_LOG="$TMP_DIR/main-fail.cli.log"
FAIL_GUIDE_PATH_FILE="$TMP_DIR/main-fail.guide.path"
FAIL_STATE="$TMP_DIR/main-fail.state"
run_main_case \
    main-fail \
    final-fail \
    1 \
    "$FAIL_STDOUT" \
    "$FAIL_STDERR" \
    "$FAIL_TRACE" \
    "$FAIL_CLI_LOG" \
    "$FAIL_GUIDE_PATH_FILE" \
    "$FAIL_STATE"

FAIL_GUIDE_PATH="$(cat "$FAIL_GUIDE_PATH_FILE")"
FAIL_INSTALL_STATE_PATH="$TMP_DIR/home-main-fail/.clawperator/install-state.json"
assert_contains "$FAIL_STDOUT" "Final doctor check failed." "main-fail stdout"
assert_contains "$FAIL_STDOUT" "Doctor pretty output (failure)" "main-fail stdout"
assert_not_contains "$FAIL_STDOUT" "Installation Successful!" "main-fail stdout"
assert_contains "$FAIL_STDOUT" "$TMP_DIR/home-main-fail/.clawperator/AGENTS.md" "main-fail stdout durable guide"
assert_contains "$FAIL_STDOUT" "$TMP_DIR/home-main-fail/.clawperator/install-state.json" "main-fail stdout durable install-state"
assert_contains "$FAIL_STDOUT" "$TMP_DIR/home-main-fail/.clawperator/mcp-config-snippet.json" "main-fail stdout durable mcp"
assert_contains "$FAIL_GUIDE_PATH" "App ID:" "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" "com.google.android.apps.chromecast.app" "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" "skill-author-by-agent-discovery" "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" "skill-author-by-recording" "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" 'Start the guided route with `skill-author-by-agent-discovery`' "main-fail guide"
assert_json_field_equals "$FAIL_INSTALL_STATE_PATH" "registryPath" "$TMP_DIR/home-main-fail/.clawperator/skills/skills/skills-registry.json" "main-fail install-state registryPath"
assert_json_field_equals "$FAIL_INSTALL_STATE_PATH" "lastDeviceSerial" "serial-solo" "main-fail install-state lastDeviceSerial"
assert_contains "$FAIL_CLI_LOG" "skills install --output json" "main-fail cli log"
assert_contains "$FAIL_CLI_LOG" "authoring-skills install --output json" "main-fail cli log"
assert_contains "$FAIL_CLI_LOG" "doctor --output pretty" "main-fail cli log"

echo "=== Scenario 3: final doctor multi-device path returns success with manual guidance ==="
MULTI_STDOUT="$TMP_DIR/main-multi.stdout"
MULTI_STDERR="$TMP_DIR/main-multi.stderr"
MULTI_TRACE="$TMP_DIR/main-multi.trace"
MULTI_CLI_LOG="$TMP_DIR/main-multi.cli.log"
MULTI_GUIDE_PATH_FILE="$TMP_DIR/main-multi.guide.path"
MULTI_STATE="$TMP_DIR/main-multi.state"
run_main_case \
    main-multi \
    multi-device \
    0 \
    "$MULTI_STDOUT" \
    "$MULTI_STDERR" \
    "$MULTI_TRACE" \
    "$MULTI_CLI_LOG" \
    "$MULTI_GUIDE_PATH_FILE" \
    "$MULTI_STATE"

assert_contains "$MULTI_STDOUT" "Installation Complete (Device Selection Required)" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "Host install completed, but Android setup is still pending because more than one device is connected." "main-multi stdout"
assert_contains "$MULTI_STDOUT" "clawperator doctor --device <device_id> --output pretty" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "clawperator operator setup --apk $TMP_DIR/home-main-multi/.clawperator/downloads/operator.apk --device serial-alpha" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "clawperator operator setup --apk $TMP_DIR/home-main-multi/.clawperator/downloads/operator.apk --device serial-beta" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "$TMP_DIR/home-main-multi/.clawperator/AGENTS.md" "main-multi stdout durable guide"
assert_contains "$MULTI_STDOUT" "$TMP_DIR/home-main-multi/.clawperator/install-state.json" "main-multi stdout durable install-state"
assert_contains "$MULTI_STDOUT" "$TMP_DIR/home-main-multi/.clawperator/mcp-config-snippet.json" "main-multi stdout durable mcp"
assert_not_contains "$MULTI_STDOUT" "Final doctor check failed." "main-multi stdout"
assert_not_contains "$MULTI_STDOUT" "Doctor pretty output" "main-multi stdout"
assert_json_field_null "$TMP_DIR/home-main-multi/.clawperator/install-state.json" "lastDeviceSerial" "main-multi install-state lastDeviceSerial"

echo "=== Scenario 4: APK remediation path runs before final success ==="
REMEDIATE_STDOUT="$TMP_DIR/main-remediation.stdout"
REMEDIATE_STDERR="$TMP_DIR/main-remediation.stderr"
REMEDIATE_TRACE="$TMP_DIR/main-remediation.trace"
REMEDIATE_CLI_LOG="$TMP_DIR/main-remediation.cli.log"
REMEDIATE_GUIDE_PATH_FILE="$TMP_DIR/main-remediation.guide.path"
REMEDIATE_STATE="$TMP_DIR/main-remediation.state"
run_main_case \
    main-remediation \
    apk-remediation \
    0 \
    "$REMEDIATE_STDOUT" \
    "$REMEDIATE_STDERR" \
    "$REMEDIATE_TRACE" \
    "$REMEDIATE_CLI_LOG" \
    "$REMEDIATE_GUIDE_PATH_FILE" \
    "$REMEDIATE_STATE"

REMEDIATE_INSTALL_STATE_PATH="$TMP_DIR/home-main-remediation/.clawperator/install-state.json"
assert_contains "$REMEDIATE_STDOUT" "Mock download_operator_apk" "main-remediation stdout"
assert_contains "$REMEDIATE_STDOUT" "Mock verify_operator_apk" "main-remediation stdout"
assert_contains "$REMEDIATE_STDOUT" "Mock maybe_install_operator_apk" "main-remediation stdout"
assert_contains "$REMEDIATE_STDOUT" "Installation Successful!" "main-remediation stdout"
assert_json_field_equals "$REMEDIATE_INSTALL_STATE_PATH" "apkVersion" "9.9.9" "main-remediation install-state apkVersion"
assert_contains "$REMEDIATE_TRACE" "download_operator_apk" "main-remediation trace"
assert_contains "$REMEDIATE_TRACE" "verify_operator_apk" "main-remediation trace"
assert_contains "$REMEDIATE_TRACE" "maybe_install_operator_apk" "main-remediation trace"
assert_contains "$REMEDIATE_CLI_LOG" "doctor --format json" "main-remediation cli log"
assert_contains "$REMEDIATE_CLI_LOG" "doctor --output pretty" "main-remediation cli log"

echo "=== Scenario 5: handshake recovery still targets the single ready device when stale adb entries exist ==="
STALE_STDOUT="$TMP_DIR/main-stale.stdout"
STALE_STDERR="$TMP_DIR/main-stale.stderr"
STALE_TRACE="$TMP_DIR/main-stale.trace"
STALE_CLI_LOG="$TMP_DIR/main-stale.cli.log"
STALE_GUIDE_PATH_FILE="$TMP_DIR/main-stale.guide.path"
STALE_STATE="$TMP_DIR/main-stale.state"
run_main_case \
    main-stale \
    stale-device \
    0 \
    "$STALE_STDOUT" \
    "$STALE_STDERR" \
    "$STALE_TRACE" \
    "$STALE_CLI_LOG" \
    "$STALE_GUIDE_PATH_FILE" \
    "$STALE_STATE"

STALE_INSTALL_STATE_PATH="$TMP_DIR/home-main-stale/.clawperator/install-state.json"
assert_contains "$STALE_STDOUT" "Installation Successful!" "main-stale stdout"
assert_contains "$STALE_CLI_LOG" "grant-device-permissions --device serial-solo --operator-package com.clawperator.operator" "main-stale cli log"
assert_json_field_equals "$STALE_INSTALL_STATE_PATH" "lastDeviceSerial" "serial-solo" "main-stale install-state lastDeviceSerial"

echo "=== Scenario 6: stdin entrypoint runs without BASH_SOURCE errors ==="
STDIN_STDOUT="$TMP_DIR/stdin.stdout"
STDIN_STDERR="$TMP_DIR/stdin.stderr"
STDIN_STATUS="$TMP_DIR/stdin.status"
run_stdin_entrypoint_case \
    "$STDIN_STDOUT" \
    "$STDIN_STDERR" \
    "$STDIN_STATUS"

assert_exit_code "$(cat "$STDIN_STATUS")" 1 "stdin-entrypoint"
assert_contains "$STDIN_STDOUT" "Unsupported OS: Plan9" "stdin-entrypoint stdout"
assert_not_contains "$STDIN_STDERR" "BASH_SOURCE[0]: unbound variable" "stdin-entrypoint stderr"

echo "=== install.sh main smoke harness passed ==="
