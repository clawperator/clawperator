# Handshake Readiness Latency: Blue-Sky Analysis

Date: 2026-04-26
Author: fresh analysis from first principles
Companion: `tasks/node/handshaking/plan.md` (existing task pack)

---

## The Problem Being Analyzed

Every non-trivial Clawperator command - `exec`, `snapshot`, any top-level action
verb - pays a ~410ms "readiness handshake" before it does any real work. The
handshake is a full broadcast-plus-logcat round trip to the Android operator: it
dispatches a `doctor_ping` command, waits for the result envelope, and only then
proceeds with the actual command.

This overhead is paid by **every individual call**, regardless of whether the
device was confirmed ready one millisecond ago. It cannot be amortized across
related calls because each call is a separate OS process.

The result is that an LLM agent doing a simple multi-step loop - snapshot, read,
click, snapshot, verify - pays 2-3 seconds of handshake overhead per session in
addition to the ~600ms Android traversal cost and the ~200ms broadcast transport.
A skill that issues 10 sequential `clawperator exec` calls via subprocess pays
~4 seconds of handshake time alone, regardless of app complexity.

This is not a minor latency nuance. It is the dominant cost on typical agent
loops and makes sequential CLI-based skill scripts noticeably slower than they
need to be.

---

## What the Existing Plan Does and Does Not Solve

The existing task pack (`plan.md`) proposes an **in-process, short-TTL readiness
cache** inside `deviceInteractivity.ts`. On a cache hit, the handshake is
skipped for the current process.

**What it helps:**

- `clawperator serve` mode: multiple API calls from the same HTTP server process
  share the cache. A serve-mode agent loop that calls `/execute` every 2 seconds
  would skip 9 out of 10 handshakes.
- Orchestrated skills that drive commands through the serve API benefit similarly.

**What it does not help:**

- **Sequential CLI subprocess calls** - the way most skills in
  the skills repo actually work. Each `clawperator exec`
  invocation from `utils/common.js:runClawperator()` is a separate OS process.
  The in-process cache dies when that process exits. The next `exec` call starts
  cold.
- **`captureDirectSnapshot` patterns** in `install-app`, `search-app`, and
  other skills that call snapshot multiple times within a single skill run via
  separate subprocesses. Each snapshot call pays the full handshake.
- **One-shot CLI** (`clawperator snapshot`, `clawperator click`) - each is its
  own process.
- **`clawperator skills run`** when the skill uses the subprocess model. The
  pre-spawn readiness check fires once. Then every `exec` call inside the skill
  fires again independently.

**Concrete example** (`com.android.vending.install-app`):
The skill calls `captureDirectSnapshot` approximately 8-12 times plus a main
execution. In the current implementation each of those is a separate
`clawperator exec` process with its own handshake. With the in-process cache,
none of those are improved.

**Conclusion**: The existing plan is a correct but narrow optimization. It
provides meaningful benefit in `serve` mode and orchestrated-agent workflows.
It provides zero benefit for the sequential subprocess model that is the
dominant skill execution pattern today.

---

## Solution Families

### S1 - In-Process Serve Cache (existing plan)

**How it works**: Module-level `Map` in `deviceInteractivity.ts` stores the last
successful `InternalInteractiveState` per `deviceId:operatorPackage` key. Cache
hits skip the full probe. TTL of 8 seconds.

**Impact on one-shot CLI**: None. Process dies after one command; cache never
re-used.

**Impact on sequential skill subprocess calls**: None. Each `exec` is a separate
process.

**Impact on serve mode**: Significant. Per-command handshake drops from ~410ms
to near-zero on warm cache hits. Agent loops making rapid API calls benefit
directly.

**Diagnostics**: Preserved on all cache misses and failure paths. On stale
cache hits, reactive failures (`RESULT_ENVELOPE_TIMEOUT`) replace proactive
`DEVICE_NOT_INTERACTIVE`. One-command degradation window per state-change event.

**Stale-state risk**: Low. 8-second TTL bounds the window. Reactive failures
invalidate immediately.

**Implementation complexity**: Low. ~50 lines of code in one file.

**Skill rewrites required**: No.

**Public API/result changes**: No.

**Verdict**: Correct but incomplete. The right first step for serve mode,
but does not address the primary use case.

---

### S2 - Cross-Process Filesystem Cache

