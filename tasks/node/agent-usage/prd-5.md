# PRD-5: Persistent Logging and Log Retrieval

Workstream: WS-5
Priority: 5
Proposed PR: PR-5

Split from the original PRD-4 per reviewer feedback. This PRD covers persistent NDJSON
logs, log-level controls, and the docs that teach agents to use them. Live progress
streaming for skills run is PRD-4.

---

## Problem Statement

After a `RESULT_ENVELOPE_TIMEOUT` or `SKILL_EXECUTION_TIMEOUT`, there is no evidence trail. No log files exist. The agent cannot determine whether the broadcast was dispatched, which phase of the pipeline failed, or whether the issue is the APK, the device, or the app. The timeout is the end of the investigation, not the beginning.

---

## Evidence

**From `apps/node/src/domain/skills/runSkill.ts` and `runExecution.ts`:**

Neither file writes to disk at any point. All diagnostic information is either surfaced in the return value or lost.

**From `tasks/node/agent-usage/issues.md`, Issues #2, #6:**
> No log files written to disk. On timeout, zero information about what went wrong.
> I didn't know where logs were. There were no logs to check.

**From PRD-2 (enriched timeout error):**
`RESULT_ENVELOPE_TIMEOUT` will include `commandId` and `taskId` in its error response. A log file keyed on those same IDs is the natural follow-on: the agent gets a correlation handle from the error, then uses it to filter the log.

---

## Current Behavior

1. No log files are written to disk anywhere in the CLI.
2. After timeout, the only information is the error envelope from PRD-2.
3. No way to review what was dispatched, when, or at what phase the pipeline stopped.

---

## Proposed Change

### 1. NDJSON log file at `~/.clawperator/logs/`

All CLI commands that touch the device write structured log entries to:

```
~/.clawperator/logs/clawperator-YYYY-MM-DD.log
```

Format: one JSON object per line (NDJSON). Minimum required fields per entry:

| Field | Type | Description |
| :--- | :--- | :--- |
| `ts` | string | ISO 8601 timestamp |
| `level` | string | `debug`, `info`, `warn`, or `error` |
| `event` | string | Short event identifier (see table below) |
| `commandId` | string? | From execution payload when available |
| `taskId` | string? | From execution payload when available |
| `deviceId` | string? | Device serial when known |
| `message` | string | Human-readable description |

Minimum event set at `info` level by default:

| Event | Level | When |
| :--- | :--- | :--- |
| `preflight.apk.pass` | info | APK pre-flight check passed (PRD-1) |
| `preflight.apk.missing` | error | APK pre-flight check failed |
| `broadcast.dispatched` | info | adb broadcast sent to device |
| `envelope.received` | info | Result envelope returned by device |
| `timeout.fired` | error | Timeout waiting for result envelope |
| `doctor.check` | info | Each doctor check: `id`, `status`, `code` |
| `skills.run.start` | info | Skill script spawned |
| `skills.run.complete` | info | Skill script exited: `exitCode`, `durationMs` |
| `skills.run.timeout` | error | Skill script timed out |

Additional events at `debug` level only:
- adb command strings (without payload body)
- adb stdout/stderr
- timing for each adb call

### 2. Log directory configuration

- Default path: `~/.clawperator/logs/`
- Override: `CLAWPERATOR_LOG_DIR` env var
- Retention: one file per calendar day. No automatic deletion. Document that rotation is the operator's responsibility.
- Directory creation: attempt on first write; if it fails, emit one warning to stderr and continue without logging ("fail open"). Do not crash the CLI because logging failed.

### 3. `--log-level` global flag

Add `--log-level <debug|info|warn|error>` as a global CLI option alongside `--device-id`, `--output`, and `--verbose`.

Default: `info`.
`debug`: includes adb invocations, adb stdout/stderr, per-call timing.
`info`: preflight results, dispatch, receipt, timeouts, skill lifecycle.
`warn` and `error`: failures only.

`CLAWPERATOR_LOG_LEVEL` env var as an alternative to the flag.

### 4. `logPath` in `RESULT_ENVELOPE_TIMEOUT` error

After PRD-2 ships, add `details.logPath` to the `RESULT_ENVELOPE_TIMEOUT` error when a log file was written:

```json
{
  "ok": false,
  "error": {
    "code": "RESULT_ENVELOPE_TIMEOUT",
    "details": {
      "commandId": "cmd-001",
      "taskId": "task-001",
      "lastActionId": "open-energy-tab",
      "lastActionType": "open_app",
      "lastActionCaveat": "payload-last only; Android execution position is unknown",
      "elapsedMs": 30021,
      "timeoutMs": 30000,
      "logPath": "/Users/<local_user>/.clawperator/logs/clawperator-2026-03-21.log"
    }
  }
}
```

Use the resolved absolute path, not a `~` shorthand, so agents can read it directly.

### 5. Documentation

