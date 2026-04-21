# Doctor Device Interactivity Enhancements

## Executive Summary

This pack turns the reviewed `doctor-enhancements` findings into an executable
implementation handoff. The work is API- and Node-dominant, but it depends on
the Android-side foundation from
`tasks/android/device-interactivity-foundation/` landing first. Total scope:
2 PRs, 4 phases.

- PR-1 adds the new doctor interactive-state check and updates the canonical
  doctor contract/docs.
- PR-2 adds narrow Node preflight enforcement for execution entrypoints and
  high-level skill wrappers, plus the serve/MCP/docs work needed to keep the
  public contract aligned.

The existing `findings.md` remains in this task folder as a justified companion
artifact because it contains code-verified architecture analysis and rollout
decisions that the implementing agent should not re-derive.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 after the device-interactivity foundation is merged |
| Blockers | `tasks/android/device-interactivity-foundation/` must land first |

## Goal

After this pack ships, Clawperator should treat "device ready for interactive
automation" as a target-specific, explicit contract:

- `doctor` reports a critical `device not interactive` condition using the
  Android-derived interactive-state evidence from the prerequisite foundation
- direct Node execution entrypoints fail before dispatch with a top-level
  preflight error when the resolved target is not interactive
- high-level skill wrappers fail before process spawn with the same target-
  specific readiness contract
- HTTP and MCP surfaces preserve that contract instead of drifting into generic
  `500` or opaque downstream failures

## Why Now

The reviewed findings established that the current product gap is broader than
"device on lock screen":

- the blind spot is the broader "device not interactive" predicate
- `doctor` is the canonical diagnostics authority but not yet the runtime gate
- direct execution, HTTP serve, MCP, and high-level skill wrappers currently
  do not share a single explicit readiness contract
- `POST /skills/:skillId/run` cannot participate fully today because it does
  not yet accept `operatorPackage`

The prerequisite foundation pack solves the truth-model and internal wake/state
probe layer. This pack consumes that foundation to define the user-facing
doctor and Node enforcement contract.

## In Scope

- Add a new critical doctor check for interactive device state
- Use the stable machine code `DEVICE_NOT_INTERACTIVE` for this predicate
- Surface explicit interactive-state evidence in doctor output:
  - `deviceLocked`
  - `screenOn`
  - `userUnlocked`
- Add narrow Node preflight enforcement before dispatch in `runExecution()`
  and command surfaces that depend on it
- Add the same narrow pre-spawn readiness enforcement to high-level skill
  wrappers:
  - CLI `cmdSkillsRun()`
  - HTTP `POST /skills/:skillId/run`
- Add optional `operatorPackage` input to `POST /skills/:skillId/run`
- Add serve HTTP status mapping and MCP error normalization for the new
  top-level preflight failure
- Update authored public docs for doctor, errors, API overview, and skills
  behavior
- Keep the existing `findings.md` companion aligned if implementation
  contradicts any reviewed assumption

## Out of Scope

- Re-implementing the Android truth-model or internal wake helper from
  `tasks/android/device-interactivity-foundation/`
- Public wake or unlock API design
- Android envelope-level runtime enforcement for race conditions after Node
  preflight
- Secure-keyguard bypass or credential entry
- Adding standalone readiness logic inside `../clawperator-skills`
  shared helpers
- Reusing the entire doctor sequence as a per-command preflight
- Generated docs edits under `sites/docs/.build/` or `sites/docs/site/`

## Existing Artifact Scope

- `tasks/api/doctor-enhancements/findings.md`: preserve as the reviewed
  companion analysis for this pack. Do not delete it during implementation.
  Update it only when shipped implementation contradicts a reviewed assumption
  or reveals a new rollout caveat that the pack must capture before cleanup.
- `docs/api/doctor.md`, `docs/api/errors.md`, `docs/api/overview.md`,
  `docs/skills/runtime.md`, and `docs/skills/overview.md`: in scope for
  authored public-doc updates tied to the shipped behavior
- `apps/node/src/contracts/errors.ts`: in scope for the new stable public error
  code
