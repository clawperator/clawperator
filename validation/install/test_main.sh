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
    if ! grep -Fq -- "$needle" "$file"; then
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
    if grep -Fq -- "$needle" "$file"; then
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

case "\$*" in
  doctor\ --format\ json*|doctor\ --device\ *\ --format\ json*)
  count=0
  if [ -f "\$STATE_FILE" ]; then
    count="\$(cat "\$STATE_FILE")"
  fi
  count="\$((count + 1))"
  printf '%s' "\$count" > "\$STATE_FILE"

    case "\$SCENARIO:\$count" in
    success:1|success:2|success:3|final-fail:1|final-fail:2|stale-device:1|stale-device:2|stale-device:4)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    stale-device:3)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.handshake","status":"fail","code":"HANDSHAKE_FAILED"}]}
JSON
      exit 1
      ;;
    final-fail:3)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.handshake","status":"fail","code":"HANDSHAKE_FAILED"}]}
JSON
      exit 1
      ;;
    multi-device:1|multi-device:4|multi-device:5)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device:2|multi-device:3|multi-device:6|multi-device:7)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    multi-device-warning:1|multi-device-warning:4|multi-device-warning:5)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device-warning:2|multi-device-warning:6)
      printf '%s\n' 'sensitive doctor stderr from warning device' >&2
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"readiness.handshake","status":"warn","code":"HANDSHAKE_PERMISSION_ADVISORY"}]}
JSON
      exit 0
      ;;
    multi-device-warning:3|multi-device-warning:7)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    apk-remediation:1)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.apk.presence","status":"fail","code":"OPERATOR_NOT_INSTALLED"}]}
JSON
      exit 1
      ;;
    apk-remediation:2|apk-remediation:3)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    multi-device-mixed:1|multi-device-mixed:3|multi-device-mixed:4)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device-mixed:2|multi-device-mixed:5)
      printf '%s\n' 'sensitive doctor stderr from mixed-state device' >&2
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    multi-device-stale:1|multi-device-stale:4|multi-device-stale:5)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device-stale:2)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.version.compatibility","status":"fail","code":"VERSION_INCOMPATIBLE"}]}
JSON
      exit 1
      ;;
    multi-device-stale:3)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.apk.presence","status":"fail","code":"OPERATOR_NOT_INSTALLED"}]}
JSON
      exit 1
      ;;
    multi-device-stale:6|multi-device-stale:7)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    multi-device-stale-dev:1|multi-device-stale-dev:4|multi-device-stale-dev:5)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device-stale-dev:2)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.version.compatibility","status":"fail","code":"VERSION_INCOMPATIBLE"}]}
JSON
      exit 1
      ;;
    multi-device-stale-dev:3|multi-device-stale-dev:7)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    multi-device-stale-dev:6)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.version.compatibility","status":"fail","code":"VERSION_INCOMPATIBLE"}]}
JSON
      exit 1
      ;;
    multi-device-stale-probe:1|multi-device-stale-probe:4|multi-device-stale-probe:5)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device-stale-probe:2)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.version.compatibility","status":"fail","code":"VERSION_INCOMPATIBLE"}]}
JSON
      exit 1
      ;;
    multi-device-stale-probe:3|multi-device-stale-probe:7)
      printf '%s\n' 'not-json'
      exit 1
      ;;
    multi-device-stale-probe:6)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    multi-device-all-unready:1|multi-device-all-unready:2|multi-device-all-unready:3)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device-partial-fail:1|multi-device-partial-fail:4|multi-device-partial-fail:5)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device-partial-fail:2)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.version.compatibility","status":"fail","code":"VERSION_INCOMPATIBLE"}]}
JSON
      exit 1
      ;;
    multi-device-partial-fail:3)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.apk.presence","status":"fail","code":"OPERATOR_NOT_INSTALLED"}]}
JSON
      exit 1
      ;;
    multi-device-partial-fail:6)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
      exit 0
      ;;
    multi-device-partial-fail:7)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.version.compatibility","status":"fail","code":"VERSION_INCOMPATIBLE"}]}
