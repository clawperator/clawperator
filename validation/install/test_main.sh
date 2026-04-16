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
    success:1|success:2|success:3|final-fail:1|final-fail:2)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
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

if [ "\$1" = "skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
  cat <<'JSON'
{"registryPath":"/tmp/mock-skills-registry.json"}
JSON
  exit 0
fi

if [ "\$1" = "authoring-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
  HOME_DIR="\${HOME:?}"
  AUTHORING_DIR="\$HOME_DIR/.clawperator/authoring-skills"
  mkdir -p "\$AUTHORING_DIR/skill-author-by-recording"
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
    PATH="$mock_dir:$PATH" \
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
assert_contains "$SUCCESS_STDOUT" "Installation Successful!" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Skills registry configured at:" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Authoring skills installed at:" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "/tmp/mock-skills-registry.json" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Doctor pretty output (success)" "main-success stdout"
assert_contains "$SUCCESS_GUIDE_PATH" "skill-author-by-recording" "main-success guide"
assert_not_contains "$SUCCESS_GUIDE_PATH" "not currently configured on this host" "main-success guide"
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
assert_contains "$FAIL_STDOUT" "Final doctor check failed." "main-fail stdout"
assert_contains "$FAIL_STDOUT" "Doctor pretty output (failure)" "main-fail stdout"
assert_not_contains "$FAIL_STDOUT" "Installation Successful!" "main-fail stdout"
assert_contains "$FAIL_GUIDE_PATH" "skill-author-by-recording" "main-fail guide"
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
assert_not_contains "$MULTI_STDOUT" "Final doctor check failed." "main-multi stdout"
assert_not_contains "$MULTI_STDOUT" "Doctor pretty output" "main-multi stdout"

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

assert_contains "$REMEDIATE_STDOUT" "Mock download_operator_apk" "main-remediation stdout"
assert_contains "$REMEDIATE_STDOUT" "Mock verify_operator_apk" "main-remediation stdout"
assert_contains "$REMEDIATE_STDOUT" "Mock maybe_install_operator_apk" "main-remediation stdout"
assert_contains "$REMEDIATE_STDOUT" "Installation Successful!" "main-remediation stdout"
assert_contains "$REMEDIATE_TRACE" "download_operator_apk" "main-remediation trace"
assert_contains "$REMEDIATE_TRACE" "verify_operator_apk" "main-remediation trace"
assert_contains "$REMEDIATE_TRACE" "maybe_install_operator_apk" "main-remediation trace"
assert_contains "$REMEDIATE_CLI_LOG" "doctor --format json" "main-remediation cli log"
assert_contains "$REMEDIATE_CLI_LOG" "doctor --output pretty" "main-remediation cli log"

echo "=== install.sh main smoke harness passed ==="
