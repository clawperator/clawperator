#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

REPO_ROOT="$(pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

INSTALL_SCRIPT="$REPO_ROOT/sites/landing/public/install.sh"

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

assert_not_contains() {
    local file="$1"
    local needle="$2"
    local label="$3"
    if grep -Fq "$needle" "$file"; then
        echo "ERROR: $label unexpectedly contained: $needle" >&2
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
    cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
    exit 0
fi

if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-bad ]; then
    cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.handshake","status":"fail","code":"HANDSHAKE_FAILED"}]}
JSON
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
    cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
    exit 0
fi

exit 2
EOF
            ;;
        warning-only)
            cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
cat <<'OUT'
List of devices attached
serial-warning	device
serial-ready	device
OUT
EOF
            chmod +x "$mock_dir/adb"
            cat > "$mock_dir/clawperator" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-warning ]; then
    cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"readiness.handshake","status":"warn","code":"HANDSHAKE_PERMISSION_ADVISORY"}]}
JSON
    exit 0
fi

if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-ready ]; then
    cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
    exit 0
fi

exit 2
EOF
            ;;
        all-unready)
            cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
cat <<'OUT'
List of devices attached
serial-unauthorized	unauthorized
serial-offline	offline
OUT
EOF
            chmod +x "$mock_dir/adb"
            cat > "$mock_dir/clawperator" <<'EOF'
#!/usr/bin/env bash
exit 2
EOF
            ;;
        stale-one)
            cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
cat <<'OUT'
List of devices attached
serial-stale	device
serial-ready	device
OUT
EOF
            chmod +x "$mock_dir/adb"
            cat > "$mock_dir/clawperator" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-stale ]; then
    cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.version.compatibility","status":"fail","code":"VERSION_INCOMPATIBLE"}]}
JSON
    exit 1
fi

if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-ready ]; then
    cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
    exit 0
fi

if [ "$1" = operator ] && [ "$2" = setup ] && [ "$3" = --apk ] && [ "$5" = --device ] && [ "$6" = serial-stale ]; then
    exit 0
fi

exit 2
EOF
            ;;
        probe-failure)
            cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
cat <<'OUT'
List of devices attached
serial-bad	device
serial-ready	device
OUT
EOF
            chmod +x "$mock_dir/adb"
            cat > "$mock_dir/clawperator" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-bad ]; then
    printf '%s\n' 'not-json'
    exit 1
fi

if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-ready ]; then
    cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[]}
JSON
    exit 0
fi

exit 2
EOF
            ;;
        stale-many)
            cat > "$mock_dir/adb" <<'EOF'
#!/usr/bin/env bash
cat <<'OUT'
List of devices attached
serial-alpha	device
serial-beta	device
serial-offline	offline
OUT
EOF
            chmod +x "$mock_dir/adb"
            cat > "$mock_dir/clawperator" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-alpha ]; then
    cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.apk.presence","status":"fail","code":"OPERATOR_NOT_INSTALLED"}]}
JSON
    exit 1
fi

if [ "$1" = doctor ] && [ "$2" = --device ] && [ "$3" = serial-beta ]; then
    cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.version.compatibility","status":"fail","code":"VERSION_INCOMPATIBLE"}]}
JSON
    exit 1
fi

if [ "$1" = operator ] && [ "$2" = setup ] && [ "$3" = --apk ] && [ "$5" = --device ] && { [ "$6" = serial-alpha ] || [ "$6" = serial-beta ]; }; then
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
    OPERATOR_VERSION=9.9.9 \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        CLAWPERATOR_BIN_PATH="$5"
        set +e
        maybe_install_operator_apk >"$2" 2>"$3"
        printf "%s" "$?" >"$4"
    ' _ "$INSTALL_SCRIPT" "$stdout_file" "$stderr_file" "$status_file" "$mock_dir/clawperator"

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

echo "=== Scenario 1: ready devices stay ready while unauthorized devices are reported ==="
run_scenario \
    partial \
    0 \
    "All ready devices already have the required APK." \
    "Installing operator APK on serial-ready..." \
    "Complete Android setup on one target device with one of:"
assert_contains "$TMP_DIR/partial.stdout" "serial-bad - ADB state: unauthorized. Unlock the device or restart ADB before setup." "partial stdout"

echo "=== Scenario 2: all ready devices do not reinstall ==="
run_scenario \
    all-ready \
    0 \
    "All connected devices already have the required APK." \
    "Installing operator APK on serial-ready..." \
    "Installing operator APK on connected device..."

echo "=== Scenario 3: warning-only devices are not treated as APK targets ==="
run_scenario \
    warning-only \
    0 \
    "All connected devices already have the required APK." \
    "Installing operator APK on serial-warning..." \
    "Complete Android setup on one target device with one of:"

echo "=== Scenario 4: all-unready devices stay in the ADB readiness lane ==="
run_scenario \
    all-unready \
    0 \
    "No connected device is ready for ADB yet. Skipping APK install until one device is ready." \
    "All ready devices already have the required APK." \
    "Complete Android setup on one target device with one of:"

echo "=== Scenario 5: probe failures abort remediation instead of being ignored ==="
run_scenario \
    probe-failure \
    1 \
    "Could not inspect every ready device with Clawperator Doctor." \
    "Installing operator APK on serial-bad..." \
    "All connected devices already have the required APK."

echo "=== Scenario 6: a stale ready device is upgraded in place ==="
run_scenario \
    stale-one \
    0 \
    "Installing operator APK on serial-stale..." \
    "Complete Android setup on one target device with one of:" \
    "All connected devices already have the required APK."
assert_contains "$TMP_DIR/stale-one.stdout" "serial-stale - operator APK installed and permissions granted." "stale-one stdout"
assert_not_contains "$TMP_DIR/stale-one.stdout" "Installing operator APK on serial-ready..." "stale-one stdout"

echo "=== Scenario 7: multiple stale ready devices are upgraded while offline devices are skipped ==="
run_scenario \
    stale-many \
    0 \
    "Installing operator APK on serial-alpha..." \
    "Complete Android setup on one target device with one of:" \
    "All connected devices already have the required APK."
assert_contains "$TMP_DIR/stale-many.stdout" "Installing operator APK on serial-beta..." "stale-many stdout"
assert_contains "$TMP_DIR/stale-many.stdout" "serial-offline - ADB state: offline. Unlock the device or restart ADB before setup." "stale-many stdout"
assert_contains "$TMP_DIR/stale-many.stdout" "Other detected devices were skipped until they are ready for ADB." "stale-many stdout"

echo "=== install.sh multi-device harness passed ==="
