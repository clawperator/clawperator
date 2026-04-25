# Handshake Readiness Optimization: Work Breakdown

Date: 2026-04-26
Companion: `tasks/node/handshaking/plan.md`

This file is the step-by-step implementation guide for PR-1.

## Before Starting

Read the following files completely before touching any code:

1. `tasks/node/handshaking/findings.md` - background and open questions (now resolved in plan.md)
2. `tasks/node/handshaking/plan.md` - all locked decisions, scope, and acceptance criteria
3. `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` - the module being changed
4. `apps/node/src/domain/executions/runExecution.ts` - the primary call site
5. `apps/node/src/cli/commands/skills.ts` - the call site that must NOT be cached

Do not implement anything that contradicts the locked decisions in `plan.md`.

## Files to Change

| File | Change |
| --- | --- |
| `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` | Add cache store, TTL constant, cache key builder, cached wrapper, invalidation export |
| `apps/node/src/domain/executions/runExecution.ts` | Use cached wrapper; call invalidation on specific error codes |
| `docs/api/errors.md` | Update `DEVICE_NOT_INTERACTIVE` section with cache-window behavior note |

### Do NOT change

- `apps/node/src/cli/commands/skills.ts` - skills pre-spawn probe stays uncached
- `apps/node/src/domain/doctor/checks/readinessChecks.ts` - doctor probes stay uncached
- Any Android-side code
- The `[Clawperator-Result]` envelope shape or contract
- `apps/node/src/contracts/errors.ts` - no new error codes

## Implementation Steps

### Step 1: Add cache module to deviceInteractivity.ts

Location: `apps/node/src/domain/doctor/checks/deviceInteractivity.ts`

Add the following before the existing exported functions:

**Cache TTL constant:**

```typescript
export const READINESS_CACHE_TTL_MS = 8000;
```

**Cache entry type** (internal, not exported):

```typescript
interface ReadinessCacheEntry {
  state: InternalInteractiveState;
  readyAt: number;
}
```

**Cache store** (module-level, not exported directly):

```typescript
const readinessCache = new Map<string, ReadinessCacheEntry>();
```

**Cache key builder** (internal):

```typescript
function buildReadinessCacheKey(deviceId: string, operatorPackage: string): string {
  return `${deviceId}:${operatorPackage}`;
}
```

**Exported invalidation function:**

```typescript
export function invalidateReadinessCache(deviceId: string, operatorPackage: string): void {
  readinessCache.delete(buildReadinessCacheKey(deviceId, operatorPackage));
}
```

**Exported test-only cache clear** (for unit tests):

```typescript
export function clearReadinessCacheForTesting(): void {
  readinessCache.clear();
}
```

**Exported cached wrapper:**

```typescript
export async function ensureInteractiveAutomationReadyCached(
  config: RuntimeConfig,
  options?: Parameters<typeof ensureInteractiveAutomationReady>[1]
): Promise<InteractiveAutomationReadyResult> {
  const deviceId = config.deviceId ?? "";
  const operatorPackage = config.operatorPackage ?? "";
  const key = buildReadinessCacheKey(deviceId, operatorPackage);
  const entry = readinessCache.get(key);

  if (entry !== undefined && Date.now() - entry.readyAt < READINESS_CACHE_TTL_MS) {
    return { ok: true, state: entry.state };
  }

  const result = await ensureInteractiveAutomationReady(config, options);

  if (result.ok) {
    readinessCache.set(key, { state: result.state, readyAt: Date.now() });
  }

  return result;
}
```

Important invariants:
- Only a `result.ok === true` response populates the cache. Failed probes do not
  set a cache entry. The cache only ever stores confirmed-ready states.
- The cache key uses the resolved `config.deviceId`, not an option-time value.
  In `runExecution`, this function is called after `config.deviceId` has been
  set to the resolved serial. Verify this in the call site.
- Both `deviceId` and `operatorPackage` default to `""` for the key if undefined.
  This is safe - the key is just used as a Map lookup and an empty string produces
  a distinct key from any real device serial.

### Step 2: Wire cache into runExecution.ts

Location: `apps/node/src/domain/executions/runExecution.ts`

**Import the cached wrapper and invalidation function:**

```typescript
import {
  ensureInteractiveAutomationReady,
  ensureInteractiveAutomationReadyCached,
  invalidateReadinessCache,
  probeInteractiveState,
  toPublicInteractiveAutomationError
} from "../doctor/checks/deviceInteractivity.js";
```

**In `RunExecutionOptions`, add the cached variant as the default injection point:**

