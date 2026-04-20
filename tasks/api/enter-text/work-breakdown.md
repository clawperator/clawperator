# Android Enter Text Runtime Upgrade Work Breakdown

Parent plan: `tasks/api/enter-text/plan.md`

## Executive Summary

2 PRs, 4 phases. PR-1 establishes the internal text-entry strategy seam and
hardens the existing accessibility-node route without changing the public
`enter_text` API shape. PR-2 adds the API 33 accessibility IME/input-connection
path and finishes docs plus validation. The explicit goal is to keep the public
API stable and treat API 33 support as an Android implementation detail.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Keep the public `enter_text` action shape stable for this pack. Do not add a
  new public strategy or mode flag unless implementation evidence proves that
  unavoidable and both task-pack files are updated first.
- Preserve current replace-style behavior for successful `enter_text` calls. Do
  not let the API 33 route silently become append-at-cursor behavior.
- Do not fold the dedicated `clear` bug into this pack. That bug should be
  fixed directly as a focused bug and not reintroduced here as a second task
  pack.
- Use an internal first-match-wins strategy ladder. Do not route by app package
  name or app-specific hacks.
- Keep `submit` best effort unless the public contract is intentionally updated
  first. This pack should not introduce new hard failures for callers whose
  text entry succeeds but no truthful submit action exists.
- Treat API 33 input-method state as service-owned lifecycle state. Null
  current input connection, finished input, or missing editor info must be
  explicit availability cases, not crashes.
- Do not wire the API 33 route by scattering raw `AccessibilityService`
  lifecycle checks through `UiTreeManagerAndroid`. Add a focused helper or
  bridge if needed.
- Every phase that introduces behavior must add the tests that prove that
  behavior in the same phase and commit.
- Treat Android unit tests as the primary gate for the API 33 path. Live
  validation is still required when a suitable Android 13+ target and exercised
  editor path are available.
- Use the branch-local Node build for validation. Do not use a globally
  installed `clawperator` binary for any phase in this pack.
- Prefer the debug operator variant for local verification and pass
  `--operator-package com.clawperator.operator.dev` unless the phase is
  explicitly about the release APK.
- When multiple Android targets are connected, require explicit device
  selection with `--device <device_serial>` or `adb -s <device_serial> ...`.
- Do not record or commit raw device serials. Use placeholders such as
  `<device_serial>` in notes, prompts, or task artifacts.
- If a live validation path is blocked, record the exact host-state
  precondition that was missing. Do not silently treat "no suitable target" as
  proof.
- Clipboard mutation is out of scope for this pack. Do not add an `ACTION_PASTE`
  fallback unless the plan is updated first with explicit privacy guardrails.
- Use `.agents/skills/docs-author/SKILL.md` for the public-doc phase. Do not
  hand-wave docs updates as generic cleanup.
- Do not edit generated docs directly. Update authored docs and then run
  `./scripts/docs_build.sh`.
- One commit per logical step. Do not batch seam design, API 33 service work,
  and docs into one review unit.
- Do not start PR-2 until PR-1 is merged or finalized locally with passing
  validation commands.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/api/enter-text/plan.md` | Stable contract and scope boundaries |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` | Current single-path text-entry implementation |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` | Task-level `enter_text` flow |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | Step-result shaping for `enter_text` |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt` | Accessibility service lifecycle and capabilities |
| `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml` | Service-declared accessibility capabilities |
| `apps/android/shared/data/toolkit/src/main/kotlin/clawperator/accessibilityservice/AccessibilityServiceManager.kt` | Current Android bridge boundary for service-owned state |
| `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt` | Existing Android task-layer regression patterns |
| `apps/android/shared/data/operator/src/commonTest/kotlin/actiontask/operator/agent/AgentCommandParserDefaultTest.kt` | Android parser test surface in case additive fields are needed |
| `docs/api/actions.md` | Current public `enter_text` behavior docs |
| `docs/api/mcp.md` | MCP-facing text-entry docs |
| `.agents/skills/docs-author/SKILL.md` | Required docs workflow for Phase 4 |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Establish internal text-entry seam and harden current route | 1, 2 | thinking, default | none |
| PR-2 | Add API 33 accessibility IME path and finish docs plus validation | 3, 4 | thinking, default | PR-1 merged or finalized locally |

