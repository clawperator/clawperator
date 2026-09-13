# Notifications and media work breakdown

Contract: [plan.md](plan.md). Release: [v0.11](../releases/v0.11/plan.md).

## PR sequence

| PR | Outcome | Dependency | Status |
| --- | --- | --- | --- |
| N1 | Notification reads and media discovery/status/pause/play, end to end | Current main; no v0.10 publication prerequisite | [TODO] |
| N2 | Notification dismissal/buttons and media seeking; integrated acceptance | N1 contracts and service boundary | [TODO] |

Prefer these two coherent feature PRs, each with tests and docs. Do not split
Android, Node, tests and documentation into separate PRs. N2 may be developed on
N1's committed branch while review runs; merge N1 first and reconcile N2 with the
merged base. No merge gate is needed between internal stages of one PR.

The current task is authoring this pack only. A subsequent instruction to implement
N1 or N2 authorizes that complete row through validation, docs, status and local
commits. An instruction to implement this whole pack authorizes both feature rows;
finish sequentially without routine approval pauses. It does not authorize remote
publication. Preserve the selected scope when another row becomes unblocked.

## N1 - Reliable reads and core media controls

1. Define shared payload/error types, action parameters and explicit capability
   state. Distinguish permission denied, listener disconnected, query failure,
   session missing/expired, ambiguous target and unsupported action. Handle older
   APKs truthfully. Existing UI commands must not gain a new notification-access
   prerequisite. Implement the plan's observation-only readiness classification in
   host preflight and Android ingress/execution. Bypass UI readiness and shade
   dismissal only for all-read lists; preserve existing readiness for mixed lists
   and mutations. Add tests before claiming background observation support.
2. Add awaitable listener snapshots and lifecycle handling. Include ongoing/group
   notifications, bounded text/results, revision-scoped action descriptors and
   generic progress. Maintain any cache actually reused; do not expose the
   presentation manager's incomplete state. No read-induced cancellation.
3. Add media-session discovery, lifetime-scoped handles, metadata and position
   calculation, and explicit play/pause requests with separate dispatch and
   observation evidence. Preserve original update/query clock timestamps and stale
   report age. Pin the resolved controller through each action and wait; handle
   permission revocation, destroyed controllers and same-package replacement.
4. Wire Android parsing/execution, strict Node validation, typed helpers, CLI and
   HTTP `/execute` and generic MCP `execute` parity. Add bounded optional
   postcondition waits without mutation replay. Preserve envelope/result-reader behavior and remove incidental content
   logs on paths carrying these new payloads.
5. Add focused automated coverage and a generic controllable Android fixture under
   `validation/notifications-media/`. Run offline fixture/contract tests automatically
   in normal CI; provide an explicit/manual live emulator workflow, consistent
   with the existing release approach. Do not schedule live emulator runs on every
   PR or push. The fixture must actually publish notifications and media state;
   no private accounts or external app dependencies for deterministic regression.
6. Complete live N1 proof and docs in this PR. Record sanitized evidence, exact
   source/build versions, platform versions, outcomes and known limitations in
   `docs/internal/design/notifications-and-media.md`.

N1 acceptance cases:

- Screen-off and keyguard-locked observation-only lists return notification/media
  evidence without waking/unlocking, closing the shade or accessing a foreground
  window. Verify device state before/after, including an open-shade case. Exercise
  unavailable accessibility with a connected notification listener. Preserve
  permission/disconnection errors rather than treating access limits as empty data.
- Mixed UI/read lists in both orders retain whole-execution readiness, never
  dispatch a partial read prefix when readiness fails, and preserve action order
  when ready. UI-only behavior is unchanged; unsupported actions cannot obtain the
  exemption. Test the host and Android ingress paths, including generic MCP use.
- Existing notifications are visible immediately after listener connection;
  posting, update, removal, disconnect/reconnect and process restart give fresh
  results. Empty list is distinguishable from unavailable access. Ongoing/group
  entries survive; app filters and truncation are truthful.
