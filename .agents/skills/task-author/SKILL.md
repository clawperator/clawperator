---
name: task-author
description: Write task folders under tasks/ with explicit plan.md and work-breakdown.md handoffs for agents. Use when turning feature, fix, docs, release, cleanup, or refactor requests into deterministic multi-phase tasks, especially for Clawperator surfaces such as the Android operator APK, Node CLI, docs, skills, and release workflows.
---

# Task Author

Write task folders in `tasks/` that another agent can execute without guessing.

Prefer tasks over GitHub issues for project work. Use a task when the work needs a durable handoff, phased execution, explicit validation, or cross-surface coordination.

## Core Rule

Write for the implementer, not for yourself.

Assume the implementing agent is competent but has less context and will take the most literal reading of whatever you write. Remove ambiguity before it reaches execution.
Write so a reviewer can scan the strategy and an implementer can follow the steps literally.

## Required Task Shape

Create at least these files:

- `tasks/<task-name>/plan.md`
- `tasks/<task-name>/work-breakdown.md`

Create these only when needed:

- `tasks/<task-name>/findings.md` - create during execution, not in the planning draft
- `tasks/<task-name>/finalization-items.md` - capture deferred follow-up items that must survive the current phase
- additional reference files only if they improve repeatability

If the task uses `findings.md`, define its structure in `plan.md` or `work-breakdown.md` and treat it as a running execution log, not as an authored deliverable.

## What `plan.md` Must Contain

Write the stable contract in `plan.md`.

Include:

1. Purpose and outcome
2. Scope and out-of-scope
3. A surface map for the parts of Clawperator or the repo that the task touches
4. The authoritative source files or artifacts to verify against
5. The failure modes the task is meant to prevent
6. Any invariants the implementer must not violate
7. The output shape or acceptance target
8. Any durable knowledge that should migrate to `docs/`, `apps/node/src/`, or another permanent home after the task ships

Use tables when a choice or classification can be enumerated. If a rule has branches, spell them out explicitly instead of describing them in prose.

## What `work-breakdown.md` Must Contain

Write the executable spec in `work-breakdown.md`.

Include:

- A top-level `Hard Rules` section
- `Required Reading` before any work starts
- Phases or PRs with explicit dependency order
- For each phase:
  - Goal
  - Steps
  - Acceptance criteria
  - Expected commit message
  - Validation commands
- A clear statement of what is deterministic and what requires judgment
- A clear statement of what is in scope for the phase and what is deferred

Never leave phase boundaries implied. Never assume the implementer will infer sequencing, commit boundaries, or review checkpoints.

## Deterministic Versus Judgment

Push any repeatable decision into a script, lookup table, command, or explicit rule.

Leave the LLM only the parts that genuinely require judgment, such as:

- prose synthesis
- naming when there is no code-defined name
- summarizing or grouping where the grouping rule is explicit but the wording is not
- handling edge cases that cannot be computed safely

If a choice can be made from code, file paths, diffs, or structured output, make it deterministic and write the rule down.

## Use Explicit Sources

When the task depends on code or generated artifacts, require the author to verify against the source of truth before writing.

For Clawperator, the usual authority files are:

| Topic | Verify against |
|---|---|
| CLI commands, flags, and placement rules | `apps/node/src/cli/registry.ts` |
| Selector behavior | `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts` |
| Action types and parameters | `apps/node/src/contracts/execution.ts` |
| Error codes and meanings | `apps/node/src/contracts/errors.ts` |
| Result envelope shape | `apps/node/src/contracts/result.ts` |
| Doctor checks | `apps/node/src/domain/doctor/checks/` |
| Serve behavior | `apps/node/src/cli/commands/serve.ts` |
| Android operator behavior | `apps/android/` |
| Public docs sources | `docs/`, `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml` |
| Landing site sources | `sites/landing/` |

Adjust the table to match the task. Never tell the implementer to rely on existing docs alone.

## Phase Design

Split non-trivial work into phases and make each phase independently reviewable.

Prefer this structure:

1. Proof or scaffolding phase
2. Core implementation phase
3. Validation or backfill phase
4. Integration or cleanup phase

Use a small proof first when the task is reusable or high risk. Use a stress-test phase later when the task needs to work on harder input. If the task spans multiple PRs, state that the next PR does not start until the previous one is merged.

Keep each phase to one clear deliverable. Do not mix unrelated implementation and cleanup in the same phase unless the work is purely mechanical.

## Acceptance Criteria

Write acceptance criteria in two layers:

- Mechanical acceptance: commands, file checks, output shape, tests, exact commit evidence
- Human review: a short checklist the implementing agent must verify before committing

Make acceptance criteria falsifiable. Avoid phrases like "looks good" or "clean enough."

If the task has output artifacts, define structural idempotency precisely. State what must remain stable across reruns and what may vary.

## Validation

List the exact commands to run, when to run them, and what passing looks like.

If a task changes behavior, include the runnable commands that prove the behavior. If a task touches docs, include the build command. If it touches runtime or device behavior, require the relevant device or emulator validation.

If a task creates or modifies a script, include a test for that script in the same phase. Cover success, invalid input, and missing input when applicable.

## Writing Rules

- Use imperative voice
- Use concrete file paths, commands, and outputs
- Prefer tables over prose for branchy logic
- Name the failure modes the task is designed to prevent
- State what is in scope and what is not
- State what to do with deferred items
- State exact commit messages when commit boundaries matter
- State exact validation commands
- Verify any claim against source files before writing it
- Update durable docs when the task changes public behavior, contracts, or reusable guidance

## Common Failure Patterns to Prevent

- Leaving decisions to the implementer that should be in the task
- Writing from memory or from stale docs instead of code
- Mixing strategy, implementation, and validation into one blob
- Forgetting to define phase boundaries or commit boundaries
- Using vague success criteria
- Omitting required reading
- Failing to distinguish deterministic work from judgment-heavy work
- Under-specifying output shape, especially for task artifacts that will be regenerated
- Hiding cross-surface dependencies instead of naming them
- Treating `findings.md` like a plan file instead of a live audit trail

## Good Task Checklist

Before you consider the task draft done, confirm:

- [ ] The task has a single clear goal
- [ ] Scope and out-of-scope are explicit
- [ ] Required reading is listed
- [ ] Source-of-truth files are listed
- [ ] Deterministic rules are separated from judgment
- [ ] Phases or PRs are explicitly ordered
- [ ] Each phase has goal, steps, acceptance, commit, and validation
- [ ] Mechanical acceptance can be checked without interpretation
- [ ] Human review criteria are short and concrete
- [ ] Deferred items are captured somewhere durable
- [ ] Durable knowledge is sent to the right permanent home
- [ ] The wording is specific enough that a weaker agent can execute it literally

## Clawperator Defaults

When the task touches Clawperator specifically, prefer these references in the plan:

- Android operator APK for device behavior
- Node CLI and contracts for command-surface behavior
- `docs/` and `sites/docs/` for public documentation
- `tasks/` only for temporary execution scaffolding, not durable knowledge

If the task changes a public contract, user-visible runtime behavior, or documented workflow, require code and docs updates in the same task.
