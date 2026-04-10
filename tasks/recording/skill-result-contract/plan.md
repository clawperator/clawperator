# Skill Result Contract

## Executive Summary

Define a skill-level result contract so the brain can reason about a skill run
as more than an opaque stdout blob. This is the load-bearing interface change
that turns checkpoints, terminal verification, and compare output into
structured, consumable data instead of private script conventions.

Use the Solax skill as the first proving case, but keep the contract generic.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1, P2, P3, P4 |
| Current / Next | P1 |
| Blockers | none |

## Goal

Introduce a skill-level `SkillResult` contract and retrofit the Solax skill to
emit it, so the brain can read goals, checkpoints, terminal verification, and
embedded exec outcomes directly.

## Why Now

Current code verified in the repo shows:

- `runSkill` returns `{ ok, output: string, exitCode }`
- skill stdout is the skill-to-brain channel
- `ResultEnvelope` is exec-level only
- skill scaffolding has no declared goal or verification contract

That is the actual brain/hand gap. Without a skill-level contract, reliability
work produces honest black boxes and compare work has to do forensic
reconstruction.

## In Scope

- define `SkillResult`
- decide how a skill emits it robustly
- make `runSkill` parse and return it compatibly with legacy skills
- embed exec-level evidence inside the skill-level result
- retrofit the Solax skill to emit the new shape
- create test fixtures and tests in the Clawperator repo

## Out of Scope

- broad retrofit of all existing skills
- compare implementation itself
- new observation primitives unless the contract work proves they are necessary
- authoring a repo-local `skill-author-by-recording` skill

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/src/contracts/` | Clawperator repo | `SkillResult` contract |
| `apps/node/src/domain/skills/` | Clawperator repo | parsing, runtime, compatibility |
| `apps/node/src/test/` | Clawperator repo | fixtures and regression tests |
| `../clawperator-skills/` | Skills repo | Solax retrofit proving case |
| `tasks/recording/skill-result-contract/` | Clawperator repo | temporary execution contract |

## Source Of Truth

| Area | Source |
| --- | --- |
| Exec envelope | `apps/node/src/contracts/result.ts` |
| Current skill runtime | `apps/node/src/domain/skills/runSkill.ts` |
| Current authoring contract | `docs/skills/authoring.md` |
| Brain/hand framing | `tasks/recording/brain-hand-contract/problem-definition.md` |

## Decision Rules

- Introduce a new skill-level contract instead of overloading `ResultEnvelope`.
- Keep `runSkill` backward compatible for legacy skills that emit plain stdout.
- Prefer an explicit framed skill result over “best effort parse last stdout
  line” if the implementation cost is reasonable.
- The contract must carry:
  - goal
  - status
  - checkpoints
  - terminal verification
  - embedded exec evidence
- Solax is the first opt-in proving skill, not the template for every field.

## Failure Modes To Prevent

- inventing a contract too abstract to retrofit onto a real skill
- breaking legacy skills while adding structured results
- extending exec-level `ResultEnvelope` to carry skill semantics
- forcing compare to invent a second overlapping trace format

## Output Contract

This task should produce:

- a defined `SkillResult` contract
- `runSkill` support for parsing and returning it
- test coverage using local fixtures only
- a Solax skill that emits `SkillResult`

## Durable Follow-Up

This work should later feed:

- `tasks/recording/compare/`
- `docs/skills/authoring.md`
- future `skill.json` goal/verification declaration work

