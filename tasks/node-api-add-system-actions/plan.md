# Task: Node API Add System Key Actions

## Goal

Add a first-class `press_key` execution action to the Clawperator Node API and
Android runtime so agents can express common Android system-navigation steps
inside the canonical execution payload rather than escaping to ad hoc `adb shell
input keyevent` calls.

The first shipping slice should prioritize:

- `BACK`
- `HOME`

The next supported key can be:

- `RECENTS`

The runtime path should use the active
`OperatorAccessibilityService` and Android accessibility global actions. Do not
introduce a parallel control path through `MainAccessibilityService` for agent
executions.

## Why This Slice

`BACK` and `HOME` cover the highest-frequency navigation gaps and both map
cleanly to `AccessibilityService.performGlobalAction(...)`.

`RECENTS` is also a good fit for the same mechanism, but it is lower priority
than `BACK` and `HOME`.

`ENTER`, `SEARCH`, `VOLUME_UP`, and `VOLUME_DOWN` do **not** fit the same
implementation path cleanly:

- Android accessibility global actions cover back/home/recents directly
- volume and enter/search are raw key events, not accessibility global actions
- falling back to `adb shell input keyevent` inside the runtime would violate
  the actuator contract and split execution across transport layers

So the initial implementation should explicitly ship a narrow, well-documented
enum backed by accessibility global actions. Leave raw-key support as a
follow-up task.

## Contract Proposal

Canonical payload:

```json
{
  "id": "back1",
  "type": "press_key",
  "params": {
    "key": "BACK"
  }
}
```

Initial key enum:

- `BACK`
- `HOME`
- `RECENTS`

Recommended rollout rule:

1. Land `BACK` + `HOME` end to end first.
2. Include `RECENTS` in the same change only if device validation is clean.
3. Do not include `ENTER`, `SEARCH`, or volume keys in this task.

## Technical Design

### Workgroup 1: Node contract and validation

Update the Node contract so `press_key` is a canonical action type with a
required `params.key`.

Expected touch points:

- `apps/node/src/contracts/execution.ts`
- `apps/node/src/contracts/aliases.ts`
- `apps/node/src/domain/executions/validateExecution.ts`
- any unit tests covering aliases and execution validation

Implementation notes:

- Add `key?: string` to `ActionParams`.
- Add `"press_key"` to `CANONICAL_ACTION_TYPES`.
- Keep aliases minimal. If any alias is added, prefer only obvious input sugar
  such as `key_press -> press_key`.
- Extend validation so:
  - `press_key` requires `params.key`
  - `params.key` must be one of the documented enum values
  - validation errors point to `actions.<n>.params.key`

Suggested Node enum values:

- `BACK`
- `HOME`
- `RECENTS`

Keep the validation enum uppercase and explicit. Do not accept raw integers or
Android keycode names in this task.

### Workgroup 2: Android parser and typed action model

Extend the agent payload parser and typed `UiAction` model to carry a
system-key request.

Expected touch points:

- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
- parser unit tests in
  `apps/android/shared/data/operator/src/commonTest/kotlin/actiontask/operator/agent/AgentCommandParserDefaultTest.kt`

Implementation notes:

- Add a new typed action such as `UiAction.PressKey`.
- Model the key as a narrow enum, not a free-form string.
- Parse `press_key` in `AgentCommandParserDefault`.
- Reject unknown keys during parse with a deterministic error.

Recommended Android-side enum shape:

```kotlin
enum class UiSystemKey {
    BACK,
    HOME,
    RECENTS,
}
```

Keep the enum local to the operator/task runner surface unless there is already
a better existing home for agent-execution action types.

### Workgroup 3: Android execution path via OperatorAccessibilityService

Execute `press_key` through the already-running `OperatorAccessibilityService`
instance tracked by `AccessibilityServiceManagerAndroid`.

Expected touch points:

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `apps/android/shared/data/toolkit/src/main/kotlin/clawperator/accessibilityservice/AccessibilityServiceExtAndroid.kt`
- possibly a small new mapper file if the key-to-global-action mapping should be
  isolated

Implementation notes:

- Do **not** route agent `press_key` through `MainAccessibilityService` or
  `SystemAccessibilityServiceManagerAndroid`.
- Use `taskScope` only where needed, but the actual global action should be
  performed on the active accessibility service instance already used by the
  UI-tree path.
- Add a mapper from the new `UiSystemKey` enum to:
  - `AccessibilityService.GLOBAL_ACTION_BACK`
  - `AccessibilityService.GLOBAL_ACTION_HOME`
  - `AccessibilityService.GLOBAL_ACTION_RECENTS`
- Return a normal `UiActionStepResult` with:
  - `actionType = "press_key"`
  - `data.key = <enum value>`

Failure behavior:

- If the operator accessibility service is unavailable, fail deterministically.
- If `performGlobalAction(...)` returns `false`, return a failed step result with
  a stable error code such as `GLOBAL_ACTION_FAILED`.
- Avoid silent success. This action changes global UI state and needs clear
  diagnostics.

One reasonable implementation pattern is:

1. Add a helper on `AccessibilityService` like `pressGlobalKey(UiSystemKey):
   Boolean`.
2. Have `UiActionEngine` fetch the current service from
   `AccessibilityServiceManager`.
3. Execute the global action and convert the boolean result into a step result.

If injecting `AccessibilityServiceManager` into `UiActionEngineDefault` is the
smallest clean seam, that is preferable to forcing this through older
system-action abstractions that are not part of the operator execution path.

### Workgroup 4: Result envelope and compatibility behavior

Keep the result envelope contract stable.

Expected success shape:

