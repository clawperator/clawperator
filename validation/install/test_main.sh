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
    local real_cli_path="$REPO_ROOT/apps/node/dist/cli/index.js"

    mkdir -p "$mock_dir"
    cat > "$mock_dir/clawperator" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "\$*" >> "$log_file"

STATE_FILE="\${MOCK_MAIN_STATE_FILE:?}"
SCENARIO="\${MOCK_MAIN_SCENARIO:?}"

case "\$*" in
  operator\ remediate\ --output\ json*)
    case "\$SCENARIO" in
      success)
        cat <<'JSON'
{"ok":true,"summary":{"totalDevices":1,"connectedDevices":1,"ready":1,"warn":0,"remediated":0,"adbUnready":0,"failed":0},"devices":[{"deviceId":"serial-solo","adbState":"device","status":"ready","message":"Device is ready."}],"message":"All connected devices are ready."}
JSON
        exit 0
        ;;
      final-fail)
        cat <<'JSON'
{"ok":false,"summary":{"totalDevices":1,"connectedDevices":1,"ready":0,"warn":0,"remediated":0,"adbUnready":0,"failed":1},"devices":[{"deviceId":"serial-solo","adbState":"device","status":"failed","message":"Critical checks still failing: readiness.handshake"}],"message":"Remediation still required for 1 device."}
JSON
        exit 1
        ;;
      multi-device)
        cat <<'JSON'
{"ok":true,"summary":{"totalDevices":2,"connectedDevices":2,"ready":2,"warn":0,"remediated":0,"adbUnready":0,"failed":0},"devices":[{"deviceId":"serial-alpha","adbState":"device","status":"ready","message":"Device is ready."},{"deviceId":"serial-beta","adbState":"device","status":"ready","message":"Device is ready."}],"message":"All connected devices are ready."}
JSON
        exit 0
        ;;
      multi-device-warning)
        cat <<'JSON'
{"ok":true,"summary":{"totalDevices":2,"connectedDevices":2,"ready":1,"warn":1,"remediated":0,"adbUnready":0,"failed":0},"devices":[{"deviceId":"serial-warning","adbState":"device","status":"warn","message":"Critical checks passed with warnings: readiness.handshake"},{"deviceId":"serial-ready","adbState":"device","status":"ready","message":"Device is ready."}],"message":"All connected devices passed critical checks. 1 device still have warnings."}
JSON
        exit 0
        ;;
      apk-remediation)
        cat <<'JSON'
{"ok":true,"summary":{"totalDevices":1,"connectedDevices":1,"ready":0,"warn":0,"remediated":1,"adbUnready":0,"failed":0},"devices":[{"deviceId":"serial-solo","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."}],"message":"Remediated 1 device."}
JSON
        exit 0
        ;;
      multi-device-mixed)
        cat <<'JSON'
{"ok":true,"summary":{"totalDevices":3,"connectedDevices":1,"ready":1,"warn":0,"remediated":0,"adbUnready":2,"failed":0},"devices":[{"deviceId":"serial-ready","adbState":"device","status":"ready","message":"Device is ready."},{"deviceId":"serial-unauthorized","adbState":"unauthorized","status":"adb-unready","message":"ADB reports state 'unauthorized'. Resolve device connectivity before remediation."},{"deviceId":"serial-offline","adbState":"offline","status":"adb-unready","message":"ADB reports state 'offline'. Resolve device connectivity before remediation."}],"message":"All connected devices are ready. 2 visible devices still need ADB recovery."}
JSON
        exit 0
        ;;
      multi-device-stale)
        cat <<'JSON'
{"ok":true,"summary":{"totalDevices":2,"connectedDevices":2,"ready":0,"warn":0,"remediated":2,"adbUnready":0,"failed":0},"devices":[{"deviceId":"serial-alpha","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."},{"deviceId":"serial-beta","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."}],"message":"Remediated 2 devices."}
JSON
        exit 0
        ;;
      multi-device-stale-dev)
        cat <<'JSON'
{"ok":false,"summary":{"totalDevices":2,"connectedDevices":2,"ready":1,"warn":0,"remediated":0,"adbUnready":0,"failed":1},"devices":[{"deviceId":"serial-alpha","adbState":"device","status":"failed","message":"Automatic APK download is only available for com.clawperator.operator. Provide a matching local APK at ~/.clawperator/downloads/operator-debug.apk for com.clawperator.operator.dev."},{"deviceId":"serial-beta","adbState":"device","status":"ready","message":"Device is ready."}],"message":"Remediation still required for 1 device."}
JSON
        exit 1
        ;;
      multi-device-stale-probe)
        cat <<'JSON'
{"ok":false,"summary":{"totalDevices":2,"connectedDevices":2,"ready":0,"warn":0,"remediated":1,"adbUnready":0,"failed":1},"devices":[{"deviceId":"serial-alpha","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."},{"deviceId":"serial-bad","adbState":"device","status":"failed","message":"Critical checks still failing: device.discovery"}],"message":"Remediation still required for 1 device."}
JSON
        exit 1
        ;;
      multi-device-shell-unavailable)
        cat <<'JSON'
{"ok":false,"summary":{"totalDevices":2,"connectedDevices":2,"ready":1,"warn":0,"remediated":0,"adbUnready":0,"failed":1},"devices":[{"deviceId":"serial-bad","adbState":"device","status":"failed","message":"Critical checks still failing: readiness.apk.presence"},{"deviceId":"serial-ready","adbState":"device","status":"ready","message":"Device is ready."}],"message":"Remediation still required for 1 device."}
JSON
        exit 1
        ;;
      multi-device-all-unready)
        cat <<'JSON'
{"ok":true,"summary":{"totalDevices":2,"connectedDevices":0,"ready":0,"warn":0,"remediated":0,"adbUnready":2,"failed":0},"devices":[{"deviceId":"serial-unauthorized","adbState":"unauthorized","status":"adb-unready","message":"ADB reports state 'unauthorized'. Resolve device connectivity before remediation."},{"deviceId":"serial-offline","adbState":"offline","status":"adb-unready","message":"ADB reports state 'offline'. Resolve device connectivity before remediation."}],"message":"No connected device is ready for ADB yet. 2 visible devices still need ADB recovery."}
JSON
        exit 0
        ;;
      multi-device-partial-fail)
        cat <<'JSON'
{"ok":false,"summary":{"totalDevices":2,"connectedDevices":2,"ready":0,"warn":0,"remediated":1,"adbUnready":0,"failed":1},"devices":[{"deviceId":"serial-alpha","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."},{"deviceId":"serial-beta","adbState":"device","status":"failed","message":"Critical checks still failing: readiness.version.compatibility"}],"message":"Remediation still required for 1 device."}
JSON
        exit 1
        ;;
      stale-device)
        cat <<'JSON'
{"ok":true,"summary":{"totalDevices":1,"connectedDevices":1,"ready":0,"warn":0,"remediated":1,"adbUnready":0,"failed":0},"devices":[{"deviceId":"serial-solo","adbState":"device","status":"remediated","message":"Device was remediated and is now ready."}],"message":"Remediated 1 device."}
JSON
        exit 0
        ;;
      *)
        printf '%s\n' "unexpected operator remediate scenario: \$SCENARIO" >&2
        exit 9
        ;;
    esac
    ;;
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
    multi-device-shell-unavailable:1|multi-device-shell-unavailable:4|multi-device-shell-unavailable:5)
      cat <<'JSON'
{"ok":true,"criticalOk":true,"checks":[{"id":"device.discovery","status":"warn","code":"MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"}]}
JSON
      exit 0
      ;;
    multi-device-shell-unavailable:2|multi-device-shell-unavailable:6)
      cat <<'JSON'
{"ok":false,"criticalOk":false,"checks":[{"id":"readiness.apk.presence","status":"fail","code":"DEVICE_SHELL_UNAVAILABLE"}]}
JSON
      exit 1
      ;;
    multi-device-shell-unavailable:3|multi-device-shell-unavailable:7)
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

