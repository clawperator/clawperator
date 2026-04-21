# Device Interactivity Foundation

## Executive Summary

This task pack establishes the foundation that the later doctor-readiness work
should depend on instead of re-deriving. It is a cross-surface pack because the
truth model lives in the Android Operator APK, while the most reliable wake
primitive lives on the host side through `adb`.

This pack should ship before `tasks/api/doctor-enhancements/` proceeds to
implementation. Total scope: 2 PRs, 4 phases.

- PR-1 fixes the Android state-model bug and exposes structured interactive
  state through an internal diagnostic surface.
- PR-2 adds an internal Node host-side wake helper and validates the resulting
  foundation on a real device.

This pack does not add a new public `clawperator` wake or unlock API.

## Status

| Item | Value |
| --- | --- |
| State | completed |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | 1, 2, 3, 4 |
| Remaining | none |
| Current / Next | Complete; implementation landed on `android/device-interactivity-foundation`, with post-review fixes on `codex/device-interactivity-foundation-review-fixes`; next dependent pack is `tasks/api/doctor-enhancements/` |
| Blockers | none |

## Goal

After this task ships, Clawperator should have one truthful internal notion of
Android device interactivity that keeps these states separate:

- screen off / not interactive
- awake but actually locked
- awake and user-unlocked

It should also have an internal Node-side wake helper that can attempt to wake
the device when the screen is off, without pretending to unlock a secure
keyguard.

## Why Now

Recent skill failures exposed two separate issues:

1. the current Android state model can misreport `screen off` as `device locked`
2. the practical wake primitive that worked on the tested Samsung device lives
   on the host side, not purely inside the Operator APK

If doctor/readiness work starts before this foundation exists, it will either:

- depend on inaccurate device-state semantics
- or mix truth-model cleanup with recovery-policy decisions in one pack

This pack keeps those concerns separate.

## In Scope

- Fix the Android Operator device-state bug that currently treats every
  `ACTION_SCREEN_OFF` event as `isDeviceLocked = true`
- Update the `DeviceState` contract comments so they stop documenting the
  fabricated `screen off => locked` behavior as acceptable
- Preserve separate structured signals for:
  - `screenOn` / `interactive`
  - `deviceLocked`
  - `userUnlocked`
- Extend the internal-only diagnostic path so Node can retrieve those signals
  without exposing a new public agent-facing action
- Add a Node internal helper that can:
  - inspect the interactive state
  - attempt host-side wake when the device is asleep
  - verify whether wake succeeded
- Define the host wake retry order and failure semantics
- Add focused Android and Node regression coverage
- Add or update internal reference docs that describe the truth model and wake
  behavior

## Out of Scope

- New public `clawperator wake`, `clawperator unlock`, or agent-facing unlock API
- `DoctorService`, doctor check IDs, doctor output JSON shape, or `criticalOk`
  changes
- Skill-wrapper gating changes in `cmdSkillsRun()` or `/skills/:skillId/run`
- `runExecution()`, MCP, or serve behavior changes that consume the new
  foundation
- Attempting to bypass secure Android authentication
- UI-based PIN, pattern, or biometric handling
- General "self-healing runtime" policy beyond a narrow wake helper
- Public docs under `docs/api/` or generated docs output under `sites/docs/`

## Existing Artifact Scope

- `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt`:
  in scope for truth-model correction; preserve the separation between direct
  query methods and evented flows
- `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceState.kt`:
  in scope because its current KDoc explicitly blesses the bad
  `screen off => locked` behavior and would otherwise mislead later agents
