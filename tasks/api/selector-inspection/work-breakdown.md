# Inspect and disambiguate UI selectors Implementation

Contract: [plan.md](plan.md). Dependencies and release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## PR Scope

| PR | Purpose | Phase | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Structured inspection and relational resolution | 1 | None |
| PR-2 | Strict action resolution | 2 | PR-1 merged |

Implement the requested PR through its acceptance criteria, relevant checks, in-scope repairs, docs, and local commits. A dependency becoming available does not authorize the next PR. Routine implementation choices are yours; raise only decisions that change the contract or scope.

## PR-1: Structured inspection and relational resolution [DONE]

Implementation: `31ef1c2`; query failure follow-up: `cc4aafc`.
Cleanup treats this PR as landed at the user's direction; actual remote merge
status is not asserted here. Completed implementation instructions are retired.

### PR-1 validation and handoff

Validated revision: runtime implementation through `cc4aafc`; subsequent changes
are documentation only.

- Node build and standard suite: 306 passed. Initial broad focused suite: 345
  passed; query/transport/MCP follow-up suite: 53 passed.
- Android debug build and full debug unit suite: 402 tests, zero failures/errors,
  four existing skips. Parser tests run from active `src/test/kotlin` sources.
- Docs build, route checks, and diff checks passed.
- Matching development APK on an Android 15/API 35 arm64 emulator: structured
  counts/limits, blank labels, original visibility paths, fresh capture IDs,
  combined relationships, CLI/raw/MCP parity, and large result transport passed.
  Dark theme switch bounds and seven state fields matched XML and screenshot;
  a relational click changed state and was restored. A bounded wait followed by
  a relational query found the destination row.
- Offline fixtures cover duplicate identity/bounds, unknown versus false,
  relationship self exclusion, hidden descendants, pruned ancestors, repeated
  filtering, malformed inputs, and the UTF-8 response guard. Failure tests and
  live execution verify retained steps, terminal correlation, skipped later
  actions, and cancellation propagation.
- No sibling skill migration was needed. Live compatibility beyond API 35 and
  live overflow/corruption cases remain unproven; their offline checks passed.

Durable rationale: [selector inspection design](../../../docs/internal/design/selector-inspection.md).
Public contracts are in [actions](../../../docs/api/actions.md#action-query-ui),
[selectors](../../../docs/api/selectors.md), and [MCP](../../../docs/api/mcp.md).
Temporary device captures and build logs are not required handoff artifacts.

### Gap dispositions

- **R10 locally complete, pending merge/manual release CI:** sensitive Internet hierarchy access
  and per-node sensitivity metadata. Preserve the additive fields; the contract,
  implementation decision, and validation are in
  [accessibility hierarchy availability](../../../docs/internal/design/accessibility-hierarchy.md).
  This remains outside R4/R5.
- **Defer to skill workstream:** 19 failures in an extra flat `skills.test.ts` run
  reproduced by name on unchanged base `654d333`. Investigate missing SkillResult
  `result` fields and pretty-output/banner expectations, then rerun that file.
  These are not failures in the standard suite or selector regressions.
- **Accept:** queries observe once; callers use bounded waits for navigation.
  Public docs and live verification cover this intended behavior.
- **Delivered:** typed `UI_TREE_UNAVAILABLE` for queries, retained prior steps,
  failed query identity, and service/window diagnostics. General action failures
  and timeout evidence remain R6 work; reuse the existing result fields.

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
