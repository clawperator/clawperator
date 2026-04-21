# Device Interactivity Foundation Work Breakdown

Parent plan: `tasks/device-interactivity-foundation/plan.md`

## Executive Summary

2 PRs, 4 phases. PR-1 establishes truthful Android interactive-state reporting
and exposes it through an internal diagnostic surface. PR-2 adds the internal
host-side wake helper and validates the foundation on a real device. This pack
must land before `tasks/api/doctor-enhancements/` moves into implementation.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Do not fold doctor policy changes into this pack.
- Do not add a public `clawperator wake` or `clawperator unlock` command or API.
- Do not try to dismiss secure Android authentication.
- Keep `screen off` and `device locked` as separate states everywhere touched by
  this pack.
- Prefer host-side wake primitives over Operator-only wake behavior.
- Use `KEYCODE_POWER` only if there is a very strong, documented reason. It is
  not the default recovery primitive.
- One commit per logical step. Do not batch Android truth-model fixes, internal
  diagnostic payload work, host wake logic, and docs into one commit.
- Before calling the wake helper "done", validate it on a real device. This
  pack is specifically about runtime behavior that can vary across OEMs.

## Required Reading

Read these files in this order before coding.

| File | Why it matters |
| --- | --- |
| `tasks/device-interactivity-foundation/plan.md` | Stable scope and non-goals |
| `docs/internal/android/device-locked-reference.md` | Captured platform distinctions and validated host wake findings |
| `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt` | Current evented state bug and direct-query model |
| `apps/android/shared/core/common/src/main/kotlin/action/keyguard/KeyguardManagerSystem.kt` | Lock truth wrapper |
| `apps/android/shared/core/common/src/main/kotlin/action/power/PowerManagerSystem.kt` | Interactive-state wrapper |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | Internal `doctor_ping` payload source |
| `apps/node/src/domain/doctor/checks/readinessChecks.ts` | Current internal handshake plumbing |
| `apps/node/src/adapters/android-bridge/broadcastAgentCommand.ts` | Node-to-Operator dispatch boundary |
| `apps/node/src/contracts/errors.ts` | Stable error-code surface |
| `tasks/api/doctor-enhancements/findings.md` | Downstream consumer expectations that should not be implemented yet |

## PR / Phase Plan

| PR | Branch | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `device-interactivity-foundation-p1` | Android truth model and internal diagnostic state | 1, 2 | thinking, default | none |
| PR-2 | `device-interactivity-foundation-p2` | Internal host wake helper and validation | 3, 4 | thinking, default | PR-1 merged |

## Phase 1: Fix Android Device-State Truth Model

### Agent Tier

thinking

### Goal

Stop the Operator APK from conflating `screen off` with `device locked` and add
focused Android regression coverage around the corrected semantics.

### Files Or Surfaces To Change

- `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt`
- `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceState*.kt`
- adjacent Android unit tests or new focused tests in the same area

### Steps

1. Inspect the `ACTION_SCREEN_OFF`, `ACTION_SCREEN_ON`, and `ACTION_USER_PRESENT`
   branches in `DeviceStateSystem.kt`.
2. Remove the unconditional `isDeviceLocked.value = true` behavior from the
   `ACTION_SCREEN_OFF` path.
3. Preserve immediate `isScreenOn` updates while keeping actual lock truth tied
   to the proper keyguard query path.
4. Add Android-side regression coverage that proves:
   - `screen off` updates `isScreenOn`
   - `screen off` does not fabricate a locked state
   - screen-on and user-present transitions still update evented state as
     intended
5. Keep the resulting implementation literal and easy to inspect. Do not hide
   semantics behind clever state merging.

### Acceptance Criteria

- `DeviceStateSystem` no longer reports `screen off` as `device locked` by
  default.
- Android-side tests prove the corrected event semantics.

### Validation

```bash
./gradlew :app:testDebugUnitTest
```

### Expected Commit

```text
fix(android): separate screen off from device locked state
```

## Phase 2: Internal Interactive-State Diagnostic Surface

### Agent Tier

default

### Goal

Expose the corrected interactive-state evidence through an internal diagnostic
surface that later Node readiness work can consume.

### Files Or Surfaces To Change

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `apps/node/src/domain/doctor/checks/readinessChecks.ts`
- `apps/node/src/test/unit/doctor/readinessChecks.test.ts`
- any small adjacent Node helper if the parsing logic deserves extraction

