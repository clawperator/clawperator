# Pivot Plan: ActionTask -> Agent-Controlled UI Automation

## Why this document
This plan describes how to move ActionTask from hardcoded workflows (especially in `WorkflowFactoryDefault`) to a generic, agent-controlled system that can be driven by OpenClaw.

> Canonical usage/authoring guide for LLMs: `doc/operator-llm-playbook.md`.

It includes:
- a reusable prompt for a Codex-style implementation agent
- a concrete redesign plan with phases, file touch points, and acceptance criteria
- a compatibility strategy so existing commands keep working during migration

## Current migration status (Feb 16, 2026)

- Reliability convention for agent recipes: prefer `close_app` then `open_app` before navigation/reads, so plans run from a deterministic fresh state (not resumed UI).
- Generic `UiActionEngine` is implemented in `shared/data/task/.../UiActionEngine.kt`.
- `temperature:get` now executes a typed generic plan (close/open/snapshot/read_text) via `UiActionEngine`, instead of direct hardcoded TaskUi calls in `WorkflowFactoryDefault`.
- Broadcast agent ingress is available via `app.actiontask.operator.ACTION_AGENT_COMMAND` with bounded payload validation, typed parsing, and correlation IDs (`commandId`, `taskId`). For safety, this ingress is accepted only on debuggable builds.
- `ACTION_LOG_UI` now routes through the same internal `snapshot_ui` typed action execution path for compatibility.
- Added `ac:status` operator command that uses the generic agent-action path to open Google Home, navigate to the Climate tile, long-press the controller card, and extract a status summary (`power`, `mode`, `indoor_temp`).

### Agent command broadcast (MVP)
```bash
adb shell am broadcast \
  -a app.actiontask.operator.ACTION_AGENT_COMMAND \
  --es payload '{"commandId":"cmd-1","taskId":"task-1","source":"debug","actions":[{"id":"s1","type":"snapshot_ui","params":{"format":"ascii"}}]}' \
  --receiver-foreground
```

## Recommended Agent Prompt (drop-in)
Use this prompt to onboard a new coding agent to this repository:

```text
You are working in ~/src/ActionTask.

1) Read AGENTS.md and all files in /doc first.
2) Understand the current operator flow, focusing on:
   - shared/data/operator/src/androidMain/kotlin/actiontask/operator/accessibilityservice/OperatorAccessibilityService.kt
   - shared/data/operator/src/androidMain/kotlin/actiontask/operator/runtime/OperatorCommandReceiver.kt
   - shared/data/operator/src/commonMain/kotlin/actiontask/operator/command/*
   - shared/data/workflow/src/commonMain/kotlin/actiontask/workflow/WorkflowFactoryDefault.kt
   - shared/data/task/src/commonMain/kotlin/actiontask/task/runner/*
3) Prepare and validate local operator control:
   - Run scripts/grant_operator_permissions.sh
   - Use adb logcat and monitor logs prefixed with [Operator-AccessibilityService]
   - Use ACTION_LOG_UI to force an immediate on-demand UI snapshot whenever needed
   - Open several real apps on the connected Android device and observe how the UI appears in logs/tree output
4) Refactor away hardcoded workflow logic by introducing a generic action execution layer (app launch, wait, find, click, scroll, read text, assert, snapshot).
5) Implement a command ingress path that supports machine-generated actions (broadcast first, network-backed queue optional), with strict validation and correlation IDs.
6) Keep backwards compatibility for existing commands (ac:on, ac:off, temperature:get, uitree:log, etc.) while routing internals through the new generic executor.
7) Implement a first concrete generic plan for “fetch bedroom temperature” and wire it to the existing temperature command path.
8) Add tests for command parsing/validation, action execution, and regression tests for existing behavior.
9) Update docs with architecture, command schema, and debugging instructions.

Constraints:
- Prefer extending TaskScope/TaskUiScope primitives instead of adding app-specific logic.
- Keep incremental commits and do not remove working behavior until compatibility is proven.
- Add robust logging and structured telemetry for each action step.
```

## Current state (what exists now)

