#!/usr/bin/env bash
set -euo pipefail

# This integration test script validates that the Clawperator CLI
# accurately detects a missing "adb" executable without crashing unexpectedly.

TMP_BIN=$(mktemp -d)

# Link essential tools so the script and node can run
ln -s $(which node) $TMP_BIN/node
ln -s $(which grep) $TMP_BIN/grep
ln -s $(which cat) $TMP_BIN/cat
ln -s $(which rm) $TMP_BIN/rm

export PATH="$TMP_BIN"
export HOME="/tmp"

echo "[Test] Running 'clawperator doctor' with poisoned PATH..."

cd apps/node
set +e
node dist/cli/index.js doctor --json > /tmp/doctor_output.json
EXIT_CODE=$?
set -e

echo "[Test] CLI exited with code: $EXIT_CODE"

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "[Error] Doctor should have exited with a non-zero code when adb is missing!"
  exit 1
fi

if grep -q "ADB_NOT_FOUND" /tmp/doctor_output.json; then
  echo "[Success] ADB_NOT_FOUND error code emitted in JSON."
else
  echo "[Error] ADB_NOT_FOUND error code not found in output."
  cat /tmp/doctor_output.json
  exit 1
fi

echo "[Test] Passed: gracefully handled missing adb dependency."
rm -rf $TMP_BIN
