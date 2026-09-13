# v0.10.x physical-device reliability priorities

Prioritize reliable physical-device evidence and sandboxed recording for the
0.10.x patch series. Each selected pack is complete when its implementation,
required evidence, documentation and local commits are complete. Publication
has separate gates below.

Status: writable video state (item 2) is implemented and independently validated
locally. Its combined complete-bundle check with item 1 remains open. Other
items and patch publication are not completed by this branch.
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
| 2 | P1 | [Writable video state](../../node/evidence-writable-state/plan.md) | Confirmed sandbox integration failure; retain cross-root device ownership; independent implementation, use row 1 for integrated complete-bundle proof | [DONE] locally; combined proof pending |
| 3 | P2 | [Scoped selection diagnostics and deterministic assertions](../../node/scoped-selection-guidance/plan.md) | Reduce repeated ambiguity/overlap discovery mistakes; existing scoped behavior passed; independent | [TODO] |
| 4 | P2 | [Safe query consumption](../../node/query-consumer-example/plan.md) | Reduce repeated decoding/validation and empty-matcher mistakes; independent | [TODO] |

Use this delivery order; prefer one PR per pack containing behavior, regressions
and docs. Dependencies are listed in the table. Rows 1 and 2 are the primary
patch objectives; rows 3 and 4 can ship in a subsequent patch and should not delay
a validated reliability fix. Do not describe consumer navigation mistakes,
strict ambiguity rejection or emulator ANRs as confirmed runtime regressions.
No new system-dialog API or automatic ANR recovery is scheduled here.

## Dependencies and concurrent work

All four packs can start concurrently on separate branches/worktrees. Priority
sets the preferred delivery order, not a requirement to wait for an earlier
pack to merge. No pack has another pack as a prerequisite for implementation or
its own PR merge; each must still satisfy its own acceptance criteria.

| Pack | Implementation / merge dependency | Integration or coordination requirement |
| --- | --- | --- |
| 1. Device classification | None | Required alongside pack 2 to prove complete physical-device bundles from the restricted-host workflow. Can be verified independently with writable default state. |
| 2. Writable video state | None on another pack; atomic cross-root ownership must be implemented before enabling the override | Lifecycle/locking can be verified before pack 1 lands; retain any metadata-only partial verdict. Complete-bundle acceptance requires pack 1 integrated. |
| 3. Scoped selection | None | Optional link to pack 4's example once its destination exists. The walkthrough must work independently until then. |
| 4. Query example | None | Coordinate shared selector/help/docs edits with pack 3. No dependency on its walkthrough. |

Packs 1 and 2 form the first concurrent work group; packs 3 and 4 can also run
concurrently when capacity permits. Prefer landing pack 1 first because it
removes the known metadata failure from subsequent physical evidence runs.
A validated pack 1 patch need not wait for pack 2. When both fixes are included,
verify their combined restricted-host still/video behavior on the integrated
revision before publication; neither isolated branch proves that combination.
Packs 3 and 4 do not gate a patch containing only the reliability fixes.

### Shared resources and file overlap

- Packs 1 and 2 touch the evidence implementation/tests and share
  `docs/api/evidence.md` and `docs/internal/design/still-evidence.md`. Keep metadata
  policy in pack 1 and state/ownership policy in pack 2; reconcile overlapping
  edits when integrating the second PR.
- Packs 3 and 4 share action/selector/help surfaces and `docs/api/actions.md` /
  `docs/api/selectors.md`. Pack 3 owns selection diagnostics and the walkthrough;
  pack 4 owns query validation and empty-matcher guidance. Avoid duplicate examples
  and add optional cross-links only after the target exists.
- Each branch owns its source and regenerated docs. After merging another pack,
  resolve canonical-source conflicts first and regenerate affected output;
  do not combine conflicting generated text by hand. Repeat checks when the
  integration changes behavior or invalidates previous evidence.
- Live runs need exclusive use of the selected device/app state. With one device,
  serialize live acceptance runs even while coding and offline checks proceed
  concurrently. With separate devices, use explicit serials and matching APKs.
  Pack 2's intentional competing-owner test is one coordinated run, not a reason
  to let unrelated agents interfere with each other's device state.

The transport investigation and v0.11 work can proceed independently of these
packs, subject to the same shared-file/device coordination. Transport evidence
or an explicit release-owner disposition is a publication gate, not an
implementation dependency. Reconcile shared version/release changes when
preparing a release; v0.11 features are not prerequisites for a 0.10.x patch.

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

Each pack owns its detailed checks and completion. Release acceptance covers
the packs included in that patch. When packs 1 and 2 ship together, integrated
acceptance includes physical still/video completion, restricted-host video
lifecycle and cross-root same-device exclusion. Retain truthful source/CLI/APK versions,
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
