---
name: task-author
description: Write task folders under tasks/ with explicit plan.md and work-breakdown.md handoffs for agents. Use when turning feature, fix, docs, release, cleanup, or refactor requests into deterministic multi-phase tasks, especially for Clawperator surfaces such as the Android operator APK, Node CLI, docs, skills, and release workflows.
---

# Task Author

Write task packs in `tasks/` that another agent can execute without guessing.

Prefer task packs over GitHub issues for project work. A good task pack is an executable handoff artifact, not issue-tracker prose.

## Core Model

Write for a weaker implementing agent than the one authoring the task.

Assume the implementer:

- will take the most literal reading
- will not infer missing constraints
- may batch work unless forbidden
- may re-derive decisions unless fenced off
- may skip verification if "done" is vague

Your job is to make shortcuts harder than doing it right.

## Start With Repo History

`tasks/` is temporary. Strong examples are often already deleted from the working tree.

Before drafting a new task pack:

1. Inspect current `tasks/` entries.
2. Inspect git history for deleted or completed task folders in the same surface.
3. Reuse naming, file layout, and section structure that already worked in this repo.

Useful commands:

```bash
git log --oneline -- tasks
find tasks -maxdepth 3 -type f | sort
git show <sha>:tasks/<path>/plan.md
git show <sha>:tasks/<path>/work-breakdown.md
git show <sha>:tasks/<path>/findings.md
```

Do not invent a new task structure if repo history already has a good answer.

## Default Output

Create these files for a new task pack:

- `tasks/<task-name>/plan.md`
- `tasks/<task-name>/work-breakdown.md`

Use these common scoped paths by default when the task is clearly dominated by one surface:

| Task type | Default task path |
| --- | --- |
| Android-heavy work | `tasks/android/<task-name>/` |
| Node-heavy work | `tasks/node/<task-name>/` |
| Docs-heavy work | `tasks/docs/<task-name>/` |

Use the unscoped form `tasks/<task-name>/` when the task is genuinely cross-surface and no single area clearly owns it.

Check repo history only to refine naming and structure within the chosen area. Do not leave surface scoping as an open-ended judgment call when one of the default mappings above clearly applies.

Create these only when justified:

- `tasks/<task-name>/findings.md`
- `tasks/<task-name>/finalization-items.md`
- `tasks/<task-name>/design.md`
- `tasks/<task-name>/agent-prompt.md`

Do not create placeholder files or scaffolding that the implementing agent does not need.

## File Roles

Keep the roles strict:

- `plan.md` is the stable contract.
- `work-breakdown.md` is the executable spec.
- `findings.md` is an execution-time artifact.
- `finalization-items.md` records deferred but still-actionable follow-up work.

Do not collapse strategy and execution into one file.

Do not pre-author `findings.md` unless the user explicitly wants a starter scaffold. Usually the right move is to define its required structure in `plan.md` or `work-breakdown.md` and tell the implementer when to create it.

## What `plan.md` Must Do

Use `plan.md` for the decisions that should remain stable across all later phases and PRs.

Near the top of the file, include an `Executive Summary` section before the deeper planning detail.

Near the top of the file, include a dedicated `Status` section. This should summarize execution state, not just say "open" or "in progress."

Include:

1. Title and goal
2. `Executive Summary` with task shape, PR count, phase count, and current state
3. `Status` summary with completed phases, remaining phases, and overall state
4. Why the task exists now
5. In-scope work
6. Out-of-scope work
7. Surface map and ownership boundaries
8. Canonical source-of-truth files
9. Deterministic versus judgment split
10. Decision tables, lookup tables, or state tables for branchy behavior
11. Failure modes the task is designed to prevent
12. Output contract or acceptance target
13. Idempotency contract when outputs can be rerun
14. Durable follow-up destinations for knowledge that must outlive `tasks/`

The `Executive Summary` should let a new agent answer, immediately:

- what this task changes
- whether it is single-phase or multi-phase
- how many phases exist
- how many PRs those phases ship across
- whether any earlier PRs must merge before later work starts

The `Status` section should be explicit enough that a new agent can tell, at a glance:

- whether the task is not started, active, blocked, or partially complete
- how many phases or PRs are complete
- how many phases or PRs remain
- which phase is currently active or next
- whether execution is waiting on merge, review, or an external prerequisite

