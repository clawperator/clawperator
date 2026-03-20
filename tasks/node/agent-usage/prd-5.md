# PRD-5: Structured Persistent Logs

Workstream: WS-5
Priority: 5
Proposed PR: PR-5

---

## Problem Statement

When a Clawperator command fails or times out, there is no persistent log to inspect. The only evidence is what was printed to stdout/stderr before the process exited. For a timeout, that evidence is: the command that was run, and the timeout error. Nothing about what was dispatched to the device, what adb returned, whether the broadcast was received, or where in the execution sequence the failure occurred.

Agents and operators are left to guess or reproduce the failure in real time.

---

## Evidence

**From `tasks/node/agent-usage/issues.md`, Issue #2:**
> When skills or commands fail, there is no persistent logging to help diagnose issues.
> No log files written to disk. Only stdout/stderr from the CLI.
> On timeout, zero information about what went wrong.
> Agents must guess or ask the user.

**From `tasks/node/agent-usage/issues.md`, Issue #2 (suggested behavior):**
> Clawperator writes structured logs to `~/.clawperator/logs/`
> Agents can `tail -f` logs during skill execution
> Logs include: broadcast sent, response received, errors, timing, device state
> Log level configurable (debug, info, warn, error)

**From `tasks/node/agent-usage/issues.md`, lessons learned:**
> I didn't know where logs were - There were no logs to check.

**From the GloBird incident:**
A timeout occurred because the APK was not installed. With persistent logs, the absence of a "broadcast dispatched successfully" event - or a "pm list packages returned empty for com.clawperator.operator" event - would have narrowed the root cause from "something failed somewhere in the pipeline" to "pre-flight check failed: APK not found" within seconds.

---

## Current Behavior

All CLI output goes to stdout and stderr. When the process exits, the output is gone unless the caller captured it. No `~/.clawperator/logs/` directory is created by any command. No structured event log exists.

---

## Proposed Change

### 1. Write JSON-structured logs to `~/.clawperator/logs/`

All CLI commands that interact with the device write structured JSON log entries to:

```
~/.clawperator/logs/clawperator-YYYY-MM-DD.log
```

One JSON object per line (NDJSON format). Entries include:
- `ts`: ISO 8601 timestamp
- `level`: `debug | info | warn | error`
- `commandId`: correlation ID from the execution payload (when available)
- `taskId`: correlation ID (when available)
- `event`: short event identifier (e.g., `preflight.apk.check`, `broadcast.dispatched`, `envelope.received`, `timeout.fired`)
- `deviceId`: the targeted device serial (when known)
- `message`: human-readable description
- `data`: optional structured data specific to the event

Example entries:

```ndjson
{"ts":"2026-03-21T04:14:28.001Z","level":"info","commandId":"skill-run-001","event":"preflight.apk.check","deviceId":"<device_id>","message":"Checking Operator APK presence","data":{"receiverPackage":"com.clawperator.operator"}}
{"ts":"2026-03-21T04:14:28.102Z","level":"error","commandId":"skill-run-001","event":"preflight.apk.missing","deviceId":"<device_id>","message":"Operator APK not installed","data":{"receiverPackage":"com.clawperator.operator","exitCode":0,"stdout":""}}
```

### 2. Log retention and rotation

- Keep 7 days of logs by default (one file per day).
- Do not compress or rotate intra-day. Each day's file grows until midnight, then a new file starts.
- No automatic deletion of older files beyond the 7-day window; leave cleanup to the operator.
- Log directory configurable via `CLAWPERATOR_LOG_DIR` environment variable.

### 3. `--log-level` flag

Add `--log-level <debug|info|warn|error>` as a global flag (alongside `--device-id`, `--output`, etc.).

Default: `info`.

`debug` includes: adb command strings, full stdout/stderr from adb, timing for every adb call.
`info` includes: pre-flight results, broadcast dispatch, result envelope received, timeout events.
`warn` includes: recoverable issues (variant mismatch, dev options disabled).
`error` includes: critical failures only.

For agent usage, `info` is the correct default. `debug` is for human operators investigating adb-level issues.

### 4. Structured log events to capture (minimum viable set)

| Event | Level | When |
| :--- | :--- | :--- |
| `preflight.apk.check` | info | Before execute dispatches broadcast |
| `preflight.apk.missing` | error | APK not found in pre-flight |
| `preflight.apk.pass` | info | APK confirmed present |
| `broadcast.dispatched` | info | adb broadcast sent |
| `broadcast.error` | error | adb broadcast returned non-zero |
| `envelope.waiting` | debug | Polling for result envelope |
| `envelope.received` | info | Result envelope returned |
| `timeout.fired` | error | Timeout waiting for envelope |
| `doctor.check` | info | Each doctor check with result |
| `skills.run.start` | info | Skill run started |
| `skills.run.complete` | info | Skill run finished with exit code |

