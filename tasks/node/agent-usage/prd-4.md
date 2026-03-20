# PRD-4: Progress, Logs, and Recovery Guidance

Workstream: WS-4
Priority: 4
Proposed PR: PR-4

Merged from both agents. Other agent framed this as "progress and recovery surface" and deferred
persistent logs. This analysis keeps both. See `reconciliation.md` for the resolution.

---

## Problem Statement

Long-running Clawperator work is completely opaque until the command exits. `runSkill.ts` uses `stdio: ["ignore", "pipe", "pipe"]` with accumulated strings - output is buffered and only returned on process exit. There is no log file. After a timeout, there is no evidence trail. An agent cannot distinguish "working normally" from "stuck" from "already failed."

---

## Evidence

**From `apps/node/src/domain/skills/runSkill.ts:102-106`:**

```typescript
const child = spawn(cmd, cmdArgs, {
  stdio: ["ignore", "pipe", "pipe"],  // fully buffered
  env: childEnv,
});

let stdout = "";
let stderr = "";
// ...
child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
```

Output is accumulated and only returned in the final result. No streaming to the caller during execution.

**From `apps/node/src/domain/executions/runExecution.ts`:**

`waitForResultEnvelope` polls logcat for the result envelope. When it times out, the error is returned. There is no intermediate progress signal.

**From `tasks/node/agent-usage/issues.md`, Issues #2, #4, #6:**
> Running GloBird skill. 30 seconds pass. Is it working? Should I wait? Cancel? Check the device? I have no idea.
> No log files written to disk. On timeout, zero information about what went wrong.
> I didn't know where logs were. There were no logs to check.

---

## Current Behavior

1. `skills run` produces no output until the skill script exits or times out.
2. No log files are written to disk anywhere in the CLI.
3. After `RESULT_ENVELOPE_TIMEOUT`, there is no evidence of what was dispatched or at what point the pipeline failed.
4. `doctor` prints `nextActions` and per-check hints. `execute` can surface stable error codes. These are the only existing recovery surfaces.

---

## Proposed Change

### 1. Stream `runSkill.ts` stdout/stderr to the caller in real time

Change the `stdio` from `["ignore", "pipe", "pipe"]` to allow real-time forwarding of the child process output while still capturing it for the final result and `--expect-contains` check.

The child's stdout should be both:
- forwarded to the CLI's stdout as it arrives (agents can observe it live)
- accumulated for the `output` field in the final `SkillRunResult`

Same for stderr.

This is a contained change within `runSkill.ts`. The final result shape (`SkillRunResult`) does not change. The `--expect-contains` check still operates on the full accumulated output.

Implementation note: use the existing `data` handlers but also call `process.stdout.write(chunk)` (or the equivalent output stream) in addition to accumulating.

### 2. Structured NDJSON log to `~/.clawperator/logs/`

All CLI commands that touch the device write structured log entries to:

```
~/.clawperator/logs/clawperator-YYYY-MM-DD.log
```

One JSON object per line. Minimum fields:
- `ts`: ISO 8601 timestamp
- `level`: `debug | info | warn | error`
- `commandId`: from the execution payload (when available)
- `event`: short event identifier
- `deviceId`: device serial (when known)
- `message`: human-readable description

Minimum event set:

| Event | Level | When |
| :--- | :--- | :--- |
| `preflight.apk.pass` | info | Pre-flight confirms APK present |
| `preflight.apk.missing` | error | Pre-flight finds APK absent |
| `broadcast.dispatched` | info | adb broadcast sent to device |
| `envelope.received` | info | Result envelope returned |
| `timeout.fired` | error | Timeout waiting for envelope |
| `doctor.check` | info | Each doctor check with id and status |
| `skills.run.start` | info | Skill run started |
| `skills.run.complete` | info | Skill run exited with code |

Log directory:
- Default: `~/.clawperator/logs/`
- Override: `CLAWPERATOR_LOG_DIR` env var
- Retention: one file per calendar day; no automatic deletion beyond 7 days
- Create directory on first write; fail open (warn once to stderr if directory cannot be created, continue without logging)

### 3. `--log-level` global flag

`--log-level <debug|info|warn|error>` as a global CLI flag alongside `--device-id`, `--output`, etc.

Default: `info`.
`debug`: includes adb command strings, full adb stdout/stderr, timing for every adb call.
`info`: preflight results, broadcast dispatch, result envelope, timeouts.

### 4. Update `RESULT_ENVELOPE_TIMEOUT` to reference the log

After PRD-2 adds last-action context to the timeout error, also add a `logPath` hint in the error message when a log file was written:

