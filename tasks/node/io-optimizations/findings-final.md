# Snapshot I/O Optimization: Final Implementation Brief

Date: 2026-04-25
Device: Samsung SM-S901E (Galaxy S22), USB
Build: Branch-local `apps/node/dist/` (v0.7.8), `com.clawperator.operator.dev`

---

## 1. Summary

### Current Performance

Warm CLI runs: **1.3-1.5s**. First run in a session: up to 1.9-2.3s (cold adb server).
Target: **500ms**.

Full breakdown:

| Segment | Measured |
|---------|----------|
| Node.js startup | ~80ms |
| `resolveDevice` (adb devices) | ~11ms |
| `checkApkPresence` (pm list packages) | ~83ms |
| `probeInteractiveState` (doctor_ping full RT) | **~410ms** |
| `logcat -c` | ~145-182ms |
| logcat settle delay (main command) | **300ms** |
| `am broadcast` round trip | ~80ms |
| Android `snapshot_ui` traversal + serialization | **~600ms** |
| `logcat -d` post-dump | ~52-69ms |
| Parse + format | ~10ms |
| **Total (warm CLI)** | **~1771ms** |

### What Is Realistically Achievable

**Node-only changes (this phase):**
Applying the immediate non-handshake optimizations in this brief should reduce warm CLI latency materially, but not below 1s by themselves. The Android traversal floor (~600ms) and the current handshake path still block the 500ms target from Node side alone.

**Handshake planning (split out):**
Handshake optimization is still important, but it has enough contract and diagnostic unknowns that it should be handled as a dedicated planning and implementation step. See `tasks/node/handshaking/findings.md`.

**Android-side changes (deferred):**
Filtering the UI tree or returning a reduced attribute set could reduce Android traversal time to under 300ms on typical screens, making ~500ms achievable.

**Transport redesign (deferred):**
Replacing the broadcast/logcat model with a persistent ADB-forwarded socket eliminates settle delays and per-call subprocess overhead, enabling multi-Hz snapshot loops.

---

## 2. Immediate Implementation (Low Hanging Fruit)

All items in this section: Node-side only, no Android changes, no transport redesign.

---

### I1 - Reduce the 300ms logcat broadcast delay

**What changes:**
Reduce `broadcastDelayMs` from 300ms to ~50ms, or make dispatch signal-based (fire once logcat emits its first stdout line).

**Why it matters:**
`waitForResultEnvelope` waits 300ms unconditionally after spawning the logcat process before sending the broadcast. The adb server is already running and the logcat socket attaches in well under 300ms. This 300ms fires twice per snapshot call today (once inside doctor_ping, once for the main command). Even before handshake work is redesigned, the main-command delay is still avoidable overhead.

**Where it applies:**
- `apps/node/src/adapters/android-bridge/logcatResultReader.ts:38` - `broadcastDelayMs: rawBroadcastDelayMs = 300`

**Recommended implementation:**
Preferred: Dispatch broadcast as soon as the logcat child process writes any output to stdout (first line proves the stream is live). Keep a small fallback timeout (~100ms) for devices that buffer initial output.

Lower-risk interim: Reduce to 50ms with a documented comment explaining it is a conservative minimum, not a measured value. Add a note to re-measure on slower/emulated targets before shipping.

**Estimated impact:** ~250ms saved per envelope wait.

---

### I2 - Extract snapshot XML from the live logcat stream; eliminate `logcat -c` and `logcat -d`

**What changes:**
Teach `parseLogLine` to handle time-format lines from the live stream, accumulate matching lines in `waitForResultEnvelope`, and return them alongside the envelope. Remove the pre-command `logcat -c` and the post-command `logcat -d -v tag` pass.

**Why it matters:**
The snapshot XML is not carried inside the initial result envelope. Android logs the hierarchy as sequential `TaskScopeDefault` lines, and Node currently reconstructs the snapshot with a second `logcat -d` pass because `parseLogLine` in `snapshotHelper.ts` only handles the tag format (`D/TaskScopeDefault: ...`), while the live stream produces time format (`04-25 20:14:52.453 D/TaskScopeDefault(29817): ...`). Combined cost of `logcat -c` plus `logcat -d`: **~197-250ms**. Additionally, the logcat-clear approach creates fragility: extraction depends on a clean global buffer rather than being bounded by the command window.

**Where it applies:**
- `apps/node/src/adapters/android-bridge/snapshotHelper.ts` - `parseLogLine`, extend regex to handle time format: `/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [A-Z]\//`
- `apps/node/src/adapters/android-bridge/logcatResultReader.ts` - accumulate `TaskScopeDefault` lines in `waitForResultEnvelope`, return alongside envelope
- `apps/node/src/domain/executions/runExecution.ts:515,559` - remove `logcat -c` and `logcat -d` call sites; attach snapshot from captured lines