- `apps/android/shared/core/common/src/main/kotlin/action/keyguard/KeyguardManagerSystem.kt`:
  in scope only if the truth-model fix needs additive clarifying helpers; do not
  rewrite otherwise-correct platform wrappers
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`:
  in scope for additive internal diagnostic payload changes; use direct
  point-in-time `DeviceState` queries for `doctor_ping` and do not turn it into
  a public action
- `apps/android/shared/app/di/src/main/kotlin/clawperator/di/module/AppModule.kt`:
  in scope if `UiActionEngineDefault` needs `DeviceState` injected for
  `doctor_ping`
- `apps/node/src/domain/doctor/checks/readinessChecks.ts`:
  in scope for additive internal probe plumbing only; do not add the later
  doctor policy change in this pack
- `apps/node/src/adapters/android-bridge/` and adjacent Node device/runtime
  helpers: in scope for an internal host wake helper
- `apps/node/src/contracts/errors.ts`: in scope only if a new stable internal or
  surfaced code is genuinely required by this pack
- `docs/internal/android/device-locked-reference.md`: in scope for durable
  follow-up from implementation discoveries

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt` | Stop conflating `screen off` with `device locked` | PR-1 / Phase 1 |
| `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceState.kt` | Remove stale contract language that blesses the conflation | PR-1 / Phase 1 |
| Focused Android tests adjacent to `action/devicestate/` | Regression coverage for evented device-state semantics | PR-1 / Phase 1 |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | Extend existing internal `doctor_ping` with interactive-state evidence sourced from direct queries | PR-1 / Phase 2 |
| `apps/android/shared/app/di/src/main/kotlin/clawperator/di/module/AppModule.kt` and `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt` | Wire and prove the new Android diagnostic payload | PR-1 / Phase 2 |
| `apps/node/src/domain/doctor/checks/readinessChecks.ts` plus a small adjacent helper if needed | Parse internal interactive-state evidence into a reusable internal shape without changing doctor output | PR-1 / Phase 2 |
| `apps/node/src/adapters/android-bridge/` or adjacent runtime helper area | Internal host wake helper and retry order | PR-2 / Phase 3 |
| `apps/node/src/test/unit/doctor/readinessChecks.test.ts` plus focused adjacent wake-helper tests | Node regression coverage for internal probe and wake helper | PR-2 / Phase 4 |
| `docs/internal/android/device-locked-reference.md` | Durable reference updates from implementation learnings | PR-2 / Phase 4 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current Android screen/lock state model | `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt` |
| Current Android device-state contract comments | `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceState.kt` |
| Current keyguard wrappers | `apps/android/shared/core/common/src/main/kotlin/action/keyguard/KeyguardManagerSystem.kt` |
| Current internal doctor action payload | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` |
| Current Node internal handshake path | `apps/node/src/domain/doctor/checks/readinessChecks.ts` |
| Current broadcast/runtime dispatch boundary | `apps/node/src/adapters/android-bridge/broadcastAgentCommand.ts` |
| Current result-envelope step data shape | `apps/node/src/contracts/result.ts`, `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/ClawperatorResultEnvelope.kt` |
| Current error-code surface | `apps/node/src/contracts/errors.ts` |
| Durable research reference | `docs/internal/android/device-locked-reference.md` |
| Later consumer pack that depends on this work | `tasks/api/doctor-enhancements/findings.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- `screen off` is not equivalent to `device locked`
- the Operator APK is the source of truth for reporting Android interactive and
  lock state
- the internal diagnostic probe should extend the existing `doctor_ping` path,
  not create a second internal action unless code inspection proves that
  impossible
- point-in-time diagnostic truth must come from direct Android queries
  (`queryScreenOn()`, `queryDeviceLocked`, `isUserUnlocked`), not from event
  flow snapshots that can lag registration or transition timing
- Node must parse the returned `doctor_ping` booleans strictly from string step
  data; missing or non-`true`/`false` values are an internal probe failure, not
  a reason to coerce to `false`
- the host side is the preferred place for wake attempts
- this pack does not add a new public wake or unlock API
- this pack does not attempt secure-keyguard bypass
- wake attempts should be named `wake` or `ensureAwake`, not `unlock`
- the host wake helper must stay internal and must not change `DoctorService`,
  `criticalChecks`, `runExecution()`, skill wrappers, serve, or public error
  handling in this pack
- host wake retry order starts with:
  1. `adb shell cmd power wakeup`
  2. `adb shell input keyevent KEYCODE_WAKEUP`
  3. `adb shell input keyevent KEYCODE_HOME` as an OEM fallback only after the
     first two postconditions still show `interactive=false`

**Judgment required:**

- whether the Node internal probe should stay inside `readinessChecks.ts` or
  move to a dedicated adjacent helper file, as long as `runHandshake()`
  behavior and doctor outputs remain unchanged
- whether this pack needs a new stable error code at all, given that later
  consumer packs may choose the surfaced contract
- the minimum settle/retry timing needed between wake attempts and verification

## Decision Rules