if [ "\$1" = "operator" ] && [ "\$2" = "download" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
  OPERATOR_PACKAGE="com.clawperator.operator"
  if [ "\${5:-}" = "--operator-package" ] && [ -n "\${6:-}" ]; then
    OPERATOR_PACKAGE="\$6"
  fi
  APK_NAME="operator.apk"
  if [ "\$OPERATOR_PACKAGE" != "com.clawperator.operator" ]; then
    APK_NAME="operator-debug.apk"
  fi
  LOCAL_PATH="\$HOME/.clawperator/downloads/\$APK_NAME"
  mkdir -p "\${LOCAL_PATH%/*}"
  printf '%s\n' 'mock apk' > "\$LOCAL_PATH"
  cat <<JSON
{"localPath":"\$LOCAL_PATH","operatorVersion":"9.9.9","sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","operatorPackage":"\$OPERATOR_PACKAGE","message":"Downloaded and verified Operator APK 9.9.9."}
JSON
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

if [ "\$1" = "host" ] && [ "\$2" = "setup" ]; then
  exec "$EXPECTED_NODE_BIN" "$real_cli_path" "\$@"
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
    multi-device-shell-unavailable)
      cat <<'OUT'
List of devices attached
serial-bad	device
serial-ready	device
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
            ( main ) > "$4" 2> "$5"
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
            ( main ) > "$4" 2> "$5"
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

