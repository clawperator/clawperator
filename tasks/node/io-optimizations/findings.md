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

## Daemon Proxy Update

The transparent daemon proxy (PR #240, commit `e4b6e1b4`) reduces per-call
latency for subprocess skill loops. Skills that call `clawperator` via
`execFileSync` now benefit from the daemon's warm process state and the
in-process readiness cache (TTL 8s) without any skill-side changes.

Measured improvement for warm sequential snapshot calls: ~0.414s per call
(1.156s direct vs 0.742s warm daemon). Five-call cold-start sequence was
~32% faster overall than direct mode. The improvement is strongest for
repeated observation or action loops. Short host-side executions such as
`close_app` show minimal improvement (~5%, within noise margin).

## Daemon Versus Direct Validation - 2026-04-26

Validation was rerun after daemon closeout on a Samsung SM-S901E physical device
over USB with branch-local `node apps/node/dist/cli/index.js` v0.7.9 and
`com.clawperator.operator.dev`.

Modes:

- no daemon: `CLAWPERATOR_NO_DAEMON=1`
- daemon: branch-local `daemon start` before the measured runs
- snapshot runs used `snapshot --timeout-ms 60000`
- skill runs used `skills run --timeout 240000`

### Warm Snapshot Latency

| Run | No-daemon snapshot (ms) | Warm daemon snapshot (ms) |
| --- | --- | --- |
| 1 | 1599 | 829 |
| 2 | 1594 | 849 |
| 3 | 1605 | 846 |
| Median | 1599 | 846 |

Median delta: daemon was 753ms faster per snapshot (-47.1%).

### Skill Timing Comparison

| Skill | No-daemon runs (ms) | Daemon runs (ms) | No-daemon median | Daemon median | Delta |
| --- | --- | --- | --- | --- | --- |
| `com.solaxcloud.starter.get-battery` | 36476, 21233, 21167 | 21317, 21363, 21653 | 21233ms | 21363ms | +130ms (+0.6%) |
| `com.google.android.apps.chromecast.app.get-climate-replay` | 17284, 17313, 18135 | 17252, 17237, 17120 | 17313ms | 17237ms | -76ms (-0.4%) |

All runs in the table completed successfully. The Google Home skill was invoked
with `--unit-name Panasonic`, matching the visible current device label on the
test phone. An initial attempt with the older documented example label
`Living Room AC` failed because that target node was not present on this device.

These skill timings include app launch, navigation, live app state, and parsing
work. On this run, daemon proxying materially improved repeated bare snapshot
latency, while the two full replay skills were dominated by app workflow time and
landed within noise once measured on the same branch-local build.

### Investigation Notes

The daemon was verified as running during daemon-mode measurements. The measured
daemon-mode runs reported `daemon status == running` before and after each timed
command, and the daily Clawperator log contained matching daemon socket requests:
`GET /ping`, `GET /version`, and `POST /execute`. No-daemon runs reported
`daemon status == not_running` before and after each timed command.

The local branch build was used. `skills run` resolved `CLAWPERATOR_BIN` to the
branch-local command:

```text
node /Users/<local_user>/src/clawperator/apps/node/dist/cli/index.js
```

The limited skill-level improvement is expected for these two replay skills:

- `com.solaxcloud.starter.get-battery` makes one inner `exec` call for the whole
  workflow and includes fixed sleeps of 1500ms plus 12000ms.
- `com.google.android.apps.chromecast.app.get-climate-replay` makes one inner
  `exec` call for the whole workflow and includes fixed sleeps totaling 13000ms.
- `skills run` also performs wrapper-side target resolution, APK presence, and
  interactivity checks before the skill script starts. The daemon does not remove
  that wrapper preflight.

Additional isolated timings confirmed the shape:

| Probe | No-daemon median | Daemon median | Notes |
| --- | --- | --- | --- |
| SolaX inner `exec` payload only | 17286ms | 20445ms | One monolithic execution with fixed app waits; app-state variance dominated |
| SolaX `skills run --skip-validate` | 21128ms | 17225ms | Skips registry validation, but still includes wrapper preflight and the same single inner `exec` |

The earlier `Skill Timing Comparison` table compared global `clawperator` v0.7.7
against branch-local v0.7.8. That was not an isolated daemon-versus-direct test:
it also included the Node-side snapshot I/O cleanup and version/build changes.
The isolated same-build v0.7.9 daemon-versus-direct measurements above show the
daemon proxy is effective for repeated bare observations, but these specific
replay skills do not contain enough separate CLI subprocess calls for daemon
warm state to dominate the total runtime.
