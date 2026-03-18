# PRD: Clawperator Record and Replay

## Status: Draft
## Phase: PoC (3-phase delivery)

---

## Problem Statement

Clawperator can execute precise UI actions on Android devices, but every flow must currently be authored by hand as a JSON execution or skill artifact. There is no mechanism for a human to demonstrate a workflow and then replay it.

Record and replay closes this gap: a developer performs a UI flow once, Clawperator captures it, and that flow can be replayed deterministically. The goal is an API worth keeping: designed with production viability in mind, cleanly integrated with existing contracts, and not requiring a rewrite when the PoC graduates. Specific details - particularly the compiler's normalization rules - are expected to evolve as we learn what real recordings look like.

---

## Background and Intended Uses

Three distinct use cases motivate this feature. All three are served by the same implementation.

**Skill bootstrap for unknown apps.** Clawperator's skills repository covers common apps, but cannot cover every private, regional, or internal tool a user wants to automate. Today, an agent must explore an unfamiliar app's UI from scratch to construct a skill - slow, token-expensive, and error-prone. A recording eliminates that first-encounter cost: the user demonstrates the flow once, and the agent's job shifts from blind exploration to refinement. Even a raw recording used only as input context for an agent constructing a private skill delivers real value, because the agent no longer needs to guess the navigation path.

**Android developer productivity.** Developers working on a UI feature spend a significant fraction of iteration time navigating to the screen they care about - logging in with test credentials, tapping through onboarding, reaching a nested settings panel - before they can observe the change they just made. Replay eliminates that overhead. A developer records the navigation path once and replays it as a single command during their iteration loop. This is closer to a macro system than a test suite: it does not need to be shared, checked in, or maintained. A local recording that lives for the duration of one feature branch has immediate value.

**UI testing and verification.** A recorded happy path is a lightweight smoke test with no test framework, no instrumentation, and no build-time setup required. It runs against a real device or emulator via `clawperator execute`. For agent-driven development work, replay also provides a reliable "get to the state under test" primitive: an agent can replay a known navigation path to reach a target screen, then apply assertions using `snapshot_ui` and `read_text`. This makes Clawperator a practical tool for UI verification on real devices - something existing tools like Espresso and UIAutomator handle poorly in interactive development: they are test-framework-centric, require build-time instrumentation, and are not agent-friendly.

---

## Goals

- A human performs a UI flow on a connected Android device.
- Clawperator records the flow via the existing Accessibility Service.
- Node pulls the recording from the device.
- Node compiles the recording into a standard `Execution` payload.
- Clawperator replays the flow using the existing execution pipeline.
- All three phases are independently verifiable.

## Non-Goals

- Android UI for starting and stopping recordings. Recording is controlled entirely via Node/ADB. There is no in-app button, notification, or UI chrome.
- Self-healing, adaptive, or branching flows.
- Screenshot diffing or assertion steps.
- Cross-device reliability or session portability.
- CI integration.
- Popup handling.
- Streaming events to host during recording (all events are buffered on device).
- Lossless capture. Recording is a lossy transformation of user intent. Timing nuances, transient UI state, and intermediate visual frames between gestures are not preserved. The recorded output captures the identifiable moments of interaction, not the full fidelity of what the user did.
- Deterministic replay guarantees. Accessibility-based replay is best-effort. UI timing, dynamic view IDs, and app state can all cause a replay to diverge from the original recording. The PoC succeeds if it works reliably on a stable, cooperative target app. Robustness against the full range of real-world app behavior is a post-PoC concern.
- Idempotency. Replays are not guaranteed to produce the same outcome when run multiple times. App state left over from a previous run (e.g. a screen that is already open, a toggle that is already active) can cause subsequent replays to diverge. Handling this is a post-PoC concern.
- Long recording support. The PoC assumes short recordings of up to roughly 10 user-initiated steps. Behavior on recordings longer than that is undefined for this phase.

---

## Architecture Overview

Record and replay extends the existing execution architecture without adding parallel systems.

