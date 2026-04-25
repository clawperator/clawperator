# Snapshot I/O Optimizations Work Breakdown

Parent plan: `tasks/node/io-optimizations/plan.md`

## Executive Summary

1 PR, 2 phases. Phase 1 replaces dump-based snapshot recovery with live-stream extraction and removes redundant logcat passes. Phase 2 reduces dispatch/startup overhead, applies the explicit-device fast path, and remeasures the result. This pack is active implementation planning for immediate Node-only work and explicitly excludes handshake redesign.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
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

### Expected Commit

```text
fix(node): extract snapshots from live logcat stream
```

## Phase 2: Dispatch And Preflight Overhead Cleanup

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
5. Add or extend regression tests for:
   - successful envelope receipt with the new dispatch timing
   - timeout diagnostics still being correct
   - explicit-device fast path behavior
   - auto-resolve behavior staying sequential
4. Re-measure warm CLI and serve-mode snapshot latency after the changes. Run at least 5 consecutive warm calls and record the median. Expected target based on findings: ~1260ms CLI / ~1180ms serve (from ~1771ms baseline). Record actual numbers in a `## Measurements` section appended to this file before closing the pack.

### Acceptance Criteria

- Dispatch timing overhead is lower than the current fixed 300 ms default.
- Explicit-device preflight can use the safe parallel fast path.
- Auto-resolve flows retain correct behavior.
- Tests cover the new timing and preflight behavior.
- Warm CLI median latency is captured and recorded in this file. Target: ~1260ms or better.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev
```

### Expected Commit

```text
perf(node): reduce snapshot dispatch overhead
```
