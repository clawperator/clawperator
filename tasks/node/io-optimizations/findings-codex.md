# Findings: Snapshot I/O And Transport Overhead

Date: 2026-04-25

## Verified current snapshot transport

The current `clawperator snapshot` path does **not** return snapshot data by pulling a file from Android.

Verified flow:

1. Node sends the command with `adb shell am broadcast ... --es payload <json>` via `apps/node/src/adapters/android-bridge/broadcastAgentCommand.ts`.
2. Node starts `adb logcat` and waits for a `[Clawperator-Result]` envelope via `apps/node/src/adapters/android-bridge/logcatResultReader.ts`.
3. Android generates the UI hierarchy and logs it with `Log.d("$TAG UI Hierarchy:\n$hierarchyDump")` in `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt`.
4. Android logs the final `[Clawperator-Result] <json>` line in `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandExecutorDefault.kt`.
5. After the envelope arrives, Node runs `adb logcat -d -v tag`, extracts the snapshot text from logs, and attaches it to the `snapshot_ui` step in `apps/node/src/domain/executions/runExecution.ts`.

Conclusion: snapshot result transport is **logcat-based**, not file-pull-based.

For contrast, recordings are written on-device and pulled with `adb pull` in `apps/node/src/domain/recording/pullRecording.ts`.

## Measured snapshot timing on Samsung device

Measured device:

- `<device_serial>`
- model `SM_S901E`
- package used for local validation: `com.clawperator.operator.dev`

Measured command:

```bash
node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev
```

Measured end-to-end wall clock:

- run 1: `2291.6 ms`
- instrumented run: `1889 ms`

Observed successful snapshot result:

- `envelope.status = success`
- `terminalSource = clawperator_result`
- `snapshot_ui.success = true`
- `actual_format = hierarchy_xml`
- `foreground_package = com.solaxcloud.starter`
- `has_overlay = true`
- `overlay_package = com.sec.android.app.launcher`
- `window_count = 3`
- extracted snapshot text length: about `87 KB` (`87442` chars)

## Verified overhead in current implementation

The current implementation adds several host/device round trips around a single snapshot:

1. APK presence check on every call in `apps/node/src/domain/executions/runExecution.ts`.
2. Interactive readiness check on every call in `apps/node/src/domain/executions/runExecution.ts`.
3. `adb logcat -c` on every call in `apps/node/src/domain/executions/runExecution.ts`.
4. Fresh `adb logcat -v time -T 1` process per call in `apps/node/src/adapters/android-bridge/logcatResultReader.ts`.
5. Fixed `300 ms` delay before dispatching the broadcast in `apps/node/src/adapters/android-bridge/logcatResultReader.ts`.
6. Second logcat pass with `adb logcat -d -v tag` to recover the actual snapshot payload in `apps/node/src/domain/executions/runExecution.ts`.

## Measured low-hanging fruit from logs

From the debug log for the instrumented run:

- `adb devices`: `12 ms`
- `adb shell pm list packages com.clawperator.operator.dev`: `77 ms`
- `adb logcat -c`: `182 ms`
- first broadcast round trip: `117 ms`
- second broadcast round trip: `99 ms`
- fixed broadcast delay before each envelope wait: `300 ms`
- `adb logcat -d -v tag`: `69 ms`

These measurements confirm that a large part of the current snapshot time is protocol overhead rather than pure snapshot generation cost.

## Practical optimization options

### Option 1: Cache preflight state across calls

Cache or skip when recently validated:

- device resolution
- APK presence
- interactive readiness

This is the safest first pass and should reduce repeated overhead without changing the Android contract.

### Option 2: Remove or reduce the fixed 300 ms broadcast delay

Current behavior guarantees at least `300 ms` of latency per envelope wait, even on fast devices. This is a direct per-call tax.

### Option 3: Stop clearing logcat for every command

`adb logcat -c` is currently run before each command. That is measurable overhead and also makes the transport more brittle than correlating strictly by `commandId`.

### Option 4: Stop using logcat twice for snapshots

Current snapshot transport uses:

- one logcat stream to detect command completion
- one logcat dump to reconstruct the snapshot XML

That second pass should be removed if possible.

### Option 5: Return snapshot payload directly in the result envelope

Best medium-term fix: include the snapshot payload directly in the command result path rather than logging the XML separately and scraping it back out later.

This would remove:

- `adb logcat -d -v tag`
- log-scraping/parser work for snapshot reconstruction
- some correlation fragility

### Option 6: Move away from per-call `adb` process spawning

If the goal is multiple snapshots per second, repeated:

- `adb shell am broadcast ...`
- `adb logcat ...`
- `adb logcat -d ...`

is the wrong long-term shape. A persistent session or socket-based transport is the better direction.

### Option 7: Add a lighter-weight snapshot mode

Current successful snapshot text was about `87 KB` of `hierarchy_xml`. If many agent loops do not need the full hierarchy dump every time, a more compact snapshot representation would reduce transport and parsing cost further.

## Recommendation order

Recommended sequence:

1. Cache preflight state and remove redundant repeated checks.
2. Remove or sharply reduce the fixed `300 ms` dispatch delay.
3. Eliminate per-call `logcat -c`.
4. Return snapshot payload directly instead of recovering it with a second logcat pass.
5. If multi-Hz snapshots are still required, redesign transport around a persistent channel.

## Bottom line

The measured latency is bad, but the result is encouraging: there is substantial low-hanging fruit in the Node/ADB transport path. The code currently pays a large fixed overhead around each snapshot, so meaningful wins should be available before any deep Android-side rewrite.
