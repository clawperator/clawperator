# Inspect and disambiguate UI selectors Work Breakdown

Parent plan: `tasks/selector-inspection/plan.md`

## Executive Summary

2 PR(s), 2 phase(s); phase N ships in PR-N. Implementation has not started. Each phase includes its own tests and docs. Do not start PR-2 until PR-1 is merged.

## Status

| Item | Value |
| --- | --- |
| State | Not started |
| Total PRs | 2 |
| Total phases | 2 |
| Completed | None |
| Remaining | 1-2 |
| Current / Next | Phase 1 |
| Blockers | None |

## Hard Rules

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
| Stable task contract | `tasks/selector-inspection/plan.md` |
| Selector contract | `apps/node/src/contracts/selectors.ts` |
| Validation | `apps/node/src/domain/executions/validateExecution.ts` |
| Android matcher | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/NodeMatcher.kt` |
| Tree model | `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiNode.kt` |
| Tree filtering | `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeFiltererDefault.kt` |
| Action scope | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` |
| Action engine | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` |
| Parser | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` |
| Existing Android tests | `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/NodeMatcherTest.kt` |
| Node tests | `apps/node/src/test/unit/selectorFlags.test.ts` |
| Public docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |
| Existing public contract exemplar (match its examples and caveats) | `docs/api/navigation.md` |
| Generated docs workflow | `.agents/skills/docs-build/SKILL.md` |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Structured inspection and relational resolution | 1 | thinking | None |
| PR-2 | Strict action resolution | 2 | default | PR-1 merged |

## Phase 1: Structured inspection and relational resolution

### Agent Tier

thinking

### Goal

Ship read-only queries and the shared resolver.

### Files or Surfaces To Change

- `apps/node/src/contracts/selectors.ts`
- `apps/node/src/contracts/execution.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/domain/executions/validateExecution.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/selectorFlags.ts`
- `apps/node/src/cli/commands/action.ts`
- `apps/node/src/domain/actions/`
- `apps/node/src/mcp/selectors.ts`
- `apps/node/src/mcp/tools/named.ts`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/accessibilityservice/AccessibilityNodeInfoExtAndroid.kt`
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- `apps/node/src/test/unit/selectorFlags.test.ts`
- `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/NodeMatcherTest.kt`
- `docs/api/selectors.md`
- `docs/api/actions.md`
- `docs/api/mcp.md`

### Steps

1. Add shared predicate/resolver and NodeSummary serialization. Use platform state/hints; add capture fields to UiNode only when needed. Preserve semantics of existing fields.
2. Add raw query action through both validators, Kotlin parser/model/engine, CLI registry/dispatch/help, and MCP registration. Existing actions must still work on legacy defaults.
3. Build generic nested-tree fixtures with identical IDs/bounds, separate unique descendants, empty-label switches, and offscreen nodes. Verify source order and captured state.
4. Add all below tests in this PR and publish query/relationship semantics. Live-query Settings with an explicit target; compare selected query states with XML and a screenshot.

### Acceptance Criteria

- Empty-label switches count as nodes, while missing nodes yield totalMatches 0.
- Ancestor and descendant AND semantics isolate the intended subtree; self never satisfies relationship.
- Unknown state stays null, checked false stays false, duplicate paths are unique within one snapshot.
- Visibility all versus on_screen, limit truncation, malformed matcher JSON, nested predicates, invalid/missing flag values, and CLI/MCP/raw parity are covered.
- Raw XML remains available with additive visibility metadata; no guessed occlusion filter is introduced.
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
node apps/node/dist/cli/index.js open com.android.settings --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev
node apps/node/dist/cli/index.js query --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev --visibility all --limit 100

```

### Expected Commit

```text
feat(selectors): add structured node queries
```

## Phase 2: Strict action resolution

### Agent Tier

default

### Goal

Make ambiguous actions fail before dispatch when strict is requested.

### Files or Surfaces To Change

- `apps/node/src/contracts/execution.ts`
- `apps/node/src/domain/executions/validateExecution.ts`
- `apps/node/src/cli/selectorFlags.ts`
- `apps/node/src/cli/commands/action.ts`
- `apps/node/src/domain/actions/`
- `apps/node/src/mcp/schemas.ts`
- `apps/node/src/mcp/tools/named.ts`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/`
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt`
- `apps/node/src/test/unit/validateExecution.test.ts`
- `docs/api/selectors.md`
- `docs/api/actions.md`
- `docs/api/errors.md`

### Steps

1. After PR-1 merges, thread strict and explicit container matching through every action named in the plan. Reuse the query resolver; do not implement alternate candidate counting.
2. Add NODE_AMBIGUOUS and CONTAINER_AMBIGUOUS across error contracts. Include candidate count and bounded summaries in data without nested objects; use serialized JSON strings.
3. Unit-test dispatch spies to prove ambiguous/no-match requests perform zero gestures. Test scroll target scoping and container re-resolution after layout change.
4. Live-inspect a target, perform a strict unique interaction, and assert its observable postcondition. Retain fixture-based proof for duplicate containers rather than claiming a generic screen must exhibit them. Publish compatibility guidance.

### Acceptance Criteria

- Zero, one, and two target matches have the exact decision-table outcomes.
- Container ambiguity is rejected before child selection; read all permits many targets only in a unique scope.
- A query followed by a changed tree cannot authorize a stale target; strict resolution runs again.
- Every listed action propagates strict consistently across CLI, raw execution, and MCP; legacy omitted strict retains behavior.
- New fields have valid, invalid, missing-value, and conflicting-selector tests.
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
feat(selectors): reject ambiguous strict actions
```

## Execution Findings

Create `findings.md` at the start of the first phase, before source edits. Use these sections in order: Environment and Versions; Reproduction Inputs; Observed Results (command, exit code, JSON fields, artifact paths); Source Mapping; Decisions and Deviations; Validation (case, expected, actual, pass/fail/blocked); Remaining Work. Append phase-specific results before its commit. Do not paste sensitive or application-specific captures. Keep raw local evidence outside tracked files and use generic reproduction fixtures in tests.