```json
{
  "ok": false,
  "error": {
    "code": "RESULT_ENVELOPE_TIMEOUT",
    "message": "Timed out after 30000ms (last action: 'open-energy-tab' / open_app). Log: ~/.clawperator/logs/clawperator-2026-03-21.log",
    "details": {
      "lastActionId": "open-energy-tab",
      "lastActionType": "open_app",
      "elapsedMs": 30021,
      "timeoutMs": 30000,
      "logPath": "~/.clawperator/logs/clawperator-2026-03-21.log"
    }
  }
}
```

### 5. Documentation

- `docs/troubleshooting.md`: add a "Reading the Clawperator log" section documenting the log path, NDJSON format, and filtering by `commandId`.
- `docs/agent-quickstart.md`: add a note pointing to the log file when a command fails.

---

## Why This Matters for Agent Success

Without streaming, a 30-second skill run is 30 seconds of silence. After streaming, the agent sees the skill's output as it arrives and can decide to wait or abort.

Without logs, a timeout is a dead end. After logs, the agent checks `~/.clawperator/logs/` and sees whether the broadcast was dispatched and which phase was in flight. The timeout becomes a starting point for investigation, not the end of it.

---

## Scope Boundaries

In scope:
- `runSkill.ts`: real-time stdout/stderr forwarding
- NDJSON log to `~/.clawperator/logs/`
- `--log-level` global flag
- `CLAWPERATOR_LOG_DIR` env var
- `RESULT_ENVELOPE_TIMEOUT` log path hint (depends on PRD-2)
- Two doc updates (troubleshooting, quickstart)

Out of scope:
- Android-side per-action event streaming (requires APK changes)
- Log compression or archival
- `clawperator logs` command for reading/filtering logs (defer)
- Replacing the terminal envelope contract
- Log content that includes user-entered data (execution payload content)

---

## Dependencies

- PRD-1 should land first. Pre-flight APK check events are the most valuable log entries. Without PRD-1, there are no pre-flight events to log.
- PRD-2 enriches `RESULT_ENVELOPE_TIMEOUT` - the `logPath` addition in section 4 extends that enrichment.
- Independent of PRD-3.

---

## Risks and Tradeoffs

**Risk: `--expect-contains` broken by streaming change**
`skills run --expect-contains <text>` checks the full accumulated output. The streaming change must ensure the accumulated `stdout` is still complete at check time. Verify the change does not cause partial output to be checked before the process exits.

**Risk: disk space at `debug` level**
adb output at `debug` can be large during long-running skills. `info` default is appropriate. `debug` is opt-in. Document that debug logs can grow significantly.

**Risk: log directory permissions**
`~/.clawperator/logs/` must be created with appropriate permissions. Handle creation failures gracefully: warn once to stderr, continue without logging.

**Risk: sensitive data in logs**
Do not log execution payload content at any level. Payload may contain user-entered text. Log metadata (action types, IDs, command IDs) is appropriate; payload body is not.

---

## Validation Plan

1. Unit test: `runSkill` with a script that emits stdout line-by-line - verify output appears before script exits.
2. Unit test: `SkillRunResult.output` contains the full accumulated stdout even after streaming.
3. Unit test: `--expect-contains` still works correctly after streaming change.
4. Unit test: `SKILL_EXECUTION_TIMEOUT` still returns partial `stdout` in the error.
5. Integration test: after `clawperator execute` completes, `~/.clawperator/logs/clawperator-YYYY-MM-DD.log` exists and contains `broadcast.dispatched` and `envelope.received` with matching `commandId`.
6. Integration test: after a timeout, the log contains `timeout.fired`.
7. Integration test: `CLAWPERATOR_LOG_DIR=/tmp/custom-logs clawperator execute ...` writes to the custom path.
8. Manual verification: `tail -f ~/.clawperator/logs/clawperator-$(date +%Y-%m-%d).log` shows live events during a skill run.

---

## Acceptance Criteria

- `skills run` output is visible to the caller as it arrives, not only at completion.
- `SkillRunResult.output` is unchanged (full accumulated output, not streaming reference).
- `--expect-contains` works correctly with the streaming change.
- All `execute` invocations write NDJSON to `~/.clawperator/logs/clawperator-YYYY-MM-DD.log`.
- Each log entry includes `ts`, `level`, `event`, `commandId` (when available), `deviceId` (when known), `message`.
- `--log-level debug|info|warn|error` controls verbosity.
- `CLAWPERATOR_LOG_DIR` overrides the default log directory.
- `docs/troubleshooting.md` documents the log path, format, and `commandId` filtering.
