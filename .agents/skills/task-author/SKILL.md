---
name: task-author
description: Write task folders under tasks/ with explicit plan.md and work-breakdown.md handoffs for agents. Use when turning feature, fix, docs, release, cleanup, or refactor requests into deterministic multi-phase tasks, especially for Clawperator surfaces such as the Android operator APK, Node CLI, docs, skills, and release workflows.
---

# Task Author

Write task packs in `tasks/` that another agent can execute without guessing.

Prefer task packs over GitHub issues for project work. A good task pack is an executable handoff artifact, not issue-tracker prose.

Run: `$task-author <task-name> "<one-line goal>"`

Use the task name as the folder name under `tasks/`. If the goal is ambiguous, ask the user the minimum clarifying question needed before writing the task pack.

## Agents Metadata

`agents/openai.yaml` is UI metadata for skill lists and default prompting. It is not an extra workflow document and it does not override `SKILL.md`.

Keep it aligned with this skill:

- `display_name` should stay human-readable
- `short_description` should describe the real job of the skill
- `default_prompt` should point the agent at the actual workflow in this file

When `SKILL.md` meaning changes materially, update `agents/openai.yaml` in the same change.

## Core Model

Write for a weaker implementing agent than the one authoring the task.

Assume the implementer:

- will take the most literal reading
- will not infer missing constraints
- may batch work unless forbidden
- may re-derive decisions unless fenced off
- may skip verification if "done" is vague

Your job is to make shortcuts harder than doing it right.

## Workflow

1. Understand the request.
   - Extract the intended outcome, owning surface, and why a task pack is needed.
   - If the request is ambiguous, ask the minimum clarifying question needed to determine scope, task path, or output shape.
2. Decide whether a task pack is warranted.
   - If the work is a single obvious change, one surface, one commit, and one validation path with no branching decisions, do not create a task pack. Tell the user the work is too small for `plan.md` plus `work-breakdown.md` and recommend doing the work directly.
3. Inspect repo history.
   - Review current `tasks/` entries and deleted historical task packs in the same area before inventing structure.
4. Determine task path and ownership.
   - Choose `tasks/android/`, `tasks/node/`, `tasks/docs/`, or unscoped `tasks/` using the explicit path rules below.
5. Decide phase count and PR boundaries.
   - Use the phase-decision table in this skill.
   - Decide explicitly whether the work is 1 phase in 1 PR, multiple phases in 1 PR, or multiple PRs with merge gates.
6. Draft `plan.md`.
   - Include the required sections in the required order.
   - Make the stable decisions here, not in `work-breakdown.md`.
7. Draft `work-breakdown.md`.
   - Start with the execution summary sections.
   - Then add hard rules, required reading, sequencing, and per-phase details.
8. Add any justified companion files.
   - Add `findings.md` guidance, `finalization-items.md`, or phase-specific prompts only if the task genuinely needs them.
9. Run the final check.
   - Verify that the task pack can be executed literally by a weaker agent.
10. Present the task pack for review.
   - Return the finished task-pack files, not a comparison memo.

## When Not To Use This Skill

Do not create a task pack when all of these are true:

- the work is likely one logical commit
- it clearly belongs to one surface
- the acceptance path is obvious
- there are no routing, classification, or sequencing decisions to preserve
- no weaker-agent handoff artifact is needed

In that case, say the task pack would be unnecessary overhead and recommend direct implementation instead.

## Start With Repo History

`tasks/` is temporary. Strong examples are often already deleted from the working tree.

Before drafting a new task pack:

1. Inspect current `tasks/` entries.
2. Inspect git history for deleted or completed task folders in the same surface.
3. Reuse naming, file layout, and section structure that already worked in this repo.

Useful commands:

```bash
git log --oneline -- tasks
git log --all --oneline -- tasks
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

For tasks that include synthesis, classification, runtime observation, or judgment-heavy review, do not create `findings.md` up front, but do specify its full required structure in `work-breakdown.md`. The file creation is deferred; the structure is not.

## Output Skeletons

Use these section skeletons unless the task has a strong reason to differ.

`plan.md`

```md
# <Task Title>

