#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

REPO_ROOT="$(pwd)"
INSTALL_SCRIPT="$REPO_ROOT/sites/landing/public/install.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

assert_exit_code() {
    local actual="$1"
    local expected="$2"
    local label="$3"
    if [ "$actual" -ne "$expected" ]; then
        echo "ERROR: $label expected exit code $expected, got $actual" >&2
        return 1
    fi
}

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

    HOME="$TMP_DIR/home-parser-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        printf "%s" "$2" | parse_operator_remediate_result > "$3"
    ' _ "$INSTALL_SCRIPT" "$input_json" "$output_file"
}

setup_mock_clawperator() {
    local mock_dir="$1"
    local scenario="$2"
    local log_file="$3"

    mkdir -p "$mock_dir"
    cat > "$mock_dir/clawperator" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "\$*" >> "$log_file"

case "$scenario" in
  success)
    cat <<'JSON'
{"ok":true,"summary":{"totalDevices":3,"connectedDevices":2,"ready":1,"warn":1,"remediated":1,"adbUnready":1,"failed":0},"devices":[{"deviceId":"serial-remediated","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."},{"deviceId":"serial-warning","adbState":"device","status":"warn","message":"Critical checks passed with warnings: readiness.handshake"},{"deviceId":"serial-offline","adbState":"offline","status":"adb-unready","message":"ADB reports state 'offline'. Resolve device connectivity before remediation."}],"message":"Remediated 1 device. 1 visible device still needs ADB recovery."}
JSON
    exit 0
    ;;
  success-stderr)
    printf '%s\n' 'transient remediation warning on stderr' >&2
    cat <<'JSON'
{"ok":true,"summary":{"totalDevices":2,"connectedDevices":1,"ready":1,"warn":0,"remediated":0,"adbUnready":1,"failed":0},"devices":[{"deviceId":"serial-ready","adbState":"device","status":"ready","message":"Device is ready."},{"deviceId":"serial-offline","adbState":"offline","status":"adb-unready","message":"ADB reports state 'offline'. Resolve device connectivity before remediation."}],"message":"All connected devices are ready. 1 visible device still needs ADB recovery."}
JSON
    exit 0
    ;;
  single-connected)
    cat <<'JSON'
{"ok":true,"summary":{"totalDevices":2,"connectedDevices":1,"ready":1,"warn":0,"remediated":0,"adbUnready":1,"failed":0},"devices":[{"deviceId":"serial-solo","adbState":"device","status":"ready","message":"Device is ready."},{"deviceId":"serial-offline","adbState":"offline","status":"adb-unready","message":"ADB reports state 'offline'. Resolve device connectivity before remediation."}],"message":"All connected devices are ready. 1 visible device still needs ADB recovery."}
JSON
    exit 0
    ;;
  missing-id)
    cat <<'JSON'
{"ok":true,"summary":{"totalDevices":2,"connectedDevices":1,"ready":1,"warn":0,"remediated":0,"adbUnready":1,"failed":0},"devices":[{"adbState":"device","status":"ready","message":"Device is ready."},{"deviceId":"serial-offline","adbState":"offline","status":"adb-unready","message":"ADB reports state 'offline'. Resolve device connectivity before remediation."}],"message":"All connected devices are ready. 1 visible device still needs ADB recovery."}
JSON
    exit 0
    ;;
  failure)
    cat <<'JSON'
{"ok":false,"summary":{"totalDevices":2,"connectedDevices":2,"ready":0,"warn":0,"remediated":1,"adbUnready":0,"failed":1},"devices":[{"deviceId":"serial-alpha","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."},{"deviceId":"serial-beta","adbState":"device","status":"failed","message":"Critical checks still failing: readiness.version.compatibility"}],"message":"Remediation still required for 1 device."}
JSON
    exit 1
    ;;
  empty)
    cat <<'JSON'
{"ok":true,"summary":{"totalDevices":0,"connectedDevices":0,"ready":0,"warn":0,"remediated":0,"adbUnready":0,"failed":0},"devices":[],"message":"No connected Android devices found."}
JSON
    exit 0
    ;;
  invalid)
    printf '%s\n' 'not-json'
    exit 1
    ;;
  *)
    printf '%s\n' "unexpected scenario: $scenario" >&2
    exit 99
    ;;