echo "=== Scenario 1: main success path delegates remediation to the CLI and writes summary ==="
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
assert_contains "$SUCCESS_STDOUT" "Running CLI-owned device remediation..." "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Device remediation summary from the CLI:" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "serial-solo - ready" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Installation Successful!" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Canonical local Operator APK path:" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Canonical stable APK URL (redownload this for later manual setup):" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "Doctor pretty output (success)" "main-success stdout"
assert_contains "$SUCCESS_STDOUT" "$TMP_DIR/home-main-success/.clawperator/skills/skills/skills-registry.json" "main-success stdout"
assert_contains "$SUCCESS_GUIDE_PATH" "## Runtime Skills" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "clawperator-agent-orientation" "main-success guide"
assert_contains "$SUCCESS_GUIDE_PATH" "clawperator-upgrade" "main-success guide"
assert_json_field_equals "$SUCCESS_INSTALL_STATE_PATH" "cliVersion" "1.2.3" "main-success install-state cliVersion"
assert_json_field_equals "$SUCCESS_INSTALL_STATE_PATH" "lastDeviceSerial" "serial-solo" "main-success install-state lastDeviceSerial"
assert_json_field_equals "$SUCCESS_MCP_CONFIG_PATH" "claudeDesktop.entry.clawperator.command" "$EXPECTED_NODE_BIN" "main-success mcp claude command"
assert_contains "$SUCCESS_STDOUT" "$TMP_DIR/home-main-success/.clawperator/AGENTS.md" "main-success stdout durable guide"
assert_contains "$SUCCESS_STDOUT" "$TMP_DIR/home-main-success/.clawperator/install-state.json" "main-success stdout durable install-state"
assert_contains "$SUCCESS_STDOUT" "$TMP_DIR/home-main-success/.clawperator/mcp-config-snippet.json" "main-success stdout durable mcp"
assert_contains "$SUCCESS_TRACE" "validate_os" "main-success trace"
assert_contains "$SUCCESS_TRACE" "install_cli" "main-success trace"
assert_contains "$SUCCESS_TRACE" "show_star_hint" "main-success trace"
assert_contains "$SUCCESS_CLI_LOG" "operator remediate --output json --operator-package com.clawperator.operator" "main-success cli log"
assert_contains "$SUCCESS_CLI_LOG" "skills install --output json" "main-success cli log"
assert_contains "$SUCCESS_CLI_LOG" "bundled-skills install --output json" "main-success cli log"
assert_contains "$SUCCESS_CLI_LOG" "host setup --output json --cli-version 1.2.3 --last-device-serial serial-solo" "main-success cli log"
assert_contains "$SUCCESS_CLI_LOG" "doctor --output pretty" "main-success cli log"
assert_not_contains "$SUCCESS_CLI_LOG" "doctor --format json" "main-success cli log"

echo "=== Scenario 1b: non-release success summary keeps debug APK wording ==="
SUCCESS_DEV_STDOUT="$TMP_DIR/main-success-dev.stdout"
SUCCESS_DEV_STDERR="$TMP_DIR/main-success-dev.stderr"
SUCCESS_DEV_TRACE="$TMP_DIR/main-success-dev.trace"
SUCCESS_DEV_CLI_LOG="$TMP_DIR/main-success-dev.cli.log"
SUCCESS_DEV_GUIDE_PATH_FILE="$TMP_DIR/main-success-dev.guide.path"
SUCCESS_DEV_STATE="$TMP_DIR/main-success-dev.state"
run_main_case \
    main-success-dev \
    success \
    0 \
    "$SUCCESS_DEV_STDOUT" \
    "$SUCCESS_DEV_STDERR" \
    "$SUCCESS_DEV_TRACE" \
    "$SUCCESS_DEV_CLI_LOG" \
    "$SUCCESS_DEV_GUIDE_PATH_FILE" \
    "$SUCCESS_DEV_STATE" \
    "com.clawperator.operator.dev"