Change:
```typescript
ensureInteractiveAutomationReadyFn?: typeof ensureInteractiveAutomationReady;
```
To:
```typescript
ensureInteractiveAutomationReadyFn?: typeof ensureInteractiveAutomationReadyCached;
```

This lets tests inject their own mock at this seam. The default changes from
the uncached `ensureInteractiveAutomationReady` to the cached wrapper.

**In `performExecution`, change the call site:**

Change:
```typescript
const ensureInteractiveAutomationReadyFn = options.ensureInteractiveAutomationReadyFn ?? ensureInteractiveAutomationReady;
```
To:
```typescript
const ensureInteractiveAutomationReadyFn = options.ensureInteractiveAutomationReadyFn ?? ensureInteractiveAutomationReadyCached;
```

The rest of the handshake call is unchanged.

**Add cache invalidation on failure paths in `performExecution`:**

After the handshake fails and before returning an error, call invalidation:

```typescript
if (!interactiveState.ok) {
  invalidateReadinessCache(deviceId, config.operatorPackage ?? "");
  cancelEarlyResultWaiter();
  const publicError = interactiveState.error.code === ERROR_CODES.DEVICE_NOT_INTERACTIVE
    ? toPublicInteractiveAutomationError(interactiveState.error)
    : interactiveState.error;
  return { execution, result: { ok: false, error: publicError, deviceId } };
}
```

Note: the handshake failure path will never have a cache entry (failures are
not cached), but calling invalidation here is defensive and ensures stale entries
from a previous successful probe are cleared when the probe newly fails.

After a `RESULT_ENVELOPE_TIMEOUT` or broadcast failure:

In the `if ("timeout" in result && result.timeout)` block, add before the return:
```typescript
invalidateReadinessCache(deviceId, config.operatorPackage ?? "");
```

In the `if ("broadcastFailed" in result && result.broadcastFailed)` block, add:
```typescript
invalidateReadinessCache(deviceId, config.operatorPackage ?? "");
```

After receiving a `SERVICE_UNAVAILABLE` envelope (already handled in
`injectServiceUnavailableHint`), add invalidation immediately after the hint
injection in the success path:

```typescript
if (result.envelope.errorCode === "SERVICE_UNAVAILABLE") {
  invalidateReadinessCache(deviceId, config.operatorPackage ?? "");
}
```

Place this before `reconcileEnvelopeStatusAfterPostProcessing`.

**Add a comment at the ensureInteractiveAutomationReadyCached call site:**

```typescript
// Uses a short-TTL in-process cache to skip the full broadcast-plus-logcat
// doctor_ping round trip on warm repeat calls. The cache is only populated on
// successful probes. Failures, timeouts, and service-unavailable results
// invalidate the cache so the next command re-probes. See plan.md for the
// accepted reactive-failure tradeoff.
```

### Step 3: Update docs/api/errors.md

Location: `docs/api/errors.md`

In the `### DEVICE_NOT_INTERACTIVE` section, after the existing "Typical recovery:"
block, add a new subsection:

```markdown
#### Readiness cache and serve mode

When running commands through the serve API or in rapid succession within the same
process, a short-TTL (8-second) readiness cache is active on the execution path.
On a cache hit, the proactive readiness probe is skipped.

If a device transitions from ready to unready within an active cache window, the
next command may skip the proactive probe and fail reactively with
`RESULT_ENVELOPE_TIMEOUT` or `SERVICE_UNAVAILABLE` instead of
`DEVICE_NOT_INTERACTIVE`. Both reactive failures immediately invalidate the cache.
The subsequent command re-probes and produces the correct proactive error.

This tradeoff is intentional. Agent loops typically encounter at most one
"wrong" error code per device-state-change event, then recover correctly on the
next command.

The cache does not apply to:
- `clawperator doctor` checks
- skills pre-spawn readiness checks
- one-shot CLI mode (no benefit; each process starts cold)
```

After docs change, run `./scripts/docs_build.sh` and confirm success.

## Required Tests

### Location

`apps/node/src/test/unit/doctor/deviceInteractivity.test.ts`

Add a new `describe("ensureInteractiveAutomationReadyCached")` block.

### Required test cases

**1. Cache miss (cold call) - probes and caches**

- First call with no cache entry fires `ensureInteractiveAutomationReady` mock.
- Returns `{ ok: true, state }`.
- Second call within TTL does NOT fire the mock again.
- Second call returns same `{ ok: true, state }`.

**2. Cache hit - mock not called**

