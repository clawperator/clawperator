# Report action outcomes and failures precisely

## Executive Summary

Preserve per-step evidence and distinguish accepted actions from verified effects. This pack has 1 PR(s), one phase per PR, and is not started. All implementation, tests, and public documentation ship together.

## Status

| Item | Value |
| --- | --- |
| State | Not started |
| Total PRs | 1 |
| Total phases | 1 |
| Completed | None |
| Remaining | 1-1 |
| Current / Next | Phase 1 |
| Blockers | Both selector-inspection PRs merged |

## Goal

Preserve per-step evidence and distinguish accepted actions from verified effects.

## Why Now

An accepted wrapper click can leave the screen unchanged. A timed-out wait can return empty stepResults. scrollOnce maps lost containers, absent signatures, and unchanged signatures to edge_reached, which overstates available evidence.

## In Scope

Step failure preservation, typed known runtime errors, selected-target receipts, measured action duration, and truthful scroll progress outcomes.

## Out of Scope

Generic screenshot-based assertions, hidden retries, agent recovery, execution-policy redesign, and automatically declaring application behavior correct.

## Existing Artifact Scope

Extend only the existing surfaces named below and the explicitly named new files. Preserve unrelated commands, skills, and documentation. Do not edit other active task packs or implement their work incidentally.

## Surfaces and Ownership

| Surface | Owner |
| --- | --- |
| Receipts and failure classification | Android task engine |
| Canonical transport and exit status | Node execution layer |

## Source Of Truth

| Topic | Authority |
| --- | --- |
| Engine | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` |
| UI actions | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` |
| Dispatch mechanism | `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` |
| Envelope publication | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandExecutorDefault.kt` |
| Envelope contract | `apps/node/src/contracts/result.ts` |
| Node parser | `apps/node/src/adapters/android-bridge/envelopeParser.ts` |
| Existing tests | `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt` |
| Node exit tests | `apps/node/src/test/unit/cliExitCode.test.ts` |

The inspected baseline is main commit `5d23af5`. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck these source seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Deterministic Versus Judgment

Apply the output contract and decision rules verbatim. Implementation structure and explanatory prose permit judgment. If a required platform capability is unavailable, record evidence and stop the affected phase; do not silently change the public contract. Routine internal refactors may proceed within scope with findings recorded.

## Decision Rules

| Evidence | Outcome |
| --- | --- |
| Click dispatch accepted | accepted; postcondition not asserted |
| Known action exception | failed step with stable code and original message |
| Container disappears after gesture | container_lost, never edge_reached |
| Missing or incomparable progress evidence | unknown, never edge_reached |
| Same comparable signature after accepted gesture | no_movement, not proof of an edge |
| Changed comparable signature | moved |
| Gesture rejected | gesture_failed |
| Definitive platform boundary evidence | edge_reached only if explicitly instrumented and tested; otherwise do not emit |

## Failure Modes To Prevent

Discarded partial steps, false edge claims, false postcondition success, unbounded loop retries, and incompatible string-valued result data.

## Output Contract

Keep StepResultData string-valued. Add `errorCode` and `error` to failed step data; populate the existing top-level errorCode for the terminal failure. Add codes UI_TREE_UNAVAILABLE, WAIT_TIMEOUT, ACTION_FAILED only where existing codes are insufficient; reuse current NODE_NOT_FOUND, GESTURE_FAILED, and selector ambiguity codes. Use typed internal failures, not human-message substring classification, for paths changed here. Unknown exceptions map to ACTION_FAILED while preserving text. Preserve completed steps plus the failed step when an action throws. Preserve existing policy for non-throwing failed step results; document it explicitly rather than silently changing sequence execution. Timeout/cancellation must retain collected steps without swallowing coroutine cancellation or emitting two terminal envelopes.

Selector-targeted click/text/scroll receipts add `target` as serialized NodeSummary JSON from the actual dispatch resolution, `candidate_count`, `dispatch_method` (actual accessibility action or coordinate gesture mechanism), `dispatch_accepted`, and `elapsed_ms` from Android monotonic time. No receipt claims an application postcondition. Do not store entered text again in receipts. Coordinate actions report coordinates instead of a fabricated node.

Scroll retains existing data keys and adds `progress` JSON `{beforeSignature, afterSignature, comparable, reason}` with bounded hashed signatures (do not include node text in progress signatures) and NodeSummary of the compared container in `target`. New scroll_outcome values include no_movement, unknown, container_lost. Update Kotlin outcomes, all exhaustive consumers, Node contracts/docs, and tests together. Re-resolve the same scoped container; do not compare a different first match after layout change. Bounded loops count no_movement/unknown toward the existing no-position-change limit, preserve maxScrolls/maxDuration, and terminate container_lost honestly. A moved screen with wrong/ambiguous container comparison must not be reported as a proven edge.

## Idempotency

Reruns must preserve the stated semantics. IDs and capture timestamps may change; existing user artifacts must not be overwritten.

## Durable Follow-Up

Publish the contract in the authored docs named in the phase. Keep regression fixtures and tests in the source tree. Use `.agents/skills/task-cleanup/SKILL.md` only after all PRs are complete and durable guidance has migrated; do not delete this pack between PRs.
