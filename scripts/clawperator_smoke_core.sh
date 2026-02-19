#!/usr/bin/env bash
# Stage 1 real-device smoke for Clawperator Node API.
# Usage: one physical device connected (or set DEVICE_ID); edit DEVICE_ID and CLAWPERATOR_RECEIVER_PACKAGE if needed.
# Optional: CLAWPERATOR_SMOKE_SUMMARY=/path/to/summary.json to write a machine-readable JSON summary.
set -euo pipefail

cd "$(dirname "$0")/.."

# 0) Build node CLI
npm --prefix apps/node run build

# 1) Device selection:
# - If DEVICE_ID is set, use it.
# - If unset and exactly one device is connected, auto-select it.
# - If unset and multiple devices are connected, fail and ask for DEVICE_ID.
# NOTE: Do not commit personal device serials to this repository.
export DEVICE_ID="${DEVICE_ID:-}"

# 2) Set receiver package (edit if needed)
export CLAWPERATOR_RECEIVER_PACKAGE="${CLAWPERATOR_RECEIVER_PACKAGE:-app.actiontask.operator.development}"
# 3) Baseline app package should be broadly available on Android devices.
export BASELINE_APP_PACKAGE="${BASELINE_APP_PACKAGE:-com.android.settings}"

SMOKE_SUMMARY="${CLAWPERATOR_SMOKE_SUMMARY:-}"
OUTCOMES_FILE=""
if [ -n "$SMOKE_SUMMARY" ]; then
  OUTCOMES_FILE=$(mktemp)
  trap 'rm -f "$OUTCOMES_FILE"' EXIT
fi
SMOKE_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

CLI=(node apps/node/dist/cli/index.js)

resolve_device_id() {
  if [ -n "$DEVICE_ID" ]; then
    return 0
  fi
  local devices
  devices="$(adb devices | awk 'NR>1 && $2=="device" {print $1}')"
  local count
  count="$(printf '%s\n' "$devices" | sed '/^$/d' | wc -l | tr -d ' ')"
  if [ "$count" -eq 1 ]; then
    DEVICE_ID="$(printf '%s\n' "$devices" | sed '/^$/d')"
    export DEVICE_ID
    echo "Auto-selected DEVICE_ID=$DEVICE_ID"
    return 0
  fi
  echo "ERROR: DEVICE_ID is not set and $count connected devices were found." >&2
  echo "Set DEVICE_ID=<serial> and re-run." >&2
  adb devices >&2 || true
  exit 1
}

resolve_device_id

# 4) Sanity checks
echo "=== devices ==="
"${CLI[@]}" devices --output pretty
echo "=== packages list (third-party) ==="
PACKAGES_JSON="$("${CLI[@]}" packages list --device-id "$DEVICE_ID" --third-party --output json)"
echo "$PACKAGES_JSON" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(JSON.stringify(d, null, 2));'

if ! echo "$PACKAGES_JSON" | grep -q "\"$CLAWPERATOR_RECEIVER_PACKAGE\""; then
  echo "ERROR: receiver package not found in packages list: $CLAWPERATOR_RECEIVER_PACKAGE" >&2
  exit 1
fi
# Baseline may be system app (e.g. com.android.settings); check full list if not in third-party
if ! echo "$PACKAGES_JSON" | grep -q "\"$BASELINE_APP_PACKAGE\""; then
  PACKAGES_ALL="$("${CLI[@]}" packages list --device-id "$DEVICE_ID" --output json 2>/dev/null)" || true
  if ! echo "${PACKAGES_ALL:-}" | grep -q "\"$BASELINE_APP_PACKAGE\""; then
    echo "ERROR: baseline app package not found: $BASELINE_APP_PACKAGE" >&2
    exit 1
  fi
fi
echo "Package precheck passed: receiver + baseline app present."