## Executive Summary
<What changes, total PRs, total phases, current state>

## Status
| Item | Value |
| --- | --- |
| State | <not started / active / blocked / partial / done> |
| Total PRs | <n> |
| Total phases | <n> |
| Completed | <phase ids or count> |
| Remaining | <phase ids or count> |
| Current / Next | <phase id> |
| Blockers | <none / merge gate / external dependency> |

## Goal
<Intended outcome>

## Why Now
<Why this task exists now>

## In Scope
<Explicit bullets>

## Out of Scope
<Explicit exclusions>

## Existing Artifact Scope
<If the task edits an artifact that already exists, state what existing content is in scope to change, preserved as-is, or out of scope>

## Surfaces and Ownership
<Surface map table>

## Source Of Truth
<Verification table>

## Deterministic Versus Judgment
<What is computed versus what requires synthesis>

## Decision Rules
<Lookup tables / state tables>

## Failure Modes To Prevent
<Top failure modes>

## Output Contract
<Exact output shape>

## Idempotency
<What stays stable across reruns, what may vary>

## Durable Follow-Up
<What must move to permanent docs or code after task cleanup>
```

`work-breakdown.md`

```md
# <Task Title> Work Breakdown

Parent plan: `tasks/<task-name>/plan.md`

## Executive Summary
<Total PRs, total phases, phase-to-PR mapping, current execution state>

## Status
| Item | Value |
| --- | --- |
| State | <planning / active / waiting for merge / cleanup / done> |
| Total PRs | <n> |
| Total phases | <n> |
| Completed | <phase ids or count> |
| Remaining | <phase ids or count> |
| Current / Next | <phase id> |
| Blockers | <none / merge gate / external dependency> |

## Hard Rules
<Imperative invariants>

## Required Reading
<Files to read before starting>

## PR / Phase Plan
| PR | Purpose | Included phases | Merge gate |
| --- | --- | --- | --- |
| PR-1 | <purpose> | <phase ids> | <gate> |

## Phase <n>: <Title>

### Goal
<Single deliverable>

### Files or Surfaces To Change
<Paths or surfaces>

### Steps
1. <explicit step>

### Acceptance Criteria
- <mechanical checks>
- <human review checks>

### Validation
```bash
<exact commands>
```

### Expected Commit
```text
<exact commit message>
```
```

Keep the section order stable unless the task has a strong reason not to.

For a small but still-worthwhile single-phase task pack, keep both files but abbreviate them:

- keep `Executive Summary` to 2-4 lines
- keep `Status` to one compact table row set
- keep PR planning to one row
- keep scope and failure-mode sections tight and explicit rather than expansive

Do not drop `plan.md` or `work-breakdown.md`, but do avoid multi-phase boilerplate when the task is genuinely 1 phase in 1 PR.

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

If the task modifies an artifact that already contains content, add an explicit scope statement for existing content:

- what existing content may be rewritten
- what existing content is preserved as-is
- what low-quality or stale content is intentionally out of scope for this task

Use tables whenever a rule has branches. Prefer first-match-wins lookup tables over explanatory prose.

Name durable destinations concretely when they apply. Common destinations in this repo are:

- public docs in `docs/`
- repo-local skills in `.agents/skills/`
- code contracts and source-owned comments in `apps/node/src/` or `apps/android/`
- public release history in `CHANGELOG.md`

Do not write "update the docs" or "capture this somewhere permanent" without naming the destination path.

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

If the work exceeds roughly 6-8 phases, prefer splitting it into multiple task packs with explicit sequencing instead of one oversized `work-breakdown.md`.

`Required Reading` should be specific and ordered. For each entry, give the exact file path and why it must be read before implementation. A good list usually includes:

- the parent `plan.md`
- the most relevant authoritative code or contract files
- any existing repo skill the implementing agent should use instead of re-deriving behavior
- an exemplar file or prior task artifact when structure matters

The reading order matters. Tell the implementing agent to read the files in the listed order before writing anything. Put governing documents first, exemplars second, and task-specific execution detail after that.

Prefer this shape:

```md
## Required Reading

