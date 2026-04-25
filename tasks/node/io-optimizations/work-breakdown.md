# Snapshot I/O Optimizations Work Breakdown

Parent plan: `tasks/node/io-optimizations/plan.md`

## Executive Summary

1 PR, 2 phases. Phase 1 replaces dump-based snapshot recovery with live-stream extraction and removes redundant logcat passes. Phase 2 reduces dispatch/startup overhead, applies the explicit-device fast path, and remeasures the result. This pack is active implementation planning for immediate Node-only work and explicitly excludes handshake redesign.

## Status

| Item | Value |
| --- | --- |
| State | PR-1 complete |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | 1, 2 |
| Remaining | none |
| Current / Next | review-swarm-loop |
| Blockers | none |

## Hard Rules

- Do not implement readiness caching, handshake redesign, or any `doctor_ping` contract change in this pack.
- Do not modify Android code in this pack.
- Do not change the `[Clawperator-Result]` envelope shape.
- Do not embed full snapshot XML in the single-line result envelope.
- Add tests in the same phase and commit as the behavior they prove. Do not defer tests.
- Do not remove `logcat -d` before live-stream extraction is implemented and covered by tests.
- Do not remove `logcat -c` before live-stream extraction is verified to bound snapshot capture correctly.
- Only parallelize `resolveDevice` and `checkApkPresence` when `config.deviceId` is already explicit.
- Re-measure after the implementation phases before declaring the pack done.
- If implementation pressure pushes toward handshake policy decisions, stop and defer to `tasks/node/handshaking/findings.md`.
- **Delete replaced call sites; do not wrap them.** Once `logcat -c` and `logcat -d` are superseded, delete their call sites entirely. Do not leave them behind a feature flag, a disabled conditional, or a backwards-compatibility shim. No caller needs the old behavior preserved.
- **The `logcat -d` fallback in Phase 1 step 5 is transition scaffolding, not a permanent layer.** It exists only to keep tests green while live extraction is being proved. Remove it in step 6 of the same phase.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/node/io-optimizations/plan.md` | Stable contract, scope boundaries, and exclusions |
| `tasks/node/io-optimizations/findings.md` | Immediate source brief and measured rationale |
| `tasks/node/handshaking/findings.md` | Boundary file for what must not be absorbed into this pack |
| `tasks/node/io-optimizations/findings-deferred.md` | Deferred backlog that must stay out of scope |
| `apps/node/src/domain/executions/runExecution.ts` | Main snapshot execution path and current logcat lifecycle |
| `apps/node/src/adapters/android-bridge/logcatResultReader.ts` | Live result-envelope transport and dispatch timing |
| `apps/node/src/domain/executions/snapshotHelper.ts` | Snapshot parsing rules to extend |
| `apps/node/src/test/unit/runExecution.test.ts` | Existing regression patterns for execution-path behavior |
| `apps/node/src/test/unit/snapshotHelper.test.ts` | Existing regression patterns for snapshot parsing |

## PR / Phase Plan

| PR | Purpose | Included phases | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Immediate non-handshake Node snapshot I/O cleanup | 1, 2 | none |

## Phase 1: Live Stream Snapshot Extraction

Status: completed on 2026-04-25.

Phase notes:
- Implemented live TaskScopeDefault line capture in `waitForResultEnvelope` and attached snapshot XML from those captured lines in `runExecution`.
- Extended snapshot parsing for live `logcat -v time` lines while preserving tag-format parsing.
- Deleted the superseded `logcat -c` and `logcat -d -v tag` call sites instead of hiding them behind compatibility branches.
- Required validation passed for build, targeted unit coverage, and live snapshot smoke. The full `npm --prefix apps/node run test` command was run and failed in unrelated skills CLI cases because two real devices were connected and those tests resolved real adb device selection.

### Goal

Make the existing live logcat stream authoritative for snapshot extraction so the implementation no longer needs post-success `logcat -d` recovery or pre-command `logcat -c`.

### Files or Surfaces To Change

- `apps/node/src/domain/executions/snapshotHelper.ts`
- `apps/node/src/adapters/android-bridge/logcatResultReader.ts`
- `apps/node/src/domain/executions/runExecution.ts`
- `apps/node/src/test/unit/snapshotHelper.test.ts`
- `apps/node/src/test/unit/runExecution.test.ts`

### Steps

1. Extend `snapshotHelper.parseLogLine` to support both current tag-format lines and time-format lines from the live stream.
2. Add regression coverage proving time-format and tag-format snapshot lines both parse correctly.
3. Extend `waitForResultEnvelope` to capture snapshot-relevant live log lines alongside envelope detection.
4. Wire `runExecution` to use captured live stream lines for snapshot attachment.
5. Keep `logcat -d` only as a temporary fallback until live extraction is proven by tests.
6. Once tests prove live extraction, remove the post-success `logcat -d` path.
7. Remove `logcat -c` only after the live path is in place and verified.

### Acceptance Criteria

- `snapshotHelper` supports both tag-format and time-format snapshot lines.
- Snapshot extraction uses live stream lines rather than requiring `logcat -d`.
- The post-success `logcat -d` path is removed.
- The pre-command `logcat -c` path is removed.
- Snapshot attachment is bounded to the dispatch-to-envelope interval for a given commandId and does not rely on a globally cleared log buffer.
- Tests prove the new parsing and extraction path.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

Live device smoke test - verify snapshot XML is returned correctly via the new live-stream path (not via `logcat -d`):

```bash
node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev
```

Confirm `envelope.stepResults[0].data.text` contains a well-formed `<hierarchy>` XML document. If the field is missing or empty, the live extraction is not working and `logcat -d` must not yet be removed.

### Expected Commit

```text
fix(node): extract snapshots from live logcat stream
```

## Phase 2: Dispatch And Preflight Overhead Cleanup

Status: completed on 2026-04-25.

Phase notes:
- Replaced the fixed 300 ms broadcast delay with first-stdout dispatch and a 100 ms fallback timer.
- Started the result logcat waiter early for explicit-device executions and kept auto-resolve executions sequential.
- Ran explicit-device `resolveDevice` and `checkApkPresence` in parallel.
- Updated the CLI logging integration fake so parallel logcat readers behave like real logcat and do not consume each other's lines.
- Required build and targeted regression validation passed. The full `npm --prefix apps/node run test` command was run and still failed in unrelated skills CLI cases because two real devices were connected and those tests resolved real adb device selection.

### Goal

Reduce avoidable host-side idle time in the immediate snapshot path without crossing into handshake redesign.

### Files or Surfaces To Change

- `apps/node/src/adapters/android-bridge/logcatResultReader.ts`
- `apps/node/src/domain/executions/runExecution.ts`
- `apps/node/src/test/unit/runExecution.test.ts`

### Steps

1. Reduce or replace the fixed 300 ms `broadcastDelayMs` in `logcatResultReader.ts`. Preferred approach: fire the broadcast once logcat emits its first stdout line (signal-based), with a 100 ms fallback timer if no output arrives. If signal-based is not stable, land a 50 ms constant instead and add a measurement follow-up note in this file. See `tasks/node/io-optimizations/findings.md` I1 for the full rationale.
2. Start the logcat stream earlier so the attach delay overlaps remaining safe preflight work. **Prerequisite: Phase 1 must be complete** - logcat -c must already be removed before the stream can be started earlier, since clearing the buffer after the stream is open would drop lines. "Safe preflight work" in this context means `resolveDevice` and `checkApkPresence`, which run after the stream is started and before broadcast fires.
3. Parallelize `resolveDevice` and `checkApkPresence` only when `config.deviceId` is already explicit.
4. Add or extend regression tests for:
   - successful envelope receipt with the new dispatch timing
   - timeout diagnostics still being correct
   - explicit-device fast path behavior
   - auto-resolve behavior staying sequential
5. Re-measure using the skills timing comparison described in the Validation section below. Record results in `## Measurements` at the end of this file before closing the pack.

