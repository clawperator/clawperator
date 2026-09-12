---
name: task-author
description: Create or revise plan.md and work-breakdown.md handoffs when the user asks for a task pack.
---

# Task Author

Write a task pack that lets another capable agent complete the requested work.
Capture decisions it cannot infer from code: the outcome, scope, dependencies,
acceptance evidence, and where to stop. Do not implement the planned work unless
the user also requested implementation.

## Task Shape

Use the user's path when supplied. Otherwise prefer
`tasks/android/<task-name>/`, `tasks/node/<task-name>/`, or
`tasks/docs/<task-name>/` for work owned by that surface, and
`tasks/<task-name>/` for cross-surface work. Use descriptive kebab-case names.

Keep `plan.md` for the stable goal and decisions; use `work-breakdown.md` for
execution and progress. A small requested pack can have two short files.
Do not reject an explicit task-pack request merely because the work is small,
or turn an ordinary implementation request into unsolicited planning.

Inspect relevant code and active task context before committing to technical
claims. Consult deleted packs in git history only when they resolve a concrete
question about structure or prior decisions.

## Content

The pack should make these points clear without duplicating them across files:

- The intended behavior or deliverable, why it matters, and current status.
- Scope, including what existing content may change and what is excluded.
- Owning source files, required inputs, and any decisions still unresolved.
- Acceptance criteria that prove behavior, plus relevant validation commands.
- Required docs changes and the permanent home for durable findings.
- For sequenced work, phase-to-PR mapping, actual dependencies, merge gates,
  and the scope the implementing agent is authorized to complete.

Use phases when they improve execution or review. Add merge gates only for real
dependencies or requested review points. Keep behavior, its tests, and relevant
docs together. Do not prescribe model tiers, exact commit messages, fixed
reading orders, or repeated draft passes unless the task needs them.

For a complex or multi-PR handoff, consult
[references/task-pack-shapes.md](references/task-pack-shapes.md) for optional
templates and dependency guidance. Short packs do not need every section.

## Evidence and Completion

Point to relevant source files with a reason to read each. Reuse repository
skills by path when they apply, including `docs-author` for authored docs;
do not copy their procedures into the task pack.

Name the cases that matter for new behavior or a demonstrated regression.
Choose checks for the changed surfaces from `AGENTS.md`. When live verification
has host or device prerequisites, state them and distinguish what offline tests
prove from what still requires a live run.

Define done as completing the scoped implementation, checking the result,
fixing in-scope failures, updating docs/status, and committing validated logical
units. Preserve explicit user review gates, but do not add a pause after the
first draft or require a review swarm by default.

Create companion files only when useful. `findings.md` can hold execution
evidence; `finalization-items.md` can track deferred work with a reason,
destination, and next action. Avoid empty scaffolds and invented findings.

Before returning, check that the two files agree on scope, status, dependencies,
and completion. Resolve routine choices from evidence; ask only for a missing
decision that materially changes the task. Return links to the finished pack
and any remaining decision.
