# Verify selected Operator readiness Work Breakdown

Parent plan: `tasks/node/readiness-verification/plan.md`

## Executive Summary

One PR and one phase. Implementation has not started. Each phase includes its own tests and docs. One bounded implementation PR.

## Status

| Item | Value |
| --- | --- |
| State | Not started |
| Total PRs | 1 |
| Total phases | 1 |
| Completed | None |
| Remaining | Phase 1 |
| Current / Next | Phase 1 |
| Blockers | None |

## Hard Rules

- Follow the dependency and release gates in `tasks/releases/v0.10/plan.md`. Implement only the requested PR; where this pack has two PRs, merge the first before starting the second. Update both task status tables and the release row after each merged PR.

- Follow the parent contract; do not invent alternative default behavior.
- Use branch-local Node output and the matching debug Operator for implementation validation. Never repair or uninstall packages on a device used by another task.
- Commit one logical phase with its tests and authored docs. Do not defer tests to another phase.
- Use the docs-author and docs-build skills for public changes. Do not hand-edit generated pages.
- When affected skill consumers require migration, coordinate changes and version bumps in the sibling skills repository with its active owner, and run its smoke checks per AGENTS.md. Do not silently expand this checkout into unrelated skill edits.
- Keep fixtures generic, using `com.example.fixture`, neutral labels, and caller-provided device IDs. Never copy application-specific research assets into this repository.
- Preserve commandId/taskId and explicit device/operator selection through every path. Do not add autonomous recovery or app-specific policy.
- Record plan deviations before committing. Stop for material contract changes; continue for equivalent internal implementation choices.
- Inspect existing tests listed below before editing. Where the affected path lacks coverage, add the specified regression cases in the same phase.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Topic | Authority |
| --- | --- |
| Governing repository rules | `AGENTS.md` |
| Stable task contract | `tasks/node/readiness-verification/plan.md` |
| Aggregation | `apps/node/src/domain/doctor/DoctorService.ts` |
| Critical checks | `apps/node/src/domain/doctor/criticalChecks.ts` |
| Checks | `apps/node/src/domain/doctor/checks/readinessChecks.ts` |
| Logger configuration | `apps/node/src/adapters/logger.ts` |
| Logger tests | `apps/node/src/test/unit/unifiedLogger.test.ts` |
| Report contract | `apps/node/src/contracts/doctor.ts` |
| Existing tests | `apps/node/src/test/unit/doctor/DoctorService.test.ts` |
| CLI tests | `apps/node/src/test/unit/doctorCommand.test.ts` |
| Public docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |
| Existing public contract exemplar (match its examples and caveats) | `docs/api/navigation.md` |
| Generated docs workflow | `.agents/skills/docs-build/SKILL.md` |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Readiness policy and diagnostics | 1 | default | None |

## Phase 1: Readiness policy and diagnostics

### Agent Tier

default

### Goal

Ship fail-closed readiness with executable regression coverage.

### Files or Surfaces To Change

- `apps/node/src/contracts/doctor.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/domain/doctor/`
- `apps/node/src/cli/commands/doctor.ts`
- `apps/node/src/test/unit/doctor/DoctorService.test.ts`
- `apps/node/src/test/unit/doctor/readinessChecks.test.ts`
- `apps/node/src/test/unit/doctorCommand.test.ts`
- `apps/node/src/adapters/logger.ts`
- `apps/node/src/test/unit/unifiedLogger.test.ts`
- `docs/api/logging.md`
- `docs/api/doctor.md`
- `docs/setup.md`

### Steps

1. Trace every early return and existing fake-runner fixture; enumerate mandatory checks for normal/full modes in one canonical definition.
2. Implement aggregation and explicit skippedChecks. Promote selected-variant absence to failure without touching the other installation. Keep optional warnings advisory.
3. Add the advisory shared log-destination check and fake-filesystem cases for explicit/env/default path precedence, successful append, file versus directory mismatch, and write denial. Preserve existing log contents and parseable stdout. Add fake-runner and CLI regressions covering the decision table; do not require uninstalling a real APK to prove mismatch behavior.
4. Update authored doctor/setup guidance. Live-run doctor on a healthy explicit target and retain report fields; test unavailable states with fakes.

### Acceptance Criteria

- Only development APK installed while release selected: mismatch, no handshake claim, false booleans, nonzero exit.
- Missing device, multiple unspecified devices, incompatible version, handshake failure, locked screen, and incomplete full mode each fail with recorded skips.
- Healthy required checks plus missing optional agent tooling succeeds. --fix cannot turn stale observations into success.
- Unwritable logs remain an advisory warning, show the attempted path and configured remedy, and do not change healthy criticalOk.
- Existing report consumers and doctor CLI tests pass; no implicit device or package switch occurs.
- Human review: output accuracy matches observed evidence; scope covers the named surfaces only; important claims trace to tests or findings; schema, section order, and public help match the contract.

### Validation

Run from repository root, in order. Unit/subprocess tests are the primary reproducible gate. Live checks prove device integration only and require a dedicated target with the matching debug Operator, enabled accessibility, and an unlocked screen. A skipped live check is not a pass; record its unmet prerequisite.

```sh
npm --prefix apps/node ci
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
: "${DEVICE_ID:?Select a test device}"
node apps/node/dist/cli/index.js doctor --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev
```

### Expected Commit

```text
fix(doctor): require verified selected-operator readiness
```

## Execution Findings

Create `findings.md` at the start of the first phase, before source edits. Use these sections in order: Environment and Versions; Reproduction Inputs; Observed Results (command, exit code, JSON fields, artifact paths); Source Mapping; Decisions and Deviations; Validation (case, expected, actual, pass/fail/blocked); Remaining Work. Append phase-specific results before its commit. Do not paste sensitive or application-specific captures. Keep raw local evidence outside tracked files and use generic reproduction fixtures in tests.