- `apps/node/src/domain/doctor/` and `apps/node/src/domain/executions/`: in
  scope for doctor reporting and Node preflight enforcement
- `apps/node/src/cli/commands/serve.ts` and `apps/node/src/cli/commands/skills.ts`:
  in scope for HTTP mapping and high-level skill-wrapper enforcement

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/node/src/contracts/errors.ts` | Add `DEVICE_NOT_INTERACTIVE` stable code | PR-1 / Phase 1 |
| `apps/node/src/domain/doctor/checks/readinessChecks.ts` | Add interactive-state doctor check using the foundation probe | PR-1 / Phase 1 |
| `apps/node/src/domain/doctor/criticalChecks.ts` | Mark the new doctor check critical | PR-1 / Phase 1 |
| `apps/node/src/contracts/doctor.ts` | Preserve/extend doctor evidence shape as needed for the new check | PR-1 / Phase 1 |
| `apps/node/src/test/unit/doctor/readinessChecks.test.ts`, `apps/node/src/test/unit/doctor/DoctorService.test.ts`, `apps/node/src/test/unit/doctorCommand.test.ts` | Doctor contract and `criticalOk` regression coverage | PR-1 / Phase 1 |
| `docs/api/doctor.md`, `docs/api/errors.md`, `docs/api/overview.md` | Public doctor/error contract docs | PR-1 / Phase 2 |
| `apps/node/src/domain/executions/runExecution.ts` | Top-level Node preflight failure before dispatch | PR-2 / Phase 3 |
| `apps/node/src/cli/commands/serve.ts` | HTTP status mapping plus `operatorPackage` handling for skill-run route | PR-2 / Phase 3 and Phase 4 |
| `apps/node/src/mcp/tools/common.ts` | MCP normalization of the top-level preflight failure | PR-2 / Phase 3 |
| `apps/node/src/cli/commands/skills.ts` | CLI skill-wrapper pre-spawn readiness gate | PR-2 / Phase 4 |
| `apps/node/src/test/unit/runExecution.test.ts`, `apps/node/src/test/integration/serve.test.ts`, `apps/node/src/test/integration/mcp.test.ts`, `apps/node/src/test/unit/skills.test.ts` | Execution, serve, MCP, and wrapper regressions | PR-2 / Phase 3 and Phase 4 |
| `docs/skills/runtime.md`, `docs/skills/overview.md` | Public skills docs for wrapper-level readiness behavior | PR-2 / Phase 4 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Doctor check sequencing and reporting | `apps/node/src/domain/doctor/DoctorService.ts`, `apps/node/src/domain/doctor/checks/`, `apps/node/src/domain/doctor/criticalChecks.ts` |
| New interactive-state foundation this pack depends on | `tasks/android/device-interactivity-foundation/plan.md` and the code it points to |
| Direct execution preflight and runtime result contract | `apps/node/src/domain/executions/runExecution.ts`, `apps/node/src/contracts/result.ts` |
| Skill wrapper and process-launch boundary | `apps/node/src/cli/commands/skills.ts`, `apps/node/src/domain/skills/runSkill.ts` |
| Serve skill-run route and HTTP mapping | `apps/node/src/cli/commands/serve.ts` |
| MCP normalization path | `apps/node/src/mcp/tools/common.ts` |
| Stable error codes | `apps/node/src/contracts/errors.ts` |
| Public authored docs | `docs/api/doctor.md`, `docs/api/errors.md`, `docs/api/overview.md`, `docs/skills/runtime.md`, `docs/skills/overview.md` |
| Reviewed architecture rationale for this task | `tasks/api/doctor-enhancements/findings.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- The failing predicate is `device not interactive`, not `device locked`
- The stable public error code is `DEVICE_NOT_INTERACTIVE`
- The doctor check must be target-specific to resolved `deviceId` plus chosen
  `operatorPackage`
- The doctor check is critical and therefore must affect `criticalOk`
- Node preflight failure for this condition is a top-level `ok: false` result
  before Android dispatch
- High-level skill wrappers do require a pre-spawn readiness gate
- Direct script helpers remain thin and inherit low-level failure on their first
  internal `clawperator exec` call
