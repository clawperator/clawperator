# Device Interactivity Foundation Work Breakdown

Parent plan: `tasks/android/device-interactivity-foundation/plan.md`

## Executive Summary

2 PRs, 4 phases. PR-1 establishes truthful Android interactive-state reporting
and exposes it through an internal diagnostic surface. PR-2 adds the internal
host-side wake helper and validates the foundation on a real device. This pack
must land before `tasks/api/doctor-enhancements/` moves into implementation.

## Status

| Item | Value |
| --- | --- |
| State | completed |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | 1, 2, 3, 4 |
| Remaining | none |
| Current / Next | Complete; hand off to `tasks/api/doctor-enhancements/` |
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
| `tasks/android/device-interactivity-foundation/plan.md` | Stable scope and non-goals |
| `docs/internal/android/device-locked-reference.md` | Captured platform distinctions and validated host wake findings |
| `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceState.kt` | Current contract comments still encode the wrong `screen off => locked` story |
| `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt` | Current evented state bug and direct-query model |
| `apps/android/shared/core/common/src/main/kotlin/action/keyguard/KeyguardManagerSystem.kt` | Lock truth wrapper |
| `apps/android/shared/core/common/src/main/kotlin/action/power/PowerManagerSystem.kt` | Interactive-state wrapper |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | Internal `doctor_ping` payload source |
| `apps/android/shared/app/di/src/main/kotlin/clawperator/di/module/AppModule.kt` | `UiActionEngineDefault` wiring if `doctor_ping` needs `DeviceState` injection |
| `apps/node/src/domain/doctor/checks/readinessChecks.ts` | Current internal handshake plumbing |
| `apps/node/src/adapters/android-bridge/broadcastAgentCommand.ts` | Node-to-Operator dispatch boundary |
| `apps/node/src/contracts/result.ts` | Step-result payload is stringly typed, so boolean parsing must be explicit |
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

- `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceState.kt`
- `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt`
- new or adjacent focused Android unit tests covering `DeviceStateSystem`
  broadcast behavior

### Steps

1. Inspect `DeviceState.kt` and remove the current KDoc language that claims
   `isDeviceLocked` should read `true` whenever the screen turns off.
2. Inspect the `ACTION_SCREEN_OFF`, `ACTION_SCREEN_ON`, and `ACTION_USER_PRESENT`
   branches in `DeviceStateSystem.kt`.
3. Remove the unconditional `isDeviceLocked.value = true` behavior from the
   `ACTION_SCREEN_OFF` path.
4. Preserve immediate `isScreenOn` updates while keeping actual lock truth tied
   to the proper keyguard query path.
5. Add Android-side regression coverage that proves:
   - `screen off` updates `isScreenOn`
   - `screen off` does not fabricate a locked state
   - `screen on` refreshes evented lock state from `queryDeviceLocked`
   - `user present` clears the evented locked state
6. Keep the resulting implementation literal and easy to inspect. Do not hide
   semantics behind clever state merging.

### Acceptance Criteria

- `DeviceStateSystem` no longer reports `screen off` as `device locked` by
  default.
- `DeviceState.kt` no longer documents the old conflation as intentional.
- Android-side tests prove the corrected event semantics.

### Validation

```bash
./gradlew app:testDebugUnitTest
```

### Expected Commit

```text
fix(android): separate screen off from device locked state
```

## Phase 2: Internal Interactive-State Diagnostic Surface

### Agent Tier

default

### Goal

Expose the corrected interactive-state evidence through the existing internal
`doctor_ping` path so later Node readiness work can consume it without changing
doctor policy or the public action contract.

### Files Or Surfaces To Change

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `apps/android/shared/app/di/src/main/kotlin/clawperator/di/module/AppModule.kt`
- `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt`
- `apps/node/src/domain/doctor/checks/readinessChecks.ts`
- `apps/node/src/test/unit/doctor/readinessChecks.test.ts`
- one small adjacent Node helper only if extracting the probe/parser makes the
  boundary clearer

### Steps

1. Treat the Android truth-model fix from Phase 1 as an input, not something to
   re-litigate here. For this phase, do not re-open doctor policy, execution
   policy, or public contracts.
2. Extend the existing internal-only `doctor_ping` result payload to include
   structured evidence such as:
   - `screen_on`
   - `device_locked`
   - `user_unlocked`
3. Source those fields from direct point-in-time `DeviceState` queries:
   - `queryScreenOn()`
   - `queryDeviceLocked`
   - `isUserUnlocked`
   Do not source `doctor_ping` from `isScreenOn` / `isDeviceLocked` flows.
4. If `UiActionEngineDefault` needs `DeviceState`, wire that through Koin and
   add Android unit coverage for the emitted `doctor_ping` payload.
5. Add a Node-side internal parser or helper that reads the new `doctor_ping`
   step payload and returns a reusable internal shape for later consumers.
