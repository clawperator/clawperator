# Preserve scaffold execution failures

## Executive Summary

Make generated skill scripts preserve failed child-process status and diagnostic streams. This pack has 1 PR(s), one phase per PR, and is not started. All implementation, tests, and public documentation ship together.

## Status

| Item | Value |
| --- | --- |
| State | Not started |
| Total PRs | 1 |
| Total phases | 1 |
| Completed | None |
| Remaining | 1-1 |
| Current / Next | Phase 1 |
| Blockers | None |

## Goal

Make generated skill scripts preserve failed child-process status and diagnostic streams.

## Why Now

The current generated catch block prints stdout and exits zero whenever stdout is nonempty, masking failed executions. Existing scaffold tests cover generation and command resolution but not this failure case.

## In Scope

Generated run.js error handling, subprocess regression tests, and aligned authoring guidance.

## Out of Scope

Rewriting existing user skills, changing the SkillResult protocol, and adding test-runner policy.

## Existing Artifact Scope

Extend only the existing surfaces named below and the explicitly named new files. Preserve unrelated commands, skills, and documentation. Do not edit other active task packs or implement their work incidentally.

## Surfaces and Ownership

| Surface | Owner |
| --- | --- |
| Generated script template | Node skills domain |
| Author guidance | docs/skills |

## Source Of Truth

| Topic | Authority |
| --- | --- |
| Template | `apps/node/src/domain/skills/scaffoldSkill.ts` |
| Existing subprocess tests | `apps/node/src/test/unit/skills.test.ts` |
| Skills runtime | `apps/node/src/domain/skills/runSkill.ts` |
| Authoring documentation | `docs/skills/authoring.md` |

The inspected baseline is main commit `5d23af5`. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck these source seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Deterministic Versus Judgment

Apply the output contract and decision rules verbatim. Implementation structure and explanatory prose permit judgment. If a required platform capability is unavailable, record evidence and stop the affected phase; do not silently change the public contract. Routine internal refactors may proceed within scope with findings recorded.

## Decision Rules

| Child outcome | Generated script behavior |
| --- | --- |
| Exit 0 | Forward stdout and stderr; exit 0 |
| Nonzero numeric exit | Forward both streams once; preserve exit code |
| Signal, timeout, spawn failure, or unusable exit status | Forward available streams; exit 1 with a concise stderr reason |
| Failed child produced valid JSON | Preserve JSON; still fail |
| Failed child produced non-JSON output | Preserve output; still fail |

## Failure Modes To Prevent

False success, loss of original failure evidence, duplicated contract logic, and tests that only check whether a code path ran.

## Output Contract

Use process status as the template authority. Do not parse human output to decide success. Do not turn a failed child into success because an envelope was printable. Successful-process stdout remains byte-for-byte unchanged. Preserve existing CLI resolution, quoted paths, device arguments, and timeout limits. Signal-derived failures normalize to exit 1; do not invent platform-specific exit codes. Existing generated skills are not silently migrated.

## Idempotency

Reruns must preserve the stated semantics. IDs and capture timestamps may change; existing user artifacts must not be overwritten.

## Durable Follow-Up

Publish the contract in the authored docs named in the phase. Keep regression fixtures and tests in the source tree. Use `.agents/skills/task-cleanup/SKILL.md` only after all PRs are complete and durable guidance has migrated; do not delete this pack between PRs.
