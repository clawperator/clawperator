# Doctor Device Interactivity Enhancements Work Breakdown

Parent plan: `tasks/api/doctor-enhancements/plan.md`

## Executive Summary

2 PRs, 4 phases. PR-1 adds the new doctor check, makes it critical, and updates
the canonical doctor/error docs. PR-2 adds narrow Node preflight enforcement
for direct execution paths plus high-level skill wrappers, then updates serve,
MCP, and skills docs to match. All four phases are now implemented on
`api/doctor-enhancements`; this pack remains as the implementation handoff and
status record until PR review and merge are complete.

## Status

| Item | Value |
| --- | --- |
| State | implemented on branch, pending PR/review |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | 1, 2, 3, 4 |
| Remaining | none |
| Current / Next | Ready for PR/review on `api/doctor-enhancements` |
| Blockers | none on the current branch; if required before merge, investigate the broad Node suite run that printed passing output but did not terminate cleanly in the desktop thread |

## Implemented Commits

| Phase | Commit | Status |
| --- | --- | --- |
| 1 | `55bbef1 feat(node): add doctor interactive state check` | done |
| 2 | `cc35fd3 docs(api): document doctor interactive readiness check` | done |
| 3 | `0bffc67 feat(node): fail direct execution when device is not interactive` | done |
| 4a | `f9553a4 feat(node): gate skill wrappers on interactive device state` | done |
| 4b | `67f410c docs(skills): document skill wrapper readiness behavior` | done |

## Hard Rules

- Do not start PR-1 until the implementation from
  `tasks/android/device-interactivity-foundation/` is merged.
- Do not call the full doctor sequence before every execution. Use only the
  narrow interactive-state probe from the foundation work.
- Use `DEVICE_NOT_INTERACTIVE` everywhere this pack introduces a stable public
  contract. Do not create a parallel `DEVICE_LOCKED` public code here.
- Make the new doctor check critical in the same phase and commit as the check
  itself. Do not ship a non-critical readiness check and defer `criticalOk`
  integration.
- Place the new doctor check after handshake and before optional smoke. Do not
  let smoke run first on a device that should already fail the critical
  readiness gate.
- Keep `runSkill()` as a process launcher and verifier. Do not move wrapper
  readiness policy into `runSkill()` in this pack.
- Add tests in the same phase and commit as each behavior change. Do not defer
  coverage to a later cleanup phase.
- Prefer deterministic unit coverage for serve/MCP mapping helpers over
  black-box integration tests that would require a live non-interactive device.
- Do not edit generated docs directly. Use `.agents/skills/docs-author/SKILL.md`
  for authored public-doc phases and then run `./scripts/docs_build.sh`.
