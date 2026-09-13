# v0.11 notifications and media release

## Target and status

Target release: **0.11.0**. Next unreleased code version after publication:
**0.11.1**, unless the user specifies otherwise. This plan coordinates the
notification/media workstream and release readiness; it does not assert release
completion or trigger publication merely by existing.

Status: planning complete; N1, N2 and release execution not started. The inspected
base is `7cdb31d4`, whose Node code version is 0.10.0. Reconcile current main,
release tags and published state when implementation/release execution begins.

Feature contract: [notifications plan](../../notifications/plan.md).
Execution details: [work breakdown](../../notifications/work-breakdown.md).

## Grouped delivery

| Stage | Scope / PR | Dependency | Status |
| --- | --- | --- | --- |
| N1 | Fresh notification reads; media discovery/status/pause/play; Android + Node + CLI/HTTP execution + tests + docs | Current main | [TODO] |
| N2 | Notification dismiss/buttons; media seek; matching tests/docs and integrated live acceptance | N1 service boundary/contracts; merge N1 first | [TODO] |
| V1 | Release preparation PR: reconcile/bump code to 0.11.0, release notes, final acceptance evidence and task cleanup | N1/N2 integrated | [TODO] |
| V2 | Tag/publish 0.11.0 and verify distribution | V1 merged and inherited release gates resolved | [TODO] |
| V3 | Post-publication follow-up PR: public version surfaces and next unreleased code version, in separate logical commits | Successful V2 verification | [TODO] |

Bias toward these two feature PRs plus the required release lifecycle changes.
Do not create separate infrastructure, platform, CLI, documentation or test PRs
for components of N1/N2. V1 may fold into the final feature PR when the integrated
base and release evidence are ready; do not duplicate already completed work.
Code-version timing must account for any still-active 0.10 release workflow; do
not bump the shared version during this planning change.

## Release acceptance

- N1/N2 complete their declared offline and live evidence. Re-run combined checks
  only when needed to verify the final integrated source/build, not as a ritual.
- Notification read, selected-session timestamp, pause/seek/play, button invocation
  and dismissal work through the canonical execution path. Errors distinguish
  access, connection, unsupported behavior, expired references and uncertainty.
- Test the final CLI with the matching release Operator package
  `com.clawperator.operator`, as well as the development variant during feature
  work. Record source commit, CLI/APK versions, Android versions and actual
  supported-player limits. Do not substitute a debug-only run for release proof.
- Generated help/docs and any affected sibling runtime skills match the final
  contract. Public published-version claims remain unchanged until release is live.
- Reconcile outstanding [v0.10 release gates](../v0.10/plan.md) with current code
  and evidence. That plan still records result-transport causal and supported-image
  manual CI gates; current main includes a later reader-exit repair. Neither the
  old status text nor a new commit title proves resolution. Preserve any unresolved
  applicable gate for 0.11 and reference its owning pack/design doc; do not silently
  waive it or duplicate its implementation in the notification pack. This is a
  publication prerequisite, not a blocker to starting N1.

## Release execution and scope

The current request creates this pack; no package publication or main push occurs
as part of authoring. A later instruction naming a feature row authorizes that row;
an instruction to implement the feature pack authorizes N1/N2. Explicit release
execution uses `.agents/skills/release-orchestrator/SKILL.md` with 0.11.0 and 0.11.1.
Use its version, release-note, creation, verification and published-version skills
instead of duplicating their procedures here. The release CHANGELOG entry must be
merged before tagging. Verify npm/GitHub/APKs/checksums through the release skill;
stop publication follow-up on failed verification. Never push main directly.

Keep published-version follow-up and next-code-version bump as separate commits,
though they may share a follow-up PR. Preserve truthful status for locally
implemented, merged, published and verified work. No invented release date, PR
number or validation result belongs in this plan.

Before retiring completed feature packs, move stable contracts and evidence to
`docs/api/notifications.md`, `docs/api/media.md` and
`docs/internal/design/notifications-and-media.md`, and update this plan's links.
Retain actionable release steps until publication and version follow-up finish;
then use task-cleanup to retire the coordination plan without losing open work.
