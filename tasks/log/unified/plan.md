# Unified Logging

## Executive Summary

Replace Clawperator's three independent logging surfaces (NDJSON file logger,
skill child-process terminal streaming, direct CLI/serve terminal output) with a
single `ClawperatorLogger` that centralizes routing decisions. The logger decides
what goes to file, what goes to the terminal, and what stays suppressed in JSON
mode - call sites stop branching independently.

2 PRs, 6 phases. PR-1 introduces the core logger and migrates skill and
execution flows. PR-2 migrates doctor and serve logging, adds
`clawperator logs --follow`, preserves SSE compatibility, updates durable docs,
and closes the validation matrix. Merge gate between PRs.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 2 |
| Total phases | 6 |
| Completed | 0 |
| Remaining | 1, 2, 3, 4, 5, 6 |
| Current / Next | 1 |
| Blockers | none |

## Goal

A single `ClawperatorLogger` contract that all Node layers (domain, CLI, skill
runner, serve) route through. After this work:

- Skill progress lines appear in the NDJSON log file alongside lifecycle events
- An agent reading the log file after a skill timeout can see which phase stalled
- `--log-level` controls file threshold; output mode (`pretty` vs `json`)
  controls terminal visibility
- No events are dropped - skill progress is captured even in JSON mode
- All events share a consistent `{event, ts, level, message, ...context}` schema
- `child(context)` propagates correlation IDs without manual threading
- The EventEmitter in `domain/observe/events.ts` remains as the SSE transport
  for this task; it is not conflated with the logger
- `clawperator logs --follow` dumps existing log content and then streams new
  lines in real time, so post-timeout diagnostics include the full context

## Why Now

The problem definition (`tasks/log/unified/problem-definition.md`) documents the
gap: when a skill times out, the NDJSON log shows `skills.run.start` and
`skills.run.timeout` but not the progress lines that would identify which phase
stalled. That context exists only in the terminal session, which may no longer be
available. The gap grows worse as skills become more complex and agents rely on
log files for post-run diagnostics.

## In Scope

- Design and implement the `ClawperatorLogger` interface and event schema
- Replace the existing `Logger` interface and `createLogger()` in `adapters/logger.ts`
- Add `child(defaultContext)` for correlation-ID propagation
- Capture skill child-process stdout/stderr as `skills.run.output` events in the log file
- Wire all domain-layer logging (runExecution, runSkill) through the unified logger
- Wire CLI terminal output (pre-run banner, doctor, validation) through the unified logger
- Migrate serve operational logging (startup, requests, errors, SSE lifecycle) through the unified logger
- Keep the EventEmitter in `domain/observe/events.ts` as a compatibility transport for SSE
- Add `clawperator logs --follow` command with `-f` alias
- Update public docs and internal design notes for the new logging behavior
- Maintain existing fail-open behavior
- Maintain JSON mode stdout cleanliness

## Out of Scope

- Removing or replacing the EventEmitter-based SSE transport in this task
- Adding a generic log-stream SSE surface
- Log forwarding to external systems (Datadog, CloudWatch, etc.)
- Log rotation, compression, or retention policies
- Structured logging protocol for skill scripts (they continue to emit plain text)
- Android-side logging changes
- Query or filter flags on `clawperator logs` beyond `--follow`
- Changes to the result envelope shape or terminal envelope protocol

## Existing Artifact Scope

| Artifact | Disposition |
| --- | --- |
| `adapters/logger.ts` | Replaced entirely with unified logger |
| `domain/observe/events.ts` | Preserved - kept as SSE transport; logger does not replace it |
| `cli/output.ts` | Preserved - `formatSuccess`/`formatError` stay; terminal write routing moves to logger |
| `domain/skills/runSkill.ts` | Modified - onOutput callback feeds `skills.run.output` events into logger |
| `domain/executions/runExecution.ts` | Modified - lifecycle logging routes through unified logger |
| `domain/doctor/DoctorService.ts` | Modified - doctor check events route through unified logger |
| `cli/commands/serve.ts` | Modified - operational logging through unified logger; SSE stays on EventEmitter |
| `cli/commands/skills.ts` | Modified - banner and onOutput routing go through logger |
| `cli/commands/doctor.ts` | Modified - terminal output goes through logger |
| `cli/index.ts` | Modified - `createLogger` replaced with `createClawperatorLogger` |
| `cli/registry.ts` | Modified - `logs` command added |

