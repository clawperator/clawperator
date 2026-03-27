# Logging

## Purpose

Clawperator logs every significant event to a local NDJSON file for post-run diagnostics. An agent can inspect this file after a timeout or failure to determine what happened step by step.

## Log File Location

Logs are written to a daily file at:

```
~/.clawperator/logs/clawperator-YYYY-MM-DD.log
```

The path components are:

| Component | Value | Source |
|-----------|-------|--------|
| Base directory | `~/.clawperator/logs` | Default, or `CLAWPERATOR_LOG_DIR` env var |
| Filename prefix | `clawperator-` | Hardcoded |
| Date format | `YYYY-MM-DD` | UTC date of the log entry |
| Extension | `.log` | Hardcoded |

Example path: `/home/user/.clawperator/logs/clawperator-2026-03-28.log`

To change the base directory, set the `CLAWPERATOR_LOG_DIR` environment variable. See [Environment Variables](environment.md) for details.

## NDJSON Format

Each line is a valid JSON object (NDJSON - Newline Delimited JSON). No wrapping array, no trailing commas. One event per line.

### Required Fields

Every log event has these fields:

| Field | Type | Description |
|-------|------|-------------|
| `ts` | string | ISO 8601 timestamp (e.g., `2026-03-28T12:34:56.789Z`) |
| `level` | string | One of: `debug`, `info`, `warn`, `error` |
| `event` | string | Dot-separated event name (e.g., `skills.run.start`) |
| `message` | string | Human-readable summary |

### Optional Context Fields

Events may include additional context fields:

| Field | Type | Present When |
|-------|------|--------------|
| `commandId` | string | CLI command or execution has a correlation ID |
| `taskId` | string | Part of a larger task sequence |
| `deviceId` | string | Event targets a specific device |
| `skillId` | string | Skill execution event |
| `stream` | string | `stdout` or `stderr` for skill output lines |
| `status` | string | Completion status (e.g., `pass`, `fail`) |
| `durationMs` | number | Operation completed, measured in milliseconds |
| `exitCode` | number | Process exit code for skill/execution events |

### Example Log Lines

```jsonl
{"ts":"2026-03-28T10:15:30.123Z","level":"info","event":"skills.run.start","message":"Skill com.example.app.get-status started","skillId":"com.example.app.get-status","commandId":"cmd-123"}
{"ts":"2026-03-28T10:15:30.456Z","level":"info","event":"skills.run.output","message":"Opening app...","skillId":"com.example.app.get-status","stream":"stdout"}
{"ts":"2026-03-28T10:15:32.789Z","level":"info","event":"skills.run.complete","message":"Skill com.example.app.get-status completed successfully in 2345ms","skillId":"com.example.app.get-status","durationMs":2345,"exitCode":0}
```

## Log Levels

Four levels are available, in order of increasing severity:

| Level | Numeric Value | Use Case |
|-------|---------------|----------|
| `debug` | 0 | Detailed diagnostic information |
| `info` | 1 | Normal operational events |
| `warn` | 2 | Unexpected but recoverable conditions |
| `error` | 3 | Failures that prevent intended operation |

### Threshold Behavior

The `--log-level` flag (or `CLAWPERATOR_LOG_LEVEL` env var) controls which events are written to the file. Events at or above the threshold are logged.

| Setting | Events Logged |
|---------|---------------|
| `debug` | All events (debug, info, warn, error) |
| `info` | info, warn, error (default) |
| `warn` | warn, error |
| `error` | error only |

Default: `info`

Invalid values fall back silently to `info`.

## Event Naming Conventions

Events use dot-separated names with prefix-based categories:

| Prefix | Category | Example |
|--------|----------|---------|
| `skills.run.` | Skill execution lifecycle | `skills.run.start`, `skills.run.complete` |
| `cli.` | CLI output | `cli.banner` |
| `doctor.` | Doctor diagnostics | `doctor.check` |
| `serve.` | HTTP/SSE server | `serve.server.started`, `serve.http.request` |

## The `clawperator logs` Command

Stream the log file in real time.

### Usage

```bash
clawperator logs
```

### Behavior

1. Dumps all existing content from the current daily log file to stdout
2. Streams new lines as they are written
3. Runs until interrupted

### Interrupt

Press `Ctrl+C` (SIGINT) to stop. The command exits with code 0.

### Output Format

Raw NDJSON lines on stdout. No formatting, no filtering, no color.

### No Flags

The command accepts no flags. It always operates on the current daily log file determined by `CLAWPERATOR_LOG_DIR` (or the default `~/.clawperator/logs`).

### Missing File Behavior

If the log file does not exist, the command writes a message to stderr and exits with code 0:

```
No log file found at /home/user/.clawperator/logs/clawperator-2026-03-28.log
```

## Fail-Open Behavior

If the log directory cannot be written to (permissions, disk full, path does not exist), Clawperator:

1. Writes one warning to stderr
2. Disables file logging for the remainder of the process
3. Continues normal operation

Example warning:

```
[clawperator] WARN: logging disabled after write failure for /home/user/.clawperator/logs/clawperator-2026-03-28.log: EACCES: permission denied
```

The command or skill still executes normally. Only the log file is affected.

## Verification

Confirm logging is active:

```bash
# Check the log file exists and has recent content
ls -la ~/.clawperator/logs/

# Stream logs in real time
clawperator logs
```

Generate a log entry:

```bash
# Any command generates log entries
clawperator devices --json
```

Verify the entry appears:

```bash
# In another terminal, or after interrupting the logs command:
grep '"event":"devices.list"' ~/.clawperator/logs/clawperator-$(date +%F).log
```

## Environment Variables

See [Environment Variables](environment.md) for complete details on:

- `CLAWPERATOR_LOG_DIR` - Change the log directory base path
- `CLAWPERATOR_LOG_LEVEL` - Set the file logging threshold

## JSON Mode Cleanliness

When `--json` output mode is active, the unified logger never writes to stdout. Log events go only to the file. This ensures the JSON output stream remains parseable without interleaved log lines.