- `docs/troubleshooting.md`: add a "Reading the Clawperator log" section. Document the log path, NDJSON format, how to filter by `commandId`, and what each event means.
- `docs/agent-quickstart.md`: add a note after the "read the result" section pointing agents to the log file when a command fails unexpectedly.

---

## Why This Matters for Agent Success

With the enriched timeout error from PRD-2, an agent has a `commandId`. With a persistent log file, that `commandId` is a key the agent can use to reconstruct exactly what happened: was the APK check clean? Was the broadcast dispatched? Did the envelope come back at all? The log converts a dead end into a diagnostic starting point.

---

## Scope Boundaries

In scope:
- NDJSON log infrastructure: path, directory creation, fail-open behavior
- Minimum event set (listed above)
- `--log-level` global flag and `CLAWPERATOR_LOG_LEVEL` env var
- `CLAWPERATOR_LOG_DIR` env var
- `logPath` in `RESULT_ENVELOPE_TIMEOUT` (additive, depends on PRD-2)
- Two doc updates: troubleshooting log section, quickstart note

Out of scope:
- `clawperator logs` command for querying/filtering logs (defer - the NDJSON format is grep/jq-friendly enough)
- Log compression or automatic rotation
- Log content that includes execution payload body or user-entered text
- Streaming Android-side events (requires APK changes)

---

## Dependencies

- PRD-1 must land first: `preflight.apk.pass` and `preflight.apk.missing` events are produced by the gate added in PRD-1. Without it there is nothing to log at the pre-flight phase.
- PRD-2 must land first: `logPath` in the timeout error references and extends PRD-2's enrichment.
- PRD-4 (streaming) may add an additional `onOutput` consumer that also writes to the log - the NDJSON writer should be composable as a second `onOutput` subscriber at the CLI layer.
- Independent of PRD-3 and PRD-6.

---

## Risks and Tradeoffs

**Risk: sensitive data in logs**
Do not log execution payload content at any level. Payloads may contain user-entered text, credentials passed as action parameters, or personally identifiable information. Log metadata only: action types, action IDs, command IDs, device serials, event types.

**Risk: disk space at `debug` level**
adb output at `debug` can be verbose during long-running skills. The `info` default is appropriate. Document that `debug` logs can grow significantly during extended sessions.

**Risk: log directory permissions**
`~/.clawperator/logs/` is created under the user's home directory and should have appropriate permissions. Fail gracefully if creation fails - do not crash the CLI.

**Risk: logPath uses absolute path vs `~`**
Use the resolved absolute path in `logPath` so agents can pass it directly to `fs.readFile` or equivalent. Do not use `~` shorthand, which requires shell expansion.

---

## Testing Plan

### Fixtures

**Temp log directory per test:** Each unit test that writes logs should use a unique
temp directory (e.g., `/tmp/clawperator-test-<random-suffix>`), created in `beforeEach`
and cleaned up in `afterEach`. Do not use `~/.clawperator/logs/` in unit tests.

**Sentinel payload (`test/fixtures/execution-sentinel.json`):**
```json
{
  "commandId": "cmd-sentinel",
  "actions": [{ "id": "t1", "type": "enter_text",
    "params": { "text": "CLAWPERATOR_TEST_SENTINEL_X9Z" } }]
}
```
The sentinel string must not appear in any log file. Choose something unique enough
that a false match is impossible.

**Permission-failure simulation:** For T4, create a file at the intended log directory
path (not a directory) so that `mkdir` fails. This is simpler than mocking `fs`.

### TDD Sequence

Build the log writer module first, in isolation, before wiring it to any CLI command.
This keeps the core logic testable without needing a full CLI invocation.

**Step 1 — build the log writer:**
Write T1 (writes parseable NDJSON), T2 (appends, not overwrites), T3 (creates missing
directory), T4 (fails gracefully). All against the writer module directly.

**Step 2 — wire the writer to execution events:**
Write T5 (commandId in dispatched event). Wire the writer at each event site.
T5 must pass.

**Step 3 — wire `logPath` to the timeout error:**
Write T6 (logPath in timeout error is absolute path to written file). This depends on
PRD-2 being in place. T6 must pass.

**Step 4 — privacy check:**
Write T7 (sentinel does not appear in log). Run it during implementation of every new
event site — not just at the end.

### Unit Tests

**T1 — log writer creates file and writes parseable NDJSON**
- Call the writer with a test event (e.g., `{ event: "test.event", level: "info",
  message: "hello", ts: <iso string> }`) and a temp directory path
- Expected: file is created; file contents are a single line; `JSON.parse(line)` succeeds
  and the object has `event`, `level`, `message`, `ts` fields
- Failure mode protected: writer produces a JSON array, pretty-printed JSON, or truncated
  output — any of which breaks `JSON.parse(line)` for an agent trying to read the log

**T2 — log writer appends to existing file**
- Write two entries sequentially to the same file
- Expected: file has exactly two lines; each line is independently parseable
- Failure mode protected: second write overwrites the first; log is truncated to the most
  recent event