### Steps

1. Extend the internal-only `doctor_ping` result payload to include structured
   evidence such as:
   - `screen_on`
   - `device_locked`
   - `user_unlocked`
2. Keep `doctor_ping` internal-only. Do not add it to the public execution
   contract.
3. Add a Node-side internal parser or helper that can read the new payload and
   return a reusable internal shape for later consumers.
4. Update Node unit tests so the new internal evidence is parsed and validated
   deterministically.
5. Stop at the foundation layer. Do not add doctor output fields, new doctor
   checks, or public runtime behavior here.

### Acceptance Criteria

- The internal diagnostic payload carries structured interactive-state evidence.
- Node can parse that evidence in a reusable internal shape.
- No new public API surface is introduced.

### Validation

```bash
./gradlew :app:testDebugUnitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): parse internal interactive state diagnostics
```

## Phase 3: Internal Host Wake Helper

### Agent Tier

thinking

### Goal

Add a bounded internal Node helper that wakes a non-interactive device using
host-side `adb` commands and verifies the resulting state.

### Files Or Surfaces To Change

- `apps/node/src/adapters/android-bridge/` or a nearby internal runtime helper
- any small internal helper file chosen for wake sequencing
- `apps/node/src/domain/doctor/checks/readinessChecks.ts` only if needed for
  shared internal plumbing
- `apps/node/src/contracts/errors.ts` only if a stable code is clearly required

### Steps

1. Introduce an internal helper with a name like `attemptWakeDevice()` or
   `ensureDeviceAwake()`. Do not call it `unlock`.
2. Implement the host wake retry order:
   1. `adb shell cmd power wakeup`
   2. `adb shell input keyevent KEYCODE_WAKEUP`
   3. `adb shell input keyevent KEYCODE_HOME`
3. Gate wake attempts so they run only when the device is not interactive.
4. After each attempt, verify postconditions using the structured interactive
   state helper rather than assuming shell-command success means the screen is
   usable.
5. If the device becomes awake but remains `deviceLocked == true`, stop and
   return that state cleanly. Do not escalate into authentication bypass logic.
6. Keep this helper internal. Do not wire it into doctor, `runExecution()`,
   `cmdSkillsRun()`, or serve in this pack.

### Acceptance Criteria

- The helper can make a bounded wake attempt for a sleeping device.
- The helper verifies success with state evidence, not command optimism.
- The helper does not claim to unlock secure devices.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add internal device wake helper
```

## Phase 4: Real-Device Validation And Durable Docs

### Agent Tier

default

### Goal

Prove the intended sleep-then-wake flow on a real device and update the durable
internal reference with any implementation refinements.

### Files Or Surfaces To Change

- `docs/internal/android/device-locked-reference.md`
- Node tests added in the chosen helper area
- optional task-local findings captured during implementation if needed, but do
  not create placeholder files up front

### Steps

1. Run focused live-device validation on at least one physical Android device.
2. At minimum, validate:
   - baseline interactive state
   - forced sleep
   - wake via the internal retry order
   - post-wake verification
   - behavior when the device is already awake
3. Record any OEM-specific caveats discovered during implementation and migrate
   the durable ones into `docs/internal/android/device-locked-reference.md`.
4. Add or refine Node regression coverage based on the exact helper behavior
   that shipped.
5. Do not broaden into doctor or skill-wrapper policy during closeout.

### Acceptance Criteria

- Real-device validation proves the helper works on at least one physical
  device.
- Durable internal docs reflect the shipped helper behavior and caveats.
- The pack ends with a clean handoff point for `tasks/api/doctor-enhancements/`.

### Validation

```bash
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
adb shell cmd power sleep
adb shell cmd power wakeup
```

Also run the project-required validation loop appropriate to the touched
surfaces before final closeout.

### Expected Commits

```text
docs(internal): capture device wake implementation notes
```

## Final Check Before Review

Before asking for review, verify all of the following:

- the task did not add a public wake or unlock API
- Android truth-model semantics are correct even on devices with no secure lock
  screen
- the helper name and docs use "wake" or "ensure awake", not "unlock"
- no secure-keyguard bypass behavior was introduced
- doctor changes remain deferred to `tasks/api/doctor-enhancements/`