| Question | Rule |
| --- | --- |
| Should this pack add a public `unlock` API? | No. Keep wake internal for now. |
| Should this pack attempt secure-keyguard dismissal? | No. Waking the screen and bypassing authentication are different concerns. |
| Where does lock-state truth come from? | Android Operator wrappers such as `KeyguardManager.isDeviceLocked()`. |
| What should `doctor_ping` use for point-in-time interactive state? | `DeviceState.queryScreenOn()`, `DeviceState.queryDeviceLocked`, and `DeviceState.isUserUnlocked`. Do not infer from `isScreenOn` / `isDeviceLocked` flows. |
| How should Node parse the new `doctor_ping` state fields? | Accept only explicit `"true"` / `"false"` strings for known keys and treat missing or malformed data as an internal probe failure. |
| Where does wake happen? | Host side through `adb`, wrapped by an internal Node helper. |
| When may the wake helper run? | Only when the device is not interactive or the screen is off. |
| What if the screen wakes but `deviceLocked == true` afterward? | Report that the device is awake but locked. Do not attempt unlock behavior in this pack. |
| Should `KEYCODE_POWER` be used as the primary recovery primitive? | No. It is a toggle and therefore not deterministic enough as the primary path. |
| Should doctor behavior change in this pack? | No. This pack provides the prerequisite foundation only. |

## Failure Modes To Prevent

- `ACTION_SCREEN_OFF` still forces `isDeviceLocked = true`
- `DeviceState.kt` still documents the incorrect conflation and re-teaches the
  next agent the wrong contract
- Android evented state and direct query state drift apart in contradictory ways
- `doctor_ping` reports event-flow state instead of direct point-in-time query
  results and therefore races receiver registration or transition timing
- Node defaults missing or malformed `doctor_ping` booleans to `false` and
  silently fabricates state
- Node adds a wake helper that silently changes doctor or execution policy in
  the same pack
- the new helper pretends to unlock secure devices rather than only wake them
- wake verification relies only on broadcast success instead of checking
  postconditions
- the task pack introduces a public API prematurely before consumer needs are
  proven
- physical-device wake behavior is assumed from unit tests alone

## Output Contract

After PR-1:

- the Android Operator no longer reports every `screen off` transition as
  `device locked`
- the internal diagnostic path can return structured interactive-state evidence
  such as `screen_on`, `device_locked`, and `user_unlocked`, sourced from
  direct `DeviceState` queries
- Node can parse that evidence into a reusable internal shape without surfacing
  a new public API or changing doctor output

After PR-2:

- Node has an internal host-side wake helper with a deterministic retry order
- the helper verifies wake success using structured postconditions rather than
  assuming command success means interaction readiness
- real-device validation proves the intended sleep-then-wake path on at least
  one physical device

## Closeout

Implemented on branch `android/device-interactivity-foundation` with focused
commits for:

- Android truth-model correction and regression coverage
- internal Android `doctor_ping` diagnostics
- Node internal interactivity probe and wake helper
- durable internal documentation updates after live-device validation

Post-review follow-up fixes were landed on
`codex/device-interactivity-foundation-review-fixes` for:

- failing closed on unsuccessful `doctor_ping` steps
- preserving `awake_but_locked` on the initial interactive probe
- keeping `logcat -c` out of the reusable probe path
- proving the Android `doctor_ping` payload uses direct queries rather than
  evented flows
- separating wake transport failure from `still_asleep`

Validated during implementation with:

- `./gradlew app:testDebugUnitTest`
- `./gradlew app:assembleDebug`
- `npm --prefix apps/node run build`
- `npm --prefix apps/node run test`
- physical Samsung-device proof using the debug operator package and the
  branch-local Node build

Validated during post-review fixes with:

- `./gradlew app:testDebugUnitTest`
- `npm --prefix apps/node run build`
- `npm --prefix apps/node run test`
- internal docs capture any updated caveats discovered during implementation

## Idempotency

- repeated device-state probes return the current truth without mutating device
  state
- repeated wake checks do nothing when the device is already interactive
- repeated wake attempts remain safe and bounded when the device is asleep
- running this foundation does not itself change doctor behavior or skill policy

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Android screen-off vs device-locked distinction | `docs/internal/android/device-locked-reference.md` |
| Internal diagnostic payload shape for interactive state | `UiActionEngine.kt` plus nearby Node helper code and tests |
| Internal host wake retry order and caveats | `docs/internal/android/device-locked-reference.md` and the implementing helper/tests |
| Later public readiness behavior | follow-on implementation in `tasks/api/doctor-enhancements/` after this pack lands |
