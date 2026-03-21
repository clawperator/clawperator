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

**OpenClaw session logs:**
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

### 0. New module: logger

**Directory choice**: The `infra/` directory does not exist in this codebase. The existing
top-level directories under `apps/node/src/` are `adapters/`, `cli/`, `contracts/`,
`domain/`, and `test/`. A logger is an I/O adapter (it writes to the filesystem), so
**prefer `apps/node/src/adapters/logger.ts`** over creating a new `infra/` directory.

If there is a strong organizational reason to use `infra/` instead (e.g. a future logging
or telemetry umbrella), note it in the PR and create the directory explicitly. Do not
create it silently.

Create the log writer as a standalone module. It
should export:
```typescript
export interface LogEvent { ts: string; level: string; event: string;
  commandId?: string; taskId?: string; deviceId?: string; message: string; }

export interface Logger {
  log(event: LogEvent): void;
  logPath(): string | undefined;  // returns the current log file path, or undefined if logging disabled
}

export function createLogger(options?: { logDir?: string; logLevel?: string }): Logger
```

Wire it into `RunExecutionOptions` by adding optional `logger?: Logger`. The CLI layer
creates a logger via `createLogger({ logDir: process.env.CLAWPERATOR_LOG_DIR,
logLevel: options.logLevel ?? process.env.CLAWPERATOR_LOG_LEVEL })` and passes it in.
Default to no logging when no logger is provided (fail-safe for call sites that do not
pass one). This approach keeps the domain layer testable in isolation.

### 1. NDJSON log file at `~/.clawperator/logs/`

All CLI commands that touch the device write structured log entries to:

```
~/.clawperator/logs/clawperator-YYYY-MM-DD.log
```

Format: one JSON object per line (NDJSON), terminated by `\n` (not `\r\n`).
Each line must be parseable independently with `JSON.parse`. Do not pretty-print.
Minimum required fields per entry:

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

`CLAWPERATOR_LOG_LEVEL` env var as an alternative to the flag. When both are set,
the `--log-level` flag takes precedence over the env var. Document this explicitly.

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
- PRD-4 (streaming) is independent of this PRD. Structured lifecycle events
  (`skills.run.start`, `skills.run.complete`, `skills.run.timeout`) are emitted by the
  domain layer on process spawn, exit, and timeout — regardless of whether an `onOutput`
  callback is provided. The `onOutput` callback and the logger are independent mechanisms;
  neither depends on the other being present. If raw subprocess output chunks should also
  be written to the log in a future iteration, the NDJSON writer can be wired as a second
  `onOutput` subscriber at the CLI layer — but that is not part of this PRD.
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

- Each unit test uses a unique temp directory created in `beforeEach`, cleaned in
  `afterEach` — never use `~/.clawperator/` in unit tests
- Permission-failure simulation: create a regular file at the intended log directory path
  so `mkdir` fails (simpler than mocking `fs`)
- Sentinel string for privacy test: `"CLAWPERATOR_TEST_SENTINEL_X9Z"` — used as the
  `text` value in an `enter_text` action. The `enter_text` schema accepts any string for
  `text`, so this sentinel is a valid payload and will pass `validateExecution`. It must
  not appear in any log line at any log level.

### TDD Sequence

Build the log writer module in isolation first, before wiring to any CLI command.

1. Write T1-T4 against the writer module directly. All fail. Implement the writer.
   All must pass before wiring to CLI.
2. Wire to execution events. Write T5 (commandId logged). Wire. Passes.
3. Wire `logPath` to timeout error. Write T6. Wire. Passes.
4. Write T7 (privacy check) and run it at every new event site — not just at the end.
5. Run integration test T8.

### Unit Tests

**T1 — writer creates a parseable NDJSON entry**
- Write one event; read file; `JSON.parse(line)` must succeed
- Protects: comma-separated JSON or pretty-printed output breaks agent log reading

**T2 — writer appends, not overwrites**
- Write two entries sequentially; expected: two lines, each independently parseable
- Protects: second write truncates the file; log has only the last event

**T3 — writer creates missing log directory**
- Point writer at a nonexistent directory; expected: directory created, file written
- Protects: first-time user gets no log because `~/.clawperator/logs/` does not exist yet

**T4 — writer failure does not abort the command (fail-open anchor)**
- Create a file at the log directory path so `mkdir` fails; expected: one warning to
  stderr, function returns without throwing
- Protects: logging permissions issue crashes the CLI; actuator stops working

**T5 — `broadcast.dispatched` event logged with `commandId`**
- Run `runExecution` with mock broadcast and `commandId: "cmd-sentinel"`,
  `CLAWPERATOR_LOG_DIR=<tmp>`
- Expected: log line with `event: "broadcast.dispatched"` and matching `commandId`
- Protects: event emitted but correlation ID not propagated to log

**T6 — `logPath` in timeout error is the actual written file**
- Run `runExecution` with a mock that never resolves, short timeout,
  `CLAWPERATOR_LOG_DIR=/tmp/test-<uuid>`
- Expected: `error.details.logPath` is an absolute path; a file exists at that exact path
- Protects: `logPath` is a `~` shorthand or wrong file; agent passes it to `fs.readFile`
  and gets an error

**T7 — payload body content absent from all log lines (privacy anchor)**
- Run with `enter_text` action containing the sentinel string, at `--log-level debug`
- Read every log line; expected: sentinel string absent from all lines
- Protects: user text or credentials logged; hard privacy requirement, not optional

### Integration Tests

**T8 — log written with correct events during a real execute**
- Set `CLAWPERATOR_LOG_DIR=/tmp/clawperator-test-logs`; run a successful execute
- Expected: log file present; lines with `broadcast.dispatched` and `envelope.received`
  contain matching `commandId`
- Protects: writer passes unit tests but events not wired in the actual CLI path

### Manual Verification

- `tail -f ~/.clawperator/logs/clawperator-$(date +%Y-%m-%d).log` while running a skill;
  log entries appear as the skill runs, not all at once after completion

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