- Keep `tasks/api/doctor-enhancements/findings.md` as a companion analysis
  artifact. If implementation contradicts a reviewed assumption, append the new
  discovery there before changing scope or task-pack instructions.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/api/doctor-enhancements/plan.md` | Stable contract, scope, and PR boundaries |
| `tasks/api/doctor-enhancements/findings.md` | Reviewed architecture analysis and resolved rollout decisions |
| `tasks/android/device-interactivity-foundation/plan.md` | Upstream dependency and internal probe contract this pack consumes |
| `apps/node/src/domain/doctor/DoctorService.ts` | Current doctor sequencing and `criticalOk` behavior |
| `apps/node/src/domain/doctor/checks/readinessChecks.ts` | Existing readiness checks and handshake path |
| `apps/node/src/domain/doctor/criticalChecks.ts` | Critical doctor check gating |
| `apps/node/src/domain/executions/runExecution.ts` | Top-level Node preflight boundary |
| `apps/node/src/cli/commands/serve.ts` | HTTP mapping and `POST /skills/:skillId/run` behavior |
| `apps/node/src/test/unit/serveCommand.test.ts` | Existing unit seam for exported serve helpers |
| `apps/node/src/cli/commands/skills.ts` | CLI high-level skill-wrapper behavior |
| `apps/node/src/domain/skills/runSkill.ts` | Launcher boundary that must stay thin |
| `apps/node/src/mcp/tools/common.ts` | MCP normalization path for top-level Node failures |
| `apps/node/src/test/unit/mcpHelpers.test.ts` | Existing unit seam for MCP helper behavior |
| `apps/node/src/contracts/errors.ts` and `apps/node/src/contracts/doctor.ts` | Stable public contract surfaces |
| `docs/api/doctor.md`, `docs/api/errors.md`, `docs/api/overview.md`, `docs/skills/runtime.md`, `docs/skills/overview.md` | Authored public-doc surfaces that must change with shipped behavior |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Add the doctor interactive-state check and canonical docs | 1, 2 | thinking, default | implemented on branch |
| PR-2 | Add Node preflight enforcement and skill-wrapper integration | 3, 4 | thinking, default | implemented on branch |

## Phase 1: Add the Critical Doctor Interactive-State Check

Status: done on `api/doctor-enhancements` via `55bbef1`

### Agent Tier

thinking

### Goal

Make `doctor` report the target-specific `device not interactive` condition as
an explicit critical check with stable evidence and the public error code
`DEVICE_NOT_INTERACTIVE`.

### Files or Surfaces To Change

- `apps/node/src/contracts/errors.ts`
- `apps/node/src/domain/doctor/checks/readinessChecks.ts`
- `apps/node/src/domain/doctor/criticalChecks.ts`
- `apps/node/src/contracts/doctor.ts` only if an exported helper type or docs-
  facing contract aid is genuinely needed
- `apps/node/src/test/unit/doctor/readinessChecks.test.ts`
- `apps/node/src/test/unit/doctor/DoctorService.test.ts`
- `apps/node/src/test/unit/doctorCommand.test.ts`

### Steps

1. Read the merged foundation implementation first and confirm the internal
   interactive-state probe shape it exposes. Do not guess the payload contract
   from task prose alone.
2. Add `DEVICE_NOT_INTERACTIVE` to `apps/node/src/contracts/errors.ts`.
3. Add the new doctor check in `readinessChecks.ts` using the narrow
   interactive-state probe from the foundation work. Reuse the merged
   foundation helper/probe result if it already exists. Do not invoke the full
   doctor sequence or duplicate handshake/version logic with a second bespoke
   dispatch path.
4. Use the doctor check id `readiness.device.interactive`.
5. Ensure the failing check reports explicit evidence fields:
   - `deviceLocked`
   - `screenOn`
   - `userUnlocked`
6. Insert the new check into `DoctorService` after handshake succeeds and
   before optional smoke so the same critical condition blocks smoke.
7. Mark the new check critical in `criticalChecks.ts` in the same commit.
8. Add focused regression coverage:
   - `readinessChecks.test.ts`: pass/fail behavior and evidence shape
   - `DoctorService.test.ts`: `criticalOk` becomes `false` when the check fails
     and smoke is skipped on that path
   - `doctorCommand.test.ts`: JSON output preserves the new check and evidence
9. Do not change execution, serve, MCP, or skill-wrapper behavior in this
   phase.

### Acceptance Criteria

- `DEVICE_NOT_INTERACTIVE` exists as a stable public error code.
- `doctor` includes `readiness.device.interactive`.
- The check evidence includes `deviceLocked`, `screenOn`, and `userUnlocked`.
- `criticalOk` becomes `false` when the device is not interactive.
- The new check runs before optional smoke and prevents smoke from running when
  it fails.
- Regression tests cover both the new check and the `criticalOk` impact.

### Validation

```bash
npm --prefix apps/node run build
node --test apps/node/dist/test/unit/doctor/readinessChecks.test.js apps/node/dist/test/unit/doctor/DoctorService.test.js apps/node/dist/test/unit/doctorCommand.test.js
```

If additional adjacent tests are touched or the targeted set is no longer
sufficient, run the full Node test suite instead:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add doctor interactive state check
```

## Phase 2: Update Canonical Doctor And Error Docs

Status: done on `api/doctor-enhancements` via `cc35fd3`

### Agent Tier

default

