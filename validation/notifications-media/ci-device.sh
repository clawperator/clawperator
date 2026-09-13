#!/usr/bin/env bash
set -euo pipefail
serial="$(adb devices | awk '$2 == "device" { print $1; exit }')"
test -n "$serial"
node apps/node/dist/cli/index.js operator setup --apk apps/android/app/build/outputs/apk/debug/app-debug.apk --device "$serial" --operator-package com.clawperator.operator.dev
python3 validation/notifications-media/run.py --device "$serial" --output artifacts/notifications-media --secure-lock --controls
