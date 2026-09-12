# v0.10 runtime observability implementation order

This coordinates the runtime-observability workstream and its release-readiness follow-ups. Implementation status does not imply publication or completion of the release gates.

R1-R7, R10 and the R12 preparation implementation are merged. R6 landed in `a44ad0bf` (PR #278). The 13 September audit of that commit found a nested-scroll failure, a Settings preparation gap and intermittent result-transport failures. R11, R12 and R13 below own those follow-ups respectively. R11 is implemented and locally validated on its implementation branch, pending merge; its pack is retired. R7 merged in `48a2604c` (PR #279), and R12 preparation merged in `460e654c` (PR #280) with evidence follow-up still open. Three task packs remain active, covering hierarchy preparation evidence, result transport reliability, and the two evidence-capture phases.

## Folder ownership

- `tasks/api/`: Android/Node contracts that span the runtime boundary, including selectors, action results, and on-screen logs.
- `tasks/android/`: Operator-owned platform behavior and Android platform regression preparation.
- `tasks/node/`: host-owned readiness, skill scaffolding, snapshot projection, and artifact/process management. Their public API names do not change their implementation ownership.
- `tasks/releases/v0.10/`: implementation ordering, dependency tracking, and release acceptance. Each feature pack retains its own stable contract and executable phase instructions.

Generic Android platform regression fixtures such as Settings belong here. Downstream application-specific fixtures, test cases, report templates, or external project names do not. The caller owns test assertions, suite policy, and reports.

## Suggested merge order

The order below minimizes shared-file conflicts. Hard dependencies are explicit; row order alone is not a dependency. For two-PR packs, merge PR-1 before starting PR-2. Start each implementation branch from current main plus its merged prerequisites, not another agent's unmerged working tree.

| Order / ID | Implementation | Phase(s) | Hard dependency | Current state |
| --- | --- | --- | --- | --- |
| R1 | [Selected Operator readiness](../../../docs/api/doctor.md) | Complete | None | [DONE] merged in `cfc90af` (PR #271); pack retired; [verification and limits](../../../docs/internal/design/doctor-readiness.md) |
| R2 | [Scaffold failure propagation](../../../docs/skills/authoring.md) | Complete | None | [DONE] merged in `654d333` (PR #272); pack retired; [verification](../../../docs/internal/design/skill-scaffold-execution.md) |
| R3 | [On-screen logs CLI](../../../docs/api/on-screen-logs.md) | Complete | Raw API merged in `120c1eb` | [DONE] merged in `dd66a25` (PR #270); pack retired; [verification and limits](../../../docs/internal/design/on-screen-logs.md) |
| R4 | [Selector inspection PR-1](../../../docs/internal/design/selector-inspection.md) | 1 | None beyond merged main | [DONE] merged in `8cab7adb` (PR #273); cleanup complete; [validation and limits](../../../docs/internal/design/selector-inspection.md#validation-and-compatibility) |
| R10 | [Sensitive hierarchy access](../../../docs/internal/design/accessibility-hierarchy.md) | Complete | R4 merged | [DONE] merged in `f70c89cb` (PR #275); manual release CI remains required; pack retired; [regression harness](../../../validation/sensitive-hierarchy-access/README.md) |
| R5 | [Strict selectors PR-2](../../../docs/api/selectors.md#strict-action-selection) | Complete | R4 merged | [DONE] merged in `09987ebc` (PR #276); pack retired; [validation and limits](../../../docs/internal/design/selector-inspection.md#validation-and-compatibility) |
| R6 | [Action-result diagnostics](../../../docs/api/actions.md#action-receipts-and-failure-evidence) | Complete | R4 and R5 merged | [DONE] merged in `a44ad0bf` (PR #278); pack retired; [validation and limits](../../../docs/internal/design/action-result-diagnostics.md#validation-and-compatibility) |
| R11 | [Scroll container transitions](../../../docs/internal/design/action-result-diagnostics.md#scroll-eligibility-transition-validation-r11) | Complete locally | R4/R5/R6 merged | [DONE] implementation and focused API-35 proof; 460 Android / 1,479 Node tests; earlier hierarchy harness passed once, latest merged run stopped at R13 transport; pending merge, with R12/R13 and manual release CI gates retained; pack retired |
| R13 | [Result transport reliability](../../node/result-transport-reliability/plan.md) | 1 PR, 3 phases | R6/R10 merged | Planned; audit finding #4; [prompt](../../node/result-transport-reliability/agent-prompt.md) |
| R12 | [Hierarchy harness preparation](../../android/hierarchy-harness-preparation/plan.md) | 1 PR | R10 merged; combined release proof also needs R11/R13 | Implementation merged in `460e654c` (PR #280); debug API 36 preparation verified; release launch timeout and API 35 proof remain open; [follow-up](../../android/hierarchy-harness-preparation/agent-prompt.md) |
| R7 | [Compact snapshots](../../../docs/api/snapshot.md#compact-output-and-raw-artifacts) | Complete | R4 merged for additive XML visibility | [DONE] merged in `48a2604c` (PR #279); pack retired; [validation and limits](../../../docs/internal/design/compact-snapshots.md#validation-and-compatibility) |
| R8 | [Still evidence PR-1](../../node/evidence-capture/plan.md) | 1 | None beyond merged main | Ready; [prompt](../../node/evidence-capture/agent-prompt.md) |
| R9 | [Managed video PR-2](../../node/evidence-capture/plan.md) | 2 | R8 merged | Waiting for R8; [prompt](../../node/evidence-capture/pr-2-prompt.md) |

R3 is not a prerequisite for selectors or evidence; the raw overlay API is already merged. R7 and R8 can be developed independently of R11-R13. Prefer resolving the audit follow-ups first so their failures do not become media-layer workarounds. R1 and R8 do not depend on one another: evidence metadata collection must not call doctor as a hidden mutation or readiness gate.

R10 is locally complete independently of R5-R9. Preserve its sensitivity metadata
when integrating those implementations. Its shared Robolectric prerequisite
(PR #274, `fc70c17d`) was merged before R10.

R11, R12 and R13 have no new implementation merge dependencies on one another. Suggested merge order is R11, R13, then R12, followed by combined validation. R12's preparation changes can start earlier; its focused proof is separate from a full harness pass. R13's diagnostic/code phases cannot stand in for its reliability evidence. Release readiness requires all three outcomes plus the existing R10 manual CI gate. Audit finding #3 remains that release gate, not a fourth implementation pack.

## Shared-file coordination

- R11 owns Android scroll resolution; R13 owns host result reading/reassembly and any proven Android publication repair; R12 owns Settings preparation in the hierarchy harness. Coordinate shared harness edits without replacing the failing scroll scenario or masking transport errors.
- R13 and R8 may both change `runExecution.ts`; prefer R13 first, then validate R8 against its stable transport codes and retained uncertainty.
- R3, R4/R5, R7, and R8/R9 all touch CLI registration/help. Prefer their suggested order, or use separate worktrees and resolve against the latest main before validation.
- R4/R5 and R6 share the Android task scope, parser, resolver, and result contracts. This is a real merge gate, not just a likely conflict. R6 consumes R4's NodeSummary and R5's strict resolution.
- R7 consumes raw XML plus R4's additive visibility attribute. It must not implement a separate selector engine, reuse observation paths as persistent handles, or strip the overlay metadata introduced by PR #266.
- R8 may extract the existing targeted screenshot helper if required to preserve image capture when the app hierarchy is absent. Keep it shared with normal screenshots; do not redesign action-list interleaving or implement R6 incidentally. Rebase after other changes to runExecution.ts.
- Preserve PR #266's strict raw-action aliases, ON_SCREEN_LOG_* errors, controller-owned window identity, and separate-execution screenshot guidance in every affected PR.
- [Repository test consolidation](../../../docs/internal/design/test-execution.md) merged in `39352855`; central discovery now includes query/MCP tests; do not add automatic emulator runs to PR checks.
- Existing `tasks/node/skill-preflight-metadata`, doctor SDK-install findings, recording-export follow-up, and I/O optimization work remain separate. None is a prerequisite here; coordinate shared files without absorbing their scope.

## Coverage and boundaries

| Discussed need | Owning implementation / disposition | Required proof |
| --- | --- | --- |
| Correct device/Operator setup | R1 | Missing/mismatched variant or unverified handshake cannot report ready; no implicit package switch |
| Default application selection | R1 setup documentation; caller provisioning | Capability-checked role assignment and readback; doctor does not assign roles |
| Sensitive native application hierarchy | R10, required for v0.10 | Internet query and XML succeed with the supported shipped access path; normal screens and genuine failure semantics remain correct |
| Other unavailable/null application hierarchy | R6, plus R8 partial capture | Structured service/root/window diagnostics; a missing hierarchy preserves screenshot evidence when capture is possible |
| Duplicate containers and selector ambiguity | R4/R5 | Exact candidate count, relational scope, and zero dispatch on ambiguity; waits/searches retain their bounded semantics |
| Checked/enabled/selected state without text | R4 | Empty-label controls still count as nodes and expose state; unknown differs from false |
| Click acceptance versus intended behavior | R6; caller postconditions | Receipt identifies actual dispatch target/method; a successful dispatch never claims a verified application outcome |
| Misleading scroll edges and lost containers | R6 plus R11 | Missing/incomparable progress, no movement, movement, and container loss remain distinct; loops stay bounded; present-but-nonscrollable scopes are not disappearance, and revealed targets remain observable |
| Empty failed-step histories and inconsistent codes | R6 plus R13 transport follow-up | Preserve prior steps, failed step identity, specific codes, and one terminal result |
| Restored Settings search state | R12 | Verified homepage and start position from fresh/subpage/search states; bounded preparation without weakening capture assertions |
| Intermittent result loss and malformed chunks | R13 | Stable process-failure codes, correlation and dispatch uncertainty; regression-driven repairs and declared repeated-query proof on both variants |
| Scaffold masking child failure | R2 | Real generated script forwards both streams and preserves nonzero status |
| Log-path friction | R1 | Shared path resolution and advisory write diagnostics; healthy actuation is not blocked by file logging |
| Verbose/truncated snapshots | R7 | Whole-node projection, explicit counts/state, unmodified raw artifact, valid JSON, and MCP-owned output paths |
| Screenshot evidence bundles | R8 | Correlation, hashes, per-component times, readable images, and partial-failure manifests |
| Video evidence | R9 | Owned lifecycle, bounded recording, dimension checks, decodable media, and distinct wall/media durations |
| On-screen context and style | Merged overlay PR-1 plus R3 | Public CLI parity, touch/selector isolation, cleanup, and repeated image/video proof |
| Final reports, suite verdicts, fixtures, crash checks, and recovery policy | Downstream consumer | Build reports and assertions from these primitives; not additional Clawperator core tasks |
| Agent-assisted recovery | Deliberately later and caller-owned | Preserve original failed verdict; no hidden retries or planning inside Clawperator |
| Clock/timer display | Excluded by agreement | Only existing stale-panel TTL remains; no timer feature to implement |

This covers the agreed foundation and evidence gaps. It is not a promise that one exploration session discovered every runtime defect, nor a complete test-suite implementation. Newly reproduced issues should be triaged against these boundaries rather than silently growing the packs.

## Gates for downstream adoption

**Core deterministic execution gate:** R1, R4, R5, and R6 must pass their unit and live criteria before relying on the new readiness/strict-selection/receipt contracts. R2 is merged for generated skill wrappers. The audit follow-ups R11 and R13 must resolve the known scroll/transport gaps before claiming the current build meets this gate; R12 establishes reproducible platform proof. A consumer can start repository/report development independently, but should not build workarounds for these known core failures.

**Evidence integration gate:** R8 must pass before adopting its manifest as the stable report input; R9 must pass before claiming managed-video support. Existing screenshot and explicit ADB recording helpers remain usable while these APIs are developed. Reports must distinguish unavailable evidence from failed test assertions, and never equate file existence with proof.

**Optional convenience:** R3 and R7 are merged. They reduce authoring/inspection overhead without being technical prerequisites for deterministic execution. R1-R7, R10 and the R12 preparation implementation are merged; R11 is complete locally pending merge, while R12 evidence and R13 remain outstanding. Consumer development and independent media implementation may proceed, but do not waive these release blockers or the required combined proof.

## Implementation handoff and release acceptance

For a selected row, use that pack's plan for the contract and its work breakdown for scope, progress, and acceptance; consult source pointers as needed. Complete the requested PR through implementation, relevant validation, repairs, docs, status, and local commits. Dependencies define rollout order, not an approval pause within an authorized PR. Each pending implementation row links a short PR-specific prompt. These are convenient entry points, not another specification: the plan owns the contract and the work breakdown owns execution scope and evidence. Pending-PR prompts retain their merge gates. An agent can also start from an instruction such as "Implement R11 from tasks/releases/v0.10/plan.md through validation and local commits." Naming the row establishes authorization; the release table alone does not authorize implementing every row. Use `.agents/skills/task-create-impl-prompt/SKILL.md` when a different handoff is needed.

Before merging each implementation PR:

1. All required branch-local tests/builds and authored-doc builds pass; record exact outcomes and unmet device prerequisites. A skipped live gate is not complete.
2. Review confirms contract parity through the surfaces that PR changes, truthful failure/exit behavior, generic fixtures, and preservation of merged contracts.
3. Keep mutation dispatch free of uncertain-result replay. Each capture manifest and receipt states what was actually observed.
4. Identify any affected sibling skill consumers. Apply necessary migration/version changes in coordination with that repository and run its smoke checks before claiming compatibility.
5. After merge, update the row above with its commit/PR, clear dependent blockers in their packs, and preserve findings until the feature's final PR is complete.

At workstream completion, run the combined Node suite, relevant Android unit/build checks, docs build, and affected live harnesses against the same final CLI/Operator build. Verify the new CLI help, strict/query results, compact XML projection, still bundle, video lifecycle, and overlay interaction together. Record supported device/API combinations accurately. This is acceptance for the workstream, not authority to bump versions, publish packages/APKs, or deploy a release; those use the repository's release workflows when authorized.

Use `.agents/skills/task-cleanup/SKILL.md` after each complete pack's durable guidance is in source/docs. Remove or mark its completed release row before deleting its task directory so links do not go stale. Keep this coordination document until the workstream is complete and its release decisions have durable homes.


## Required v0.10 hierarchy access gate

R10 remains mandatory for v0.10. Its implementation merged in `f70c89cb`. The audit at `a44ad0bf` demonstrated sensitive query/XML access but failed the complete local harness. R11-R13 must be integrated and the full checked-in harness must pass before release readiness is claimed; a manually dispatched CI emulator run remains a release prerequisite.
By user direction, this slow device workflow does not run on each PR or push.
The release must include its supported access approach,
an automated Android 15 Internet-screen query/XML regression executed in CI,
per-node sensitivity metadata, variant/upgrade verification,
and documentation. Improved
failure diagnostics or another investigation alone do not satisfy this gate.
Missing required implementation or evidence blocks
v0.10 unless the user explicitly changes the release scope. A passing focused preparation check, normalized transport codes, or a later successful retry does not satisfy the full gate. Record the final source commit, matching CLI/APK variants, supported image, all declared attempts and any remaining failures. Keep the slow workflow manual; implementing these packs does not authorize publication.