For multi-phase work, prefer a compact status table over a single sentence.

Use tables whenever a rule has branches. Prefer first-match-wins lookup tables over explanatory prose.

## What `work-breakdown.md` Must Do

Use `work-breakdown.md` for the steps the implementing agent will follow literally.

Start with:

- parent plan reference
- `Executive Summary`
- `Status`
- `Hard Rules`
- `Required Reading`
- PR or phase sequencing table

For every phase, include:

- Goal
- Files or surfaces to change
- Steps
- Acceptance criteria
- Validation commands
- Expected commit message

When work spans multiple PRs, say explicitly: do not start the next PR until the previous one is merged.

The `Status` section in `work-breakdown.md` should mirror execution reality and be update-friendly. It should summarize:

- total phases or PRs
- completed phases or PRs
- remaining phases or PRs
- current or next phase
- any merge gate or blocking dependency preventing the next step

The `Executive Summary` in `work-breakdown.md` should restate the execution shape in compact form:

- total PRs
- total phases
- which phases live in which PRs
- whether the work is currently in planning, active execution, waiting for merge, or final cleanup

## Hard Rules

`Hard Rules` belong at the top of `work-breakdown.md`, before any phase work.

Hard rules are invariants, not advice. Write them in imperative voice. Examples:

- Do not start the next PR until the previous PR is merged.
- One commit per logical step. Do not batch unrelated changes.
- Do not edit generated docs directly.
- Update `findings.md` before each phase commit when the phase performs analysis, backfill, or judgment.
- Use the script output as authoritative. Do not re-derive the decision downstream.

## Deterministic Versus Judgment

This split is the most important structural decision in most good task packs.

Push into deterministic rules whenever possible:

- classification
- file routing
- output shape
- insertion and upsert rules
- validation commands
- schema extraction
- test expectations

Reserve judgment for the parts that truly need it:

- prose synthesis
- naming when no code-defined name exists
- escalation when deterministic rules are insufficient
- prioritization among valid options when the decision cannot be reduced further

If a downstream agent must not re-derive a deterministic decision, state that explicitly.

## Source-Of-Truth Tables

Every task pack that depends on code, contracts, or generated artifacts should include a verification table.

Common Clawperator authority files:

| Topic | Verify against |
| --- | --- |
| CLI commands, flags, aliases | `apps/node/src/cli/registry.ts` |
| Selector flags and behavior | `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts` |
| Action types and parameters | `apps/node/src/contracts/execution.ts` |
| Error codes and meanings | `apps/node/src/contracts/errors.ts` |
| Result envelope | `apps/node/src/contracts/result.ts` |
| Doctor checks | `apps/node/src/domain/doctor/checks/` |
| Serve command | `apps/node/src/cli/commands/serve.ts` |
| Android operator behavior | `apps/android/` |
| Public authored docs | `docs/` |
| Docs-site manifest and generated boundaries | `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml` |
| Landing site | `sites/landing/` |
| Repo-local skills | `.agents/skills/` |

Adjust the table to the task. Never tell the implementer to rely on existing docs alone when the code is available.

## Clawperator Surface Rules

Keep repo surface boundaries explicit:

- Android operator APK lives under `apps/android/`.
- Node CLI/API and contracts live under `apps/node/`.
- Public docs are authored in `docs/`.
- `sites/docs/.build/` and `sites/docs/site/` are generated outputs, not authored surfaces.
- Landing-site source lives in `sites/landing/`.
- Repo-local maintenance skills live in `.agents/skills/`.
- `tasks/` is temporary execution scaffolding, not durable documentation.

If the task changes a public contract, CLI behavior, setup flow, or user-visible runtime behavior, require corresponding docs updates in the same task pack.

When the task pack includes authored public-doc work, explicitly call the implementing agent to use `.agents/skills/docs-author/SKILL.md` for the documentation phase or subphase. Do not leave public-doc updates as a generic "update docs" instruction.

If the task changes code and authored public docs in the same effort, keep the docs work tied to the same task pack and point the docs phase at `docs/` as the authored source of truth, not `sites/docs/.build/` or `sites/docs/site/`.

## Phase Design

Split non-trivial work into independently reviewable phases.

Good default order:

