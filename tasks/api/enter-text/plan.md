# Android Enter Text Runtime Upgrade

## Executive Summary

This pack turns the current `enter_text` research into an executable
implementation plan. The desired outcome is better Android text-entry
reliability, especially for custom editors, while keeping the public
Clawperator API stable. This is cross-surface work with Android ownership and
light Node/docs touch points: 2 PRs, 4 phases. PR-1 establishes an internal
text-entry strategy seam and hardens the existing accessibility-node path. PR-2
adds the API 33 accessibility IME/input-connection path and finishes docs plus
validation.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this pack ships, `enter_text` should remain the same public action shape
but use a stronger Android runtime strategy ladder under the hood, including
API 33 accessibility IME/input-connection support for custom editors that do
not expose a reliable `ACTION_SET_TEXT` path, while preserving the current
effective replace-text semantics for successful calls.

## Why Now

The current Android runtime mostly treats `enter_text` as "focus the node, call
`ACTION_SET_TEXT`, maybe click afterward." That is adequate for standard
accessible fields and weak for mainstream apps that use custom text surfaces.
The repo already has findings that show Android offers a stronger API 33 path
through accessibility IME support, and the team wants to adopt it without
expanding the public API into transport-specific flags or strategy knobs.

## In Scope

- Keep the public `enter_text` action shape stable while upgrading Android
  runtime behavior
- Preserve current replace-style `enter_text` semantics. Do not silently change
  successful calls into append-at-cursor behavior on custom editors.
- Add an internal Android text-entry strategy layer instead of a single
  `ACTION_SET_TEXT` implementation
- Improve submit behavior so it uses real editor actions when available instead
  of relying on a blind post-entry click
- Add API 33 accessibility IME/input-connection support through the Android
  accessibility service
- Add explicit stop conditions if implementation evidence shows the current
  public API cannot truthfully preserve replace and submit semantics
- Add Android-side tests for strategy selection, submit handling, and API 33
  fallback behavior
- Update public and internal docs for the improved runtime behavior and any
  observable step diagnostics

## Out of Scope

- The dedicated `clear` contract bug tracked separately under `tasks/api/clear/`
- New public `enter_text` parameters such as `mode`, `strategy`, or
  `preferInputConnection`, unless later implementation evidence proves the
  stable API goal impossible and this plan is updated first
- App-specific hardcoded hacks keyed by package name
- Non-Android runtimes
- Broad `skills` or Node CLI redesign unrelated to Android text entry

## Existing Artifact Scope

- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`:
  fully in scope for replacing the single-path text-entry implementation with
  an internal strategy ladder
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`:
  in scope for additive result-shape or interface changes needed by the Android
  strategy layer; preserve the external `enter_text` action semantics
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt`:
  in scope for API 33 accessibility IME support and capability flags
- `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml`:
  in scope for any required service capabilities that are part of the API 33
  path
- `apps/android/shared/data/toolkit/src/main/kotlin/clawperator/accessibilityservice/AccessibilityServiceManager.kt`:
  in scope if the API 33 path needs an explicit bridge for current input-method
  session state rather than raw `AccessibilityService` access
- `apps/node/src/contracts/execution.ts` and `apps/node/src/cli/registry.ts`:
  preserve the current public `enter_text` shape unless a later blocked
  implementation forces a documented plan change
- `docs/api/actions.md`, `docs/api/mcp.md`, and
  `docs/internal/design/operator-llm-playbook.md`: in scope for runtime
  behavior updates; do not widen them into speculative future API design docs

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` | Internal strategy ladder, submit handling, strategy diagnostics | PR-1 / Phases 1, 2; PR-2 / Phase 3 |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt` | Additive interface or result-model changes if the seam requires them | PR-1 / Phase 1 |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` | Plumb richer text-entry results into the task layer if needed | PR-1 / Phase 1 |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | Preserve public step type while carrying additive runtime details | PR-1 / Phase 2 |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt` | Accessibility IME capability and InputMethod lifecycle | PR-2 / Phase 3 |
| `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml` | Service capability declaration for API 33 path if required | PR-2 / Phase 3 |
| `apps/android/shared/data/toolkit/src/main/kotlin/clawperator/accessibilityservice/AccessibilityServiceManager.kt` | Introduce or extend an Android-only bridge for input-method session state if direct raw-service access would leak lifecycle complexity | PR-2 / Phase 3 |
| `apps/android/shared/test/` and `apps/android/shared/data/operator/src/commonTest/` | Android regressions for strategy routing and API 33 behavior | All phases that introduce behavior |
| `docs/api/actions.md` | Public `enter_text` runtime behavior notes | PR-2 / Phase 4 |
| `docs/api/mcp.md` | Public MCP text-entry behavior if observable output changes | PR-2 / Phase 4 |
| `docs/internal/design/operator-llm-playbook.md` | Internal guidance that currently calls out Android limitations | PR-2 / Phase 4 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current `enter_text` task findings | `tasks/api/enter-text/findings.md` |
| Android text-entry runtime path | `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` |
| Android text-entry task flow | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`, `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` |
| Android accessibility service capabilities and service-owned state | `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml`, `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt`, `apps/android/shared/data/toolkit/src/main/kotlin/clawperator/accessibilityservice/AccessibilityServiceManager.kt` |
| Public action contract | `apps/node/src/contracts/execution.ts`, `apps/node/src/cli/registry.ts`, `docs/api/actions.md` |
| Existing Android task and parser tests | `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt`, `apps/android/shared/data/operator/src/commonTest/kotlin/actiontask/operator/agent/AgentCommandParserDefaultTest.kt` |
| Public docs regeneration boundary | `./scripts/docs_build.sh`, `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Keep the public `enter_text` API stable for this pack. Treat the API 33 path
  as an Android implementation detail, not a new public flag.
- Do not add new public `enter_text` parameters unless a later blocked
  implementation proves the stable-API goal impossible and both this plan and
  `work-breakdown.md` are updated before continuing.
- Preserve current effective replace semantics for successful `enter_text`
  calls. If an internal strategy cannot deterministically replace text, it must
  not silently append or duplicate content.
- The Android runtime must use an internal first-match-wins strategy ladder,
  not package-specific hacks.
- The strategy ladder must prefer a truthful editor-action path over the
  current blind post-entry click when submit behavior is requested.
- Phase 3 must use API 33 accessibility IME support through the accessibility
  service rather than inventing an ADB-side workaround for custom editors.
- Phase 3 must treat API 33 input-method state as service-owned lifecycle
  state. Null, stale, or finished input sessions are availability outcomes, not
  crash cases.
- Every phase that introduces behavior must ship the tests that prove it in the
  same phase and commit.
- Unit tests are the primary gate for the API 33 path because live validation
  depends on a suitable Android 13+ target and an app surface that actually
  exercises the custom-editor path.

**Judgment required:**

- The exact internal result model for strategy attempts and strategy-used
  diagnostics
- How much runtime strategy detail should surface in public step data versus
  internal logs only
- Which public docs need explicit wording updates versus brief clarifications

## Decision Rules

| Question | Rule |
| --- | --- |
| Should the public `enter_text` API gain a new mode or strategy field? | No for this pack. Keep the API stable and make strategy selection an Android implementation detail unless a later blocked implementation proves that impossible. |
| How should the runtime choose a text-entry method? | Use a first-match-wins internal strategy ladder. No package-name routing. |
| What is the baseline strategy order? | Focus target first. Prefer `ACTION_SET_TEXT` when the matched node or editable ancestor exposes it because it already matches current replace semantics. Use the API 33 input-connection route only when the legacy replace route is unavailable or demonstrably failed. |
| What if the API 33 path can only insert at the cursor? | Do not silently change semantics. Either make the input-connection path perform deterministic replace-style entry, skip that strategy, or stop and update the plan before implementation continues. |
| How should `submit=true` behave? | Keep it as best-effort submit after successful text entry so current callers do not start failing unexpectedly. Prefer a truthful editor action such as `ACTION_IME_ENTER` or an API 33 editor action when available, and expose fallback or skipped-submit diagnostics if user-visible step data changes. |
| How should custom editors be supported? | Through API 33 accessibility IME/input-connection support in the Android accessibility service, not by expanding the public API. |
| What happens if the API 33 path is unavailable? | Keep the existing accessibility-node path and other supported internal fallbacks. Do not fail solely because the device is below API 33 or because the input session is null, unstarted, or finished if another supported strategy works. |
| When must docs change? | Any user-visible runtime behavior change, observable step-data addition, or new limitation note must be documented in the same pack. |
| How should live validation be treated? | Required when a suitable Android 13+ target and exercised app/editor path are available. If host-state constraints prevent that, unit tests remain the primary gate and the task notes the blocked live preconditions explicitly. |
| When must the plan be updated before code continues? | If preserving API stability would require new public knobs, if deterministic replace semantics cannot be preserved on the API 33 route, or if truthful submit behavior would require a public contract change. |

## Failure Modes To Prevent

- Public API complexity leaks into new `enter_text` flags even though the team
  wants the API 33 path hidden behind stable semantics
- The API 33 path silently changes successful `enter_text` calls from replace to
  append or duplicate behavior
- The runtime still has only one real text-entry method after the pack lands
- `submit=true` still means "click after set text" even when real editor
  actions are available
- `submit=true` starts hard-failing callers that previously succeeded because a
  truthful editor action is unavailable
- API 33 support is added only as a disconnected helper and never integrated
  into the actual `enter_text` path
- API 33 support is wired directly against raw `AccessibilityService`
  lifecycle state without a testable bridge or null-session handling
- Tests cover only synthetic success cases and do not prove routing between
  legacy and API 33 strategies
- Live validation is listed without naming the Android 13+ device or emulator
  preconditions
- Docs drift and keep describing the old limitations after the runtime changes

## Output Contract

After PR-1:

- The Android runtime has an explicit internal text-entry strategy seam instead
  of a single opaque `ACTION_SET_TEXT` implementation.
- `submit=true` prefers a truthful editor-action path when available on the
  existing accessibility-node route.
- The legacy route still preserves replace-style behavior.
- Android tests prove the new seam and strategy routing for the pre-API-33
  path.

After PR-2:

- The Android accessibility service supports the API 33 accessibility IME/input
  method path.
- `enter_text` can use that API 33 path as an internal implementation detail
  when it is the best available strategy.
- The API 33 route preserves replace-style behavior or is skipped/fails
  explicitly rather than silently changing semantics.
- Public and internal docs reflect the improved runtime behavior without
  exposing new public API complexity.

## Idempotency

- Re-running `enter_text` on the same surface should preserve public action
  shape and stable success/failure semantics.
- The runtime may choose different internal strategies on different Android API
  levels or editor implementations, but that selection should be deterministic
  for the same device/editor conditions.
- Re-running docs generation after the final authored-doc updates should not
  introduce additional unrelated diffs.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Public `enter_text` behavior | `docs/api/actions.md`, `docs/api/mcp.md` |
| Android text-entry strategy behavior | `apps/android/shared/data/uitree/` and code-adjacent comments where justified |
| Internal operator guidance about runtime text entry | `docs/internal/design/operator-llm-playbook.md` |
| Any stable observable step-data additions | Android task/runtime code plus public docs if exposed |
