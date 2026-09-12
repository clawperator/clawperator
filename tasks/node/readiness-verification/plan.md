# Verify selected Operator readiness

## Executive Summary

Ensure doctor success proves readiness of the selected device and Operator package. This pack has one PR and one phase, and is not started. All implementation, tests, and public documentation ship together.

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

## Goal

Ensure doctor success proves readiness of the selected device and Operator package.

## Why Now

A variant mismatch can currently be a warning while handshake is omitted and criticalOk remains true. DoctorService.finalize checks only failures among checks that happened to run.

## In Scope

Readiness aggregation, explicit prerequisite skips, variant mismatch severity, CLI exit codes, resolved log-destination diagnostics, and generic preparation guidance.

## Out of Scope

Automatic package switching, uninstalling another variant, changing default application roles automatically, and solving every restricted system dialog.

## Existing Artifact Scope

Extend only the existing surfaces named below and the explicitly named new files. Preserve unrelated commands, skills, and documentation. Do not edit other active task packs or implement their work incidentally.

## Surfaces and Ownership

| Surface | Owner |
| --- | --- |
| Readiness policy and CLI | Node doctor domain |
| Device provisioning recipes | Setup documentation |

## Source Of Truth

| Topic | Authority |
| --- | --- |
| Aggregation | `apps/node/src/domain/doctor/DoctorService.ts` |
| Critical checks | `apps/node/src/domain/doctor/criticalChecks.ts` |
| Checks | `apps/node/src/domain/doctor/checks/readinessChecks.ts` |
| Logger configuration and fail-open behavior | `apps/node/src/adapters/logger.ts` |
| Report contract | `apps/node/src/contracts/doctor.ts` |
| Existing tests | `apps/node/src/test/unit/doctor/DoctorService.test.ts` |
| CLI tests | `apps/node/src/test/unit/doctorCommand.test.ts` |

Initial investigation used `5d23af5`; the final task audit used merged main `120c1eb`, including the shipped on-screen-log raw API. Preserve its controller-owned overlay identity, visibility metadata, canonical error codes, and strict input aliases. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck these source seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Deterministic Versus Judgment

Apply the output contract and decision rules verbatim. Implementation structure and explanatory prose permit judgment. If a required platform capability is unavailable, record evidence and stop the affected phase; do not silently change the public contract. Routine internal refactors may proceed within scope with findings recorded.

## Decision Rules

| Condition | Required result |
| --- | --- |
| Selected APK missing, even if another variant exists | fail with OPERATOR_NOT_INSTALLED or existing OPERATOR_VARIANT_MISMATCH; no implicit switch |
| Readiness handshake missing, skipped, failed, or version not verified | ok=false and criticalOk=false |
| Required checks pass, optional host-agent warning present | ok=true and criticalOk=true |
| Full mode requested but build/install/smoke incomplete | ok=false and criticalOk=false |
| Remediation attempted | Never report ready using pre-remediation results; rerun the affected prerequisites and handshake before success |

## Failure Modes To Prevent

False success, loss of original failure evidence, duplicated contract logic, and tests that only check whether a code path ran.

## Output Contract

Preserve existing report fields. Add `skippedChecks: Array<{id:string, reason:string, blockedBy:string[]}>` for downstream checks omitted because of prerequisites. Keep DoctorStatus pass/warn/fail; skips are a separate report field. Required IDs for the selected mode live in one shared source-owned definition used by execution and aggregation, not duplicated string lists. Existing early-exit checks remain observable. `ok` and `criticalOk` agree; doctor exits nonzero when false. An advisory warning unrelated to actuation cannot make a healthy device fail. No new device-role API is needed. The docs recipe should show `adb -s "$DEVICE_ID" shell cmd role help`, `cmd role get-role-holders --user 0 android.app.role.BROWSER`, `cmd role add-role-holder --user 0 android.app.role.BROWSER "$APPLICATION_ID"`, and the same get-role-holders readback (all using explicitly targeted adb shell). A nonzero assignment or mismatched readback is preparation failure. Do not run role assignment as part of doctor. Document shell capability inspection, role assignment, and readback as caller-controlled preparation, using neutral package placeholders and stating tested platform limits.

Expose an advisory `host.logs.writable` check using the same resolved destination and precedence as `createClawperatorLogger`. Extract one shared destination resolver rather than duplicating environment/default logic. Include `evidence:{logDir,logPath,writable}` and `LOG_DIRECTORY_UNWRITABLE` on warning. Probe the actual daily destination via an append/open without truncation, closing any handle; preserve the logger's fail-open behavior and stderr-only warning. Use the normal logger entry for the check rather than artificial test log content. If a directory/file cannot be created or opened, report the exact attempted destination and the existing `CLAWPERATOR_LOG_DIR` remedy. No silent redirection, forced permissions, or failure of otherwise healthy actuation. Test failures with an injected filesystem seam so root privileges cannot invalidate the test.

## Idempotency

Reruns must preserve the stated semantics. IDs and capture timestamps may change; existing user artifacts must not be overwritten.

## Durable Follow-Up

Publish the contract in the authored docs named in the phase. Keep regression fixtures and tests in the source tree. Use `.agents/skills/task-cleanup/SKILL.md` only after all PRs are complete and durable guidance has migrated; do not delete this pack between PRs.