## Phase 1: Internal Strategy Seam

### Agent Tier

thinking

### Goal

Replace the single opaque Android text-entry implementation with an explicit
internal strategy seam that can support multiple truthful text-entry methods
without changing the public `enter_text` action shape or current replace-style
success semantics.

### Files or Surfaces To Change

- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`
- Android test files adjacent to the changed runtime path

### Steps

1. Before writing any seam code, open `UiActionEngineDefaultTest.kt` and
   `AgentCommandParserDefaultTest.kt` and verify whether either file contains
   baseline tests for `enter_text` action dispatch and parsing. If those tests
   are absent, add them as the first commit of this phase before any refactoring.
   The current path must be covered before it is restructured.
2. Define an internal result or strategy model that makes text-entry method
   selection explicit. Model the strategy seam as a sealed class or enum
   internal to `UiTreeManagerAndroid` - not as a new public interface or a new
   module-level abstraction. The seam must be able to express the first-match-
   wins ladder without adding public dependencies or changing the signature of
   `UiTreeManager.setText()` from the caller's perspective unless Phase 3 test
   isolation requires a dedicated bridge interface (see Step 4).
3. Refactor `UiTreeManagerAndroid` so the current `ACTION_SET_TEXT` route lives
   behind that seam instead of as the only implementation.
4. Preserve the existing replace-style behavior as a named invariant in the
   seam. If the seam cannot express that invariant cleanly, stop and update the
   plan before continuing.
5. Decide whether the API 33 path needs a dedicated bridge interface for service-
   owned input-method session state so that path can be unit tested without a
   running accessibility service. If yes, define the interface boundary
   (for example, an `InputConnectionSource` interface wrapping
   `getInputMethod()?.currentInputConnection()`) as a stub in this phase and
   leave it unimplemented until Phase 3. Record the exact Phase 3 ownership
   point if the interface is deferred.
6. Keep the public `enter_text` action shape unchanged while making additive
   task/runtime diagnostics possible if needed.
7. Add Android regression tests that prove the seam exists and that the legacy
   path still works through it.
8. Stop after the seam and tests are stable. Do not add API 33 service work in
   this phase.

### Acceptance Criteria

- The Android runtime no longer has only one implicit text-entry path.
- The public `enter_text` action shape remains unchanged.
- The seam preserves current replace-style semantics as an explicit invariant.
- Tests prove the seam and the routed legacy path in the same phase.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew app:installDebug
git diff --check
```

Plus:
- if a target is available, launch the debug operator with:
  `adb -s <device_serial> shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity`
- the phase is not complete until it records either:
  - a live validation result against the branch-local build on
    `<device_serial>`
  - or an explicit blocked reason naming the missing precondition

### Expected Commit

```text
refactor(android): add enter_text strategy seam
```

## Phase 2: Existing Route Hardening And Submit Semantics

### Agent Tier

default

### Goal

Improve the current accessibility-node route so submit behavior uses truthful
editor actions when available and any observable runtime diagnostics are stable
before the API 33 path is added.

### Files or Surfaces To Change

- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- Android tests covering submit routing and step-result shaping

### Steps

1. Implement a truthful submit order for the existing accessibility-node route.
   Detect `AccessibilityNodeInfoCompat.ACTION_IME_ENTER` by checking
   `AccessibilityNodeInfoCompat.wrap(node).actionList` and prefer it over a
   click fallback when present. This constant is available from API 30. If the
   runtime must support below API 30, wrap the check with
   `Build.VERSION.SDK_INT >= Build.VERSION_CODES.R`. Do not assume all nodes
   expose `ACTION_IME_ENTER` - the click fallback remains the best-effort path
   when it is absent.
2. Add or preserve tests that prove the legacy route still behaves like replace
   text, not append text, after the seam refactor.
3. Decide which additive step-data fields are worth surfacing, such as
   `strategyUsed` or `submitMethod`, without turning the step result into a
   transport dump.
