# PRD: Clawperator Record

## Status: Draft
## Phase: PoC (3-phase delivery)

---

## Problem Statement

Clawperator can execute precise UI actions on Android devices, but every flow must currently be authored by hand as a JSON execution or skill artifact. There is no mechanism for a human to demonstrate a workflow and hand that demonstration to an agent.

The Record feature closes this gap: a developer performs a UI flow once, Clawperator captures it (each interaction paired with the UI state at that moment), and an agent uses the step log to reproduce and validate the flow - then authors a skill from the result. The goal is an API worth keeping: designed with production viability in mind, cleanly integrated with existing contracts, and not requiring a rewrite when the PoC graduates. Specific details - particularly the parser's filtering rules - are expected to evolve as we learn what real recordings look like.

**Terminology note:** In this PoC, "replay" does not mean a first-class Clawperator runtime behavior. It means agent-guided stepwise reproduction using a step log as context. The agent reads what the UI looked like at each recorded step, issues individual `clawperator execute` calls, observes device state between each, and decides whether to proceed. The skill authored from that validated flow is the durable, reusable artifact.

---

## Background and Intended Uses

Two use cases motivate this feature. Both are served by the same implementation.

**Skill bootstrap.** Clawperator's skills repository covers common apps, but cannot cover every private, regional, or internal tool a user wants to automate. Today, an agent must explore an unfamiliar app's UI from scratch to construct a skill - slow, token-expensive, and error-prone. A recording eliminates that first-encounter cost: the user demonstrates the flow once, and the agent's job shifts from blind exploration to refinement. Even a raw recording used only as input context for an agent constructing a private skill delivers real value, because the agent no longer needs to guess the navigation path.

**Android automation.** Once a skill exists - bootstrapped from a recording or authored directly - it becomes a reliable automation primitive. Two concrete scenarios: (1) Developer iteration - developers navigating to a target screen on every build iteration record the path once, author a skill, and replace manual navigation with a single `clawperator skills run` command. A local skill valid for one feature branch has immediate value and is discarded afterward. (2) UI verification - a validated skill is a lightweight smoke test requiring no test framework or build-time instrumentation. For agent-driven work, the skill handles navigation to the state under test; the agent handles assertions using `snapshot_ui` and `read_text`. This makes Clawperator a practical tool for UI verification on real devices, filling a gap that existing tools like Espresso and UIAutomator handle poorly in interactive development.

---

## Goals

- A human performs a UI flow on a connected Android device.
- Clawperator records the flow via the existing Accessibility Service, capturing each interaction paired with the UI state at the time of that interaction.
- Node pulls the recording from the device and parses it into an ordered step log: each step paired with the UI snapshot captured at that moment.
- An agent reads the step log, uses the UI context to reproduce each step on the current device, observes state between steps, and authors a skill from the validated flow.
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
- Deterministic reproduction guarantees. Accessibility-based agent reproduction is best-effort. UI timing, dynamic view IDs, and app state can all cause a run to diverge from the recording. The PoC succeeds if the agent can reliably reproduce the flow on a stable, cooperative target app. Robustness against the full range of real-world app behavior is a post-PoC concern.
- Idempotency. Agent-driven reproductions are not guaranteed to produce the same outcome when run multiple times. App state left over from a previous run (e.g. a screen that is already open, a toggle that is already active) can cause subsequent runs to diverge. Handling this is a post-PoC concern.
- Long recording support. The PoC assumes short recordings of up to roughly 10 user-initiated steps. Behavior on recordings longer than that is undefined for this phase.

---

## Architecture Overview

The Record feature extends the existing execution architecture without adding parallel systems.