**How it works**: On a successful probe, write a small JSON file to a
well-known temp path (e.g.,
`/tmp/clawperator-ready-<deviceId_hash>-<operatorPackage_hash>.json`) containing
the probe result and a timestamp. On the next CLI invocation, before probing,
check if a valid cache file exists within TTL. If so, skip the probe.

**Impact on one-shot CLI**: Positive. Second `clawperator snapshot` ~5ms later
skips the probe. Reads the file in ~1-3ms rather than spending ~410ms.

**Impact on sequential skill subprocess calls**: Positive. All `runClawperator()`
subprocess calls within a skill benefit after the first one populates the file.
For `install-app` with 10+ exec calls, this could save ~3.5 seconds of probe
overhead across the skill run.

**Impact on serve mode**: Positive. Essentially same as S1 but with
cross-process reach.

**Diagnostics**: Same tradeoff as S1. On a stale cache hit the command may
fail reactively. The file must be invalidated on explicit failure codes.

**Stale-state risk**: Medium. The filesystem cache survives process crashes and
USB reconnects. A device that is unplugged and reconnected could have a stale
"ready" file that misleads the next command. Must be invalidated on connection
errors and on device serial mismatch at probe time.

**Implementation complexity**: Medium. File I/O in the hot path, concurrent
write safety (atomic replace via temp file + rename), cleanup of stale files,
invalidation on device events. Needs to handle OS restarts (temp dir cleared),
device serial changes, and package changes.

**Skill rewrites required**: No.

**Public API/result changes**: No.

**Notes on correctness concerns**:
- ADB already uses this model (the `adb server` is persistent state). This is
  not unprecedented for Android tooling.
- The file represents "recently confirmed ready," not "currently ready." That
  is an honest and useful claim.
- File permission edge cases (read-only /tmp on some systems) need handling.
- Multi-device setups with concurrent CLI calls need atomic writes.

**Verdict**: Best practical near-term improvement for the subprocess skill
model. Low disruption, no API changes, meaningful latency impact across all
call patterns. Implementation is manageable but requires careful edge-case
handling.

---

### S3 - Cheap Host-Side ADB Probe

**How it works**: Replace or precede the full broadcast-plus-logcat `doctor_ping`
probe with a fast host-side check. Two options:

*S3a - Screen/lock check only*: Use `adb shell dumpsys power | grep -i 'mWakefulness\|Display Power'` to detect screen state cheaply (~50ms). This confirms the device is awake and not in doze/sleep mode. It cannot confirm the accessibility service is running.

*S3b - Screen/lock + service check*: Additionally run `adb shell dumpsys accessibility | grep clawperator` to verify the operator accessibility service is listed as enabled (~50-100ms). Combined cost ~100-150ms.

**Impact on one-shot CLI**: Positive. Replaces ~410ms with ~100-150ms. Not a
full elimination but a ~60-70% reduction in handshake cost.

**Impact on sequential skill subprocess calls**: Positive for the same reason.
Every subprocess call gets cheaper regardless of caching.

**Impact on serve mode**: Positive. Can be combined with S1 for serve mode.

**Diagnostics**: Screen-off and locked states are still detected proactively
with good messages. Accessibility/operator failures are now reactive (first
command gets `RESULT_ENVELOPE_TIMEOUT` with the existing hint to run doctor).
The existing timeout hint already surfaces this diagnostic path, so degradation
is limited.

**Stale-state risk**: Low for screen/lock (dumpsys is read-only and cheap to
re-run). Medium for operator health (operator could crash between the check and
the command, same as current).

**Implementation complexity**: Medium. `dumpsys power` output format varies
across Android versions (tested: Samsung SM-S901E output differs from emulator
output). Requires parsing multiple possible formats or using a more stable ADB
signal. `dumpsys accessibility` is available but verbose; grepping for the
operator package is fragile if the output format changes.

**Skill rewrites required**: No.

**Public API/result changes**: Minor. `DEVICE_ACCESSIBILITY_NOT_RUNNING` would
no longer be proactively surfaced on the execution path; it becomes reactive
via `RESULT_ENVELOPE_TIMEOUT`. This is a meaningful diagnostic regression for
the accessibility-disabled case. Agent must run `clawperator doctor` to diagnose.

