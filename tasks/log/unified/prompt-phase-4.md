

**Phase 4: Add `clawperator logs` Command + Serve Stderr Fallbacks - Unified Logging Task (PR-2, part 2 of 4)**

You are executing Phase 4 of the unified logging task in the `feature/unified-logging-phase-2` branch. Phases 0-3 are complete. Your job has two parts: (A) fix a regression in serve.ts where operational errors are silently swallowed when no logger is passed, and (B) add the new `clawperator logs` CLI command.

**Before writing any code, read these files in this exact order. Read every one completely:**

1. `tasks/log/unified/plan.md` - the stable contract. Read the `clawperator logs` output section and the naming table.
2. `tasks/log/unified/work-breakdown.md` - read the Phase 4 section for step-by-step instructions.
3. `CLAUDE.md` - repo rules. Pay attention to the required iteration loop and CLI parsing requirements.
4. `apps/node/src/contracts/logging.ts` - the `LogEvent`, `ClawperatorLogger` types.
5. `apps/node/src/adapters/logger.ts` - the unified logger. Note the `expandHomePath`, `formatDate`, `formatLogPath` helpers - you may want to extract or reuse the log path resolution logic for the `logs` command.
6. `apps/node/src/cli/commands/serve.ts` - you will add stderr fallbacks here. Study lines 555, 572, 595, 604, 618, 642 - these are logger-only emit calls with no fallback when logger is undefined.
7. `apps/node/src/cli/registry.ts` - how commands are registered. Follow the existing pattern.
8. `apps/node/src/cli/index.ts` - how command handlers are wired. Follow the existing pattern.
9. a7b813c14f74003debecee3f9a884b75a4c494e8, which aimis to fix PART A below. Verify it works.

---

**PART A: Serve stderr fallbacks (do this first)**

Phase 3 replaced `console.error`/`console.warn` calls in `serve.ts` with `options.logger?.emit(...)`. This created a regression: when no logger is passed (which is valid - logger is optional), operational errors like SSE write failures, heartbeat failures, and the catch-all 500 handler are silently swallowed. The old code unconditionally warned on these. For a long-running server, swallowing operational errors is unacceptable.

**Fix:** Add `process.stderr.write(...)` fallbacks on every logger-only emit site in serve.ts that handles an error or warning. The pattern is:

```typescript
// BEFORE (silent when no logger):
options.logger?.emit({
  ts: new Date().toISOString(),
  level: "warn",
  event: "serve.sse.write_failed",
  message: `SSE write failed: ${String(err)}`,
});

// AFTER (always visible):
const msg = `SSE write failed: ${String(err)}`;
if (options.logger) {
  options.logger.emit({
    ts: new Date().toISOString(),
    level: "warn",
    event: "serve.sse.write_failed",
    message: msg,
  });
} else {
  process.stderr.write(`[clawperator] ${msg}\n`);
}
```

Apply this pattern to these sites in serve.ts (find them by looking for `options.logger?.emit` calls inside `catch` blocks and error handlers):

1. **SSE result write failure** (inside `onResult` catch block) - `serve.sse.write_failed`
2. **SSE execution write failure** (inside `onExecution` catch block) - `serve.sse.write_failed`
3. **SSE req error** handler - `serve.sse.write_failed`
4. **SSE res error** handler - `serve.sse.write_failed`
5. **SSE heartbeat failure** (inside heartbeat try/catch) - `serve.sse.write_failed`
6. **Express catch-all 500** error handler - `serve.http.error`

Do NOT add fallbacks on these sites (they are informational, not errors):
- `serve.sse.client.connected` - informational, fine to be silent without logger
- `serve.sse.client.disconnected` - informational, fine to be silent without logger
- `serve.http.request` middleware - already has a `console.log` fallback when verbose
- `serve.server.started` in the listen callback - already has a `process.stderr.write` fallback
- Startup error in `cmdServe` - already has a `process.stderr.write` fallback
- Verbose route listing - developer-only, fine to be silent without logger

Also add a one-line comment in the HTTP request middleware explaining the intent:

```typescript
// Log all requests when a logger is configured (filtered by log level at the file sink).
// Without a logger, fall back to console.log only when --verbose is set (legacy behavior).
```

**Commit this separately before starting Part B:**
```
fix(node): restore stderr fallbacks for serve error paths without logger
```

---

**PART B: Add `clawperator logs` command**

Follow the Phase 4 steps in `work-breakdown.md` exactly:

**Step 1: Create `apps/node/src/cli/commands/logs.ts`**

```typescript
export async function cmdLogs(options: { logDir?: string }): Promise<void>
```

Implementation:
- Resolve the log file path using the same logic as `createClawperatorLogger`: check `options.logDir`, then `process.env.CLAWPERATOR_LOG_DIR`, then default `~/.clawperator/logs`. Apply home directory expansion (`~` to `os.homedir()`). Format the daily filename as `clawperator-YYYY-MM-DD.log`.
- IMPORTANT: Do not import private helpers from `adapters/logger.ts`. Reimplement the path resolution or extract shared helpers into a new file (e.g., `apps/node/src/adapters/logPaths.ts`). The logger factory should not be a dependency of the logs command.
- Open the current daily log file.
- If the file does not exist, write a message to stderr (`No log file found at <path>\n`) and exit 0.
- Dump ALL existing content to stdout line by line.
- Then watch for new content and stream new lines to stdout as they arrive. Use `fs.watchFile` (poll-based, more reliable across platforms than `fs.watch`) or read on an interval. `fs.watchFile` with a 200-500ms poll interval is recommended.
- Handle SIGINT gracefully: stop the watcher, exit with code 0.
- Raw NDJSON lines on stdout. No formatting, no filtering, no colorizing. One line per event.
- No flags. No `--follow` flag. The command always dumps then streams.

