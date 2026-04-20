---
name: task-author-review
description: Review an in-progress task pack under tasks/ from first principles, treating code as the source of truth. Use when an agent needs to audit plan.md, work-breakdown.md, findings.md, or companion task files for gaps, weak assumptions, missing rollout steps, contract risks, or places where the task pack does not fit the current Clawperator implementation, and is allowed to tighten or edit the task pack directly.
---

# Task Author Review

Review active task packs critically and tighten them in place.

This skill is the companion to `task-author`. `task-author` creates executable
task packs. `task-author-review` stress-tests them before implementation runs
too far on a weak assumption.

Run: `$task-author-review <task-path>`

`<task-path>` is the task folder path relative to the repo root, such as:

- `tasks/node/api-refactor`
- `tasks/docs/version-surface`
- `tasks/api/doctor-enhancements`

If no path is given, list current task folders and ask which one to review.

## Core Model

Treat the task pack as a draft contract, not as truth.

Your job is to determine whether a weaker implementing agent could execute the
task pack literally without drifting from the actual codebase.

Assume the task pack may contain:

- stale assumptions
- architecture guesses not verified against code
- missing rollout steps
- ambiguous authority boundaries
- incomplete validation guidance
- a recommendation that is directionally right but not yet implementation-ready

The code is the source of truth. The task pack must earn alignment with it.

## Review Lens

Review from first principles:

- What problem is this task pack really trying to solve?
- What is the narrowest correct abstraction boundary?
- Which surface should own the behavior?
- Which contract should be canonical?
- What would fail if a weaker agent followed this task pack literally?

Prefer:

- one canonical authority over duplicated logic
- deterministic rules over narrative guidance
- source-owned contracts over doc-derived assumptions
- explicit rollout order over "then update the rest"
- fail-closed behavior when readiness or contract state is ambiguous

## Agents Metadata

`agents/openai.yaml` is UI metadata for skill lists and default prompting. It is
not an extra workflow document and it does not override `SKILL.md`.

Keep it aligned with this skill:

- `display_name` should stay human-readable
- `short_description` should describe the real job of the skill
- `default_prompt` should point the agent at the actual workflow in this file

When `SKILL.md` meaning changes materially, update `agents/openai.yaml` in the
same change.

## What To Review

Read every file in the task folder that exists, including:

- `plan.md`
- `work-breakdown.md`
- `findings.md`
- `finalization-items.md`
- any task-specific companion prompts or design files

Do not stop at the task pack itself. Verify the task pack against the actual
implementation.

## Code Is The Source Of Truth

Before accepting any technical claim in the task pack, inspect the relevant
code.

Use this authority table as the default starting point:

| Topic | Verify against |
| --- | --- |
| CLI commands, flags, aliases | `apps/node/src/cli/registry.ts` |
| Selector flags and behavior | `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts` |
| Action types and parameters | `apps/node/src/contracts/execution.ts` |
| Error codes and meanings | `apps/node/src/contracts/errors.ts` |
| Result envelope | `apps/node/src/contracts/result.ts` |
| Doctor checks and readiness | `apps/node/src/domain/doctor/checks/`, `apps/node/src/domain/doctor/DoctorService.ts` |
| Execution preflight and runtime | `apps/node/src/domain/executions/` |
| Skills runtime and wrapper | `apps/node/src/domain/skills/`, `apps/node/src/cli/commands/skills.ts` |
| Android operator behavior | `apps/android/` |
| Public authored docs | `docs/` |
| Repo-local skills | `.agents/skills/` |

If the task concerns a different surface, expand the table for that task. Do
not rely on existing docs alone when code is available.

## Workflow

1. Read the full task pack.
   - Identify the task's intended outcome, claimed architecture, rollout shape,
     validation plan, and authority boundaries.
2. Inspect the code before judging the recommendations.
   - Verify every major claim against the real implementation.
3. Identify gaps.
   - Look for missing steps, incorrect boundaries, duplicated authorities,
     unclear ownership, contract mismatches, incomplete validation, and missing
     docs or test implications.
4. Tighten the task pack directly.
   - Edit the files in place so the next implementing agent gets a sharper and
     more faithful contract.
5. Summarize what changed.
   - Report the most important gaps found, what you edited, and any remaining
     open questions that still need user input.

## Gap Checklist

Use this list on every review:

- Does the task pack identify the correct owning surface?
- Does it name one canonical source of truth, or does it imply multiple
  authorities?
- Does it distinguish clearly between public API, internal-only seams, CLI
  behavior, Android runtime behavior, docs behavior, and task scaffolding?
- Does it include the real rollout order, or does it jump straight to the end
  state?
- Does it capture validation at the same level as the intended change?
- Does it name stable contracts and error codes where needed?
- Does it describe how the task affects docs, tests, and follow-up cleanup?
- Could a weaker implementing agent execute it literally without inventing
  missing policy?

## What Good Edits Look Like

Good edits:

- remove claims not supported by code
- narrow advice until it matches the implementation seams
- add missing rollout steps
- add explicit validation commands
- separate stable decisions from optional future ideas
- fence off what is in scope versus out of scope
- turn vague prose into deterministic instructions or lookup tables

Weak edits:

- preserving nice-sounding architecture language that the code does not support
- adding more prose without closing ambiguity
- leaving "update docs" or "handle edge cases" as unspecified follow-up
- treating a findings file like final truth when the code says otherwise

## Editing Rules

- Tighten the existing task pack instead of writing an external critique memo.
- Prefer small, high-signal edits over sprawling rewrites unless the task pack
  is structurally wrong.
- Keep the task pack executable by another agent.
- If the task pack includes durable findings, keep them task-scoped. Do not
  silently migrate them into permanent docs during review unless the user asked
  for implementation work.

## When To Escalate

Stop and surface an open question instead of guessing when:

- the right owning surface is genuinely ambiguous
- two implementation paths have materially different contract consequences
- the codebase contains conflicting signals and you cannot establish which one
  is authoritative
- the task pack would need a scope change, not just a tightening pass

## Output

After the review, report:

- the top gaps you found
- the task-pack files you edited
- any open question that still requires user direction

If no meaningful gaps remain, say so explicitly and note any residual risks.
