# Snapshot I/O Optimization Findings

Date: 2026-04-25
Status: PR-1 immediate Node-side I/O cleanup is implemented
Device used for measurements: Samsung SM-S901E, USB
Build used for measurements: branch-local `apps/node/dist/` v0.7.8 with `com.clawperator.operator.dev`

## Purpose

This file is the durable handoff for snapshot I/O performance after the completed PR-1 cleanup. It is not an implementation plan.

Use it to understand:

- what the Node-side I/O cleanup already changed
- which behavior future agents must preserve
- which latency bottlenecks remain
- where the next task packs should start

The detailed PR-1 phase plan and work log were retired after cleanup. The surviving follow-up files are:

- `tasks/node/handshaking/findings.md` for readiness-cache and handshake redesign decisions
- `tasks/node/io-optimizations/findings-deferred.md` for Android-side filtering, payload reduction, diff snapshots, and transport replacement

## Current Behavior After PR-1

Snapshot execution now uses the live result logcat stream for snapshot XML extraction.

Implemented behavior:

- `waitForResultEnvelope` starts `adb logcat -v time -T 1`, watches for the canonical `[Clawperator-Result]` envelope, and returns captured `TaskScopeDefault` snapshot log lines with the parsed envelope.
- `snapshotHelper` parses all currently covered snapshot log formats:
  - tag format, such as `D/TaskScopeDefault: ...`
  - live time format, such as `04-25 20:14:52.453 D/TaskScopeDefault(29817): ...`
  - live PID/TID time format, such as `04-25 20:14:52.453 29817 29817 D TaskScopeDefault: ...`
- `runExecution` attaches snapshot XML from the captured live lines by calling `extractSnapshotsFromLogs`.
- The old per-command `logcat -c` clear was deleted.
- The old post-success `logcat -d -v tag` snapshot recovery pass was deleted.
- The `[Clawperator-Result]` envelope contract was not changed.

Dispatch behavior:

- Logcat dispatch defaults to a 100 ms no-output fallback.
- Once stdout proves logcat attachment, dispatch waits for a short replay-drain window before releasing the broadcast.
- A max replay-drain cap prevents continuous logcat noise from delaying dispatch indefinitely.
- Result timeout accounting starts at broadcast dispatch, not at early logcat spawn.
- Snapshot capture is bounded to the fresh dispatch window and includes replay protections for first chunks, split lines, stale envelopes, and forced max-drain dispatch.

Preflight behavior:

- When `deviceId` is a nonblank explicit value, the result logcat waiter can start before safe preflight completes.
- Explicit-device `resolveDevice` and `checkApkPresence` run in parallel.
- Auto-resolve flows remain sequential so later adb calls use the resolved serial.
- Early logcat waiters are canceled on pre-dispatch failures.

## Invariants To Preserve

- Do not reintroduce per-command `logcat -c` or `logcat -d` snapshot recovery for the standard snapshot path.
- Do not embed full snapshot XML inside the single-line `[Clawperator-Result]` envelope.
- Do not change the envelope shape without explicit versioning.
- Keep snapshot capture scoped to the active command's dispatch-to-envelope interval.
- Treat snapshot log lines as uncorrelated by `commandId`; the current safety comes from timing boundaries, execution locking, and replay quarantine.
- Keep explicit-device fast paths gated on a nonblank `deviceId`.
- Keep auto-resolve device selection sequential unless a later task designs a safe equivalent.
- Keep handshake caching and handshake redesign out of this file. That work is owned by `tasks/node/handshaking/findings.md`.
- Keep Android-side filtering, reduced attributes, diff snapshots, and transport replacement out of this file. That work is owned by `tasks/node/io-optimizations/findings-deferred.md`.

## Measurements After PR-1

These measurements were taken against the branch-local v0.7.8 build with the debug operator package.

### Warm Snapshot Latency

| Run | Warm CLI snapshot (ms) | Serve-mode snapshot (ms) |
| --- | --- | --- |
| 1 | 2226 | 2237 |
| 2 | 2219 | 1750 |
| 3 | 1756 | 1722 |
| Median | 2219 | 1750 |

### Skill Timing Comparison

Baseline used global `clawperator` v0.7.7. Optimized used branch-local v0.7.8.

| Skill | Baseline median | Optimized median | Delta |
| --- | --- | --- | --- |
| `com.solaxcloud.starter.get-battery` | 20584ms | 15897ms | -4687ms |
| `com.google.android.apps.chromecast.app.get-climate-replay` | 23957ms | 15365ms | -8592ms |

Notes:

- Skill timings include app navigation, skill script work, and app-state variance. They are useful for directional comparison, not as isolated transport benchmarks.
- The warm CLI and serve-mode snapshot medians stayed above the original estimates. The remaining latency floor is dominated by readiness handshake and Android snapshot traversal.

## Remaining Bottlenecks

Approximate known costs after the Node-side I/O cleanup:

| Segment | Current state |
| --- | --- |
| Readiness handshake | Still a full broadcast-plus-logcat probe, measured around 410ms before PR-1 |
| Android `snapshot_ui` traversal and serialization | Still around 600ms on the measured screen |
| Node process startup | Still paid by one-shot CLI, avoided by `serve` mode after startup |
| Broadcast/logcat transport | Improved by PR-1, but still subprocess and logcat based |

## Next Work

1. Resolve the handshake policy questions in `tasks/node/handshaking/findings.md`, then author a dedicated task pack for readiness-cache or handshake redesign work.
2. Use `tasks/node/io-optimizations/findings-deferred.md` to author later Android/transport task packs. Start with Android-side filtering or reduced snapshot payload if the goal remains sub-500ms snapshots.
3. Prefer `clawperator serve` for repeated agent loops when caller context allows a persistent process.

Do not treat this file as permission to implement the deferred work directly. Convert the relevant findings into a scoped task pack first.
