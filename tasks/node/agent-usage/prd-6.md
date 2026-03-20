# PRD-6: Persistent Logging and Log Retrieval

Workstream: WS-4b
Priority: 6
Proposed PR: PR-6

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
- Independent of PRD-3 and PRD-5.

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

## Validation Plan

1. Integration test: after `clawperator execute` completes, `~/.clawperator/logs/clawperator-YYYY-MM-DD.log` exists and contains `broadcast.dispatched` and `envelope.received` with matching `commandId` and `taskId`.
2. Integration test: after a timeout, the log contains `timeout.fired` with `commandId`.
3. Integration test: `CLAWPERATOR_LOG_DIR=/tmp/test-logs clawperator execute ...` writes to `/tmp/test-logs/`.
4. Integration test: `--log-level debug` produces adb command strings in the log.
5. Integration test: `--log-level error` produces only error events.
6. Unit test: log directory creation failure causes a warning to stderr but does not abort the command.
7. Integration test: `RESULT_ENVELOPE_TIMEOUT` error includes `details.logPath` with an absolute path pointing to the log file for that day.
8. Unit test: execution payload body (action params, text fields) does not appear in any log entry at any log level.
9. Manual verification: `tail -f ~/.clawperator/logs/clawperator-$(date +%Y-%m-%d).log` during a skill run shows real-time events.

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
