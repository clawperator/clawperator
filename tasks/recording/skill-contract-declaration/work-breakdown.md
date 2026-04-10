# Skill Contract Declaration Work Breakdown

Parent plan: `tasks/recording/skill-contract-declaration/plan.md`

## Executive Summary

Total PRs: 2. Total phases: 3.

- PR-1: declaration shape plus scaffold/runtime support
- PR-2: Solax proving declaration

Current state: blocked until `tasks/recording/skill-result-contract/` lands.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 2 |
| Total phases | 3 |
| Completed | none |
| Remaining | P1, P2, P3 |
| Current / Next | P1 after W2 |
| Blockers | `tasks/recording/skill-result-contract/` must land first |

## Hard Rules

- Do not require the new `contract` block for all existing skills.
- Do not let the declaration drift away from what `SkillResult` can actually prove.
- Do not fold compare logic into this task.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/skill-contract-declaration/plan.md` | Stable scope and blockers |
| `tasks/recording/brain-hand-contract/problem-definition.md` | Why declaration exists at all |
| `tasks/recording/skill-result-contract/plan.md` | Upstream contract this declaration must align to |
| `docs/skills/authoring.md` | Current public authoring contract |
| `apps/node/src/domain/skills/scaffoldSkill.ts` | Scaffold behavior to extend |
| `apps/node/src/domain/skills/validateSkill.ts` | Validator surface for the new optional `contract` field |
| `apps/node/src/domain/skills/runSkill.ts` | Runtime cross-check point |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Define and implement declaration support | P1, P2 | `thinking`, `default` | W2 landed |
| PR-2 | Prove declaration with Solax | P3 | `default` | PR-1 merged locally and validated |

## Phase P1: Define The Declaration Shape

### Agent Tier

`thinking`

### Goal

Define a narrow v1 `contract` block for `skill.json`.

### Files or Surfaces To Change

- `tasks/recording/skill-contract-declaration/`
- optionally contract docs/comments in runtime surfaces

### Steps

1. Define `contract.inputs`.
2. Define `contract.goal`.
3. Define `contract.verification`.
4. Keep the shape compatible with the existing registry model.

### Acceptance Criteria

- Declaration shape is explicit and narrow.
- Shape is aligned with what `SkillResult` can actually prove.

### Validation

```bash
git diff -- tasks/recording/skill-contract-declaration
```

### Expected Commit

```text
chore(tasks): define skill contract declaration shape
```

## Phase P2: Implement Scaffold And Runtime Support

### Agent Tier

`default`

### Goal

Add optional declaration support to the scaffold and runtime.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/contracts/` (extend `SkillRunResult` for the new
  `indeterminate` status)
- `apps/node/src/test/`

### Steps

1. Add failing tests first.
2. Extend `SkillRunResult` with an `indeterminate` discriminant whose shape is
   defined by W3 plan Decision Rules.
3. Update validator to accept/reject the optional `contract` block.
4. Update scaffold output to include a present-but-empty `contract` block per
   plan Decision Rules.
5. Update runtime cross-checking of declared verification vs emitted
   `SkillResult` and route the result to the correct `SkillRunResult`
   discriminant.

Required cases:

- declared verification present and matched -> `ok: true`
- declared verification present and not proved -> `indeterminate`
- declared verification present but emitted `SkillResult.status === "failed"`
  -> `ok: false`
- declaration omitted for legacy skill -> existing behavior, no
  `indeterminate` is ever produced
- malformed `contract` block -> validator rejects with a typed error
- scaffolded skill with present-but-empty `contract` validates and runs

### Acceptance Criteria

- Optional `contract` block is scaffolded correctly with the documented
  empty shape.
- The validator accepts both present and absent `contract` blocks and
  rejects malformed ones with a clear error.
- Runtime distinguishes declared-but-unproved verification from plain
  success and reports it as `indeterminate`.
- The CLI surface `clawperator skills run --json` exposes the
  `indeterminate` state in its JSON output.
- Legacy skills remain valid without a `contract` block.

### Validation

```bash
npm --prefix apps/node run build
```

```bash
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(skills): add optional skill contract declaration
```

## Phase P3: Prove With Solax

### Agent Tier

`default`

### Goal

Declare the Solax contract and prove it agrees with emitted `SkillResult`.

### Files or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/skill.json`

### Steps

1. Declare the Solax contract in `skill.json`.
2. Run the skill and confirm declared verification matches emitted verification.

### Acceptance Criteria

- Solax `skill.json` declares inputs, goal, and verification.
- Live verification shows declaration and emitted `SkillResult` agree.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit --device <device_serial> --json -- 40
```

### Expected Commit

```text
feat(solax): declare discharge limit contract
```
