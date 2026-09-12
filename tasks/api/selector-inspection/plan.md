# Inspect and disambiguate UI selectors

## Goal and Scope

Provide structured node-state inspection and opt-in strict, relationally scoped actions using one Android resolver.

Raw hierarchies can contain duplicate containers with identical IDs and bounds. Text reads discard blank labels, so read --all count is not node count. First-match action selection conceals ambiguity.

Typed node query; ancestor/descendant constraints; state fields; strict selection for node-targeted actions; CLI/raw execution/MCP parity.

Excluded: Pixel-based occlusion detection, choosing the last or largest node heuristically, persistent node handles, autonomous retry strategy, and changing legacy first-match defaults.

## Status

| Item | Value |
| --- | --- |
| State | PR-1 [DONE] through `cc4aafc`; cleanup complete |
| Total PRs | 2 |
| Total phases | 2 |
| Completed | Phase 1 [DONE] |
| Remaining | Phase 2 |
| Current / Next | Phase 2, on a base containing PR-1 |
| Prerequisite | Verify PR-1 is present in the implementation base |

## Sources

| Topic | Authority |
| --- | --- |
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

Initial investigation used `5d23af5`; the final task audit used merged main `120c1eb`, including the shipped on-screen-log raw API. Preserve its controller-owned overlay identity, visibility metadata, canonical error codes, and strict input aliases. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck affected seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Behavior and Decisions

| Request | Behavior |
| --- | --- |
| query_ui without matcher | Return all nodes eligible under requested visibility |
| Query matches 0 / 1 / many | Success with truthful count and structured states |
| strict=true and click/text/single-read candidates 0 after existing retries | NODE_NOT_FOUND; no dispatch |
| strict=true and final action candidates >1 | NODE_AMBIGUOUS; no dispatch |
| Explicit container resolves to 0 / >1 under strict | CONTAINER_NOT_FOUND / CONTAINER_AMBIGUOUS; no dispatch |
| wait_for_node target absent | Keep polling within the existing timeout; strict rejects ambiguity, not absence while waiting |
| scroll_until / scroll_and_click target absent | Continue bounded scrolling in a uniquely resolved container; absence is the search condition |
| read_text all=true with zero targets | Return the existing empty result; enforce only explicit-container uniqueness |
| Exactly one candidate | Resolve fresh and perform existing action mechanism |
| strict omitted or false | Preserve existing selection and retry defaults |
| Platform reports visible | Report platform visibility; never promise visual non-occlusion |

PR-1 [DONE] provides the shared Android resolver, structured `query_ui`,
`NodeSummary`, and relational `NodeMatcher`. Reuse the implemented contracts in
[selectors](../../../docs/api/selectors.md) and
[query_ui](../../../docs/api/actions.md#action-query-ui). The
[internal design](../../../docs/internal/design/selector-inspection.md) records
structural ancestry, visibility, stable capture paths, nullable state, and
transport invariants. Do not reimplement these delivered surfaces in PR-2.

PR-2 adds `params.strict?:boolean` to the listed raw actions, CLI `--strict` and `--container-json`, and matching MCP schemas for click, enter_text, read_text, wait_for_node, scroll, scroll_until, scroll_and_click. Apply strict to explicitly supplied container and target resolvers; read_text with all=true intentionally permits many target matches but still enforces unique explicit container. For scroll without an explicit container, strict requires one eligible scrollable candidate. Coordinate click with strict is invalid. For actions that do not currently consume params.container, wire that existing field through parser, action model, and task scope in PR-2. Container scoping searches strict descendants. Explicit container selection with legacy strict=false preserves first-match behavior. A container predicate may use ancestor/descendant constraints from PR-1. Scroll-loop target checks must stay within the selected container. Fresh resolution at dispatch is mandatory; changed counts fail instead of reusing an earlier query result. No new persistent accessibility references cross the bridge.

## Repeatability

Queries are read-only, with fresh observation IDs/timestamps. Strict selection is a dispatch guard, not an idempotency guarantee for the underlying action. Never replay mutations after uncertain post-dispatch loss.

## Durable Outputs

The work breakdown names the authored docs and regression coverage that ship with this contract. Keep implementation findings here only until the pack is complete; migrate lasting guidance before retiring it.


## PR-1 handoff additions

The implemented query path also reports typed `UI_TREE_UNAVAILABLE`, retains
completed steps and the failed query, and stops later actions when no hierarchy
is available. Public behavior is documented in
[query_ui](../../../docs/api/actions.md#action-query-ui). Preserve this behavior
while adding strict actions; broader failure preservation remains R6 scope.

The separate sensitive-root access issue is explicitly parked; see
[its durable findings and next step](../../../docs/internal/design/accessibility-hierarchy.md).
PR-1 is treated as landed for cleanup at the user's direction; this is not a
claim about remote merge status. Its implementation prompt is retired. Keep the
remaining PR-2 plan until that work ships; cleanup does not authorize its
implementation. Verify the implementation base contains PR-1 before starting.
