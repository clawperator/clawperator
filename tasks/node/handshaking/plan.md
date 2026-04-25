# Handshake Readiness Optimization: Plan

Date: 2026-04-26
Status: READY FOR IMPLEMENTATION
Surface: Node snapshot execution preflight and readiness checks

## Scope

Reduce per-command readiness handshake cost by introducing a short-TTL in-process
readiness cache in the `runExecution` hot path. The cache bypasses the full
broadcast-plus-logcat `doctor_ping` round trip when the device was recently
confirmed ready. Full probes are preserved for first calls, error recovery, and
all `doctor` checks.

The expected measurable outcome is that serve-mode executions after the first
warm call skip the ~410ms handshake on cache hits. One-shot CLI calls see no
meaningful improvement, but correct behavior is preserved in all modes.

## Non-Goals

These items are explicitly out of scope for this task pack:

- Android-side snapshot filtering, payload reduction, diff snapshots, or transport
  replacement - those live in `tasks/node/io-optimizations/findings-deferred.md`
- Replacing the broadcast/logcat transport with a socket (deferred, D4)
- Modifying the `[Clawperator-Result]` envelope contract or shape
- Modifying the `doctor` command or doctor check behavior
- Removing the full probe from the first call, error recovery, or locked states
- Host-side `dumpsys power` probe as a partial readiness shortcut (deferred until
  post-PR-1 measurement shows it is needed)
- Changing the skills pre-spawn readiness check in `skills.ts` (see decision below)
- Any Android-side changes

## Decisions Locked

The following decisions from `tasks/node/handshaking/findings.md` are now resolved.

### 1. Hot-path policy

Optimize the serve-mode hot path. One-shot CLI does not benefit from an in-process
cache (each CLI invocation is a fresh process). Accept that CLI latency is unchanged.
Do not implement a host-side probe shortcut at this stage.

### 2. Handshake strategy

Add a short-TTL readiness cache to the `runExecution` call path only. The cache:

- wraps `ensureInteractiveAutomationReady` at the `runExecution` call site
- returns the cached `InternalInteractiveState` when the entry is valid
- falls through to the full probe on cache miss

The `doctor` checks, `checkDeviceInteractiveState`, and all direct
`probeInteractiveState` call sites are NOT cached. Their probes always run fresh.

The skills pre-spawn check in `skills.ts` (`resolveInteractiveSkillTarget`) is also
NOT cached. The pre-spawn probe is specifically designed to give skills a clear
`DEVICE_NOT_INTERACTIVE` error before wasting time spawning and running the skill
body. Using a cache there would produce a less actionable reactive failure later
instead of a clean upfront error. This path stays uncached.

### 3. Cache coverage

The cache applies in both serve mode and one-shot CLI mode, but only the serve mode
benefits in practice. Do not add a mode flag to exclude CLI mode - the cache
entry is simply never reused in one-shot invocations and the code is simpler without
a special case.

### 4. TTL

`READINESS_CACHE_TTL_MS = 8000` (8 seconds).

Rationale: 8 seconds covers typical agent loop inter-command gaps (1-5 seconds
per command in a snappy execution loop) while keeping the probe fresh enough
that transient device state changes (screen timeout, lock kick-in) are detected
quickly by a subsequent cold call. Values much shorter than 5s reduce the
benefit for slow commands; values much longer than 10s increase the window for
stale state to cause silent misbehavior.

### 5. Cache key

`${resolvedDeviceId}:${operatorPackage}`.

Both fields must use resolved (post-`resolveDevice`) values, not option-time
strings. The key must be computed after `config.deviceId` is finalized.

### 6. Cache invalidation triggers

The cache entry for a given `deviceId + operatorPackage` pair is invalidated
immediately (not just TTL-expired) when any of the following occurs:

