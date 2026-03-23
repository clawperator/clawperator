#!/usr/bin/env bash
set -euo pipefail

# This integration test script validates that the Clawperator CLI
# accurately detects integration/host issues like missing adb, no devices,
# or no APK installed. It uses both PATH poisoning and a fake adb script.

REQ_NODE="$(command -v node)"
ORIGINAL_PATH="$PATH"

REPO_ROOT="$(pwd)"
CLI_VERSION="$(node -p "require('$REPO_ROOT/apps/node/package.json').version")"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== Scenario 1: NO_ADB (PATH Poisoning) ==="
# Link essential tools so the script and node can run
TMP_BIN="$TMP_DIR/bin1"
mkdir -p "$TMP_BIN"
ln -s "$REQ_NODE" "$TMP_BIN/node"
ln -s "$(which grep)" "$TMP_BIN/grep"
ln -s "$(which cat)" "$TMP_BIN/cat"
ln -s "$(which rm)" "$TMP_BIN/rm"
ln -s "$(which cp)" "$TMP_BIN/cp"

# Run doctor from source with poisoned path
export PATH="$TMP_BIN"
export HOME="/tmp"

set +e
node "$REPO_ROOT/apps/node/dist/cli/index.js" doctor --json > "$TMP_DIR/out1.json"
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "[Error] Doctor should have exited with a non-zero code when adb is missing!"
  exit 1
fi

if grep -q "ADB_NOT_FOUND" "$TMP_DIR/out1.json"; then
  echo "[Success] ADB_NOT_FOUND error code emitted."
else
  echo "[Error] ADB_NOT_FOUND error code not found in output."
  cat "$TMP_DIR/out1.json"
  exit 1
fi

# Reset environments for other scenarios
export PATH="$ORIGINAL_PATH"
export HOME="$TMP_DIR"

echo "=== Scenario 2: NO_DEVICE (Fake ADB) ==="
TMP_BIN2="$TMP_DIR/bin2"
mkdir -p "$TMP_BIN2"
# Link node normally
ln -s "$REQ_NODE" "$TMP_BIN2/node"
# Inject our fake ADB
cp "$REPO_ROOT/scripts/fake_adb.sh" "$TMP_BIN2/adb"
chmod +x "$TMP_BIN2/adb"

export PATH="$TMP_BIN2:$PATH"
export FAKE_ADB_SCENARIO="NO_DEVICE"

set +e
node "$REPO_ROOT/apps/node/dist/cli/index.js" doctor --json > "$TMP_DIR/out2.json"
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "[Error] Doctor should have exited with a non-zero code when no devices are connected!"
  exit 1
fi

if grep -q "NO_DEVICES" "$TMP_DIR/out2.json"; then
  echo "[Success] NO_DEVICES error code emitted."
else
  echo "[Error] NO_DEVICES error code not found in output."
  cat "$TMP_DIR/out2.json"
  exit 1
fi

echo "=== Scenario 3: NO_APK (Fake ADB) ==="
export FAKE_ADB_SCENARIO="NO_APK"

set +e
node "$REPO_ROOT/apps/node/dist/cli/index.js" doctor --json > "$TMP_DIR/out3.json"
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "[Error] Doctor should have exited with a non-zero code when the APK is missing!"
  exit 1
fi

if grep -q "OPERATOR_NOT_INSTALLED" "$TMP_DIR/out3.json"; then
  echo "[Success] OPERATOR_NOT_INSTALLED error code emitted."
else
  echo "[Error] OPERATOR_NOT_INSTALLED error code not found in output."
  cat "$TMP_DIR/out3.json"
  exit 1
fi

if grep -q '"criticalOk": false' "$TMP_DIR/out3.json"; then
  echo "[Success] criticalOk reports that core setup is not usable."
else
  echo "[Error] criticalOk should be false when the APK is missing."
  cat "$TMP_DIR/out3.json"
  exit 1
fi

if grep -q '"id": "readiness.handshake"' "$TMP_DIR/out3.json"; then
  echo "[Error] Handshake should be skipped when the APK is missing."
  cat "$TMP_DIR/out3.json"
  exit 1
else
  echo "[Success] Handshake skipped when APK is missing."
fi

echo "=== Scenario 4: CHECK_ONLY (Fake ADB) ==="
export FAKE_ADB_SCENARIO="NO_DEVICE"

set +e
node "$REPO_ROOT/apps/node/dist/cli/index.js" doctor --json --check-only > "$TMP_DIR/out4.json"
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "[Error] Doctor --check-only should always exit 0."
  exit 1
fi

if grep -q "NO_DEVICES" "$TMP_DIR/out4.json"; then
  echo "[Success] --check-only preserves the failing diagnostics."
else
  echo "[Error] NO_DEVICES error code not found in --check-only output."
  cat "$TMP_DIR/out4.json"
  exit 1
fi

echo "=== Scenario 5: VERSION_MISMATCH (Fake ADB) ==="
export FAKE_ADB_SCENARIO="VERSION_MISMATCH"

set +e
node "$REPO_ROOT/apps/node/dist/cli/index.js" doctor --json > "$TMP_DIR/out5.json"
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "[Error] Doctor should have exited with a non-zero code when the APK version mismatches!"
  exit 1
fi

if grep -q "VERSION_INCOMPATIBLE" "$TMP_DIR/out5.json"; then
  echo "[Success] VERSION_INCOMPATIBLE error code emitted."
else
  echo "[Error] VERSION_INCOMPATIBLE error code not found in output."
  cat "$TMP_DIR/out5.json"
  exit 1
fi

if grep -q '"criticalOk": false' "$TMP_DIR/out5.json"; then
  echo "[Success] criticalOk reports that version mismatch is blocking."
else
  echo "[Error] criticalOk should be false when the APK version mismatches."
  cat "$TMP_DIR/out5.json"
  exit 1
fi

if grep -q "https://downloads.clawperator.com/operator/v${CLI_VERSION}/operator-v${CLI_VERSION}.apk" "$TMP_DIR/out5.json"; then
  echo "[Success] versioned APK remediation URL emitted."
else
  echo "[Error] versioned APK remediation URL missing from output."
  cat "$TMP_DIR/out5.json"
  exit 1
fi

if grep -q '"id": "readiness.handshake"' "$TMP_DIR/out5.json"; then
  echo "[Error] Handshake should be skipped when the APK version mismatches."
  cat "$TMP_DIR/out5.json"
  exit 1
else
  echo "[Success] Handshake skipped when APK version mismatches."
fi

echo "=== All integration tests passed successfully! ==="