**Implementation note:**
Snapshot XML lines do not carry `commandId`. Bound collection to the dispatch-to-matching-envelope interval. The per-device execution lock (already present) prevents concurrent command interleaving. Add tests for time-format parsing before removing the `logcat -d` fallback. Remove `logcat -c` only after live extraction is verified across multiple runs.

**Estimated impact:** ~197-250ms saved per snapshot call; eliminates shared-log fragility.

**Transport note:**
Recordings are a separate path. They are written on-device and pulled with `adb pull`, so they should not be used as evidence for snapshot transport behavior.

---

### I3 - Overlap logcat startup with preflight

**What changes:**
Spawn the logcat stream at the beginning of execution (during or before preflight checks) rather than after preflight completes. Once preflight finishes, logcat is already attached and the broadcast fires immediately.

**Why it matters:**
Currently, the 300ms settle delay begins only after the full preflight chain completes. Preflight (`resolveDevice` + `checkApkPresence`) takes ~90ms. If logcat is spawned at the same time as preflight, the settle "pays for itself" during preflight. Combined with I1 (signal-based attach), the effective settle cost drops to near zero.

**Where it applies:**
- `apps/node/src/domain/executions/runExecution.ts` - restructure startup sequence to begin logcat stream during preflight

**Prerequisites:**
I2 must be implemented first (logcat -c must be eliminated before starting logcat earlier, since clearing the buffer after the stream is open would be destructive).

**Estimated impact:** ~50-90ms of additional savings after I1 and I2 are in place; the primary value is ensuring the 50ms fallback delay in I1 is fully covered by real preflight work rather than idle waiting.

---

### I4 - Parallelize `resolveDevice` and `checkApkPresence`

**What changes:**
Wrap both calls in `Promise.all` when `config.deviceId` is already explicit.

**Why it matters:**
These two checks are independent and each spawns a separate adb subprocess. Running them sequentially costs ~94ms. Running in parallel costs ~83ms (the slower of the two). Savings are small but zero-risk.

**Where it applies:**
- `apps/node/src/domain/executions/runExecution.ts:415,422`

**Constraint:**
Only safe when `config.deviceId` is already set. If `deviceId` is omitted and `resolveDevice` must auto-select, keep it sequential - later adb calls need the resolved serial. Add a branch: parallel when explicit, sequential when auto-resolve.

**Estimated impact:** ~11ms saved (resolveDevice runtime, which runs in parallel with the slower checkApkPresence).

---

### I5 - Use serve mode for repeated agent calls

**What changes:**
No code changes needed. Use `clawperator serve` (HTTP API) for agent loops instead of invoking the CLI binary per command.

**Why it matters:**
Each CLI invocation spends ~80ms on Node.js process startup and V8 module loading. Serve mode reuses the process and eliminates this cost on every call after the first.

**Where it applies:**
- `apps/node/src/cli/commands/serve.ts` - existing command, no changes needed

**Estimated impact:** ~80ms saved per call in agent loop contexts.

---

### Combined Impact (Immediate Non-Handshake Items)

| Segment | Before | After (CLI) | After (serve) |
|---------|--------|-------------|---------------|
| Node.js startup | 80ms | 80ms | 0ms |
| resolveDevice | 11ms | ~0ms (parallel + overlapped) | ~0ms |
| checkApkPresence | 83ms | ~83ms | ~83ms |
| doctor_ping | 410ms | 410ms | 410ms |
| logcat -c | ~145ms | 0ms | 0ms |
| logcat settle | 300ms | ~0ms (overlapped + signal) | ~0ms |
| broadcast | ~80ms | ~80ms | ~80ms |
| Android snapshot_ui | ~600ms | ~600ms | ~600ms |
| logcat -d | ~52ms | 0ms | 0ms |
| Parse + format | ~10ms | ~10ms | ~10ms |
| **Total** | **~1771ms** | **~1263ms** | **~1183ms** |

Getting below 500ms requires handshake redesign plus Android-side work, a lighter snapshot mode, or a different transport model.

---

## 3. Deferred Work

Deferred structural and higher-cost items have been moved to `tasks/node/io-optimizations/findings-deferred.md` so this brief stays focused on immediate execution.

---

## 4. Non-Goals / Explicitly Out of Scope (This Phase)