**Step 2: Register in `apps/node/src/cli/registry.ts`**

Follow the existing pattern for command registration:
- Command name: `logs`
- Description: `Tail the Clawperator log file`
- No required arguments, no flags
- No device required

**Step 3: Wire the command handler**

Follow the existing dispatch pattern in `apps/node/src/cli/index.ts`. The `logs` command does not need a logger instance (it reads the log file directly) and does not need device options.

**Step 4: Write `apps/node/src/test/unit/logs.test.ts`**

Test cases:
- Log path resolution matches the logger's path logic (same env var, same default, same date format)
- Existing file content is dumped to stdout before streaming begins
- When the log file does not exist, a message is written to stderr and the command exits cleanly
- The command handles SIGINT gracefully

For testing the "dump existing then stream new" behavior:
1. Create a temp directory
2. Write some NDJSON lines to a file matching the expected daily filename
3. Call the logs command function with that directory
4. Verify the existing lines appear on stdout
5. Append a new line to the file
6. Verify the new line appears on stdout after a short delay
7. Clean up

**Step 5: Build and run tests**

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

**Step 6: Verify CLI integration**

```bash
# Help output should list the command
node apps/node/dist/cli/index.js --help | grep logs

# Run it - should dump existing log content then stream
node apps/node/dist/cli/index.js logs
# Press Ctrl+C after a few seconds - should exit cleanly with code 0
```

**Step 7: Device verification**

```bash
npm --prefix apps/node run build
export CLAWPERATOR_BIN="node $(pwd)/apps/node/dist/cli/index.js"
export CLAWPERATOR_OPERATOR_PACKAGE="com.clawperator.operator.dev"
export CLAWPERATOR_SKILLS_REGISTRY="$(cd ../clawperator-skills && pwd)/skills/skills-registry.json"

# Check devices - use physical device if both exist
node apps/node/dist/cli/index.js devices

# Run the climate skill to populate the log
node apps/node/dist/cli/index.js skills run \
  com.google.android.apps.chromecast.app.get-climate \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --format pretty -- "Office"

# Start logs in background - should dump existing events immediately
node apps/node/dist/cli/index.js logs > /tmp/clawperator-logs-phase4.txt &
LOGS_PID=$!
sleep 2

# Run a snapshot to generate new events
node apps/node/dist/cli/index.js snapshot \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --format json 2>/dev/null

sleep 2
kill "$LOGS_PID" 2>/dev/null

# Verify output contains both old and new events
echo "=== Lines captured ==="
wc -l /tmp/clawperator-logs-phase4.txt
echo "=== Event types ==="
cat /tmp/clawperator-logs-phase4.txt | python3 -c "
import sys, json, collections
counts = collections.Counter()
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try: counts[json.loads(line)['event']] += 1
    except: pass
for event, count in sorted(counts.items()):
    print(f'  {event}: {count}')
"
```

Verify:
- Already-written events appear immediately when `logs` starts (including `skills.run.output` from the climate skill run)
- New events from the snapshot appear in the captured output
- Clean exit on kill
- `--help` lists the `logs` command

---

**Rules you must not break:**

- Run `npm --prefix apps/node run build` BEFORE every `npm --prefix apps/node run test`. Never in parallel.
- Use the branch-local build (`node apps/node/dist/cli/index.js`), not the global `clawperator` binary.
- Use `--operator-package com.clawperator.operator.dev` on device.
- The `logs` command writes raw NDJSON to stdout. No formatting, no filtering.
- The `logs` command does not need or create a logger instance. It reads the file directly.
- SIGINT must exit with code 0.
- Do not add flags to the `logs` command. No `--follow`, no `--format`. Always dump-then-stream.

---

**Acceptance criteria (all must pass before commit):**

Part A:
- All serve.ts error/warning emit sites have stderr fallbacks when logger is undefined
- Startup message and startup error already had fallbacks (no change needed)
- SSE client connect/disconnect remain logger-only (informational, not errors)

Part B:
- `clawperator logs` dumps existing log content then streams new lines
- SIGINT exits cleanly with code 0
- `--help` shows the `logs` command
- Missing log file produces a stderr message and exits 0
- All tests pass: `npm --prefix apps/node run build && npm --prefix apps/node run test`
- Device verification shows both historical and live events

**Commit messages (two separate commits):**

```
fix(node): restore stderr fallbacks for serve error paths without logger
```

```
feat(node): add clawperator logs command
```

Do not push. After committing, update `tasks/log/unified/plan.md` and `tasks/log/unified/work-breakdown.md` status tables to mark Phase 4 as `[DONE]` and set Current/Next to Phase 5. Stop after that - do not proceed to Phase 5.