## Surfaces and Ownership

| Surface | Paths | Changes |
| --- | --- | --- |
| Node logger core | `apps/node/src/adapters/logger.ts` | Unified contract, event schema, sink routing, fail-open behavior |
| Node contracts | `apps/node/src/contracts/logging.ts` (new) | `LogEvent`, `LogLevel`, routing types |
| Skill execution and CLI | `apps/node/src/domain/skills/runSkill.ts`, `apps/node/src/cli/commands/skills.ts` | Capture skill progress in file; route banner through logger |
| Execution flows | `apps/node/src/domain/executions/runExecution.ts` | Lifecycle logging through unified logger |
| Doctor flows | `apps/node/src/domain/doctor/DoctorService.ts`, `apps/node/src/cli/commands/doctor.ts` | Doctor events through unified logger |
| Serve and SSE | `apps/node/src/cli/commands/serve.ts`, `apps/node/src/domain/observe/events.ts` | Operational logging through logger; EventEmitter preserved for SSE |
| Logs command | `apps/node/src/cli/commands/logs.ts` (new), `apps/node/src/cli/registry.ts` | New CLI command |
| Tests | `apps/node/src/test/` | Updated and new tests per phase |
| Public docs | `docs/`, `docs/internal/design/` | Logging behavior, `logs` command, design notes |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current logger shape and fail-open behavior | `apps/node/src/adapters/logger.ts`, `apps/node/src/test/unit/logger.test.ts` |
| Current EventEmitter and SSE transport | `apps/node/src/domain/observe/events.ts` |
| Skill progress capture and lifecycle events | `apps/node/src/domain/skills/runSkill.ts`, `apps/node/src/test/unit/skills.test.ts` |
| Skill CLI banner and terminal routing | `apps/node/src/cli/commands/skills.ts` |
| Execution lifecycle logging | `apps/node/src/domain/executions/runExecution.ts`, `apps/node/src/test/unit/runExecution.test.ts` |
| Doctor logging behavior | `apps/node/src/domain/doctor/DoctorService.ts`, `apps/node/src/cli/commands/doctor.ts` |
| Serve HTTP, SSE wiring, operational output | `apps/node/src/cli/commands/serve.ts`, `apps/node/src/test/integration/serve.test.ts` |
| CLI global flags and output constraints | `apps/node/src/cli/index.ts`, `apps/node/src/cli/output.ts`, `apps/node/src/cli/registry.ts` |
| Error codes and result envelope | `apps/node/src/contracts/errors.ts`, `apps/node/src/contracts/result.ts` |
| Repo operating rules | `CLAUDE.md` |

## Deterministic Versus Judgment

### Deterministic (use verbatim, do not re-derive)

- Event schema shape: `{event, ts, level, message, ...context}` - defined once in Phase 1
- Event routing rules: the routing table below is the single source of truth
- Log level threshold: numeric comparison using `LEVEL_ORDER`
- Terminal suppression in JSON mode: events with terminal destination are suppressed
  when output format is `json`
- File destination: all events at or above configured log level go to file
- Event naming: follow the naming table below; do not invent names outside this table
- `clawperator logs --follow` behavior: dump all existing lines from the current daily log file, then stream new lines as they arrive, exit on SIGINT
- SSE compatibility: EventEmitter stays, SSE event names stay, SSE payloads stay

### Judgment (requires human review)