### Goal

Update the authored public doctor and API docs so they describe the shipped
critical readiness check and new stable error code accurately.

### Files or Surfaces To Change

- `docs/api/doctor.md`
- `docs/api/errors.md`
- `docs/api/overview.md`

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for this phase.
2. Update `docs/api/doctor.md` to describe the new interactive-state check and
   that normal readiness now includes this condition.
3. Update `docs/api/errors.md` for `DEVICE_NOT_INTERACTIVE`.
4. Update `docs/api/overview.md` only as much as needed so the top-level API
   contract does not contradict the shipped behavior.
5. Run `./scripts/docs_build.sh` after the authored-doc edits.
6. Do not start PR-2 until PR-1 is merged.

### Acceptance Criteria

- Authored docs describe the new doctor check and `DEVICE_NOT_INTERACTIVE`
  accurately.
- `./scripts/docs_build.sh` passes.
- No generated docs are edited directly.

### Validation

```bash
./scripts/docs_build.sh
git diff --check
```

### Expected Commit

```text
docs(api): document doctor interactive readiness check
```

## Phase 3: Add Narrow Node Preflight Enforcement For Direct Execution

Status: done on `api/doctor-enhancements` via `0bffc67`

### Agent Tier

thinking

### Goal

Return top-level Node preflight failure before dispatch for direct execution
entrypoints when the resolved target device is not interactive, and keep serve
and MCP aligned with that contract.

### Files or Surfaces To Change

- `apps/node/src/domain/executions/runExecution.ts`
- `apps/node/src/cli/commands/serve.ts`
- `apps/node/src/mcp/tools/common.ts`
- `apps/node/src/test/unit/runExecution.test.ts`
- `apps/node/src/test/unit/serveCommand.test.ts` if a small exported helper is
  added for HTTP status mapping
- `apps/node/src/test/unit/mcpHelpers.test.ts` or a focused adjacent unit test
  if a small helper is added for MCP normalization
- integration coverage only if the implementation also introduces a
  deterministic seam that proves `DEVICE_NOT_INTERACTIVE` without live-device
  dependence

### Steps

1. Add the narrow interactive-state preflight to `runExecution()` before Android
   dispatch.
2. When the resolved target is not interactive, return top-level:
   - `ok: false`
   - `error.code = DEVICE_NOT_INTERACTIVE`
   and do not dispatch to Android.
3. Update `serve.ts` so the direct execution routes map this error to `409`.
   Cover at minimum:
   - `/execute`
   - `/snapshot`
   - `/screenshot`
4. Update `apps/node/src/mcp/tools/common.ts` so MCP tools surface this as an
   MCP error result rather than a generic success payload or transport crash.
5. If `serve.ts` or `common.ts` need a tiny exported helper to make that mapping
   deterministic, add it and cover it in unit tests instead of forcing brittle
   black-box integration.
6. Add focused regressions:
   - `runExecution.test.ts`: returns top-level `ok: false` and does not dispatch
   - serve unit or integration coverage: the affected routes map the error to
     `409`
   - MCP unit or integration coverage: the new preflight failure becomes an MCP
     error result
7. Keep skill-wrapper behavior out of this phase.

### Acceptance Criteria

- `runExecution()` returns top-level `ok: false` with `DEVICE_NOT_INTERACTIVE`
  before dispatch.
- No Android dispatch occurs on that path.
- Serve direct execution routes map the error to `409`.
- MCP tools return an error result for the new condition.
- Regression tests prove each of those behaviors without depending on a live
  device being in the exact failing state.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

Required cases:

- non-interactive probe result -> `runExecution()` top-level `ok: false`
- non-interactive probe result -> no broadcast/dispatch call
- serve mapping path -> `/execute`, `/snapshot`, and `/screenshot` return `409`
- MCP execution path -> returns an MCP error result

### Expected Commit

```text
feat(node): fail direct execution when device is not interactive
```

## Phase 4: Add High-Level Skill-Wrapper Enforcement And Skills Docs

Status: done on `api/doctor-enhancements` via `f9553a4` and `67f410c`