esac
EOF
    chmod +x "$mock_dir/clawperator"
}

run_cli_case() {
    local label="$1"
    local scenario="$2"
    local output_file="$3"
    local status_file="$4"
    local values_file="$5"
    local log_file="$6"
    local mock_dir="$TMP_DIR/mock-$label"

    setup_mock_clawperator "$mock_dir" "$scenario" "$log_file"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"

        set +e
        run_operator_remediation_via_cli > "$3" 2>&1
        status="$?"
        set -e

        printf "%s\n" "$status" > "$4"
        {
          printf "ok=%s\n" "${OPERATOR_REMEDIATE_OK:-}"
          printf "command_status=%s\n" "${OPERATOR_REMEDIATE_COMMAND_STATUS:-}"
          printf "total=%s\n" "${OPERATOR_REMEDIATE_TOTAL_DEVICES:-}"
          printf "connected=%s\n" "${OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT:-}"
          printf "ready=%s\n" "${OPERATOR_REMEDIATE_READY_COUNT:-}"
          printf "warn=%s\n" "${OPERATOR_REMEDIATE_WARN_COUNT:-}"
          printf "remediated=%s\n" "${OPERATOR_REMEDIATE_REMEDIATED_COUNT:-}"
          printf "adb_unready=%s\n" "${OPERATOR_REMEDIATE_ADB_UNREADY_COUNT:-}"
          printf "failed=%s\n" "${OPERATOR_REMEDIATE_FAILED_COUNT:-}"
          printf "message=%s\n" "${OPERATOR_REMEDIATE_MESSAGE:-}"
          printf "last_device=%s\n" "${LAST_DEVICE_SERIAL:-}"
          printf "device0=%s\n" "${OPERATOR_REMEDIATE_DEVICE_IDS[0]:-}"
          printf "device0_status=%s\n" "${OPERATOR_REMEDIATE_DEVICE_STATUSES[0]:-}"
          printf "device1=%s\n" "${OPERATOR_REMEDIATE_DEVICE_IDS[1]:-}"
          printf "device1_status=%s\n" "${OPERATOR_REMEDIATE_DEVICE_STATUSES[1]:-}"
          printf "device2=%s\n" "${OPERATOR_REMEDIATE_DEVICE_IDS[2]:-}"
          printf "device2_status=%s\n" "${OPERATOR_REMEDIATE_DEVICE_STATUSES[2]:-}"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_file" "$status_file" "$values_file"
}

echo "=== Scenario 1: parser emits stable remediation summary and per-device fields ==="
PARSER_OUTPUT="$TMP_DIR/parser.out"
run_parser_case \
    mixed \
    '{"ok":false,"summary":{"totalDevices":3,"connectedDevices":2,"ready":1,"warn":0,"remediated":1,"adbUnready":0,"failed":1},"devices":[{"deviceId":"serial-alpha","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."},{"deviceId":"serial-beta","adbState":"device","status":"failed","message":"Critical checks still failing: readiness.version.compatibility"}],"message":"Remediation still required for 1 device."}' \
    "$PARSER_OUTPUT"
assert_contains "$PARSER_OUTPUT" "ok=false" "parser output"
assert_contains "$PARSER_OUTPUT" "summary.totalDevices=3" "parser output"
assert_contains "$PARSER_OUTPUT" "summary.remediated=1" "parser output"
assert_contains "$PARSER_OUTPUT" "summary.failed=1" "parser output"
assert_contains "$PARSER_OUTPUT" "device:0:id=serial-alpha" "parser output"
assert_contains "$PARSER_OUTPUT" "device:1:status=failed" "parser output"
assert_contains "$PARSER_OUTPUT" "message=Remediation still required for 1 device." "parser output"

echo "=== Scenario 2: CLI delegation records summary data for mixed multi-device remediation ==="
SUCCESS_STDOUT="$TMP_DIR/success.stdout"
SUCCESS_STATUS="$TMP_DIR/success.status"
SUCCESS_VALUES="$TMP_DIR/success.values"
SUCCESS_LOG="$TMP_DIR/success.log"
run_cli_case success success "$SUCCESS_STDOUT" "$SUCCESS_STATUS" "$SUCCESS_VALUES" "$SUCCESS_LOG"
assert_exit_code "$(cat "$SUCCESS_STATUS")" 0 "success"
assert_contains "$SUCCESS_STDOUT" "Running CLI-owned device remediation..." "success stdout"
assert_contains "$SUCCESS_STDOUT" "Device remediation summary from the CLI:" "success stdout"
assert_contains "$SUCCESS_STDOUT" "serial-remediated - remediated" "success stdout"
assert_contains "$SUCCESS_STDOUT" "serial-warning - Critical checks passed with warnings: readiness.handshake" "success stdout"
assert_contains "$SUCCESS_STDOUT" "serial-offline - ADB reports state 'offline'." "success stdout"
assert_contains "$SUCCESS_STDOUT" "Remediated 1 device. 1 visible device still needs ADB recovery." "success stdout"
assert_contains "$SUCCESS_VALUES" "ok=true" "success values"
assert_contains "$SUCCESS_VALUES" "command_status=0" "success values"
assert_contains "$SUCCESS_VALUES" "total=3" "success values"
assert_contains "$SUCCESS_VALUES" "connected=2" "success values"
assert_contains "$SUCCESS_VALUES" "ready=1" "success values"
assert_contains "$SUCCESS_VALUES" "warn=1" "success values"
assert_contains "$SUCCESS_VALUES" "remediated=1" "success values"
assert_contains "$SUCCESS_VALUES" "adb_unready=1" "success values"
assert_contains "$SUCCESS_VALUES" "failed=0" "success values"
assert_contains "$SUCCESS_VALUES" "last_device=" "success values"
assert_contains "$SUCCESS_VALUES" "device0_status=remediated" "success values"
assert_contains "$SUCCESS_VALUES" "device1_status=warn" "success values"
assert_contains "$SUCCESS_VALUES" "device2_status=adb-unready" "success values"
assert_contains "$SUCCESS_LOG" "operator remediate --output json --operator-package com.clawperator.operator" "success log"

echo "=== Scenario 3: exactly one connected device records last-device metadata ==="
SINGLE_STDOUT="$TMP_DIR/single.stdout"
SINGLE_STATUS="$TMP_DIR/single.status"
SINGLE_VALUES="$TMP_DIR/single.values"
SINGLE_LOG="$TMP_DIR/single.log"
run_cli_case single-connected single-connected "$SINGLE_STDOUT" "$SINGLE_STATUS" "$SINGLE_VALUES" "$SINGLE_LOG"
assert_exit_code "$(cat "$SINGLE_STATUS")" 0 "single-connected"
assert_contains "$SINGLE_VALUES" "connected=1" "single-connected values"
assert_contains "$SINGLE_VALUES" "last_device=serial-solo" "single-connected values"
assert_contains "$SINGLE_VALUES" "device0_status=ready" "single-connected values"
assert_contains "$SINGLE_VALUES" "device1_status=adb-unready" "single-connected values"

echo "=== Scenario 4: stderr noise does not break CLI-owned remediation parsing ==="
STDERR_STDOUT="$TMP_DIR/stderr.stdout"
STDERR_STATUS="$TMP_DIR/stderr.status"
STDERR_VALUES="$TMP_DIR/stderr.values"
STDERR_LOG="$TMP_DIR/stderr.log"
run_cli_case success-stderr success-stderr "$STDERR_STDOUT" "$STDERR_STATUS" "$STDERR_VALUES" "$STDERR_LOG"
assert_exit_code "$(cat "$STDERR_STATUS")" 0 "success-stderr"
assert_contains "$STDERR_VALUES" "ok=true" "success-stderr values"
assert_contains "$STDERR_STDOUT" "All connected devices are ready. 1 visible device still needs ADB recovery." "success-stderr stdout"
assert_not_contains "$STDERR_STDOUT" "operator remediate returned no parseable result." "success-stderr stdout"
assert_not_contains "$STDERR_STDOUT" "transient remediation warning on stderr" "success-stderr stdout"

echo "=== Scenario 5: parser tolerates device entries that omit deviceId without crashing ==="
MISSING_ID_STDOUT="$TMP_DIR/missing-id.stdout"
MISSING_ID_STATUS="$TMP_DIR/missing-id.status"
MISSING_ID_VALUES="$TMP_DIR/missing-id.values"
MISSING_ID_LOG="$TMP_DIR/missing-id.log"
run_cli_case missing-id missing-id "$MISSING_ID_STDOUT" "$MISSING_ID_STATUS" "$MISSING_ID_VALUES" "$MISSING_ID_LOG"
assert_exit_code "$(cat "$MISSING_ID_STATUS")" 0 "missing-id"
assert_contains "$MISSING_ID_VALUES" "ok=true" "missing-id values"
assert_contains "$MISSING_ID_VALUES" "connected=1" "missing-id values"
assert_contains "$MISSING_ID_VALUES" "device0=" "missing-id values"
assert_contains "$MISSING_ID_VALUES" "device1=serial-offline" "missing-id values"
assert_contains "$MISSING_ID_STDOUT" "All connected devices are ready. 1 visible device still needs ADB recovery." "missing-id stdout"

echo "=== Scenario 6: CLI delegation preserves failure details without rebuilding policy in shell ==="
FAIL_STDOUT="$TMP_DIR/fail.stdout"
FAIL_STATUS="$TMP_DIR/fail.status"
FAIL_VALUES="$TMP_DIR/fail.values"
FAIL_LOG="$TMP_DIR/fail.log"
run_cli_case failure failure "$FAIL_STDOUT" "$FAIL_STATUS" "$FAIL_VALUES" "$FAIL_LOG"
assert_exit_code "$(cat "$FAIL_STATUS")" 0 "failure"
assert_contains "$FAIL_STDOUT" "serial-alpha - remediated" "failure stdout"
assert_contains "$FAIL_STDOUT" "serial-beta - Critical checks still failing: readiness.version.compatibility" "failure stdout"
assert_contains "$FAIL_STDOUT" "Remediation still required for 1 device." "failure stdout"
assert_contains "$FAIL_VALUES" "ok=false" "failure values"
assert_contains "$FAIL_VALUES" "command_status=1" "failure values"
assert_contains "$FAIL_VALUES" "remediated=1" "failure values"
assert_contains "$FAIL_VALUES" "failed=1" "failure values"
assert_contains "$FAIL_LOG" "operator remediate --output json --operator-package com.clawperator.operator" "failure log"
assert_not_contains "$FAIL_STDOUT" "operator setup --apk" "failure stdout"

echo "=== Scenario 7: no-device results stay parseable and keep remediation in the CLI lane ==="
EMPTY_STDOUT="$TMP_DIR/empty.stdout"
EMPTY_STATUS="$TMP_DIR/empty.status"
EMPTY_VALUES="$TMP_DIR/empty.values"
EMPTY_LOG="$TMP_DIR/empty.log"
run_cli_case empty empty "$EMPTY_STDOUT" "$EMPTY_STATUS" "$EMPTY_VALUES" "$EMPTY_LOG"
assert_exit_code "$(cat "$EMPTY_STATUS")" 0 "empty"
assert_contains "$EMPTY_STDOUT" "No connected Android devices found." "empty stdout"
assert_contains "$EMPTY_VALUES" "ok=true" "empty values"
assert_contains "$EMPTY_VALUES" "total=0" "empty values"
assert_contains "$EMPTY_VALUES" "connected=0" "empty values"
assert_contains "$EMPTY_VALUES" "last_device=" "empty values"

echo "=== Scenario 8: invalid CLI output fails fast instead of guessing remediation policy ==="
INVALID_STDOUT="$TMP_DIR/invalid.stdout"
INVALID_STATUS="$TMP_DIR/invalid.status"
INVALID_VALUES="$TMP_DIR/invalid.values"
INVALID_LOG="$TMP_DIR/invalid.log"
run_cli_case invalid invalid "$INVALID_STDOUT" "$INVALID_STATUS" "$INVALID_VALUES" "$INVALID_LOG"
assert_exit_code "$(cat "$INVALID_STATUS")" 1 "invalid"
assert_contains "$INVALID_STDOUT" "operator remediate returned no parseable result." "invalid stdout"
assert_contains "$INVALID_STDOUT" "not-json" "invalid stdout"
assert_contains "$INVALID_VALUES" "ok=" "invalid values"
assert_contains "$INVALID_LOG" "operator remediate --output json --operator-package com.clawperator.operator" "invalid log"

echo "=== install.sh remediation parser harness passed ==="