- Two sessions, including two from one package, demonstrate ambiguity errors and
  exact selection. No sessions, expired IDs and unavailable metadata are explicit.
  Destroy the selected session between app resolution, dispatch and wait, then
  create another for the same package; never control or confirm against replacement.
- Fixture positions advance at 1x and 2x, stay fixed while paused/buffering, and
  remain unknown when position/update time is invalid. Exercise duration bounds
  and wall-clock changes without corrupting monotonic estimates.
- Stop actual fixture playback and stop state publication while its last report
  remains PLAYING. Repeated queries preserve the original update timestamp and
  unchanged reported position with increasing report age, even if estimates advance.
  Independent fixture progress evidence must show the stall; no API response or
  postcondition wait may label extrapolation as proven playback. Also test unchanged
  reports while actual playback continues: missing updates alone do not prove a stall.
- Pause/play affects only the selected session. Capability rejection, ignored
  command, wait timeout and already-satisfied state yield truthful receipts.
- Raw execution, typed helper, CLI, HTTP and generic MCP execute agree on
  values/errors. Preserve commandId/taskId, nonzero CLI failure exits, JSON errors and MCP structured error
  status/details. Exercise actual MCP tool dispatch, not only the shared helper.
  Cover valid, invalid,
  blank/missing values, conflicting selectors and global/local flag placement
  where supported. Large results and uncertain transport must not replay controls.
- Verify at least one real video player and one real audio player on an explicit
  device. Record actual session support and compare reported/estimated positions
  with visible playback; do not turn lack of support into fabricated success.

N1 is independently useful for downstream screen-off/PiP investigation. Consumers
do not need N2 dismissal/buttons/seeking to resume that work. This pack provides
player-reported observations; downstream visual/window persistence assertions and
application-specific regression policy remain outside its scope.

## N1 mandatory locked/off readiness matrix

Implement the capability-specific doctor contract alongside the read APIs in N1.
Extend existing `test/unit/doctor/{deviceInteractivity,DoctorService,readinessPolicy,readinessChecks}.test.ts`,
`doctorCommand.test.ts`, `runExecution.test.ts`, MCP integration tests and Android
ingress tests rather than testing only a new standalone helper.

| State / scenario | Required evidence |
| --- | --- |
| Screen on, keyguard unlocked, user previously unlocked | All three observation actions and background doctor succeed; baseline values retained |
| Screen off, user previously unlocked, without secure keyguard | Reads/diagnostic succeed; no wake or foreground change |
| Screen on, secure keyguard locked after first unlock | Reads/diagnostic succeed without credential entry or keyguard dismissal |
| Screen off, secure keyguard locked after first unlock | Same success, with screen and keyguard state preserved |
| No accessible foreground window / app UI isReady false | Reads/diagnostic complete without UI-window dependency |
| Accessibility service unavailable, notification listener connected | Reads/background doctor succeed; default interactive diagnostic still reflects unavailable UI prerequisites |
| Notification access revoked / listener disconnected | Specific non-success, never empty-list success, no wake or remediation |
| User not yet unlocked after reboot | Explicit unavailable prerequisite when platform prevents access; no fabricated ordinary-lock success or automatic unlock |
| Screen off during repeated reads, then on and relocked | Each observation is fresh and preserves current state; no warm-cache dependency |
| Selected Operator process restart while locked/off | Recover and query once Android reconnects the listener without opening the app; until then return explicit unavailability, not stale cache |

Run each supported locked/off observation case with an empty interactive cache,
a recently populated cache, and after its current eight-second TTL expires. Use
fake time for automated cache tests; the live series must include queries beyond
the TTL with no intervening UI command. Cover each read action singly and a list
containing all three. Run the public CLI and generic MCP path live for locked/off
cases, and cover typed helper/HTTP parity through integration tests. Negative
cases must include mixed lists in both action orders and existing UI-only calls;
retain their interactive preflight behavior, not a new no-wake promise for UI work.

Instrument automated tests to fail on wakeup/Home keyevents, keyguard/shade
operations, app launch, UI tree acquisition, interactive readiness invocation,
logcat clearing or remediation in the observation/diagnostic path. A zero exit
code alone is insufficient. Verify structured reports and process/MCP failure
semantics for both doctor capabilities, malformed capability values and rejected
background `--full`/`--fix` combinations before side effects.

