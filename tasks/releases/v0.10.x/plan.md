# v0.10.x physical-device reliability priorities

Status: planning complete; implementation and patch publication not started.
This is a new patch-series queue, not a reopening of the retired 0.10.0 release
pack. Baseline inspected: `626a169d`, code version 0.10.1. Reconcile current
versions, tags and work in flight before choosing a patch release number.

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

Priorities express delivery order, not artificial merge gates. Prefer one PR per
pack with behavior, regressions and docs together. Rows 1 and 2 are the primary
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

The current request authorizes these task packs and local planning commits,
not feature implementation, pushing or publication. Later implementation follows
the named pack through validation, docs, status and logical local commits.
Release execution requires a separate instruction and the release-orchestrator
skill, including release notes, applicable acceptance gates and distribution
verification. Do not invent a date or publish a patch from this plan alone.

Before retiring completed packs, preserve durable behavior and sanitized evidence
in the docs named by each pack. Update these links and retain actionable release
or deferred work. Use task-cleanup when implementation is complete.