4. Add Android regressions for:
   - legacy route still replaces existing text when successful
   - node exposes `ACTION_SET_TEXT` and `ACTION_IME_ENTER`
   - node exposes `ACTION_SET_TEXT` but not `ACTION_IME_ENTER`
   - submit fallback remains explicit best effort instead of pretending it is a
     real editor action
   - submit unavailable does not create a new hard failure when text entry
     itself succeeded
5. Keep this phase scoped to the existing route. Do not add API 33 service
   capability work yet.

### Acceptance Criteria

- `submit=true` no longer means only "click after text set" when a real editor
  action is available.
- Legacy replace-style behavior is still covered explicitly.
- Any observable step-data additions are stable and intentional.
- Tests cover both truthful editor-action routing and fallback behavior.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew app:installDebug
git diff --check
```

Plus:
- if a target is available, launch the debug operator with:
  `adb -s <device_serial> shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity`
- validate the legacy route with the branch-local Node build, not the global
  CLI. Use:
  `node apps/node/dist/cli.js type "hello" --selector '<matcher_json>' --device <device_serial> --operator-package com.clawperator.operator.dev`
- the phase is not complete until it records either:
  - a live validation result for legacy-route replace and submit behavior on
    `<device_serial>`
  - or an explicit blocked reason naming the missing precondition

### Expected Commit

```text
feat(android): improve enter_text submit routing
```

## Phase 3: API 33 Accessibility IME Path

### Agent Tier

thinking

### Goal

Add the API 33 accessibility IME/input-connection path to the Android
accessibility service and integrate it into the internal `enter_text` strategy
ladder as an implementation detail.

### Files or Surfaces To Change

- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt`
- `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`
- Any new Android helper under the operator or uitree runtime surface justified
  by the implementation
- Android tests covering API 33 routing

### Steps

1. Add the Android accessibility-service capability needed for API 33
   accessibility IME support. The required flag is
   `AccessibilityServiceInfo.FLAG_INPUT_METHOD_EDITOR`. Open
   `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml`
   and read the current `android:accessibilityFlags` value before adding to it.
   Combine the new flag value with any existing flags rather than overwriting them.
   If the attribute does not yet exist, add it. Verify the service configuration
   loads correctly after the change by building and inspecting the manifest.
2. Implement the service-side `InputMethod` lifecycle and input-connection
   access needed by the runtime. Use `onCreateInputMethod()`,
   `getInputMethod()`, current input connection, and current editor info
   explicitly rather than assuming they are always present. Wrap all API 33
   method calls with `@RequiresApi(Build.VERSION_CODES.TIRAMISU)` annotations.
   At the strategy ladder dispatch point in `UiTreeManagerAndroid`, guard the
   API 33 branch with `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)`.
   Do not scatter the version check across multiple call sites.
3. Integrate the API 33 input-connection path into the internal strategy ladder
   without changing the public `enter_text` shape. Use the `InputConnectionSource`
   bridge interface introduced in Phase 1 (or stubbed there) so the path can be
   unit tested without running a real accessibility service. The mock must be
   able to simulate a null connection, a finished connection, and an active
   connection returning a real `InputConnection` double.
4. Be explicit about the first-match-wins strategy order when both
   `ACTION_SET_TEXT` and the API 33 input-connection path are available. Keep
   the legacy `ACTION_SET_TEXT` route first unless the plan is updated with a
   concrete reason to reorder it.
5. Preserve replace-style semantics on the API 33 route. Do not treat plain
   `commitText()` insertion as equivalent to current `enter_text` behavior.
   The replace-safe sequence for `InputConnection` is: select all existing text
   using `setSelection(0, currentLength)` based on the current editor info, then
   call `commitText(text, 1)`. If selection state is unreliable, fall back to
   `deleteSurroundingText(Int.MAX_VALUE, Int.MAX_VALUE)` followed by
   `commitText(text, 1)`. Document which sequence was chosen and prove with a
   test that pre-existing text is fully replaced and not appended to. If neither
   sequence can guarantee deterministic replace semantics, skip the API 33 route
   and return an explicit error rather than silently changing behavior.