**Key risk**: `dumpsys` output is not a stable Android API. On some OEM builds,
the exact strings differ. A probe built on `dumpsys` output parsing could be
brittle on devices outside the test set. This risk is manageable with defensive
parsing and unit tests, but it is real.

**Verdict**: High value if the `dumpsys` parsing can be made robust. Reduces
handshake cost for all callers without any architectural change. The diagnostic
tradeoff (reactive accessibility errors) is acceptable but must be documented.
Should be combined with S1 or S2 for maximum effect.

---

### S4 - Reactive Diagnostics (Remove the Proactive Probe)

**How it works**: Remove `ensureInteractiveAutomationReady` from the
`runExecution` hot path entirely. The command is dispatched immediately after
APK presence and device resolution. If the device is locked, off, or the
accessibility service is down, the broadcast times out or returns
`SERVICE_UNAVAILABLE`.

**Impact on one-shot CLI**: Maximal. Zero handshake overhead. Every command
immediately proceeds to broadcast.

**Impact on sequential skill subprocess calls**: Maximal. Same.

**Impact on serve mode**: Maximal. Same.

**Diagnostics**: Severe regression. `DEVICE_NOT_INTERACTIVE` (with structured
`details.screenOn`, `details.deviceLocked`, `details.userUnlocked` evidence)
disappears from the execution path. Agents and skill scripts that relied on this
for "pre-flight check before doing anything" now get `RESULT_ENVELOPE_TIMEOUT`
with no structured device-state evidence. This is a meaningful degradation
in agent-recoverable error quality.

The `RESULT_ENVELOPE_TIMEOUT` hint already says to run `clawperator doctor`, but
an agent in an automation loop that gets "timeout" instead of "device is locked"
cannot auto-recover; it needs to run `doctor` or inspect the device manually.

**Stale-state risk**: N/A (there is no state).

**Implementation complexity**: Low. Remove 3 lines from `runExecution`.

**Skill rewrites required**: No, but skill error handling is degraded. Skills
that currently emit meaningful failure messages when `DEVICE_NOT_INTERACTIVE` is
surfaced would now emit generic "execution failed" messages.

**Public API/result changes**: Yes. Removes `DEVICE_NOT_INTERACTIVE` from
execution-path errors. Breaking change in practice for any agent that branches
on this code.

**Verdict**: Too aggressive as a standalone change. The diagnostic regression
is unacceptable without something to replace it. However, this approach is
sound as a `--fast` flag or as the behavior when a readiness cache confirms
the device was recently ready. The insight - that the probe is a full round trip
that we pay eagerly for a failure mode that is actually rare in healthy
automation loops - is worth preserving.

---

### S5 - Transparent Background Daemon (Persistent Runtime)

**How it works**: `clawperator` transparently connects to a local background
process (a Node.js daemon) via a Unix domain socket or a local TCP port. The
daemon is auto-started on first use (or explicitly started with
`clawperator daemon start`). Subsequent CLI calls send their execution payloads
to the daemon via a lightweight IPC protocol and receive results back. The
daemon process holds:

- In-memory readiness state and cache
- Pre-warmed ADB connection
- (Optionally) pre-attached logcat stream
- Session-scoped execution lock per device

This is the same model as `adb server` (persistent Android Debug Bridge server
process), `docker` (persistent Docker daemon), `ssh-agent` (key-holding daemon),
and Playwright's browser server mode.

**Impact on one-shot CLI**: Maximal. After the first command, subsequent CLI
calls pay ~5-15ms IPC round trip instead of ~410ms handshake + ~50ms Node
process startup. For commands called in rapid succession, this is an order-of-
magnitude improvement.

**Impact on sequential skill subprocess calls**: Maximal. Each `exec` call from
`runClawperator()` routes through the daemon. The handshake fires once (first
command) and is cached in the daemon for all subsequent calls within the TTL.
A skill with 10 exec calls saves ~3.7 seconds of handshake overhead.

**Impact on serve mode**: Becomes natural. `clawperator serve` is just "run the
daemon in long-lived foreground HTTP mode." The distinction between serve and
one-shot CLI collapses.

**Diagnostics**: Excellent. The daemon owns device state and can maintain full
probe semantics. `DEVICE_NOT_INTERACTIVE` with structured evidence is preserved.