```
Node CLI                       Android (Operator App)
----------                     ----------------------
record start
  → broadcast start_recording  → Accessibility listener activated
                               → Events buffered to NDJSON file on device
                               → Each interaction captured with UI snapshot

  [human performs flow]

record stop
  → broadcast stop_recording   → Listener deactivated, file finalized

record pull
  → adb pull <session_file>    → File transferred to host
  → parse NDJSON
  → filter/compact events
  → emit step log (session.steps.json): each step paired with uiStateBefore

  ┌─ agent-driven reproduction (Phase 3 / production path) ──────────────────┐
  │  Agent reads session.steps.json                                          │
  │  For each step:                                                          │
  │    agent reads uiStateBefore + action description                       │
  │    clawperator execute  (single-action)  →  Android                     │
  │    clawperator observe snapshot          →  verify device state         │
  │    agent decides: proceed, retry, or halt                               │
  │  After flow validates: agent authors a skill artifact                   │
  └──────────────────────────────────────────────────────────────────────────┘
```

The recording surface is an extension to the Android Operator app's existing broadcast receiver and Accessibility Service. No new IPC, no streaming, no additional processes.

The parsing step is pure Node-side logic: NDJSON in, step log out. The parser filters and extracts `{uiStateBefore, action}` pairs - no matcher synthesis, no sleep injection. The step log is the agent's map: a structured, inspectable description of what the user did and what the UI looked like at each moment. The agent drives reproduction step by step using existing commands; the step log is context, not a script.

**Why the agent must be in the loop:** Android apps are dynamic. Interstitial dialogs, update prompts, A/B test variants, and loading state differences appear unpredictably and are absent from any recording. A batched execution script has no mechanism to observe or handle them. The agent does. Removing the agent from the playback loop removes the only adaptive layer. `execute --execution-file` is appropriate for stable, validated skills - not for raw recordings. See `tasks/record/limitations.md` for the full treatment.

---

## Output Format Decision: Step Log (not Execution JSON)

The recording output is a step log: an ordered array of `{uiStateBefore, action}` pairs. Each entry describes what the UI looked like at the moment of interaction and what the user did. This is the right choice for the following reasons:

- It is what agents already work with. During normal operation, an agent issues `observe snapshot`, reads the hierarchy, and decides what to do. The step log provides exactly that context for each recorded step - no translation or compilation required. The agent sees what the user saw and what they tapped.
- It has no API coupling. An Execution JSON output would embed Clawperator-specific matcher syntax, action type names, and contract fields. If those evolve, old recordings silently become wrong. The step log captures device ground truth (UI hierarchy XML + event data) that is stable across API changes.
- It eliminates the compilation pipeline. No matcher synthesis. No normalization rules. No sleep injection. No timeout calculation. Parsing the NDJSON into step pairs is straightforward extraction, not a logic-heavy transformation. The code surface is small, the test surface is small, and there is nothing that can become stale.
- Agents derive matchers themselves. Matcher construction from UI context is standard agent reasoning - it is what they do on every normal execute call. Pre-computing matchers in a compilation step adds infrastructure without adding value, and removes the agent from a decision it is better positioned to make.

The step log is saved as `<session_id>.steps.json`. Skill authoring is the expected outcome of Phase 3. The agent reads the step log, reproduces the flow step by step using the UI context, and authors a skill from the validated flow. The step log is a bootstrap input; the skill is the durable, reusable output.

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