# 5) Minimal direct execute (close/open/sleep/snapshot)
SMOKE_JSON="/tmp/clawperator-smoke-exec.json"
cat > "$SMOKE_JSON" <<JSON
{
  "commandId": "smoke-cmd-1",
  "taskId": "smoke-task-1",
  "source": "smoke-test",
  "timeoutMs": 60000,
  "actions": [
    { "id": "close", "type": "close_app", "params": { "applicationId": "$BASELINE_APP_PACKAGE" } },
    { "id": "open", "type": "open_app", "params": { "applicationId": "$BASELINE_APP_PACKAGE" } },
    { "id": "wait", "type": "sleep", "params": { "durationMs": 3000 } },
    { "id": "snap", "type": "snapshot_ui", "params": { "format": "ascii" } }
  ]
}
JSON

echo "=== execute (minimal) ==="
if [ -n "$SMOKE_SUMMARY" ]; then
  EXEC_JSON="$("${CLI[@]}" execute --device-id "$DEVICE_ID" --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" --execution "$SMOKE_JSON" --output json 2>&1)" || true
  echo "$EXEC_JSON" | node -e 'const d=require("fs").readFileSync(0,"utf8"); try { const j=JSON.parse(d); console.log(JSON.stringify({ step: "execute", result: j.terminalSource ? "ok" : (j.code === "RESULT_ENVELOPE_TIMEOUT" ? "timeout" : "error"), terminalSource: j.terminalSource || undefined, timeoutDiagnostics: j.code === "RESULT_ENVELOPE_TIMEOUT" ? j : undefined })); } catch(e) { console.log(JSON.stringify({ step: "execute", result: "error" })); }' >> "$OUTCOMES_FILE"
  echo "$EXEC_JSON" | node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(0,"utf8")),null,2))'
else
  EXEC_OUT="$("${CLI[@]}" execute --device-id "$DEVICE_ID" --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" --execution "$SMOKE_JSON" --output pretty)" || true
  echo "$EXEC_OUT"
fi
# Stage 1: timeout with correct diagnostics is acceptable; continue to observe/inspect
if [ -n "$SMOKE_SUMMARY" ]; then
  EXEC_OUT="$EXEC_JSON"
fi
if echo "$EXEC_OUT" | grep -q '"terminalSource"'; then
  echo "Execute succeeded with terminal envelope (record terminalSource above)."
elif echo "$EXEC_OUT" | grep -q 'RESULT_ENVELOPE_TIMEOUT'; then
  echo "Execute timed out (diagnostics above); continuing to observe/inspect."
else
  echo "Execute failed with unexpected error; exiting." >&2
  exit 1
fi

# 6) Observe/inspect parity checks
echo "=== observe snapshot ==="
if [ -n "$SMOKE_SUMMARY" ]; then
  OBS_JSON="$("${CLI[@]}" observe snapshot --device-id "$DEVICE_ID" --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" --output json 2>&1)" || true
  echo "$OBS_JSON" | node -e 'const d=require("fs").readFileSync(0,"utf8"); try { const j=JSON.parse(d); console.log(JSON.stringify({ step: "observe", result: j.terminalSource ? "ok" : (j.code === "RESULT_ENVELOPE_TIMEOUT" ? "timeout" : "error"), terminalSource: j.terminalSource || undefined, timeoutDiagnostics: j.code === "RESULT_ENVELOPE_TIMEOUT" ? j : undefined })); } catch(e) { console.log(JSON.stringify({ step: "observe", result: "error" })); }' >> "$OUTCOMES_FILE"
  echo "$OBS_JSON" | node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(0,"utf8")),null,2))'
  OBS_OUT="$OBS_JSON"
else
  OBS_OUT="$("${CLI[@]}" observe snapshot --device-id "$DEVICE_ID" --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" --output pretty)" || true
  echo "$OBS_OUT"
