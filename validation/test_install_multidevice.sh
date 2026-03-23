#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

REPO_ROOT="$(pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

INSTALL_SH_NO_MAIN="$TMP_DIR/install.no-main.sh"
sed '$d' "$REPO_ROOT/sites/landing/public/install.sh" > "$INSTALL_SH_NO_MAIN"

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
    if ! grep -Fq "$needle" "$file"; then
        echo "ERROR: $label missing expected output: $needle" >&2
        echo "--- stdout ---" >&2
        cat "$file" >&2
        echo "--------------" >&2
        return 1
    fi
}

setup_mock_tools() {
    local scenario="$1"
    local mock_dir="$TMP_DIR/mock-$scenario"
    mkdir -p "$mock_dir"

    case "$scenario" in
        partial)
            cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
cat <<'OUT'
List of devices attached
serial-ready	device
serial-bad	unauthorized
OUT
EOF
            chmod +x "$mock_dir/adb"
            cat > "$mock_dir/clawperator" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-ready ]; then
    exit 0
fi

if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-bad ]; then
    exit 1
fi

exit 2
EOF
            ;;
        all-ready)
            cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
cat <<'OUT'
List of devices attached
serial-ready	device
serial-bad	device
OUT
EOF
            chmod +x "$mock_dir/adb"
            cat > "$mock_dir/clawperator" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = doctor ] && [ "$2" = --device ]; then
    exit 0
fi

exit 2
EOF
            ;;
        *)
            echo "ERROR: unknown mock scenario: $scenario" >&2
            return 1
            ;;
    esac
    chmod +x "$mock_dir/clawperator"

    printf '%s\n' "$mock_dir"
}

run_scenario() {
    local scenario="$1"
    local expected_exit="$2"
    local expected_message="$3"
    local unexpected_message="${4:-}"
    local unexpected_message_2="${5:-}"
    local mock_dir
    mock_dir="$(setup_mock_tools "$scenario")"

    local stdout_file="$TMP_DIR/$scenario.stdout"
    local stderr_file="$TMP_DIR/$scenario.stderr"
    local status_file="$TMP_DIR/$scenario.status"

    PATH="$mock_dir:$PATH" \
    APK_LOCAL_PATH=/tmp/operator.apk \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        CLAWPERATOR_BIN_PATH="$5"
        set +e
        maybe_install_operator_apk >"$2" 2>"$3"
        printf "%s" "$?" >"$4"
    ' _ "$INSTALL_SH_NO_MAIN" "$stdout_file" "$stderr_file" "$status_file" "$mock_dir/clawperator"

    local actual_exit
    actual_exit="$(cat "$status_file")"
    assert_exit_code "$actual_exit" "$expected_exit" "$scenario"
    assert_contains "$stdout_file" "$expected_message" "$scenario"
    if [ -n "$unexpected_message" ] && grep -Fq "$unexpected_message" "$stdout_file"; then
        echo "ERROR: $scenario unexpectedly printed: $unexpected_message" >&2
        echo "--- stdout ---" >&2
        cat "$stdout_file" >&2
        echo "--------------" >&2
        return 1
    fi
    if [ -n "$unexpected_message_2" ] && grep -Fq "$unexpected_message_2" "$stdout_file"; then
        echo "ERROR: $scenario unexpectedly printed: $unexpected_message_2" >&2
        echo "--- stdout ---" >&2
        cat "$stdout_file" >&2
        echo "--------------" >&2
        return 1
    fi
}

echo "=== Scenario 1: partial readiness stays in multi-device path ==="
run_scenario \
    partial \
    0 \
    "Skipping APK install until every connected device is ready." \
    "All devices ready. No setup required." \
    "Installing operator APK on connected device..."

echo "=== Scenario 2: all devices ready succeeds ==="
run_scenario \
    all-ready \
    0 \
    "All devices ready. No setup required." \
    "Skipping APK install until every connected device is ready." \
    "Installing operator APK on connected device..."

echo "=== install.sh multi-device harness passed ==="