**Stale-state risk**: Low. The daemon is the single authoritative holder of
readiness state. It can respond to device events, USB disconnect signals, and
ADB failure callbacks.

**Implementation complexity**: High. Requires:
- IPC protocol (Unix socket + length-prefixed JSON messages, or HTTP on localhost)
- Daemon auto-start logic (check if running, launch if not, with timeout)
- Daemon lifecycle management (`clawperator daemon start/stop/status`)
- Version pinning (daemon must match CLI version; mismatch must be detected)
- Daemon crash recovery (CLI falls back to direct mode if daemon is unreachable)
- Process supervision / PID file management
- Security: Unix socket permissions (localhost-only, user-owned)

**Skill rewrites required**: No. The `resolveClawperatorBin()` utility in
`utils/common.js` would transparently route through the daemon if it is
running. Skills do not change.

**Public API/result changes**: No. All result envelopes remain identical.
New commands: `clawperator daemon start`, `clawperator daemon stop`,
`clawperator daemon status`. Existing commands unchanged.

**Agent UX analysis**: This is what agents trained on Playwright, Docker,
or adb would expect. `clawperator snapshot` works fast because there's something
already connected. The agent does not need to manage the connection or worry
about it. The `guessability` principle from the design doc is satisfied:
an agent that tries `clawperator snapshot` a second time should get a fast
response without being told to `clawperator serve` first.

**Verdict**: The best long-term product architecture. Provides maximal benefit
across all call patterns without requiring any changes to skill scripts or
calling conventions. The adb server precedent demonstrates this model is
well-understood and acceptable in the Android tooling ecosystem. The
implementation cost is high but the result is a fundamentally better product.

---

### S6 - Hybrid: Cheap Probe + In-Process Cache + Filesystem Cache

**How it works**: Combine the practical pieces of S2 and S3:

1. Add a filesystem cache (S2) that makes cross-process calls fast.
2. Replace the broadcast probe with a `dumpsys power` screen check for cached
   "known good" devices (S3a).
3. Keep the full broadcast probe as the initial check and as the fallback for
   cached calls where the cheap probe fails.
4. Add in-process serve cache (S1) on top.

**Impact on one-shot CLI**: Good. Second CLI call reads the filesystem cache,
does a cheap screen check (~50ms vs ~410ms). Saves ~360ms.

**Impact on sequential skill subprocess calls**: Good. Same as second CLI call.

**Impact on serve mode**: Excellent. Multiple layers of caching work together.

**Diagnostics**: Good. The cheap probe can still surface `DEVICE_NOT_INTERACTIVE`
for screen-off and locked states. Accessibility failures are reactive (no
proactive `DEVICE_ACCESSIBILITY_NOT_RUNNING`).

**Stale-state risk**: Medium. Cheap probe + filesystem cache creates more
complex invalidation logic.

**Implementation complexity**: Medium-high. Three distinct mechanisms to
implement and keep consistent.

**Skill rewrites required**: No.

**Public API/result changes**: Minor (same as S3).

**Verdict**: A pragmatic assembly of improvements that doesn't require the
architectural commitment of S5. Less elegant than the daemon but meaningful
improvement without big risk. A reasonable intermediate step while S5 is
planned and built.

---

## Comparison Matrix

| Solution | One-Shot CLI | Subprocess Skills | Serve Mode | Diagnostics | Stale Risk | Complexity | Skill Rewrites | API Changes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 In-Process Cache | None | None | Significant | Good | Low | Low | No | No |
| S2 Filesystem Cache | Good | Good | Good | Good | Medium | Medium | No | No |
| S3 Cheap Host Probe | Good | Good | Good | Some loss | Low | Medium | No | Minor |
| S4 Reactive Only | Maximal | Maximal | Maximal | Severe loss | N/A | Trivial | No | Breaking |
| S5 Background Daemon | Maximal | Maximal | Maximal | Excellent | Low | High | No | Additive |
| S6 Hybrid (S2+S3+S1) | Good | Good | Excellent | Some loss | Medium | Med-High | No | Minor |

---

## Recommendation: Most Ideal

**S5 - Transparent background daemon.**

The fundamental problem is that Clawperator is designed as an actuator (the
"hand") but operates in a model where every command pays full cold-start costs.
The guiding principles say the API is the product and the consumer is an LLM
agent. An LLM agent expects tools to be fast and persistent - it does not expect
to manage connection lifecycle any more than it manages browser startup in
Playwright.

