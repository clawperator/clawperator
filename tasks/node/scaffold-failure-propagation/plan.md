# Preserve scaffold execution failures

## Goal and Scope

Make generated skill scripts preserve failed child-process status and diagnostic streams.

The current generated catch block prints stdout and exits zero whenever stdout is nonempty, masking failed executions. Existing scaffold tests cover generation and command resolution but not this failure case.

Generated run.js error handling, subprocess regression tests, and aligned authoring guidance.

Excluded: Rewriting existing user skills, changing the SkillResult protocol, and adding test-runner policy.

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

## Sources

| Topic | Authority |
| --- | --- |
| Template | `apps/node/src/domain/skills/scaffoldSkill.ts` |
| Existing subprocess tests | `apps/node/src/test/unit/skills.test.ts` |
| Skills runtime | `apps/node/src/domain/skills/runSkill.ts` |
| Authoring documentation | `docs/skills/authoring.md` |

Initial investigation used `5d23af5`; the final task audit used merged main `120c1eb`, including the shipped on-screen-log raw API. Preserve its controller-owned overlay identity, visibility metadata, canonical error codes, and strict input aliases. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck affected seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Behavior and Decisions

| Child outcome | Generated script behavior |
| --- | --- |
| Exit 0 | Forward stdout and stderr; exit 0 |
| Nonzero numeric exit | Forward both streams once; preserve exit code |
| Signal, timeout, spawn failure, or unusable exit status | Forward available streams; exit 1 with a concise stderr reason |
| Failed child produced valid JSON | Preserve JSON; still fail |
| Failed child produced non-JSON output | Preserve output; still fail |

Use process status as the template authority. Do not parse human output to decide success. Do not turn a failed child into success because an envelope was printable. Successful-process stdout remains byte-for-byte unchanged. Preserve existing CLI resolution, quoted paths, device arguments, and timeout limits. Signal-derived failures normalize to exit 1; do not invent platform-specific exit codes. Existing generated skills are not silently migrated.

## Durable Outputs

The work breakdown names the authored docs and regression coverage that ship with this contract. Keep implementation findings here only until the pack is complete; migrate lasting guidance before retiring it.