For live tests, prepare notifications/player and grant access before locking.
Use a controlled emulator for secure-lock setup; do not change a personal device's
credential. Observe power/keyguard state with independent non-waking evidence
before, during and after the series. Endpoint checks alone could miss a transient
wake-and-sleep; retain timestamped state transitions or equivalent continuous
fixture/system evidence. Do not use the existing interactive doctor/readiness
helper as the observer. Record actual screenOn/deviceLocked/userUnlocked values,
matching build/variant, timeout/error outcomes and all attempts. Never interpret
shell success or the absence of a foreground hierarchy as proof the screen stayed
off. Do not wake/open the app to make a failing observation test pass.

This is ordinary screen-off/lock support with reachable adb and a previously
provisioned Operator, not a claim of Direct Boot, disconnected-device or arbitrary
Doze/OEM process-policy support. Record platform restrictions precisely. A bounded
listener-reconnection failure remains an unmet gate for the supported test setup.

## N2 - Notification mutations, seeking and combined proof

1. Implement dismissal with clearability checks and removal observation. Distinguish
   dispatched, observed removed, stale key and not dismissible; OS refusal must not
   become a confirmed deletion.
2. Invoke advertised revision-scoped notification buttons via their PendingIntent.
   Resolve handles inside Android, check unsupported input/authentication needs,
   handle cancellation and update races, and never retry uncertain dispatch.
   No implicit text reply, unlock flow or replacement action selection.
3. Add seeking with finite nonnegative integer millisecond validation, advertised
   seek capability, known-duration bounds and explicit tolerance for optional
   observation waits. Keep dispatch receipt even when confirmation fails.
4. Extend the same fixture, Node/Android tests, CLI/help, typed helpers, MCP
   coverage and docs.
   Prove one complete flow: list notifications/sessions, read position, pause,
   seek, play, invoke a fixture button and dismiss a fixture notification.
5. Record integrated acceptance on matching final builds and refresh the release
   table. Retain genuine unsupported-player/OS limitations in durable docs.

N2 acceptance additionally covers stale action handles after updates/restart,
removed notifications, canceled PendingIntents, non-clearable notifications,
remote-input/authentication actions, unsupported seek, bad positions, unknown
or zero duration, ignored seek, position tolerance and transport uncertainty.
Show mutation side effects in the fixture/player, not just process exit status.

## Validation and prerequisites

For each changed feature PR, run these checks from the repository root using
branch-local tools:

```sh
npm --prefix apps/node run build && npm --prefix apps/node run test
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
./scripts/docs_build.sh
```

Check `adb devices` before choosing a device. Install the matching debug APK,
grant accessibility and notification access via existing setup, and use the
branch-local CLI with `--device <device_serial>` and
`--operator-package com.clawperator.operator.dev`. Prefer a physical device for
real-app compatibility. Use a supported emulator/API image for CI fixture proof;
include API 35 or later for notification restriction coverage and the lowest
supported API image for any new API-level-dependent code. Verify build commands
against the current repository configuration before execution.

Offline tests prove validation, serialization, state calculations and simulated
lifecycle behavior. Only live runs establish listener binding, platform callbacks,
actual PendingIntent effects and player support. Missing device/SDK/app access
leaves the corresponding gate unproven; record it instead of claiming completion.
Keep private notification text, account details and device identifiers out of Git.

No runtime build is needed for this planning-only change. Future implementation
must run the appropriate checks above. Do not rerun passing checks without a
change, failure or unresolved concern that warrants it.

## Completion and cleanup

Update each row with implementation/validation status and commit/PR when known;
local completion is not merge or release. Finish in-scope failures and local
Conventional Commits without bypassing hooks. Keep unfinished rows actionable.
When both feature scopes are complete, use `.agents/skills/task-cleanup/SKILL.md`
to retire this pack after durable decisions/evidence move to docs. Replace release
links to retired files with permanent docs and preserve pending release steps.
