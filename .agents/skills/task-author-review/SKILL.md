---
name: task-author-review
description: Review an active task pack against current code and tighten its plan when editing is requested.
---

# Task Author Review

Check whether a task pack gives another agent enough evidence and scope to
deliver the intended outcome. Use the task path from the request or context;
ask only if the target remains ambiguous.

Read the plan, work breakdown, and companion files relevant to the requested
review. Verify technical assumptions against the implementation that owns
them. Task notes and existing docs are evidence to check, not authority over code.

## Review Criteria

Focus on gaps that would change the result:

- Wrong ownership, duplicated authorities, or an unsupported runtime assumption.
- Missing inputs, contract decisions, dependencies, or PR boundaries.
- Acceptance criteria that exercise code without proving intended behavior.
- Missing tests or live checks for changed behavior, including their prerequisites.
- Public behavior changes without corresponding authored docs and regeneration.
- Durable findings with no home after the temporary task pack is removed.
- Overbroad reading, testing, model-selection, or approval requirements that
  add work without protecting an actual constraint.

Use `AGENTS.md` for source routing and validation. Inspect only the source
areas needed to assess the plan. Do not demand extra sections or a literal
recipe when the outcome, evidence, and boundaries are already clear.

## Edits and Boundaries

For a review-only request, report findings without editing. When asked to
tighten or fix the pack, make focused edits in place and check that the plan,
work breakdown, and prompts still agree.

Resolve routine choices from evidence. Surface a question when unresolved
alternatives materially change scope, public contracts, or rollout risk;
continue independent review work. Do not implement the feature or migrate
task-scoped findings into permanent docs unless that work is requested.

Report material gaps, files changed if any, and remaining decisions or risks.
If no material gaps remain, say so.
