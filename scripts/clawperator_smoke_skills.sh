#!/usr/bin/env bash
# Skills smoke for Clawperator Node API.
# Evidence-oriented: exercises skills list/get/compile-artifact and execute path.
# Usage: one physical device connected (or set DEVICE_ID); edit env vars if needed.
# Optional: CLAWPERATOR_SMOKE_SUMMARY=/path/to/summary.json to write a machine-readable JSON summary.
set -euo pipefail

cd "$(dirname "$0")/.."

# Build Node CLI
npm --prefix apps/node run build

# Device selection: set DEVICE_ID or let the script auto-select from adb.
# NOTE: Do not commit personal device serials to this repository.
export DEVICE_ID="${DEVICE_ID:-}"
export CLAWPERATOR_RECEIVER_PACKAGE="${CLAWPERATOR_RECEIVER_PACKAGE:-com.clawperator.operator.dev}"
export SKILL_ID="${SKILL_ID:-com.google.android.apps.chromecast.app.get-climate}"
export ARTIFACT_NAME="${ARTIFACT_NAME:-climate-status}"
export CLIMATE_TILE_NAME="${CLIMATE_TILE_NAME:-Master}"

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

echo "=== skills list ==="
"${CLI[@]}" skills list --output pretty

echo "=== skills get $SKILL_ID ==="
"${CLI[@]}" skills get "$SKILL_ID" --output pretty

echo "=== skills compile-artifact (pretty) ==="
"${CLI[@]}" skills compile-artifact "$SKILL_ID" --artifact "$ARTIFACT_NAME" --vars "{\"CLIMATE_TILE_NAME\":\"$CLIMATE_TILE_NAME\"}" --output pretty

echo "=== skills compile-artifact (json -> /tmp/clawperator-smoke-exec.json) ==="
"${CLI[@]}" skills compile-artifact "$SKILL_ID" --artifact "$ARTIFACT_NAME" --vars "{\"CLIMATE_TILE_NAME\":\"$CLIMATE_TILE_NAME\"}" --json \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); require("fs").writeFileSync("/tmp/clawperator-smoke-exec.json", JSON.stringify(d.execution));'

echo "=== execute compiled execution ==="
if [ -n "$SMOKE_SUMMARY" ]; then
  EXEC_JSON="$("${CLI[@]}" execute --device "$DEVICE_ID" --operator-package "$CLAWPERATOR_RECEIVER_PACKAGE" --execution /tmp/clawperator-smoke-exec.json --json 2>&1)" || true
  echo "$EXEC_JSON" | node -e 'const d=require("fs").readFileSync(0,"utf8"); try { const j=JSON.parse(d); console.log(JSON.stringify({ step: "execute", result: j.terminalSource ? "ok" : (j.code === "RESULT_ENVELOPE_TIMEOUT" ? "timeout" : "error"), terminalSource: j.terminalSource || undefined, timeoutDiagnostics: j.code === "RESULT_ENVELOPE_TIMEOUT" ? j : undefined })); } catch(e) { console.log(JSON.stringify({ step: "execute", result: "error" })); }' >> "$OUTCOMES_FILE"
  echo "$EXEC_JSON" | node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(0,"utf8")),null,2))'
  EXEC_OUT="$EXEC_JSON"
else
  EXEC_OUT="$("${CLI[@]}" execute --device "$DEVICE_ID" --operator-package "$CLAWPERATOR_RECEIVER_PACKAGE" --execution /tmp/clawperator-smoke-exec.json --output pretty 2>&1)" || true
  echo "$EXEC_OUT"
fi
if echo "$EXEC_OUT" | grep -q '"terminalSource"'; then
  echo "Skills smoke: execution succeeded with terminal envelope (record terminalSource above)."
elif echo "$EXEC_OUT" | grep -q 'RESULT_ENVELOPE_TIMEOUT'; then
  echo "Skills smoke: execution timed out (diagnostics above; RESULT_ENVELOPE_TIMEOUT contract holds)."
else
  echo "Skills smoke: execution failed with unexpected error; see output above." >&2
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
echo "=== skills smoke done ==="
