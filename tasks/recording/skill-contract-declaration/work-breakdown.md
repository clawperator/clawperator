# Work Breakdown

## Execution Summary

- This task starts only after `tasks/recording/skill-result-contract/` lands.
- Keep the schema narrow: enough to declare intent and verification, not a full
  policy language.
- Use Solax as the proving case, but keep the declaration generic.

## Hard Rules

- Do not require the new `contract` block for all existing skills.
- Do not let the declaration drift away from what `SkillResult` can actually
  prove.
- Do not fold compare logic into this task.

## Required Reading

- `tasks/recording/brain-hand-contract/problem-definition.md`
- `tasks/recording/skill-result-contract/plan.md`
- `docs/skills/authoring.md`
- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/domain/skills/runSkill.ts`

## Phase Plan

### P1. Define the declaration shape

- Tier: `thinking`
- Requirements:
  - define `contract.inputs`
  - define `contract.goal`
  - define `contract.verification`
  - keep v1 compatible with the existing registry model

### P2. Implement scaffold and runtime support

- Tier: `default`
- Requirements:
  - update scaffold output
  - update runtime validation/cross-checking
  - add test coverage for declared, missing, and mismatched verification

### P3. Prove with Solax

- Tier: `default`
- Requirements:
  - declare the Solax contract in `skill.json`
  - live-verify that the declaration and emitted `SkillResult` agree

