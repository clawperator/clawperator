# Task: Node API Add System Key Actions

## Goal

Add a first-class `press_key` execution action to the Clawperator Node API and
Android runtime so agents can express common Android system-navigation steps
inside the canonical execution payload rather than escaping to ad hoc `adb shell
input keyevent` calls.

The first shipping slice should prioritize:

- `back`
- `home`

The next supported key can be:

- `recents`

The runtime path should use the active
`OperatorAccessibilityService` and Android accessibility global actions. Do not
introduce a parallel control path through `MainAccessibilityService` for agent
executions.

## Why This Slice

`back` and `home` cover the highest-frequency navigation gaps and both map
cleanly to `AccessibilityService.performGlobalAction(...)`.

`recents` is also a good fit for the same mechanism, but it is lower priority
than `back` and `home`.

`enter`, `search`, `volume_up`, and `volume_down` do **not** fit the same
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
    "key": "back"
  }
}
```

Initial key enum (lowercase, consistent with existing param conventions):

- `back`
- `home`
- `recents`

Key names follow the existing lowercase-on-the-wire convention used by all other
string enum params in this API (`"direction": "down"`, `"clickType": "long_click"`,
`"validator": "temperature"`). The Android-side enum uses uppercase identifiers
(`BACK`, `HOME`, `RECENTS`) per Kotlin convention, but the wire value is lowercase.
The Android parser normalizes via `.lowercase()` before matching.

Recommended rollout rule:

1. Land `back` + `home` end to end first.
2. Include `recents` in the same change only if device validation is clean.
3. Do not include `enter`, `search`, or volume keys in this task.

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
  - `params.key` must be one of the documented lowercase enum values
  - validation errors point to `actions.<n>.params.key`

Supported Node key values (lowercase):

- `back`
- `home`
- `recents`

Do not accept uppercase variants or raw integers in this task.

### Workgroup 2: Android parser and typed action model

Extend the agent payload parser and typed `UiAction` model to carry a
system-key request.

Expected touch points:

- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
- parser unit tests in
  `apps/android/shared/data/operator/src/commonTest/kotlin/actiontask/operator/agent/AgentCommandParserDefaultTest.kt`

Implementation notes:

- Add a new typed action `UiAction.PressKey`.
- Model the key as a narrow enum, not a free-form string. Define it alongside
  `UiAction` in the `task` module.
- Parse `press_key` in `AgentCommandParserDefault` using `.lowercase()` matching,
  consistent with all other string enum params in the parser.
- Reject unknown keys during parse with a deterministic error.

Android-side enum shape (Kotlin convention: uppercase identifiers, lowercase wire
values):

```kotlin
enum class UiSystemKey {
    BACK,
    HOME,
    RECENTS;

