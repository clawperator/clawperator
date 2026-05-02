---
name: test-io-speeds
description: Measure Clawperator snapshot and daemon I/O latency on Android devices. Use when comparing emulator versus physical-device performance, timing repeated snapshot calls, validating release versus debug APK behavior, or producing performance findings for specific apps/screens.
---

# Test I/O Speeds

Measure repeated `snapshot` latency with the branch-local Node CLI, a locally
built Operator APK, and explicit device selection.

## Inputs

Ask for or infer these inputs:

- target device serial, after running `adb devices -l`
- Operator variant, usually release package `com.clawperator.operator`
- app list, each with:
  - `id`
  - `name`
  - `packageName`
  - optional screen-prep notes to perform manually before measurement
- output directory for local artifacts

If the caller does not specify apps, use this default app list:

- Android Settings: `com.android.settings`
- YouTube: `com.google.android.youtube`
- Google Play Store: `com.android.vending`

If the caller wants other apps measured, ask them to provide an app list with
`id`, `name`, and `packageName` for each app, then pass it with `--apps-file`
or `--apps-json`.

The harness first closes each target app through branch-local Clawperator
`close --app`, then opens it through `open --app`. Do not hardcode Android
activity names in the default app set; let the device resolve the launch
activity from a clean app start.

## Required Method

1. Check devices first.

   ```bash
   adb devices -l
   node apps/node/dist/cli/index.js devices --format json
   ```

2. Build branch-local Node before using `dist/`.

   ```bash
   npm --prefix apps/node run build
   ```

3. Build the APK variant being tested.

   For release timing:

   ```bash
   ./gradlew :app:assembleRelease
   ```

4. Install and grant the matching Operator package.

   For release timing:

   ```bash
   adb -s <device_serial> install apps/android/app/build/outputs/apk/release/app-release.apk
   ./scripts/clawperator_grant_android_permissions.sh --release --serial <device_serial>
   ```

   If signature mismatch blocks install, uninstall only the target Operator
   package after confirming the package is the one being tested.

5. Enable Android timing logs only for the measurement run.

   ```bash
   adb -s <device_serial> shell setprop log.tag.ClawpSnapshotTiming DEBUG
   ```

6. Run the harness from the repo root.

   ```bash
   node .agents/skills/test-io-speeds/scripts/measure-snapshot-latency.mjs \
     --device <device_serial> \
     --operator-package com.clawperator.operator \
     --out-dir tasks/node/io-optimizations/<date>-timing-artifacts \
     --warmups 3 \
     --measured 10
   ```

   To provide a custom app list:

   ```bash
   node .agents/skills/test-io-speeds/scripts/measure-snapshot-latency.mjs \
     --device <device_serial> \
     --apps-file /path/to/apps.json
   ```

7. Confirm every measured result contains a valid snapshot text payload. Do not
   rely on exit code alone.

8. Summarize the JSON outputs into a markdown report. Do not commit raw artifact
   JSON, logcat captures, host logs, screen text, or local device serials.

## Harness Output

For each app, the harness writes:

- `<app-id>.json`
- `<app-id>-direct-daemon.json`

The normal mode removes raw host logs after extracting summary timing. Passing
`--keep-raw-logs` keeps host logs and logcat captures locally for debugging;
those files must not be committed.

## What To Report

Report:

- commit and version tested
- APK variant, package id, and sha256
- device serial redacted if the report will be committed
- emulator or physical model and Android version
- app package and screen context
- warmup count and measured count
- per-call wall time, payload bytes, node count
- mean, median, min, max, and p95
- direct daemon mean and median
- Android operator snapshot timing when `ClawpSnapshotTiming` logs are present
- failed runs, timeouts, app readiness issues, and instrumentation caveats

## Interpretation Rules

- Fresh CLI timing includes process startup, CLI parsing, daemon discovery,
  daemon proxying, result parsing, and output formatting.
- Direct daemon timing removes fresh CLI startup and is the better proxy for a
  future persistent client.
- Release APK timing is the product baseline. Debug APK timing is useful only
  for local development diagnostics.
- Emulator and physical-device results are not interchangeable. Record both
  when comparing them.
