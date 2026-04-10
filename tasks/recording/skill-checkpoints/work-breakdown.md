# Skill Checkpoints Work Breakdown

Parent plan: `tasks/recording/skill-checkpoints/plan.md`

## Executive Summary

Total PRs: 3. Total phases: 4.

- PR-1a: Clawperator-side regression test in `apps/node/src/test/` proving
  that a stub skill which exits non-zero surfaces as `ok:false` from
  `runSkill`. This protects the propagation path itself from regression.
- PR-1b: Solax integrity fixes plus live proof that failure propagates
  truthfully and that the persisted row is verified before success.
- PR-2: short durable authoring-doc update after the Solax proof is stable.

Current state: planning complete, ready for active execution.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 3 |
| Total phases | 4 |
| Completed | none |
| Remaining | P0, P1, P2, P3 |
| Current / Next | P0 |
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
| PR-1a | Regression test for `runSkill` failure propagation | P0 | `default` | none |
| PR-1b | Make Solax truthful and verified | P1, P2 | `default` | PR-1a landed |
| PR-2 | Graduate minimal durable guidance | P3 | `default` | PR-1b merged locally and validated |

## Phase P0: Regression Test For Failure Propagation

### Agent Tier

`default`

### Goal

Prove inside the Clawperator test surface that a skill script which exits
non-zero is reported by `runSkill` as `ok:false` with
`code: SKILL_EXECUTION_FAILED`. This protects the propagation path from
silent regression and lets PR-1b focus on the Solax behavior.

### Files Or Surfaces To Change

- `apps/node/src/test/` (new test file)
- a small stub skill fixture under the test tree (in-test inline registry, or
  a fixture directory similar to other skills tests)

### Steps

1. Create a stub skill registry and a stub script that always exits non-zero
   with both stdout content and stderr content. The stdout content matters:
   it must be present so the test proves the legacy `exit(0) on any stdout`
   behavior cannot be reintroduced upstream of `runSkill`.
2. Invoke `runSkill` against the stub.
3. Assert:
   - `result.ok === false`
   - `result.code === "SKILL_EXECUTION_FAILED"`
   - `result.exitCode` is non-zero
   - `result.stdout` and `result.stderr` are preserved on the error

### Acceptance Criteria

- Test exists in `apps/node/src/test/` and lives in CI.
- Test fails if `runSkill` is changed to swallow non-zero exit when stdout
  is present.
- Test does not depend on `../clawperator-skills/` or any live device.
- If the existing CI path does not already run the new test through
  `npm --prefix apps/node run test`, PR-1a must update CI in the same change
  so the regression is enforced automatically.

### Validation

```bash
npm --prefix apps/node run build
```

```bash
npm --prefix apps/node run test
```

### Expected Commit

```text
test(skills): regression for non-zero exit propagation
```

## Phase P1: Tighten Solax Integrity

### Agent Tier

`default`

### Goal

Remove silent-success behavior and make the save sequence truthful enough that a
failed sub-exec reaches the caller as failure, while preserving the current
skill as the explicit replay baseline.

### Files or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/`
- any registry/index surface in `../clawperator-skills` needed to preserve the
  renamed skill id cleanly

### Steps

1. Remove the current `stdout -> process.exit(0)` failure swallowing path in
   `run.js`. On any thrown exec error, exit non-zero (preserving the failed
   exec stdout to stderr or to a structured error so the brain still sees it).
2. Preserve the existing Solax skill under the explicit id
   `com.solaxcloud.starter.set-discharge-to-limit-replay`. Update any local
   references needed so W2 can build `-orchestrated` separately instead of
   mutating the replay baseline in place.
3. Make the second `Save` click safer using one of these concrete approaches:
   - add a `wait_for_node` with `present:false` semantics (or equivalent)
     for the first `Save` node before the second click, with a finite
     timeout. If the first `Save` does not disappear, fail the skill.
   - otherwise scope the second `Save` to a different container/resource id
     observed in the bottom-sheet phase, so the matcher cannot collide with
     the first.
4. Provide a documented manual repro for forced sub-exec failure on the live
   device, complementing the P0 regression. Capture the exact `skills run`
   command and the resulting `SKILL_EXECUTION_FAILED` JSON. Add this to the
   skill's `SKILL.md` "validation" section so it remains discoverable.
5. Re-run the skill on-device after the fix for both success and failure
   paths.

### Acceptance Criteria

- `run.js` no longer exits `0` after a failed exec under any stdout
  condition.
- The replay baseline exists under the explicit skill id
  `com.solaxcloud.starter.set-discharge-to-limit-replay`.
- The save sequence either waits for the first `Save` to disappear, or
  scopes the second match to a distinct node with documented evidence.
- The documented forced-failure repro produces a non-zero exit and a
  `SKILL_EXECUTION_FAILED` envelope from `clawperator skills run --json`.
- P0 regression in `apps/node/src/test/` still passes.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills validate com.solaxcloud.starter.set-discharge-to-limit-replay --json
```

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit-replay --device <device_serial> --json -- 40
```

Required cases:

- successful set to a new value returns success
- forced sub-exec failure returns failure to the caller

### Expected Commit

```text
fix(solax): preserve truthful discharge limit replay skill
```

## Phase P2: Add Terminal-State Verification

### Agent Tier

`default`

### Goal

Verify `Discharge to <target>%` before returning success.

### Files or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/scripts/run.js`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/SKILL.md`

### Steps

1. After the save sequence, re-navigate to (or remain on) the
   `Discharge to ...` row and read its current text using a Clawperator
   selector or `snapshot_ui`-derived match.
2. Compare the observed numeric value against the *requested* `targetText`,
   not just any `Discharge to <n>%` string. The check must fail if the
   observed value does not equal the requested value.
3. Strongly preferred: also confirm the observed value differs from the
   value present *before* the change, to defend against the false positive
   where the row already happened to display the requested value. If this
   adds significant complexity, document the residual risk in `SKILL.md`
   instead of skipping the check.
4. Fail the skill (non-zero exit) if the persisted value does not equal the
   requested value.
5. Update `SKILL.md` to describe the verification behavior, including the
   exact failure shape the brain will see if verification fails.
6. Validate on-device with both `40` and `39` and confirm verification
   passes for the matching value.

### Acceptance Criteria

- The skill does not report success unless the persisted row equals the
  *requested* value, not merely any `Discharge to <n>%` value.
- The proof path is executed by the skill itself, not only by manual
  reviewer behavior.
- A residual false-positive risk (if any) is documented explicitly in
  `SKILL.md`.
- The Solax skill docs accurately describe the verification behavior and
  the failure shape.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit-replay --device <device_serial> --json -- 39
```

Required cases:

- set to `39` -> verified persisted row shows `39%`
- set to `40` -> verified persisted row shows `40%`

### Expected Commit

```text
fix(solax): verify persisted discharge limit replay
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
