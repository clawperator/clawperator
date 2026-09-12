# Verify selected Operator readiness Implementation

Contract: [plan.md](plan.md). Dependencies and release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## PR Scope

| PR | Purpose | Phase | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Readiness policy and diagnostics | 1 | None |

Implement the requested PR through its acceptance criteria, relevant checks, in-scope repairs, docs, and local commits. A dependency becoming available does not authorize the next PR. Routine implementation choices are yours; raise only decisions that change the contract or scope.

## PR-1: Readiness policy and diagnostics

Ship fail-closed readiness with executable regression coverage.

### Work

- Trace every early return and existing fake-runner fixture; enumerate mandatory checks for normal/full modes in one canonical definition.
- Implement aggregation and explicit skippedChecks. Promote selected-variant absence to failure without touching the other installation. Keep optional warnings advisory.
- Add the advisory shared log-destination check and fake-filesystem cases for explicit/env/default path precedence, successful append, file versus directory mismatch, and write denial. Preserve existing log contents and parseable stdout. Add fake-runner and CLI regressions covering the decision table; do not require uninstalling a real APK to prove mismatch behavior.
- Update authored doctor/setup guidance. Live-run doctor on a healthy explicit target and retain report fields; test unavailable states with fakes.

### Affected Sources

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

### Acceptance Evidence

- Only development APK installed while release selected: mismatch, no handshake claim, false booleans, nonzero exit.
- Missing device, multiple unspecified devices, incompatible version, handshake failure, locked screen, and incomplete full mode each fail with recorded skips.
- Healthy required checks plus missing optional agent tooling succeeds. --fix cannot turn stale observations into success.
- Unwritable logs remain an advisory warning, show the attempted path and configured remedy, and do not change healthy criticalOk.
- Existing report consumers and doctor CLI tests pass; no implicit device or package switch occurs.

### Live Entry Points

Use these for the device proof described above, after building the matching tools. They do not replace the acceptance assertions.

```sh
: "${DEVICE_ID:?Select a test device}"
node apps/node/dist/cli/index.js doctor --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev
```

## Validation and Completion

Use AGENTS.md for shared validation policy. Build Node before tests that consume dist. Relevant checks for this pack are:

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
```

Live verification requires a dedicated, explicitly selected device, an unlocked screen, enabled accessibility, and the matching debug Operator. Offline tests prove the stated contracts; device checks prove integration and pixels. Record unavailable live evidence rather than treating it as passed.

Use `.agents/skills/docs-author/SKILL.md` for the named public docs and `.agents/skills/docs-build/SKILL.md` for regeneration. Run checks for each behavior change; repeat successful checks only after new changes or an unresolved integration concern.

Keep concise findings with versions, reproduction inputs, observed results/artifact paths, decisions, and remaining limitations. Preserve private captures outside tracked files. Update progress and commit validated logical units. Completion includes correcting in-scope failures, not merely producing a first implementation.