| Trigger | Mechanism |
| --- | --- |
| TTL expiry | Cache check compares `Date.now()` against `readyAt + TTL` |
| `DEVICE_NOT_INTERACTIVE` error from handshake | `invalidateReadinessCache` called in `runExecution` before returning the error |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` error | Same |
| `DEVICE_SHELL_UNAVAILABLE` error | Same |
| `BROADCAST_FAILED` error | Same, if returned from the main execution path |
| `RESULT_ENVELOPE_TIMEOUT` from the result waiter | Same - device may have gone unready |
| `SERVICE_UNAVAILABLE` in the result envelope | `invalidateReadinessCache` called after envelope is received |
| Change in `deviceId` | Different cache key - automatically a miss |
| Change in `operatorPackage` | Different cache key - automatically a miss |

The following events do NOT invalidate the cache because the Node runtime has no
in-process signal for them:

- Physical USB disconnect (detected only on the next command failure)
- `adb server` restart (detected only on the next ADB failure)
- Screen turning off mid-session (detected as a reactive timeout or service failure
  on the next command)

These cases are handled reactively: the command fails, the error code triggers cache
invalidation above, and the next command re-probes. This is the same behavior as the
current handshake path, which also cannot prevent mid-command state changes.

### 7. Which action types use the cached path

All actions that go through `runExecution` use the cached path. There is no
action-type-specific bypass. The cache is equally valid for `snapshot_ui`,
`click`, `read_text`, and all other action types. The readiness check does not
verify anything action-type-specific - it only verifies screen, lock, and user
state.

`close_app`-only executions bypass `ensureInteractiveAutomationReady` entirely
(as they do today). The cache is not involved for those.

### 8. Diagnostic preservation

The following failure codes must continue to be produced with the same
user-facing semantics when the full probe fires:

- `DEVICE_NOT_INTERACTIVE` with `details.screenOn`, `details.deviceLocked`,
  `details.userUnlocked` evidence
- `DEVICE_ACCESSIBILITY_NOT_RUNNING` when the operator responds with an error
- `DEVICE_SHELL_UNAVAILABLE` on transport failure during wake attempts
- `RESULT_ENVELOPE_MALFORMED` when the doctor_ping response is invalid

A cache hit does not produce any of these codes. The only difference is that
a stale "ready" cache entry allows the command to proceed into the broadcast path,
where it may then fail with `RESULT_ENVELOPE_TIMEOUT` or `SERVICE_UNAVAILABLE`
instead of the proactive readiness error. This is the known and accepted tradeoff
(see below).

### 9. Accepted behavior change

When a device transitions from ready to unready (screen off, lock kicks in, service
crashes) WITHIN an active cache TTL window:

- **Before this change:** The next command fails with `DEVICE_NOT_INTERACTIVE` or
  `DEVICE_ACCESSIBILITY_NOT_RUNNING` from the proactive handshake probe.
- **After this change:** The next command may skip the probe (cache hit), proceed
  to broadcast, and then fail reactively with `RESULT_ENVELOPE_TIMEOUT` or
  `SERVICE_UNAVAILABLE`.

This is an acceptable tradeoff. The cache invalidation on those reactive failures
means the subsequent command will re-probe and produce the correct proactive error.
A well-written agent loop will see at most one "wrong" error code per state
transition event, then recover correctly on the next command. Skill scripts
already handle `RESULT_ENVELOPE_TIMEOUT` as a terminal failure and do not rely
on the specific distinction between proactive and reactive readiness errors.

The accepted tradeoff must be documented in code comments and in docs.

## PR/Phase Breakdown

### PR-1: Short-TTL readiness cache in runExecution (this task pack)

All of the work described in this plan is a single PR. There is no PR-2 at this
time. If post-PR-1 measurement shows that one-shot CLI latency is still
unacceptably slow, a separate task pack for a host-side `dumpsys power` shortcut
can be authored at that point.

## Acceptance Criteria

PR-1 is done when all of the following are true:

1. `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
2. All existing `deviceInteractivity.test.ts` and `runExecution.test.ts` tests pass
   unchanged.
