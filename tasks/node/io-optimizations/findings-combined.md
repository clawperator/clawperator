# Snapshot I/O Optimization Findings

Date: 2026-04-25

## Summary

Current `clawperator snapshot` latency is dominated by fixed Node/ADB transport overhead plus Android-side UI tree traversal. Measured end-to-end runs on a Samsung SM-S901E using `com.clawperator.operator.dev` ranged from about 1.25s to 2.29s, with warm CLI runs typically around 1.3s to 1.5s. The current full hierarchy snapshot on the measured screen produced about 87 KB of XML and Android reported roughly 569-630 ms for `snapshot_ui` traversal and serialization.

The most valuable near-term work is Node-only:

- Skip or cache repeated interactive preflight for active sessions.
- Reduce or replace the fixed 300 ms logcat broadcast delay.
- Extract snapshot XML from the existing live logcat stream and remove the per-command `logcat -c` plus post-command `logcat -d` pass.

These changes should substantially reduce warm-call latency, but the measured Android traversal time is already above the 500 ms target. Getting full snapshots under 500 ms requires Android-side work, a lighter snapshot mode, or a different transport model.

## Key Findings

### Current Transport Path

The snapshot result path is logcat-based, not file-pull-based:

1. Node validates and resolves the execution in `apps/node/src/domain/executions/runExecution.ts`.
2. Node resolves the device, checks APK presence, and runs interactive readiness preflight.
3. Node clears logcat with `adb logcat -c`.
4. Node starts `adb logcat -v time -T 1` in `waitForResultEnvelope`.
5. `waitForResultEnvelope` waits a fixed 300 ms before sending the broadcast.
6. Node dispatches `adb shell am broadcast ... --es payload <json>`.
7. Android runs `snapshot_ui`, logs the UI hierarchy from `TaskScopeDefault.logUiTree`, then emits one `[Clawperator-Result] <json>` line.
8. Node receives the envelope from the live logcat stream.
9. For snapshot steps, Node runs `adb logcat -d -v tag`, parses that dump with `extractSnapshotsFromLogs`, and attaches the XML to `snapshot_ui.data.text`.

Recordings are different: they are written on-device and pulled with `adb pull`. That path should not be used as evidence for snapshot transport.

### Primary Bottlenecks

1. **Interactive preflight runs on every execution.** `ensureInteractiveAutomationReady` calls `doctor_ping`, which itself uses `waitForResultEnvelope` and pays the same fixed logcat settle delay. Measured cost was about 410 ms on an already-ready device.

2. **The fixed 300 ms broadcast delay fires unconditionally.** `waitForResultEnvelope` defaults `broadcastDelayMs` to 300 ms so logcat can attach before the broadcast. Snapshot pays this for the preflight and again for the main command, for about 600 ms of fixed wait.

3. **Snapshot XML is read from logcat twice.** The live stream already observes the command, but the XML is recovered through a later `logcat -d -v tag` pass. The current parser only handles tag-format lines such as `D/TaskScopeDefault: ...`, while the live stream uses time-format lines such as `04-25 20:14:52.453 D/TaskScopeDefault(29817): ...`.

4. **`logcat -c` is a measurable per-call tax.** It was measured around 145-182 ms. It also makes snapshot extraction depend on clearing shared device logs rather than bounding extraction to the current command window.

5. **Android traversal is the latency floor for full snapshots.** The measured `snapshot_ui` stage was about 569-630 ms for a 212-node screen and an 87 KB hierarchy. Host-side optimization cannot reduce this floor.

6. **Every ADB operation spawns a subprocess.** This affects `adb devices`, package checks, logcat, broadcasts, and post-processing. It is not the first fix to make, but it limits multi-Hz snapshot loops.

### Conflict Resolution

Do not embed the full hierarchy XML in the current `[Clawperator-Result]` envelope as an immediate fix. The Android contract emits exactly one result line, and measured XML is far larger than logcat's practical single-line limit. Prefer live-stream snapshot extraction first. Direct payload return only becomes appropriate with a new chunked result contract or non-logcat transport.

Parallelizing `resolveDevice` and `checkApkPresence` is only safe when `config.deviceId` is already explicit. If the device must be auto-selected, `resolveDevice` has to run first so later ADB commands target the resolved serial.

## Constraints / Assumptions

- Keep `[Clawperator-Result]` as the canonical terminal envelope unless a larger transport redesign explicitly changes the contract.
- Preserve `commandId` and `taskId` correlation end-to-end.
- Maintain current behavior for readiness failures: locked device, screen off, missing accessibility service, missing APK, and malformed envelope must still produce actionable structured errors.
- Snapshot XML log lines do not currently carry `commandId`. If extraction moves to the live stream, bound collection to the dispatch-to-matching-envelope interval and preserve the per-device execution lock.
- Warm CLI timings include about 80 ms of Node process startup. Serve mode avoids that cost but currently still runs the same `runExecution` path.
- Timing estimates from the two findings are accepted as accurate; exact savings should still be remeasured after each implementation step.