```
Node CLI                       Android (Operator App)
----------                     ----------------------
record start
  → broadcast start_recording  → Accessibility listener activated
                               → Events buffered to NDJSON file on device

  [human performs flow]

record stop
  → broadcast stop_recording   → Listener deactivated, file finalized

record pull
  → adb pull <session_file>    → File transferred to host

record compile
  → parse NDJSON
  → normalize/compact events
  → emit Execution JSON

clawperator execute --execution-file replay.execution.json
  → existing execution pipeline (unchanged)
```

The recording surface is an extension to the Android Operator app's existing broadcast receiver and Accessibility Service. No new IPC, no streaming, no additional processes.

The compilation step is pure Node-side logic: NDJSON in, standard `Execution` JSON out. The replay step uses `runExecution()` verbatim - no new execution path.

---

## Output Format Decision: Execution JSON (not skill artifact)

The compiler produces a standard `Execution` JSON document, identical in shape to what any agent would send to `clawperator execute`. This is the right choice for the following reasons:

- It is the canonical interface. Agents, skills, and humans all converge on `Execution` JSON. Introducing an intermediate "replay" format would create a new abstraction with no payoff.
- It is immediately runnable. `clawperator record replay --input replay.execution.json` skips compilation and dispatches directly. It can also be run via `clawperator execute --execution-file replay.execution.json` for cases where the recording context is not relevant.
- It is inspectable and editable. A developer can open the compiled file, tweak a matcher, and re-run without tooling.
- It is useful as agent input. An agent tasked with constructing a skill from a recording can read a compiled `Execution` JSON directly. The concrete, ordered steps - with `resourceId` matchers and action types already resolved - give the agent ground truth about what the user did, rather than requiring it to infer intent from raw accessibility events.
- Skill artifacts (`.recipe.json`) are parameterized templates. A compiled recording has no parameters - it is a concrete flow. Wrapping it as a recipe artifact would add noise.

The compiled file is saved as `<session_id>.execution.json`. The `source: "clawperator-record"` field distinguishes it from agent-authored and skill-compiled executions, which matters when an agent is processing a batch of executions and needs to know their provenance.

If the developer wants to graduate the compiled output to a reusable skill, they place it in a skill directory as an artifact - but that step is outside the scope of this PoC.

---

## Phase 1 - Recording (Android runtime)

### Goal

Capture a usable interaction trace from real user behavior using the existing Accessibility Service.

### Design

Recording is controlled through two new `ExecutionAction` types dispatched via the existing broadcast mechanism. This reuses the entire execution pipeline: validation, dispatch, logcat result collection, and error handling are all unchanged.

New action types:

| Action type | Params | Description |
|---|---|---|
| `start_recording` | `sessionId?: string` | Enter recording mode. Generates session ID if omitted. |
| `stop_recording` | `sessionId?: string` | Exit recording mode and finalize file. |

These are dispatched as single-action executions, same as any other command:

```json
{
  "commandId": "rec-start-001",
  "taskId": "record-demo",
  "source": "clawperator-record",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 5000,
  "actions": [
    { "id": "start", "type": "start_recording", "params": { "sessionId": "demo-001" } }
  ]
}
```

The `StepResult` for `start_recording` returns:

```json
{
  "id": "start",
  "actionType": "start_recording",
  "success": true,
  "data": {
    "sessionId": "demo-001",
    "filePath": "/sdcard/Android/data/com.clawperator.operator/files/recordings/demo-001.ndjson"
  }
}
```

### Android Implementation

**State machine** inside `OperatorCommandReceiver` (or delegated to a `RecordingManager` singleton):

```
IDLE
  → start_recording received → RECORDING (opens file writer, activates event hook)

RECORDING
  → accessibility events → append to NDJSON file
  → stop_recording received → IDLE (flushes and closes file)
  → start_recording received → error: RECORDING_ALREADY_IN_PROGRESS

IDLE
  → stop_recording received → error: RECORDING_NOT_IN_PROGRESS
```

**Event capture** via `AccessibilityService.onAccessibilityEvent()`. The Operator app already requires the Accessibility Service to function, so no new permission is needed. When recording is active, events are routed through a `RecordingEventFilter` before the main action executor.