JSON
      exit 1
      ;;
    *)
      printf '%s\n' "unexpected doctor call state: \$SCENARIO:\$count" >&2
      exit 9
      ;;
  esac
  ;;
esac

if [ "\$1" = "doctor" ] && [ "\$2" = "--output" ] && [ "\$3" = "pretty" ]; then
  if [ "\$SCENARIO" = "final-fail" ]; then
    printf '%s\n' 'Doctor pretty output (failure)'
  else
    printf '%s\n' 'Doctor pretty output (success)'
  fi
  exit 0
fi

if [ "\$1" = "operator" ] && [ "\$2" = "setup" ] && [ "\$3" = "--apk" ]; then
  case "\$SCENARIO:\$6" in
    multi-device-stale:serial-alpha)
      exit 0
      ;;
    multi-device-stale:serial-beta)
      exit 0
      ;;
    multi-device-stale-probe:serial-alpha)
      exit 0
      ;;
    multi-device-partial-fail:serial-alpha)
      exit 0
      ;;
    multi-device-partial-fail:serial-beta)
      printf '%s\n' "mock operator setup failed for serial-beta" >&2
      exit 1
      ;;
  esac
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

if [ "\$1" = "bundled-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
  HOME_DIR="\${HOME:?}"
  BUNDLED_SKILLS_DIR="\$HOME_DIR/.clawperator/bundled-skills"
  mkdir -p "\$BUNDLED_SKILLS_DIR/clawperator-agent-orientation"
  mkdir -p "\$BUNDLED_SKILLS_DIR/clawperator-upgrade"
  mkdir -p "\$BUNDLED_SKILLS_DIR/clawperator-skill-author-by-agent-discovery"
  mkdir -p "\$BUNDLED_SKILLS_DIR/clawperator-skill-author-by-recording"
  printf '# clawperator-agent-orientation\n' > "\$BUNDLED_SKILLS_DIR/clawperator-agent-orientation/SKILL.md"
  printf '# clawperator-upgrade\n' > "\$BUNDLED_SKILLS_DIR/clawperator-upgrade/SKILL.md"
  printf '# clawperator-skill-author-by-agent-discovery\n' > "\$BUNDLED_SKILLS_DIR/clawperator-skill-author-by-agent-discovery/SKILL.md"
  printf '# clawperator-skill-author-by-recording\n' > "\$BUNDLED_SKILLS_DIR/clawperator-skill-author-by-recording/SKILL.md"
  printf '1.2.3\n' > "\$BUNDLED_SKILLS_DIR/version.txt"
  cat <<JSON
{"installedDir":"\$BUNDLED_SKILLS_DIR","agentDiscoveryDirs":[{"label":"claude","dir":"\$HOME_DIR/.claude/skills"},{"label":"codex","dir":"\$HOME_DIR/.codex/skills"},{"label":"agents","dir":"\$HOME_DIR/.agents/skills"}]}
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
    multi-device-warning)
      cat <<'OUT'
List of devices attached
serial-warning	device
serial-ready	device
OUT
      ;;
    multi-device-mixed)
      cat <<'OUT'
List of devices attached
serial-ready	device
serial-unauthorized	unauthorized
serial-offline	offline
OUT
      ;;
    multi-device-stale)
      cat <<'OUT'
List of devices attached
serial-alpha	device
serial-beta	device
OUT
      ;;
    multi-device-stale-dev)
      cat <<'OUT'
List of devices attached
serial-alpha	device
serial-beta	device
OUT
      ;;
    multi-device-stale-probe)
      cat <<'OUT'
List of devices attached
serial-alpha	device
serial-bad	device
OUT
      ;;
    multi-device-all-unready)
      cat <<'OUT'
