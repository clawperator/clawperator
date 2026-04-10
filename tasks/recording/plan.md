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

## Hard Rules

- Do not start compare implementation before `skill-result-contract/` lands.
- Do not treat compare as the fix for replay reliability.
- Do not graduate temporary demo notes into docs until the durable wording is
  stable enough to survive the contract work.
- Do not create `.agents/skills/skill-author-by-recording/` yet.

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