| File | Why it matters |
| --- | --- |
| `tasks/<task-name>/plan.md` | Stable contract and scope boundaries |
| `<path>` | Authoritative behavior or output contract |
| `<path>` | Exemplar or companion workflow |
```

When order is important, state it explicitly:

```md
Read these files IN THIS ORDER before writing anything.
```

## Hard Rules

`Hard Rules` belong at the top of `work-breakdown.md`, before any phase work.

Hard rules are invariants, not advice. Write them in imperative voice. Examples:

- Do not start the next PR until the previous PR is merged.
- One commit per logical step. Do not batch unrelated changes.
- Do not edit generated docs directly.
- Update `findings.md` before each phase commit when the phase performs analysis, backfill, or judgment.
- Put a script's test in the same phase and commit as the script it verifies. Do not defer test creation to a later phase.
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

Use direct fence language in the task pack, not soft phrasing. Good patterns:

- `Use only the classification output below. Do not re-derive routing from raw files.`
- `Apply the insertion table verbatim. Do not invent a new upsert rule.`
- `Use .agents/skills/docs-author/SKILL.md for the docs phase. Do not restate that workflow here.`
- `Treat the generated list as authoritative. Do not filter items unless the plan explicitly says so.`

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

More generally: when a phase can be handled by an existing repo skill, reference that skill by path instead of re-specifying its full behavior. Check `.agents/skills/` for relevant skills before writing phase instructions from scratch.

## Exemplar-Driven Handoffs

When a task produces multiple similar outputs, establish an exemplar early instead of expecting the implementing agent to infer the bar.

Use this pattern when the task has 3 or more similar deliverables such as:

- docs pages
- migration edits across many files
- repeated config or metadata updates
- repeated generated-but-reviewed outputs

In those cases:

1. Complete one output first as the exemplar, or point to an already-strong repo example.
2. Name the exemplar file path in `Required Reading`.
3. State exactly why it is the exemplar:
   - depth
   - exact defaults from code
   - examples
   - validation patterns
   - error coverage
4. Instruct later phases to match that quality bar instead of inventing their own.

If the first pass comes back below the bar, the task pack should support a correction loop. A good correction prompt:

1. Names the specific rejected commit
2. States what was wrong using concrete examples from the actual output
3. Points to the exemplar or exemplar diff:
   - `git diff <bad>..<good> -- <file>`
4. Restates the expected workflow
5. Lists the remaining files or steps in order

When the task has 3 or more similar outputs, include exemplar references and the expected correction-loop pattern in `work-breakdown.md`.

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

Budget for multiple passes on content-heavy phases. In this repo, content work should generally be treated as draft-plus-refine rather than one-shot output.

For content-heavy phases:

- assume the first pass is a draft
- include an explicit reread or refine step
- budget at least two commits per file or deliverable when the work is repeated across many similar outputs
- do not treat the first authoring pass as the final quality gate

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

Use a task-specific human review checklist with at least these slots:

- output accuracy: does the artifact say exactly what the evidence supports
- scope completeness: did the task cover the intended surfaces and no more
- evidence grounding: is every important claim traceable to code, inputs, or findings
- format compliance: does the output match the required structure and ordering

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

State this explicitly in the task pack when applicable: `Create findings.md at the start of the first execution phase using the structure below. Do not invent the format during execution.`

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

When you create `finalization-items.md`, give each entry enough structure that a later agent can act on it without reconstructing context. A good entry includes:

- the deferred item
- why it was deferred
- what follow-up decision or action is needed
- any dependency or blocking prerequisite

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
- the task is large enough to justify a task pack
- the plan says what happens to existing target-artifact content

Scan specifically for these failure patterns before returning:

- strategy accidentally leaked into `work-breakdown.md`
- execution details are missing from `work-breakdown.md`
- a deterministic rule is described but not fenced off from re-derivation
- an existing repo skill should have been referenced but was not
- section order drifted away from the default skeleton without a good reason