List of devices attached
serial-unauthorized	unauthorized
serial-offline	offline
OUT
      ;;
    multi-device-partial-fail)
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
    local operator_package="${10:-}"
    local real_install_helper="${11:-no}"
    local mock_dir="$TMP_DIR/mock-$label"

    setup_mock_clawperator "$mock_dir" "$cli_log_file"
    setup_mock_adb "$mock_dir"
    : > "$cli_log_file"
    : > "$trace_file"

    if [ -n "$operator_package" ]; then
        CLAWPERATOR_OPERATOR_PACKAGE="$operator_package" \
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
            if [ "$7" != "yes" ]; then
                maybe_install_operator_apk() {
                    trace maybe_install_operator_apk "$TRACE_FILE"
                    echo "Mock maybe_install_operator_apk"
                    return 0
                }
            fi
            show_star_hint() { trace show_star_hint "$TRACE_FILE"; return 0; }

            export TRACE_FILE="$2"
            export MOCK_CLAWPERATOR_BIN="$3"

            set +e
            main > "$4" 2> "$5"
            status="$?"
            set -e

            printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$6"
            printf "%s\n" "$status"
        ' _ "$INSTALL_SCRIPT" "$trace_file" "$mock_dir/clawperator" "$stdout_file" "$stderr_file" "$guide_path_file" "$real_install_helper" > "$TMP_DIR/$label.status"
    else
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
            if [ "$7" != "yes" ]; then
                maybe_install_operator_apk() {
                    trace maybe_install_operator_apk "$TRACE_FILE"
                    echo "Mock maybe_install_operator_apk"
                    return 0
                }
            fi
            show_star_hint() { trace show_star_hint "$TRACE_FILE"; return 0; }

            export TRACE_FILE="$2"
            export MOCK_CLAWPERATOR_BIN="$3"

            set +e
            main > "$4" 2> "$5"
            status="$?"
            set -e

            printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$6"
            printf "%s\n" "$status"
        ' _ "$INSTALL_SCRIPT" "$trace_file" "$mock_dir/clawperator" "$stdout_file" "$stderr_file" "$guide_path_file" "$real_install_helper" > "$TMP_DIR/$label.status"
    fi

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
assert_contains "$SUCCESS_STDOUT" "Bundled-skills installed at:" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Canonical stable APK URL (redownload this for later manual setup):" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "https://clawperator.com/operator.apk" "main-success stdout"
assert_not_contains "$SUCCESS_STDOUT" "https://clawperator.com/apk" "main-success stdout"
assert_not_contains "$SUCCESS_STDOUT" "https://clawperator.com/install.apk" "main-success stdout"
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
assert_contains "$SUCCESS_GUIDE_PATH" "clawperator-agent-orientation" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "clawperator-upgrade" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "clawperator-skill-author-by-agent-discovery" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "clawperator-skill-author-by-recording" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'start with `clawperator-agent-orientation`' "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'use `clawperator-upgrade`' "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'Choose one runtime-skill discovery probe' "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'Start the guided route with `clawperator-skill-author-by-agent-discovery`' "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" 'Use `clawperator-skill-author-by-recording` only after discovery returns `proceed_to_recording`' "main-success guide"
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
assert_contains "$SUCCESS_CLI_LOG" "bundled-skills install --output json" "main-success cli log"
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
assert_contains "$FAIL_GUIDE_PATH" "clawperator-agent-orientation" "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" "clawperator-upgrade" "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" "clawperator-skill-author-by-agent-discovery" "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" "clawperator-skill-author-by-recording" "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" 'Choose one runtime-skill discovery probe' "main-fail guide"
assert_contains "$FAIL_GUIDE_PATH" 'Start the guided route with `clawperator-skill-author-by-agent-discovery`' "main-fail guide"
assert_json_field_equals "$FAIL_INSTALL_STATE_PATH" "registryPath" "$TMP_DIR/home-main-fail/.clawperator/skills/skills/skills-registry.json" "main-fail install-state registryPath"
assert_json_field_equals "$FAIL_INSTALL_STATE_PATH" "lastDeviceSerial" "serial-solo" "main-fail install-state lastDeviceSerial"
assert_contains "$FAIL_CLI_LOG" "skills install --output json" "main-fail cli log"
assert_contains "$FAIL_CLI_LOG" "bundled-skills install --output json" "main-fail cli log"
assert_contains "$FAIL_CLI_LOG" "doctor --output pretty" "main-fail cli log"