**UI snapshot capture:** For each recorded interaction event (click, press_key, window_change), the `RecordingManager` reads the current accessibility tree and serializes it as a UI hierarchy XML string, appended to the event record as `snapshot`. This is the same traversal the Accessibility Service performs for `snapshot_ui` actions - no new API calls are needed. The capture adds latency per step (typically 100-400ms) that occurs at human interaction speed and is not perceptible during normal use.

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
{"ts":1710000000000,"seq":0,"type":"window_change","packageName":"com.android.settings","className":"com.android.settings.Settings","title":"Settings","snapshot":"<hierarchy .../>"}
{"ts":1710000000800,"seq":1,"type":"click","packageName":"com.android.settings","resourceId":"com.android.settings:id/dashboard_tile","text":"Display","contentDesc":null,"bounds":{"left":0,"top":400,"right":1080,"bottom":560},"snapshot":"<hierarchy .../>"}
{"ts":1710000001500,"seq":2,"type":"press_key","key":"back","snapshot":"<hierarchy .../>"}
```

Each event record includes a `snapshot` field containing the UI hierarchy XML at the time of the interaction. `snapshot` is `null` for events where a tree read was not possible (e.g. during app launch before the window settles).

The `schemaVersion` field in the header allows the Node parser to detect and reject (with a clear error) files produced by a future incompatible version of the recording format. The current version is `1`. Event records do not carry a per-event version - the header covers the file.

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
- Each event record includes a `snapshot` field (or explicit `null` if the tree read failed).
- `adb pull` retrieves the file successfully.
- **Snapshot capture validation gate:** Phase 1 is not complete until it has been verified on at least one target device that synchronous per-step snapshot capture does not cause noticeable interaction lag, missed events, or stale trees during a normal-paced user flow. If any of these are observed, the capture strategy must be revised (e.g. async-buffered capture) before Phase 2 begins. The 100-400ms latency estimate is an assumption, not a guarantee.

---

## Phase 2 - Retrieval (Node + ADB)

### Goal

Retrieve the recording from the device and parse it into a step log: an ordered array of UI snapshot and action pairs ready for agent consumption.

### Node CLI

The public `record` command surface covers four subcommands:

```
clawperator record pull    [--session-id <id>] [--out <dir>]
clawperator record parse   --input <file> [--out <file>]
clawperator record start   [--session-id <id>] [--device-id <serial>] [--receiver-package <pkg>]
clawperator record stop    [--session-id <id>] [--device-id <serial>] [--receiver-package <pkg>]
```

`record pull` without `--session-id` pulls the most recent session (reads `latest` pointer file first, then fetches corresponding NDJSON). Output defaults to `./recordings/`.

`record parse` reads the NDJSON file, filters and compacts events, and writes a step log JSON. Output defaults to `<input_basename>.steps.json` in the same directory.

`record pull` and `record parse` are usable standalone. An agent or developer may pull, inspect the raw NDJSON, then parse it to produce the step log. The pipeline does not have to be atomic.

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

### Parsing and Step Extraction

```typescript
// domain/recording/parseRecording.ts
async function parseRecording(
  rawEvents: RawRecordingEvent[],
  options: ParseOptions
): Promise<RecordingStepLog>

interface RecordingStepLog {
  sessionId: string;
  schemaVersion: number;
  steps: RecordingStep[];
  _warnings?: string[];  // present only when the parser suppressed or modified events
}
```

**Filtering rules (v1 - PoC scope):**

| Rule | Input | Output |
|---|---|---|
| Open app at start | First `window_change` event | `open_app` step with `packageName` |
| Back navigation | `press_key` with `key: "back"` | `press_key` step, `key: "back"` |
| Drop consecutive window changes | `window_change` immediately followed by another `window_change` with no intervening user action | Keep only the final one |
| Deduplicate rapid clicks | Multiple `click` events on the same element within 100ms | Keep last only (guards against accidental double-tap during recording). Annotated in step log: `⚠ deduped 2→1 click on resourceId=...`. |

Scroll events are captured in the NDJSON schema but omitted from the step log in v1. The parser emits a warning when scroll events are dropped. Scroll step extraction is a v2 concern.

No matcher synthesis. No sleep injection. The agent constructs matchers from the `uiStateBefore` snapshot and event fields at reproduction time - the same reasoning it applies during normal operation.

**Human-readable step log** emitted to stderr during parse (not part of the JSON output):

```
[1] open_app    com.android.settings
[2] click       resourceId=com.android.settings:id/dashboard_tile text="Display"
[3] press_key   back
```

The authoritative output is the JSON file. The stderr summary is for developer inspection and can be passed as context to an agent.

### Success Criteria

- `record pull` retrieves recording file from device without error.
- `record parse` produces a valid step log JSON with `uiStateBefore` populated for each step.
- Step log matches the human's performed actions in order.
- Step log is human-readable and manually inspectable.
- Parse only fails on structural errors: invalid schema version, missing header, empty recording (`RECORDING_EMPTY`), or malformed NDJSON. Missing snapshots on individual events produce a `null` `uiStateBefore` with a warning, not a parse failure.

---

## Phase 3 - Agent-Assisted Reproduction and Skill Authoring

### Goal

Demonstrate two things, in order:

**Phase 3A:** The step log is sufficient bootstrap context for an agent to reproduce the recorded flow on device, using only existing Clawperator commands.

**Phase 3B:** An agent can author a working skill from the validated flow, using the existing skills system unchanged.

These are sequenced because they test different things: 3A validates the recording feature; 3B validates that skill authoring from a recording works end-to-end. If 3B fails, the diagnosis is clearer when 3A has already passed.

Phase 3 ships zero new Clawperator code. The deliverable is a validated end-to-end demonstration using existing commands and a standard agent.

### Agent-Driven Execution Model

The agent receives the step log from Phase 2. It uses it as a map - ground truth about the user's intended path - not as a script to execute blindly.

The agent loop:

```
For each step in the step log:
  1. Read uiStateBefore + action description for this step
  2. Compare current device state (observe snapshot) to uiStateBefore
  3. Construct and issue a single-action clawperator execute call
  4. Observe result envelope (success / failure, step data)
  5. If state matches expectation: proceed to next step
  6. If state diverges: adapt (retry, wait, skip) or halt and report