The daemon model eliminates this impedance. `clawperator snapshot` works fast
because there is already a runtime process holding device state. The agent does
not need to know this. Skills do not need rewrites. The CLI commands do not
change. The result envelope does not change.

The adb server is the closest analogy. Agents and developers who have ever used
`adb` already understand the model intuitively: `adb server` starts
automatically, and your `adb shell` commands are fast because they hit a
running process rather than establishing a new connection each time.

**What the daemon model solves that nothing else does:**

- Eliminates handshake cost for all callers, not just serve mode.
- Eliminates Node.js process startup overhead (~50-100ms per CLI call).
- Creates the natural foundation for later improvements: pre-attached logcat
  stream (removes logcat startup delay per command), persistent ADB connection,
  streaming results.
- Is transparent to all existing callers. Skills in `clawperator-skills` work
  without any changes.

**What the daemon model requires:**

- A well-defined version compatibility check (daemon must match CLI version).
- A fallback path: if the daemon is not reachable or not running, fall back to
  direct mode. This means the direct-mode code path cannot be removed, only
  made secondary.
- Lifecycle commands: `clawperator daemon start`, `clawperator daemon stop`,
  `clawperator daemon status` (and probably `clawperator daemon restart`).
- A clear decision on auto-start behavior: does `clawperator snapshot` silently
  auto-start the daemon, or does it require `daemon start` first? The former is
  more ergonomic (adb model). The latter is more explicit (Docker model).

**Recommended auto-start policy**: Auto-start the daemon on first use, silently,
in the background. Display a one-line notice on stderr the first time
(`Starting Clawperator runtime...`). This matches the adb model and the
guessability principle: "clawperator snapshot" should work fast without ceremony.

---

## Recommendation: Easiest Implementation

**S2 - Cross-process filesystem cache.** This is the best near-term step that
provides benefit across all call patterns without requiring architectural
changes.

**Why S2 over S3 (cheap probe):**

- S2 is purely additive. It does not change what the probe checks or how errors
  are reported. It just memoizes the result.
- S3 requires parsing `dumpsys` output, which varies across Android OEM builds.
  The brittleness risk is real and requires live-device validation across
  multiple device types.
- S2's filesystem approach has clear precedent in the Android tooling world (adb
  server writes a pid file; socket files are standard IPC).

**Implementation sketch for S2:**

A small module `readinessFileCache.ts` reads and writes a JSON file in the
OS temp directory. Key design decisions:

- Path: `os.tmpdir()/clawperator-ready-<hash-of-deviceId-and-operatorPackage>.json`
- Contents: `{ deviceId, operatorPackage, readyAt, state: InternalInteractiveState }`
- TTL: 8 seconds (matches in-process cache)
- Write: atomic (temp file + rename) to prevent partial reads
- Read: graceful failure on parse error (treat as cache miss, not a crash)
- Invalidation: the `invalidateReadinessCache` function deletes the file; called
  on the same failure codes as the in-process cache
- Concurrent safety: last-write-wins on the atomic rename is acceptable for this
  use case (two processes that both probed successfully and wrote the same
  confirmed-ready state race to write - the outcome is correct either way)

**This S2 should replace (not supplement) the in-process cache from the existing
plan for the execution path**, since S2 subsumes S1's benefit (serve mode also
reads the file, which is faster than the broadcast probe anyway). S1 adds a
tiny in-memory layer on top that avoids even the file I/O on serve-mode rapid
calls - this is worth keeping in serve mode as a two-tier design.

**Combined approach for easiest-implementation path:**

1. Implement S2 (filesystem cache) as the primary cache. Benefits all callers.
2. Add S1 (in-process) as a second tier on top for serve mode (avoids file I/O
   on rapid successive serve-mode calls).
3. Leave S3 (cheap probe) for a follow-up, after measuring how much of the
   remaining cost comes from the probe versus other factors.

This combined S1+S2 approach helps one-shot CLI, sequential subprocess skills,
and serve mode - covering all the patterns the existing plan missed - with
manageable implementation complexity.

---

## Assessment of the Existing Plan

The existing plan (`plan.md` + `work-breakdown.md`) is well-designed but
scope-limited. It correctly identifies the problem, correctly designs the cache,
and correctly preserves diagnostics. Its acceptance criteria, test requirements,
and live-device validation matrix are sound.