    companion object {
        fun fromWire(value: String): UiSystemKey =
            when (value.lowercase()) {
                "back" -> BACK
                "home" -> HOME
                "recents" -> RECENTS
                else -> error("unsupported key: $value")
            }
    }
}
```

Keep the enum in the `task` module alongside `UiAction.kt`. Do not place it in
`toolkit` - the enum is a task-layer concept, not a toolkit-layer concept.

### Workgroup 3: Android execution path via OperatorAccessibilityService

Execute `press_key` through the already-running `OperatorAccessibilityService`
instance tracked by `AccessibilityServiceManagerAndroid`.

Expected touch points:

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `apps/android/shared/app/di/src/main/kotlin/clawperator/di/module/AppModule.kt`
  (to inject `AccessibilityServiceManager` into `UiActionEngineDefault`)

Implementation notes:

- Do **not** route agent `press_key` through `MainAccessibilityService` or
  `SystemAccessibilityServiceManagerAndroid`.
- Inject `AccessibilityServiceManager` into `UiActionEngineDefault` alongside
  the existing `DeveloperOptionsManager`. This is the smallest clean seam.
- Do **not** add a new `pressGlobalKey` extension to
  `AccessibilityServiceExtAndroid.kt`. The `UiSystemKey` enum lives in the
  `task` module; `AccessibilityServiceExtAndroid.kt` is in `toolkit`. Crossing
  that module boundary for a five-line mapping creates an awkward dependency.
  Instead, put the `UiSystemKey -> GLOBAL_ACTION_*` mapping inline in
  `executePressKey` as a private `when` expression.
- The inline mapping is:
  - `UiSystemKey.BACK -> AccessibilityService.GLOBAL_ACTION_BACK`
  - `UiSystemKey.HOME -> AccessibilityService.GLOBAL_ACTION_HOME`
  - `UiSystemKey.RECENTS -> AccessibilityService.GLOBAL_ACTION_RECENTS`
- Return a normal `UiActionStepResult` with:
  - `actionType = "press_key"`
  - `data["key"] = action.key.name.lowercase()`

Failure behavior (two distinct cases):

- If the operator accessibility service is **unavailable** (null from the
  manager), throw an `IllegalStateException`. This is a hard configuration
  error - the service should always be running when agent commands are dispatched.
  Throwing terminates the plan and surfaces clearly in the execution result, the
  same way a missing node terminates a `click` action. Do not swallow this.
- If the service is available but `performGlobalAction(...)` returns **false**,
  return a failed step result with a stable error code. This is a soft OS-level
  failure - the service was present but Android rejected the global action (e.g.
  OEM restriction, transient system state). Returning a step result (rather than
  throwing) preserves the rest of the diagnostic envelope and lets the agent
  observe and recover.

Expected failure shape for `performGlobalAction` returning false:

```json
{
  "id": "back1",
  "actionType": "press_key",
  "success": false,
  "data": {
    "key": "back",
    "error": "GLOBAL_ACTION_FAILED"
  }
}
```

Do not add hidden retries for this action in the first version. Keep it
deterministic and single-attempt like the rest of the execution contract.

### Workgroup 4: Result envelope and compatibility behavior

Keep the result envelope contract stable.

Expected success shape:

```json
{
  "id": "back1",
  "actionType": "press_key",
  "success": true,
  "data": {
    "key": "back"
  }
}
```

Expected failure shape (soft OS failure):

```json
{
  "id": "back1",
  "actionType": "press_key",
  "success": false,
  "data": {
    "key": "back",
    "error": "GLOBAL_ACTION_FAILED"
  }
}
```

Note: service-unavailable failures throw and do not produce a step result. They
surface as an execution-level error in the outer result envelope.

### Workgroup 5: Tests

Add coverage across both Node and Android layers.

Node tests:

- validation accepts `press_key` with a supported key (`"back"`, `"home"`, `"recents"`)
- validation rejects missing `params.key`
- validation rejects unsupported keys
- alias tests if any alias is added

Android tests:

- parser accepts `press_key` and normalizes key via `.lowercase()`
- parser rejects unsupported key names
- `UiActionEngine` returns success when the service reports `true`
- `UiActionEngine` returns failed step result when `performGlobalAction(...)` returns `false`
- `UiActionEngine` throws when the accessibility service is null

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
- `back` and `home` are the guaranteed first-class keys
- `enter` / volume keys are not part of the first implementation
- key values are lowercase on the wire, consistent with other string enum params

## Suggested File-Level Implementation Order

1. Update Node contracts and validation.
2. Add Node tests.
3. Add Android key enum and `UiAction.PressKey`.
4. Extend `AgentCommandParser`.
5. Extend `UiActionEngine` to execute global actions through
   `OperatorAccessibilityService`.
6. Update DI wiring in `AppModule.kt`.
7. Add Android unit tests.
8. Update docs.
9. Run full validation and device smoke checks.

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
    { "id": "back1", "type": "press_key", "params": { "key": "back" } },
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
    { "id": "home1", "type": "press_key", "params": { "key": "home" } },
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
    { "id": "recents1", "type": "press_key", "params": { "key": "recents" } },
    { "id": "snap1", "type": "snapshot_ui" }
  ]
}
```

Expected result: success on stock Android and a snapshot that reflects the
overview screen. If OEM behavior is unstable, keep `recents` out of the first
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

- service-unavailable: throw (hard error, terminates plan)
- `performGlobalAction` returns false: return failed step result with
  `GLOBAL_ACTION_FAILED` (soft OS failure, agent can observe and recover)

### 4. Wire format is lowercase, Kotlin enum is uppercase

Key values follow the lowercase-on-the-wire convention (`"back"`, `"home"`,
`"recents"`) consistent with `direction`, `clickType`, and `validator` params.
The Android enum uses `BACK`, `HOME`, `RECENTS` per Kotlin convention and the
parser bridges the two via `.lowercase()` matching. No `pressGlobalKey` extension
in `toolkit` - mapping is inline in `UiActionEngine.executePressKey`.

### 5. `UiSystemKey` stays in the `task` module

`UiSystemKey` is a task-layer concept. Placing it in `toolkit` to support a
typed extension function would create an inappropriate dependency between modules.
The `GLOBAL_ACTION_*` mapping is a private five-line `when` expression inside
`UiActionEngineDefault`.

## Definition of Done

- `press_key` is accepted by Node validation with documented lowercase enum values
- Android parser accepts and types the action
- Android runtime executes `back` and `home` through
  `OperatorAccessibilityService.performGlobalAction(...)`
- service-unavailable throws; `performGlobalAction` returning false returns a
  failed step result with `GLOBAL_ACTION_FAILED`
- unit tests cover parsing, validation, success, soft failure, and hard failure
- device verification is completed on the attached Android device
- authored docs are updated in the same change
- the implementing agent creates a local commit when the logical unit of work is
  complete

## Commit Instruction

When implementation and validation are complete, create a narrow local commit
before stopping for review. Use a conventional commit message, for example:

`feat(node-api): add press_key system action`

Do not stop after editing code without validating on the attached Android device.
