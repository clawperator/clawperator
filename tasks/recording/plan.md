# Recording Workstreams

## Purpose

This file is the top-level orchestration plan for the recording-related work in
`tasks/recording/`.

Use it to understand:

- why the work expanded beyond one Solax skill
- which task packs exist
- the order they should run
- which packs are active, blocked, or downstream

This file is the entrypoint. The sub-task packs hold the executable detail.

## Current Goal

Turn the Solax recording effort into a truthful proving case, then use that
proving case to build the missing skill-layer contract and only then implement
recording-versus-run compare.

## Why This Exists

The original task was to create one Solax skill from a recording.

That work succeeded enough to expose a broader problem:

- recordings are evidence, not executable skills
- non-trivial skills need truthfulness and terminal verification
- the brain/hand split is not real at the skill boundary yet because skills
  return opaque stdout, not structured results
- compare is useful, but it is downstream of a proper skill-level contract

So this subtree now contains multiple linked workstreams rather than one task.

## Workstreams

| Order | Task Pack | State | Purpose |
| --- | --- | --- | --- |
| 0 | `brain-hand-contract/` | active reference | problem definition and architectural framing |
| 1 | `skill-checkpoints/` | next | make Solax truthful and checkpointed enough to trust |
| 2 | `skill-result-contract/` | ready after 1 | define `SkillResult` and make skills legible to the brain |
| 3 | `skill-contract-declaration/` | blocked on 2 | declare inputs, goal, and verification in `skill.json` |
| 4 | `compare/` | blocked on 2 | compare recording baseline against emitted `SkillResult` |
| 5 | `graduate-demo-findings/` | blocked on 1/2 shape settling | move durable lessons into docs and retire temp files |

## Required Sequence

1. Finish `skill-checkpoints/`
2. Finish `skill-result-contract/`
3. Start `skill-contract-declaration/`
4. Start `compare/`
5. Run `graduate-demo-findings/`

## Preferred PR Grouping

Group work into as few PRs as is reasonable, but do not hide repo boundaries or
mix unrelated risk levels just to reduce count.

### PR-1: W1 skill truthfulness

Scope:

- `tasks/recording/skill-checkpoints/` P1 and P2
- Solax implementation changes in `../clawperator-skills`

Why grouped:

- this is one coherent behavior fix
- Solax should become truthful in one reviewable step

Keep separate from:

- generalized docs changes in this repo, unless they remain very small and are
  already proven by the Solax fix

### PR-2: W1 durable authoring guidance

Scope:

- `tasks/recording/skill-checkpoints/` P3
- small update to `docs/skills/authoring.md`

Why separate by default:

- different repo
- much lower risk than the live Solax behavior change
- can merge quickly once the Solax proof is stable

Acceptable collapse:

- if the docs wording is tiny and directly tied to the same validated Solax
  change, folding this into the same overall review cycle is acceptable

### PR-3: W2 skill result contract in Clawperator

Scope:

- `tasks/recording/skill-result-contract/` P1 and P2
- contract definition
- `runSkill` parsing
- tests

Why grouped:

- contract shape and parser/tests should land together
- splitting these creates churn without reducing much risk

### PR-4: W2 Solax contract retrofit

Scope:

- `tasks/recording/skill-result-contract/` P3
- Solax `SkillResult` emission in `../clawperator-skills`

Why separate:

- different repo
- depends on PR-3 contract shape being real

### PR-5: W2 downstream handoff updates

Scope:

- `tasks/recording/skill-result-contract/` P4
- any task-pack alignment needed after the contract lands

Why usually small:

- planning/documentation follow-through only

Acceptable collapse:

- if PR-3 leaves the task packs obviously aligned already, this can be folded
  into PR-3 instead of standing alone

### PR-6: W3 contract declaration

Scope:

- `tasks/recording/skill-contract-declaration/` P1 and P2 in this repo
- `tasks/recording/skill-contract-declaration/` P3 in `../clawperator-skills`

Recommended split:

- one Clawperator PR for scaffold/runtime support
- one skills-repo PR for Solax declaration proof

### PR-7: W4 compare

Scope:

- `tasks/recording/compare/` P1 through P4

Recommended grouping:

- one Clawperator PR for compare model, implementation, tests, and docs
- one small skills-repo PR only if Solax proving support needs a runtime change

Default preference:

- do not split compare into many PRs unless the implementation grows more than
  expected

### PR-8: W5 graduate demo findings

Scope:

- `tasks/recording/graduate-demo-findings/` P1 and P2

Why grouped:

- this is cleanup and docs graduation
- it should usually be a single small PR

## Hard Rules

- Do not start compare implementation before `skill-result-contract/` lands.
- Do not treat compare as the fix for replay reliability.
- Do not graduate temporary demo notes into docs until the durable wording is
  stable enough to survive the contract work.
- Do not create `.agents/skills/skill-author-by-recording/` yet.
- Prefer bundling closely related phases into one PR when they share the same
  repo, risk level, and validation story.
- Prefer separate PRs when the work crosses repos, changes runtime contracts, or
  mixes live device behavior changes with lower-risk docs-only follow-up.

## What Each Pack Owns

### `brain-hand-contract/`

Owns:

- architectural problem definition
- recommended multi-stage path forward

Does not own:

- implementation

### `skill-checkpoints/`

Owns:

- Solax `v0` integrity fixes
- failure propagation truthfulness
- terminal-state verification
- safer save sequencing

Does not own:

- compare
- generalized skill runtime contracts

### `skill-result-contract/`

Owns:

- skill-level `SkillResult`
- `runSkill` parsing/support
- Solax retrofit to emit structured results

Does not own:

- declarative `skill.json` goal/verification block
- compare implementation

### `skill-contract-declaration/`

Owns:

- optional `contract` block in `skill.json`
- scaffold/runtime follow-up for declaration

### `compare/`

Owns:

- diagnosing first meaningful divergence between recording baseline and skill
  result

Does not own:

- replay reliability
- skill truthfulness

### `graduate-demo-findings/`

Owns:

- moving durable knowledge from demo task files into docs
- retiring temporary recording demo files

## Current Recommendation

If an agent is picking up work from this subtree and needs the next thing to
execute, start with:

- `tasks/recording/skill-checkpoints/plan.md`
- `tasks/recording/skill-checkpoints/work-breakdown.md`

If an agent is trying to understand the bigger "why", start with:

- `tasks/recording/brain-hand-contract/problem-definition.md`

## Cleanup Rule

When the durable docs and contract work are landed:

- `demo/` should be deleted
- `brain-hand-contract/` can be deleted once its content is fully superseded by
  docs and task history
- this top-level `plan.md` can be deleted once no active recording workstreams
  remain
