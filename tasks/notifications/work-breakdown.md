# Notifications and media work breakdown

Contract: [plan.md](plan.md). Release: [v0.11](../releases/v0.11/plan.md).

## PR sequence

| PR | Outcome | Dependency | Status |
| --- | --- | --- | --- |
| N1 | Notification reads and media discovery/status/pause/play, end to end | Current main; no v0.10 publication prerequisite | [DONE] Implemented and locally validated; compatibility limits below |
| N2 | Notification dismissal/buttons and media seeking; integrated acceptance | N1 contracts and service boundary | [TODO] |

Prefer these two coherent feature PRs, each with tests and docs. Do not split
Android, Node, tests and documentation into separate PRs. N2 may be developed on
N1's committed branch while review runs; merge N1 first and reconcile N2 with the
merged base. No merge gate is needed between internal stages of one PR.

An instruction to implement N2 authorizes that complete row through validation, docs, status and local
commits. An instruction to implement this whole pack authorizes the remaining N2 row;
finish the remaining feature work without routine approval pauses. It does not authorize remote
publication. Preserve the selected scope when another row becomes unblocked.

## N1 [DONE] - local implementation and validation

Delivered on the N1 implementation branch, beginning with 3c7d88f2 and completed
through d76dd172. Public contracts, source-owned invariants, fixture instructions,
review fixes and acceptance evidence are preserved in the permanent references
linked from [plan.md](plan.md). N1 is not yet asserted merged or published.

Live coverage includes API 26/35/36; API 21/28 service branches have offline tests.
Real browser video/audio and the encrypted-storage first-unlock prerequisite were
verified on API 36. API 26 verified the fixture, legacy grant, locked/off matrix,
listener recovery and direct ingress; that image has no encrypted-storage proof.

Deferred compatibility follow-up belongs to V1 in the release plan: provision a
live API 21 image and verify listener binding, reads, and pause/play against the
matching build, or obtain an explicit release-scope disposition. Existing offline
coverage is not a substitute and cleanup does not waive that requirement.
Downstream PiP-window persistence still needs its own visual/window assertion.
N2 is not required for consumers to use the delivered background observations.

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

Implementation must run the appropriate checks above. Do not rerun passing checks without a
change, failure or unresolved concern that warrants it.

## Completion and cleanup

Update each row with implementation/validation status and commit/PR when known;
local completion is not merge or release. Finish in-scope failures and local
Conventional Commits without bypassing hooks. Keep unfinished rows actionable.
When both feature scopes are complete, use `.agents/skills/task-cleanup/SKILL.md`
to retire this pack after durable decisions/evidence move to docs. Replace release
links to retired files with permanent docs and preserve pending release steps.
