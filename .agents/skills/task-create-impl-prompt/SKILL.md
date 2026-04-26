---
name: task-create-impl-prompt
description: Create concise implementation prompts for executing one specified PR from a task pack, especially Clawperator task packs with multiple PRs and phases. Use when a user asks for an agent prompt to implement PR-1, PR-2, another named PR, or the next PR from `tasks/**/plan.md` and `tasks/**/work-breakdown.md` without accidentally advancing into later PRs.
---

# Task Create Impl Prompt

Draft an implementation prompt for another agent. The prompt must execute exactly one specified PR from a task pack, including all phases assigned to that PR, and must not allow work from later PRs.

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
5. Check whether the target PR has a merge gate or prerequisite.
6. If task structure is ambiguous, tell the user what is ambiguous instead of guessing.

Do not repeat the full task pack in the generated prompt. Include file paths and the exact context-building order so the implementation agent can rebuild context from source.

## Prompt Requirements

The generated prompt must say:

- Implement only `<target PR>`.
- Complete each phase assigned to `<target PR>` one at a time.
- After each phase, run that phase's validation, fix failures, update task status if the task pack requires it, and commit before starting the next phase.
- Do not start any phase assigned to a later PR.
- If more than one PR remains after `<target PR>`, stop after the target PR review loop clears and report that the next PR is blocked until the user asks or the merge gate is satisfied.
- Use branch-local tooling and repo-specific validation rules named by the task pack.
- Verify claims against source code before editing when the task pack references code contracts.
- Preserve user changes and keep commits narrow and conventional.

If the task pack says a phase requires an existing skill, reference the skill path in the generated prompt. Do not restate that skill's full workflow.

## Review Loop Requirement

The generated prompt must require `$review-swarm-loop` after all target-PR phases are implemented, validated, and committed.

Scope the loop to the target PR's durable implementation and docs paths, not the whole multi-PR task pack unless the target PR genuinely touched the whole scope.

Say that the implementation agent must:

1. Run `$review-swarm-loop`.
2. Fix all actionable findings in the main agent.
3. Validate each fix pass.
4. Commit each successful fix pass.
5. Repeat until the loop reports no material findings.

The prompt must not instruct the agent to run the review loop only after all PRs in the task pack are complete, unless the target PR is the final PR.

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
- Stop after <target PR> is validated, committed, and review-swarm-loop clears.

Context-building order:
1. Read <task pack>/plan.md.
2. Read <task pack>/work-breakdown.md.
3. Confirm the PR / Phase Plan maps <target PR> to <phase ids>.
4. Read only files named by those phases and directly referenced source-of-truth files.

Operating rules:
- <repo and task constraints>

Execution:
1. For each phase in <target PR>, in order:
   - implement only that phase
   - run phase validation
   - fix failures
   - commit the phase before moving on
2. After the final <target PR> phase commit, run $review-swarm-loop scoped to <paths>.
3. Fix, validate, and commit review-loop findings until clean.
4. Stop. Do not start <next PR>.
```

Keep the final prompt concise. Prefer sharp boundaries over broad summaries.
