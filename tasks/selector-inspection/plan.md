# Inspect and disambiguate UI selectors

## Executive Summary

Provide structured node-state inspection and opt-in strict, relationally scoped actions using one Android resolver. This pack has 2 PR(s), one phase per PR, and is not started. Merge PR-1 before starting PR-2.

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

## Goal

Provide structured node-state inspection and opt-in strict, relationally scoped actions using one Android resolver.

## Why Now

Raw hierarchies can contain duplicate containers with identical IDs and bounds. Text reads discard blank labels, so read --all count is not node count. First-match action selection conceals ambiguity.

## In Scope

Typed node query; ancestor/descendant constraints; state fields; strict selection for node-targeted actions; CLI/raw execution/MCP parity.

## Out of Scope

Pixel-based occlusion detection, choosing the last or largest node heuristically, persistent node handles, autonomous retry strategy, and changing legacy first-match defaults.

## Existing Artifact Scope

Extend only the existing surfaces named below and the explicitly named new files. Preserve unrelated commands, skills, and documentation. Do not edit other active task packs or implement their work incidentally.

## Surfaces and Ownership

| Surface | Owner |
| --- | --- |
| Resolution and state | Android tree/task layers |
| Validation and presentation | Node contracts, CLI, MCP |

## Source Of Truth

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

The inspected baseline is main commit `5d23af5`. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck these source seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Deterministic Versus Judgment

Apply the output contract and decision rules verbatim. Implementation structure and explanatory prose permit judgment. If a required platform capability is unavailable, record evidence and stop the affected phase; do not silently change the public contract. Routine internal refactors may proceed within scope with findings recorded.

## Decision Rules

| Request | Behavior |
| --- | --- |
| query_ui without matcher | Return all nodes eligible under requested visibility |
| Query matches 0 / 1 / many | Success with truthful count and structured states |
| strict=true and final action candidates 0 | NODE_NOT_FOUND; no dispatch |
| strict=true and final action candidates >1 | NODE_AMBIGUOUS; no dispatch |
| Explicit container resolves to 0 / >1 under strict | CONTAINER_NOT_FOUND / CONTAINER_AMBIGUOUS; no dispatch |
| Exactly one candidate | Resolve fresh and perform existing action mechanism |
| strict omitted or false | Preserve existing selection and retry defaults |
| Platform reports visible | Report platform visibility; never promise visual non-occlusion |

## Failure Modes To Prevent

Confusing text count with node count; treating bounds as visual occlusion proof; silently selecting another node; returning persistent-looking handles; query/action resolution drift.

## Output Contract

Add leaf type `NodePredicate` with today's six scalar matcher fields. Extend `NodeMatcher` with optional `ancestor:NodePredicate` and `descendant:NodePredicate`; relationships mean any strict ancestor/descendant in the captured tree, never self. All supplied predicates combine with AND. Reject nested relationship objects and unknown fields. Preserve current role/text case rules. Resolve relationships before eligibility filtering so structural ancestors are retained.

Add raw action `query_ui` with params `{matcher?, visibility?:"on_screen"|"all", limit?:number}`. Defaults: on_screen and 100; limit 1..1000. Results use existing string-valued step data: `data.query` is serialized JSON `{schemaVersion:1, snapshotId, capturedAt, totalMatches, returnedCount, truncated, nodes:[NodeSummary]}`. snapshotId is observation-local; capturedAt is APK UTC capture time. Nodes are preorder, each with `nodePath` (child-index path rooted at "0"), `parentPath` (null at root), `resourceId`, `className`, `role`, `label`, `contentDescription`, `bounds:{left,top,right,bottom}`, `visibleToUser`, `onScreen`, `enabled`, `clickable`, `checkable`, `checked`, `selected`, `scrollable`. Preserve null for unavailable state; never turn unknown checked into false. totalMatches is before limit. `onScreen` uses the same source-owned eligibility rule as actions. Query and action candidate resolution share a resolver, not a Node reimplementation. Paths never become action targets or stable cross-capture IDs. Add XML `visible-to-user` state to the existing hierarchy dumper without changing raw hierarchy structure.

PR-1 exposes `clawperator query` and MCP `query_ui`, the raw action, and relational matchers. Existing simple CLI selector flags still work; add `--matcher-json` (mutually exclusive with simple selector flags), `--visibility`, and `--limit`. PR-2 adds raw action `strict?:boolean`, CLI `--strict` and `--container-json`, and matching MCP schemas for click, enter_text, read_text, wait_for_node, scroll, scroll_until, scroll_and_click. Apply strict to explicitly supplied container and target resolvers; read_text with all=true intentionally permits many target matches but still enforces unique explicit container. For scroll without an explicit container, strict requires one eligible scrollable candidate. Coordinate click with strict is invalid. For actions that do not currently consume params.container, wire that existing field through parser, action model, and task scope in PR-2. Container scoping searches strict descendants. Explicit container selection with legacy strict=false preserves first-match behavior. A container predicate may use ancestor/descendant constraints from PR-1. Scroll-loop target checks must stay within the selected container. Fresh resolution at dispatch is mandatory; changed counts fail instead of reusing an earlier query result. No new persistent accessibility references cross the bridge. Query payloads that exceed the existing transport limit fail explicitly with PAYLOAD_TOO_LARGE; do not cut serialized JSON to fit. Preserve original raw-tree child paths before filtering, so paths cannot shift simply because a sibling was ineligible.

## Idempotency

Reruns must preserve the stated semantics. IDs and capture timestamps may change; existing user artifacts must not be overwritten.

## Durable Follow-Up

Publish the contract in the authored docs named in the phase. Keep regression fixtures and tests in the source tree. Use `.agents/skills/task-cleanup/SKILL.md` only after all PRs are complete and durable guidance has migrated; do not delete this pack between PRs.