echo "=== Scenario 3: final doctor multi-device path reports ready devices without fake pending setup ==="
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
assert_contains "$MULTI_STDOUT" "Checking each connected device with Clawperator Doctor..." "main-multi stdout"
assert_contains "$MULTI_STDOUT" "serial-alpha - ready" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "serial-beta - ready" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "each connected device passed Clawperator Doctor" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "clawperator doctor --device <device_id> --output pretty --operator-package com.clawperator.operator" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "$TMP_DIR/home-main-multi/.clawperator/AGENTS.md" "main-multi stdout durable guide"
assert_contains "$MULTI_STDOUT" "$TMP_DIR/home-main-multi/.clawperator/install-state.json" "main-multi stdout durable install-state"
assert_contains "$MULTI_STDOUT" "$TMP_DIR/home-main-multi/.clawperator/mcp-config-snippet.json" "main-multi stdout durable mcp"
assert_not_contains "$MULTI_STDOUT" "Final doctor check failed." "main-multi stdout"
assert_not_contains "$MULTI_STDOUT" "Doctor pretty output" "main-multi stdout"
assert_not_contains "$MULTI_STDOUT" "Host install completed, but Android setup is still pending because more than one device is connected." "main-multi stdout"
assert_not_contains "$MULTI_STDOUT" "clawperator operator setup --apk $TMP_DIR/home-main-multi/.clawperator/downloads/operator.apk --device serial-alpha" "main-multi stdout"
assert_not_contains "$MULTI_STDOUT" "clawperator operator setup --apk $TMP_DIR/home-main-multi/.clawperator/downloads/operator.apk --device serial-beta" "main-multi stdout"
assert_contains "$MULTI_CLI_LOG" "doctor --device serial-alpha --format json" "main-multi cli log"
assert_contains "$MULTI_CLI_LOG" "doctor --device serial-beta --format json" "main-multi cli log"
assert_json_field_null "$TMP_DIR/home-main-multi/.clawperator/install-state.json" "lastDeviceSerial" "main-multi install-state lastDeviceSerial"

echo "=== Scenario 4: final doctor multi-device path reports warnings honestly ==="
MULTI_WARN_STDOUT="$TMP_DIR/main-multi-warn.stdout"
MULTI_WARN_STDERR="$TMP_DIR/main-multi-warn.stderr"
MULTI_WARN_TRACE="$TMP_DIR/main-multi-warn.trace"
MULTI_WARN_CLI_LOG="$TMP_DIR/main-multi-warn.cli.log"
MULTI_WARN_GUIDE_PATH_FILE="$TMP_DIR/main-multi-warn.guide.path"
MULTI_WARN_STATE="$TMP_DIR/main-multi-warn.state"
run_main_case \
    main-multi-warn \
    multi-device-warning \
    0 \
    "$MULTI_WARN_STDOUT" \
    "$MULTI_WARN_STDERR" \
    "$MULTI_WARN_TRACE" \
    "$MULTI_WARN_CLI_LOG" \
    "$MULTI_WARN_GUIDE_PATH_FILE" \
    "$MULTI_WARN_STATE"

assert_contains "$MULTI_WARN_STDOUT" "Installation Complete (Device Selection Required)" "main-multi-warn stdout"
assert_contains "$MULTI_WARN_STDOUT" "critical checks passed; warnings remain." "main-multi-warn stdout"
assert_contains "$MULTI_WARN_STDOUT" "All connected devices passed critical checks." "main-multi-warn stdout"
assert_contains "$MULTI_WARN_STDOUT" "each connected device passed the critical doctor checks" "main-multi-warn stdout"
assert_contains "$MULTI_WARN_STDOUT" "serial-warning - critical checks passed; warnings remain." "main-multi-warn stdout"
assert_contains "$MULTI_WARN_STDOUT" "serial-ready - ready" "main-multi-warn stdout"
assert_not_contains "$MULTI_WARN_STDOUT" "serial-warning - ready" "main-multi-warn stdout"
assert_contains "$MULTI_WARN_CLI_LOG" "doctor --device serial-warning --format json" "main-multi-warn cli log"
assert_contains "$MULTI_WARN_CLI_LOG" "doctor --device serial-ready --format json" "main-multi-warn cli log"
assert_not_contains "$MULTI_WARN_STDERR" "sensitive doctor stderr from warning device" "main-multi-warn stderr"

