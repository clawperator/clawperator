#!/usr/bin/env bash
set -euo pipefail

# This integration test script validates that the Clawperator CLI
# accurately detects integration/host issues like missing adb, no devices,
# or no APK installed. It uses both PATH poisoning and a fake adb script.

REQ_NODE="$(which node)"
ORIGINAL_PATH="$PATH"

REPO_ROOT="$(pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== Scenario 1: NO_ADB (PATH Poisoning) ==="
# Link essential tools so the script and node can run
TMP_BIN="$TMP_DIR/bin1"
mkdir -p "$TMP_BIN"
ln -s "$REQ_NODE" "$TMP_BIN/node"
ln -s "$(which grep)" "$TMP_BIN/grep"
ln -s "$(which cat)" "$TMP_BIN/cat"

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
  echo "[Error] Doctor should have exited with a non-zero code when APK is missing!"
  exit 1
fi

if grep -q "RECEIVER_NOT_INSTALLED" "$TMP_DIR/out3.json"; then
  echo "[Success] RECEIVER_NOT_INSTALLED error code emitted."
else
  echo "[Error] RECEIVER_NOT_INSTALLED error code not found in output."
  cat "$TMP_DIR/out3.json"
  exit 1
fi

echo "=== All integration tests passed successfully! ==="
