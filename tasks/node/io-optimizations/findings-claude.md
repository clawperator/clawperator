# Snapshot I/O Performance Findings

**Device:** Samsung SM-S901E (Galaxy S22), serial `<device_serial>`, USB
**Build:** Branch-local `apps/node/dist/` (v0.7.8)
**Operator:** `com.clawperator.operator.dev`
**Date:** 2026-04-25

---

## Measured Baseline

Wall-clock time for `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev`:

| Run | ms |
|-----|----|
| 1 (first, cold adb) | 1747 |
| 2 | 1312 |
| 3 | 1310 |
| 4 | 1315 |
| 5 | 1266 |
| Additional runs | 1245-1869 |

**Typical warm-run latency: ~1.3-1.5s. Target: 500ms.**

The first run in a session is sometimes 200-500ms slower; subsequent calls within seconds of each other are faster due to adb server warmth, not any Node-side caching.

---

## Transport Path (Verified from Code)

The full snapshot round trip performs these operations in strict serial order:

### Phase 1 - Node preflight (host-side, before Android sees the command)

1. **Node.js process startup + module load** (`apps/node/dist/cli/index.js`)
2. **`resolveDevice`** - spawns `adb devices`, finds the serial
3. **`checkApkPresence`** - spawns `adb shell pm list packages <pkg>`, verifies operator is installed
4. **`ensureInteractiveAutomationReady`** -> `probeInteractiveState` -> `runDoctorPingCommand` -> `waitForResultEnvelope`
   - This is a full broadcast-wait-logcat cycle with a 300ms settle delay, identical in structure to the actual command. It verifies the device is awake and the accessibility service is running. If already awake, it still completes the full round trip.
5. **`logcat -c`** - clears logcat buffer so the post-execution dump is clean
6. **`waitForResultEnvelope` begin** - spawns `adb logcat -v time -T 1` (streaming)
7. **300ms settle delay** - hardcoded in `waitForResultEnvelope`; logcat must be attached before broadcast fires
8. **`broadcastAgentCommand`** - spawns `adb shell am broadcast ...` with JSON payload as Intent extra

### Phase 2 - Android execution (device-side, measured via logcat timestamps)

9. **Intent delivery to operator** - operator receives the broadcast
10. **Accessibility service traversal** - `snapshot_ui` action walks the full UI tree
11. **Snapshot XML output to logcat** - entire XML written line by line as `TaskScopeDefault` log entries
12. **Result envelope to logcat** - `[Clawperator-Result] { ... }` emitted as single logcat line

### Phase 3 - Node post-processing (after envelope is received)

13. **`waitForResultEnvelope` resolves** - logcat stream killed, result JSON parsed
14. **`logcat -d -v tag`** - full logcat dump retrieved to extract snapshot XML
15. **`extractSnapshotsFromLogs`** - dump parsed line by line to reassemble XML from `TaskScopeDefault` entries
16. **Output formatting** - JSON envelope assembled and written to stdout

---

## Measured Time per Phase Segment

Instrumented via `probeInteractiveState` direct calls and isolated adb timing:

| Segment | Measured | Notes |
|---------|----------|-------|
| Node.js startup (module load) | ~80ms | Per process launch |
| `resolveDevice` (adb devices) | 11ms | |
| `checkApkPresence` (pm list packages) | 83ms | |
| `probeInteractiveState` (doctor_ping full RT) | **410ms** | Includes 300ms settle, broadcast, Android round trip |
| `logcat -c` | 145ms | |
| Main logcat settle delay | **300ms** | Hardcoded; applies even if logcat attaches faster |
| Main broadcast dispatch | ~80ms | `am broadcast` round trip |
| Android `snapshot_ui` computation | **~600ms** | From logcat `elapsed_ms=569-630` stage data |
| `logcat -d` post-dump | ~52ms | |
| Parse + format | ~10ms | |
| **Total** | **~1771ms** | |

---

## Key Bottlenecks

### 1. doctor_ping pre-flight: 410ms (every call)

Every call to `runExecution` - regardless of action type - goes through `ensureInteractiveAutomationReady` -> `probeInteractiveState` -> `runDoctorPingCommand` -> `waitForResultEnvelope`. This is a complete broadcast-logcat round trip with its own 300ms settle delay, executed serially before the actual command.

**Source:** `apps/node/src/domain/executions/runExecution.ts:497`, `apps/node/src/domain/doctor/checks/deviceInteractivity.ts:123`

On the happy path (device already awake and interactive), this round trip contributes ~410ms of pure overhead and returns no information that isn't already known. The result is discarded except for the boolean `ok`.

### 2. Hardcoded 300ms logcat settle delay (two occurrences)

`waitForResultEnvelope` always waits 300ms after spawning the logcat process before sending the broadcast. This prevents the envelope from arriving before logcat is attached, but it fires unconditionally regardless of whether logcat is actually streaming.

**Source:** `apps/node/src/adapters/android-bridge/logcatResultReader.ts:38` (`broadcastDelayMs: rawBroadcastDelayMs = 300`)