echo "=== Scenario 5: multi-device path forwards the selected operator package and surfaces adb-state warnings ==="
MULTI_MIXED_STDOUT="$TMP_DIR/main-multi-mixed.stdout"
MULTI_MIXED_STDERR="$TMP_DIR/main-multi-mixed.stderr"
MULTI_MIXED_TRACE="$TMP_DIR/main-multi-mixed.trace"
MULTI_MIXED_CLI_LOG="$TMP_DIR/main-multi-mixed.cli.log"
MULTI_MIXED_GUIDE_PATH_FILE="$TMP_DIR/main-multi-mixed.guide.path"
MULTI_MIXED_STATE="$TMP_DIR/main-multi-mixed.state"
run_main_case \
    main-multi-mixed \
    multi-device-mixed \
    0 \
    "$MULTI_MIXED_STDOUT" \
    "$MULTI_MIXED_STDERR" \
    "$MULTI_MIXED_TRACE" \
    "$MULTI_MIXED_CLI_LOG" \
    "$MULTI_MIXED_GUIDE_PATH_FILE" \
    "$MULTI_MIXED_STATE" \
    "com.clawperator.operator.dev"

assert_contains "$MULTI_MIXED_STDOUT" "Installation Complete (Device Selection Required)" "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "serial-unauthorized - ADB state: unauthorized. Unlock the device or restart ADB before setup." "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "serial-offline - ADB state: offline. Unlock the device or restart ADB before setup." "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "serial-ready - ready" "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "each ready device passed Clawperator Doctor" "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "Resolve any ADB-state warnings above, then rerun install.sh or a device-specific doctor/setup command." "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "clawperator doctor --device <device_id> --output pretty --operator-package com.clawperator.operator.dev" "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_CLI_LOG" "doctor --format json --operator-package com.clawperator.operator.dev" "main-multi-mixed cli log"
assert_contains "$MULTI_MIXED_CLI_LOG" "doctor --device serial-ready --format json --operator-package com.clawperator.operator.dev" "main-multi-mixed cli log"
assert_not_contains "$MULTI_MIXED_STDERR" "sensitive doctor stderr from mixed-state device" "main-multi-mixed stderr"

echo "=== Scenario 6: all-unready multi-device path stays honest about ADB readiness ==="
MULTI_UNREADY_STDOUT="$TMP_DIR/main-multi-unready.stdout"
MULTI_UNREADY_STDERR="$TMP_DIR/main-multi-unready.stderr"
MULTI_UNREADY_TRACE="$TMP_DIR/main-multi-unready.trace"
MULTI_UNREADY_CLI_LOG="$TMP_DIR/main-multi-unready.cli.log"
MULTI_UNREADY_GUIDE_PATH_FILE="$TMP_DIR/main-multi-unready.guide.path"
MULTI_UNREADY_STATE="$TMP_DIR/main-multi-unready.state"
run_main_case \
    main-multi-unready \
    multi-device-all-unready \
    0 \
    "$MULTI_UNREADY_STDOUT" \
    "$MULTI_UNREADY_STDERR" \
    "$MULTI_UNREADY_TRACE" \
    "$MULTI_UNREADY_CLI_LOG" \
    "$MULTI_UNREADY_GUIDE_PATH_FILE" \
    "$MULTI_UNREADY_STATE"

assert_contains "$MULTI_UNREADY_STDOUT" "no connected device is ready for ADB yet" "main-multi-unready stdout"
assert_not_contains "$MULTI_UNREADY_STDOUT" "All ready devices already have the required APK." "main-multi-unready stdout"
assert_not_contains "$MULTI_UNREADY_STDOUT" "each ready device passed Clawperator Doctor" "main-multi-unready stdout"
assert_not_contains "$MULTI_UNREADY_STDOUT" "some devices still need setup" "main-multi-unready stdout"