**Self-event filtering:** The `RecordingEventFilter` must discard events whose source package is the Clawperator operator app itself (`com.clawperator.operator` / `com.clawperator.operator.dev`). The `start_recording` and `stop_recording` broadcasts, and any Clawperator-dispatched actions, generate accessibility events that must not be recorded. Without this filter, replaying a recorded flow and then recording that replay would produce a corrupted session containing Clawperator's own synthetic interactions.

**Event types captured:**

| Accessibility event | Recorded as | Notes |
|---|---|---|
| `TYPE_WINDOW_STATE_CHANGED` | `window_change` | App/screen transitions |
| `TYPE_VIEW_CLICKED` | `click` | Taps on UI elements |
| `TYPE_VIEW_SCROLLED` | `scroll` | Scroll gestures |
| Key event `KEYCODE_BACK` | `press_key` with `key: "back"` | Back navigation |

Text input (`TYPE_VIEW_TEXT_CHANGED`) is captured in the model but is out of scope for the Phase 3 PoC scenario. The infrastructure should support it to avoid rework.

**On-device storage:**

```
/sdcard/Android/data/com.clawperator.operator/files/recordings/
  <session_id>.ndjson   (active or complete session)
  latest               (symlink or file containing most recent session ID)
```

Storage in `getExternalFilesDir()` allows direct `adb pull` without root. The `latest` pointer (a text file containing the session ID) allows Node to fetch the most recent recording without knowing the session ID.

**Raw event schema (NDJSON, one JSON object per line):**

The first line of every recording file is a header record. All subsequent lines are event records.

```json
{"type":"recording_header","schemaVersion":1,"sessionId":"demo-001","startedAt":1710000000000,"operatorPackage":"com.clawperator.operator.dev"}
{"ts":1710000000000,"seq":0,"type":"window_change","packageName":"com.android.settings","className":"com.android.settings.Settings","title":"Settings"}
{"ts":1710000000800,"seq":1,"type":"click","packageName":"com.android.settings","resourceId":"com.android.settings:id/dashboard_tile","text":"Display","contentDesc":null,"bounds":{"left":0,"top":400,"right":1080,"bottom":560}}
{"ts":1710000001500,"seq":2,"type":"press_key","key":"back"}
```

The `schemaVersion` field in the header allows the Node compiler to detect and reject (with a clear error) files produced by a future incompatible version of the recording format. The current version is `1`. Event records do not carry a per-event version - the header covers the file.

All event records include `ts` (epoch ms) and `seq` (monotonic integer) for ordering. `seq` is the authoritative ordering field - do not rely on `ts` alone for ordering.

**Error codes added:**

| Code | Meaning |
|---|---|
| `RECORDING_ALREADY_IN_PROGRESS` | `start_recording` while already recording |
| `RECORDING_NOT_IN_PROGRESS` | `stop_recording` with no active session |
| `RECORDING_SESSION_NOT_FOUND` | Pull/compile of non-existent session ID |
| `RECORDING_EMPTY` | Session stopped with zero events captured |

### Success Criteria

- `clawperator execute` with `start_recording` action returns success.
- Human performs a 3-5 step UI flow on device.
- `clawperator execute` with `stop_recording` action returns success.
- Recording file exists on device at expected path.
- File contains NDJSON events in correct order matching the performed actions.
- `adb pull` retrieves the file successfully.

---

## Phase 2 - Extraction (Node + ADB)

### Goal

Retrieve the recording from the device and compile it into a clean, executable `Execution` JSON.

### Node CLI

```
clawperator record pull [--session-id <id>] [--out <dir>]
clawperator record compile --input <file> [--out <file>]
clawperator record replay --input <file> [--device-id <id>]
```

`record pull` without `--session-id` pulls the most recent session (reads `latest` pointer file first, then fetches corresponding NDJSON). Output defaults to `./recordings/`.

`record compile` reads the NDJSON file, runs normalization, and writes an `Execution` JSON. Output defaults to `<input_basename>.execution.json` in the same directory.

`record replay` dispatches based on the input file type:
- `*.ndjson` - compiles first (runs normalization, injects sleeps), then executes. The compiled `Execution` JSON is not written to disk unless `--out` is provided.
- `*.execution.json` - skips compilation and executes directly. Use this to replay a previously compiled file, including one that has been manually edited.