6. Parse the booleans strictly from step-result string data:
   - accept only explicit `"true"` and `"false"`
   - treat missing keys or malformed values as an internal probe failure
   - do not silently default missing fields to `false`
7. Keep `runHandshake()` and `DoctorService` behavior stable in this phase. The
   helper may harvest probe data internally, but this pack must not add doctor
   output fields, new doctor checks, or `criticalOk` changes.
8. Stop at the foundation layer. Do not add doctor output fields, new doctor
   checks, or public runtime behavior here.

### Acceptance Criteria

- The existing internal `doctor_ping` payload carries structured
  evidence such as:
  - `screen_on`
  - `device_locked`
  - `user_unlocked`
- The Android payload is sourced from direct `DeviceState` queries, not event
  flows.
- Node can parse that evidence into a reusable internal shape and fails closed
  on missing or malformed booleans.
- No new public API surface or doctor output surface is introduced.

### Validation

```bash
./gradlew app:testDebugUnitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commits

```text
feat(android): expose internal interactive diagnostics
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
  shared internal plumbing or probe reuse
- `apps/node/src/contracts/errors.ts` only if a stable code is clearly required
- Do not change `apps/node/src/domain/doctor/DoctorService.ts`,
  `apps/node/src/domain/doctor/criticalChecks.ts`,
  `apps/node/src/domain/executions/runExecution.ts`,
  `apps/node/src/cli/commands/skills.ts`, or
  `apps/node/src/cli/commands/serve.ts` in this phase

### Steps

1. Introduce an internal helper with a name like `attemptWakeDevice()` or
   `ensureDeviceAwake()`. Do not call it `unlock`.
2. Implement the host wake retry order:
   1. `adb shell cmd power wakeup`
   2. `adb shell input keyevent KEYCODE_WAKEUP`
   3. `adb shell input keyevent KEYCODE_HOME` only as an OEM fallback after the
      first two attempts still verify `interactive=false`
3. Start each wake pass by probing the internal interactive state. If the
   device is already interactive, return a no-op result and skip adb commands.
4. After each attempt, verify postconditions using the structured interactive
   state helper rather than assuming shell-command success means the screen is
   usable.
5. If the device becomes awake but remains `deviceLocked == true`, stop and
   return that state cleanly. Do not escalate into authentication bypass logic.
6. Treat malformed or unavailable probe data as "do not continue wake blindly".
   Return a bounded internal failure/result instead of inventing state.
7. Add focused Node tests that prove:
   - already-interactive devices skip adb wake commands
   - the retry order is `wakeup -> KEYCODE_WAKEUP -> HOME`
   - the helper stops as soon as the postcondition becomes interactive
   - the helper can report `awake but locked`
   - malformed probe results fail closed
8. Keep this helper internal. Do not wire it into doctor, `runExecution()`,
   `cmdSkillsRun()`, serve, or MCP in this pack.

### Acceptance Criteria

- The helper can make a bounded wake attempt for a sleeping device.
- The helper verifies success with state evidence, not command optimism.
- The helper does not claim to unlock secure devices.
- The helper remains unused by public entrypoints in this pack.

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
   Use explicit device targeting and the debug operator package:
   - identify the serial with `adb devices` or `clawperator devices`
   - prefer the physical device when both physical and emulator targets exist
   - use branch-local Node artifacts, not a globally installed `clawperator`
   - use `--operator-package com.clawperator.operator.dev` unless deliberately
     validating release APK behavior
2. At minimum, validate:
   - baseline interactive state
   - forced sleep
   - wake via the internal retry order
   - post-wake verification
   - behavior when the device is already awake
3. Capture the live proof with exact host-side evidence, not prose alone. At
   minimum record the before/after output of:
   - `adb shell dumpsys power | rg "mWakefulness="`
   - `adb shell dumpsys window policy | rg "showing=|screenState=|interactiveState="`
4. If a secure-lock scenario is available on the validation device, also prove
   that the helper can stop at `awake but locked` without claiming unlock. If
   that state is not available to test, say so explicitly in task-local notes
   or the doc update rather than implying it was validated.
5. Record any OEM-specific caveats discovered during implementation and migrate
   the durable ones into `docs/internal/android/device-locked-reference.md`.
6. Add or refine Node regression coverage based on the exact helper behavior
   that shipped.
7. Do not broaden into doctor or skill-wrapper policy during closeout.

### Acceptance Criteria

- Real-device validation proves the helper works on at least one physical
  device.
- The validation notes make clear which states were actually reproduced versus
  merely reasoned about.
- Durable internal docs reflect the shipped helper behavior and caveats.
- The pack ends with a clean handoff point for `tasks/api/doctor-enhancements/`.

### Validation

```bash
./gradlew app:assembleDebug
./gradlew app:testDebugUnitTest
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