echo "=== Scenario 7: multi-device stale APKs are remediated before final device-selection handoff ==="
MULTI_STALE_STDOUT="$TMP_DIR/main-multi-stale.stdout"
MULTI_STALE_STDERR="$TMP_DIR/main-multi-stale.stderr"
MULTI_STALE_TRACE="$TMP_DIR/main-multi-stale.trace"
MULTI_STALE_CLI_LOG="$TMP_DIR/main-multi-stale.cli.log"
MULTI_STALE_GUIDE_PATH_FILE="$TMP_DIR/main-multi-stale.guide.path"
MULTI_STALE_STATE="$TMP_DIR/main-multi-stale.state"
run_main_case \
    main-multi-stale \
    multi-device-stale \
    0 \
    "$MULTI_STALE_STDOUT" \
    "$MULTI_STALE_STDERR" \
    "$MULTI_STALE_TRACE" \
    "$MULTI_STALE_CLI_LOG" \
    "$MULTI_STALE_GUIDE_PATH_FILE" \
    "$MULTI_STALE_STATE" \
    "" \
    "yes"

assert_contains "$MULTI_STALE_STDOUT" "Mock download_operator_apk" "main-multi-stale stdout"
assert_contains "$MULTI_STALE_STDOUT" "Mock verify_operator_apk" "main-multi-stale stdout"
assert_contains "$MULTI_STALE_STDOUT" "Installing operator APK on serial-alpha..." "main-multi-stale stdout"
assert_contains "$MULTI_STALE_STDOUT" "Installing operator APK on serial-beta..." "main-multi-stale stdout"
assert_contains "$MULTI_STALE_STDOUT" "serial-alpha - operator APK installed and permissions granted." "main-multi-stale stdout"
assert_contains "$MULTI_STALE_STDOUT" "serial-beta - operator APK installed and permissions granted." "main-multi-stale stdout"
assert_contains "$MULTI_STALE_STDOUT" "Installation Complete (Device Selection Required)" "main-multi-stale stdout"
assert_contains "$MULTI_STALE_STDOUT" "serial-alpha - ready" "main-multi-stale stdout"
assert_contains "$MULTI_STALE_STDOUT" "serial-beta - ready" "main-multi-stale stdout"
assert_not_contains "$MULTI_STALE_STDOUT" "Host install completed, but Android setup is still pending because more than one device is connected." "main-multi-stale stdout"
assert_contains "$MULTI_STALE_TRACE" "download_operator_apk" "main-multi-stale trace"
assert_contains "$MULTI_STALE_TRACE" "verify_operator_apk" "main-multi-stale trace"
assert_contains "$MULTI_STALE_CLI_LOG" "operator setup --apk $TMP_DIR/home-main-multi-stale/.clawperator/downloads/operator.apk --device serial-alpha --operator-package com.clawperator.operator" "main-multi-stale cli log"
assert_contains "$MULTI_STALE_CLI_LOG" "operator setup --apk $TMP_DIR/home-main-multi-stale/.clawperator/downloads/operator.apk --device serial-beta --operator-package com.clawperator.operator" "main-multi-stale cli log"

echo "=== Scenario 8: dev-package stale devices stay on package-aware manual guidance ==="
MULTI_STALE_DEV_STDOUT="$TMP_DIR/main-multi-stale-dev.stdout"
MULTI_STALE_DEV_STDERR="$TMP_DIR/main-multi-stale-dev.stderr"
MULTI_STALE_DEV_TRACE="$TMP_DIR/main-multi-stale-dev.trace"
MULTI_STALE_DEV_CLI_LOG="$TMP_DIR/main-multi-stale-dev.cli.log"
MULTI_STALE_DEV_GUIDE_PATH_FILE="$TMP_DIR/main-multi-stale-dev.guide.path"
MULTI_STALE_DEV_STATE="$TMP_DIR/main-multi-stale-dev.state"
run_main_case \
    main-multi-stale-dev \
    multi-device-stale-dev \
    0 \
    "$MULTI_STALE_DEV_STDOUT" \
    "$MULTI_STALE_DEV_STDERR" \
    "$MULTI_STALE_DEV_TRACE" \
    "$MULTI_STALE_DEV_CLI_LOG" \
    "$MULTI_STALE_DEV_GUIDE_PATH_FILE" \
    "$MULTI_STALE_DEV_STATE" \
    "com.clawperator.operator.dev" \
    "yes"