After all steps complete successfully:
  Author a skill artifact from the validated flow
  Run the skill via clawperator skills run to confirm it works
```

This is the correct model for Clawperator. The agent is the brain: it reads the recorded UI context, compares to current device state, constructs the action, and decides whether to proceed. Clawperator is the hand: it executes one discrete action and reports the result.

No new Node code is needed. Each step in the loop uses `clawperator execute` (existing) and `clawperator observe snapshot` (existing). The step log is already on disk from Phase 2.

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

The demo is conducted with a standard agent (Claude) receiving `demo-001.steps.json` from Phase 2. The agent is instructed to reproduce the flow on the connected device. For each step it reads the recorded `uiStateBefore` and action description, constructs the appropriate execute call, issues it, and verifies device state via `observe snapshot` before proceeding.

### Success Criteria

- Agent successfully completes the Settings → Display → back flow using the recording as context.
- Each step is issued as a discrete `clawperator execute` call (not via `--execution-file`).
- Agent observes device state between steps via `observe snapshot`.
- Flow succeeds at least twice consecutively.
- Agent authors a local skill artifact from the validated flow.
- Agent runs the authored skill via `clawperator skills run` and it completes successfully.
- No new Clawperator code ships in this phase.

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
      type: "text_change";  // captured but not extracted in PoC scenario
      packageName: string;
      resourceId: string | null;
      text: string;
    };
```

### Step Log Format (Node)

`record parse` output. Example for the demo scenario:

```json
{
  "sessionId": "demo-001",
  "schemaVersion": 1,
  "steps": [
    {
      "seq": 0,
      "type": "open_app",
      "packageName": "com.android.settings",
      "uiStateBefore": "<hierarchy .../>",
    },
    {
      "seq": 1,
      "type": "click",
      "packageName": "com.android.settings",
      "resourceId": "com.android.settings:id/dashboard_tile",
      "text": "Display",
      "contentDesc": null,
      "bounds": { "left": 0, "top": 400, "right": 1080, "bottom": 560 },
      "uiStateBefore": "<hierarchy .../>"
    },
    {
      "seq": 2,
      "type": "press_key",
      "key": "back",
      "uiStateBefore": "<hierarchy .../>"
    }
  ],
  "_warnings": [
    "seq 4-5: 2 rapid click events on resourceId=com.android.settings:id/dashboard_tile deduped to 1",
    "seq 7: scroll event dropped (not extracted in v1)"
  ]
}
```

`uiStateBefore` is the UI hierarchy XML captured at the moment of the interaction. The agent reads this alongside the event fields to understand what was visible and what was tapped, then constructs the appropriate `clawperator execute` call for the current device state.

`_warnings` is a top-level array of human-readable strings describing what the parser suppressed or modified. It is present if any warnings were generated during parsing; absent (not `null`, not `[]`) if the parse was clean. The agent may read these to understand where the step log diverges from the raw event stream - useful context when a reproduction diverges unexpectedly.

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


Phase 2 - Retrieval
===================