fi
if echo "$OBS_OUT" | grep -q '"terminalSource"'; then echo "Observe: record terminalSource above."; fi
if echo "$OBS_OUT" | grep -q 'RESULT_ENVELOPE_TIMEOUT'; then echo "Observe: timeout (diagnostics above)."; fi

echo "=== inspect ui ==="
if [ -n "$SMOKE_SUMMARY" ]; then
  INS_JSON="$("${CLI[@]}" inspect ui --device-id "$DEVICE_ID" --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" --output json 2>&1)" || true
  echo "$INS_JSON" | node -e 'const d=require("fs").readFileSync(0,"utf8"); try { const j=JSON.parse(d); console.log(JSON.stringify({ step: "inspect", result: j.terminalSource ? "ok" : (j.code === "RESULT_ENVELOPE_TIMEOUT" ? "timeout" : "error"), terminalSource: j.terminalSource || undefined, timeoutDiagnostics: j.code === "RESULT_ENVELOPE_TIMEOUT" ? j : undefined })); } catch(e) { console.log(JSON.stringify({ step: "inspect", result: "error" })); }' >> "$OUTCOMES_FILE"
  echo "$INS_JSON" | node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(0,"utf8")),null,2))'
  INS_OUT="$INS_JSON"
else
  INS_OUT="$("${CLI[@]}" inspect ui --device-id "$DEVICE_ID" --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" --output pretty)" || true
  echo "$INS_OUT"
fi
if echo "$INS_OUT" | grep -q '"terminalSource"'; then echo "Inspect: record terminalSource above."; fi
if echo "$INS_OUT" | grep -q 'RESULT_ENVELOPE_TIMEOUT'; then echo "Inspect: timeout (diagnostics above)."; fi

# 7) Optional action wrapper checks (may vary by OEM/locale and should not fail the entire smoke)
echo "=== action read (optional) ==="
if ! "${CLI[@]}" action read \
  --device-id "$DEVICE_ID" \
  --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" \
  --selector '{"resourceId":"android:id/title"}' \
  --output pretty; then
  echo "WARN: optional action read failed on this device/locale; continuing."
fi

echo "=== action type (optional) ==="
if ! "${CLI[@]}" action type \
  --device-id "$DEVICE_ID" \
  --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" \
  --selector '{"role":"textfield"}' \
  --text "test" \
  --output pretty; then
  echo "WARN: optional action type failed (expected on some screens); continuing."
fi

if [ -n "$SMOKE_SUMMARY" ]; then
  SUMMARY_PATH="$SMOKE_SUMMARY" \
  OUTCOMES_PATH="$OUTCOMES_FILE" \
  SUMMARY_TIMESTAMP="$SMOKE_TIMESTAMP" \
  SUMMARY_DEVICE_ID="$DEVICE_ID" \
  SUMMARY_RECEIVER_PACKAGE="$CLAWPERATOR_RECEIVER_PACKAGE" \
  SUMMARY_STRICT_MODE="true" \
  node -e '
    const fs = require("fs");
    const path = process.env.SUMMARY_PATH;
    const outcomesPath = process.env.OUTCOMES_PATH;
    if (!path || !outcomesPath) {
      console.error("Missing SUMMARY_PATH or OUTCOMES_PATH");
      process.exit(1);
    }
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}
    const lines = fs.readFileSync(outcomesPath, "utf8").trim().split("\n").filter(Boolean);
    const commandOutcomes = lines.map((l) => JSON.parse(l));
    const summary = {
      ...existing,
      timestamp: process.env.SUMMARY_TIMESTAMP,
      deviceId: process.env.SUMMARY_DEVICE_ID,
      receiverPackage: process.env.SUMMARY_RECEIVER_PACKAGE,
      commandOutcomes,
      strictMode: process.env.SUMMARY_STRICT_MODE === "true",
    };
    fs.writeFileSync(path, JSON.stringify(summary, null, 2));
    console.log("Wrote smoke summary to", path);
  '
fi
echo "=== smoke done ==="
