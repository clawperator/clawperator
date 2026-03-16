#!/usr/bin/env bash
set -euo pipefail

if [ "${CLAWPERATOR_RUN_INTEGRATION:-0}" != "1" ]; then
  echo "Skipping integration (CLAWPERATOR_RUN_INTEGRATION not 1)"
  exit 0
fi

cd "$(dirname "$0")/.."

npm --prefix apps/node run build

export DEVICE_ID="${DEVICE_ID:-}"
export CLAWPERATOR_RECEIVER_PACKAGE="${CLAWPERATOR_RECEIVER_PACKAGE:-com.clawperator.operator.dev}"
SKILL_ID="${SKILL_ID:-com.google.android.apps.chromecast.app.get-aircon-status}"
ARTIFACT_NAME="${ARTIFACT_NAME:-ac-status}"
AC_TILE_NAME="${AC_TILE_NAME:-Master}"

CLI=(node apps/node/dist/cli/index.js)

echo "=== integration: compile artifact ==="
"${CLI[@]}" skills compile-artifact "$SKILL_ID" --artifact "$ARTIFACT_NAME" --vars "{\"AC_TILE_NAME\":\"$AC_TILE_NAME\"}" --output json \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); if (!d.execution) process.exit(1); require("fs").writeFileSync("/tmp/clawperator-integration-exec.json", JSON.stringify(d.execution));'

echo "=== integration: execute on device ==="
EXEC_OUT="$("${CLI[@]}" execute --device-id "$DEVICE_ID" --receiver-package "$CLAWPERATOR_RECEIVER_PACKAGE" --execution /tmp/clawperator-integration-exec.json --output json 2>&1)" || true

echo "$EXEC_OUT" | node -e '
const data = require("fs").readFileSync(0, "utf8");
let j;
try { j = JSON.parse(data); } catch (e) { console.error("Invalid JSON:", e.message); process.exit(2); }
if (j.code && j.code !== "USAGE") {
  console.error("Execute failed:", j.code, j.message || "");
  process.exit(3);
}
if (j.terminalSource !== "clawperator_result") {
  console.error("Expected terminalSource=clawperator_result, got:", j.terminalSource);
  process.exit(4);
}
if (!j.envelope || j.envelope.status !== "success") {
  console.error("Expected envelope.status=success, got:", j.envelope?.status);
  process.exit(5);
}
console.log("Integration OK: terminalSource=clawperator_result, status=success");
'
exit $?