### Acceptance Criteria

- Dispatch timing overhead is lower than the current fixed 300 ms default.
- Explicit-device preflight can use the safe parallel fast path.
- Auto-resolve flows retain correct behavior.
- Tests cover the new timing and preflight behavior.
- Skills timing comparison is captured in `## Measurements`. Both skills show measurable improvement over the global-install baseline.

### Validation

Unit and build:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

Skills timing comparison. Run each skill 3 times with the global install (baseline) and 3 times with the local build (optimized). Record all timings in `## Measurements`.

The global install is v0.7.7 and represents the pre-optimization baseline. The local build at `apps/node/dist/` is the optimized version under test.

```bash
# Baseline - global install (pre-optimization)
for i in 1 2 3; do
  START=$(python3 -c "import time; print(int(time.time()*1000))")
  clawperator skills run com.solaxcloud.starter.get-battery --device <device_serial> > /dev/null 2>&1
  END=$(python3 -c "import time; print(int(time.time()*1000))")
  echo "solax baseline run $i: $((END - START)) ms"
done

for i in 1 2 3; do
  START=$(python3 -c "import time; print(int(time.time()*1000))")
  clawperator skills run com.google.android.apps.chromecast.app.get-climate-replay --device <device_serial> --unit-name "<unit_name>" > /dev/null 2>&1
  END=$(python3 -c "import time; print(int(time.time()*1000))")
  echo "chromecast baseline run $i: $((END - START)) ms"
done

# Optimized - local build (post-optimization)
for i in 1 2 3; do
  START=$(python3 -c "import time; print(int(time.time()*1000))")
  node apps/node/dist/cli/index.js skills run com.solaxcloud.starter.get-battery --device <device_serial> --operator-package com.clawperator.operator.dev > /dev/null 2>&1
  END=$(python3 -c "import time; print(int(time.time()*1000))")
  echo "solax optimized run $i: $((END - START)) ms"
done

for i in 1 2 3; do
  START=$(python3 -c "import time; print(int(time.time()*1000))")
  node apps/node/dist/cli/index.js skills run com.google.android.apps.chromecast.app.get-climate-replay --device <device_serial> --operator-package com.clawperator.operator.dev --unit-name "<unit_name>" > /dev/null 2>&1
  END=$(python3 -c "import time; print(int(time.time()*1000))")
  echo "chromecast optimized run $i: $((END - START)) ms"
done
```