### Agent Tier

default

### Goal

Make high-level skill wrappers fail before skill spawn when the target device is
not interactive, and keep the serve route and public skills docs aligned with
that behavior.

### Files or Surfaces To Change

- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/cli/commands/serve.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `apps/node/src/test/unit/serveCommand.test.ts`
- integration coverage for `POST /skills/:skillId/run` only if the route
  behavior can be proved deterministically without a live-device dependency
- `docs/skills/runtime.md`
- `docs/skills/overview.md`

### Steps

1. Add pre-spawn readiness enforcement to CLI `cmdSkillsRun()`.
2. Add the same pre-spawn readiness enforcement to HTTP
   `POST /skills/:skillId/run`.
3. Add optional `operatorPackage` input to the serve skill-run route.
4. Extend `buildServeSkillRunOptions()` or an equivalent small helper so the
   route can pass the resolved `operatorPackage` into skill env and pass
   `deviceId` only when the caller explicitly supplied one, then cover that
   helper in `serveCommand.test.ts`.
5. Resolve `operatorPackage` for that route with the same precedence used
   elsewhere in serve:
   - explicit request value first
   - then default/environment resolution
6. Pass the resolved package both to:
   - the pre-spawn readiness probe
   - the skill env as `CLAWPERATOR_OPERATOR_PACKAGE`
   Keep any implicitly resolved device id preflight-only. Do not write it into
   `CLAWPERATOR_DEVICE_ID`, because `runSkill()` currently prepends that env var
   into argv for script-driven skills.
7. Keep `runSkill()` itself unchanged as a launcher/verifier boundary.
8. Add focused regressions:
   - `skills.test.ts`: `cmdSkillsRun()` fails before spawn when the target is
     not interactive
   - `serveCommand.test.ts`: the route helper passes resolved
     `CLAWPERATOR_OPERATOR_PACKAGE` and explicit
     `CLAWPERATOR_DEVICE_ID`
   - route-level serve coverage only if the no-spawn failure can be proved
     deterministically in the current harness
9. Use `.agents/skills/docs-author/SKILL.md` for the public-doc updates in:
   - `docs/skills/runtime.md`
   - `docs/skills/overview.md`
10. Run `./scripts/docs_build.sh` after the authored-doc edits.

### Acceptance Criteria

- `cmdSkillsRun()` fails before skill spawn when the device is not interactive.
- `POST /skills/:skillId/run` fails before skill spawn when the device is not
  interactive.
- `POST /skills/:skillId/run` accepts and propagates optional `operatorPackage`.
- `runSkill()` remains a launcher/verifier rather than becoming a readiness
  authority.
- Serve helper/unit coverage proves the route env tuple:
  - resolved `CLAWPERATOR_OPERATOR_PACKAGE` always
  - `CLAWPERATOR_DEVICE_ID` only for explicit caller-supplied device selection
- Authored skills docs match the shipped wrapper behavior.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
```

Required cases:

- CLI `skills run` pre-spawn failure -> no child process launch
- serve helper path -> resolved `operatorPackage` and `deviceId` are propagated
  into skill env correctly
- serve route pre-spawn failure -> no child process launch, if the current test
  harness can prove that deterministically
- helper-driven direct skill path remains unchanged and still relies on the
  first internal CLI call

### Expected Commits

```text
feat(node): gate skill wrappers on interactive device state
```

```text
docs(skills): document skill wrapper readiness behavior
```

## Final Check Before Review

Before asking for review, verify all of the following:

- the foundation dependency really landed and the implementation uses its
  shipped probe contract rather than task-pack assumptions
- `DEVICE_NOT_INTERACTIVE` is the only new public readiness code introduced
  here
- the doctor check is critical and changes `criticalOk`
- direct execution returns top-level `ok: false` before dispatch
- serve maps the new preflight failure deliberately to `409`
- MCP returns an error result for the new preflight failure
- high-level skill wrappers fail before spawn
- `runSkill()` stayed thin
- authored public docs were updated and `./scripts/docs_build.sh` passed
