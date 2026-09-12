# Inspect and disambiguate UI selectors Implementation

Contract: [plan.md](plan.md). Dependencies and release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## PR Scope

| PR | Purpose | Phase | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Structured inspection and relational resolution | 1 | None |
| PR-2 | Strict action resolution | 2 | PR-1 merged |

Implement the requested PR through its acceptance criteria, relevant checks, in-scope repairs, docs, and local commits. A dependency becoming available does not authorize the next PR. Routine implementation choices are yours; raise only decisions that change the contract or scope.

## PR-1: Structured inspection and relational resolution

Ship read-only queries and the shared resolver.

### Work

- Add shared predicate/resolver and NodeSummary serialization. Use platform state/hints; add capture fields to UiNode only when needed. Preserve semantics of existing fields.
- Add raw query action through both validators, Kotlin parser/model/engine, CLI registry/dispatch/help, and MCP registration. Existing actions must still work on legacy defaults.
- Build generic nested-tree fixtures with identical IDs/bounds, separate unique descendants, empty-label switches, and offscreen nodes. Verify source order and captured state.
- Publish query/relationship semantics. Live-query Settings with an explicit target; compare selected query states with XML and a screenshot.

### Affected Sources

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

### Acceptance Evidence

- Empty-label switches count as nodes, while missing nodes yield totalMatches 0.
- Ancestor and descendant AND semantics isolate the intended subtree; self never satisfies relationship.
- Unknown state stays null, checked false stays false, duplicate paths are unique within one snapshot.
- Empty predicates, hidden descendant labels, a pruned ancestor, response overflow, visibility all versus on_screen, limit truncation, malformed matcher JSON, nested predicates, invalid/missing flag values, and CLI/MCP/raw parity are covered.
- Raw XML remains available with additive visibility metadata; no guessed occlusion filter is introduced.

### Live Entry Points

Use these for the device proof described above, after building the matching tools. They do not replace the acceptance assertions.

```sh
# Set DEVICE_ID to a dedicated, connected test target before these commands.
: "${DEVICE_ID:?Select a dedicated test device}"
ANDROID_SERIAL="$DEVICE_ID" ./gradlew :app:installDebug
adb -s "$DEVICE_ID" shell monkey -p com.clawperator.operator.dev -c android.intent.category.LAUNCHER 1
node apps/node/dist/cli/index.js doctor --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev
node apps/node/dist/cli/index.js open com.android.settings --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev
node apps/node/dist/cli/index.js query --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev --visibility all --limit 100
```

## PR-2: Strict action resolution

Make ambiguous actions fail before dispatch when strict is requested.

### Work

- After PR-1 merges, thread strict and explicit container matching through every action named in the plan. Reuse the query resolver; do not implement alternate candidate counting.
- Add NODE_AMBIGUOUS and CONTAINER_AMBIGUOUS across error contracts. Include candidate count and bounded summaries in data without nested objects; use serialized JSON strings.
- Use dispatch spies to prove ambiguous requests perform no gestures and missing targets prevent immediate target actions; bounded wait/search behavior follows the action-specific contract. Test scroll target scoping and container re-resolution after layout change.
- Live-inspect a target, perform a strict unique interaction, and assert its observable postcondition. Retain fixture-based proof for duplicate containers rather than claiming a generic screen must exhibit them. Publish compatibility guidance.

### Affected Sources

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

### Acceptance Evidence

- Zero, one, and two target matches have the action-specific decision-table outcomes. With a fake clock/tree sequence, prove a strict wait succeeds when a unique target appears later; prove strict scroll search advances while the target is absent and stops when it appears. Ambiguity always dispatches zero target actions.
- Container ambiguity is rejected before child selection; read all permits many targets only in a unique scope.
- A query followed by a changed tree cannot authorize a stale target; strict resolution runs again.
- Every listed action propagates strict consistently across CLI, raw execution, and MCP; legacy omitted strict retains behavior.
- New fields have valid, invalid, missing-value, and conflicting-selector tests.

### Live Entry Points

Use these for the device proof described above, after building the matching tools. They do not replace the acceptance assertions.

```sh
# Set DEVICE_ID to a dedicated, connected test target before these commands.
: "${DEVICE_ID:?Select a dedicated test device}"
ANDROID_SERIAL="$DEVICE_ID" ./gradlew :app:installDebug
adb -s "$DEVICE_ID" shell monkey -p com.clawperator.operator.dev -c android.intent.category.LAUNCHER 1
node apps/node/dist/cli/index.js doctor --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev
```

## Validation and Completion

Use AGENTS.md for shared validation policy. Build Node before tests that consume dist. Relevant checks for this pack are:

```sh
./gradlew :app:assembleDebug
./gradlew testDebugUnitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
```

Live verification requires a dedicated, explicitly selected device, an unlocked screen, enabled accessibility, and the matching debug Operator. Offline tests prove the stated contracts; device checks prove integration and pixels. Record unavailable live evidence rather than treating it as passed.

Use `.agents/skills/docs-author/SKILL.md` for the named public docs and `.agents/skills/docs-build/SKILL.md` for regeneration. Run checks for each behavior change; repeat successful checks only after new changes or an unresolved integration concern.

Keep concise findings with versions, reproduction inputs, observed results/artifact paths, decisions, and remaining limitations. Preserve private captures outside tracked files. Update progress and commit validated logical units. Completion includes correcting in-scope failures, not merely producing a first implementation.
