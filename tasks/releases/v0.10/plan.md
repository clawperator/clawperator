# v0.10 runtime observability implementation order

This coordinates five active runtime-observability task packs and the completed readiness and on-screen-log implementations. It replaces the former standalone observability index. It does not schedule every unrelated task in the repository or claim that implementation has shipped.

Runtime source audit: `120c1eb782bbed67e1cb1fbe7c2080fdb302ff5d`. Handoff guidance refreshed against `d12f687` after the task packs merged in `008dcb2`; this refinement does not change runtime contracts or release dependencies. On-screen logs raw API (PR #266, `120c1eb`) and CLI (PR #270, `dd66a25`) are merged. Its task pack was retired with explicit user authorization. R1 is implemented and validated in open PR #271; its single-PR task pack was retired by explicit cleanup request, and review and merge remain. Five other packs remain unimplemented, with seven implementation PRs remaining after R1.

## Folder ownership

- `tasks/api/`: Android/Node contracts that span the runtime boundary, including selectors, action results, and on-screen logs.
- `tasks/node/`: host-owned readiness, skill scaffolding, snapshot projection, and artifact/process management. Their public API names do not change their implementation ownership.
- `tasks/releases/v0.10/`: implementation ordering, dependency tracking, and release acceptance. Each feature pack retains its own stable contract and executable phase instructions.

No application-specific fixtures, downstream test cases, report templates, or external project names belong in these packs. The caller owns test assertions, suite policy, and reports.

## Suggested merge order

The order below minimizes shared-file conflicts. Hard dependencies are explicit; row order alone is not a dependency. For two-PR packs, merge PR-1 before starting PR-2. Start each implementation branch from current main plus its merged prerequisites, not another agent's unmerged working tree.

| Order / ID | Implementation | Phase(s) | Hard dependency | Current state |
| --- | --- | --- | --- | --- |
| R1 | [Selected Operator readiness](../../../docs/api/doctor.md) | Complete | None | [DONE] implementation validated; PR #271 awaits review/merge; pack retired; [verification and limits](../../../docs/internal/design/doctor-readiness.md) |
| R2 | [Scaffold failure propagation](../../node/scaffold-failure-propagation/plan.md) | 1 | None | Ready; [prompt](../../node/scaffold-failure-propagation/agent-prompt.md) |
| R3 | [On-screen logs CLI](../../../docs/api/on-screen-logs.md) | Complete | Raw API merged in `120c1eb` | [DONE] merged in `dd66a25` (PR #270); pack retired; [verification and limits](../../../docs/internal/design/on-screen-logs.md) |
| R4 | [Selector inspection PR-1](../../api/selector-inspection/plan.md) | 1 | None beyond merged main | Ready; [prompt](../../api/selector-inspection/agent-prompt.md) |
| R5 | [Strict selectors PR-2](../../api/selector-inspection/plan.md) | 2 | R4 merged | Waiting for R4; [prompt](../../api/selector-inspection/pr-2-prompt.md) |
| R6 | [Action-result diagnostics](../../api/action-result-diagnostics/plan.md) | 1 | R4 and R5 merged | Waiting for R5; [prompt](../../api/action-result-diagnostics/agent-prompt.md) |
| R7 | [Compact snapshots](../../node/compact-snapshots/plan.md) | 1 | R4 merged for additive XML visibility | Waiting for R4; [prompt](../../node/compact-snapshots/agent-prompt.md) |
| R8 | [Still evidence PR-1](../../node/evidence-capture/plan.md) | 1 | None beyond merged main | Ready; [prompt](../../node/evidence-capture/agent-prompt.md) |
| R9 | [Managed video PR-2](../../node/evidence-capture/plan.md) | 2 | R8 merged | Waiting for R8; [prompt](../../node/evidence-capture/pr-2-prompt.md) |

R3 is not a prerequisite for selectors or evidence; the raw overlay API is already merged. R7 and R8 can land before R6 if useful. R2 is isolated enough to implement independently. R1 and R8 do not depend on one another: evidence metadata collection must not call doctor as a hidden mutation or readiness gate.

## Shared-file coordination

- R3, R4/R5, R7, and R8/R9 all touch CLI registration/help. Prefer their suggested order, or use separate worktrees and resolve against the latest main before validation.
- R4/R5 and R6 share the Android task scope, parser, resolver, and result contracts. This is a real merge gate, not just a likely conflict. R6 consumes R4's NodeSummary and R5's strict resolution.
- R7 consumes raw XML plus R4's additive visibility attribute. It must not implement a separate selector engine, reuse observation paths as persistent handles, or strip the overlay metadata introduced by PR #266.
- R8 may extract the existing targeted screenshot helper if required to preserve image capture when the app hierarchy is absent. Keep it shared with normal screenshots; do not redesign action-list interleaving or implement R6 incidentally. Rebase after other changes to runExecution.ts.
- Preserve PR #266's strict raw-action aliases, ON_SCREEN_LOG_* errors, controller-owned window identity, and separate-execution screenshot guidance in every affected PR.
- Existing `tasks/node/skill-preflight-metadata`, doctor SDK-install findings, recording-export follow-up, and I/O optimization work remain separate. None is a prerequisite here; coordinate shared files without absorbing their scope.

## Coverage and boundaries

| Discussed need | Owning implementation / disposition | Required proof |
| --- | --- | --- |
| Correct device/Operator setup | R1 | Missing/mismatched variant or unverified handshake cannot report ready; no implicit package switch |
| Default application selection | R1 setup documentation; caller provisioning | Capability-checked role assignment and readback; doctor does not assign roles |
| Restricted/null application hierarchy | R6, plus R8 partial capture | Structured service/root/window diagnostics; a missing hierarchy preserves screenshot evidence when capture is possible |
| Duplicate containers and selector ambiguity | R4/R5 | Exact candidate count, relational scope, and zero dispatch on ambiguity; waits/searches retain their bounded semantics |
| Checked/enabled/selected state without text | R4 | Empty-label controls still count as nodes and expose state; unknown differs from false |
| Click acceptance versus intended behavior | R6; caller postconditions | Receipt identifies actual dispatch target/method; a successful dispatch never claims a verified application outcome |
| Misleading scroll edges and lost containers | R6 | Missing/incomparable progress, no movement, movement, and container loss remain distinct; loops stay bounded |
| Empty failed-step histories and inconsistent codes | R6 | Preserve prior steps, failed step identity, specific codes, and one terminal result |
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

**Core deterministic execution gate:** R1, R4, R5, and R6 must pass their unit and live criteria before relying on the new readiness/strict-selection/receipt contracts. R2 must also land before using generated skill wrappers. A consumer can start repository/report development independently, but should not build workarounds for these known core failures.

**Evidence integration gate:** R8 must pass before adopting its manifest as the stable report input; R9 must pass before claiming managed-video support. Existing screenshot and explicit ADB recording helpers remain usable while these APIs are developed. Reports must distinguish unavailable evidence from failed test assertions, and never equate file existence with proof.

**Optional convenience:** R3 is implemented; R7 remains planned. Both reduce authoring/inspection overhead, and neither is a technical prerequisite for deterministic execution. Raw on-screen logs already work through the merged API. R1 awaits review and merge, and seven implementation PRs remain. This is the suggested scope of the release workstream, not a requirement to finish every PR before beginning consumer development.

## Implementation handoff and release acceptance

For a selected row, use that pack's plan for the contract and its work breakdown for scope, progress, and acceptance; consult source pointers as needed. Complete the requested PR through implementation, relevant validation, repairs, docs, status, and local commits. Dependencies define rollout order, not an approval pause within an authorized PR. Each row links a short PR-specific prompt. These are convenient entry points, not another specification: the plan owns the contract and the work breakdown owns execution scope and evidence. Pending-PR prompts retain their merge gates. An agent can also start from an instruction such as "Implement R2 from tasks/releases/v0.10/plan.md through validation and local commits." Naming the row establishes authorization; the release table alone does not authorize implementing every row. Use `.agents/skills/task-create-impl-prompt/SKILL.md` when a different handoff is needed.

Before merging each implementation PR:

1. All required branch-local tests/builds and authored-doc builds pass; record exact outcomes and unmet device prerequisites. A skipped live gate is not complete.
2. Review confirms contract parity through the surfaces that PR changes, truthful failure/exit behavior, generic fixtures, and preservation of merged contracts.
3. Keep mutation dispatch free of uncertain-result replay. Each capture manifest and receipt states what was actually observed.
4. Identify any affected sibling skill consumers. Apply necessary migration/version changes in coordination with that repository and run its smoke checks before claiming compatibility.
5. After merge, update the row above with its commit/PR, clear dependent blockers in their packs, and preserve findings until the feature's final PR is complete.

At workstream completion, run the combined Node suite, relevant Android unit/build checks, docs build, and affected live harnesses against the same final CLI/Operator build. Verify the new CLI help, strict/query results, compact XML projection, still bundle, video lifecycle, and overlay interaction together. Record supported device/API combinations accurately. This is acceptance for the workstream, not authority to bump versions, publish packages/APKs, or deploy a release; those use the repository's release workflows when authorized.

Use `.agents/skills/task-cleanup/SKILL.md` after each complete pack's durable guidance is in source/docs. Remove or mark its completed release row before deleting its task directory so links do not go stale. Keep this coordination document until the workstream is complete and its release decisions have durable homes.