This distinction matters for agents: pass a `.ndjson` file when re-compilation is desired (e.g. after editing normalization options), pass a `.execution.json` for deterministic replay of a known-good compiled artifact.

Both `record pull` and `record compile` are usable standalone. An agent or developer may pull, inspect, edit, then replay manually. The pipeline does not have to be atomic.

### ADB Pull

```typescript
// domain/recording/pullRecording.ts
async function pullRecording(
  config: RuntimeConfig,
  sessionId: string | "latest"
): Promise<{ localPath: string; sessionId: string }>
```

Steps:
1. If `sessionId === "latest"`, run `adb shell cat /sdcard/Android/.../recordings/latest` to read session ID.
2. Construct remote path: `.../recordings/<sessionId>.ndjson`
3. Run `adb pull <remote> <localPath>` via `runAdb()`.
4. Return local path and resolved session ID.

Errors surface as `RECORDING_PULL_FAILED` or `RECORDING_SESSION_NOT_FOUND` using the existing error contract.

### Compilation and Normalization

```typescript
// domain/recording/compileRecording.ts
async function compileRecording(
  rawEvents: RawRecordingEvent[],
  options: CompileOptions
): Promise<Execution>
```

**Normalization rules (v1 - PoC scope):**

| Rule | Input | Output |
|---|---|---|
| Open app at start | First `window_change` event | `open_app` action with `applicationId` |
| Back navigation | `press_key` with `key: "back"` | `press_key` action, `key: "back"` |
| Drop consecutive window changes | `window_change` immediately followed by another `window_change` with no intervening user action | Keep only the final one |
| Deduplicate rapid clicks *(optional, on by default)* | Multiple `click` events on the same element within 100ms | Keep last only (guards against accidental double-tap during recording). When dedup fires, the step log annotates it: `⚠ deduped 2→1 click on resourceId=...`. Disable with `--no-dedup` to see exact raw events. |
| Matcher synthesis - preferred | `click` with `resourceId` present | `matcher: { resourceId: "...", textEquals: "..." }` (textEquals omitted if null) |
| Matcher synthesis - fallback | `click` with no `resourceId`, `text` present | `matcher: { textEquals: "..." }` with a warning in step log |
| Matcher synthesis - bounds fallback | `click` with no `resourceId` and no `text` | `matcher: { bounds: { ... } }` with a warning; replay may be brittle |

The bounds fallback exists so the PoC loop can complete even against apps that don't expose stable identifiers. A warning is emitted rather than a compile failure - the developer is informed but not blocked.

Scroll events are recorded in the NDJSON schema and captured by the Android runtime, but omitted from compiled output in v1 (no scroll compilation logic). The compiler emits a warning when scroll events are dropped so the developer knows the replay may diverge on flows that required scrolling to reach a target. Scroll compilation is a v2 concern.

Rules that are deferred to v2: inter-step timing heuristics based on observed event gaps, cross-session deduplication, intent inference beyond open_app.

The resulting `Execution` uses `"source": "clawperator-record"` and `"mode": "direct"` to distinguish it from agent-authored and skill-compiled executions.

**Human-readable step log** emitted to stderr during compile (not part of the JSON output):

```
[1] open_app    com.android.settings
[2] click       resourceId=com.android.settings:id/dashboard_tile text="Display"
[3] press_key   back
```

This is for developer inspection and also serves as a concise, readable description of the recorded flow that can be passed as context to an agent tasked with refining or generalizing the recording into a skill. The authoritative output is the JSON file.

### Timing Model

The compiler injects a `sleep` action between every compiled step. Without inter-step delays, the execution pipeline will dispatch actions faster than the device UI can settle, causing clicks to land on the wrong element or on a view that has not yet rendered.

**v1 timing rules:**

| Transition | Injected sleep |
|---|---|
| After `open_app` | 800ms (app launch is the slowest transition) |
| After any `click` that changes the visible window (detected via next `window_change` in recording) | 500ms |
| After any other `click` | 300ms |
| After `press_key back` | 400ms |

These are fixed defaults, not derived from the recorded timestamps. Using recorded timestamps to infer delays is a v2 optimization. Fixed conservative values are sufficient for PoC and easier to reason about when a replay fails.

