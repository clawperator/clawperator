# Clawperator Runtime Architecture and API Rationale

Product naming:

- Product: `Clawperator`
- Android package/application namespace: `com.clawperator.operator`

## Purpose

Clawperator is a deterministic actuator tool that allows agents to execute Android automations on behalf of a user. It provides a stable layer for LLM-driven device control with deterministic inputs/outputs, eliminating the need for brittle, direct recipe-specific shell scripting.

Execution model:

1. Agents call Clawperator CLI/API.
2. Clawperator performs `adb` and Android tooling interactions.
3. Clawperator sends validated runtime commands to Android (`ACTION_AGENT_COMMAND`).
4. Clawperator returns structured execution results.

Critical requirement:

- Skill artifacts are optional.
- If no artifact exists, or an artifact is wrong/stale due to UI drift, feature flags, staged rollouts, or account-level variants, agents must still execute using generic runtime actions and live UI observation.

Agent-customer policy:

- The **Clawperator Node runtime interface** (CLI + HTTP API) is the primary/default interface for agents.
- The Android APK/runtime service is an execution target, not the agent-facing integration surface.
- Agents should not need direct `adb` for common tasks.
- Raw `adb` remains available as an explicit fallback for edge cases and debugging.

Design implication:

- If a workflow is common (for example package listing, screenshots, device discovery, app open/close, execution, snapshot, logs), provide a first-class Clawperator command/API for it.

## Shipped Commands

Core commands:

- `clawperator doctor`: Validate prerequisites and environment.
- `clawperator devices`: Discover connected device IDs.
- `clawperator packages list`: Confirm presence of receiver and target apps on device.
- `clawperator execute`: Run an execution JSON payload.
- `clawperator observe snapshot`: Get current UI hierarchy as `hierarchy_xml`.
- `clawperator observe screenshot`: Capture device screen.
- `clawperator action [open-app|click|read|wait|type]`: Single-step interaction wrappers.
- `clawperator serve`: Start HTTP/SSE server for remote agent access.
- `clawperator doctor --fix`: Best-effort environment remediation.
- `clawperator skills install/update/search/run`: Skills lifecycle.
- `clawperator version --check-compat`: CLI/APK compatibility check.

Contracts:

- **Canonical Envelope:** `[Clawperator-Result] {JSON}` is the ONLY way success/failure is reported.
- **`expectedFormat` Required:** Every observation/execution must include `expectedFormat: "android-ui-automator"`.
- **Single-Flight Lock:** Only one execution per `deviceId` / `receiverPackage` at a time. Overlaps return `EXECUTION_CONFLICT_IN_FLIGHT`.

## HTTP API Server (`serve`)

When running `clawperator serve [--port <number>] [--host <string>]`, a local HTTP server is started to allow remote agents to interact with Clawperator without direct CLI access.

> ⚠️ **Security Warning**: The HTTP API currently provides **no authentication or authorization**. By default, it binds to `127.0.0.1` (localhost) for safety. If you bind to `0.0.0.0` or a public IP via `--host`, any client on your network can remotely control your connected Android devices. Only expose this API on trusted networks or behind an authenticated gateway.

### REST Endpoints

- **`GET /devices`**: List all connected Android devices and their states.
- **`POST /execute`**: Execute a full JSON execution payload.
    - Body: `{"execution": {...}, "deviceId": "...", "receiverPackage": "..."}`
    - Returns: `RunExecutionResult` (200 OK or 4xx/5xx on failure).
    - Status **423 Locked**: Returned if another execution is in flight for the target device.
- **`POST /observe/snapshot`**: Quick helper for UI capture.
    - Body: `{"deviceId": "...", "receiverPackage": "..."}`
- **`POST /observe/screenshot`**: Quick helper for visual capture.
    - Body: `{"deviceId": "...", "receiverPackage": "..."}`

### Event Streaming (SSE)

The server provides a real-time event stream at **`GET /events`**. Callers should use a standard SSE client to subscribe.

- **Event: `clawperator:result`**: Emitted when an execution reaches a terminal state (success or failure) and a deviceId is known.
    - Data: `{"deviceId": "...", "envelope": {...}}`
- **Event: `clawperator:execution`**: Emitted for *every* attempt to run an execution, including pre-resolution failures.
    - Data: `{"deviceId": "...", "input": {...}, "result": {...}}`
- **Event: `heartbeat`**: Upon connection, a `{"code": "CONNECTED", ...}` message is sent to verify the stream is active.

### Concurrency and Locking

The server utilizes an in-memory single-flight lock per `deviceId`. If a second request arrives for the same device while an execution is in progress, the server returns **HTTP 423 (Locked)** immediately.

## Determinism Doctrine