**What it gets right:**

- The TTL value (8 seconds) is appropriate.
- The cache key design is correct.
- Invalidation on specific error codes is correct.
- Keeping the skills pre-spawn check uncached is correct.
- The accepted reactive-failure tradeoff is correctly analyzed and documented.

**What it gets wrong (or leaves unaddressed):**

- It solves only the serve-mode case and states this explicitly. For a project
  whose guiding principle is "the API is the product" and whose primary consumer
  is an LLM agent, optimizing only the HTTP API mode while leaving the CLI
  subprocess model (how most skills actually work) unchanged is a significant
  gap.
- It does not address process startup overhead (~50-100ms per CLI call), which
  is paid in addition to the handshake and is not recoverable without a
  persistent process.

**Should the existing plan be revised?**

Yes. The plan should be extended to include a filesystem cache (S2) as a
companion to the in-process cache. The in-process cache becomes a tier-2 hot
path for serve mode (avoids file I/O on rapid successive calls), and the
filesystem cache becomes the tier-1 cross-process mechanism that helps all
callers.

The `work-breakdown.md` step for adding `READINESS_CACHE_TTL_MS`,
`invalidateReadinessCache`, `clearReadinessCacheForTesting`, and
`ensureInteractiveAutomationReadyCached` is still correct and can be expanded
to add the filesystem layer alongside the in-process layer.

The overall task pack can remain a single PR if the filesystem layer is
straightforward enough, or can be split into:
- PR-1a: in-process cache (current plan, helps serve mode)
- PR-1b: filesystem cache layer (extends benefit to CLI and subprocess skills)

The most important change is to not ship the in-process cache as "the complete
readiness optimization" without acknowledging that the CLI-subprocess pattern
remains unimproved. That sets a misleading expectation.

---

## Long-Term Sequencing Recommendation

1. **PR-1 (near-term)**: Implement S1+S2 combined (in-process + filesystem
   cache). Benefits all callers. No architectural change. No skill rewrites.

2. **PR-2 (medium-term)**: Implement S3a (cheap `dumpsys power` screen check)
   as an additional optimization. Reduces the cost of the first (cold) probe
   from ~410ms to ~100ms. Requires careful `dumpsys` output parsing with
   multi-device validation.

3. **PR-3 / separate track (longer-term)**: Design and implement the
   transparent background daemon (S5). This is the correct long-term product
   shape. It should be planned with attention to version pinning,
   auto-start behavior, fallback to direct mode, and daemon lifecycle commands.
   Once the daemon is in place, the filesystem cache (S2) becomes redundant
   (the daemon is the persistent process that holds state), but the in-process
   cache (S1) is still useful within the daemon's own hot path.

---

## Open Questions for Product Decisions

These require a product decision, not a technical one:

1. **Auto-start vs explicit daemon**: Should `clawperator snapshot` silently
   auto-start a daemon process if one is not running? Or should agents be
   expected to run `clawperator daemon start` first? The adb precedent favors
   auto-start. The Docker precedent favors explicit. Given the guiding principles
   (guessability, "just works"), auto-start is the right call - but it requires
   a decision on the version-compatibility check behavior.

2. **Diagnostic regression acceptability**: S3 (cheap probe) trades the
   proactive `DEVICE_ACCESSIBILITY_NOT_RUNNING` error for a reactive
   `RESULT_ENVELOPE_TIMEOUT`. Is this acceptable given that `RESULT_ENVELOPE_TIMEOUT`
   already has a hint pointing to `clawperator doctor`? If yes, S3 can be
   shipped without a new error code. If no, a new error code or a better
   reactive diagnostic path is needed first.

3. **Filesystem cache scope**: Should the filesystem cache be per-user (in
   `~/.clawperator/cache/`) for persistence across reboots, or per-session (in
   `/tmp/`) with automatic cleanup? For an 8-second TTL, `/tmp/` is almost
   certainly fine and avoids the cleanup problem.

4. **Daemon as the platform for other hot-path improvements**: If the daemon
   is planned, S2 (filesystem cache) may not be worth implementing at all -
   it is a bridge solution that becomes obsolete when the daemon lands. Is S2
   worth the implementation effort as a bridge, or should effort go directly
   into S5 planning?
