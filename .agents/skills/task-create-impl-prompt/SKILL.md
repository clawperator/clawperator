---
name: task-create-impl-prompt
description: Draft an implementation prompt for one specified PR in an existing task pack.
---

# Task Create Impl Prompt

Return a ready-to-run prompt for exactly one target PR, including all phases
assigned to it. The prompt is a handoff; drafting it does not execute the work.

Infer the task path, target PR, and prerequisites from the request and pack.
Read `plan.md`, the PR/phase mapping in `work-breakdown.md`, and the target
sections. If the target or boundary cannot be established, ask one concise
question rather than inventing scope.

## Prompt Content

Include:

- The target PR's outcome, included phases, and relevant task-pack paths.
- Any prerequisite commit or merge gate that must be satisfied.
- Relevant source paths and non-obvious constraints, without copying the pack
  or repository-wide instructions.
- Completion through implementation, relevant validation, in-scope repairs,
  docs/status updates, and narrow local commits.
- The next PR as a scope boundary: do not implement or scaffold later work.
  Reading later context to understand an interface does not authorize it.
- Any review, push, or merge step already requested by the user or required by
  the active task pack. Otherwise finish with local commits.

Specify phase order where dependencies require it. Let the implementing agent
make routine choices within the scope. Do not force a reading itinerary or
draft/refinement commits.

## Reviews

Do not add a review swarm or a skill dependency by default. If a review workflow
is requested or required by the pack, reference its available skill by path and
scope it to the target PR's paths or diff. Define completion using that
workflow's stopping rule. Later-PR findings remain follow-up; they do not expand
the target scope.

## Example Shape

```text
Implement <task pack> <target PR>: <outcome>.

Scope: <included phases and owning paths>.
Prerequisite: <actual dependency, if any>.
Context: <plan and target sections; relevant source paths with their purpose>.

Complete implementation, docs, and <validation>, fix in-scope failures, update
target-PR status, and commit validated work. <Required review workflow, if any.>

Stop when this PR's acceptance criteria and required checks are satisfied.
Do not implement <next PR>. Report any external blocker and what remains unproven.
```

Return only the finished prompt unless the user requests explanation.
