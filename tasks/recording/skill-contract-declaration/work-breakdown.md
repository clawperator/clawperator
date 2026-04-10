# Skill Contract Declaration Work Breakdown

Parent plan: `tasks/recording/skill-contract-declaration/plan.md`

## Executive Summary

Total PRs: 2. Total phases: 3.

- PR-1: declaration shape plus scaffold/runtime support
- PR-2: Solax proving declaration

Current state: blocked until `tasks/recording/skill-result-contract/` lands,
with the Solax proving phase additionally blocked on W2b.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 2 |
| Total phases | 3 |
| Completed | none |
| Remaining | P1, P2, P3 |
| Current / Next | P1 after W2 |
| Blockers | `tasks/recording/skill-result-contract/` must land first; P3 also waits on `tasks/recording/agent-driven-skills/` |

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
| `tasks/recording/agent-driven-skills/plan.md` | The runtime-agent shape the Solax proving declaration must match |
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
4. Define the semantics of a present-but-empty `contract` block versus a
   missing one.
5. Keep the shape compatible with the existing registry model.

### Acceptance Criteria

- Declaration shape is explicit and narrow.
- Shape is aligned with what `SkillResult` can actually prove.
- The semantic difference between a missing `contract` block and a
  present-but-empty one is explicit and consistent across scaffold,
  validator, and runtime.

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

- `apps/node/src/contracts/skills.ts`
- `apps/node/src/adapters/skills-repo/`
- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/cli/commands/serve.ts`
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
5. Extend `SkillEntry` and any registry-loading or schema surfaces needed so
   the optional `contract` block can round-trip cleanly from the skills repo.
6. Update runtime cross-checking of declared verification vs emitted
   `SkillResult` and route the result to the correct `SkillRunResult`
   discriminant.
7. Update CLI/serve response shaping so `indeterminate`, `skillResult`, and
   the declared-contract outcome reach existing consumers consistently.

Required cases:

- declared verification present and matched -> `ok: true`
- declared verification present and not proved -> `indeterminate`
- declared verification present but emitted `SkillResult.status === "failed"`
  -> `ok: false`
- declaration omitted for legacy skill -> existing behavior, no
  `indeterminate` is ever produced
- present-but-empty `contract` block -> behavior matches the explicit P1
  decision and is covered by tests
- malformed `contract` block -> validator rejects with a typed error
- scaffolded skill with present-but-empty `contract` validates and runs
- `skills run --json` exposes the new outcome consistently
- serve/API JSON exposes the new outcome consistently

### Acceptance Criteria

- Optional `contract` block is scaffolded correctly with the documented
  empty shape.
- The validator accepts both present and absent `contract` blocks and
  rejects malformed ones with a clear error.
- Runtime distinguishes declared-but-unproved verification from plain
  success and reports it as `indeterminate`.
- The CLI surface `clawperator skills run --json` exposes the
  `indeterminate` state in its JSON output.
- The serve/API surface exposes the same outcome semantics without forcing a
  separate consumer-specific interpretation.
- `SkillEntry`, registry loading, and any relevant schema surfaces accept the
  new optional `contract` field without breaking legacy skills.
- Legacy skills remain valid without a `contract` block.
- New tests added under `apps/node/src/test/` run under the default
  `npm --prefix apps/node run test` path; if not, the PR updates CI in the
  same change.

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

Declare the Solax orchestrated-skill contract and prove it agrees with the
emitted `SkillResult` from the agent-driven runtime path.

### Files or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/skill.json`

### Steps

1. Declare the Solax orchestrated-skill contract in `skill.json`.
2. Run the skill and confirm declared verification matches emitted
   verification.
3. Force a run in which the skill reaches the end of its runtime path but
   cannot satisfy the declared verification, and confirm the runtime surfaces
   `indeterminate` rather than `success`.

### Acceptance Criteria

- Solax orchestrated `skill.json` declares inputs, goal, and verification.
- Live verification shows declaration and emitted `SkillResult` agree on the
  success path.
- A forced non-proving run from the agent-driven Solax skill returns
  `status: indeterminate` and that state reaches `skills run --json`.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit-orchestrated --device <device_serial> --json -- 40
```

### Expected Commit

```text
feat(solax): declare discharge limit orchestrated contract
```