- `POST /skills/:skillId/run` must accept optional `operatorPackage`
- Serve must map `DEVICE_NOT_INTERACTIVE` deliberately to `409`, not fall
  through to `500`
- MCP tools must return an MCP error result for the top-level preflight failure
- Android envelope-level enforcement remains out of scope for this pack

**Judgment required:**

- The exact helper/file boundary for the shared Node interactive-state probe, as
  long as it does not duplicate the full doctor sequence
- The exact doctor-check summary/detail wording that best matches shipped
  behavior
- Whether `docs/api/overview.md` needs a short contract note or a fuller error
  discussion after the specific diff is visible

## Decision Rules

| Question | Rule |
| --- | --- |
| What is the doctor check id? | Use `readiness.device.interactive` so it matches existing `readiness.*` naming. |
| What evidence must the doctor check expose? | `deviceLocked`, `screenOn`, and `userUnlocked`. Do not collapse them into one derived string. |
| What code should doctor and Node use? | `DEVICE_NOT_INTERACTIVE`. Do not introduce a narrower `DEVICE_LOCKED` code for this pack. |
| Does this pack call the full doctor sequence before every command? | No. Use the narrow interactive-state probe only. |
| Where does top-level Node enforcement happen? | In `runExecution()` for direct execution entrypoints, plus explicit pre-spawn gates in CLI/HTTP high-level skill wrappers. |
| How should serve map the new top-level error? | HTTP `409 Conflict`. |
| How should `/skills/:skillId/run` resolve `operatorPackage`? | Explicit request value first, then the same request-independent default resolution used elsewhere in serve. |
| What happens to direct helper-driven skill scripts? | They stay thin and fail deterministically on the first internal CLI call. |
| How should accepted race conditions be handled? | Document them. Do not add Android envelope authority in this pack. |

## Failure Modes To Prevent

- Reintroducing multiple readiness authorities by calling the full doctor flow
  before every command
- Surfacing `device locked` as the contract when the real predicate is broader
- Adding doctor reporting without making the check critical
- Returning `500` from serve for the new preflight failure
- Letting `/skills/:skillId/run` drift from CLI behavior because it still cannot
  express `operatorPackage`
- Making `runSkill()` a readiness authority instead of keeping it a launcher
- Breaking MCP behavior by letting the new top-level Node failure fall through
  unnormalized
- Updating code without the paired authored docs

## Output Contract

After PR-1:

- `doctor --json` includes a critical `readiness.device.interactive` check
- the new check reports `DEVICE_NOT_INTERACTIVE` when the resolved target is not
  interactive
- the check evidence includes `deviceLocked`, `screenOn`, and `userUnlocked`
- `criticalOk` becomes `false` when this new check fails
- public doctor/error docs describe the new check and error code

After PR-2:

- `runExecution()` returns top-level `ok: false` with `DEVICE_NOT_INTERACTIVE`
  before dispatch when the resolved target is not interactive
- serve execution routes map that error to `409`
- MCP tools surface that condition as an MCP error result
- CLI `skills run` and HTTP `POST /skills/:skillId/run` fail before skill spawn
  with the same readiness contract
- the serve skill-run route accepts and propagates optional `operatorPackage`
- authored skills docs describe the wrapper-level readiness behavior

## Idempotency

- Re-running the doctor command against the same target reports the current
  interactive state without mutating device state
- Re-running the Node preflight against a non-interactive target fails
  consistently before dispatch
- Re-running high-level skill-wrapper preflight does not mutate the device; it
  only blocks or allows process spawn based on the current target state

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Public readiness and doctor contract | `docs/api/doctor.md`, `docs/api/errors.md`, `docs/api/overview.md` |
| Public skill-wrapper readiness behavior | `docs/skills/runtime.md`, `docs/skills/overview.md` |
| Internal target-state/wake semantics | `docs/internal/android/device-locked-reference.md` |
| Task-scoped reviewed architecture analysis until cleanup | `tasks/api/doctor-enhancements/findings.md` |