- Exact human-readable `message` text for terminal rendering
- Module split under `apps/node/src/` as long as the public contract stays unchanged
- Whether additional events beyond the naming table are needed for edge cases discovered during implementation (add to the table if so)

## Decision Rules

### Explicit Assumptions

- No external system currently depends on the exact NDJSON event schema beyond this repo's tests, human operators, and ad hoc tooling.
- The daily NDJSON file remains the only persisted log destination.
- The existing SSE consumers care about `clawperator:result` and `clawperator:execution` payload compatibility more than immediate access to every logger event.
- The `clawperator logs` command is simple enough to include in this task without significant risk.

### Event routing table

Use this table verbatim. Do not re-derive routing rules.

| Event category | File destination | Terminal destination | Subscriber destination |
| --- | --- | --- | --- |
| Lifecycle (`skills.run.start`, `skills.run.complete`, `broadcast.dispatched`, etc.) | Yes, at configured level | No | No |
| Skill output (`skills.run.output`) | Yes, always at `info` level | No (terminal streaming handled by existing `onOutput` callback in `skills.ts`, not by the logger) | No |
| CLI terminal output (`cli.banner`, `cli.note`, `cli.validation`) | Yes, at `debug` level | Yes, respects output format | No |
| Doctor events (`doctor.check`) | Yes, at configured level | Yes, in pretty mode only | No |
| Execution lifecycle (`execution.*`) | Yes, at configured level | No | No |
| Serve operational (`serve.*`) | Yes, at configured level | No | No |

### Level threshold table

| Level | Numeric | Default file behavior |
| --- | --- | --- |
| debug | 0 | Written only if `--log-level debug` |
| info | 1 | Written by default |
| warn | 2 | Always written |
| error | 3 | Always written |

### Event naming table

Use only the names in this table. Do not invent new event families.

| Surface | Event names |
| --- | --- |
| Preserve as-is | `skills.run.start`, `skills.run.complete`, `skills.run.failed`, `skills.run.timeout`, `preflight.apk.pass`, `preflight.apk.missing`, `broadcast.dispatched`, `envelope.received`, `timeout.fired`, `doctor.check` |
| Add for skill child-process output | `skills.run.output` with `stream: "stdout" \| "stderr"` |
| Add for CLI informational lines | `cli.banner`, `cli.note`, `cli.validation`, `cli.doctor` |
| Add for serve operational logging | `serve.server.started`, `serve.http.request`, `serve.http.error`, `serve.sse.client.connected`, `serve.sse.client.disconnected`, `serve.sse.write_failed` |

### Logger interface

| Decision point | Required rule |
| --- | --- |
| Core contract | `ClawperatorLogger` with `emit(event)`, `child(defaultContext)`, and `logPath()` |
| `child()` behavior | Returns a new logger instance that merges `defaultContext` fields into every `emit()` call. Call sites use `child({ commandId, taskId, deviceId })` once, then `emit()` without repeating correlation IDs. |
| Event payload shape | Required fields: `ts`, `level`, `event`, `message`. Optional stable scalar fields: `commandId`, `taskId`, `deviceId`, `skillId`, `stream`, `status`, `durationMs`, `exitCode`. No index signature - use named fields only. |
| Sensitive payloads | Do not log raw execution payload JSON, skill arguments, snapshot text, screenshot bytes, full stdout dumps, or other large blobs. Preserve the current "no sentinel leakage" discipline. |
| File routing | Controlled by `--log-level` and `CLAWPERATOR_LOG_DIR`. Daily file naming and fail-open semantics unchanged. |
| Terminal routing | Controlled by output mode plus sink policy. JSON mode must not write non-result noise to stdout. Pretty mode renders selected events to stderr. |

### EventEmitter and SSE