Developer                  Node CLI                     Android / Host FS
---------                  --------                     -----------------
                           record pull
                             runAdb(['shell','cat',...]) → read 'latest' pointer
                             runAdb(['pull',...]) ────────→ NDJSON file → host FS
                             → ./recordings/demo-001.ndjson

                           record parse --input demo-001.ndjson
                             parseNdjson()
                             filterAndExtract()           (dedup, collapse, extract pairs)
                             → demo-001.steps.json
                             [step summary to stderr]


Phase 3 - Agent-Assisted Reproduction
======================================

Agent                      Node CLI                     Android
-----                      --------                     -------
reads demo-001.steps.json (uiStateBefore + action description per step)

[for each step]
  execute single action
                           execute (single-action JSON)
                             runExecution() ─────────────→ existing broadcast dispatch
                             [Clawperator-Result] ←─────── { success, stepData }
  observe snapshot
                           observe snapshot ────────────→ snapshot_ui
                             [Clawperator-Result] ←─────── UI hierarchy XML
  agent evaluates state → proceed / adapt / halt

[after all steps succeed]
  agent authors skill artifact
  agent runs skill via clawperator skills run
```

---

## API Design

### New Node CLI Commands

```
clawperator record start   [--session-id <id>] [--device-id <serial>] [--receiver-package <pkg>]
clawperator record stop    [--session-id <id>] [--device-id <serial>] [--receiver-package <pkg>]
clawperator record pull    [--session-id <id>|latest] [--out <dir>] [--device-id <serial>]
clawperator record parse   --input <ndjson-file> [--out <steps-json>]
```

All `record` subcommands inherit the global `--output json|pretty` and `--verbose` flags.

`record start` and `record stop` output the same structured JSON envelope as all other commands. `record pull` outputs a JSON object with `{ ok, localPath, sessionId }`. `record parse` outputs `{ ok, steps: string[], stepsFile }`.

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
RECORDING_PARSE_FAILED
```

Added to `contracts/errors.ts` following existing conventions.

---

## Risks and Mitigations

**A note on reproduction reliability:** Accessibility-based agent reproduction is inherently best-effort. Some recordings will not replay successfully on the first attempt, or will replay correctly most of the time but fail occasionally. This is expected and acceptable for PoC. The goal is to prove the loop works on a well-behaved target app, not to produce a robust general-purpose tool in this phase.

| Risk | Likelihood | Mitigation |
|---|---|---|
| Many real apps do not expose stable `resourceId` values, or use dynamic IDs | High | Agent reads `uiStateBefore` snapshot and finds the best available match. Noted in step log when `resourceId` is null. |
| UI has not settled when agent issues the next action | High | Agent observes device state after each step via `observe snapshot`; it waits or retries based on what it sees rather than relying on fixed timing. |
| Snapshot capture adds perceptible latency, missed events, or stale trees | High | Must be validated on device in Phase 1 - this is an unverified assumption. If synchronous capture causes problems, switch to async-buffered capture before proceeding to Phase 2. |
| Rapid double-tap recorded as two clicks | Medium | 100ms deduplication window in parser. |
| `snapshot` is null on an event (tree read failed during fast transition) | Medium | Agent treats null `uiStateBefore` as reduced context, falls back to event fields (resourceId, text, bounds) to construct the action. |
| Recording file not accessible via `adb pull` without root | Low | Use `getExternalFilesDir()` - always ADB-accessible on debug builds; release builds require `android:debuggable` or `android:allowBackup`. |
| `stop_recording` broadcast not sent (e.g. screen locked, process killed) | Low | Session file is intact on device even without a clean stop. Node `record pull` can still retrieve it. Warn if `eventCount: 0`. |

---

## Documentation Plan

Documentation is part of the work for each PR, not a follow-up step. The table below maps what gets documented per phase and where.

