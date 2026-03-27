# Unified Logging System Design

## Purpose

Provide deterministic, structured logging for all Clawperator operations. An agent can inspect the log after a timeout or failure to reconstruct exactly what happened step by step.

## Design Principles

1. **Always Log**: Every significant operation is logged. No silent paths.
2. **Structured**: NDJSON format for machine parsing. No custom text formats.
3. **Fail-Open**: If logging fails, warn once and continue. Logging must never block execution.
4. **Terminal-Clean**: JSON output mode must not be polluted with log lines.
5. **Daily Rotation**: One file per day prevents unbounded growth and simplifies cleanup.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   CLI Commands  │────▶│                  │────▶│  NDJSON File    │
│   Skill Runner  │────▶│  Unified Logger  │     │  (~/.clawperator│
│   HTTP Server   │────▶│                  │     │   /logs/...)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Terminal (stderr│
                        │   in pretty mode)│
                        └──────────────────┘
```

### Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `ClawperatorLogger` interface | `contracts/logging.ts` | Contract for all logging operations |
| Logger implementation | `adapters/logger.ts` | File sink, terminal routing, level filtering |
| Log path utilities | `contracts/logging.ts` | Shared path resolution between logger and logs command |
| `clawperator logs` command | `cli/commands/logs.ts` | Dump-then-stream behavior for log inspection |

## LogEvent Schema

All events share a common schema defined in `contracts/logging.ts`:

```typescript
interface LogEvent {
  ts: string;        // ISO 8601 timestamp
  level: LogLevel;   // "debug" | "info" | "warn" | "error"
  event: string;     // Dot-separated event name
  message: string;   // Human-readable summary
  
  // Optional context
  commandId?: string;
  taskId?: string;
  deviceId?: string;
  skillId?: string;
  stream?: "stdout" | "stderr";
  status?: string;
  durationMs?: number;
  exitCode?: number;
}
```

## Event Naming Conventions

Events use dot-separated prefixes for categorization:

| Prefix | Category | Examples |
|--------|----------|----------|
| `skills.run.` | Skill execution lifecycle | `start`, `output`, `complete`, `failed`, `timeout` |
| `cli.` | CLI command output | `banner`, `validation` |
| `doctor.` | Doctor diagnostics | `check` |
| `serve.` | HTTP/SSE server | `server.started`, `http.request`, `sse.client.connected` |

## Routing Rules

Routing determines where events go (file, terminal, or both). Terminal routing is independent of log level - it respects output format instead.

| Event Category | File | Terminal | In JSON Mode |
|----------------|------|----------|--------------|
| `skills.run.output` | Yes | No | No |
| `cli.*` | Yes | Yes | No |
| `doctor.*` | Yes | No | No |
| `serve.*` | Yes | No | No |
| `*` (default) | Yes | No | No |

**Design Rationale**:

- `skills.run.output` is file-only to avoid flooding the terminal with skill stdout/stderr lines
- `cli.*` events appear on stderr in pretty mode for user feedback, but are suppressed in JSON mode to keep output parseable
- Most server events are file-only to avoid terminal noise during long-running serve

## Level Threshold Behavior

The log level threshold applies **only to the file sink**. Terminal output respects the routing rules and output format, not the level threshold.

| Threshold | File Events Written |
|-----------|---------------------|
| `debug` | All levels |
| `info` | info, warn, error (default) |
| `warn` | warn, error |
| `error` | error only |

Invalid level values fall back silently to `info`.

## The `clawperator logs` Command

### Design Goals

1. **No Flags**: Simple, predictable behavior. Always dump-then-stream.
2. **No Gap**: Watch the file before reading to prevent missing events between dump and stream.
3. **Clean Exit**: Ctrl+C exits 0 (user-initiated, not an error).

### Implementation Details

```
┌─────────────────────────────────────────────────────────────┐
│  cmdLogs()                                                   │
│  ├── Resolve log path                                        │
│  ├── Check existence (stderr + exit 0 if missing)           │
│  └── dumpAndStreamContent()                                  │
│      ├── Install SIGINT/SIGTERM handlers FIRST               │
│      ├── Start fs.watchFile() BEFORE reading                 │
│      ├── Read entire file (the "dump")                       │
│      ├── Emit queued events that arrived during dump         │
│      └── Stream new lines as they arrive                     │
└─────────────────────────────────────────────────────────────┘
```

The watch-before-read ordering guarantees no events are lost between the initial read and the start of streaming.

## Fail-Open Behavior

If the log directory cannot be written to:

1. **One warning** to stderr with the format:
   ```
   [clawperator] WARN: logging disabled after write failure for <path>
   ```
2. **Disable file logging** for the remainder of the process
3. **Continue normal operation** - commands and skills execute normally

This ensures logging problems never cascade into execution failures.

## Shared Path Utilities

To avoid drift between the logger and the logs command, path utilities live in `contracts/logging.ts`:

- `expandHomePath()`: Expand `~` to home directory
- `formatDate()`: Format as `YYYY-MM-DD`
- `formatLogPath()`: Build the daily file path

Both the logger factory and the logs command use these utilities, ensuring they always agree on where logs live.

## Separation of Concerns: Logger vs EventEmitter

Clawperator has two distinct event systems:

| System | Purpose | Transport | Data |
|--------|---------|-----------|------|
| `ClawperatorLogger` | Structured logging | NDJSON file, stderr | LogEvent objects |
| `clawperatorEvents` (EventEmitter) | SSE transport | HTTP SSE stream | Rich result objects |

**Why Two Systems?**

- The logger handles NDJSON-serializable events for persistent logs
- The EventEmitter carries complex in-memory objects (`ResultEnvelope`, `RunExecutionResult`) to SSE clients
- Mixing them would force either: (a) making LogEvents handle circular references, or (b) losing rich object structure in SSE

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `CLAWPERATOR_LOG_DIR` | Base directory for log files | `~/.clawperator/logs` |
| `CLAWPERATOR_LOG_LEVEL` | File logging threshold | `info` |

Both can be overridden via CLI flags (`--log-dir`, `--log-level`) which take precedence.

## Future Considerations

Potential extensions (not implemented):

- **Log rotation by size**: Currently rotation is daily only
- **Structured query interface**: `clawperator logs --since 1h --level error`
- **Remote log aggregation**: Ship to external collector
- **Log compression**: Gzip old daily files automatically

These are intentionally deferred until concrete use cases emerge. The current design is sufficient for agent-driven debugging and operational visibility.

## Testing Strategy

The unified logging system has comprehensive unit tests covering:

1. **Level gating**: Events filtered by threshold
2. **Routing rules**: Correct destinations for each event category
3. **JSON mode cleanliness**: No terminal output when `--json` is active
4. **Fail-open behavior**: Single warning, then disabled logging
5. **Child loggers**: Context inheritance and isolation
6. **File rotation**: Daily path changes at midnight boundary

See `test/unit/unifiedLogger.test.ts` and `test/unit/logger.test.ts` for implementation.