assert_contains "$SUCCESS_DEV_STDOUT" "Expected local debug APK path for com.clawperator.operator.dev:" "main-success-dev stdout"
assert_contains "$SUCCESS_DEV_STDOUT" "Automatic stable APK downloads are disabled for non-release operator packages." "main-success-dev stdout"
assert_contains "$SUCCESS_DEV_CLI_LOG" "operator remediate --output json --operator-package com.clawperator.operator.dev" "main-success-dev cli log"

echo "=== Scenario 2: failed remediation aborts after host setup and pretty doctor output ==="
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

assert_contains "$FAIL_STDOUT" "serial-solo - Critical checks still failing: readiness.handshake" "main-fail stdout"
assert_contains "$FAIL_STDOUT" "Final setup check failed." "main-fail stdout"
assert_contains "$FAIL_STDOUT" "Doctor pretty output (failure)" "main-fail stdout"
assert_not_contains "$FAIL_STDOUT" "Installation Successful!" "main-fail stdout"
assert_contains "$FAIL_CLI_LOG" "operator remediate --output json --operator-package com.clawperator.operator" "main-fail cli log"

echo "=== Scenario 3: multi-device ready path uses CLI result for device-selection handoff ==="
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
assert_contains "$MULTI_STDOUT" "Device remediation summary from the CLI:" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "serial-alpha - ready" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "serial-beta - ready" "main-multi stdout"
assert_contains "$MULTI_STDOUT" "Future commands must target one device explicitly with --device." "main-multi stdout"
assert_not_contains "$MULTI_STDOUT" "Doctor pretty output" "main-multi stdout"
assert_contains "$MULTI_CLI_LOG" "operator remediate --output json --operator-package com.clawperator.operator" "main-multi cli log"
assert_json_field_null "$TMP_DIR/home-main-multi/.clawperator/install-state.json" "lastDeviceSerial" "main-multi install-state lastDeviceSerial"

echo "=== Scenario 4: mixed multi-device states surface CLI-owned adb warnings ==="
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

assert_contains "$MULTI_MIXED_STDOUT" "serial-ready - ready" "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "serial-unauthorized - ADB reports state 'unauthorized'." "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "serial-offline - ADB reports state 'offline'." "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "some devices still need ADB recovery before they can be targeted" "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_STDOUT" "clawperator doctor --device <device_id> --output pretty --operator-package com.clawperator.operator.dev" "main-multi-mixed stdout"
assert_contains "$MULTI_MIXED_CLI_LOG" "operator remediate --output json --operator-package com.clawperator.operator.dev" "main-multi-mixed cli log"

echo "=== Scenario 5: remediation success updates single-device install metadata ==="
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
assert_contains "$REMEDIATE_STDOUT" "serial-solo - remediated" "main-remediation stdout"
assert_contains "$REMEDIATE_STDOUT" "Installation Successful!" "main-remediation stdout"
assert_contains "$REMEDIATE_CLI_LOG" "operator remediate --output json --operator-package com.clawperator.operator" "main-remediation cli log"
assert_json_field_equals "$REMEDIATE_INSTALL_STATE_PATH" "lastDeviceSerial" "serial-solo" "main-remediation install-state lastDeviceSerial"

echo "=== Scenario 6: multi-device remediation failures keep the CLI as the source of truth ==="
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
    "$PARTIAL_FAIL_STATE"

assert_contains "$PARTIAL_FAIL_STDOUT" "serial-alpha - remediated" "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_STDOUT" "serial-beta - Critical checks still failing: readiness.version.compatibility" "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_STDOUT" "Host install completed, but some connected devices still need remediation." "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_STDOUT" "clawperator operator remediate --operator-package com.clawperator.operator" "main-partial-fail stdout"
assert_not_contains "$PARTIAL_FAIL_STDOUT" "Installation Successful!" "main-partial-fail stdout"
assert_contains "$PARTIAL_FAIL_CLI_LOG" "operator remediate --output json --operator-package com.clawperator.operator" "main-partial-fail cli log"

echo "=== Scenario 7: stdin entrypoint runs without BASH_SOURCE errors ==="
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
