# v0.11 notifications and media release

## Target and status

Target release: **0.11.0**. Next unreleased code version after publication:
**0.11.1**, unless the user specifies otherwise. This plan coordinates the
notification/media workstream and release readiness; it does not assert release
completion or trigger publication merely by existing.

Status: N1 merged as 45d9667a821379a2385137d788a7eb4f13986c7b (PR #302).
N2 merged in ac8a474352476937b119ded7ecc739f517f5fc32 (PR #303).
N3 is implemented and validated locally in 0d4ce6c0; its merge and V1-V3 release
execution remain pending. Current main already has code version 0.11.0 from 917d5a83.
Reconcile main, release tags and published state during release preparation.
Live N1 coverage is API 26/35/36; API 21/28 service tests are offline. V1 must provision a live API 21 image and verify listener binding, reads and
pause/play with the matching build, or obtain an explicit release-scope
disposition. Offline coverage does not satisfy that live compatibility gate.

Delivered contracts: [notifications](../../../docs/api/notifications.md) and
[media](../../../docs/api/media.md). Permanent N1/N2/N3 behavior and sanitized
acceptance evidence: [design record](../../../docs/internal/design/notifications-and-media.md).
Reproduction: [independent fixture](../../../validation/notifications-media/README.md).
The completed notifications and locked-media-controls packs are retired.
N3 acceptance and limitations live in the [permanent record](../../../docs/internal/design/notifications-and-media.md#n3-locked-media-controls).
Cleanup does not satisfy the pending N3 merge prerequisite.

## Grouped delivery

| Stage | Scope / PR | Dependency | Status |
| --- | --- | --- | --- |
| N1 | Fresh notification reads; media discovery/status/pause/play; Android + Node + CLI/HTTP execution + tests + docs | Current main | [DONE] Merged in PR #302 (45d9667a) |
| N2 | Notification dismiss/buttons; media seek; matching tests/docs and integrated live acceptance | Merged N1 service boundary/contracts | [DONE] Merged in PR #303 (ac8a4743), with API 26/36 acceptance |
| N3 | Non-waking locked/off media pause/play/seek; physical YouTube and independent fixture evidence | N2 contracts; merge N2 before N3 | [DONE] Local implementation in 0d4ce6c0; API 26/36 and physical YouTube acceptance complete; PR merge pending |
| V1 | Release preparation PR: reconcile existing 0.11.0 code, release notes, release-package/final acceptance evidence and task cleanup | N1/N2/N3 merged | [TODO] |
| V2 | Tag/publish 0.11.0 and verify distribution | V1 merged and inherited release gates resolved | [TODO] |
| V3 | Post-publication follow-up PR: public version surfaces and next unreleased code version, in separate logical commits | Successful V2 verification | [TODO] |

Bias toward these three feature PRs plus the required release lifecycle changes.
Do not create separate infrastructure, platform, CLI, documentation or test PRs
for components of N1/N2/N3. Keep V1-V3 separate from the feature batches and do not
duplicate completed version bumps or feature acceptance.
N1 alone unblocks downstream screen-off/PiP observation work; N2 is not a
prerequisite for those consumers. Player-reported state and estimated position do
not establish real playback progress or PiP-window persistence. Keep independent
fixture progress and downstream visual/window assertions separate.

Code-version reconciliation remains V1 work. Main already has 0.11.0; do not
repeat the completed bump or change published-version claims during feature work.

## Release acceptance

- N1/N2/N3 complete their declared offline and live evidence. Re-run combined checks
  only when needed to verify the final integrated source/build, not as a ritual.
- Preserve the [validated background readiness behavior](../../../docs/internal/design/notifications-and-media.md#service-boundary-and-readiness), including a cold/expired
  interactive cache, absent accessibility and listener recovery. Background doctor
  reports its own capability with correct exits and no UI/remediation side effects;
  default interactive doctor semantics remain intact.
- Screen-off/locked notification/media reads meet the observation-only readiness
  contract without UI side effects. N3 extends the non-waking service path to
  media-only and mixed read/media-control lists. Lists containing UI actions or
  notification mutations retain whole-execution interactive readiness;
  stale player reports and session replacement races have explicit evidence.
- N3 proves actual physical YouTube pause/resume against one session while
  locked, plus fixture pause/seek/play while locked/off without wake or unlock.
  Keep dispatch, player reports and independent effects separate.
- Offline tests run automatically; live emulator proof uses an explicit/manual
  workflow, not an every-PR/push emulator job. Retain its result as release evidence.
- Generic MCP execute preserves the same action payloads and structured errors as
  CLI, typed helpers and HTTP execution; dedicated named tools are not required.
- Notification read, selected-session timestamp, pause/seek/play, button invocation
  and dismissal work through the canonical execution path. Errors distinguish
  access, connection, unsupported behavior, expired references and uncertainty.
- Test the final CLI with the matching release Operator package
  `com.clawperator.operator`, as well as the development variant during feature
  work. Record source commit, CLI/APK versions, Android versions and actual
  supported-player limits. Do not substitute a debug-only run for release proof.
- Generated help/docs and any affected sibling runtime skills match the final
  contract. Public published-version claims remain unchanged until release is live.
- Reconcile the [permanent release acceptance record](../../../docs/internal/release-reference.md#v010-acceptance-requirements)
  and [remaining transport investigation](../../node/result-transport-reliability/plan.md)
  with current code and evidence. The v0.10 task plan is retired; its release-owner
  disposition deferred the historical reader-exit cause for 0.10.0 only. Do not
  automatically carry that approval into 0.11 or treat the cause as resolved.
  Resolve applicable gates through evidence or an explicit 0.11 release-scope
  decision, preserving the limits in permanent docs. Do not duplicate transport
  implementation in this feature pack. This is a publication prerequisite, not a
  blocker to starting N1.

## Release execution and scope

Feature implementation and task cleanup do not authorize package publication or
a main push. N1 is merged; N3 feature implementation does not authorize V1-V3. Explicit release
execution uses `.agents/skills/release-orchestrator/SKILL.md` with 0.11.0 and 0.11.1.
Use its version, release-note, creation, verification and published-version skills
instead of duplicating their procedures here. The release CHANGELOG entry must be
merged before tagging. Verify npm/GitHub/APKs/checksums through the release skill;
stop publication follow-up on failed verification. Never push main directly.

Keep published-version follow-up and next-code-version bump as separate commits,
though they may share a follow-up PR. Preserve truthful status for locally
implemented, merged, published and verified work. No invented release date, PR
number or validation result belongs in this plan.

Feature contracts and evidence now live in the permanent references above.
Retain actionable release steps until publication and version follow-up finish;
then use task-cleanup to retire the coordination plan without losing open work.