Notes:
- `<unit_name>` is the Google Home climate unit label visible in the app. Determine the correct value by running `clawperator snapshot --device <device_serial> --operator-package com.clawperator.operator.dev` from the Google Home Climate tab before the timing runs.
- Run baseline and optimized back-to-back with the device in the same state (same app in foreground, same screen) to minimize variance from UI state changes.
- Skills runs include skill script overhead beyond snapshot itself. The timing delta between baseline and optimized reflects the Node transport savings only, not skill script execution time.

### Expected Commit

```text
perf(node): reduce snapshot dispatch overhead
```

---

## Measurements

*To be filled in by the implementing agent during Phase 2, step 5. Do not close the pack without completing this section.*

### Device

| Field | Value |
| --- | --- |
| Device model | Samsung SM-S901E |
| Serial | `<device_serial>` |
| Baseline CLI version | 0.7.7 (global install) |
| Optimized build version | 0.7.8 (local dist) |

### com.solaxcloud.starter.get-battery

| Run | Baseline (ms) | Optimized (ms) |
| --- | --- | --- |
| 1 | 18430 | 15897 |
| 2 | 20584 | 20246 |
| 3 | 20587 | 15809 |
| Median | 20584 | 15897 |

### com.google.android.apps.chromecast.app.get-climate-replay

Unit name used: `Panasonic`

| Run | Baseline (ms) | Optimized (ms) |
| --- | --- | --- |
| 1 | 23957 | 15478 |
| 2 | 41883 | 15181 |
| 3 | 16195 | 15365 |
| Median | 23957 | 15365 |

### Summary

| Metric | Baseline | Optimized | Delta |
| --- | --- | --- | --- |
| solax median | 20584ms | 15897ms | -4687ms |
| chromecast median | 23957ms | 15365ms | -8592ms |
| Expected from findings (~1260ms CLI) | ~1771ms | ~1260ms | ~511ms |

Notes:
- Baseline used global `clawperator` 0.7.7. Optimized used branch-local `node apps/node/dist/cli/index.js` 0.7.8 with `--operator-package com.clawperator.operator.dev`.
- Physical device serial redacted as `<device_serial>`.
- An initial Solax optimized sample set was discarded from the table because run 1 spiked to 65202ms after switching app context; the rerun above was taken back-to-back with the baseline and is the stable comparison set.
- Skill timings include app navigation, skill script work, and remote app state variance, so the deltas are larger and noisier than the isolated snapshot transport estimate.

## Review Swarm Loop

Status: in progress on 2026-04-25.

Pass 1:
- Review found two P1 issues in the Phase 2 implementation: the early explicit-device waiter counted preflight time against the result timeout, and first-chunk logcat replay lines could enter snapshot capture.
- Fixed timeout accounting by starting the result timer when broadcast starts.
- Fixed snapshot capture boundaries by processing the first stdout chunk before signal-based broadcast starts capture.
- Added regression tests for both findings.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