### Operator runtime path
Current command path is:
1. Firebase function enqueues and sends FCM (`firebase/functions/index.js`).
2. Device receives FCM in `OperatorFirebaseMessagingService`.
3. `OperatorCommandParserDefault` maps string commands into a sealed `OperatorCommand`.
4. `OperatorCommandExecutorDefault` calls `WorkflowManager` methods.
5. `WorkflowManagerDefault` delegates to `WorkflowFactoryDefault` (hardcoded app flows).

### Core hardcoded bottleneck
`WorkflowFactoryDefault` contains app- and UI-specific logic for:
- SwitchBot temperature (`com.theswitchbot.switchbot:id/tvTemp`)
- SwitchBot garage action (`abPress`)
- Google Home climate navigation and toggle handling

This logic works, but it makes scaling to arbitrary tasks expensive and brittle.

### Existing useful primitives (already good)
- `TaskScope` and `TaskUiScope` already expose generic operations:
  - `openApp`, `closeApp`, `pause`, `logUiTree`
  - `waitForNode`, `getText`, `click`, `scrollUntil`, `clickAfterScroll`, `getCurrentToggleState`, `setCurrentToggleState`
- `TaskEvent` already provides structured step telemetry (`StageStart`, `StageSuccess`, `StageFailure`, `RetryScheduled`, `Log`).
- Broadcast operator entry points already exist (`OperatorCommandReceiver`, `scripts/operator_event.sh`).

### Accessibility/logging reality
- `OperatorAccessibilityService` currently logs all accessibility events with `[Operator-AccessibilityService]` prefix.
- UI trees are already printable in ASCII (`TaskScopeDefault.logUiTree` + `UiTreeFormatterDefault`).
- `OperatorCommandReceiver.ACTION_LOG_UI` (`app.actiontask.operator.ACTION_LOG_UI`) can be invoked at any time to dump the current UI tree, independent of normal workflow execution.
- Permission script name in this repo is `scripts/grant_operator_permissions.sh` (plural), not `grant_operator_permission.sh`.

## Target architecture

### Design goals
1. No app-specific control logic in `WorkflowFactoryDefault`.
2. Agent can inspect UI state and issue next actions incrementally.
3. Actions are typed, validated, auditable, and replayable.
4. Existing commands continue to work during migration.

### Proposed layers

#### 1) Agent Command Ingress
Add a new command path that accepts structured actions (JSON contract), initially over broadcast on-device, then optionally via backend queue.

Candidate components:
- `AgentCommandReceiver` (Android): receives and validates command payloads.
- `AgentCommandParser`: converts JSON to typed actions.
- `AgentCommandExecutor`: routes actions through the generic task runner.

#### 2) Generic UI Action Engine
Build `UiActionEngine` over `TaskScope`/`TaskUiScope` primitives.

Action examples:
- `open_app(applicationId)`
- `wait_for_node(matcher, retry)`
- `click(matcher, clickType)`
- `scroll_and_click(target, container, direction, maxSwipes)`
- `read_text(matcher, validator?)`
- `snapshot_ui(format=ascii|json)`
- `sleep(durationMs)`

The engine executes action lists and emits structured per-step outcomes.

#### 3) Observation channel for agents
Keep logcat output for humans, but also emit machine-parseable events:
- action started/succeeded/failed
- ui snapshot metadata (window id, node count, hash)
- optional bounded snapshot payload (ascii/json)

Implementation decision:
- Keep `ACTION_LOG_UI` as the low-level immediate observation trigger.
- Add a first-class action type `snapshot_ui` in `UiActionEngine` and route it through the same internal code path used by `ACTION_LOG_UI`.
- This gives us both:
  - backwards-compatible manual control (`adb`/broadcast/scripts), and
  - agent-safe typed observation in plans/tool calls.

#### 4) Compatibility adapter
Refactor old workflow methods to compile into generic action plans instead of doing direct app-specific calls.

Example:
- `getSwitchBotTemperature(taskScope)` becomes a wrapper that builds and runs a `BedroomTemperaturePlan` through `UiActionEngine`.

## OpenClaw alignment

OpenClaw docs indicate:
- gateway uses JSON-RPC over WebSocket
- nodes expose invokable methods and can be called through `node.invoke`
- sessions and command queueing are first-class concepts