- Populate cache manually by making a successful first call.
- Replace mock with a function that throws.
- Second call within TTL succeeds without calling the mock.

**3. TTL expiry - re-probes after TTL**

- Make a successful first call.
- Advance mock time past `READINESS_CACHE_TTL_MS`.
- Second call fires the mock again.
- New entry replaces the old one.

Implementation note: `Date.now()` is used directly in the cache. Tests should
either use `clearReadinessCacheForTesting()` between tests, or call
`invalidateReadinessCache` to control state. For TTL testing, the implementing
agent may replace `Date.now` with a controllable stub if needed - but a simpler
approach is to set TTL = 0 in a test-specific scenario and call with real time.
If `READINESS_CACHE_TTL_MS` is exported, a test can test near-expiry by using
the constant directly. Do not use `setTimeout` sleeps in unit tests.

**4. Failure is NOT cached**

- Call with a mock that returns `{ ok: false, error: { code: DEVICE_NOT_INTERACTIVE } }`.
- Call again.
- Mock is called twice (cache not populated on failure).

**5. invalidateReadinessCache removes the entry**

- Populate the cache with a successful call.
- Call `invalidateReadinessCache(deviceId, operatorPackage)`.
- Next call fires the mock again (cache miss).

**6. clearReadinessCacheForTesting removes all entries**

- Populate cache entries for two different device keys.
- Call `clearReadinessCacheForTesting()`.
- Both keys are misses on the next calls.

**7. Different device keys are independent**

- Populate cache for `device-a:pkg`.
- Call with `device-b:pkg` - should probe (miss).
- Call again with `device-a:pkg` - should hit (no probe).

**8. Different operatorPackage keys are independent**

- Populate cache for `device:pkg-a`.
- Call with `device:pkg-b` - should probe (miss).

### Test hygiene

Each test case must call `clearReadinessCacheForTesting()` in a `beforeEach`
or at the start of the test to ensure isolation. Module-level cache state
leaks between tests if not cleared.

## Live-Device Validation Matrix

Run these validations on a physical device (Samsung SM-S901E or equivalent)
with `com.clawperator.operator.dev`, using the branch-local
`apps/node/dist/` build.

Use `--verbose` output where useful to observe whether probes are firing.

| # | State | How to set up | Expected behavior | Pass criteria |
| --- | --- | --- | --- | --- |
| 1 | Screen on, unlocked, service healthy - cold call | Normal device state | Full probe fires, cache populated | First exec: probe fires (observe timing ~410ms in preflight); result success |
| 2 | Screen on, unlocked - warm call (within TTL) | Immediately after test 1 | Second exec: probe skipped, ~0ms preflight | Second exec completes noticeably faster; result success |
| 3 | Screen off before exec | Turn screen off after confirming service is healthy | Full probe fires, `DEVICE_NOT_INTERACTIVE` returned, cache not populated | Error code `DEVICE_NOT_INTERACTIVE`, subsequent exec also probes |
| 4 | Device locked (keyguard) | Lock device with screen on | Full probe fires, `DEVICE_NOT_INTERACTIVE` returned | Error code `DEVICE_NOT_INTERACTIVE`, `details.deviceLocked = true` |
| 5 | Accessibility service disabled | Disable the Clawperator accessibility service in Android Settings | Full probe fires, `DEVICE_ACCESSIBILITY_NOT_RUNNING` | Error code, cache not populated; re-enabling and retrying restores normal behavior |
| 6 | Device becomes unready within TTL window | Start exec loop; turn screen off before second exec while first exec cache entry still valid | Second exec may return `RESULT_ENVELOPE_TIMEOUT`; third exec re-probes and returns `DEVICE_NOT_INTERACTIVE` | Exactly one "wrong" error code per state-change event, then correct proactive error |
| 7 | Operator package not installed | Uninstall `com.clawperator.operator.dev` | `OPERATOR_NOT_INSTALLED` from APK preflight - cache not involved | Error from APK check before readiness is called; unrelated to cache |
| 8 | Cache invalidation after timeout | After test 6, observe third exec behavior | Re-probe fires, correct proactive error | `DEVICE_NOT_INTERACTIVE` on third exec |

Record actual measured times for test 1 (cold) and test 2 (warm) and include
them in the PR description or a measurements update to `findings.md`.

## Skills Smoke-Validation Matrix

Run both skills against the branch-local build on a physical device.

Device: Samsung SM-S901E (or equivalent physical device)
Build: branch-local `apps/node/dist/` with `com.clawperator.operator.dev`
Command form: `clawperator skills run <id> --device <serial>`

