# Task Pack Shapes

Use these as optional starting points. Keep only sections that help execute the
task; a small pack needs less structure than a cross-surface rollout.

## Compact Pack

`plan.md`:

```markdown
# <Task title>

## Goal and Scope
<Problem, expected outcome, owning surface, exclusions.>

## Status
<Current state and any blocking prerequisite.>

## Decisions and Sources
<Non-obvious decisions and authoritative paths with reasons to consult them.>

## Acceptance
<Observable behavior and durable outputs that establish completion.>
```

`work-breakdown.md`:

```markdown
# <Task title> Work Breakdown

Plan: [plan.md](plan.md)

## Work
<Implementation and documentation needed for this scope.>

## Validation
<Commands, meaningful cases, expected evidence, and live prerequisites.>

## Completion
<Finish the scope, fix in-scope failures, update status, and commit validated work.>
```

## Multiple PRs

Use a sequencing table when work has distinct PR boundaries:

| PR | Outcome | Included phases | Dependency or merge gate | Status |
| --- | --- | --- | --- | --- |
| PR-1 | <outcome> | <phases> | <actual prerequisite, or none> | <state> |
| PR-2 | <outcome> | <phases> | <why PR-1 must land first, if applicable> | <state> |

For each phase, describe the outcome, affected paths, acceptance evidence, and
validation. Include a fixed sequence only where ordering affects correctness.
State which PR the current handoff authorizes; a dependency becoming available
does not itself authorize later work.

Keep completed entries marked `[DONE]` until the final PR ships. Update the
current/next status without marking later PRs started. Route durable decisions
to named docs, skills, or source files before retiring the pack.

## Conditional Detail

- For repeated outputs, link one relevant exemplar and explain the useful
  property, such as parameter semantics or output format. Length is not a
  quality target.
- For rerunnable generation or backfills, specify stable identifiers, overwrite
  behavior, and how partial completion is detected.
- For synthesis or measurements, describe the evidence worth retaining in
  `findings.md`; keep private raw transcripts out of commits.
- For deferred work, record what remains, why, and its destination and next step.
- For risky changes, identify failure modes and recovery constraints. A simple
  edit does not need an exhaustive risk inventory.