Recommended ActionTask/OpenClaw mapping:
1. Treat ActionTask as a node with a constrained tool surface.
2. Expose methods like:
   - `actiontask.snapshot_ui`
   - `actiontask.find_node`
   - `actiontask.click_node`
   - `actiontask.read_text`
   - `actiontask.execute_plan`
3. Keep transport decoupled from execution so same engine can run from:
   - local broadcast (dev)
   - Firebase/HTTP queue (existing infra)
   - OpenClaw node invocation (target)

### OpenClaw Skills integration (observation-first)
OpenClaw Skills are AgentSkills-compatible instruction folders (`SKILL.md` + frontmatter), loaded with precedence: `<workspace>/skills` -> `~/.openclaw/skills` -> bundled. This is a good fit for codifying an ActionTask observation loop.

Recommended first skill pattern:
1. Create a skill that teaches the agent to call `actiontask.snapshot_ui`:
   - before starting a plan
   - after each navigation/click step
   - immediately on any failure/retry
2. The skill should prefer structured snapshot output when available, and fall back to `ACTION_LOG_UI` log parsing for compatibility.
3. Keep the skill small and procedural (observe -> decide -> act -> observe) so it is reusable across apps.
4. When appropriate, configure the skill as direct tool dispatch (slash command -> tool) so observation actions can bypass extra model hops.

Example skill shape (tool names may vary by deployment):

```yaml
---
name: actiontask_observe_ui
description: Capture an immediate ActionTask UI snapshot for decision making.
user-invocable: true
command-dispatch: tool
command-tool: actiontask_bridge
command-arg-mode: raw
---
```

## Command contract (first draft)

```json
{
  "commandId": "uuid",
  "taskId": "uuid-or-external-id",
  "source": "openclaw|debug|firebase",
  "timeoutMs": 30000,
  "actions": [
    {
      "id": "step-1",
      "type": "open_app",
      "params": { "applicationId": "com.theswitchbot.switchbot" }
    },
    {
      "id": "step-2",
      "type": "read_text",
      "params": {
        "matcher": { "resourceId": "com.theswitchbot.switchbot:id/tvTemp" },
        "validator": "temperature"
      }
    }
  ]
}
```

### Result contract (first draft)

```json
{
  "commandId": "uuid",
  "taskId": "uuid-or-external-id",
  "status": "success|failed|partial",
  "startedAt": "epoch-ms",
  "endedAt": "epoch-ms",
  "steps": [
    {
      "id": "step-2",
      "status": "success",
      "data": { "text": "22.4 C" }
    }
  ],
  "error": null
}
```

## Implementation roadmap

## Phase 0: Observability hardening
- Add stable correlation IDs from ingress to action execution logs.
- Add structured event logging bridge from `TaskEvent` to operator task status progress (currently TODO in `OperatorCommandExecutorDefault`).
- Add a dedicated log prefix for machine events (for example `[Operator-AgentEvent]`).
- Define `snapshot_ui` telemetry schema and ensure `ACTION_LOG_UI` emits the same metadata envelope.

Acceptance:
- One command shows consistent `taskId/commandId` in all key logs.
- Progress updates appear remotely (not just started/finished/failed).

## Phase 1: Agent command ingress (broadcast)
- Add `ACTION_AGENT_COMMAND` receiver and payload parser.
- Validate schema, timeout bounds, max action count, and matcher safety.
- Return/emit structured command result.
- Support action type `snapshot_ui` from day one, implemented via the existing log UI internals (not a separate duplicated path).

Acceptance:
- You can submit a JSON action list over `adb shell am broadcast ...` and run it end-to-end.

## Phase 2: Generic UiActionEngine
- Introduce typed action models and a dispatcher.
- Implement executor methods using existing `TaskScope` and `TaskUiScope` methods.
- Add retriable failure handling consistent with existing `TaskRetry` behavior.

Acceptance:
- Engine can execute common actions with deterministic per-step result payloads.

## Phase 3: Bedroom temperature plan via generic engine
- Replace `WorkflowFactoryDefault.getSwitchBotTemperature` internals with a generated/declared plan.
- Keep `temperature:get` public command unchanged.
- Ensure current behavior still returns parsed `Temperature`.

Acceptance:
- `temperature:get` works with zero direct hardcoded TaskUi logic in `WorkflowFactoryDefault`.

