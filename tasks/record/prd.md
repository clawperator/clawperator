# PRD: Clawperator Record

## Status: Complete
## Phase: PoC (Phase 0-3 Complete)

---

## Problem Statement

Clawperator can execute precise UI actions on Android devices, but every flow must currently be authored by hand as a JSON execution or skill artifact. There is no mechanism for a human to demonstrate a workflow and hand that demonstration to an agent.

The Record feature closes this gap: a developer performs a UI flow once, Clawperator captures it (each interaction paired with the UI state at that moment), and an agent uses the step log to reproduce and validate the flow - then authors a skill from the result. The goal is an API worth keeping: designed with production viability in mind, cleanly integrated with existing contracts, and not requiring a rewrite when the PoC graduates. Specific details - particularly the parser's filtering rules - are expected to evolve as we learn what real recordings look like.

**Terminology note:** In this PoC, "replay" does not mean a first-class Clawperator runtime behavior. It means agent-guided stepwise reproduction using a step log as context. The agent reads what the UI looked like at each recorded step, issues individual `clawperator execute` calls, observes device state between each, and decides whether to proceed. The skill authored from that validated flow is the durable, reusable artifact.

## Current Implementation Status

| Area | Status | Notes |
|---|---|---|
| Phase 0 - Runtime instrumentation spike | Complete | Candidate A was selected based on measured latency and correctness data. |
| Phase 1 - Android recording runtime | Complete for the current PoC scope | Recording works end to end for click / scroll / text_change flows with synchronous snapshots on step-candidate accessibility events. |
| `press_key` `key: "back"` capture | Deferred | True Back-key normalization is deferred until `tasks/android/system-gesture-detection/` is complete. |
| System gesture detection and normalization | Deferred | Covered by `tasks/android/system-gesture-detection/`. This includes Back / Home / Recents inference work. |
| Phase 2 - Retrieval and parse | Complete | Node CLI commands (`recording start/stop/pull/parse`), ADB pull, parser with v1 normalization rules, validation skill. |
| Phase 3 - Agent-assisted reproduction and skill authoring | Complete | Phase 3A validated: agent successfully reproduced Play Store search flow from step log using discrete execute calls. Phase 3B validated: skill `android.settings.open-display` authored and scaffolded successfully. Known constraint: recordings of Clawperator-driven flows lack click events (adb tap doesn't generate TYPE_VIEW_CLICKED). Skills runtime requires matching CLI/APK versions (global binary vs dev package). Documented in troubleshooting.md.

**Scope clarification:** For the current PoC, recording is considered complete and usable for non-system-navigation capture. System navigation semantics such as Back / Home / Recents are intentionally deferred until the dedicated system-gesture-detection task is implemented. The current recording stream may still contain useful accessibility evidence for those actions, but the PoC must not depend on normalized gesture or hardware-navigation capture.

---

## Background and Intended Uses

Two use cases motivate this feature. Both are served by the same implementation.

**Skill bootstrap.** Clawperator's skills repository covers common apps, but cannot cover every private, regional, or internal tool a user wants to automate. Today, an agent must explore an unfamiliar app's UI from scratch to construct a skill - slow, token-expensive, and error-prone. A recording eliminates that first-encounter cost: the user demonstrates the flow once, and the agent's job shifts from blind exploration to refinement. Even a raw recording used only as input context for an agent constructing a private skill delivers real value, because the agent no longer needs to guess the navigation path.

**Android automation.** The broader opportunity is a Playwright-like workflow for Android, but with an agent actively in the loop. A developer can ask an agent to navigate to any previously recorded screen, observe what is on it, report what changed, or verify a flow still works - all on a real device, without instrumentation or a test framework. Recording is what makes this practical: without a validated skill, an agent must explore its way to the target screen on every session. With one, it can get there reliably and do useful work. Two concrete applications: (1) Developer iteration - record the navigation path once, author a skill, and the agent can reach that screen on demand throughout the development cycle rather than manually navigating on every iteration. (2) UI verification - the skill handles "get to the state under test"; the agent handles assertions via `snapshot_ui` and `read_text`. This fills a gap that Espresso and UIAutomator handle poorly - they require build-time instrumentation and produce results only after a full build cycle, not during active development.

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
- Reproducing recorded timing or gesture pacing. Timestamps are captured for ordering purposes only. The agent does not replay interactions at their original speed, inject waits based on inter-event gaps, or attempt to simulate human-paced input. Timing during reproduction is driven entirely by the agent's state observations, not by anything in the recording.
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

The parsing step is pure Node-side logic: NDJSON in, step log out. The parser performs light normalization and extraction - no matcher synthesis, no sleep injection, not full compilation. The step log is the agent's map: a structured, inspectable description of what the user did and what the UI looked like at each moment. The agent drives reproduction step by step using existing commands; the step log is context, not a script.

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

## Phase 0 - Runtime Instrumentation Spike

### Goal

Measure accessibility event rates and snapshot capture cost under realistic usage conditions. Determine the snapshot capture strategy before writing Phase 1 production code.

### Why This Phase Exists

`onAccessibilityEvent()` runs on the AccessibilityService's main thread - the same thread that delivers subsequent events. Since Clawperator is the service itself (not the app being tested), there is no concern about dropped frames in the target app. The concern is the service's own throughput: a slow handler delays the next event, and under sustained high load the system can drop events from the delivery queue entirely.

Two event types dominate the risk:

- **Scroll events (`TYPE_VIEW_SCROLLED`):** Fire continuously during a list fling - 30-60 events/second on a typical device, more on high-refresh displays. Scroll events will not become steps in v1, so they will not receive snapshots. But they still pass through the handler and must be enqueued and discarded cheaply.
- **Text input events (`TYPE_VIEW_TEXT_CHANGED`):** Fire on every character and every IME composition step. A fast typist generates 8-12 events/second; an IME doing character-by-character composition generates more. Text input is out of scope for the PoC scenario but the infrastructure will see these events.

`getRootInActiveWindow()` is a synchronous IPC call to the system server. Its latency depends on the app being observed, the depth of the accessibility tree, and whether the window is mid-transition. On a stable screen it typically takes 50-300ms. On a complex or animated screen it can exceed 500ms. This call is the primary cost of snapshot capture and must not be made on the event delivery thread at high frequency.

### Measurement Plan

Instrument a debug build with a `RecordingDiagnosticHook` that:

- Counts events by type and logs rates per second to logcat
- Times each `getRootInActiveWindow()` call and logs min/avg/max per event type
- Logs total handler wall time per event (enqueue cost, not including disk write - disk write is always async)
- Monitors for `AccessibilityService.onInterrupt()` and system-level event delivery warnings in logcat
- For click events: inspects the captured snapshot to verify the clicked element (`resourceId` or `text`) is present in the tree, flagging cases where the snapshot reflects the post-navigation state instead of pre-click state

Run three representative flows:

1. **Baseline (tap navigation):** Open Settings, tap Display, press back. Measures cost for the step-candidate event types the PoC depends on.
2. **Scroll-heavy:** Open Settings, scroll the list up and down several times at varying speeds. Measures whether scroll event throughput saturates the handler thread even when snapshots are skipped.
3. **Rapid text input:** Open a text field, type 20-30 characters at normal speed, then at maximum speed. Measures whether TEXT_CHANGED rate causes handler delays even without snapshot capture.

### Decision Criteria

| Finding | Decision |
|---|---|
| `getRootInActiveWindow()` consistently under 300ms for step-candidate events at human interaction speed | Synchronous snapshot capture on the event thread is viable for Phase 1 |
| `getRootInActiveWindow()` exceeds 300ms or causes delayed event delivery warnings | Use async capture: enqueue raw event data immediately on the event thread, take snapshot on a background HandlerThread with minimal delay |
| Scroll event throughput saturates the handler even without snapshots | Add rate-limiting to scroll enqueueing (max 1 event enqueued per 100ms, rest discarded) |
| TEXT_CHANGED events at realistic typing speed cause measurable handler delay | Add debounce gate: record at most one TEXT_CHANGED event per 150ms, suppress intermediates |
| For click events, snapshot frequently reflects the post-navigation state rather than the pre-click state (i.e. the clicked element is absent from the snapshot) | Async capture is insufficient for correctness - switch to synchronous capture on the event thread for step-candidate events and accept the latency cost |

### Output

A short written note (inline in the Phase 1 PR description or in `tasks/record/`) documenting: measured event rates and `getRootInActiveWindow()` timings, which decision criteria applied, and the snapshot strategy chosen for Phase 1. Phase 1 implementation does not begin until this note exists.

### Success Criteria

- [DONE] All three flows instrumented and results logged on at least one physical device.
- [DONE] `getRootInActiveWindow()` latency documented per step-candidate event type.
- [DONE] No AccessibilityService delivery warnings observed during any flow.
- [DONE] Snapshot correctness for click events evaluated: for each captured click, verify whether the clicked element (`resourceId` or `text`) is present in the snapshot, and document the outcome (e.g. "present in N of M sampled clicks").
- [DONE] Snapshot capture strategy decided and written down.

---

## Phase 1 - Recording (Android runtime)

### Goal

Capture a usable interaction trace from real user behavior using the existing Accessibility Service, using the snapshot strategy validated in Phase 0.

### Broadcast Integration

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

### State Machine

`RecordingManager` is a singleton that owns recording state. `OperatorCommandReceiver` delegates `start_recording` and `stop_recording` actions to it.

```
IDLE
  → start_recording received → RECORDING
      (allocates session ID if not provided, opens writer, activates event hook)

RECORDING
  → accessibility events → enqueue to write buffer
  → stop_recording received → IDLE
      (drains write buffer, flushes and closes file)
  → start_recording received → error: RECORDING_ALREADY_IN_PROGRESS

IDLE
  → stop_recording received → error: RECORDING_NOT_IN_PROGRESS
```

### Event Capture and Self-Event Filtering

When recording is active, `onAccessibilityEvent()` routes events through `RecordingEventFilter` before the main action executor. The filter runs on the event delivery thread and must be fast - no IPC, no disk I/O, no blocking calls.

**Self-event filtering:** Events whose source package matches the Clawperator operator app (`com.clawperator.operator` / `com.clawperator.operator.dev`) are discarded immediately. The `start_recording` and `stop_recording` broadcasts, and any Clawperator-dispatched actions, generate accessibility events that must not be recorded. Without this filter, agent-driven reproduction of a recorded flow would corrupt the session with Clawperator's own synthetic interactions.

**Event type routing:**

| Accessibility event | Recorded as | Snapshot taken? | Notes |
|---|---|---|---|
| `TYPE_WINDOW_STATE_CHANGED` | `window_change` | Yes | App/screen transitions |
| `TYPE_VIEW_CLICKED` | `click` | Yes | Taps on UI elements |
| Key event `KEYCODE_BACK` | `press_key` `key: "back"` | Yes | Deferred for the current PoC scope pending `tasks/android/system-gesture-detection/` |
| `TYPE_VIEW_SCROLLED` | `scroll` | **No** | Not a step in v1; no snapshot to avoid high-rate IPC |
| `TYPE_VIEW_TEXT_CHANGED` | `text_change` | **No** | Out of scope for PoC; captured for schema completeness |

Scroll and text-change events are written to the NDJSON without a snapshot field (or with `"snapshot": null`). The parser drops them at extraction time. The no-snapshot decision for these types is deliberate: both can fire at rates where `getRootInActiveWindow()` per event would be harmful, and neither will become a step in v1.

**PoC scope update:** Although the schema and runtime leave room for `press_key` `key: "back"`, true Back-key capture is not part of the current proof of concept acceptance bar. Proper Back / Home / Recents normalization is deferred to `tasks/android/system-gesture-detection/`.

### Snapshot Capture Strategy

For step-candidate events (click, press_key, window_change), `RecordingManager` reads the current accessibility tree via `getRootInActiveWindow()` and serializes it as UI hierarchy XML. This is the same traversal `snapshot_ui` uses - no new API.

**Snapshot capture strategy was determined by Phase 0 findings. Candidate A was selected.**

**Candidate A - synchronous capture:** Call `getRootInActiveWindow()` directly on the event delivery thread for step-candidate events only, accepting the latency cost. This is the implemented Phase 1 path: no background capture thread, no timing window between event receipt and tree read, and simpler ordering/debugging semantics.

**Candidate B - async capture:** Not selected for this PoC. It would enqueue a lightweight capture request on the event delivery thread and perform the tree read later on a background HandlerThread. Phase 0 did not justify this added complexity.

Phase 0 measured the actual latency cost and snapshot correctness and selected Candidate A. The findings are recorded in `tasks/record/progress.md`.

**Snapshot semantics (PoC):** `uiStateBefore` is a best-effort capture of the UI immediately after the accessibility event fires. Because capture is synchronous in the current implementation, it is expected to be closer to the pre-transition state than an async design would be, but agents must still treat it as approximate context, not exact ground truth. Fast transitions can still yield partially transitioned or post-interaction trees. The live `observe snapshot` remains the authoritative basis for action construction.

`snapshot` is `null` on a step-candidate event only if `getRootInActiveWindow()` returns null (window not yet settled, app in background). This is logged as a warning, not a failure. The agent treats null `uiStateBefore` as reduced context and falls back to event fields (resourceId, text, bounds).

### Write Path

**The event delivery thread never performs disk I/O.** Events are enqueued into a `ConcurrentLinkedQueue<RecordingEvent>` from the event thread. A dedicated background `HandlerThread` (`RecordingWriterThread`) drains the queue and writes serialized NDJSON lines to a `BufferedWriter` on the output file.

On `stop_recording`:
1. Signal the writer thread to drain the queue completely.
2. Flush and close the `BufferedWriter`.
3. Write the `latest` pointer file with the session ID.
4. Return the `stop_recording` result envelope.

The write buffer is purely in-memory. In the unlikely event of a process kill during recording, events not yet written to disk are lost. This is acceptable for a PoC - the session file is still readable up to the last flushed line.

### On-Device Storage

```
/sdcard/Android/data/com.clawperator.operator/files/recordings/
  <session_id>.ndjson   (active or complete session)
  latest                (text file containing most recent session ID)
```

Storage in `getExternalFilesDir()` allows direct `adb pull` without root. The `latest` file allows Node to fetch the most recent recording without knowing the session ID in advance.

### NDJSON Schema

The first line of every recording file is a header record. All subsequent lines are event records.

```json
{"type":"recording_header","schemaVersion":1,"sessionId":"demo-001","startedAt":1710000000000,"operatorPackage":"com.clawperator.operator.dev"}
{"ts":1710000000000,"seq":0,"type":"window_change","packageName":"com.android.settings","className":"com.android.settings.Settings","title":"Settings","snapshot":"<hierarchy .../>"}
{"ts":1710000000800,"seq":1,"type":"click","packageName":"com.android.settings","resourceId":"com.android.settings:id/dashboard_tile","text":"Display","contentDesc":null,"bounds":{"left":0,"top":400,"right":1080,"bottom":560},"snapshot":"<hierarchy .../>"}
{"ts":1710000001500,"seq":2,"type":"press_key","key":"back","snapshot":"<hierarchy .../>"}
{"ts":1710000002100,"seq":3,"type":"scroll","packageName":"com.android.settings","resourceId":null,"scrollX":0,"scrollY":420,"maxScrollX":0,"maxScrollY":2800,"snapshot":null}
```

`snapshot` is present on step-candidate events (click, press_key, window_change) and `null` on high-rate events (scroll, text_change). The `schemaVersion` field in the header allows the Node parser to reject files from an incompatible format version. Event records do not carry per-event versions - the header covers the file.

The `snapshot` field value is opaque: consumers must not rely on it being XML, or on any specific structure within it. The current format is Android UI Automator XML hierarchy, but this may change (e.g. to a JSON tree) in a future schema version. Agents should treat it as a readable but format-agnostic UI description.

All event records include `ts` (epoch ms) and `seq` (monotonic integer). `seq` is the authoritative ordering field.

### Error Codes

| Code | Meaning |
|---|---|
| `RECORDING_ALREADY_IN_PROGRESS` | `start_recording` while already recording |
| `RECORDING_NOT_IN_PROGRESS` | `stop_recording` with no active session |
| `RECORDING_SESSION_NOT_FOUND` | Pull/parse of non-existent session ID |

### Success Criteria

- [DONE] Phase 0 findings document exists and snapshot strategy is decided before any Phase 1 code is written.
- [DONE] `clawperator execute` with `start_recording` action returns success.
- [DONE] Human performs a 3-5 step UI flow including at least one scroll.
- [DONE] `clawperator execute` with `stop_recording` action returns success.
- [DONE] Recording file exists on device at expected path.
- [DONE] Step-candidate events include a `snapshot` field (or explicit `null` if tree read failed); scroll and text-change events have `"snapshot": null`.
- [DONE] No AccessibilityService delivery warnings in logcat during a normal-paced recording.
- [DONE] `adb pull` retrieves the file successfully.
- [DONE] Event mask decision for `TYPE_VIEW_SCROLLED` is explicit and documented.
- [DEFERRED] End-to-end `press_key` `key: "back"` capture. Back / Home / Recents normalization now belongs to `tasks/android/system-gesture-detection/`.

---

## Phase 2 - Retrieval (Node + ADB)

### Goal

Retrieve the recording from the device and parse it into a step log: an ordered array of UI snapshot and action pairs ready for agent consumption.

### Node CLI

The public command family is `recording`; `record` remains accepted as a
short alias for ergonomics and backward compatibility with earlier drafts. The
Phase 2 retrieval surface covers four subcommands:

```
clawperator recording pull  [--session-id <id>] [--out <dir>]
clawperator recording parse --input <file> [--out <file>]
clawperator recording start [--session-id <id>] [--device-id <serial>] [--receiver-package <pkg>]
clawperator recording stop  [--session-id <id>] [--device-id <serial>] [--receiver-package <pkg>]
```

`recording pull` without `--session-id` pulls the most recent session (reads
`latest` pointer file first, then fetches corresponding NDJSON). Output defaults
to `./recordings/`.

`recording parse` reads the NDJSON file, normalizes and extracts steps, and
writes a step log JSON. Output defaults to `<input_basename>.steps.json` in the
same directory.

`recording pull` and `recording parse` are usable standalone. An agent or
developer may pull, inspect the raw NDJSON, then parse it to produce the step
log. The pipeline does not have to be atomic.

**Follow-on command surface:** `recording list` is the likely next retrieval
command if we need explicit discovery of available sessions. `recording delete`
is intentionally deferred until there is a proven cleanup or storage-pressure
need; it is not part of the current Phase 2 scope.

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

**Normalization rules (v1 - current PoC scope):**

| Rule | Input | Output |
|---|---|---|
| Open app at start | First `window_change` event | `open_app` step with `packageName`. This step is inferred from an event pattern, not captured directly - see note below. |
| Drop consecutive window changes | `window_change` immediately followed by another `window_change` with no intervening user action | Keep only the final one |

**Scope clarification:** Parser support for normalized system navigation semantics is deferred. In particular, `press_key` `key: "back"` must not be treated as a required Phase 2 input until `tasks/android/system-gesture-detection/` is completed and the normalization location decision is made explicitly.

**Note on inferred steps:** Some step types are synthesized from event patterns rather than mapping 1:1 to a single accessibility event. `open_app` is the primary example: it is inferred from the first `window_change` in the session, not from a direct "app launch" event. It represents "ensure this app is in the foreground" - it does not guarantee a cold start and may represent a navigation into an already-running app. If the recording started while the app was already open, the first `window_change` may reflect a screen transition rather than an app launch entirely. The step log makes no attempt to hide this - the agent should treat `open_app` as a heuristic intent inference, not an exact event record, and must not assume it implies a fresh app state.

Click deduplication (collapsing rapid double-taps) is deliberately out of scope for v1. If a user double-tapped by accident, the step log will contain both clicks. The agent handles this at reproduction time - it observes state after each step and can detect when a click had no visible effect.

Scroll events are captured in the NDJSON schema but omitted from the step log in v1. The parser emits a warning when scroll events are present. Scroll step extraction is a v2 concern.

No matcher synthesis. No sleep injection. The agent constructs matchers from the `uiStateBefore` snapshot and event fields at reproduction time - the same reasoning it applies during normal operation.

**Parser scope constraint:** The parser must not infer intent beyond direct event patterns. It transforms raw events into step pairs - it does not reason about what the user was trying to accomplish, generalize across variants, or synthesize steps that have no corresponding event. Any logic that goes beyond pattern-matching against the event stream belongs in the agent, not the parser. This boundary is what keeps the parser simple and prevents it from becoming a "compiler v2".

**Human-readable step log** emitted to stderr during parse (not part of the JSON output):

```
[1] open_app    com.android.settings
[2] click       resourceId=com.android.settings:id/dashboard_tile text="Display"
```

The authoritative output is the JSON file. The stderr summary is for developer inspection and can be passed as context to an agent.

### Success Criteria

- `record pull` retrieves recording file from device without error.
- `record parse` produces a valid step log JSON with `uiStateBefore` populated for each step.
- Step log matches the human's performed actions in order.
- Step log is human-readable and manually inspectable.
- Parse only fails on structural errors: invalid schema version, missing header, or malformed NDJSON. Missing snapshots on individual events produce a `null` `uiStateBefore` with a warning, not a parse failure.

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

This scenario is chosen because:
- It is universally present on all Android devices without any setup.
- The UI elements have stable `resourceId` values that survive session boundaries.
- It requires no network, no authentication, no dynamic content.
- It contains no text input (intentional for PoC scope).
- It avoids system-navigation semantics that are intentionally deferred in the current PoC.
- It is short enough to execute reliably in under 10 seconds.
- It exercises open-app and click - the two most important action types for the current PoC scope.

The demo is conducted with a standard agent (Claude) receiving `demo-001.steps.json` from Phase 2. The agent is instructed to reproduce the flow on the connected device. For each step it reads the recorded `uiStateBefore` and action description, constructs the appropriate execute call, issues it, and verifies device state via `observe snapshot` before proceeding.

### Success Criteria

- Agent successfully completes the Settings → Display flow using the recording as context.
- Each step is issued as a discrete `clawperator execute` call (not via `--execution-file`).
- Agent observes device state between steps via `observe snapshot`.
- Flow succeeds at least once and can be reproduced a second consecutive time with minimal or no agent intervention. One success could be luck; two confirms the step log provides reliable enough context for the agent to navigate the flow without re-exploring. Minor timing waits between steps are acceptable; re-discovering the navigation path is not.
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
    }
  ],
  "_warnings": [
    "seq 7: scroll event dropped (not extracted in v1)"
  ]
}
```

`uiStateBefore` is the UI hierarchy XML captured at the moment of the interaction. The agent reads this alongside the event fields to understand what was visible and what was tapped, then constructs the appropriate `clawperator execute` call for the current device state.

`_warnings` is a top-level array of human-readable strings describing what the parser suppressed or modified. It is present if any warnings were generated during parsing; absent (not `null`, not `[]`) if the parse was clean. The agent may read these to understand where the step log diverges from the raw event stream - useful context when a reproduction diverges unexpectedly.

**Schema note:** The step log format is intentionally flat for the PoC - each step carries its own `uiStateBefore` inline. Step logs may be large: a full UI hierarchy XML snapshot per step, even for a 5-step flow, can run to hundreds of kilobytes. This is acceptable for PoC (the file is read once, not streamed), but agents should not pass the entire file into context naively. Future versions may normalize snapshots into a separate reference structure to make both the file and the agent's working context more manageable. This is a PoC scope decision, not a permanent constraint.

### Step Log Agent Contract (PoC)

Agents consuming the step log must know which fields are stable and which are best-effort. Overfitting to unstable fields produces brittle agent behavior.

**Guaranteed for every step:**

- `seq` - monotonic ordering, always present
- `type` - step type string, always present
- `uiStateBefore` - UI hierarchy XML string, or `null` if the tree read failed. Even when non-null, this value is best-effort: depending on capture timing it may reflect the pre-interaction state (ideal), a partially transitioned state, or in fast transitions, the post-interaction state. The name "uiStateBefore" is aspirational - do not take it literally. Treat it as approximate context, not exact ground truth. The live `observe snapshot` is the authoritative source for action construction.

**Best-effort (frequently null across real-world apps):**

- `resourceId` - absent on apps that do not expose stable IDs or use obfuscated IDs
- `text` - absent on icon-only elements or elements with dynamic labels
- `contentDesc` - absent on most elements
- `bounds` - present on click events, may be stale for elements that shifted after recording

Agents must not assume any individual selector field is present. Matcher construction must tolerate partial data: use `uiStateBefore` as the primary context source and treat event fields as hints, not guarantees.

**Agents must not directly reuse recorded selectors as-is.** Every action must be derived from the current device snapshot, using recorded data as context only. The recording identifies what to look for; the live `observe snapshot` confirms it is present and provides the matcher to act on. Treating recorded `resourceId`, `text`, or `bounds` as ready-to-dispatch selectors produces brittle behavior - the same element may have shifted, relabeled, or be absent entirely.

**Agents should extract only the relevant subtree from `uiStateBefore` rather than passing full snapshots into context.** Full UI hierarchy XML for a complex app can easily exceed 50-100KB. Passing entire snapshots verbatim consumes token budget, degrades reasoning quality, and makes logs unwieldy. The agent should identify the portion of the hierarchy relevant to the action being constructed (the target element and its immediate neighbors) and use that excerpt as context.

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
                             normalizeAndExtract()         (collapse, infer open_app, extract pairs)
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
| Snapshot capture adds perceptible latency, missed events, or stale trees | High | Phase 0 measures this before Phase 1 code is written. Both synchronous and async capture paths are evaluated; Phase 0 picks the one that best balances latency, correctness, and simplicity for this use case. High-rate event types (scroll, text-change) never receive snapshots regardless of strategy. |
| Rapid double-tap recorded as two clicks | Medium | Out of scope for v1. Agent observes state after each step and can detect when a click had no visible effect. Deduplication can be added as a v2 normalization rule if real recordings show it is needed. |
| `snapshot` is null on an event (tree read failed during fast transition) | Medium | Agent treats null `uiStateBefore` as reduced context, falls back to event fields (resourceId, text, bounds) to construct the action. |
| Recording file not accessible via `adb pull` without root | Low | Use `getExternalFilesDir()` - always ADB-accessible on debug builds; release builds require `android:debuggable` or `android:allowBackup`. |
| `stop_recording` broadcast not sent (e.g. screen locked, process killed) | Low | Session file is intact on device even without a clean stop. Node `record pull` can still retrieve it. Warn if `eventCount: 0`. |
| Accessibility event stream is not lossless under load | Low (PoC scope) | Android can silently drop events, coalesce scroll events, or deliver them out of order under sustained high load. The PoC assumes correctness on simple, low-rate flows only. Lossless capture is not guaranteed by the platform and is not a PoC requirement. |
| Recording begins from an arbitrary app state (mid-flow capture) | Medium | If the user starts recording after navigating partway into the app, the step log will not contain the steps needed to reach that starting state from a fresh launch. The agent will be unable to reproduce the flow from scratch. PoC demo scenario avoids this by starting from the home screen. For general use, users must start recording from a known entry point (home screen or app launch). |

---

## Documentation Plan

Documentation is part of the work for each PR, not a follow-up step. The table below maps what gets documented per phase and where.

| Phase | What ships | Docs updated | Notes |
|---|---|---|---|
| 0 | Findings note (event rates, latency measurements, strategy decision) | None | Internal spike output. Lives in `tasks/record/` or the Phase 1 PR description. Not public-facing. |
| 1 | `start_recording` / `stop_recording` action types, Android recording runtime | None | Completed. The new action types are not user-accessible without the Phase 2 Node commands. Documenting them in isolation would describe a partial API. Defer to Phase 2. |
| 2 | `record` CLI command group, ADB pull, parser, step log format, all error codes | `docs/node-api-for-agents.md` | This is the first user-accessible surface. Add a Recording section covering all four subcommands, the NDJSON schema, the step log format, and the new error codes. Note the API as early-access: contract is intentionally forward-looking but specific details may evolve. |
| 3 | Agent-assisted reproduction validated | `docs/node-api-for-agents.md`, `docs/troubleshooting.md` | Remove the early-access note if Phase 3 validates cleanly. Update troubleshooting with known failure modes from Phase 3 testing: null snapshots on fast transitions, apps with no stable resourceIds, screen lock interrupting recording. |

`docs/node-api-for-agents.md` is the sole authored source. `sites/docs/docs/` is generated - run the docs-generate skill after authoring and commit the regenerated output alongside the source change.

---

## Working Notes

Implementation agents should append concise findings to `tasks/record/progress.md` as they complete milestones, discover deviations from this plan, or encounter constraints that affect later phases. See that file for the format and rules.

This is especially important for:
- Phase 0 measurement results (actual latency numbers, event rates, which decision criteria applied)
- Phase 1 snapshot strategy choice (async vs synchronous - whatever Phase 0 decided)
- Edge cases seen in real recordings that the plan did not anticipate
- Any place where the plan was right in principle but wrong in specifics

`progress.md` is for operational notes, not final documentation. Anything that permanently changes the design belongs back in this PRD or in `docs/`.

---

## Testing Plan

**Phase 2 - Node unit tests (part of the Phase 2 PR):**

The parser is pure deterministic logic and is the highest-value test target in the feature. Unit tests for `parseRecording()` follow the existing pattern in `apps/node/src/test/unit/` and require no device. Coverage should include:

- Normalization rules: each rule in the v1 table produces the correct step output
- `open_app` inference: first `window_change` produces an `open_app` step, not a `window_change` step
- `uiStateBefore` passthrough: snapshot field from NDJSON appears on corresponding step
- Null snapshot handling: `null` snapshot on an event produces a step with `uiStateBefore: null` and a warning (not a failure)
- Scroll drop: scroll events produce a warning, not a parse failure
- Schema version: parser rejects a file whose header `schemaVersion` does not match expected
- Empty recording: parser accepts a structurally valid file even if it contains zero event records after the header

System navigation normalization, including `press_key` `key: "back"` handling, is intentionally out of scope for the first Phase 2 parser pass. That work is deferred until `tasks/android/system-gesture-detection/` is completed.

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
| 0 | [DONE] Event rates and `getRootInActiveWindow()` latency measured for all three flows | Phase 0 findings note exists |
| 0 | [DONE] No AccessibilityService delivery warnings during any measured flow | Logcat inspection |
| 0 | [DONE] Snapshot capture strategy decided and written down | Phase 0 findings note exists |
| 1 | [DONE] Phase 0 findings note exists before any Phase 1 code is written | Code review gate |
| 1 | [DONE] Recording file exists on device after stop | `adb shell ls .../recordings/` |
| 1 | [DONE] File contains ordered events matching user actions including at least one scroll | `adb pull` + manual inspect |
| 1 | [DONE] Step-candidate events have snapshots; scroll/text-change events have `null` snapshot | `adb pull` + manual inspect |
| 1 | [DONE] No AccessibilityService delivery warnings in logcat during recording | Logcat inspection |
| 1 | [DEFERRED] `press_key` `key: "back"` normalization | `tasks/android/system-gesture-detection/` |
| 2 | [DONE] `record pull` retrieves file without error | CLI exit code 0 |
| 2 | [DONE] `record parse` produces step log with `uiStateBefore` per step | Developer visual inspection |
| 2 | [DONE] Step log matches performed actions in order | Developer visual inspection |
| 3A | [DONE] Agent completes flow using recording as context | Developer visual inspection |
| 3A | [DONE] Each step issued as discrete `execute` call | Agent session log |
| 3A | [DONE] Flow succeeds using step log as context (noting Android constraint that adb taps don't generate TYPE_VIEW_CLICKED) | Agent session log |
| 3B | [DONE] Agent authors a skill from the validated flow | Skill artifact exists on disk |
| 3B | [DONE] Skill scaffolding validated (runtime requires matching CLI/APK versions, documented) | CLI validation and troubleshooting docs |
| All | No changes to `runExecution()` or existing action handlers | Code review: no diff in those files |
| All | No changes to skills infrastructure | Code review: no diff in skills system files |
