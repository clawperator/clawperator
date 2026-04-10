# Work Breakdown

## Execution Summary

- This is the central contract task for the brain/hand gap.
- Do this after `skill-checkpoints` makes Solax truthful and before compare is
  implemented.
- Keep the implementation backward compatible for existing skills.

## Hard Rules

- Do not extend `ResultEnvelope` to carry skill semantics.
- Do not make tests depend on a live device or on `../clawperator-skills/` at
  runtime.
- Do not add `clawperator exec --trace` as a parallel mechanism.
- Do not require all existing skills to adopt the contract immediately.

## Required Reading

- `tasks/recording/brain-hand-contract/problem-definition.md`
- `apps/node/src/contracts/result.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `docs/skills/authoring.md`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/scripts/run.js`

## Phase Plan

### P1. Define the contract

- Tier: `thinking`
- Requirements:
  - define `SkillResult`
  - decide how it is emitted:
    - explicit frame
    - last-line JSON
    - sidecar file
  - define backward compatibility behavior for legacy skills

### P2. Implement runtime parsing

- Tier: `default`
- Requirements:
  - update `runSkill` to parse and return `SkillResult`
  - keep old fields available for legacy callers where needed
  - add failing tests first

### P3. Retrofit Solax as the first proving skill

- Tier: `default`
- Requirements:
  - emit `SkillResult` from the Solax skill
  - include checkpoints and terminal verification
  - keep the retrofit narrow and honest about device/layout dependence

### P4. Prepare downstream handoff

- Tier: `default`
- Requirements:
  - update the compare task to consume `SkillResult`
  - note any follow-on work for `skill.json` goal/verification declaration

## Validation Expectations

- `npm --prefix apps/node run build`
- `npm --prefix apps/node run test`
- local fixture-driven contract tests only
- live Solax proof after retrofit to ensure emitted `SkillResult` matches real
  behavior
