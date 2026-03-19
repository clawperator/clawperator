#!/bin/bash
set -euo pipefail

ADB_BIN="${ADB_BIN:-adb}"
SCRCPY_BIN="${SCRCPY_BIN:-scrcpy}"
DEVICE_ID="${1:-}"

if ! command -v "$ADB_BIN" >/dev/null 2>&1; then
  echo "Error: adb not found on PATH. Install Android platform-tools." >&2
  exit 1
fi

if ! command -v "$SCRCPY_BIN" >/dev/null 2>&1; then
  echo "Error: scrcpy not found on PATH. Install with: brew install scrcpy" >&2
  exit 1
fi

list_connected_devices() {
  "$ADB_BIN" devices | awk 'NR>1 && $2=="device" {print $1}'
}

if [[ -n "$DEVICE_ID" ]]; then
  TARGET_DEVICE="$DEVICE_ID"
  if ! list_connected_devices | grep -Fxq "$TARGET_DEVICE"; then
    echo "Error: device $TARGET_DEVICE is not connected/authorized via adb." >&2
    exit 1
  fi
else
  DEVICES=()
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    DEVICES+=("$line")
  done < <(list_connected_devices)
  if [[ ${#DEVICES[@]} -eq 0 ]]; then
    echo "Error: no connected Android devices detected via adb." >&2
    exit 1
  fi
  TARGET_DEVICE="${DEVICES[0]}"
  if [[ ${#DEVICES[@]} -gt 1 ]]; then
    echo "Note: multiple devices detected; using first: $TARGET_DEVICE" >&2
  fi
fi

# Launch scrcpy detached and read-only so it cannot interfere with automation input.
nohup "$SCRCPY_BIN" --serial "$TARGET_DEVICE" --no-control >/dev/null 2>&1 &

echo "Launched scrcpy in read-only mode for device $TARGET_DEVICE"
