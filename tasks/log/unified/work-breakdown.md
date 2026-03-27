# Unified Logging Work Breakdown

Parent plan: `tasks/log/unified/plan.md`

## Executive Summary

2 PRs, 6 phases. PR-1 (phases 1-2) introduces the unified logger core and
migrates skill and execution flows. PR-2 (phases 3-6) migrates doctor and serve
logging, adds `clawperator logs --follow`, preserves SSE compatibility, updates
durable docs, and closes the validation matrix. Merge gate between PRs.

| PR | Phases | Agent tier | Purpose |
| --- | --- | --- | --- |
| PR-1 | 1, 2 | thinking, default | Core logger + skill/execution wiring |
| PR-2 | 3, 4, 5, 6 | default, default, default, default | Doctor/serve migration + logs command + docs + final validation |

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 6 |
| Completed | 0 |
| Remaining | 1, 2, 3, 4, 5, 6 |
| Current / Next | 1 |
| Blockers | none |

## Hard Rules

1. Do not start PR-2 until PR-1 is merged.
2. Build before test. Run `npm --prefix apps/node run build` before every `npm --prefix apps/node run test` invocation. Never run build and test in parallel.
3. One commit per phase. Do not batch unrelated changes.
4. The unified logger must never write to `process.stdout` in JSON output mode. Terminal-destined events go to `process.stderr` in pretty mode and are suppressed in JSON mode.
5. Preserve fail-open behavior: if the log directory is unavailable, emit one stderr warning and continue. Events still route to terminal.
6. Do not remove `domain/observe/events.ts`. The EventEmitter stays as the SSE transport.
7. Do not log raw execution payloads, skill arguments, snapshot text, screenshot bytes, full stdout dumps, or other large blobs. Keep events compact and scalar.
8. Use the branch-local build from `apps/node/` for all testing, not the globally installed `clawperator` binary.
9. When validating on a device, use the debug Operator APK with `--operator-package com.clawperator.operator.dev`.
10. Use the event routing table from `plan.md` verbatim. Do not re-derive routing rules.
11. Use the event naming table from `plan.md` verbatim. Do not invent event names outside that table.
12. Use the level threshold table from `plan.md` verbatim. Do not re-derive level semantics.
13. Do not edit `sites/docs/.build/` or `sites/docs/site/` directly. Author docs in `docs/`, then regenerate.
14. Never shorten `Clawperator` to `Claw` in code, docs, comments, or commit messages.
15. Update `tasks/log/unified/plan.md` Status section after each phase completes.
16. If the plan needs revision during execution, update `plan.md` first, then continue. Do not silently deviate.
17. After any phase that touches the Node layer, verify changes by running a real command against a connected Android device and inspecting the resulting log file. Do not rely solely on unit tests.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/log/unified/plan.md` | Stable contract: scope, routing table, event schema, naming table, failure modes |
| 2 | `tasks/log/unified/problem-definition.md` | Problem statement, constraints, and motivation |
| 3 | `CLAUDE.md` | Repo operating rules, required iteration loop, device-selection rules, docs obligations |
| 4 | `apps/node/src/adapters/logger.ts` | Current logger contract and fail-open semantics being replaced |
| 5 | `apps/node/src/domain/observe/events.ts` | EventEmitter transport - being preserved, not replaced |
| 6 | `apps/node/src/domain/skills/runSkill.ts` | Skill runner - primary consumer of logger, source of onOutput callbacks |
| 7 | `apps/node/src/cli/commands/skills.ts` | CLI skill command - banner output, onOutput terminal routing |
| 8 | `apps/node/src/domain/executions/runExecution.ts` | Execution lifecycle logging |
| 9 | `apps/node/src/cli/commands/serve.ts` | Serve operational output and SSE wiring |
| 10 | `apps/node/src/domain/doctor/DoctorService.ts` | Doctor logging behavior |
| 11 | `apps/node/src/cli/commands/doctor.ts` | Doctor CLI output |
| 12 | `apps/node/src/cli/index.ts` | CLI entry point - logger instantiation |
| 13 | `apps/node/src/cli/registry.ts` | Command registry - where `logs` command will be added |
| 14 | `apps/node/src/test/unit/logger.test.ts` | Existing logger test expectations |
| 15 | `apps/node/src/test/unit/skills.test.ts` | Existing skill test expectations |
| 16 | `.agents/skills/docs-author/SKILL.md` | Required workflow for docs phases |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Core unified logger + skill/execution wiring | 1, 2 | thinking, default | Tests pass; `skills.run.output` events appear in log file from a device run; JSON mode stdout is clean |
| PR-2 | Doctor/serve migration + logs command + docs + final validation | 3, 4, 5, 6 | default, default, default, default | Tests pass; SSE `/events` still works; `serve.*` events in log file; `clawperator logs -f` streams events; docs build succeeds; all smoke scripts pass |

---

## Phase 1: Unified Logger Core

### Agent Tier

thinking

### Goal

Design and implement the `ClawperatorLogger` contract, event schema types, and
sink-routing layer. Replace the current `Logger` interface. The new logger
handles file writing, terminal rendering, and fail-open behavior in one place.

### Files or Surfaces To Change

- `apps/node/src/contracts/logging.ts` (new - types and routing config)
- `apps/node/src/adapters/logger.ts` (replaced with unified implementation)
- `apps/node/src/cli/index.ts` (update logger instantiation)
- `apps/node/src/test/unit/logger.test.ts` (updated for new interface)
- `apps/node/src/test/unit/unifiedLogger.test.ts` (new - comprehensive tests)

### Steps

1. Read the required reading files in order.
2. Create `apps/node/src/contracts/logging.ts` with:
   - `LogLevel` type: `"debug" | "info" | "warn" | "error"`
   - `LEVEL_ORDER` map: `debug=0, info=1, warn=2, error=3`
   - `LogEvent` interface matching the schema in `plan.md`:
     ```typescript
     interface LogEvent {
       ts: string;
       level: LogLevel;
       event: string;
       message: string;
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
   - `ClawperatorLogger` interface:
     ```typescript
     interface ClawperatorLogger {
       emit(event: LogEvent): void;
       child(defaultContext: Partial<LogEvent>): ClawperatorLogger;
       logPath(): string | undefined;
     }
     ```
   - Routing rule types and `DEFAULT_ROUTING_RULES` constant implementing the
     routing table from `plan.md` as a first-match-wins prefix lookup:
     - `skills.run.output` -> file only (terminal streaming is handled by the existing `onOutput` callback in `skills.ts`, not by the logger)
     - `cli.` -> file + terminal, `terminalInJsonMode: false`
     - `doctor.` -> file + terminal, `terminalInJsonMode: false`
     - `serve.` -> file only
     - `*` (default) -> file only
3. Replace `apps/node/src/adapters/logger.ts` with the unified implementation:
   - `createClawperatorLogger(options)` factory accepting:
     - `logDir?: string` (same env/default behavior as current)
     - `logLevel?: string` (file threshold)
     - `outputFormat?: "json" | "pretty"` (controls terminal routing)
   - `emit(event)`:
     - Merge any `child()` default context into the event
     - Resolve routing via first-match-wins on `event.event` prefix
     - If file destination: check level threshold, write NDJSON line via `appendFileSync`
     - If terminal destination and `outputFormat !== "json"`: write `event.message` to `process.stderr`
     - If file write fails: emit one stderr warning, set `fileDisabled = true`, continue
   - `child(defaultContext)`: return a new logger that merges context into every `emit()` call
   - `logPath()`: return current log file path or `undefined` if disabled
   - Re-export `ClawperatorLogger` as `Logger` and `createClawperatorLogger` as `createLogger` for compatibility during migration
4. Update `apps/node/src/cli/index.ts`:
   - Replace `createLogger` call with `createClawperatorLogger`
   - Pass `outputFormat` from parsed global options
5. Write `apps/node/src/test/unit/unifiedLogger.test.ts`:
   - File routing: events at or above threshold written to file
   - File routing: events below threshold not written
   - Routing: `skills.run.output` goes to file only, not terminal (terminal streaming is handled by the `onOutput` callback in `skills.ts`)
   - Terminal routing: `cli.banner` appears on stderr in pretty mode
   - Terminal routing: `cli.banner` does NOT appear on stderr in JSON mode
   - `child()`: context merging works correctly, does not mutate parent
   - Fail-open: when log dir is not writable, file disabled but terminal still works
   - `logPath()` returns expected daily path or undefined when disabled
   - Routing: `serve.*` events go to file only, not terminal
   - No sensitive payload test: verify large objects are not accepted by `LogEvent` type
6. Update existing `logger.test.ts` to work with the compatibility re-exports.
7. Build and run tests.
8. **Device verification**: Run a snapshot command on a connected device and verify
   the log file is still written in the same location with valid NDJSON:
   ```bash
   npm --prefix apps/node run build
   node apps/node/dist/cli/index.js snapshot \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --format json
   LOG_PATH="${CLAWPERATOR_LOG_DIR:-$HOME/.clawperator/logs}/clawperator-$(date +%F).log"
   tail -n 10 "$LOG_PATH"
   ```

### Acceptance Criteria

- `contracts/logging.ts` exports `LogEvent`, `LogLevel`, `ClawperatorLogger`, and `DEFAULT_ROUTING_RULES`
- `adapters/logger.ts` exports `createClawperatorLogger` and compatibility aliases
- `child()` propagates context without mutating parent
- File logging preserves daily naming, `CLAWPERATOR_LOG_DIR`, and fail-open behavior
- JSON mode never writes to stdout
- All tests pass
- `npm --prefix apps/node run build && npm --prefix apps/node run test` succeeds
- Device verification confirms log file is still written correctly

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

Device verification (see step 8 above).

### Expected Commit

```text
refactor(node): add unified logger core with routing and child context

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 2: Skill and Execution Migration

### Agent Tier

default

### Goal

Route `skills run` banner output, skill child-process stdout/stderr, and
execution lifecycle events through the unified logger. Skill progress must appear
in the NDJSON log file while preserving pretty-mode terminal streaming and JSON
mode stdout cleanliness.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/domain/executions/runExecution.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `apps/node/src/test/unit/runExecution.test.ts`

### Steps

1. Update `apps/node/src/domain/skills/runSkill.ts`:
   - Change `SkillRunCallbacks.logger` type to `ClawperatorLogger`
   - In the `onOutput` callback handling within `runSkill`, emit `skills.run.output`
     events through the logger for every child-process chunk:
     ```typescript
     callbacks?.logger?.emit({
       ts: new Date().toISOString(),
       level: "info",
       event: "skills.run.output",
       message: chunk,
       skillId,
       stream, // "stdout" or "stderr"
     });
     ```
   - Keep existing lifecycle events (`skills.run.start`, `skills.run.complete`,
     `skills.run.failed`, `skills.run.timeout`) but route through `logger.emit()`
     instead of `logger.log()`. Preserve the same event names.
   - The `onOutput` callback parameter on `SkillRunCallbacks` stays for callers
     that need raw output (e.g., the skill run result accumulates full stdout).
     The logger captures it additionally for the log file.
2. Update `apps/node/src/cli/commands/skills.ts`:
   - Replace the pre-run banner `process.stdout.write(...)` with:
     ```typescript
     logger.emit({
       ts: new Date().toISOString(),
       level: "debug",
       event: "cli.banner",
       message: bannerText,
     });
     ```
   - The `onOutput` callback in `cmdSkillsRun` for pretty mode should continue
     to call the existing `process.stdout.write`/`process.stderr.write` for direct
     terminal streaming (this is the interactive experience). The logger captures
     it separately via `skills.run.output` events in `runSkill`. Do not remove the
     direct write - both paths serve different purposes.
   - For JSON mode: the `onOutput` callback is already not wiring terminal output.
     The logger still captures `skills.run.output` to file via the routing table.
   - Replace validation info `process.stderr.write` calls with `cli.validation`
     logger events.
3. Update `apps/node/src/domain/executions/runExecution.ts`:
   - Existing `logger.log()` calls become `logger.emit()` calls with the preserved
     event names from the naming table.
   - Do not change `emitResult()` or `emitExecution()` calls - the EventEmitter
     stays for SSE. Both the logger emit and the EventEmitter emit happen for
     execution completions.
4. Update `apps/node/src/test/unit/skills.test.ts`:
   - Verify `skills.run.output` events are emitted through the logger
   - Verify pretty mode banner still appears
   - Verify JSON mode stdout remains clean
   - Verify lifecycle events still use correct names
5. Update `apps/node/src/test/unit/runExecution.test.ts`:
   - Verify execution events route through unified logger
   - Verify EventEmitter `emitResult`/`emitExecution` still fires
6. Build and run tests.
7. **Device verification**: Run a skill on a connected device, inspect the log file:
   ```bash
   npm --prefix apps/node run build
   node apps/node/dist/cli/index.js skills run <skill_id> \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --format pretty --log-level debug
   LOG_PATH="${CLAWPERATOR_LOG_DIR:-$HOME/.clawperator/logs}/clawperator-$(date +%F).log"
   tail -n 40 "$LOG_PATH"
   # Verify skills.run.output events appear
   grep '"event":"skills.run.output"' "$LOG_PATH" | tail -5
   # Verify JSON mode is clean
   node apps/node/dist/cli/index.js skills run <skill_id> \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --format json 2>/dev/null | python3 -m json.tool
   ```
   Verify:
   - `skills.run.output` events appear in the log file with skill output text
   - `skills.run.start` and `skills.run.complete` lifecycle events appear
   - Pretty mode terminal still shows skill output interactively
   - JSON mode stdout is valid JSON with no interleaved log lines

### Acceptance Criteria

- `skills.run.output` events appear in the NDJSON log file for every skill output chunk
- Existing lifecycle event names are preserved
- Pretty mode terminal streaming is unchanged
- JSON mode stdout is clean
- EventEmitter `emitResult`/`emitExecution` still fires for execution events
- CLI banner appears in log file as `cli.banner` at debug level
- All tests pass

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

Device verification (see step 7 above).

### Expected Commit

```text
feat(node): route skill output and execution events through unified logger

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 3: Doctor and Serve Migration

### Agent Tier

default

### Goal

Route doctor check events and serve operational logging through the unified
logger while preserving SSE compatibility via the EventEmitter.

### Files or Surfaces To Change

- `apps/node/src/domain/doctor/DoctorService.ts`
- `apps/node/src/cli/commands/doctor.ts`
- `apps/node/src/cli/commands/serve.ts`
- `apps/node/src/domain/observe/events.ts` (add explanatory comment, do not remove)
- `apps/node/src/test/unit/doctor/DoctorService.test.ts`
- `apps/node/src/test/integration/serve.test.ts`

### Steps

1. Update `apps/node/src/domain/doctor/DoctorService.ts`:
   - Route doctor check events through the logger as `doctor.check` events
   - Use `child({ commandId: "doctor" })` for context propagation
2. Update `apps/node/src/cli/commands/doctor.ts`:
   - Route pretty-mode diagnostic output through logger as `cli.doctor` events
   - Route informational notes through `cli.note`
3. Update `apps/node/src/cli/commands/serve.ts`:
   - Replace `console.log` for startup line with `logger.emit()` as `serve.server.started`
   - Replace verbose `console.log` for request logging with `serve.http.request`
   - Replace `console.error` calls with `serve.http.error`
   - Replace SSE client connect/disconnect/error console writes with `serve.sse.*` events
   - Keep the EventEmitter-based SSE wiring unchanged. The `clawperatorEvents.on(...)` calls in the `/events` handler stay as-is.
   - Keep the SSE event names (`clawperator:result`, `clawperator:execution`) unchanged
4. Add an explanatory comment in `apps/node/src/domain/observe/events.ts`:
   ```typescript
   /**
    * EventEmitter-based SSE transport. Intentionally separate from ClawperatorLogger.
    * The logger handles file and terminal routing; this emitter carries rich in-memory
    * objects (ResultEnvelope, RunExecutionResult) to SSE clients. See
    * docs/internal/design/ for rationale.
    */
   ```
5. Update `apps/node/src/test/unit/doctor/DoctorService.test.ts`:
   - Verify doctor events route through unified logger
   - Verify event names match `doctor.check`
6. Update `apps/node/src/test/integration/serve.test.ts`:
   - Verify SSE still works with current payloads
   - Verify serve startup and request events appear in log file
7. Build and run tests.
8. **Device verification**: Run doctor and serve commands, verify logging:
   ```bash
   npm --prefix apps/node run build
   # Doctor
   node apps/node/dist/cli/index.js doctor \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --format pretty --log-level debug
   LOG_PATH="${CLAWPERATOR_LOG_DIR:-$HOME/.clawperator/logs}/clawperator-$(date +%F).log"
   grep '"event":"doctor.check"' "$LOG_PATH" | tail -5
   grep '"event":"cli.' "$LOG_PATH" | tail -5
   # Serve + SSE
   node apps/node/dist/cli/index.js serve --host 127.0.0.1 --port 3401 --log-level debug &
   SERVER_PID=$!
   sleep 1
   curl -N http://127.0.0.1:3401/events > /tmp/clawperator-sse.log &
   SSE_PID=$!
   sleep 1
   curl -s -X POST http://127.0.0.1:3401/snapshot \
     -H 'Content-Type: application/json' \
     -d '{"deviceId":"<device_serial>","operatorPackage":"com.clawperator.operator.dev"}'
   sleep 2
   kill "$SSE_PID" 2>/dev/null
   kill "$SERVER_PID" 2>/dev/null
   grep '"event":"serve\.' "$LOG_PATH" | tail -5
   grep 'clawperator:result\|clawperator:execution' /tmp/clawperator-sse.log
   ```
   Verify:
   - `doctor.check` events in log file
   - `serve.*` events in log file
   - SSE events arrive with unchanged names and payloads

### Acceptance Criteria

- Doctor events route through unified logger as `doctor.check`
- Serve operational logging uses `serve.*` events, no more `console.log`/`console.error`
- EventEmitter-based SSE wiring is unchanged
- SSE `/events` endpoint still streams `clawperator:result` and `clawperator:execution`
- `domain/observe/events.ts` has an explanatory comment about separation rationale
- All tests pass

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

Device verification (see step 8 above).

### Expected Commit

```text
feat(node): route doctor and serve logging through unified logger

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 4: Add `clawperator logs` Command

### Agent Tier

default

### Goal

Add a new `clawperator logs` command with `--follow` (`-f`) flag that dumps the
current daily log file and then streams new lines as they arrive.

### Files or Surfaces To Change

- `apps/node/src/cli/commands/logs.ts` (new)
- `apps/node/src/cli/registry.ts` (register command)
- `apps/node/src/cli/index.ts` (add handler if needed by registry pattern)
- `apps/node/src/test/unit/logs.test.ts` (new)

### Steps

1. Create `apps/node/src/cli/commands/logs.ts`:
   - `cmdLogs(options: { follow: boolean; logDir?: string })`:
     - Resolve log file path using same logic as `createClawperatorLogger`
       (env var `CLAWPERATOR_LOG_DIR`, default `~/.clawperator/logs`)
     - If `--follow` is not set:
       - Print the log file path to stdout as JSON: `{"logPath": "<path>"}`
       - Exit 0
     - If `--follow` is set:
       - Open the current daily log file
       - Dump all existing content to stdout first (this ensures post-timeout
         diagnostics include already-written lifecycle and progress events)
       - Then watch for new lines and stream them to stdout as they arrive
       - Use `fs.watch` or poll-based tail for new line detection
       - Handle SIGINT gracefully: close the watcher, exit 0
     - Raw NDJSON lines. No formatting or filtering in v1.
2. Register in `apps/node/src/cli/registry.ts`:
   - Command name: `logs`
   - Flags: `--follow` (boolean), `-f` (alias for `--follow`)
   - Description: `Show or tail the Clawperator log file`
   - No device required
3. Wire the command handler following existing patterns in `index.ts` or the
   registry dispatch.
4. Write `apps/node/src/test/unit/logs.test.ts`:
   - Log path resolution matches logger path logic
   - Without `--follow`: outputs JSON with logPath
   - With `--follow`: existing file content is dumped before streaming new lines
   - CLI flag parsing: `--follow` and `-f` both work
   - Invalid flags produce error
5. Add CLI regression tests for:
   - `clawperator logs` (no flags) - outputs log path JSON
   - `clawperator logs --follow` - dumps existing content then tails
   - `clawperator logs -f` - alias works
   - `clawperator logs --unknown-flag` - exits with error
6. Build and run tests.
7. **Device verification**: Run a skill first (to populate the log file), then
   start `logs --follow` and verify it shows the already-written events plus
   streams new ones:
   ```bash
   npm --prefix apps/node run build
   # First, run a skill to populate the log file
   node apps/node/dist/cli/index.js skills run <skill_id> \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --format pretty
   # Now start logs --follow - it should dump existing events first
   # Terminal 1: tail logs (should see already-written events immediately)
   node apps/node/dist/cli/index.js logs --follow &
   LOGS_PID=$!
   sleep 2
   # Terminal 2: run another skill
   node apps/node/dist/cli/index.js skills run <skill_id> \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --format pretty
   sleep 2
   kill "$LOGS_PID" 2>/dev/null
   ```
   Verify:
   - Already-written events appear immediately when `--follow` starts
   - New events from the second skill run stream in real time
   - Clean exit on kill/SIGINT
   - `clawperator --help` lists the `logs` command

### Acceptance Criteria

- `clawperator logs` outputs JSON with the log file path
- `clawperator logs --follow` dumps existing log content then streams new lines
- `clawperator logs -f` is an alias for `--follow`
- SIGINT exits cleanly with code 0
- `--help` shows the `logs` command
- Invalid flags produce error with non-zero exit code
- All tests pass

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
node apps/node/dist/cli/index.js logs
node apps/node/dist/cli/index.js --help | grep logs
```

Device verification (see step 7 above).

### Expected Commit

```text
feat(node): add `clawperator logs` command with --follow support

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 5: Docs and Design Notes

### Agent Tier

default

### Goal

Update authored docs and add internal design notes for the unified logging
behavior, the `clawperator logs` command, and the EventEmitter separation
rationale.

### Files or Surfaces To Change

- `docs/` (authored documentation)
- `docs/internal/design/` (internal design note)
- `sites/docs/source-map.yaml` (if new pages added)
- `sites/docs/mkdocs.yml` (if new pages added)
- `sites/docs/.build/` (regenerated, not hand-edited)

### Steps

1. Read `.agents/skills/docs-author/SKILL.md` for the documentation authoring
   workflow. Use it for this phase. Do not restate that workflow here.
2. Update or create authored docs for:
   - Logging behavior: where logs are written, NDJSON format, log levels,
     `CLAWPERATOR_LOG_DIR` and `CLAWPERATOR_LOG_LEVEL` env vars
   - `clawperator logs` command: usage, `--follow` flag, examples
   - Event naming conventions
3. Add an internal design note at `docs/internal/design/unified-logging.md`:
   - Unified logger contract and routing rules
   - Why EventEmitter remains separate from the logger
   - Why `clawperator logs` is file-based (not a live logger subscriber)
   - Deferred work: EventEmitter-to-logger unification
4. Verify `apps/node/src/cli/registry.ts` is the source of truth for the
   `logs` command reference. Confirm the docs-build skill extracts it correctly.
5. Regenerate docs:
   ```bash
   ./scripts/docs_build.sh
   ```
6. Verify docs build succeeds end to end.
7. Commit authored docs and regenerated output together.

### Acceptance Criteria

- Logging behavior documented in `docs/`
- `clawperator logs` command documented
- Internal design note exists at `docs/internal/design/unified-logging.md`
- Design note explains EventEmitter separation rationale
- `./scripts/docs_build.sh` succeeds
- No broken links in generated docs

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(node): document unified logging and clawperator logs command

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 6: Final Validation Matrix

### Agent Tier

default

### Goal

Run the full validation suite against a connected Android device. Verify all
logging surfaces work correctly together. Fix any issues found.

### Files or Surfaces To Change

- Any files needing fixes discovered during validation
- No new files expected

### Steps

1. Connect an Android device (or start an emulator). Check connectivity:
   ```bash
   npm --prefix apps/node run build
   node apps/node/dist/cli/index.js devices
   ```
2. Run the CLAUDE.md required iteration loop:
   ```bash
   ./gradlew app:assembleDebug
   ./gradlew app:testDebugUnitTest
   npm --prefix apps/node run build && npm --prefix apps/node run test
   ```
3. Run smoke scripts:
   ```bash
   ./scripts/clawperator_smoke_core.sh
   ./scripts/clawperator_smoke_skills.sh
   ```
4. Verify the complete logging flow end-to-end:
   - Start `clawperator logs --follow` in Terminal 1
   - Run `clawperator snapshot` in Terminal 2
   - Run `clawperator skills run <skill_id>` in Terminal 3
   - Verify Terminal 1 shows all expected event types:
     - `skills.run.start`, `skills.run.output`, `skills.run.complete`
     - Execution lifecycle events
   - Validate every line in the log file is valid NDJSON with required fields:
     ```bash
     LOG_PATH="${CLAWPERATOR_LOG_DIR:-$HOME/.clawperator/logs}/clawperator-$(date +%F).log"
     python3 -c "
     import sys, json
     for i, line in enumerate(open('$LOG_PATH'), 1):
         line = line.strip()
         if not line: continue
         try:
             obj = json.loads(line)
             for field in ('ts', 'level', 'event', 'message'):
                 assert field in obj, f'Line {i}: missing {field}'
         except json.JSONDecodeError as e:
             print(f'Line {i}: invalid JSON: {e}')
             sys.exit(1)
     print(f'All {i} lines valid')
     "
     ```
5. Verify SSE still works:
   ```bash
   node apps/node/dist/cli/index.js serve --host 127.0.0.1 --port 3405 --log-level debug &
   SERVER_PID=$!
   sleep 1
   curl -N http://127.0.0.1:3405/events > /tmp/clawperator-sse-final.log &
   SSE_PID=$!
   sleep 1
   curl -s -X POST http://127.0.0.1:3405/snapshot \
     -H 'Content-Type: application/json' \
     -d '{"deviceId":"<device_serial>","operatorPackage":"com.clawperator.operator.dev"}'
   sleep 2
   kill "$SSE_PID" 2>/dev/null
   kill "$SERVER_PID" 2>/dev/null
   grep 'clawperator:result\|clawperator:execution' /tmp/clawperator-sse-final.log
   ```
6. Verify JSON mode cleanliness:
   ```bash
   node apps/node/dist/cli/index.js snapshot \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --format json 2>/dev/null | python3 -m json.tool
   ```
   Must produce valid JSON with no interleaved log output.
7. Verify no sensitive payloads leaked:
   ```bash
   # Check log file does not contain raw execution payloads or large blobs
   python3 -c "
   import json
   for i, line in enumerate(open('$LOG_PATH'), 1):
       line = line.strip()
       if not line: continue
       obj = json.loads(line)
       msg_len = len(obj.get('message', ''))
       if msg_len > 2000:
           print(f'WARNING: Line {i} event={obj[\"event\"]} has message of {msg_len} chars - possible payload leak')
   print('Payload leak check complete')
   "
   ```
8. Fix any issues found. Each fix gets its own commit with a descriptive message.
9. If no fixes needed, skip the commit and note in plan.md Status that Phase 6
   passed without changes.

### Acceptance Criteria

- Android assemble and unit tests pass
- Node build and tests pass
- Core and skills smoke scripts pass
- All event types appear correctly in the log file
- Every log line is valid NDJSON with required fields
- SSE streaming works with unchanged event names and payloads
- JSON mode stdout is clean
- `clawperator logs --follow` streams events in real time
- No sensitive payload leaks in log file
- Docs build succeeds

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
./scripts/clawperator_smoke_core.sh
./scripts/clawperator_smoke_skills.sh
./scripts/docs_build.sh
```

Plus manual device verification described in steps 4-7.

### Expected Commit

```text
fix(node): address issues found during unified logging validation

Co-Authored-By: Claude <noreply@anthropic.com>
```

If no fixes needed, skip this commit.
