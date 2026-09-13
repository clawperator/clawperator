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
   prerequisite. Verify readiness behavior before adding diagnostic checks.
2. Add awaitable listener snapshots and lifecycle handling. Include ongoing/group
   notifications, bounded text/results, revision-scoped action descriptors and
   generic progress. Maintain any cache actually reused; do not expose the
   presentation manager's incomplete state. No read-induced cancellation.
3. Add media-session discovery, lifetime-scoped handles, metadata and position
   calculation, and explicit play/pause requests with separate dispatch and
   observation evidence. Handle permission revocation and destroyed controllers.
4. Wire Android parsing/execution, strict Node validation, typed helpers, CLI and
   `/execute` parity. Add bounded optional postcondition waits without mutation
   replay. Preserve envelope/result-reader behavior and remove incidental content
   logs on paths carrying these new payloads.
5. Add focused automated coverage and a generic controllable Android fixture under
   `validation/notifications-media/`, wired into CI following repository harness
   conventions. The fixture must actually publish notifications and media state;
   no private accounts or external app dependencies for deterministic regression.
6. Complete live N1 proof and docs in this PR. Record sanitized evidence, exact
   source/build versions, platform versions, outcomes and known limitations in
   `docs/internal/design/notifications-and-media.md`.

N1 acceptance cases:

- Existing notifications are visible immediately after listener connection;
  posting, update, removal, disconnect/reconnect and process restart give fresh
  results. Empty list is distinguishable from unavailable access. Ongoing/group
  entries survive; app filters and truncation are truthful.
- Two sessions, including two from one package, demonstrate ambiguity errors and
  exact selection. No sessions, expired IDs and unavailable metadata are explicit.
- Fixture positions advance at 1x and 2x, stay fixed while paused/buffering, and
  remain unknown when position/update time is invalid. Exercise duration bounds
  and wall-clock changes without corrupting monotonic estimates.
- Pause/play affects only the selected session. Capability rejection, ignored
  command, wait timeout and already-satisfied state yield truthful receipts.
- Raw execution, typed helper, CLI and HTTP agree on values/errors. Preserve
  commandId/taskId, nonzero failure exits and JSON errors. Cover valid, invalid,
  blank/missing values, conflicting selectors and global/local flag placement
  where supported. Large results and uncertain transport must not replay controls.
- Verify at least one real video player and one real audio player on an explicit
  device. Record actual session support and compare reported/estimated positions
  with visible playback; do not turn lack of support into fabricated success.

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
4. Extend the same fixture, Node/Android tests, CLI/help, typed helpers and docs.
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

For each changed feature PR, use branch-local tools and the repository's checks:

```sh
npm --prefix apps/node run build && npm --prefix apps/node run test
cd apps/android
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
cd ../..
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
