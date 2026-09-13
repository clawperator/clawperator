# v0.10.x physical-device reliability priorities

Prioritize reliable physical-device evidence and sandboxed recording for the
0.10.x patch series. Each selected pack is complete when its implementation,
required evidence, documentation and local commits are complete. Publication
has separate gates below.

Status: planning complete; implementation and patch publication not started.
This queue follows the retired 0.10.0 release pack. Baseline inspected:
`626a169d`, code version 0.10.1. Reconcile current versions, tags and work in
flight before choosing a patch release number.

## Evidence and prioritization

Source: the local usage-notes repository's physical-device record dated 2026-09-13,
including its overlapping-pane follow-up, read on 2026-09-13. The originating
Codex task is `01a09845-ec21-7a20-b44d-7252403fa3fe`; its latest recorded turn
completed. The notes may continue to grow. Private run artifacts remain in the
consumer repository; they are supporting evidence, not reproducible CI fixtures.
Use the sanitized findings in each pack when those local repositories are absent.

| Order | Priority | Task / PR | Reason and dependency | Status |
| --- | --- | --- | --- | --- |
| 1 | P1 | [Physical-device evidence classification](../../node/evidence-device-classification/plan.md) | Confirmed partial-bundle failure for otherwise valid physical captures; no feature dependency | [TODO] |
| 2 | P1 | [Writable video state](../../node/evidence-writable-state/plan.md) | Confirmed sandbox integration failure; retain cross-root device ownership; independent implementation, use row 1 for integrated complete-bundle proof | [TODO] |
| 3 | P2 | [Scoped selection diagnostics and deterministic assertions](../../node/scoped-selection-guidance/plan.md) | Reduce repeated ambiguity/overlap discovery mistakes; existing scoped behavior passed; independent | [TODO] |
| 4 | P2 | [Safe query consumption](../../node/query-consumer-example/plan.md) | Reduce repeated decoding/validation and empty-matcher mistakes; independent | [TODO] |

Use this delivery order; prefer one PR per pack containing behavior, regressions
and docs. Dependencies are listed in the table. Rows 1 and 2 are the primary
patch objectives; rows 3 and 4 can ship in a subsequent patch and should not delay
a validated reliability fix. Do not describe consumer navigation mistakes,
strict ambiguity rejection or emulator ANRs as confirmed runtime regressions.
No new system-dialog API or automatic ANR recovery is scheduled here.

## Existing work and release gates

The [result-transport causal follow-up](../../node/result-transport-reliability/plan.md)
remains an independent unresolved investigation. Reconcile its scope and the
[permanent release acceptance requirements](../../../docs/internal/release-reference.md#v010-acceptance-requirements)
before publishing any patch. The prior deferral applied to 0.10.0 only; this plan
does not silently renew it or require unrelated transport implementation in
these packs. Resolve applicable gates with evidence or an explicit release-owner
disposition. This does not block starting the new implementation work.

[Notification/media work for v0.11](../v0.11/plan.md) remains separately owned.
Do not change its scope, introduce a dependency on those APIs, or bump shared
versions during task authoring. Other active task packs are not implicitly added
to this evidence-focused patch queue.

## Acceptance and authorized scope

Each pack owns its detailed checks and completion. Integrated acceptance must
include physical still/video completion, restricted-host video lifecycle and
cross-root same-device exclusion. Retain truthful source/CLI/APK versions,
terminal exits, manifest status and media verification. Offline tests alone do
not establish live acceptance; unavailable live cases remain explicitly open.
Use branch-local builds and the matching development Operator during work;
verify the matching release Operator for an eventual release candidate.

Requests to author or revise this plan authorize planning edits and local
commits. A review-only request remains read-only.
An instruction to implement a named pack authorizes its full scope through
validation, repair, docs, status and local commits. Follow any explicit review
boundary in that instruction. Push only when the user or active workflow
requests it.

Publication requires release-execution authorization and
`.agents/skills/release-orchestrator/SKILL.md`, including release notes,
applicable acceptance gates and distribution verification. This plan alone does
not authorize publication or establish a release date.

Before retiring completed packs, preserve durable behavior and sanitized evidence
in the docs named by each pack. Update these links and retain actionable release
or deferred work. Use task-cleanup when implementation is complete.
