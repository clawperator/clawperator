---
name: task-create-impl-prompt
description: Create concise implementation prompts for executing one specified PR from a task pack, especially Clawperator task packs with multiple PRs and phases. Use when a user asks for an agent prompt to implement PR-1, PR-2, another named PR, or the next PR from `tasks/**/plan.md` and `tasks/**/work-breakdown.md` without accidentally advancing into later PRs.
---

# Task Create Impl Prompt

Draft an implementation prompt for another agent. The prompt must execute exactly one specified PR from a task pack, including all phases assigned to that PR, and must not allow work from later PRs.

## Agents Metadata

`agents/openai.yaml` is UI metadata for skill lists and default prompting. It is not an extra workflow document and it does not override `SKILL.md`.

Keep it aligned with this skill:

- `display_name` should stay human-readable.
- `short_description` should describe the real job of the skill.
- `default_prompt` should ask for one specified PR, not a whole task pack.
- When the boundary contract in this file changes materially, update `agents/openai.yaml` in the same change.

## Inputs

Require or infer:

- Task pack path, usually `tasks/<area>/<task>/`
- Target PR, such as `PR-1`
- Any prerequisite commit, merge state, or landed commit named by the user

If the target PR cannot be inferred, ask one short clarifying question. Do not draft a prompt that says "continue through all phases" unless the task pack is explicitly a single-PR task.

## Context Workflow

Build enough context to identify the PR boundary before writing the prompt:

1. Read the task pack `plan.md`.
2. Read the task pack `work-breakdown.md`.
3. Locate the `PR / Phase Plan` or equivalent sequencing table.
4. Identify only the phases included in the target PR.
5. Identify the first phase or PR that comes after the target PR, so the generated prompt can name the exact stop point.
6. Check whether the target PR has a merge gate or prerequisite.
7. If task structure is ambiguous, tell the user what is ambiguous instead of guessing.

Do not repeat the full task pack in the generated prompt. Include file paths and the exact context-building order so the implementation agent can rebuild context from source. It is fine for the implementation agent to read the sequencing table to understand the boundary, but the generated prompt must not ask it to read, prepare, pre-edit, or opportunistically implement later-PR phase sections.

## Prompt Requirements

The generated prompt must say:

- Implement only `<target PR>`.
- Complete each phase assigned to `<target PR>` one at a time.
- After each phase, run that phase's validation, fix failures, update task status if the task pack requires it, and commit before starting the next phase.
- Task status updates, if any, are limited to marking target-PR phase progress and must not mark later PRs as started or done.
- Do not start, scaffold, partially implement, validate, or review any phase assigned to a later PR.
- If any PR remains after `<target PR>`, stop after the target PR review loop clears and report that the next PR is blocked until the user asks or the merge gate is satisfied.
- Use branch-local tooling and repo-specific validation rules named by the task pack.
- Verify claims against source code before editing when the task pack references code contracts.
- Preserve user changes and keep commits narrow and conventional.

If the task pack says a phase requires an existing skill, reference the skill path in the generated prompt. Do not restate that skill's full workflow.

## Review Loop Requirement

The generated prompt must require `$review-swarm-loop` after all target-PR phases are implemented, validated, and committed.

Scope the loop to the target PR's durable implementation and docs paths, not the whole multi-PR task pack unless the target PR genuinely touched the whole scope.
The scope must be expressed as explicit paths or path groups derived from the target PR phases. Exclude later-PR-only paths even when they appear in the same task pack. If the target PR paths cannot be determined, the generated prompt must tell the implementation agent to stop and ask before running the loop.

Say that the implementation agent must:

1. Run `$review-swarm-loop` for `<target PR>` only, using the explicit target-PR path scope.
2. Fix all actionable findings in the main agent.
3. Validate each fix pass.
4. Commit each successful fix pass.
5. Repeat until the loop reports no material findings for the target-PR scope.

The prompt must not instruct the agent to run the review loop only after all PRs in the task pack are complete, unless the target PR is the final PR.
Review findings that would require implementing a later PR are out of scope for the target PR. The generated prompt should tell the implementation agent to record them as remaining risks or follow-up, then stop rather than crossing the PR boundary.

## Output Shape

Return only the prompt, unless the user asked for commentary.

Use this structure:

```text
You are implementing <task pack> <target PR> only.

Prerequisite:
- <landed commit or merge gate, if any>

Goal:
Implement <target PR>: <purpose>. This PR includes only: <phase ids and titles>.

Hard boundary:
- Do not implement <later PRs or later phases>.
- Do not scaffold, partially prepare, validate, or review later-PR work.
- Stop after <target PR> is validated, committed, and review-swarm-loop clears for the target-PR scope.

Context-building order:
1. Read <task pack>/plan.md.
2. Read <task pack>/work-breakdown.md.
3. Confirm the PR / Phase Plan maps <target PR> to <phase ids> and identify <next PR or next phase> as the stop boundary.
4. Read only the target-PR phase sections, files named by those phases, and directly referenced source-of-truth files.
5. Do not read later-PR phase sections except to confirm the boundary.

Operating rules:
- <repo and task constraints>

Execution:
1. For each phase in <target PR>, in order:
   - implement only that phase
   - run phase validation
   - fix failures
   - update task status only for that phase if the task pack requires it
   - commit the phase before moving on
2. After the final <target PR> phase commit, run $review-swarm-loop scoped to <explicit target-PR paths>.
3. Fix, validate, and commit review-loop findings until clean for that scope.
4. If a review finding requires <next PR or later-PR work>, record it as out of scope and stop.
5. Stop. Do not start <next PR>.
```

Keep the final prompt concise. Prefer sharp boundaries over broad summaries.