The `--step-delay-ms` flag on `record compile` and `record replay` allows the developer to override the default for all inter-step sleeps, which is useful when targeting a slow device or a particularly heavy app. The per-transition granularity above is the default; the flag overrides all of them uniformly.

**Timeout guard:** The compiler calculates estimated execution time from the injected sleep durations and sets `timeoutMs` on the compiled `Execution` to cover it with a fixed 5-second buffer:

```
timeoutMs = sum(all injected sleep durations) + (step_count * 2000ms per-step execution allowance) + 5000ms buffer
```

The result is clamped to `MAX_EXECUTION_TIMEOUT_MS` (120,000ms). If the estimated time exceeds the maximum, the compiler emits a warning and clamps rather than failing - the replay may time out on very long recordings, which is consistent with the PoC's 10-step scope assumption.

### Success Criteria

- `record pull` retrieves recording file from device without error.
- `record compile` produces a valid `Execution` JSON that passes `clawperator execute --validate-only`.
- Step log matches the human's performed actions in order.
- Compiled file is human-readable and manually editable.
- Compile only fails on structural errors: invalid schema version, missing header, empty recording (`RECORDING_EMPTY`), or malformed NDJSON. Matcher resolution never fails compilation - it degrades to a less precise matcher with a warning in the step log.

---

## Phase 3 - Replay (end-to-end)

### Goal

Execute the compiled recording on device using the existing execution pipeline without modification.

### Implementation

Replay is intentionally trivial at this phase. The compiled `Execution` JSON is passed to `runExecution()` unchanged. No new Android runtime code is required.

```typescript
// domain/recording/replayRecording.ts
async function replayRecording(
  execution: Execution,
  config: RuntimeConfig
): Promise<RunExecutionResult> {
  // Regenerate commandId to ensure uniqueness
  const replayExecution = { ...execution, commandId: generateCommandId() };
  return runExecution(replayExecution, config);
}
```

`commandId` regeneration is the only mutation. `taskId` is preserved so correlated replays can be grouped.

### Constraints

- Linear flow only. No branching, no condition checks.
- Fail fast: if any step returns `success: false`, the execution halts and returns the failed envelope. This is already the behavior of the existing runtime.
- No agent reasoning. The replay does not inspect intermediate state or adapt.

### Debug Observability

When a replay fails it is not always obvious whether the failure was caused by a bad matcher, insufficient timing, or unexpected app state. `record replay --verbose` must emit per-step output to help distinguish these cases:

```
[step-1] open_app com.android.settings  → success
[step-2] sleep 800ms                    → success
[step-3] click resourceId=...id/dashboard_tile text="Display"  → success
[step-4] sleep 500ms                    → success
[step-5] press_key back                 → FAILED (NODE_NOT_FOUND)
```

This uses the global `--verbose` flag already present on all commands - `record replay` just needs to ensure the per-step results are surfaced in verbose mode rather than only emitting the final envelope.

For matcher failures specifically, knowing the step failed is often not enough - you need to see what the UI actually looked like at that moment. The `--debug-artifacts` flag captures a `snapshot_ui` on each step failure and saves the hierarchy XML to the output directory alongside the session files:

```
./recordings/
  demo-001.ndjson
  demo-001.execution.json
  demo-001.debug/
    step-5-failed-snapshot.xml    (UI hierarchy at point of failure)
```

This is implemented by injecting a `snapshot_ui` action immediately after any failed step before halting - a one-action supplemental execution dispatched automatically when `--debug-artifacts` is set and a failure is detected. It does not change the primary result envelope.

`--debug-artifacts` is not on by default because it requires a second round-trip to the device on failure. It should be used explicitly when diagnosing matcher issues.

### PoC Demo Scenario

**Target flow: Android Settings - Display**

1. Open Settings app (`com.android.settings`)
2. Tap "Display" list item
3. Press back

This scenario is chosen because:
- It is universally present on all Android devices without any setup.
- The UI elements have stable `resourceId` values that survive session boundaries.
- It requires no network, no authentication, no dynamic content.
- It contains no text input (intentional for PoC scope).
- It is short enough to execute reliably in under 10 seconds.
- It exercises open-app, click, and back navigation - the three most important action types.

