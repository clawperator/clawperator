# Skill Contract Declaration

## Executive Summary

Add an optional declarative `contract` block to `skill.json` so a skill's
inputs, goal, and verification are machine-readable before runtime. This builds
on the skill result contract and lets the runtime cross-check what a skill
claimed it would verify against what it actually verified.

This is downstream of `tasks/recording/skill-result-contract/` and should not
start until the runtime can parse `SkillResult`.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 2 |
| Total phases | 3 |
| Completed | none |
| Remaining | P1, P2, P3 |
| Current / Next | blocked on W2 |
| Blockers | `tasks/recording/skill-result-contract/` must land first |

## Goal

Make skill intent and verification declarative enough that the runtime can
reason about what a non-trivial skill promised to do before and after it runs.

## Why Now

The brain/hand contract problem definition showed that `skill.json` is registry
metadata today, not a real contract. Once `SkillResult` exists, the next step is
to declare what the skill intended and verified so `runSkill` can detect "honest
output but missing proof" as `indeterminate` rather than silently treating it as
success.

## In Scope

- add an optional `contract` block to `skill.json`
- define `inputs`, `goal`, and `verification` structure for v1
- update scaffolding to emit an empty/starter `contract` block
- cross-check declared verification against emitted `SkillResult`
- declare the contract for the Solax skill as the proving case

## Out of Scope

- making `contract` mandatory for all skills
- broad retrofit of existing skills
- compare implementation
- runtime observation primitive work

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/src/domain/skills/` | Clawperator repo | scaffold + runtime enforcement |
| `apps/node/src/test/` | Clawperator repo | contract declaration tests |
| `../clawperator-skills/` | Skills repo | Solax declaration proving case |
| `tasks/recording/skill-contract-declaration/` | Clawperator repo | temporary execution contract |

## Decision Rules

- `contract` is optional for legacy skills in v1.
- If `contract.verification` exists, missing or failed proof in `SkillResult`
  must not be treated as plain success.
- Keep the first version narrow and boring. Solax is the proving case, not the
  schema for every future skill type.

## Output Contract

This task should produce:

- an optional `contract` block shape in `skill.json`
- scaffold support for the block
- runtime cross-checking of declared verification against emitted `SkillResult`
- Solax `skill.json` updated to declare its contract