This delay fires twice per snapshot call - once inside the doctor_ping (which also calls `waitForResultEnvelope`) and once for the main command. Together: 600ms of unconditional waiting.

### 3. logcat -c + post-execution logcat dump: ~197ms

The code clears logcat (`logcat -c`, 145ms) before the main command, then reads the entire log back with `logcat -d -v tag` (52ms) after the result envelope arrives to retrieve the snapshot XML.

**Source:** `apps/node/src/domain/executions/runExecution.ts:515` and `559`

This is structurally unnecessary: the snapshot XML lines are already present in the live logcat stream that `waitForResultEnvelope` is reading. The stream just doesn't capture them because:
- The stream uses `-v time` format: `04-25 20:14:52.453 D/TaskScopeDefault(29817): [TaskScope] UI Hierarchy:`
- The dump uses `-v tag` format: `D/TaskScopeDefault: [TaskScope] UI Hierarchy:`
- `parseLogLine` in `snapshotHelper.ts` only handles the tag format (checks `^[A-Z]\/`)

If the live stream parser handled both formats, the snapshot could be extracted from accumulated stream lines and the clear+dump cycle eliminated entirely.

### 4. Android-side UI tree traversal: ~600ms (floor)

The operator's `snapshot_ui` action reports `elapsed_ms=569-630` for this screen (212 nodes). This is pure device-side work and represents the absolute floor below which no amount of Node optimization can reduce latency. On more complex screens or lower-end devices this would be higher.

**Source:** logcat stage-success data, verified across multiple runs.

### 5. Serial preflight chain: no parallelism

`resolveDevice` (11ms) and `checkApkPresence` (83ms) are independent and currently run sequentially. Each spawns a separate `adb` child process.

**Source:** `apps/node/src/domain/executions/runExecution.ts:415,422`

### 6. No adb connection pooling

Every operation spawns a fresh `adb` subprocess. The runner (`NodeProcessRunner`) has no persistent connection to the adb server.

**Source:** `apps/node/src/adapters/android-bridge/processRunner.ts:18`

---

## Snapshot XML Transport Mechanism (Verified)

The snapshot XML is NOT embedded in the result envelope JSON. The result envelope is:
```json
{"commandId":"...","status":"success","stepResults":[{"actionType":"snapshot_ui","data":{"actual_format":"hierarchy_xml","foreground_package":"..."}}],...}
```
No `text` field until Node adds it in post-processing.

The XML travels via logcat: the Android operator writes the full tree (87KB, 308 lines in this test) as sequential `D/TaskScopeDefault` log lines, then emits the completion envelope. Node reads these separately via `logcat -d` after the envelope signals completion.

The XML cannot be embedded in the result envelope because Android's logcat has a per-line character limit (approximately 4096 bytes), and 87KB far exceeds that. The multi-line logcat approach is correct for the transport constraint.

---

## Optimization Opportunities (Ordered by Impact)

### O1 - Skip doctor_ping on known-interactive device: save ~410ms

**Impact:** High. **Risk:** Medium. **Node changes only.**

The doctor_ping exists to verify the device is awake and accessibility is running. On the happy path - which is essentially every call during active agent use - the device is already interactive, and the doctor_ping returns immediately with `ok:true`.

Options from lowest to highest risk:
- **O1a - Remove doctor_ping entirely, fail reactively:** If the actual command fails with `SERVICE_UNAVAILABLE` or timeout, surface that directly to the caller. Remove `ensureInteractiveAutomationReady` from `runExecution`. Save ~410ms.
- **O1b - Short-TTL device state cache (5-10s):** After a successful probe, cache the result in-process for a few seconds. Subsequent calls within the TTL skip the probe. Useful for serve mode where the process persists.
- **O1c - Replace broadcast-based probe with fast adb shell check:** `adb shell dumpsys power | grep mWakefulness` or `adb shell dumpsys display | grep mScreenState` is a single shell round trip (~30-50ms) instead of a full broadcast cycle with 300ms settle.

### O2 - Reduce broadcastDelayMs from 300ms to ~50ms: save ~250ms (main command alone)

**Impact:** High. **Risk:** Low. **Node changes only.**

The 300ms is a conservative margin so logcat is attached before the envelope arrives. In practice, the logcat stream is ready well before 300ms since the adb server is already running and the socket is established quickly. Reducing to 50ms would save 250ms on the main command alone.

A lower-risk alternative: instead of a fixed delay, begin broadcast as soon as the logcat process writes any output to stdout (first line indicates the stream is live). This eliminates the delay entirely and makes it signal-based rather than time-based.

### O3 - Extract snapshot from live stream, eliminate logcat -c + post-dump: save ~197ms

**Impact:** Medium-High. **Risk:** Low. **Node changes only.**

The snapshot XML lines arrive in the live logcat stream that `waitForResultEnvelope` is already reading. The reason they are re-fetched via `logcat -d` is that `parseLogLine` in `snapshotHelper.ts` only handles the tag format, not the time format used by the stream.

Fix: update `parseLogLine` to also handle the time format:
```
04-25 20:14:52.453 D/TaskScopeDefault(29817): [TaskScope] UI Hierarchy:
```
The time-format prefix regex is: `/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [A-Z]\//`