**T3 — log writer creates missing directory**
- Point the writer at a path where the directory does not yet exist
- Expected: directory is created; file is written; no error thrown
- Failure mode protected: first-time user gets no log because `~/.clawperator/logs/` does
  not exist yet

**T4 — log writer failure does not abort the command**
- Create a file (not a directory) at the path where the log directory should be, so
  `mkdir` fails
- Expected: one warning line to stderr (contains the log path); function returns without
  throwing; the calling code continues normally
- Failure mode protected: a permissions issue on the log directory crashes the CLI for
  the user; logging breaks the actuator

**T5 — `broadcast.dispatched` event logged with correct `commandId`**
- Run `runExecution` with a mock `broadcastAgentCommand` (so no device needed) and a
  payload that has `commandId: "cmd-sentinel"`; use `CLAWPERATOR_LOG_DIR=<tmp dir>`
- Expected: log file contains a line where `JSON.parse(line).event === "broadcast.dispatched"`
  and `JSON.parse(line).commandId === "cmd-sentinel"`
- Failure mode protected: event logged but without the correlation ID; agent reading the
  log can't match entries to a specific command

**T6 — `logPath` in timeout error is the absolute path to the written file**
- Run `runExecution` with a mock that never resolves, short timeout, and
  `CLAWPERATOR_LOG_DIR=/tmp/test-<random>`
- Expected: `error.details.logPath` is an absolute path; a file exists at that path;
  the file is in the directory that was configured via `CLAWPERATOR_LOG_DIR`
- Failure mode protected: `logPath` is a `~` shorthand (shell expansion needed) or a
  relative path; agent can't pass it to `fs.readFile` directly

**T7 — sentinel string from payload body does not appear in any log line**
- Run `runExecution` with `test/fixtures/execution-sentinel.json` and
  `CLAWPERATOR_LOG_DIR=<tmp dir>`, at `--log-level debug` (the most permissive level)
- Read every line of the log file; check for the sentinel string
  `"CLAWPERATOR_TEST_SENTINEL_X9Z"`
- Expected: sentinel string absent from all log lines
- Failure mode protected: payload body content (user-entered text, credentials passed as
  action params) logged at any level; privacy violation

### Integration Tests

Two integration tests. Both require `CLAWPERATOR_RUN_INTEGRATION=1` and a device.

**T8 — log written with correct events on successful execute**
- Set `CLAWPERATOR_LOG_DIR=/tmp/clawperator-test-logs` before the command
- Command: `clawperator execute --execution test/fixtures/execution-minimal-valid.json`
- After completion: read log; find lines with `event: "broadcast.dispatched"` and
  `event: "envelope.received"`; both must have `commandId: "test-cmd-001"`
- Failure mode protected: events not wired to the log writer in the actual CLI path

**T9 — `CLAWPERATOR_LOG_DIR` env var overrides default log directory**
- Set `CLAWPERATOR_LOG_DIR=/tmp/clawperator-test-dir`
- Command: any `clawperator` command that touches the device
- Expected: log file created under `/tmp/clawperator-test-dir/`; nothing written to
  `~/.clawperator/logs/`
- Failure mode protected: env var parsed but not respected; logs go to default path

### What to Skip

- Do not write a concurrent-append atomicity test. The test is platform-dependent,
  hard to make reliable in CI, and the risk is low given that `fs.appendFileSync` with
  short NDJSON lines is effectively atomic on macOS/Linux. Document the assumption
  instead of testing it.
- Do not test every log level permutation. T7 (debug level, most permissive) plus the
  acceptance criteria check on `--log-level error` (integration test T8 variants) is
  sufficient. Log level filtering is a configuration flag, not algorithmic logic.
- Skip URL reachability — deferred to PRD-6.

### Manual Verification

**M1 — log readable during a real skill run**
- Open a second terminal: `tail -f ~/.clawperator/logs/clawperator-$(date +%Y-%m-%d).log`
- In the first terminal: run `clawperator skills run <skill-that-takes-5-seconds>`
- Confirm: log entries appear in the tail output as the skill runs; not all at once after
  completion
- Confirm: no `enter_text` payload content visible in any log line

---

## Acceptance Criteria

- `execute` invocations write NDJSON to `~/.clawperator/logs/clawperator-YYYY-MM-DD.log`.
- Each log entry includes `ts`, `level`, `event`, `commandId` (when available), `taskId` (when available), `deviceId` (when known), `message`.
- `--log-level debug|info|warn|error` controls which events are written.
- `CLAWPERATOR_LOG_DIR` overrides the default log directory.
- `RESULT_ENVELOPE_TIMEOUT` includes `details.logPath` with the absolute path to the current day's log file.
- Log directory creation failure emits one stderr warning and continues without logging.
- No execution payload body content appears in any log entry at any log level.
- `docs/troubleshooting.md` documents the log path, NDJSON format, and `commandId` filtering.
- `docs/agent-quickstart.md` points to the log file when a command fails.
