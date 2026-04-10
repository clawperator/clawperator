# Skill Result Contract Work Breakdown

Parent plan: `tasks/recording/skill-result-contract/plan.md`

## Executive Summary

Total PRs: 2. Total phases: 4.

- PR-1: contract definition, runtime parsing, tests
- PR-2: Solax retrofit and downstream handoff update

Current state: ready after `tasks/recording/skill-checkpoints/` lands.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1, P2, P3, P4 |
| Current / Next | P1 after W1 |
| Blockers | `tasks/recording/skill-checkpoints/` should land first |

## Hard Rules

- Do not extend `ResultEnvelope` to carry skill semantics.
- Do not make tests depend on a live device or on `../clawperator-skills/` at runtime.
- Do not add `clawperator exec --trace` as a parallel mechanism.
- Do not require all existing skills to adopt the contract immediately.
- Put the contract tests in the same phase and commit as the runtime parsing changes.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/skill-result-contract/plan.md` | Stable contract scope and boundaries |
| `tasks/recording/brain-hand-contract/problem-definition.md` | Architectural framing and recommended sequencing |
| `apps/node/src/contracts/result.ts` | Existing exec-level envelope that must remain separate |
| `apps/node/src/domain/skills/runSkill.ts` | Current skill runtime contract to retrofit |
| `docs/skills/authoring.md` | Current public authoring contract |
| `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/scripts/run.js` | First proving skill |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Define contract and parse it in runtime | P1, P2 | `thinking`, `default` | none |
| PR-2 | Retrofit Solax and hand off to downstream packs | P3, P4 | `default` | PR-1 merged locally and validated |

## Phase P1: Define `SkillResult`

### Agent Tier

`thinking`

### Goal

Decide the shape and emission mechanism for the skill-level result contract.

### Files or Surfaces To Change

- `apps/node/src/contracts/`
- optionally a short design note if the decision cannot fit cleanly in code/comments

### Steps

1. Define the `SkillResult` shape.
2. Decide emission channel:
   - explicit stdout frame
   - last-line JSON
   - sidecar file
3. Define versioning and backward compatibility behavior for legacy skills.
4. Record any stable decisions back into the task files if needed.

### Acceptance Criteria

- `SkillResult` has a concrete shape for:
  - goal
  - status
  - checkpoints
  - terminal verification
  - embedded exec evidence
- Emission channel is decided explicitly.
- Legacy behavior for skills that emit plain stdout is defined explicitly.

### Validation

```bash
npm --prefix apps/node run build
```

### Expected Commit

```text
feat(skills): define skill result contract
```

## Phase P2: Parse `SkillResult` In `runSkill`

### Agent Tier

`default`

### Goal

Make `runSkill` parse and return `SkillResult` without breaking legacy skills.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/contracts/`
- `apps/node/src/test/`

### Steps

1. Add failing tests first.
2. Parse/validate framed `SkillResult`.
3. Surface `skillResult` on both success and error shapes as appropriate.
4. Keep the legacy plain-stdout path working.

### Acceptance Criteria

- Well-formed `SkillResult` is parsed and surfaced.
- Missing `SkillResult` keeps legacy skills working.
- Malformed or ambiguous framing is rejected clearly.

Required cases:

- well-formed frame -> parsed `skillResult`
- malformed JSON -> failure
- missing frame -> legacy path still works
- multiple frames -> reject
- version mismatch -> reject or classify explicitly

### Validation

```bash
npm --prefix apps/node run build
```

```bash
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(skills): parse structured skill results
```

## Phase P3: Retrofit Solax To Emit `SkillResult`

### Agent Tier

`default`

### Goal

Make the Solax skill the first opt-in proving skill for the new contract.

### Files or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/scripts/run.js`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/SKILL.md`

### Steps

1. Emit a minimal `SkillResult` from the Solax skill.
2. Include:
   - declared goal
   - input percent
   - checkpoint list
   - terminal verification
   - relevant embedded exec evidence
3. Validate live on the Samsung target.

### Acceptance Criteria

- Solax emits a parseable `SkillResult`.
- The emitted result matches the actual runtime behavior.
- The skill docs describe the new result behavior accurately.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit --device <device_serial> --json -- 40
```

### Expected Commit

```text
feat(solax): emit structured skill result
```

## Phase P4: Prepare Downstream Handoff

### Agent Tier

`default`

### Goal

Update the downstream task packs so compare and declaration work consume the
new contract instead of inventing parallel mechanisms.

### Files or Surfaces To Change

- `tasks/recording/compare/`
- `tasks/recording/skill-contract-declaration/`

### Steps

1. Confirm compare consumes `SkillResult`.
2. Confirm declaration work now targets the actual runtime contract.
3. Record any follow-on work discovered during implementation.

### Acceptance Criteria

- Downstream task packs no longer assume a separate trace mechanism.
- Any unresolved follow-on is explicitly captured.

### Validation

```bash
git diff -- tasks/recording/compare tasks/recording/skill-contract-declaration
```

### Expected Commit

```text
chore(tasks): align recording work with skill result contract
```