assert_contains "$MULTI_STALE_DEV_STDOUT" "Automatic APK installation is only available for the stable release package. Complete setup manually for com.clawperator.operator.dev." "main-multi-stale-dev stdout"
assert_contains "$MULTI_STALE_DEV_STDOUT" "Use a matching local debug APK before manual setup:" "main-multi-stale-dev stdout"
assert_contains "$MULTI_STALE_DEV_STDOUT" "$TMP_DIR/home-main-multi-stale-dev/.clawperator/downloads/operator-debug.apk" "main-multi-stale-dev stdout"
assert_contains "$MULTI_STALE_DEV_STDOUT" "serial-alpha - setup required with a matching local debug APK at $TMP_DIR/home-main-multi-stale-dev/.clawperator/downloads/operator-debug.apk" "main-multi-stale-dev stdout"
assert_contains "$MULTI_STALE_DEV_STDOUT" "clawperator operator setup --apk '$TMP_DIR/home-main-multi-stale-dev/.clawperator/downloads/operator-debug.apk' --device 'serial-alpha' --operator-package com.clawperator.operator.dev" "main-multi-stale-dev stdout"
assert_contains "$MULTI_STALE_DEV_STDOUT" "serial-beta - ready" "main-multi-stale-dev stdout"
assert_not_contains "$MULTI_STALE_DEV_STDOUT" "Mock download_operator_apk" "main-multi-stale-dev stdout"
assert_not_contains "$MULTI_STALE_DEV_STDOUT" "Mock verify_operator_apk" "main-multi-stale-dev stdout"
assert_not_contains "$MULTI_STALE_DEV_STDOUT" "https://clawperator.com/operator.apk" "main-multi-stale-dev stdout"
assert_not_contains "$MULTI_STALE_DEV_CLI_LOG" "operator setup --apk $TMP_DIR/home-main-multi-stale-dev/.clawperator/downloads/operator-debug.apk --device serial-alpha --operator-package com.clawperator.operator.dev" "main-multi-stale-dev cli log"

echo "=== Scenario 9: probe failures do not block remediation for other stale ready devices ==="
MULTI_STALE_PROBE_STDOUT="$TMP_DIR/main-multi-stale-probe.stdout"
MULTI_STALE_PROBE_STDERR="$TMP_DIR/main-multi-stale-probe.stderr"
MULTI_STALE_PROBE_TRACE="$TMP_DIR/main-multi-stale-probe.trace"
MULTI_STALE_PROBE_CLI_LOG="$TMP_DIR/main-multi-stale-probe.cli.log"
MULTI_STALE_PROBE_GUIDE_PATH_FILE="$TMP_DIR/main-multi-stale-probe.guide.path"
MULTI_STALE_PROBE_STATE="$TMP_DIR/main-multi-stale-probe.state"
run_main_case \
    main-multi-stale-probe \
    multi-device-stale-probe \
    0 \
    "$MULTI_STALE_PROBE_STDOUT" \
    "$MULTI_STALE_PROBE_STDERR" \
    "$MULTI_STALE_PROBE_TRACE" \
    "$MULTI_STALE_PROBE_CLI_LOG" \
    "$MULTI_STALE_PROBE_GUIDE_PATH_FILE" \
    "$MULTI_STALE_PROBE_STATE" \
    "" \
    "yes"