```json
{
  "id": "back1",
  "actionType": "press_key",
  "success": true,
  "data": {
    "key": "BACK"
  }
}
```

Expected failure shape:

```json
{
  "id": "back1",
  "actionType": "press_key",
  "success": false,
  "data": {
    "key": "BACK",
    "error": "GLOBAL_ACTION_FAILED"
  }
}
```

Do not add hidden retries for this action in the first version. Keep it
deterministic and single-attempt like the rest of the execution contract unless
there is a clear existing retry primitive already used for global actions.

### Workgroup 5: Tests

Add coverage across both Node and Android layers.

Node tests:

- validation accepts `press_key` with a supported key
- validation rejects missing `params.key`
- validation rejects unsupported keys
- alias tests if any alias is added

Android tests:

- parser accepts `press_key`
- parser rejects unsupported key names
- `UiActionEngine` returns success when the service reports `true`
- `UiActionEngine` returns failed step results when service is missing or
  `performGlobalAction(...)` returns `false`

If there is no convenient unit seam for `AccessibilityService`, add a small
adapter interface rather than leaving the action untested.

### Workgroup 6: Documentation updates

Because this changes a public agent contract, update authored docs in the same
change and regenerate generated docs if needed.

Expected touch points:

- `docs/node-api-for-agents.md`
- any other authored doc that lists supported action types
- `tasks/agent-ui-loop/api-improvement-suggestions.md` if the gap is being
  tracked there as open work
- generated docs under `sites/docs/docs/` via the repo doc-generation workflow,
  if the authored docs feed the public docs site

Docs should clearly say:

- `press_key` is supported
- initial key enum is intentionally narrow
- `BACK` and `HOME` are the guaranteed first-class keys
- `ENTER` / volume keys are not part of the first implementation

## Suggested File-Level Implementation Order

1. Update Node contracts and validation.
2. Add Node tests.
3. Add Android key enum and `UiAction.PressKey`.
4. Extend `AgentCommandParser`.
5. Extend `UiActionEngine` to execute global actions through
   `OperatorAccessibilityService`.
6. Add Android unit tests.
7. Update docs.
8. Run full validation and device smoke checks.

This order keeps the external contract and the runtime implementation aligned
and makes failures easy to localize.

## Device Validation Plan

The implementing agent has access to a real Android device that is plugged in
and reachable over ADB, so this task should be completed independently rather
than left at theory level.

Run the normal repo loop from `AGENTS.md`, then verify the new action on-device:

1. `./gradlew :app:assembleDebug`
2. `./gradlew testDebugUnitTest`
3. `npm --prefix apps/node run build`
4. `npm --prefix apps/node run test`
5. `./gradlew :app:installDebug`
6. Launch the app/accessibility flow as required by the existing setup docs
7. Run targeted execution payloads against the connected device

Minimum manual verification payloads:

### Back

1. Open Settings or another stable system app.
2. Navigate one level deeper if needed.
3. Run:

```json
{
  "commandId": "cmd-press-back",
  "taskId": "task-press-back",
  "source": "local-test",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    { "id": "back1", "type": "press_key", "params": { "key": "BACK" } },
    { "id": "snap1", "type": "snapshot_ui" }
  ]
}
```

Expected result: `back1` succeeds and the follow-up snapshot reflects the prior
screen.

### Home

1. Open any app that is clearly not the launcher.
2. Run:

```json
{
  "commandId": "cmd-press-home",
  "taskId": "task-press-home",
  "source": "local-test",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    { "id": "home1", "type": "press_key", "params": { "key": "HOME" } },
    { "id": "snap1", "type": "snapshot_ui" }
  ]
}
```

Expected result: `home1` succeeds and the snapshot shows launcher/home UI.

### Recents

Only if included in the same change:

```json
{
  "commandId": "cmd-press-recents",
  "taskId": "task-press-recents",
  "source": "local-test",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    { "id": "recents1", "type": "press_key", "params": { "key": "RECENTS" } },
    { "id": "snap1", "type": "snapshot_ui" }
  ]
}
```

Expected result: success on stock Android and a snapshot that reflects the
overview screen. If OEM behavior is unstable, keep `RECENTS` out of the first
ship.

## Risks and Decisions

### 1. Do not reuse the legacy system-action service path for agent execution

There is already older system-action infrastructure in the repo, but the
operator runtime currently executes through `OperatorAccessibilityService`.
Using a separate accessibility service for `press_key` would make the execution
path harder to reason about and harder to debug.

Decision:

- the agent execution path should stay single-path and use
  `OperatorAccessibilityService`

### 2. Keep the enum narrow

A narrow enum is a feature here, not a limitation. It protects the deterministic
contract and avoids dragging raw key injection into the first implementation.

Decision:

- first ship only accessibility-global-action-backed keys

### 3. Prefer explicit failure over fallback

Do not silently fall back to `adb shell input keyevent` or another non-runtime
path if `performGlobalAction(...)` fails.

Decision:

- fail with a stable step-level error and let the agent decide how to recover

## Definition of Done

- `press_key` is accepted by Node validation with documented enum values
- Android parser accepts and types the action
- Android runtime executes `BACK` and `HOME` through
  `OperatorAccessibilityService.performGlobalAction(...)`
- success and failure are reflected in canonical `stepResults`
- unit tests cover parsing and validation
- device verification is completed on the attached Android device
- authored docs are updated in the same change
- the implementing agent creates a local commit when the logical unit of work is
  complete

## Commit Instruction

When implementation and validation are complete, create a narrow local commit
before stopping for review. Use a conventional commit message, for example:

`feat(node-api): add press_key system action`

Do not stop after editing code without validating on the attached Android device.
