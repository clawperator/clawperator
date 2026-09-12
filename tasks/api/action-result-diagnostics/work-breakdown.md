# Report action outcomes and failures precisely Work Breakdown

Parent plan: `tasks/api/action-result-diagnostics/plan.md`

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
| Blockers | Await both PRs in `tasks/api/selector-inspection` |

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
| Stable task contract | `tasks/api/action-result-diagnostics/plan.md` |
| Engine | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` |
| UI actions | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` |
| Dispatch mechanism | `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` |
| Envelope publication | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandExecutorDefault.kt` |
| Envelope contract | `apps/node/src/contracts/result.ts` |
| Node parser | `apps/node/src/adapters/android-bridge/envelopeParser.ts` |
| Existing tests | `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt` |
| Node exit tests | `apps/node/src/test/unit/cliExitCode.test.ts` |
| Public docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |
| Existing public contract exemplar (match its examples and caveats) | `docs/api/navigation.md` |
| Generated docs workflow | `.agents/skills/docs-build/SKILL.md` |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Receipts and failure preservation | 1 | thinking | Await both PRs in `tasks/api/selector-inspection` |

## Phase 1: Receipts and failure preservation

### Agent Tier

thinking

### Goal

Ship bounded, truthful action diagnostics.

### Files or Surfaces To Change

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/`
- `apps/node/src/contracts/result.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/adapters/android-bridge/envelopeParser.ts`
- `apps/node/src/cli/output.ts`
- `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt`
- `apps/node/src/test/unit/envelopeParser.test.ts`
- `apps/node/src/test/unit/cliExitCode.test.ts`
- `docs/api/actions.md`
- `docs/api/errors.md`
- `docs/api/overview.md`

### Steps

1. Rebase onto merged selector work. Trace current thrown-failure and returned-failure behavior before editing; preserve ordering policy and capture completed steps on thrown failures.
2. Thread actual resolution/dispatch receipts through UI manager and task engine; use the selector NodeSummary serializer.
3. Replace misleading scroll classifications and update every consumer of TaskScrollOutcome and termination reasons. Add missing unit tests beside behavior changes.
4. Use generic fixtures for a wrapper click with no postcondition, duplicate layered containers, missing progress signatures, and disappearing containers. Live verify unique click plus wait and scroll plus before/after observation.
5. Update result/action/error docs with explicit action-versus-assertion semantics and compatibility notes for new scroll enum values. Audit sibling skill consumers only for affected contracts; if a consumer requires changes, update its version and smoke checks in lockstep per AGENTS.md.

### Acceptance Criteria

- A wait timeout after one completed step retains both that step and one failed wait result with WAIT_TIMEOUT.
- Missing-root diagnostics distinguish unavailable service/root/metadata, and do not make the app root a prerequisite for raw overlay actions. Existing ON_SCREEN_LOG_* failures remain unchanged.
- Known missing root and target failures carry codes; unknown exceptions preserve text; timeout/cancellation emits one terminal result.
- Ancestor-click and coordinate-fallback receipts name the actual dispatch target/method while retaining the matched target.
- Click accepted without screen change remains accepted, never a fabricated verified success.
- Lost/missing/unchanged/changed scroll evidence maps exactly to the table; loops stay bounded and strict ambiguous container dispatch count is zero.
- Node CLI exits nonzero on failed terminal envelopes while preserving JSON and correlation IDs.
- Human review: output accuracy matches observed evidence; scope covers the named surfaces only; important claims trace to tests or findings; schema, section order, and public help match the contract.

### Validation

Run from repository root, in order. Unit/subprocess tests are the primary reproducible gate. Live checks prove device integration only and require a dedicated target with the matching debug Operator, enabled accessibility, and an unlocked screen. A skipped live check is not a pass; record its unmet prerequisite.

```sh
./gradlew :app:assembleDebug
./gradlew testDebugUnitTest
npm --prefix apps/node ci
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
# Set DEVICE_ID to a dedicated, connected test target before these commands.
: "${DEVICE_ID:?Select a dedicated test device}"
ANDROID_SERIAL="$DEVICE_ID" ./gradlew :app:installDebug
adb -s "$DEVICE_ID" shell monkey -p com.clawperator.operator.dev -c android.intent.category.LAUNCHER 1
node apps/node/dist/cli/index.js doctor --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev
```

### Expected Commit

```text
fix(runtime): preserve precise action outcome evidence
```

## Execution Findings

Create `findings.md` at the start of the first phase, before source edits. Use these sections in order: Environment and Versions; Reproduction Inputs; Observed Results (command, exit code, JSON fields, artifact paths); Source Mapping; Decisions and Deviations; Validation (case, expected, actual, pass/fail/blocked); Remaining Work. Append phase-specific results before its commit. Do not paste sensitive or application-specific captures. Keep raw local evidence outside tracked files and use generic reproduction fixtures in tests.