1. Proof, scaffolding, or infrastructure
2. Core implementation
3. Validation, backfill, or content expansion
4. Integration or cleanup

Use a small proof phase first when the mechanism is reusable, high-risk, or hard to validate. Use a stress or backfill phase later to prove the mechanism on harder input.

Do not mix infrastructure, content authoring, and cleanup in the same phase unless the work is purely mechanical.

Decide phase and PR count explicitly. Do not leave the task pack with "phases to be determined."

Use this default decision rule:

| Situation | Default structure |
| --- | --- |
| Small, single-deliverable task with one validation path | 1 phase in 1 PR |
| One implementation step plus one meaningful validation or cleanup step that can be reviewed together | 2 phases in 1 PR |
| Reusable mechanism that needs proof before broad rollout | 2-4 phases across 2+ PRs |
| Infrastructure work and content work both exist | split into separate PRs |
| High-risk or cross-surface work where later steps depend on earlier merge state | split into multiple PRs with merge gates |

If multiple phases live in one PR, say so explicitly in the sequencing table.

If each phase needs independent review, different model tiers, or separate merge checkpoints, put them in separate PRs.

## Commit Discipline

State commit expectations explicitly.

Useful defaults:

- Infrastructure or cleanup work: one commit per logical task is fine.
- Content-heavy work: prefer one file at a time, usually draft then refine.
- Multi-file batches are acceptable only when the change is truly mechanical and reviewable as one unit.
- Never rely on "commit at sensible points." Name the expected commit messages.

## Acceptance Criteria

Write acceptance in two layers:

1. Mechanical acceptance
2. Human review

Mechanical acceptance must be falsifiable:

- exact command passes
- exact file exists
- exact section exists
- exact output shape matches
- exact grep returns zero results
- exact test case passes

Human review should be short and concrete:

- verify the summary reflects the dominant change
- verify no claim exceeds the evidence
- verify exemplars and naming remain consistent

Avoid vague criteria such as "looks good" or "clean implementation."

## Validation Rules

List exact commands, when to run them, and what passing means.

When relevant:

- docs tasks must include `./scripts/docs_build.sh`
- Android changes should include assemble, unit tests, install, and device verification paths
- Node changes should include `npm --prefix apps/node run build` and tests
- CLI option changes should include valid, invalid, and missing-value cases
- script-producing phases should include a test script in the same phase

If terminology or policy violations matter, include grep commands instead of prose-only reminders.

## `findings.md` Rules

`findings.md` is a running audit trail, not a planning deliverable.

Use it when execution includes:

- synthesis
- classification
- backfill
- runtime observations
- validation anomalies
- judgment calls that must be reviewable later

When a task needs `findings.md`, specify:

- when it is created
- required sections
- what each phase must append
- the mapping from inputs to outputs when omissions would be risky

A good findings spec usually includes:

- raw command or script output
- summary tables
- judgment calls and escalations
- anomalies and surprises
- draft-before-insertion snapshots when outputs are synthesized

## Extra Task Files

Use extra files only when they materially improve execution:

- `finalization-items.md` for deferred items discovered during execution that must survive the current phase
- `design.md` for larger architectural reasoning that would overload `plan.md`
- `agent-prompt.md` or phase-specific prompts when an execution handoff genuinely benefits from a narrower prompt than `work-breakdown.md`

If the extra file is just restating `plan.md` or `work-breakdown.md`, do not create it.

## Common Failure Patterns

Prevent these explicitly:

- leaving key choices to the implementer
- writing from stale docs instead of code
- mixing stable strategy and execution steps in one section
- omitting required reading
- omitting exact commit boundaries
- under-specifying output format
- claiming idempotency without saying what is stable across reruns
- failing to name scope exclusions for existing low-quality content
- confusing authored and generated docs surfaces
- treating `findings.md` as optional when judgment-heavy work needs an audit trail

## Final Check

Before returning the task pack, confirm:

- the task can be executed from the files alone
- the plan made the hard decisions
- `plan.md` and `work-breakdown.md` have distinct jobs
- deterministic rules are not left to downstream judgment
- required reading and source-of-truth files are explicit
- phases, PR boundaries, and merge gates are explicit
- acceptance criteria are mechanically checkable
- validation commands are concrete
- durable knowledge has a permanent home after task cleanup