This scenario also directly represents the developer productivity use case: a developer working on the Display settings screen can replay this flow to return to their target screen after every rebuild, without manually navigating. The same flow, used as a smoke test, verifies that the Display entry point is reachable - a meaningful check in the UI testing use case.

The replay is considered successful when the device reproduces the flow (Settings opens, Display screen appears, returns to Settings) at least twice consecutively without failure.

### Success Criteria

- `record replay` completes without error.
- Primary signal: all steps in the returned envelope have `success: true` (objective, verifiable from CLI output without inspecting the device).
- Secondary confirmation: device visually reproduces the recorded flow.
- Flow succeeds at least twice consecutively.
- No changes to `runExecution()` or any existing Android action handler are required.

---

## Data Models

### Raw Recording Event (Android → NDJSON)

```typescript
// First line of the NDJSON file (not an event, parsed separately)
interface RecordingHeader {
  type: "recording_header";
  schemaVersion: number;
  sessionId: string;
  startedAt: number;       // epoch ms
  operatorPackage: string; // package that produced this recording
}

// Discriminated union of event types (all lines after the header)
type RawRecordingEvent =
  | {
      ts: number;        // epoch ms
      seq: number;       // monotonic, authoritative ordering
      type: "window_change";
      packageName: string;
      className: string | null;
      title: string | null;
    }
  | {
      ts: number;
      seq: number;
      type: "click";
      packageName: string;
      resourceId: string | null;
      text: string | null;
      contentDesc: string | null;
      bounds: { left: number; top: number; right: number; bottom: number };
    }
  | {
      ts: number;
      seq: number;
      type: "scroll";
      packageName: string;
      resourceId: string | null;
      scrollX: number;
      scrollY: number;
      maxScrollX: number;
      maxScrollY: number;
    }
  | {
      ts: number;
      seq: number;
      type: "press_key";
      key: "back";
    }
  | {
      ts: number;
      seq: number;
      type: "text_change";  // captured but not compiled in PoC scenario
      packageName: string;
      resourceId: string | null;
      text: string;
    };
```

### Compiled Execution JSON (Node)

Standard `Execution` contract (no new fields). Example for the demo scenario:

```json
{
  "commandId": "rec-replay-a1b2c3",
  "taskId": "demo-001",
  "source": "clawperator-record",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "mode": "direct",
  "actions": [
    {
      "id": "step-1",
      "type": "open_app",
      "params": { "applicationId": "com.android.settings" }
    },
    {
      "id": "step-2",
      "type": "click",
      "params": {
        "matcher": {
          "resourceId": "com.android.settings:id/dashboard_tile",
          "textEquals": "Display"
        }
      }
    },
    {
      "id": "step-3",
      "type": "press_key",
      "params": { "key": "back" }
    }
  ]
}
```

---

## Execution Flow (text diagram)

```
Phase 1 - Record
================

Developer                  Node CLI                     Android
---------                  --------                     -------
                           record start
                             buildStartRecordingExecution()
                             runExecution() ─────────────→ ACTION_AGENT_COMMAND broadcast
                                                          RecordingManager.startSession()
                             [Clawperator-Result] ←─────── { sessionId, filePath }

[performs UI flow]                                        accessibility events → NDJSON file

                           record stop
                             buildStopRecordingExecution()
                             runExecution() ─────────────→ ACTION_AGENT_COMMAND broadcast
                                                          RecordingManager.stopSession()
                             [Clawperator-Result] ←─────── { sessionId, eventCount }


Phase 2 - Extract
=================

Developer                  Node CLI                     Android / Host FS
---------                  --------                     -----------------
                           record pull
                             runAdb(['shell','cat',...]) → read 'latest' pointer
                             runAdb(['pull',...]) ────────→ NDJSON file → host FS
                             → ./recordings/demo-001.ndjson

                           record compile --input demo-001.ndjson
                             parseNdjson()
                             compileRecording()            (normalize, compact)
                             → demo-001.execution.json
                             [step log to stderr]


Phase 3 - Replay
================

Developer                  Node CLI                     Android
---------                  --------                     -------
                           record replay --input demo-001.execution.json
                             compileRecording()           (or read pre-compiled file)
                             replayRecording()
                               regenerate commandId
                               runExecution() ─────────────→ existing broadcast dispatch
                                                            tap, scroll, press_key handlers
                             [Clawperator-Result] ←─────── { status: success, stepResults }
```