6. Add Android regressions for at minimum:
   - API 33 path selected for a focused editor that lacks a reliable
     `ACTION_SET_TEXT` route
   - API 33 path preserves replace behavior for pre-populated text or selected
     text instead of appending unexpectedly
   - API 33 path skipped on lower API levels
   - API 33 path unavailable because the current input connection is null,
     finished, or stale falls back cleanly to the legacy route
   - API 33 path unavailable and no legacy route exists returns an explicit
     failure rather than a fake success
   - submit behavior on the API 33 path uses the editor-action path rather than
     a blind click when possible
7. If implementation evidence shows the API 33 route cannot preserve current
   semantics without new public API knobs, stop and update both task-pack files
   before continuing. Do not paper over that gap with undocumented behavior.
8. Record the live-validation preconditions for this phase in the PR notes or
   execution log: Android 13+ target, accessibility service enabled, and an app
   surface that actually exercises the custom-editor path.

### Acceptance Criteria

- The accessibility service supports the API 33 accessibility IME path.
- `enter_text` can use that path internally without new public API fields.
- The API 33 route either preserves replace-style semantics or fails/skips
  explicitly instead of silently changing semantics.
- Tests prove routing between the legacy and API 33 paths, including the lower
  API fallback case.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew app:installDebug
git diff --check
```

Plus:
- if a suitable target is available, launch the debug operator with:
  `adb -s <device_serial> shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity`
- record the live-validation preconditions from Step 8 in the PR notes or
  execution log, including whether an Android 13+ target and a real
  custom-editor path were available

### Expected Commit

```text
feat(android): add api33 input-connection enter_text path
```

## Phase 4: Docs And End-To-End Validation

### Agent Tier

default

### Goal

Document the improved runtime behavior accurately and prove the final path with
the best available validation, keeping the public API stable.

### Files or Surfaces To Change

- `docs/api/actions.md`
- `docs/api/mcp.md`
- `docs/internal/design/operator-llm-playbook.md`
- Any small Android or test follow-up required by validation findings

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the authored-doc updates.
2. Update `docs/api/actions.md` so public `enter_text` docs reflect the shipped
   runtime behavior without adding speculative new API shape. Be explicit about
   current replace semantics, best-effort submit semantics, and any observable
   strategy diagnostics.
3. Update `docs/api/mcp.md` if MCP-facing callers can observe new runtime step
   data or changed behavior.
4. Update `docs/internal/design/operator-llm-playbook.md` so internal guidance
   no longer describes the old Android limitation.
5. Run `./scripts/docs_build.sh`.
6. Re-run the Android and Node validation commands from Phases 1 to 3.
7. Build the branch-local Node CLI and use it for live validation. Do not use a
   global `clawperator` binary.
8. If multiple targets are connected, choose the intended one explicitly with
   `--device <device_serial>` and `adb -s <device_serial> ...`.
9. Install and launch the debug APK on the selected validation target:
   - `./gradlew app:installDebug`
   - `adb -s <device_serial> shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity`
10. If a suitable Android 13+ target exists, do a live validation pass with the
   branch-local Node build and the `.dev` operator package against:
   - one standard accessible text field that uses `ACTION_SET_TEXT`
   - one custom-editor path that requires the API 33 input-connection route
11. Record which target class was used for live validation using placeholders
   such as `<device_serial>` plus the operator package variant. Do not record
   raw device identifiers.

### Acceptance Criteria

- Public docs describe the shipped runtime behavior accurately.
- Internal docs no longer describe the old Android limitation.
- `./scripts/docs_build.sh` passes.
- Final validation covers contract compatibility, Android unit coverage, and
  live validation preconditions or blocked reasons explicitly.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew app:installDebug
./scripts/docs_build.sh
git diff --check
```

Plus:
- if a suitable target is available, launch the debug operator with:
  `adb -s <device_serial> shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity`
- perform final live verification with the branch-local CLI, for example:
  `node apps/node/dist/cli.js type "hello" --selector '<matcher_json>' --device <device_serial> --operator-package com.clawperator.operator.dev`

Plus:
- complete the live validation from Steps 8 and 9 when a suitable Android 13+
  target exists, or record the exact blocked reason naming the missing
  precondition

### Expected Commit

```text
docs(api): document android enter_text runtime upgrade
```