### 5. Documentation

- `docs/troubleshooting.md`: Add a "Reading the Clawperator log" section. Document the log path, the NDJSON format, and how to filter by `commandId`.
- `docs/agent-quickstart.md`: Add a note pointing to logs when a command fails.
- `docs/reference/node-api-doctor.md`: Note that doctor run events are logged.

---

## Why This Matters for Agent Success

Persistent logs close the gap between "something failed" and "here is which component failed and why." An agent that knows to check `~/.clawperator/logs/clawperator-2026-03-21.log` after a timeout has evidence immediately. Without logs, the agent must reproduce the failure in real time - which means running the command again, waiting for the timeout again, and still having no more information.

Logs also enable better `RESULT_ENVELOPE_TIMEOUT` enrichment (from WS-2): the timeout error message can reference the log file for the full event trace, even if the error envelope itself only surfaces the top-level action context.

---

## Scope Boundaries

In scope:
- NDJSON log to `~/.clawperator/logs/`
- 7-day retention (daily files)
- `--log-level` global flag
- Minimum viable event set (table above)
- Documentation updates (troubleshooting, quickstart, doctor reference)
- `CLAWPERATOR_LOG_DIR` env var override

Out of scope:
- Real-time streaming of log events to stdout (separate from log-to-disk)
- Log compression or archival
- Per-action Android-side event streaming (requires APK changes)
- A `clawperator logs` command for reading/filtering logs (nice to have, defer)

---

## Dependencies

- WS-1 (PRD-1) should ship first. The most valuable log events are the pre-flight check events. Without WS-1, the pre-flight does not exist and the most important events cannot be logged.
- Independent of WS-2, but the two complement each other: WS-2 enriches the error envelope, WS-5 provides the full trace behind it.

---

## Risks and Tradeoffs

**Risk: disk space**
A debug-level log for a long-running skill execution can grow quickly if adb output is verbose. Mitigation: `info` default keeps routine logs small; `debug` is an explicit opt-in.

**Risk: log directory permissions**
`~/.clawperator/logs/` must be created with appropriate permissions. The first write should create the directory if it does not exist. Handle creation errors gracefully (fail open: if log directory cannot be created, continue without logging but warn once to stderr).

**Risk: sensitive data in logs**
adb command strings at `debug` level may include device serials and package names. These are not secrets but are device-specific identifiers. The log is user-local (`~/.clawperator/`) which is appropriate. Do not log execution payload content (which may contain user-entered data) at any level.

**Tradeoff: per-command vs. per-session log files**
Per-day files (one per calendar day) are simple but make correlation harder when many commands run in a day. Correlation IDs (`commandId`, `taskId`) in each log entry are the primary mechanism for filtering. A `clawperator logs --command-id <id>` reader command would make this usable; deferred to a follow-on.

---

## Validation Plan

1. Unit test: log directory is created if absent on first write.
2. Unit test: log entry includes `ts`, `level`, `event`, `commandId`, `deviceId`, `message` fields.
3. Unit test: `--log-level error` suppresses `info` and `debug` entries.
4. Integration test: after `clawperator execute` succeeds, `~/.clawperator/logs/clawperator-YYYY-MM-DD.log` exists and contains `broadcast.dispatched` and `envelope.received` entries with matching `commandId`.
5. Integration test: after a timeout, the log contains `timeout.fired` with the last action context.
6. Manual verification: `tail -f ~/.clawperator/logs/clawperator-$(date +%Y-%m-%d).log` while running a skill shows live events.

---

## Acceptance Criteria

- All `execute` invocations write NDJSON entries to `~/.clawperator/logs/clawperator-YYYY-MM-DD.log`.
- Each entry includes `ts`, `level`, `event`, `commandId` (when available), `deviceId` (when known), and `message`.
- Log directory is created automatically if absent.
- `--log-level debug|info|warn|error` controls verbosity; default is `info`.
- `CLAWPERATOR_LOG_DIR` overrides the default log directory.
- After a timeout, the log contains at minimum a `broadcast.dispatched` event and a `timeout.fired` event.
- `docs/troubleshooting.md` documents the log path, format, and how to filter by `commandId`.