| Decision point | Required rule |
| --- | --- |
| `domain/observe/events.ts` | Keep the EventEmitter in this task as a compatibility transport for SSE. |
| SSE payloads | `/events` continues emitting `clawperator:result` and `clawperator:execution` with current payload shapes. |
| Logger versus SSE | The unified logger logs serve lifecycle events. SSE continues streaming result/execution objects via EventEmitter. They are separate abstractions. |
| Why not unify now | The EventEmitter carries rich in-memory objects (`ResultEnvelope`, `RunExecutionResult`) that are not suitable for serialization through the NDJSON log path. Conflating them risks SSE payload regressions for no diagnostic gain. |
| Future migration | If later work wants a log-stream SSE surface, that is a separate task after unified logging proves stable. |

## Failure Modes To Prevent

1. **Skill progress reaches terminal but not the file.** The entire point of this task. Every `skills.run.output` event must hit the file sink regardless of terminal output mode.

2. **JSON mode stdout pollution.** The unified logger must never write to `process.stdout` in JSON mode. Terminal-destined events go to `process.stderr` in pretty mode and are suppressed in JSON mode. They still go to file.

3. **Sensitive payload leakage.** Do not log raw execution payloads, skill arguments, snapshot text, screenshot bytes, or full stdout dumps. Keep events compact and scalar.

4. **Fail-open violation.** If the log directory is unavailable, emit one stderr warning and continue. Events still route to terminal. Do not throw or crash.

5. **SSE regression.** The serve command's `/events` endpoint must continue to work with unchanged event names and payload shapes. Do not remove or conflate the EventEmitter.

6. **Event name collision.** Follow the naming table. Do not introduce `skill.progress` (breaks the `skills.run.*` family) or other ad-hoc names.

7. **Double-writing.** Events must not appear twice in the log file or terminal. The routing table is the single source of truth.

8. **Test staleness.** Tests exercise built `dist/` artifacts. Build before test. Never run build and test in parallel.

9. **Breaking the exit-code contract.** The `logs` command must exit 0 on clean interrupt. It must not alter exit codes for other commands.

## Output Contract

### ClawperatorLogger interface (design target)

```typescript
interface ClawperatorLogger {
  emit(event: LogEvent): void;
  child(defaultContext: Partial<LogEvent>): ClawperatorLogger;
  logPath(): string | undefined;
}
```

### LogEvent schema (design target)

```typescript
interface LogEvent {
  ts: string;           // ISO 8601
  level: LogLevel;
  event: string;        // dot-separated, from naming table
  message: string;      // human-readable summary
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

### NDJSON log file format

One JSON object per line. Same shape as `LogEvent`. No changes to file naming
or rotation. Daily files at `~/.clawperator/logs/clawperator-YYYY-MM-DD.log`.

### `clawperator logs --follow` output

Dumps all existing lines from the current daily log file, then streams new
lines as they arrive. This ensures that post-timeout diagnostics include the
already-written lifecycle and progress events. Exits cleanly on SIGINT with
code 0. No formatting or filtering in v1.

## Idempotency

Stable across reruns:
- Event names and schema fields
- Daily log path format and fail-open warning behavior
- JSON-mode suppression rules
- SSE event names and payload shapes
- `clawperator logs` behavior

Expected to vary:
- Timestamps, durations, device-specific IDs, and live log contents
- Exact human-facing message strings

Implementation reruns must not create duplicate routing rules or conflicting
event names. If a temporary shim is introduced in PR-1, PR-2 must either remove
it or explicitly leave it with tests and comments explaining why.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Logger contract, routing rules, and event schema | `apps/node/src/adapters/logger.ts` and `apps/node/src/contracts/logging.ts` (code) |
| Why EventEmitter remains separate from logger | `apps/node/src/domain/observe/events.ts` (code comment) and `docs/internal/design/` |
| Event naming rules | `apps/node/src/contracts/logging.ts` (code) |
| `clawperator logs` command reference | `apps/node/src/cli/registry.ts` (source of truth) and `docs/api/` |
| Logging behavior and configuration | `docs/` authored docs |
| Deferred work: EventEmitter-to-logger unification | `tasks/log/unified/finalization-items.md` (created during execution if needed) |