---

## API Design

### New Node CLI Commands

```
clawperator record start  [--session-id <id>] [--device-id <serial>] [--receiver-package <pkg>]
clawperator record stop   [--session-id <id>] [--device-id <serial>] [--receiver-package <pkg>]
clawperator record pull   [--session-id <id>|latest] [--out <dir>] [--device-id <serial>]
clawperator record compile --input <ndjson-file> [--out <execution-json>] [--step-delay-ms <n>] [--no-dedup]
clawperator record replay  --input <ndjson-file|execution-json> [--device-id <serial>] [--step-delay-ms <n>] [--debug-artifacts]
```

All `record` subcommands inherit the global `--output json|pretty` and `--verbose` flags.

`record start` and `record stop` output the same structured JSON envelope as all other commands. `record pull` outputs a JSON object with `{ ok, localPath, sessionId }`. `record compile` outputs `{ ok, steps: string[], executionFile }`.

### New Android Action Types

| Type | Request params | Response data |
|---|---|---|
| `start_recording` | `sessionId?: string` | `sessionId: string`, `filePath: string` |
| `stop_recording` | `sessionId?: string` | `sessionId: string`, `eventCount: number`, `filePath: string` |

These follow the same pattern as all existing action types - they are dispatched via `ACTION_AGENT_COMMAND` broadcast, handled in `OperatorCommandReceiver`, and return results via `[Clawperator-Result]` envelope.

### New Error Codes

```
RECORDING_ALREADY_IN_PROGRESS
RECORDING_NOT_IN_PROGRESS
RECORDING_SESSION_NOT_FOUND
RECORDING_EMPTY
RECORDING_PULL_FAILED
RECORDING_COMPILE_FAILED
```

Added to `contracts/errors.ts` following existing conventions.

---

## Risks and Mitigations

**A note on replay reliability:** Accessibility-based replay is inherently best-effort. Some recordings will not replay successfully on the first attempt, or will replay correctly most of the time but fail occasionally. This is expected and acceptable for PoC. The goal is to prove the loop works on a well-behaved target app, not to produce a robust general-purpose tool in this phase.

| Risk | Likelihood | Mitigation |
|---|---|---|
| Many real apps do not expose stable `resourceId` values, or use dynamic IDs | High | Compiler falls back to `textEquals`, then bounds. Warns in step log. Replay may be brittle but will not refuse to run. |
| UI has not settled when the next action fires | High | Fixed inter-step sleep injection (see timing model). Conservative defaults favor reliability over speed. |
| Rapid double-tap recorded as two clicks | Medium | 100ms deduplication window in compiler. |
| `window_change` events fire before UI settles after app launch | Medium | `open_app` step always followed by 800ms sleep before first interaction. |
| Recording file not accessible via `adb pull` without root | Low | Use `getExternalFilesDir()` - always ADB-accessible on debug builds; release builds require `android:debuggable` or `android:allowBackup`. |
| `stop_recording` broadcast not sent (e.g. screen locked, process killed) | Low | Session file is intact on device even without a clean stop. Node `record pull` can still retrieve it. Warn if `eventCount: 0`. |
| Compiled execution exceeds 50-action limit | Very Low | 3-step Settings demo is well within limit. Emit compile warning at 40+ steps (accounting for injected sleep actions). |

---

## Documentation Plan

Documentation is part of the work for each PR, not a follow-up step. The table below maps what gets documented per phase and where.

| Phase | What ships | Docs updated | Notes |
|---|---|---|---|
| 1 | `start_recording` / `stop_recording` action types, Android recording runtime | None | The new action types are not user-accessible without the Phase 2 Node commands. Documenting them in isolation would describe a partial API. Defer to Phase 2. |
| 2 | `record` CLI command group, ADB pull, compiler, all error codes | `docs/node-api-for-agents.md` | This is the first user-accessible surface. Add a Recording section covering all five subcommands, the NDJSON schema, the compiled Execution format, and the new error codes. Note the API as early-access: contract is intentionally forward-looking but specific details (compiler normalization rules, timing defaults) may evolve. |
| 3 | End-to-end replay verified | `docs/node-api-for-agents.md`, `docs/troubleshooting.md` | Remove the early-access note if Phase 3 validates cleanly. Update troubleshooting with known failure modes from Phase 3 testing: timing issues, apps with no stable resourceIds, screen lock interrupting recording. |

