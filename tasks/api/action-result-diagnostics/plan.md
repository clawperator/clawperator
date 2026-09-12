# Report action outcomes and failures precisely

## Goal and Scope

Preserve per-step evidence and distinguish accepted actions from verified effects.

An accepted wrapper click can leave the screen unchanged. A timed-out wait can return empty stepResults. scrollOnce maps lost containers, absent signatures, and unchanged signatures to edge_reached, which overstates available evidence.

Step failure preservation, typed known runtime errors, selected-target receipts, measured action duration, and truthful scroll progress outcomes.

Excluded: Generic screenshot-based assertions, hidden retries, agent recovery, execution-policy redesign, and automatically declaring application behavior correct.

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

## Existing query failure behavior

R4 already introduces `UI_TREE_UNAVAILABLE` for a missing query hierarchy,
`UiActionExecutionResult.errorCode`/`error`, retained completed steps plus a
failed query, and root-independent service/window diagnostics. Reuse and extend
these foundations after the merge gates; do not duplicate them. General action
exceptions and timeout/cancellation evidence still need the work below. The
[sensitive-root access issue](../../../docs/internal/design/accessibility-hierarchy.md)
is parked separately and does not expand this task into service reclassification.

## Sources

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

Initial investigation used `5d23af5`; the final task audit used merged main `120c1eb`, including the shipped on-screen-log raw API. Preserve its controller-owned overlay identity, visibility metadata, canonical error codes, and strict input aliases. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck affected seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Behavior and Decisions

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

Keep StepResultData string-valued. Add `errorCode` and `error` to failed step data; populate the existing top-level errorCode for the terminal failure. Add codes UI_TREE_UNAVAILABLE, WAIT_TIMEOUT, ACTION_FAILED; use them for missing application hierarchy, expired node wait, and otherwise unclassified action exception respectively, without replacing a more specific existing code; reuse current NODE_NOT_FOUND, GESTURE_FAILED, and selector ambiguity codes. Use typed internal failures, not human-message substring classification, for paths changed here. Unknown exceptions map to ACTION_FAILED while preserving text. Missing application roots add `diagnostics` JSON `{serviceAvailable,rootAvailable,windowCount,foregroundPackage}`; unavailable values are null. Gather available window/service facts without requiring the missing root. This diagnoses restricted system UI without promising access or switching to another window. Keep raw on-screen-log set/clear usable without an application root and preserve their existing ON_SCREEN_LOG_* codes. Preserve completed steps plus the failed step when an action throws. Preserve existing policy for non-throwing failed step results; document it explicitly rather than silently changing sequence execution. Timeout/cancellation must retain collected steps without swallowing coroutine cancellation or emitting two terminal envelopes.

Selector-targeted click/text/scroll receipts add `target` as serialized NodeSummary JSON from the actual dispatch resolution, `candidate_count`, `dispatch_method` (one of `accessibility_action`, `coordinate_gesture`, or `none`), `dispatch_accepted`, and `elapsed_ms` from Android monotonic time. No receipt claims an application postcondition. Do not store entered text again in receipts. Coordinate actions report `coordinate` JSON `{x,y}` instead of target, omit candidate_count, and report the real method. Use string booleans for dispatch_accepted and base-10 strings for candidate_count and elapsed_ms; omit target when no target was resolved. A failed pre-dispatch action has dispatch_method=none and dispatch_accepted=false. If click fallback targets a clickable ancestor or a coordinate rather than the matched node, target describes the actual dispatch node and `matched_target` retains the originally selected NodeSummary; record the chosen mechanism, never infer it downstream.

Scroll retains existing data keys and adds `progress` JSON `{beforeSignature, afterSignature, comparable, reason}` with bounded hashed signatures (do not include node text in progress signatures) and NodeSummary of the compared container in `target`. New scroll_outcome values include no_movement, unknown, container_lost. Update Kotlin outcomes, all exhaustive consumers, Node contracts/docs, and tests together. Re-resolve the same scoped container; do not compare a different first match after layout change. Bounded loops count no_movement/unknown toward the existing no-position-change limit, preserve maxScrolls/maxDuration, and terminate container_lost honestly. A moved screen with wrong/ambiguous container comparison must not be reported as a proven edge.

## Repeatability

Receipts describe one attempt. Do not replay a mutation to fill a missing receipt. Readiness/transport uncertainty remains explicit; execution IDs continue to identify the original attempt.

## Durable Outputs

The work breakdown names the authored docs and regression coverage that ship with this contract. Keep implementation findings here only until the pack is complete; migrate lasting guidance before retiring it.
