# Recording Compare Work Breakdown

Parent plan: `tasks/recording/compare/plan.md`

## Executive Summary

Total PRs: 2. Total phases: 4.

- PR-1: compare model, fixtures, implementation, tests
- PR-2: Solax proving integration and docs cleanup

Current state: blocked until `tasks/recording/skill-result-contract/` lands.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1, P2, P3, P4 |
| Current / Next | P1 after W2 |
| Blockers | `tasks/recording/skill-result-contract/` must land first |

## Hard Rules

- Do not compare skill runs to raw recording events one-to-one.
- Do not depend on `record parse` as the only baseline artifact.
- Do not let tests read from `../clawperator-skills/` at runtime.
- Do not require a live device to exercise compare tests.
- Do not call the feature “replay validation” unless final persisted state is included in the proof path.
- If the compare output cannot explain the first divergence for the Solax flow, the compare design is not done.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/compare/plan.md` | Stable compare scope and blockers |
| `tasks/recording/brain-hand-contract/problem-definition.md` | Contract-first rationale for compare sequencing |
| `tasks/recording/skill-result-contract/plan.md` | Upstream contract compare must consume |
| `docs/api/recording.md` | Recording export behavior and limits |
| `docs/skills/authoring.md` | Current authoring contract and durable docs destination |
| `apps/node/src/domain/recording/exportRecording.ts` | Recording export schema source |
| `tasks/recording/demo/findings.md` | Solax-specific divergence lessons and proof history |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Define and implement compare on top of `SkillResult` | P1, P2 | `thinking`, `default` | W2 landed |
| PR-2 | Prove with Solax and finish docs | P3, P4 | `default` | PR-1 merged locally and validated |

## Phase P1: Define The Compare Model

### Agent Tier

`thinking`

### Goal

Define checkpoint comparison and divergence classification on top of `SkillResult`.

### Files or Surfaces To Change

- `tasks/recording/compare/`
- optionally a compact design note if the model cannot fit cleanly in implementation docs

### Steps

1. Define checkpoint comparison semantics.
2. Define divergence classes:
   - baseline divergence
   - runtime poisoned state
   - runtime unavailable state
   - verification failed
3. Define the fixture plan for TDD using local sanitized fixtures only.

### Acceptance Criteria

- Compare model is defined without inventing a parallel trace mechanism.
- Divergence classes are explicit enough for the brain to act differently on each.
- Fixture plan includes both a matching path and a forced divergent path.

### Validation

```bash
git diff -- tasks/recording/compare
```

### Expected Commit

```text
chore(tasks): define recording compare model
```

## Phase P2: Implement Compare

### Agent Tier

`default`

### Goal

Implement compare against recording export baselines using `SkillResult`.

### Files or Surfaces To Change

- `apps/node/src/`
- `apps/node/src/test/fixtures/recording-compare/`
- `apps/node/src/test/`

### Steps

1. Add failing tests first using local fixtures.
2. Implement compare against recording export baselines with `snapshotMode: omit`.
3. Add CLI behavior and tests for:
   - valid input
   - invalid input
   - missing value
4. Ensure output is both machine-readable and human-usable.

### Acceptance Criteria

- Compare works without a live device.
- Local fixtures cover:
  - matching path
  - first-divergence path
- Baselines created with `snapshotMode: omit` are supported.

### Validation

```bash
npm --prefix apps/node run build
```

```bash
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(recording): compare skill results to recording baselines
```

## Phase P3: Prove With Solax

### Agent Tier

`default`

### Goal

Show the compare output is useful on the real Solax proving skill.

### Files or Surfaces To Change

- `../clawperator-skills/`
- local fixture copies in `apps/node/src/test/fixtures/recording-compare/`

### Steps

1. Run a matching Solax path and compare it.
2. Produce a forced divergent path and compare it.
3. Copy any required sanitized fixture snippets into the Clawperator repo.

### Acceptance Criteria

- One matching run is proven.
- One forced divergent run is proven.
- Compare identifies the first meaningful difference.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit --device <device_serial> --json -- 40
```

### Expected Commit

```text
test(recording): prove compare with solax fixtures
```

## Phase P4: Finish Docs And Cleanup

### Agent Tier

`default`

### Goal

Capture durable compare guidance and close the task cleanly.

### Files or Surfaces To Change

- `docs/api/recording.md`
- `docs/skills/authoring.md`
- `tasks/recording/compare/`

### Steps

1. Move durable compare guidance into docs.
2. Update task status and remaining follow-ons.
3. Note whether repo-local authoring-skill work is now unblocked.

### Acceptance Criteria

- Durable compare guidance exists outside `tasks/`.
- Task state is updated truthfully.

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(recording): document compare workflow
```