## Phase 4: OpenClaw adapter
- Add adapter layer translating OpenClaw invocation payloads to `AgentCommand`.
- Keep this adapter thin; all business logic stays in `UiActionEngine`.
- Add auth/capability controls before enabling remote arbitrary actions.

Acceptance:
- A single OpenClaw `node.invoke` call can trigger `snapshot_ui` and `execute_plan` successfully.

## Phase 5: Decommission hardcoded workflows
- Migrate remaining hardcoded methods (`toggleSwitchBotSwitch`, Google Home flows).
- Keep legacy wrappers only as semantic aliases until clients migrate.

Acceptance:
- `WorkflowFactoryDefault` becomes orchestration-only or is replaced with plan registry.

## File-level change plan

Likely new files:
- `shared/data/operator/src/commonMain/kotlin/actiontask/operator/agent/AgentCommand.kt`
- `shared/data/operator/src/commonMain/kotlin/actiontask/operator/agent/AgentCommandParser.kt`
- `shared/data/operator/src/commonMain/kotlin/actiontask/operator/agent/AgentCommandExecutor.kt`
- `shared/data/task/src/commonMain/kotlin/actiontask/task/runner/UiActionEngine.kt`
- `shared/data/operator/src/androidMain/kotlin/actiontask/operator/agent/AgentCommandReceiver.kt`

Likely edited files:
- `shared/data/workflow/src/commonMain/kotlin/actiontask/workflow/WorkflowFactoryDefault.kt`
- `shared/data/operator/src/commonMain/kotlin/actiontask/operator/command/OperatorCommandExecutorDefault.kt`
- `shared/data/operator/src/commonMain/kotlin/actiontask/operator/command/OperatorCommandParser.kt`
- `app/src/main/AndroidManifest.xml`
- `firebase/functions/allowedCommands.js` (if adding remote command type)

## Testing and validation

### Unit tests
- Parser validation tests (required fields, unknown action type, bounds checks).
- Action engine tests with `TaskScope`/`TaskUiScope` mocks.
- Regression tests for existing command semantics (`temperature:get`, `ac:on`, etc).

### Device/integration tests
1. Grant permissions:
```bash
./scripts/grant_operator_permissions.sh
```
2. Watch accessibility logs:
```bash
adb logcat | grep -F "[Operator-AccessibilityService]"
```
3. Trigger debug actions:
```bash
./scripts/operator_event_log_ui.sh
./scripts/operator_event_run_task.sh
```
4. Trigger new agent command (phase 1):
```bash
adb shell am broadcast -a app.actiontask.operator.ACTION_AGENT_COMMAND --es payload '<json>'
```
5. Trigger direct on-demand snapshot anytime (existing mechanism):
```bash
./scripts/operator_event_log_ui.sh
# or
adb shell am broadcast -a app.actiontask.operator.ACTION_LOG_UI --receiver-foreground
```

## Key risks and mitigations
- Risk: unrestricted remote click surface.
  - Mitigation: capability allowlist + source auth + per-app policy.
- Risk: brittle selectors across app updates.
  - Mitigation: fallback match strategies + snapshot-on-failure + plan versioning.
- Risk: event/log volume and PII leakage.
  - Mitigation: redaction rules, bounded payload size, optional hashing for text.
- Risk: migration regressions.
  - Mitigation: dual-path compatibility + staged rollout + golden tests.

## Decision checkpoints
1. Transport first: broadcast-only for MVP, then backend/OpenClaw remote.
2. Plan format: typed Kotlin model first, JSON DSL second.
3. OpenClaw integration point: direct node adapter vs dedicated gateway proxy.
4. Observation contract: rely only on logcat text vs return structured `snapshot_ui` payloads (recommended: structured payloads, with logcat as fallback).

## References
- OpenClaw architecture: https://docs.openclaw.ai/architecture
- OpenClaw gateway protocol and methods: https://docs.openclaw.ai/gateway/protocol
- OpenClaw Skills: https://docs.openclaw.ai/tools/skills
- OpenClaw node helpers: https://docs.openclaw.ai/nodes/advanced/node-helpers
- OpenClaw tool invocation pattern: https://docs.openclaw.ai/tools/invoke-api
- OpenClaw command queue concepts: https://docs.openclaw.ai/sdk/host/command-queue