### Skill 1: com.solaxcloud.starter.get-battery

This is a single-exec replay skill. The skills pre-spawn check fires a full
probe. The exec subprocess fires another probe in its own process (no cache
sharing). Behavior should be identical to pre-change.

Pass criteria:
- Skill result status `success`
- `[Clawperator-Skill-Result]` envelope emitted
- `battery_level_read` checkpoint `ok`
- No unexpected error codes

### Skill 2: com.google.android.apps.chromecast.app.get-climate-replay

This is a navigation-heavy replay skill with 13 actions including a
`snapshot_ui`. The skills pre-spawn check fires a full probe. The exec
subprocess fires another probe in its own process. Behavior should be
identical to pre-change.

Pass criteria:
- Skill result status `success`
- `[Clawperator-Skill-Result]` envelope emitted
- All three checkpoints `ok`: `app_opened`, `controller_opened`, `climate_status_read`
- `data.climate.device_name` matches the `--unit-name` argument
- No unexpected error codes

### Serve-mode API smoke validation (optional but encouraged)

Start `clawperator serve --device <serial>` and send 3 rapid `POST /exec`
snapshot commands in sequence. Observe timing of each:

- First exec: probe fires (~410ms handshake overhead)
- Second and third exec: probe skipped (cache hit, measurably faster)

This validates the primary beneficiary of the cache. Use `--verbose` or
the serve-mode event logs to confirm probe vs cache-hit behavior.

## Missing Test Seams (Implementation Agent Must Add)

The following test infrastructure does not exist yet and must be added:

1. **`clearReadinessCacheForTesting` export** - needed for test isolation between
   `describe` blocks. Export it from `deviceInteractivity.ts` and document it as
   test-only. Do not call it from production paths.

2. **`READINESS_CACHE_TTL_MS` export** - needed so TTL-related tests can reference
   the constant without duplicating the magic number.

3. **Time controllability** - if TTL tests require advancing time, consider
   exporting an injectable clock function `nowMs: () => number` in the cache
   module that defaults to `Date.now` and can be replaced in tests. This avoids
   `setTimeout` waits. This is optional - simpler tests may just call
   `invalidateReadinessCache` to simulate expiry semantics instead.

4. **Verify `config.deviceId` is resolved before cached call** - the implementing
   agent must confirm (by reading the call site in `runExecution.ts`) that
   `config.deviceId` is set to the resolved serial before
   `ensureInteractiveAutomationReadyCached` is called. If it is still unresolved
   at that point, the cache key would be built on an unresolved value and the
   cache would never hit. This is the single most important correctness check.

## Skill-Facing Compatibility Risks

These risks apply to agent-authored skill loops and should be understood by
the implementing agent before shipping:

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Stale "ready" cache causes reactive timeout instead of proactive error | Low | Cache TTL is 8s; most device-state-change events produce at most one wrong error; subsequent command re-probes and returns correct error |
| Skill observes `RESULT_ENVELOPE_TIMEOUT` where it previously saw `DEVICE_NOT_INTERACTIVE` | Low | No existing skill branches specifically on `DEVICE_NOT_INTERACTIVE`; all observed skills treat `ok: false` as a terminal failure |
| serve-mode orchestrated skill sends command to just-unready device | Low | Same reactive failure path as before; skill's existing recovery (close/reopen app, retry once) is still valid |
| Pre-spawn skills check produces stale result | None | The skills pre-spawn check is NOT cached; it always probes fresh |

## Build and Test Commands

Run these in order before committing:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

All three must pass. Do not commit with failing tests or a failing docs build.

## Planning Questions That Were Resolved

The open questions from `tasks/node/handshaking/findings.md` are answered here
for reference:

- **Q: What should happen in serve mode vs CLI?** A: Cache applies in both;
  only serve mode benefits. CLI mode is correct but not faster.
- **Q: What should invalidate cached ready state?** A: TTL, plus any of the
  six reactive failure codes listed above.
- **Q: Whether cheaper probe is trustworthy?** A: Deferred to post-PR-1.
  Not needed to ship PR-1.
- **Q: Should readiness be universal or action-type-specific?** A: Universal.
  No action-type bypass.
- **Q: What live-device validation is required?** A: See matrix above.

## Commit Message

When opening the PR, use this conventional commit subject:

```
perf(node): add short-TTL readiness cache to runExecution hot path
```

Body: summarize the TTL value, the cache key, the accepted reactive-failure
tradeoff, and the live-device validation results (measured cold vs warm times).
