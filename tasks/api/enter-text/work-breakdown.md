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
- Do not fold the dedicated `clear` bug into this pack. `clear` work belongs to
  `tasks/api/clear/`.
- Use an internal first-match-wins strategy ladder. Do not route by app package
  name or app-specific hacks.
- Every phase that introduces behavior must add the tests that prove that
  behavior in the same phase and commit.
- Treat Android unit tests as the primary gate for the API 33 path. Live
  validation is still required when a suitable Android 13+ target and exercised
  editor path are available.
- If a live validation path is blocked, record the exact host-state
  precondition that was missing. Do not silently treat "no suitable target" as
  proof.
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
| `tasks/api/enter-text/findings.md` | Current code-path research and Android API guidance |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` | Current single-path text-entry implementation |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` | Task-level `enter_text` flow |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | Step-result shaping for `enter_text` |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt` | Accessibility service lifecycle and capabilities |
| `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml` | Service-declared accessibility capabilities |
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
without changing the public `enter_text` action shape.

### Files or Surfaces To Change

- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`
- Android test files adjacent to the changed runtime path

### Steps

1. Define an internal result or strategy model that makes text-entry method
   selection explicit.
2. Refactor `UiTreeManagerAndroid` so the current `ACTION_SET_TEXT` route lives
   behind that seam instead of as the only implementation.
3. Keep the public `enter_text` action shape unchanged while making additive
   task/runtime diagnostics possible if needed.
4. Add Android regression tests that prove the seam exists and that the legacy
   path still works through it.
5. Stop after the seam and tests are stable. Do not add API 33 service work in
   this phase.

### Acceptance Criteria

- The Android runtime no longer has only one implicit text-entry path.
- The public `enter_text` action shape remains unchanged.
- Tests prove the seam and the routed legacy path in the same phase.

### Validation

```bash
./gradlew app:assembleDebug app:testDebugUnitTest
git diff --check
```

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
   At minimum, prefer a real editor action such as `ACTION_IME_ENTER` when the
   node exposes it before falling back to a click.
2. Decide which additive step-data fields are worth surfacing, such as
   `strategyUsed` or `submitMethod`, without turning the step result into a
   transport dump.
3. Add Android regressions for:
   - node exposes `ACTION_SET_TEXT` and `ACTION_IME_ENTER`
   - node exposes `ACTION_SET_TEXT` but not `ACTION_IME_ENTER`
   - submit fallback remains explicit best effort instead of pretending it is a
     real editor action
4. Keep this phase scoped to the existing route. Do not add API 33 service
   capability work yet.

### Acceptance Criteria

- `submit=true` no longer means only "click after text set" when a real editor
  action is available.
- Any observable step-data additions are stable and intentional.
- Tests cover both truthful editor-action routing and fallback behavior.

### Validation

```bash
./gradlew app:assembleDebug app:testDebugUnitTest
git diff --check
```

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

1. Add the Android accessibility-service capabilities needed for API 33
   accessibility IME support.
2. Implement the service-side InputMethod lifecycle and input-connection access
   needed by the runtime.
3. Integrate the API 33 input-connection path into the internal strategy ladder
   without changing the public `enter_text` shape.
4. Be explicit about the first-match-wins strategy order when both
   `ACTION_SET_TEXT` and the API 33 input-connection path are available.
5. Add Android regressions for at minimum:
   - API 33 path selected for a focused editor that lacks a reliable
     `ACTION_SET_TEXT` route
   - API 33 path skipped on lower API levels
   - API 33 path unavailable or unbound falls back cleanly to the legacy route
   - submit behavior on the API 33 path uses the editor-action path rather than
     a blind click when possible
6. Record the live-validation preconditions for this phase in the PR notes or
   execution log: Android 13+ target, accessibility service enabled, and an app
   surface that actually exercises the custom-editor path.

### Acceptance Criteria

- The accessibility service supports the API 33 accessibility IME path.
- `enter_text` can use that path internally without new public API fields.
- Tests prove routing between the legacy and API 33 paths, including the lower
  API fallback case.

### Validation

```bash
./gradlew app:assembleDebug app:testDebugUnitTest
git diff --check
```

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
2. Update public docs to describe the stable public API and the improved
   Android runtime behavior. Do not document speculative future flags.
3. Update internal design guidance that currently calls out Android text-entry
   limitations so it reflects the shipped behavior.
4. Run `./scripts/docs_build.sh`.
5. If a suitable Android 13+ target is available, perform live validation
   against:
   - a standard accessible text field
   - a custom-editor surface that exercises the API 33 path
   Record exactly which target and app surfaces were used.
6. If the live path is blocked by host-state constraints, record the exact
   missing precondition and rely on the phase unit tests as the primary gate.

### Acceptance Criteria

- Public docs describe the stable `enter_text` API without new strategy flags.
- Public and internal docs accurately describe the improved Android runtime
  behavior and remaining limitations.
- `./scripts/docs_build.sh` passes.
- Live validation is either completed and recorded with exact target details or
  explicitly blocked with named host-state preconditions.

### Validation

```bash
./gradlew app:assembleDebug app:testDebugUnitTest
./scripts/docs_build.sh
git diff --check
```

### Expected Commits

```text
docs(api): update enter_text runtime behavior guidance
```

```text
docs(internal): update operator enter_text guidance
```