## Recommendations

### 1. Add a Short-TTL Readiness Cache

Cache successful interactive readiness by device ID and operator package for a short TTL, such as 5-10 seconds. This targets active agent loops where the same process issues repeated actions while the device remains awake and unlocked.

Implementation guidance:

- Cache only successful ready states.
- Invalidate on readiness-related command failures, result envelope timeout, broadcast failure, device mismatch, or operator package change.
- Keep `doctor_ping` available for cold calls, explicit diagnostics, and recovery.
- Prefer this over fully removing preflight in the first pass because it keeps current error quality while eliminating repeated happy-path cost in serve mode.

Expected impact: save about 410 ms on repeated in-process calls after the first ready probe.

### 2. Replace the Fixed 300 ms Delay with Readiness-Based Dispatch

Reduce `broadcastDelayMs` or make dispatch signal-based in `waitForResultEnvelope`.

Preferred implementation:

- Start logcat.
- Dispatch once the stream has produced evidence that it is attached, or after a small fallback timeout.
- Keep a configurable fallback delay for devices that do not emit prompt logcat output.

Lower-risk interim implementation:

- Reduce the default delay from 300 ms to a smaller measured value, such as 50 ms.
- Add tests for broadcast failure, timeout diagnostics, and successful envelope parsing.

Expected impact: save up to about 250 ms per envelope wait. With uncached `doctor_ping`, the delay is paid twice.

### 3. Extract Snapshot XML from the Live Logcat Stream

Extend the logcat result path so it can return captured TaskScope lines along with the result envelope. Then attach snapshots from those captured lines instead of running `logcat -d -v tag`.

Implementation guidance:

- Teach `snapshotHelper.parseLogLine` to handle both tag format and time format.
- Accumulate relevant live stream lines in `waitForResultEnvelope`.
- Include lines needed for snapshot extraction, not just timeout diagnostics.
- On success, pass captured lines to `extractSnapshotsFromLogs`.
- Remove the post-success `adb logcat -d -v tag` for snapshot steps.
- Once live extraction is reliable, remove the pre-command `adb logcat -c`.

Expected impact: save about 197-250 ms per snapshot from removing `logcat -c` and `logcat -d`, plus reduce shared-log fragility.

### 4. Use Explicit Device Fast Paths Carefully

When `config.deviceId` is already set, package presence can be checked while resolving or validating the same device serial. When `config.deviceId` is omitted, keep the current resolve-first behavior.

Expected impact: small but low-risk, roughly 80 ms in explicit-device CLI paths.

### 5. Prefer Serve Mode for Agent Loops

For repeated agent-driven calls, use the persistent Node API server rather than one CLI process per snapshot. This avoids about 80 ms of Node startup per call.

This does not replace the Node transport fixes above because serve mode still calls `runExecution`.

### 6. Add a Lightweight Snapshot Mode

Full hierarchy XML is expensive to generate and transport. Add an explicit lighter mode only if implementation work needs sub-second or multi-Hz observation after Node-side fixes.

Candidate options:

- Filter by package, window, resource-id prefix, or visible/actionable nodes.
- Return a reduced attribute set.
- Return summary metadata plus selected nodes.
- Add a future diff mode keyed by prior snapshot state.

This should be a new explicit contract, not a silent change to existing `snapshot_ui` output.

### 7. Treat Persistent Socket Transport as a Later Architecture Project

A persistent ADB-forwarded socket or similar channel could remove logcat settle delays, reduce process churn, and allow chunked or streaming payloads. This is the right long-term direction for high-frequency control loops, but it requires coordinated Android and Node contract work and should not block the Node-only improvements.

## Open Questions / Risks

- **Safe logcat attach signal:** Need to determine whether waiting for first stdout line is reliable across devices. If not, keep a small fallback timer.
- **Readiness cache invalidation:** Cache bugs could delay detection of lock screen, screen-off, or accessibility-service failures. Start with a short TTL and invalidate aggressively.
- **Live snapshot extraction without command IDs:** Snapshot XML lines are not command-tagged. Per-device serialization and dispatch-to-envelope capture should be enough for current Node-owned calls, but external concurrent log producers remain a theoretical risk.
- **500 ms target:** Full hierarchy snapshots are unlikely to reach 500 ms on the measured screen through host-side changes alone because Android traversal already takes roughly 600 ms.
- **Contract compatibility:** Any chunked envelope, direct payload, or socket transport must preserve structured JSON result semantics and clear exit-code behavior for CLI callers.

## Implementation Order

1. Add tests for time-format snapshot log parsing and live-stream capture.
2. Return captured log lines from `waitForResultEnvelope` and use them for snapshot attachment.
3. Remove post-command `logcat -d` for snapshots.
4. Remove or narrow `logcat -c` once live extraction is verified.
5. Add short-TTL readiness caching for repeated calls.
6. Reduce or replace the 300 ms broadcast delay.
7. Re-measure warm CLI and serve-mode latency.
8. Decide whether Android-side lightweight snapshot work is required to meet the target.