Then accumulate stream lines in `waitForResultEnvelope` alongside correlation tracking, and return them alongside the envelope. `runExecution` then extracts the snapshot from the accumulated lines instead of a post-dump call. The `logcat -c` before the command and the `logcat -d` after are both eliminated.

### O4 - Parallelize resolveDevice + checkApkPresence: save ~80ms

**Impact:** Medium. **Risk:** Low. **Node changes only.**

These two checks are independent. Running them concurrently with `Promise.all` saves ~80ms.

```typescript
const [deviceResult, apkResult] = await Promise.all([
  resolveDevice(config),
  checkApkPresence(config),
]);
```

### O5 - Use serve mode for agent-driven calls: save ~80ms per call

**Impact:** Medium (CLI only). **Risk:** None. **No changes needed.**

The Node.js process startup (module load, V8 init) costs ~80ms per CLI invocation. The `serve` command runs a persistent HTTP server that reuses the same process. Agents using the HTTP API avoid this per-call overhead.

Currently, serve mode still runs the full `runExecution` path including doctor_ping, so O1 applies equally there.

### O6 - Start logcat stream during preflight (overlap with doctor_ping or earlier): save ~300ms

**Impact:** High. **Risk:** Medium. **Node changes only.**

The main 300ms logcat settle delay begins only after preflight is complete. If the logcat stream is spawned at the start of execution (before or during preflight), the settle "pays for itself" while preflight is still running. When preflight completes, logcat is already attached and the broadcast can fire immediately.

This requires careful sequencing: logcat -c (if kept) must happen before the stream starts, and the commandId must be known before logcat begins.

Combined with O3 (eliminating logcat -c), the logcat stream could start immediately after device/package validation, overlapping with whatever interactive-state probe remains from O1c.

### O7 - Android-side: reduce UI tree size via node filtering: save 200-400ms (Android changes)

**Impact:** Very high. **Risk:** High. **Requires Android changes.**

The Android operator takes 569-630ms to traverse the accessibility tree and serialize 212 nodes into 87KB of XML. On more complex screens this scales worse.

Options:
- Accept a filter parameter (package name, resource ID prefix) to limit which nodes are traversed
- Return a reduced attribute set (omit always-false boolean attributes)
- Implement an incremental/diff snapshot that only returns nodes that changed since the last call

This is the only change that reduces the floor below which host-side optimizations cannot go.

### O8 - Replace logcat transport with a persistent socket: architecture change

**Impact:** Very high long-term. **Risk:** High. **Requires both Android and Node changes.**

The core latency problem is the polling model: Node clears logcat, sends a broadcast, then polls logcat for the response. Each round trip incurs adb spawn overhead and the logcat settle delay.

An alternative: the operator maintains a persistent socket (local ADB forwarded port) and pushes results directly. This eliminates the settle delay and post-dump entirely, reduces per-call overhead to a single send/receive, and also enables streaming partial results.

---

## Combined Impact Estimate

Applying O1a + O2 (50ms delay) + O3 + O4 + O6 together to a warm CLI call:

| Before | After |
|--------|-------|
| Node startup: 80ms | 80ms (CLI; 0ms serve) |
| resolveDevice: 11ms | ~6ms (parallel with checkApkPresence) |
| checkApkPresence: 83ms | ~83ms |
| doctor_ping: 410ms | 0ms (removed) |
| logcat -c: 145ms | 0ms (removed) |
| logcat settle: 300ms | ~0ms (overlapped with preflight) |
| broadcast: ~80ms | ~80ms |
| Android: ~600ms | ~600ms |
| logcat -d dump: 52ms | 0ms (extracted from stream) |
| Parse/format: ~10ms | ~10ms |
| **Total: ~1771ms** | **~859ms** |

Serve-mode benefit reduces further to ~779ms. Getting below 500ms from this point requires one or more of:
- Android-side tree traversal faster than ~300ms (O7)
- Socket transport eliminating all logcat overhead (O8)
- Network conditions (faster USB, or emulator localhost path)

---

## Verified Facts vs Inference

**Verified from code and live measurement:**
- doctor_ping happens for every `runExecution` call regardless of device state
- doctor_ping uses `waitForResultEnvelope` with the same 300ms default delay as the main command
- logcat -c fires after doctor_ping and before the main logcat stream
- Snapshot XML is not in the result envelope; it is re-read from logcat post-completion
- `parseLogLine` does not handle the time format used in the live stream
- The 300ms settle delay is a constant, not signal-based
- `resolveDevice` and `checkApkPresence` run sequentially and both spawn adb subprocesses
- Android `elapsed_ms=569-630` per logcat stage data for this screen (212 nodes)
- XML payload: 87KB, 308 lines; logcat dump: 107KB

**Inference (not directly measured):**
- Reducing broadcastDelayMs below 300ms would still succeed in most cases; exact safe minimum not measured
- Socket transport latency; this is purely a design hypothesis not backed by a prototype
- Benefit of O6 (overlapping logcat stream with preflight) assumes preflight takes longer than logcat attach; this was not directly timed separately from preflight