- **No change to `[Clawperator-Result]` envelope contract.** The envelope remains the canonical terminal signal. Changing its shape requires explicit versioning.
- **No embedding full snapshot XML in the result envelope.** Logcat has a per-line limit (~4096 bytes); 87KB XML far exceeds it. The codex suggestion to embed XML directly in the envelope is not viable without a transport redesign. The correct path is live-stream extraction (I3), not envelope embedding.
- **No Android-side refactoring** in the immediate phase. Android traversal remains unchanged.
- **No handshake redesign in this immediate phase.** Handshake planning and implementation now live in `tasks/node/handshaking/findings.md`.
- **No concurrency model changes** (no worker threads, no native adb multiplexing).
- **No changes to recording transport.** Recordings use `adb pull` from on-device storage - a separate path not relevant to snapshot latency.
- **No new snapshot action types** or API surface changes in this phase.

---

## 5. Recommended Execution Order

Steps are ordered by ROI, with dependencies noted. Each step is independently committable.

**Step 1: Extend `parseLogLine` to handle time-format lines (I3, part A)**

Prerequisite for everything else. Add the time-format regex to `snapshotHelper.parseLogLine`. Add unit tests covering both tag format and time format. This is a pure additive change with no behavior impact yet.

Files: `apps/node/src/adapters/android-bridge/snapshotHelper.ts`, test file

---

**Step 2: Accumulate stream lines in `waitForResultEnvelope` and return them (I3, part B)**

Extend `waitForResultEnvelope` to accumulate `TaskScopeDefault` lines from the live stream. Return them alongside the parsed envelope. Wire `runExecution` to use accumulated lines for snapshot attachment instead of the `logcat -d` pass. Keep `logcat -d` as a fallback for this step. Verify end-to-end snapshot output is identical.

Files: `apps/node/src/adapters/android-bridge/logcatResultReader.ts`, `apps/node/src/domain/executions/runExecution.ts`

---

**Step 3: Remove `logcat -d` post-dump (I3, part C)**

Once live-stream extraction is verified over multiple runs, remove the post-command `adb logcat -d -v tag` call and fallback path. Saves ~52-69ms per snapshot call.

Files: `apps/node/src/domain/executions/runExecution.ts:559`

---

**Step 4: Remove `logcat -c` pre-command clear (I3, part D)**

With live-stream extraction in place, the pre-command buffer clear is no longer needed for correctness. Remove the `logcat -c` call. Saves ~145-182ms per call. Verify that snapshot content is still correctly bounded (dispatch-to-envelope interval).

Files: `apps/node/src/domain/executions/runExecution.ts:515`

---

**Step 5: Reduce or replace the 300ms broadcast delay (I2)**

Implement signal-based dispatch in `waitForResultEnvelope`: fire the broadcast once logcat emits its first stdout line. Keep a 100ms fallback timer. If signal-based is too risky for initial shipping, reduce the constant to 50ms as an interim step. Saves ~250ms per envelope wait.

Files: `apps/node/src/adapters/android-bridge/logcatResultReader.ts:38`

---

**Step 6: Add short-TTL readiness cache (I1)**

Add an in-process cache (Map keyed on `deviceId + operatorPackage`) for successful `probeInteractiveState` results with a 5-10s TTL. Invalidate on failures. Keep the full probe for cold calls and explicit diagnostics. Saves ~410ms on every warm in-process call after the first.

Files: `apps/node/src/domain/doctor/checks/deviceInteractivity.ts`, `apps/node/src/domain/executions/runExecution.ts`

---

**Step 7: Overlap logcat startup with preflight (I4)**

After Steps 3-4 are complete (no logcat -c), restructure `runExecution` to spawn the logcat stream at the same time as preflight checks. With signal-based attach (Step 5), the settle cost is fully absorbed by preflight work (~83ms). Saves ~50-90ms of additional idle time.

Files: `apps/node/src/domain/executions/runExecution.ts`

---

**Step 8: Parallelize `resolveDevice` and `checkApkPresence` (I5)**

When `config.deviceId` is explicit, run both checks with `Promise.all`. Add a branch for auto-resolve to keep sequential behavior. Saves ~11ms. Small gain, but completes the preflight cleanup.

Files: `apps/node/src/domain/executions/runExecution.ts:415,422`

---

**Step 9: Re-measure and decide on Android phase**

After Steps 1-8, measure warm CLI and serve-mode latency against the 500ms target. If result is ~850ms CLI / ~770ms serve, and the target still matters, proceed with D1 (Android-side filtering) as the next project.

---

**Step 10: Serve mode (I6) - operational, not a code change**

Document and communicate to agent authors that repeated command loops should use `clawperator serve` (HTTP API) instead of per-call CLI invocations. Update relevant agent-facing docs.