| Phase | What ships | Docs updated | Notes |
|---|---|---|---|
| 1 | `start_recording` / `stop_recording` action types, Android recording runtime | None | The new action types are not user-accessible without the Phase 2 Node commands. Documenting them in isolation would describe a partial API. Defer to Phase 2. |
| 2 | `record` CLI command group, ADB pull, parser, step log format, all error codes | `docs/node-api-for-agents.md` | This is the first user-accessible surface. Add a Recording section covering all four subcommands, the NDJSON schema, the step log format, and the new error codes. Note the API as early-access: contract is intentionally forward-looking but specific details may evolve. |
| 3 | Agent-assisted reproduction validated | `docs/node-api-for-agents.md`, `docs/troubleshooting.md` | Remove the early-access note if Phase 3 validates cleanly. Update troubleshooting with known failure modes from Phase 3 testing: null snapshots on fast transitions, apps with no stable resourceIds, screen lock interrupting recording. |

`docs/node-api-for-agents.md` is the sole authored source. `sites/docs/docs/` is generated - run the docs-generate skill after authoring and commit the regenerated output alongside the source change.

---

## Testing Plan

**Phase 2 - Node unit tests (part of the Phase 2 PR):**

The parser is pure deterministic logic and is the highest-value test target in the feature. Unit tests for `parseRecording()` follow the existing pattern in `apps/node/src/test/unit/` and require no device. Coverage should include:

- Filtering rules: each rule in the v1 table produces the correct step output
- Dedup: rapid clicks on the same element within 100ms collapsed to one
- `uiStateBefore` passthrough: snapshot field from NDJSON appears on corresponding step
- Null snapshot handling: `null` snapshot on an event produces a step with `uiStateBefore: null` and a warning (not a failure)
- Scroll drop: scroll events produce a warning, not a parse failure
- Schema version: parser rejects a file whose header `schemaVersion` does not match expected
- Empty recording: `RECORDING_EMPTY` error returned cleanly

No Android runtime tests are required for Phase 2. The Android recording logic is manually verified against the Phase 1 success criteria.

**Deferred - integration and end-to-end tests (post-PoC):**

Full integration testing is deferred until the prototype is running, validated, and the decision is made to officially pursue record as a production feature. At that point, the right approach is a skill that:

- Starts an Android emulator with a known app installed
- Uses a committed `.ndjson` fixture to drive an agent through the full record-parse-validate-skill pipeline
- Asserts the agent successfully completes the flow, the step log is valid, and a skill artifact is produced

This gives the test suite a stable, device-independent way to validate the NDJSON schema, parser, and step log contract across changes.

Until then, Phase 3 manual verification (agent successfully reproduces the flow twice consecutively and authors a working skill) is the acceptance bar.

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
      parseRecording.ts               (NDJSON → step log)
      recordingEventTypes.ts          (RawRecordingEvent types + RecordingStepLog type)
  cli/commands/
    record.ts                         (yargs subcommand group: start/stop/pull/parse)

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

**Note on skills:** Phase 3 depends on the existing skills system. No changes to the skills infrastructure are required or planned. The agent authors a skill artifact using the current `clawperator skills` commands exactly as they exist today. If the existing skills system cannot support the authored artifact, that is a Phase 3 failure to diagnose - not a signal to extend the skills system within this PoC.

| Phase | Criterion | Verification |
|---|---|---|
| 1 | Recording file exists on device after stop | `adb shell ls .../recordings/` |
| 1 | File contains ordered events matching user actions | `adb pull` + manual inspect |
| 1 | Synchronous snapshot capture does not cause perceptible lag, missed events, or stale trees | Manual device verification |
| 2 | `record pull` retrieves file without error | CLI exit code 0 |
| 2 | `record parse` produces step log with `uiStateBefore` per step | Developer visual inspection |
| 2 | Step log matches performed actions in order | Developer visual inspection |
| 3A | Agent completes flow using recording as context | Developer visual inspection |
| 3A | Each step issued as discrete `execute` call | Agent session log |
| 3A | Flow succeeds twice consecutively | Repeat agent session |
| 3B | Agent authors a skill from the validated flow | Skill artifact exists on disk |
| 3B | Skill runs successfully via `clawperator skills run` | CLI exit code 0 |
| All | No changes to `runExecution()` or existing action handlers | Code review: no diff in those files |
| All | No changes to skills infrastructure | Code review: no diff in skills system files |