assert_contains "$MULTI_STALE_PROBE_STDOUT" "Mock download_operator_apk" "main-multi-stale-probe stdout"
assert_contains "$MULTI_STALE_PROBE_STDOUT" "Mock verify_operator_apk" "main-multi-stale-probe stdout"
assert_contains "$MULTI_STALE_PROBE_STDOUT" "Installing operator APK on serial-alpha..." "main-multi-stale-probe stdout"
assert_contains "$MULTI_STALE_PROBE_STDOUT" "serial-alpha - operator APK installed and permissions granted." "main-multi-stale-probe stdout"
assert_contains "$MULTI_STALE_PROBE_STDOUT" "serial-bad - could not inspect this device with Clawperator Doctor." "main-multi-stale-probe stdout"
assert_contains "$MULTI_STALE_PROBE_STDOUT" "some devices could not be inspected with Clawperator Doctor" "main-multi-stale-probe stdout"
assert_not_contains "$MULTI_STALE_PROBE_STDOUT" "All ready devices passed doctor checks." "main-multi-stale-probe stdout"
assert_not_contains "$MULTI_STALE_PROBE_STDOUT" "each ready device passed Clawperator Doctor" "main-multi-stale-probe stdout"
assert_contains "$MULTI_STALE_PROBE_TRACE" "download_operator_apk" "main-multi-stale-probe trace"
assert_contains "$MULTI_STALE_PROBE_TRACE" "verify_operator_apk" "main-multi-stale-probe trace"
assert_contains "$MULTI_STALE_PROBE_CLI_LOG" "operator setup --apk $TMP_DIR/home-main-multi-stale-probe/.clawperator/downloads/operator.apk --device serial-alpha --operator-package com.clawperator.operator" "main-multi-stale-probe cli log"
assert_not_contains "$MULTI_STALE_PROBE_CLI_LOG" "operator setup --apk $TMP_DIR/home-main-multi-stale-probe/.clawperator/downloads/operator.apk --device serial-bad --operator-package com.clawperator.operator" "main-multi-stale-probe cli log"

echo "=== Scenario 10: APK remediation path runs before final success ==="
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

echo "=== Scenario 7: handshake recovery still targets the single ready device when stale adb entries exist ==="
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

echo "=== Scenario 11: stdin entrypoint runs without BASH_SOURCE errors ==="
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

echo "=== Scenario 12: partial multi-device install failure still runs final summary and exits nonzero ==="
PARTIAL_FAIL_STDOUT="$TMP_DIR/main-partial-fail.stdout"
PARTIAL_FAIL_STDERR="$TMP_DIR/main-partial-fail.stderr"
PARTIAL_FAIL_TRACE="$TMP_DIR/main-partial-fail.trace"
PARTIAL_FAIL_CLI_LOG="$TMP_DIR/main-partial-fail.cli.log"
PARTIAL_FAIL_GUIDE_PATH_FILE="$TMP_DIR/main-partial-fail.guide.path"
PARTIAL_FAIL_STATE="$TMP_DIR/main-partial-fail.state"
run_main_case \
    main-partial-fail \
    multi-device-partial-fail \
    1 \
    "$PARTIAL_FAIL_STDOUT" \
    "$PARTIAL_FAIL_STDERR" \
    "$PARTIAL_FAIL_TRACE" \
    "$PARTIAL_FAIL_CLI_LOG" \
    "$PARTIAL_FAIL_GUIDE_PATH_FILE" \
    "$PARTIAL_FAIL_STATE" \
    "" \
    "yes"

assert_contains "$PARTIAL_FAIL_STDOUT" "Mock download_operator_apk" "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_STDOUT" "Mock verify_operator_apk" "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_STDOUT" "Installing operator APK on serial-alpha..." "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_STDOUT" "Installing operator APK on serial-beta..." "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_STDOUT" "serial-alpha - ready" "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_STDOUT" "Installation Complete (Device Selection Required)" "main-partial-fail stdout"
assert_not_contains "$PARTIAL_FAIL_STDOUT" "Installation Successful!" "main-partial-fail stdout"

echo "=== install.sh main smoke harness passed ==="
