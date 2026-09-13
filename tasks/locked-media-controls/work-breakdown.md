# N3 execution and progress

Contract and scope: [plan.md](plan.md). Status: [TODO], planning only.
One N3 PR contains all steps below; there are no internal merge gates.

## Sources and ownership

| Source | Reason to inspect |
| --- | --- |
| apps/node/src/contracts/notifications.ts | Current three-read classification and strict service parameters |
| apps/node/src/domain/executions/runExecution.ts | Whole-execution validation, readiness branch, first-unlock probe and canonical dispatch |
| apps/node/src/domain/doctor/checks/deviceInteractivity.ts | Interactive cache, doctor_ping and wake fallback that eligible media executions must avoid |
| apps/node/src/domain/doctor/backgroundObservation.ts | Preserve observation-only doctor behavior |
| apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt | Android execution classification |
| apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/runtime/OperatorCommandReceiver.kt | Classification before accessibility lookup and shade handling |
| apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt | Strict ingress before classification |
| apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt | Media dispatch, waits and failure/cancellation evidence |
| apps/android/shared/core/toolkit/src/main/kotlin/action/media/NotificationMediaService.kt | Listener access, pinned controllers and original report preservation |
| apps/node/src/domain/notifications/service.ts and apps/node/src/cli/registry.ts | Typed decoding and public command/help behavior |
| validation/notifications-media/ | Independent MediaPlayer fixture, mutation transports, locked lifecycle and direct-ingress harnesses |

## Delivery

1. [TODO] Update the Node and Android readiness decision consistently, auditing
   all classifier call sites. Retain strict validation before readiness, first
   unlock checks, and existing interactive behavior outside the eligible set.
2. [TODO] Replace N2 tests that intentionally require interactive media readiness
   with the new contract. Keep notification mutations and UI/mixed rejection
   assertions. Extend the independent fixture and its existing manual workflow.
3. [TODO] Prove locked physical YouTube pause/resume against one session and run
   the emulator matrix below. Fix in-scope failures; do not weaken assertions or
   treat unlocked controls as passing locked acceptance.
4. [TODO] Update public docs/help and permanent evidence with actual results,
   source revision and matching CLI/APK versions/hashes. Update the release plan
   truthfully, use task-cleanup on this pack when complete, and commit validated
   logical units. Stop before release work or unauthorized remote operations.

## Acceptance evidence

### Automatic offline checks

- Each eligible action and combinations of reads/controls take the service path
  without interactive readiness, wake/input/shade/accessibility calls, including
  cold, warm and expired interactive caches. Invalid/empty/unknown executions
  must not gain a readiness bypass.
- Ineligible actions alone and before/after an eligible prefix retain existing
  whole-execution readiness. On failure, no prefix is dispatched. Test both Node
  and direct Android ingress, including notification mutations and UI actions.
- Preserve first-unlock, denied/disconnected listener and background doctor
  semantics. Verify canonical payloads/errors through typed helpers, CLI, HTTP
  and MCP; retain CLI exit codes and supported global flag placement.
- Retain N2 session/position/dispatch regressions: ambiguity, unsupported controls,
  ignored commands, stale callbacks, inactivity, replacement during waits,
  cancellation and receipt loss without replay.

### Live emulator matrix

Recheck connectivity and API levels before selecting devices. Previously
available targets are API 36 (primary) and API 26 (legacy provisioning), with API
35 available if a distinct platform case warrants it. Use explicit selectors
and matching local builds with --device <device_serial> and
--operator-package com.clawperator.operator.dev. Do not commit serials or host
paths. Run device tests sequentially when fixture state/shared tooling can
interfere. Keep offline checks automatic and live emulator CI workflow_dispatch
only.

On API 36 and API 26 prove pause, seek and play against the same fixture session
under secure locked/on and secure locked/off states, with accessibility genuinely
unbound and with cold/expired readiness caches. Include service-only mixed
read/control lists and the ineligible mixed-list rejection cases. Compare
independent MediaPlayer position, actualPlaying and control counters with dispatch
and reported confirmation. Require exactly one dispatch per requested control;
ignored controls must not masquerade as observed effects.

Verify power-transition counters and independent keyguard state before, during
and after eligible operations. Endpoint screenOn/deviceLocked values alone do not
exclude transient wake/unlock. The off-state test must remain off; neither a
manually woken screen nor a stale readiness cache substitutes for it. Preserve
N1 read/doctor, open-shade and listener recovery coverage, and test pinned-session
expiry/replacement during a locked confirmation wait. Preserve original reports
across inactivity, without treating estimates as actual playback progress.

Use only controlled emulators without existing credentials for temporary PIN
setup; restore temporary credentials and accessibility settings in cleanup,
including failure paths. Keep the existing first-unlock regression where a
runnable encrypted-storage path exists. API 26/35/36 and offline API 21 tests do
not satisfy V1's live API 21 requirement.

### Physical YouTube Premium proof

Use the connected physical device after rechecking identity/API and installed
Operator compatibility. The user has Premium; do not alter account settings or
install the fixture as a substitute for this real-app acceptance.

Open https://www.youtube.com/watch?v=wuFfiTEr2yc with Clawperator's appropriate
open_uri action and verify the YouTube app is foreground, not a browser. Start
playback while unlocked, discover the YouTube notification/media session, then
ask the user to lock the device at that point. Ask for user unlock only for setup
or cleanup when needed; never unlock to make a failing locked test pass. Do not
set/change a physical-device credential or disable its accessibility merely to
reproduce the emulator matrix without separate user authorization.

Reuse the discovered mediaSessionId for pause and resume while locked, including
screen off. Capture dispatch receipts, reported states and original report ages
separately. Obtain independent audible stop/resume confirmation from the user,
and capture available Android audio-pipeline evidence before/after; audio-track
state is supporting evidence, not proof of heard sound. Poll/observe independent
keyguard and power evidence throughout, documenting sampling limits. If the
video ends or the session is replaced, explicitly re-establish the test rather
than silently switching session identity. Record unsupported-player or OS limits
truthfully. Seek's independent effect is mandatory in the fixture matrix; real
YouTube seeking is supplementary to the required physical pause/resume proof.

## Validation and documentation

From the N3 worktree, run the prescribed checks after completed changes:

```sh
npm --prefix apps/node run build && npm --prefix apps/node run test
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
./gradlew unitTest
./gradlew :notification-media-fixture:assembleDebug
./scripts/docs_build.sh
```

Run the relevant live scripts in validation/notifications-media/ after extending
them for N3. A process exit or a simulated service test cannot replace actual
locked player-effect evidence. Missing device/account access leaves the relevant
acceptance unproven; preserve an actionable blocker rather than declaring done.

Use .agents/skills/docs-author/SKILL.md and .agents/skills/docs-build/SKILL.md for authored docs
and regeneration. Update docs/api/media.md, notifications.md, actions.md and any
affected doctor/setup guidance, plus CLI help. Durable decisions and sanitized
physical/emulator findings belong in docs/internal/design/notifications-and-media.md;
fixture reproduction belongs in validation/notifications-media/README.md. Keep
current behavior distinct from pending requirements. Preserve the V1 live API
21 and release-package gates when updating tasks/releases/v0.11/plan.md.
