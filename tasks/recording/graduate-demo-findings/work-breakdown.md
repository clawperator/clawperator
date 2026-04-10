# Graduate Demo Findings Work Breakdown

Parent plan: `tasks/recording/graduate-demo-findings/plan.md`

## Executive Summary

Total PRs: 1. Total phases: 2.

- PR-1: migrate durable knowledge into docs, validate the docs build, retire the demo task files

Current state: blocked until the wording from W1/W2 is stable enough to graduate.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | P1, P2 |
| Current / Next | P1 after W1/W2 stabilize |
| Blockers | durable guidance wording should settle after W1/W2 |

## Hard Rules

- Do not leave durable guidance stranded in `tasks/`.
- Do not preserve retrospective narrative when a direct doc statement is enough.
- Run the docs build before considering this done.
- Delete demo task files only after their durable content exists elsewhere.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/graduate-demo-findings/plan.md` | Stable scope and cleanup intent |
| `tasks/recording/demo/findings.md` | Source material for durable lessons |
| `tasks/recording/demo/meta-problem-summary.md` | Candidate for deletion or supersession |
| `docs/api/recording.md` | Durable destination for recording workflow lessons |
| `docs/skills/authoring.md` | Durable destination for skill-authoring lessons |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Graduate durable lessons and retire temporary files | P1, P2 | `default` | W1/W2 wording stable |

## Phase P1: Migrate Durable Knowledge

### Agent Tier

`default`

### Goal

Move durable operational knowledge into the authored docs.

### Files or Surfaces To Change

- `docs/api/recording.md`
- `docs/skills/authoring.md`

### Steps

1. Move recording-as-evidence guidance into `docs/api/recording.md`.
2. Move non-trivial skill authoring guidance into `docs/skills/authoring.md`.
3. Keep Samsung/Solax-specific coordinates and hacks out of generalized docs.

### Acceptance Criteria

- Durable recording lessons exist in `docs/api/recording.md`.
- Durable skill-authoring lessons exist in `docs/skills/authoring.md`.
- The docs reflect the proven Solax lessons without overfitting to one device layout.

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(recording): graduate solax demo learnings
```

## Phase P2: Validate And Retire Demo Files

### Agent Tier

`default`

### Goal

Clean up temporary demo files once their durable content is safe elsewhere.

### Files or Surfaces To Change

- `tasks/recording/demo/`

### Steps

1. Re-check that durable content has landed in docs.
2. Delete:
   - `tasks/recording/demo/findings.md`
   - `tasks/recording/demo/plan.md`
3. Delete `meta-problem-summary.md` too if the brain/hand problem definition fully supersedes it.

### Acceptance Criteria

- No durable lesson remains uniquely trapped in `tasks/recording/demo/`.
- The remaining task tree is cleaner and still understandable.

### Validation

```bash
git diff -- tasks/recording/demo docs/api/recording.md docs/skills/authoring.md
```

### Expected Commit

```text
chore(tasks): retire recording demo task files
```
