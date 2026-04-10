# Graduate Demo Findings Work Breakdown

Parent plan: `tasks/recording/graduate-demo-findings/plan.md`

## Executive Summary

Total PRs: 2. Total phases: 4.

- PR-1 (wave A): graduate recording-as-evidence and operations facts that do
  not depend on the `SkillResult` shape. Can ship as soon as W1 is in flight.
- PR-2 (wave B): graduate skill-contract and authoring facts that depend on
  W2 (`skill-result-contract`) wording being stable.

Current state: wave A is active. Wave B is blocked on W2.

## Status

| Item | Value |
| --- | --- |
| State | active (wave A) / blocked (wave B) |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1A, P2A, P1B, P2B |
| Current / Next | P1A |
| Blockers | wave B waits for W2 contract wording to stabilize |

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
| `tasks/recording/demo/findings.md` | Source material for durable lessons from the demo task |
| `docs/api/recording.md` | Durable destination for recording workflow lessons |
| `docs/skills/authoring.md` | Durable destination for skill-authoring lessons |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Wave A: graduate recording/operations facts | P1A, P2A | `default` | none (W2 not required) |
| PR-2 | Wave B: graduate skill-contract/authoring facts | P1B, P2B | `default` | W2 contract wording stable |

## Phase P1A: Graduate Recording And Operations Facts

### Agent Tier

`default`

### Goal

Move recording-as-evidence and device-operations knowledge into the authored
docs. This wave is independent of the `SkillResult` contract wording.

### Files or Surfaces To Change

- `docs/api/recording.md`
- `docs/skills/authoring.md` for any wording that currently overstates how
  directly recordings become skills
- (optionally) `docs/setup.md` for any device-operations notes

### Steps

1. Land in `docs/api/recording.md`:
   - recordings are evidence, not executable skills
   - `recording export` is the canonical retained artifact for authoring and
     later validation work
   - `record parse` is lossy inspection and must not be the only baseline
     artifact
   - the practical workflow today is `pull` -> `export`, with `parse`
     available afterward for human inspection when useful
2. Rewrite or remove any wording in `docs/api/recording.md` or
   `docs/skills/authoring.md` that currently implies a recording becomes a
   reusable skill with light cleanup. Do not merely append a caveat beneath
   contradictory wording.
3. Land in `docs/setup.md` (or the relevant operations doc):
   - operator force-stop invalidates the accessibility service and how to
     recover
4. Keep Samsung/Solax-specific coordinates, click-target quirks, and input
   persistence workarounds out of wave A generalized docs. Leave them in
   skill-local docs or later authoring guidance unless and until they are
   proven broader than this Solax case.

### Acceptance Criteria

- Recording-as-evidence lessons live in `docs/api/recording.md`.
- Device-operations lessons live in their proper authoring/setup home, not
  in `tasks/`.
- No contradictory wording remains in authored docs claiming recordings become
  reusable skills with only light cleanup.
- No reference to the W2 `SkillResult` shape appears in wave A wording.
- No reference to a shipped compare CLI or compare workflow appears in wave A
  wording until W4 has actually landed.
- Solax-specific clickability and input-workaround caveats are not promoted to
  generalized docs without explicit evidence they are broader than this case.

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(recording): graduate recording evidence and operations facts
```

## Phase P2A: Retire Wave A Source Notes

### Agent Tier

`default`

### Goal

Delete temporary demo notes whose durable content has now landed in docs.

### Files or Surfaces To Change

- `tasks/recording/demo/`

### Steps

1. Confirm wave A content exists in docs.
2. Delete `tasks/recording/demo/meta-problem-summary.md` (already superseded
   by `brain-hand-contract/problem-definition.md`).
3. Trim `tasks/recording/demo/findings.md` to only the wave-B-specific
   content; do not delete it yet.

### Acceptance Criteria

- `meta-problem-summary.md` is gone.
- `findings.md` no longer carries wave A material.

### Validation

```bash
git diff -- tasks/recording/demo docs/api/recording.md docs/setup.md
```

### Expected Commit

```text
chore(tasks): retire wave A recording demo notes
```

## Phase P1B: Graduate Skill Contract And Authoring Facts

### Agent Tier

`default`

### Goal

Move durable skill-contract and authoring knowledge into the authored docs
once W2 (`skill-result-contract`) wording is stable.

### Files or Surfaces To Change

- `docs/skills/authoring.md`

### Steps

1. Document the `SkillResult` shape, frame marker, and emission expectations.
2. Document the non-trivial skill rule: truthful exit, terminal verification,
   `SkillResult.terminalVerification` shape.
3. Document the optional `contract` block and the `indeterminate` outcome
   class.
4. Keep Samsung/Solax-specific coordinates and hacks out of generalized
   guidance.

### Acceptance Criteria

- Durable skill-authoring lessons exist in `docs/skills/authoring.md` and
  match the shipped W2/W3 surfaces.
- The docs reflect the proven Solax lessons without overfitting to one
  device layout.

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(skills): graduate skill contract authoring guidance
```

## Phase P2B: Retire Demo Files And Brain/Hand Contract

### Agent Tier

`default`

### Goal

Final cleanup of the demo and brain/hand task entries once everything has
graduated.

### Files or Surfaces To Change

- `tasks/recording/demo/`
- `tasks/recording/brain-hand-contract/`

### Steps

1. Re-check that all durable content from `findings.md` has landed in
   `docs/`.
2. Delete `tasks/recording/demo/findings.md` and
   `tasks/recording/demo/plan.md`.
3. Delete `tasks/recording/brain-hand-contract/` once
   `docs/skills/authoring.md` and `docs/api/recording.md` fully cover its
   content (per the retirement criteria in `tasks/recording/plan.md`).

### Acceptance Criteria

- No durable lesson remains uniquely trapped in `tasks/recording/demo/` or
  `tasks/recording/brain-hand-contract/`.
- The remaining task tree is cleaner and still understandable.

### Validation

```bash
git diff -- tasks/recording docs/api/recording.md docs/skills/authoring.md
```

### Expected Commit

```text
chore(tasks): retire recording demo and brain-hand-contract notes
```