`docs/node-api-for-agents.md` is the sole authored source. `sites/docs/docs/` is generated - run the docs-generate skill after authoring and commit the regenerated output alongside the source change.

---

## Testing Plan

**Phase 2 - Node unit tests (part of the Phase 2 PR):**

The compiler is pure deterministic logic and is the highest-value test target in the feature. Unit tests for `compileRecording()` follow the existing pattern in `apps/node/src/test/unit/` and require no device. Coverage should include:

- Normalization rules: each rule in the v1 table produces the correct `ExecutionAction` output
- Timing injection: correct `sleep` durations injected for each transition type
- Matcher synthesis: `resourceId` preferred, `textEquals` fallback, bounds fallback with warning
- Dedup: rapid clicks on the same element within 100ms collapsed to one; `--no-dedup` disables this
- Scroll drop: scroll events produce a warning, not a compile failure
- Schema version: compiler rejects a file whose header `schemaVersion` does not match expected
- Empty recording: `RECORDING_EMPTY` error returned cleanly
- `record replay --input` dispatch: `.ndjson` triggers compile path, `.execution.json` skips to execute

No Android runtime tests are required for Phase 2. The Android recording logic is manually verified against the Phase 1 success criteria.

**Deferred - integration and end-to-end tests (post-PoC):**

Full integration testing is deferred until the prototype is running, validated, and the decision is made to officially pursue record and replay as a production feature. At that point, the right approach is a skill that:

- Starts an Android emulator with a known app installed
- Replays a pre-recorded fixture (a committed `.ndjson` file with a deterministic known-good flow)
- Asserts the replay envelope contains all `success: true` steps

This gives the test suite a stable, device-independent way to run the full record-to-replay pipeline in CI without relying on physical device availability. It also validates that the NDJSON schema, compiler, and execution contract remain compatible across changes.

Until then, Phase 3 manual verification (two consecutive successful replays on a physical device or emulator) is the acceptance bar.

---

## File Layout

```
apps/node/src/
  contracts/
    errors.ts                         (add 6 new error codes)
    aliases.ts                        (add start_recording, stop_recording aliases if needed)
  domain/
    actions/
      startRecording.ts               (buildStartRecordingExecution)
      stopRecording.ts                (buildStopRecordingExecution)
    recording/
      pullRecording.ts                (adb pull orchestration)
      compileRecording.ts             (NDJSON → Execution)
      replayRecording.ts              (thin wrapper around runExecution)
      recordingEventTypes.ts          (RawRecordingEvent types)
  cli/commands/
    record.ts                         (yargs subcommand group: start/stop/pull/compile/replay)

apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/
  recording/
    RecordingManager.kt               (state machine + file writer)
    RecordingEventFilter.kt           (accessibility event → RawRecordingEvent)
    RecordingEvent.kt                 (Kotlin data classes mirroring NDJSON schema)
  agent/
    AgentCommandExecutorDefault.kt    (handle start_recording, stop_recording action types)
```

---

## Success Criteria Summary

| Phase | Criterion | Verification |
|---|---|---|
| 1 | Recording file exists on device after stop | `adb shell ls .../recordings/` |
| 1 | File contains ordered events matching user actions | `adb pull` + manual inspect |
| 2 | `record pull` retrieves file without error | CLI exit code 0 |
| 2 | `record compile` produces valid Execution JSON | `clawperator execute --validate-only` on output |
| 2 | Step log matches performed actions | Developer visual inspection |
| 3 | `record replay` completes without error | CLI exit code 0 |
| 3 | Device reproduces recorded flow | Developer visual inspection |
| 3 | Flow succeeds twice consecutively | Repeat replay run |
| All | No changes to `runExecution()` or existing action handlers | Code review: no diff in those files |