1. **No Hidden Logic:** Clawperator never retries a failed action or auto-falls back to a different strategy (e.g., from `artifact` to `direct`).
2. **Pre-Flight Validation:** Every execution is validated against the target device and receiver capabilities before any ADB call is made.
3. **Canonical Result:** Exactly one terminal envelope per `commandId`. If a timeout occurs, the CLI emits a `RESULT_ENVELOPE_TIMEOUT` error.

## Error Taxonomy

LLM agents must use these codes to decide their next step.

### Setup & Connectivity
- `ADB_NOT_FOUND`: ADB is missing from PATH.
- `NO_DEVICES`: No Android devices are connected via USB/Network.
- `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`: More than one device exists; specify `--device-id`.
- `RECEIVER_NOT_INSTALLED`: The target receiver package is not on the device.

### Execution & State
- `EXECUTION_VALIDATION_FAILED`: The execution JSON is malformed or invalid.
- `EXECUTION_ACTION_UNSUPPORTED`: The requested action type is not supported by the runtime.
- `EXECUTION_CONFLICT_IN_FLIGHT`: A command is already running on the target device.
- `RESULT_ENVELOPE_TIMEOUT`: The command ran but no terminal envelope was received within the timeout.
- `RESULT_ENVELOPE_MALFORMED`: Logcat emitted an invalid JSON envelope.

### UI & Nodes
- `NODE_NOT_FOUND`: The selector (matcher) failed to find the target UI element.
- `NODE_NOT_CLICKABLE`: The target element was found but is not enabled/clickable.
- `SECURITY_BLOCK_DETECTED`: A system-level security overlay (e.g., "Package Installer" or "Permission Dialog") is blocking interaction.

## Detailed Step-Level Error Handling

While the top-level `status` indicates overall command success, individual `stepResults` can provide granular failure diagnostics. This is essential for agents to reason about partial completions.

### Step Error Format
When a step fails but the runtime continues (or fails fast), the `stepResults` entry will include:
- `success: false`
- `data.error`: A stable machine-readable error code.
- `data.message`: A human-readable (and LLM-readable) explanation.

### Example: normalized `close_app`
`close_app` is executed pre-flight in the Node layer via `adb shell am force-stop`.
When that force-stop succeeds, the Node layer normalizes the step result to a
successful `close_app` outcome so the envelope matches what actually happened on
the device.

```json
{
  "id": "step-1",
  "actionType": "close_app",
  "success": true,
  "data": {
    "application_id": "com.example.app"
  }
}
```

## Safety & Concurrency

### In-Flight Semantics
A command is considered "in-flight" from the moment the ADB broadcast is sent until the `[Clawperator-Result]` is received or the `timeoutMs` is reached. If a command times out, the lock is held for an additional 2000ms "settle" window before allowing the next execution.

### PII Redaction Policy
By default, Clawperator returns **full-fidelity** UI text to the agent for maximum reasoning accuracy.

- **User Warning:** Results *will* contain sensitive data (names, account digits, OTPs) if they are visible on the screen.
- **Agent Mitigation:** Do not ship raw Clawperator results to long-term storage without user consent.

## API-First, ADB-Capable

This runtime is intentionally **API-first**:

1. Agents should use Clawperator commands/APIs by default.
2. Clawperator should wrap common Android/adb operations behind stable, typed contracts.
3. Direct adb usage is a fallback path, not the baseline integration model.

Direct adb is still supported for:

- unsupported/emerging edge cases,
- low-level diagnostics,
- temporary gaps before a stable Clawperator primitive exists.

When fallback adb is used, Clawperator should still encourage convergence back to first-class APIs by:

- exposing equivalent primitives as they become common,
- keeping result/error formats structured and machine-readable,
- documenting fallback-to-API migration paths.

## Skill Artifact Optionality and Failure Handling

Skill artifacts are optional, but fallback behavior is explicit:

1. If artifact compile succeeds, execute compiled execution.
2. If artifact compile fails, Clawperator returns a structured compile error and does not auto-fallback.
3. If runtime verification fails, Clawperator returns a structured execution failure and does not auto-retry with alternate strategy.
4. Agent chooses next step (retry, inspect UI, switch to direct actions, or abort).

Runtime must expose a `mode` on each execution:

- `artifact_compiled`
- `direct`

This keeps behavior deterministic and avoids hidden control-flow in the runtime.

## Execution Unit Contract

Use one term everywhere: `execution`.

- `compile` produces an `execution`.
- `execute` runs an `execution`.

Execution schema aligns with Android `AgentCommand` constraints.

Execution input may come from:

1. skill artifact compile output, or
2. direct action list authored by agent/tooling.

Example execution:

```json
{
  "commandId": "cmd-123",
  "taskId": "task-123",
  "source": "openclaw",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 90000,
  "actions": [
    { "id": "close", "type": "close_app", "params": { "applicationId": "com.example.app" } },
    { "id": "open", "type": "open_app", "params": { "applicationId": "com.example.app" } },
    { "id": "wait", "type": "sleep", "params": { "durationMs": 3000 } }
  ]
}
```

## Device Selection Policy (v1)

`deviceId?: string` is supported on execute/observe.

Selection behavior:

1. If exactly one connected device exists and `deviceId` is omitted, use that device.
2. If more than one connected device exists, `deviceId` is required.
3. If provided `deviceId` is not connected in `device` state, fail preflight.

## Agentic Best-Effort Mode

Best-effort mode is a first-class execution path for unknown or drifting UIs.

Behavior goals:

1. Observe current UI (`snapshot_ui`).
2. Identify likely anchors (toolbar/tab/menu/button/search patterns).
3. Attempt constrained navigation/action.
4. Re-observe and verify progress.
5. Retry within safety bounds.

Best-effort does not imply unsafe freeform behavior; all attempts remain within validated runtime action limits and capability policy.

Important ownership split:

- Clawperator provides primitives and structured observations.
- The agent owns exploration policy/strategy.
- Clawperator should not silently invent fallback control flow.

Cardinality drift handling:

- Execution should tolerate mismatches between recipe assumptions and live UI (for example expected second device tile but only one exists).
- Runtime returns structured ambiguity/partial outcomes rather than hard-failing every mismatch.
- Agent decides whether to proceed with alternate target selection or stop.

## Result Transport Channel (v1 choice)

Chosen v1 mechanism:

- logcat JSON envelope with strict prefix.

Required Android emission format (single line):

- `[Clawperator-Result] {"commandId":"...","taskId":"...","status":"success|failed","stepResults":[...],"error":null}`

Current implementation note:
- Android emits canonical `[Clawperator-Result]` terminal envelopes for command completion.

Rules:

1. Exactly one terminal result envelope per `commandId`.
2. Envelope payload must be valid single-line JSON.
3. Clawperator parser filters by `commandId` and prefix.
4. Non-envelope logs are ignored for result semantics.

This removes ad-hoc scraping patterns and provides deterministic parsing until a stronger transport is added.

Additionally, intermediate observation envelopes may be emitted with prefix:

- `[Clawperator-Event] {json...}`

This supports agent feedback loops during best-effort execution.

## Safety Bounds (hard constants)

Public limits (v1):

- `MAX_EXECUTION_ACTIONS = 50`
- `MAX_EXECUTION_TIMEOUT_MS = 120000`
- `MIN_EXECUTION_TIMEOUT_MS = 1000`
- `MAX_PAYLOAD_BYTES = 64000`
- `MAX_RETRY_ATTEMPTS_PER_STEP = 10`
- `MAX_SNAPSHOT_LINES = 2000`
- `MAX_SNAPSHOT_BYTES = 262144`

Action policy:

- denylist by default for unsupported/unsafe action types
- allow only runtime-supported actions in v1

Best-effort specific bounds:

- `MAX_BEST_EFFORT_STEPS = 30`
- `MAX_BEST_EFFORT_RUNTIME_MS = 180000`
- `MAX_CONSECUTIVE_FAILED_ATTEMPTS = 5`

Supported action types (v1):

- `open_app`
- `close_app`
- `wait_for_node`
- `click`
- `scroll_and_click`
- `scroll`
- `scroll_until`
- `read_text`
- `snapshot_ui`
- `take_screenshot`
- `enter_text`
- `sleep`

## Doctor and Dependency Management

`clawperator doctor` checks:

1. `adb` installed and executable
2. adb server reachable
3. connected devices and states
4. target package presence and version compatibility
5. Android Developer Options and USB debugging (advisory)
6. end-to-end handshake via `doctor_ping`

`clawperator doctor --fix` capabilities (best effort):

1. restart adb server
2. run `clawperator grant-device-permissions`
3. print exact remediation when automatic fix is unavailable

See [Clawperator Doctor](../reference/node-api-doctor.md) for the full check list and JSON report shape.

## Skill Integration Mechanism

Canonical source of skills:

- `clawperator-skills` repository

Distribution model:

1. `clawperator-skills` CI generates `skills-index.json` on `main`.
2. `clawperator skills install` clones the local skills checkout on first setup.
3. `clawperator skills update [--ref <ref>]` refreshes the checkout and can pin to a specific ref when needed.
4. Local cache stores synced artifacts for deterministic offline execution.

Runtime should execute against cached/pinned skill content, not live network fetches during execution.

Skill compilation requirements are defined in:

