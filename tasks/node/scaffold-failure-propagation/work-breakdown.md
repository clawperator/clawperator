# Preserve scaffold execution failures Work Breakdown

Parent plan: `tasks/node/scaffold-failure-propagation/plan.md`

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
| Stable task contract | `tasks/node/scaffold-failure-propagation/plan.md` |
| Template | `apps/node/src/domain/skills/scaffoldSkill.ts` |
| Existing subprocess tests | `apps/node/src/test/unit/skills.test.ts` |
| Skills runtime | `apps/node/src/domain/skills/runSkill.ts` |
| Authoring documentation | `docs/skills/authoring.md` |
| Public docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |
| Existing public contract exemplar (match its examples and caveats) | `docs/api/navigation.md` |
| Generated docs workflow | `.agents/skills/docs-build/SKILL.md` |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Template and subprocess proof | 1 | default | None |

## Phase 1: Template and subprocess proof

### Agent Tier

default

### Goal

Ship the narrow fix with tests of generated scripts.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `docs/skills/authoring.md`

### Steps

1. Generate a temporary skill using the real scaffold function. Run its actual generated script against a fake executable via CLAWPERATOR_BIN; do not test only template substrings.
2. Fix stream/status propagation. If retaining execFileSync makes successful stderr inaccessible, use spawnSync with the same timeout and argument array; preserve command resolution.
3. Cover all decision rows plus quoting and missing device regressions. Align the scaffold explanation with nonzero failure requirements.

### Acceptance Criteria

- Fake child exit 7 with JSON stdout and stderr causes generated script exit 7 with both streams intact once.
- Exit 0 with both streams preserves both; no stdout on failure still fails.
- ENOENT/spawn failure, signal termination, timeout handling, and non-JSON failure cannot exit zero. Use an injected short timeout seam or isolated helper test rather than waiting 120 seconds.
- No existing runtime skills are edited or silently regenerated.
- Human review: output accuracy matches observed evidence; scope covers the named surfaces only; important claims trace to tests or findings; schema, section order, and public help match the contract.

### Validation

Run from repository root, in order. Tests execute the real generated script against controlled child processes. No Android install or live device is required for this template-only change.

```sh
npm --prefix apps/node ci
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
```

### Expected Commit

```text
fix(skills): preserve scaffold child execution failures
```

## Execution Findings

Create `findings.md` at the start of the first phase, before source edits. Use these sections in order: Environment and Versions; Reproduction Inputs; Observed Results (command, exit code, JSON fields, artifact paths); Source Mapping; Decisions and Deviations; Validation (case, expected, actual, pass/fail/blocked); Remaining Work. Append phase-specific results before its commit. Do not paste sensitive or application-specific captures. Keep raw local evidence outside tracked files and use generic reproduction fixtures in tests.
