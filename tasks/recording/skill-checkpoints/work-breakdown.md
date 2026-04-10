# Skill Checkpoints Work Breakdown

Parent plan: `tasks/recording/skill-checkpoints/plan.md`

## Executive Summary

Total PRs: 2. Total phases: 3.

- PR-1: Solax integrity fixes plus live proof that failure propagates truthfully
- PR-2: short durable authoring-doc update after the Solax proof is stable

Current state: planning complete, ready for active execution.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 2 |
| Total phases | 3 |
| Completed | none |
| Remaining | P1, P2, P3 |
| Current / Next | P1 |
| Blockers | none |

## Hard Rules

- Do not return success if the underlying `clawperator exec` failed.
- Do not return success unless the Solax UI shows the requested persisted value.
- Put any forced-failure proof in the same phase and commit as the silent-success fix. Do not defer it.
- Do not broaden this task into compare, trace design, or skill contract work.
- Keep Samsung/Solax-specific hacks in the skill docs, not in generalized authoring guidance.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/skill-checkpoints/plan.md` | Stable scope, ordering, and outputs |
| `tasks/recording/demo/findings.md` | Ground truth from the Solax recording/debugging journey |
| `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/scripts/run.js` | Current implementation under repair |
| `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/SKILL.md` | Current durable skill notes and caveats |
| `docs/skills/authoring.md` | Durable destination for the generalized rule after proof |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Make Solax truthful and verified | P1, P2 | `default` | none |
| PR-2 | Graduate minimal durable guidance | P3 | `default` | PR-1 merged locally and validated |

## Phase P1: Tighten Solax Integrity

### Agent Tier

`default`

### Goal

Remove silent-success behavior and make the save sequence truthful enough that a
failed sub-exec reaches the caller as failure.

### Files or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/scripts/run.js`
- optionally `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/SKILL.md` if behavior notes change materially in the same phase

### Steps

1. Remove the current `stdout -> process.exit(0)` failure swallowing path.
2. Make the second `Save` click safer:
   - wait for the first `Save` target to disappear, or
   - otherwise prove the UI advanced before the second click.
3. Add a forced-failure proof path:
   - preferred: a focused regression if a practical test harness exists
   - fallback: a documented manual repro that proves `runSkill` returns failure
4. Re-run the skill on-device after the fix.

### Acceptance Criteria

- `run.js` no longer exits `0` just because stdout exists after a failed exec.
- A forced sub-exec failure reaches the caller as failure.
- The save sequence no longer relies on two unscoped identical `Save` clicks with no advancement proof.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills validate com.solaxcloud.starter.set-discharge-to-limit --json
```

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit --device <device_serial> --json -- 40
```

Required cases:

- successful set to a new value returns success
- forced sub-exec failure returns failure to the caller

### Expected Commit

```text
fix(solax): make discharge limit failures truthful
```

## Phase P2: Add Terminal-State Verification

### Agent Tier

`default`

### Goal

Verify `Discharge to <target>%` before returning success.

### Files or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/scripts/run.js`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/SKILL.md`

### Steps

1. Add the cheapest reliable read-back path for the Solax setting.
2. Fail the skill if the persisted row does not match the requested value.
3. Update the skill docs to reflect the verified behavior if the implementation changes.
4. Validate on-device by setting to a new value and reading it back.

### Acceptance Criteria

- The skill does not report success unless `Discharge to <target>%` is observed.
- The proof path is executed by the skill itself, not only by manual reviewer behavior.
- The Solax skill docs accurately describe the verification behavior.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit --device <device_serial> --json -- 39
```

Required cases:

- set to `39` -> verified persisted row shows `39%`
- set to `40` -> verified persisted row shows `40%`

### Expected Commit

```text
fix(solax): verify persisted discharge limit
```

## Phase P3: Document Durable Guidance

### Agent Tier

`default`

### Goal

Add the minimum generalized authoring rule to the main docs.

### Files or Surfaces To Change

- `docs/skills/authoring.md`

### Steps

1. Add a short section stating that non-trivial skills:
   - must exit non-zero on underlying exec failure
   - must verify terminal state before reporting success
2. Keep the guidance general and avoid Samsung/Solax-specific details.
3. Validate docs build if the docs surface requires regeneration.

### Acceptance Criteria

- `docs/skills/authoring.md` contains the generalized non-trivial skill rule.
- The wording is grounded in the proven Solax behavior but not overfit to Solax.

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(skills): require terminal verification for non-trivial skills
```