3. New unit tests cover: cache hit, cache miss (cold), TTL expiry, invalidation on
   each listed error code, and concurrent calls (two simultaneous calls do not
   produce two parallel probes when the cache is being populated).
4. A live-device validation run passes the matrix in the work-breakdown.
5. Skills smoke tests pass for the two designated skills on a physical device.
6. Code comments explain the cache, the TTL, and the reactive-failure tradeoff.
7. `docs/api/errors.md` is updated to document the changed failure mode for
   `DEVICE_NOT_INTERACTIVE` during cache windows (see documentation section).
8. `npm --prefix apps/node run build` succeeds after all changes.
9. `./scripts/docs_build.sh` succeeds if docs were changed.

## Documentation Update Requirements

Update `docs/api/errors.md` in the `DEVICE_NOT_INTERACTIVE` section:

- Note that in serve mode and repeated-command workflows, a readiness cache with
  an 8-second TTL is active.
- Note that during a cache window, a device-unready transition may surface as
  `RESULT_ENVELOPE_TIMEOUT` or `SERVICE_UNAVAILABLE` rather than
  `DEVICE_NOT_INTERACTIVE`.
- Note that cache invalidation on those reactive failures means the subsequent
  command re-probes and produces the correct proactive error.

No changes required to `docs/api/snapshot.md`, `docs/api/actions.md`, or the
result-envelope contract documentation. The envelope shape is unchanged.

If the change is shipped and measured to improve serve-mode latency as expected,
update `tasks/node/io-optimizations/findings.md` to note the handshake cost is
now reduced on warm cache hits, and update the measurements table if new
measurements are taken.

## Skill Compatibility Analysis

### Replay skills (CLI subprocess model)

Replay skills like `com.solaxcloud.starter.get-battery` and
`com.google.android.apps.chromecast.app.get-climate-replay` call
`clawperator exec` via `execFileSync` from child processes. Each `exec` call
spawns its own process. The in-process readiness cache does not survive across
process boundaries. These skills see no behavior change.

The skills pre-spawn readiness check in `skills.ts` fires a full fresh probe
before the skill starts (uncached). This is unchanged.

### Orchestrated skills (serve API model)

Skills that call `POST /exec` via the serve API (e.g., the LLM-orchestrated
`set-discharge-to-limit-orchestrated`) go through `runExecution` in the serve
process. Each API call benefits from the cache on warm hits. The skill's retry
and recovery logic does not change because:

- The skill already handles `RESULT_ENVELOPE_TIMEOUT` as a terminal failure.
- The change in failure surface (proactive to reactive) is documented but does
  not affect the skill's existing retry decisions.
- The skill's `RESULT_ENVELOPE_TIMEOUT` recovery path (close app, reopen,
  retry once) remains valid and sufficient.

### Skills retry patterns

No existing skill inspects `DEVICE_NOT_INTERACTIVE` specifically to take a
different recovery path. All observed retry patterns are based on
`RESULT_ENVELOPE_TIMEOUT` or general exec failure (`ok: false`), which this
change does not alter.

No skill package changes are required.

## Risk and Rollback Notes

The cache is a pure additive optimization. If it causes unexpected behavior:

- Set `READINESS_CACHE_TTL_MS = 0` and rebuild - this disables caching without
  any behavior change to the probe path. No contract changes to roll back.
- All doctor checks, skills pre-spawn checks, and direct readiness API calls
  are unaffected and can still detect device state correctly.

Risk level is low. The only behavioral change is the proactive-to-reactive error
shift described in the accepted tradeoff section above.

## Explicit Exclusion: Android Snapshot Filtering and Transport Replacement

This task pack does not touch:

- `apps/android/` - any Android-side code
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `apps/android/shared/data/uitree/`

Android filtering and transport replacement are owned by
`tasks/node/io-optimizations/findings-deferred.md` and require separate task packs.
Do not open that work here.