- `docs/design/skill-design.md`

When skill artifacts are missing/stale, runtime can still execute direct executions supplied by the agent.

## Skill Implementation Language Strategy

To set a maintainable baseline for future skills:

1. Preferred language for new non-trivial skills: Node.js with TypeScript.
2. Bash is allowed only for thin wrappers and simple glue.
3. Python is a planned secondary path after Node contracts and tooling are stable.

Rationale:

- Better testability, typing, and reuse for parsing-heavy and multimodal workflows.
- Safer payload construction and lower shell-quoting risk than large Bash scripts.
- Cleaner evolution toward SDK-backed skill execution.

Migration policy:

- Do not mass-rewrite all existing Bash skills immediately.
- For new high-value or high-complexity skills, prefer Node.js/TypeScript implementations.
- Temporary Bash implementations (including the current Life360 flow) are acceptable only as stopgaps and must be queued for early migration once minimal Node skill SDK/runtime helpers are in place.


## Agent-Friendly Command and Alias Layer

Because agents are primary customers, Clawperator should accept intuitive aliases that normalize to canonical actions.

Examples:

- `tap` -> `click`
- `press` -> `click`
- `long_press` -> `click` with long-click params
- `wait_for` -> `wait_for_node`
- `find` -> `wait_for_node`
- `read` -> `read_text`
- `snapshot` -> `snapshot_ui`
- `sleep` -> `sleep`
- `action`: Primary entry point for single-step interactions.

Rules:

1. Canonical form is stored and logged.
2. Aliases are input-only conveniences.
3. Alias table is explicit/versioned (no fuzzy guessing in parser).

## Node Module Structure

- `src/cli/*`
  - command handlers and argument parsing
- `src/domain/doctor/*`
  - prerequisites and auto-fix logic
- `src/domain/devices/*`
  - adb discovery and selection
- `src/domain/skills/*`
  - install/update/search/run/list/get/compile-artifact
- `src/domain/executions/*`
  - validation, run, state transitions
- `src/adapters/android-bridge/*`
  - adb broadcast + logcat result envelope parsing
- `src/contracts/*`
  - schema constants, JSON types

## Determinism and Validation Requirements

1. Skill artifact compile must be pure and deterministic.
2. Execution validation must occur before any adb call.
3. Every run must emit correlated IDs: `executionId`, `commandId`, `taskId`, `deviceId`.
4. Side-effecting executions must include verification signals in step results.
5. Direct/fallback executions must include explicit mode/status metadata.
6. Artifact compile must fail if required input variables are missing (no implicit PII/user-literal substitution).

## Testing Strategy

Clawperator should define layered tests, with real-device execution as a first-class requirement.

1. Unit tests (Node/CLI)
   - execution schema validation and hard bounds
   - device selection policy
   - alias normalization to canonical actions
   - result envelope parser correctness
2. Integration tests (mock adb/logcat)
   - doctor/device discovery behavior
   - compile -> execute orchestration
   - failure contracts and fallback instruction pointers
3. Android instrumentation tests
   - `ACTION_AGENT_COMMAND` execution path
   - `[Clawperator-Result]` envelope emission
   - step result mapping and verification semantics
4. Real-device tests
   - run a baseline skill/execution on a known installed app (current baseline can be Google Home)
   - verify end-to-end reliability across close/open/session policy behavior
5. Future dedicated test APK
   - create a controlled Android app exposing stable test UI elements/states
   - migrate core conformance tests to this APK to reduce third-party app drift risk

## Security and Policy

1. Capability-based execution gating (from skill/artifact metadata).
2. Per-profile allowlist/denylist for capabilities and packages.
3. Disable dangerous capabilities by default (`purchase_risk` off unless explicit policy).
4. Audit trail for compile, execute, and result envelopes.
5. Best-effort mode still obeys capability policy and hard limits.

## Stability & Versioning

Clawperator follows Semantic Versioning (SemVer) for the Node SDK/CLI and its API contracts.

### Versioning Rules
- **Major Bump (`1.x.x`):** Breaking changes to the result envelope JSON schema, CLI command removal, or incompatible `ACTION_AGENT_COMMAND` protocol changes.
- **Minor Bump (`x.1.x`):** New supported actions, new CLI commands, or backward-compatible schema additions.
- **Patch Bump (`x.x.1`):** Bug fixes, internal refactoring, or documentation updates.

### Stability Boundary
- **Stable (v1):** `execute`, `observe snapshot`, `devices`, and the `[Clawperator-Result]` envelope structure.
- **Alpha/Unstable:** `execute best-effort`, `--serve` (HTTP), and any feature marked as `(Upcoming)` in these docs. These may break without a major version bump until they are promoted to stable.
