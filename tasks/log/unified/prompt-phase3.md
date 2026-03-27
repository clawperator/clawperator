Now I have the full picture. Here's the prompt:

---

**Phase 3: Doctor and Serve Migration - Unified Logging Task (PR-2, part 1 of 4)**

You are executing Phase 3 of the unified logging task in the `feature/unified-logging-phase-2` branch (cut from `main` at `2586f04`). Phases 0-2 (PR-1) are already merged. Your job is to route doctor and serve logging through the unified logger.

**Before writing any code, read these files in this exact order. Read every one completely:**

1. `tasks/log/unified/plan.md` - the stable contract. Focus on the routing table, the naming table, and the expected log output sections for doctor and serve events.
2. `tasks/log/unified/work-breakdown.md` - read the Phase 3 section for step-by-step instructions.
3. `CLAUDE.md` - repo rules. Pay attention to the required iteration loop.
4. `apps/node/src/contracts/logging.ts` - the `LogEvent`, `LogLevel`, `ClawperatorLogger` types and the routing rules. Note: `doctor.` events route to file only (not terminal). `serve.` events route to file only.
5. `apps/node/src/adapters/logger.ts` - the unified logger. `emit()` is the primary method. `log()` is a compat shim that does the same thing. Use `emit()` for all new code.
6. `apps/node/src/domain/doctor/DoctorService.ts` - currently calls `logger?.log({...})` in `finalize()` method (around line 134). You will change this to `emit()`.
7. `apps/node/src/cli/commands/doctor.ts` - renders pretty-mode output. Has access to `logger`. You will add `cli.doctor` events here.
8. `apps/node/src/cli/commands/serve.ts` - has many `console.log` and `console.error` calls scattered throughout. You will replace them with logger emit calls. The file already has `logger?: Logger` in `ServeOptions` (line 24).
9. `apps/node/src/domain/observe/events.ts` - the EventEmitter. You will add an explanatory comment but CHANGE NOTHING ELSE in this file.
10. `apps/node/src/test/unit/doctor/DoctorService.test.ts` - existing doctor tests including logger verification.
11. `apps/node/src/test/integration/serve.test.ts` - existing SSE integration tests.

---

**What to change - 5 files plus 1 comment-only change:**

**File 1: `apps/node/src/domain/doctor/DoctorService.ts`**

In the `finalize()` method (around line 134), change `logger?.log({...})` to `logger?.emit({...})`. The event structure stays exactly the same - same event name `doctor.check`, same level mapping, same message format. This is a one-word change: `log` becomes `emit`.

Before:
```typescript
logger?.log({
  ts: new Date().toISOString(),
  level: check.status === "fail" ? "error" : check.status === "warn" ? "warn" : "info",
  event: "doctor.check",
  deviceId: config.deviceId,
  message: `${check.id} status=${check.status}${check.code ? ` code=${check.code}` : ""}${check.summary ? ` ${check.summary}` : ""}`,
});
```

After:
```typescript
logger?.emit({
  ts: new Date().toISOString(),
  level: check.status === "fail" ? "error" : check.status === "warn" ? "warn" : "info",
  event: "doctor.check",
  deviceId: config.deviceId,
  message: `${check.id} status=${check.status}${check.code ? ` code=${check.code}` : ""}${check.summary ? ` ${check.summary}` : ""}`,
});
```

**File 2: `apps/node/src/cli/commands/doctor.ts`**

The doctor command already renders a pretty report via `renderPrettyDoctorReport()`. It does NOT double-print check results to the terminal - the pretty renderer handles that. No `cli.doctor` terminal routing is needed because `doctor.` events are file-only per the routing table. The existing code is already correct for this - doctor checks go to the log file via `DoctorService.finalize()`.

However, if the doctor command has any direct `process.stderr.write` or `process.stdout.write` calls for informational notes (like tips or hints), wrap those in `cli.note` logger events. Check the file and act accordingly. If there are no such calls, skip this file.

**File 3: `apps/node/src/cli/commands/serve.ts`**

This is the biggest change. Replace all `console.log` and `console.error` calls with logger emit calls. The file already has `logger?: Logger` in `ServeOptions` (line 24).

Here are the exact replacements:

| Line | Current | Replace with |
|------|---------|-------------|
| 33 | `console.error(\`❌ Failed to start server: ${String(e)}\`)` | `options.logger?.emit({ ts: new Date().toISOString(), level: "error", event: "serve.server.error", message: \`Failed to start server: ${String(e)}\` })` — BUT also keep a stderr fallback so the user sees the fatal error even without a logger: `process.stderr.write(\`Failed to start server: ${String(e)}\n\`)` |
| 45 | `console.log(\`[HTTP] ${req.method} ${req.url}\`)` | `if (options.logger) { options.logger.emit({ ts: new Date().toISOString(), level: "debug", event: "serve.http.request", message: \`${req.method} ${req.url}\` }); } else if (options.verbose) { console.log(\`[HTTP] ${req.method} ${req.url}\`); }` |
| 533 | `console.error(\`⚠️ SSE write failed: ${String(err)}\`)` | `options.logger?.emit({ ts: new Date().toISOString(), level: "warn", event: "serve.sse.error", message: \`SSE write failed: ${String(err)}\` })` |
| 545 | `console.error(\`⚠️ SSE execution write failed: ${String(err)}\`)` | `options.logger?.emit({ ts: new Date().toISOString(), level: "warn", event: "serve.sse.error", message: \`SSE execution write failed: ${String(err)}\` })` |
| 555 | `console.warn(\`[HTTP] SSE req error: ${String(err)}\`)` | `options.logger?.emit({ ts: new Date().toISOString(), level: "debug", event: "serve.sse.error", message: \`SSE req error: ${String(err)}\` })` |
| 559 | `console.warn(\`[HTTP] SSE res error: ${String(err)}\`)` | `options.logger?.emit({ ts: new Date().toISOString(), level: "debug", event: "serve.sse.error", message: \`SSE res error: ${String(err)}\` })` |
| 568 | `console.error(\`⚠️ SSE heartbeat failed: ${String(err)}\`)` | `options.logger?.emit({ ts: new Date().toISOString(), level: "warn", event: "serve.sse.error", message: \`SSE heartbeat failed: ${String(err)}\` })` |
| 587 | `console.error(\`[HTTP] Unhandled error: ${String(err)}\`)` | `options.logger?.emit({ ts: new Date().toISOString(), level: "error", event: "serve.http.error", message: \`Unhandled error: ${String(err)}\` })` |
| 595 | `console.log(\`🚀 Clawperator API server listening...\`)` | `const startupMessage = \`Clawperator API server listening on http://${options.host}:${actualPort}\`; options.logger?.emit({ ts: new Date().toISOString(), level: "info", event: "serve.server.started", message: startupMessage }); process.stderr.write(\`${startupMessage}\n\`);` — The startup message should ALWAYS print to stderr so operators see it, even though it also goes to the log file. |
| 597-604 | verbose route listing `console.log(...)` | `if (options.verbose) { const routes = ["/devices", "/execute", ...]; for (const r of routes) { options.logger?.emit({ ts: new Date().toISOString(), level: "debug", event: "serve.server.started", message: r }); } }` — OR simpler: just keep these as-is if verbose mode is enabled. These are developer-facing route listings, not operational events. Use your judgment - if you keep them as console.log, that's acceptable for verbose-only developer output. |

**IMPORTANT for serve.ts:** The SSE wiring (lines 515-571) must NOT change functionally. The `clawperatorEvents.on(...)` listeners, the `res.write(...)` SSE format, the event names (`clawperator:result`, `clawperator:execution`), and the cleanup handlers must all remain exactly as they are. You are only replacing the `console.error` calls inside the catch blocks of those handlers.

**IMPORTANT for serve.ts:** To access `options.logger` inside the request middleware (line 43), you need `options` to be in scope. It already is - `startServer` receives `options` as a parameter and the middleware is defined inside that function. No refactoring needed.

**File 4: `apps/node/src/domain/observe/events.ts`**

Add this comment block before the existing code. Do not change any code:

```typescript
/**
 * EventEmitter-based SSE transport. Intentionally separate from ClawperatorLogger.
 * The logger handles file and terminal routing; this emitter carries rich in-memory
 * objects (ResultEnvelope, RunExecutionResult) to SSE clients. See
 * docs/internal/design/ for rationale.
 */
```

**File 5: `apps/node/src/test/unit/doctor/DoctorService.test.ts`**

The existing logging tests (around lines 242-279) verify `doctor.check` entries. After changing `log` to `emit` in DoctorService, update the test expectations if they reference the `log` method name. Check if tests use a mock or spy on `log()` - if so, update to spy on `emit()` instead. If they use `createLogger()` and read the file, they should still work without changes (since `log` delegates to `emit`).

**File 6: `apps/node/src/test/integration/serve.test.ts`**

Add a test verifying that `serve.server.started` appears in the log file after server startup. You can do this by:
1. Creating a logger with a temp log directory
2. Starting the server with that logger
3. Reading the log file and checking for `serve.server.started` event
4. Shutting down the server

Also verify the existing SSE test still passes unchanged.

---

**Rules you must not break:**

- Run `npm --prefix apps/node run build` BEFORE every `npm --prefix apps/node run test`. Never in parallel. Never skip the build step.
- Do not modify the EventEmitter code in `events.ts` beyond adding the comment.
- Do not change SSE event names (`clawperator:result`, `clawperator:execution`).
- Do not change the `clawperatorEvents.on(...)` or `clawperatorEvents.off(...)` wiring in serve.ts.
- Use `emit()` not `log()` for all new and changed code.
- Use the branch-local build (`node apps/node/dist/cli/index.js`), not the global `clawperator` binary.
- Use `--operator-package com.clawperator.operator.dev` on device.
- Do not use emojis in log messages. Strip them when replacing console calls (e.g., `🚀`, `⚠️`, `❌`).

---

**After all tests pass, verify on a real device:**

```bash
npm --prefix apps/node run build

# Check devices - use physical device if both exist
node apps/node/dist/cli/index.js devices

# 1. Doctor verification
node apps/node/dist/cli/index.js doctor \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --format pretty --log-level debug

LOG_PATH="${CLAWPERATOR_LOG_DIR:-$HOME/.clawperator/logs}/clawperator-$(date +%F).log"
echo "=== doctor.check events ==="
grep '"event":"doctor.check"' "$LOG_PATH" | tail -5

# 2. Serve + SSE verification
node apps/node/dist/cli/index.js serve --host 127.0.0.1 --port 3401 --log-level debug &
SERVER_PID=$!
sleep 2
curl -N http://127.0.0.1:3401/events > /tmp/clawperator-sse-phase3.log &
SSE_PID=$!
sleep 1
curl -s -X POST http://127.0.0.1:3401/snapshot \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"<device_serial>","operatorPackage":"com.clawperator.operator.dev"}'
sleep 3
kill "$SSE_PID" 2>/dev/null
kill "$SERVER_PID" 2>/dev/null

echo "=== serve.* events ==="
grep '"event":"serve\.' "$LOG_PATH" | tail -5
echo "=== SSE events ==="
grep 'clawperator:result\|clawperator:execution' /tmp/clawperator-sse-phase3.log
```

Verify:
- `doctor.check` events appear in log file with correct level mapping (info/warn/error)
- `serve.server.started` appears in log file
- `serve.http.request` appears in log file (if request was logged)
- SSE events still arrive with unchanged `clawperator:result` / `clawperator:execution` names
- No `console.log` or `console.error` calls remain in serve.ts (except verbose route listing if you kept those)
- Pretty-mode doctor output still renders correctly on terminal (unchanged)

---

**Acceptance criteria (all must pass before commit):**

- `DoctorService.finalize()` uses `emit()` not `log()`
- All `console.log`/`console.error` calls in serve.ts are replaced with logger emit calls (with the exceptions noted above)
- EventEmitter SSE wiring is unchanged
- SSE `/events` endpoint still streams `clawperator:result` and `clawperator:execution`
- `events.ts` has the explanatory comment
- All tests pass: `npm --prefix apps/node run build && npm --prefix apps/node run test`
- Device verification shows `doctor.check` and `serve.*` events in the log file

**Commit message:**

```
feat(node): route doctor and serve logging through unified logger
```

Do not push. Do not proceed to Phase 4 - stop after committing. Then update `tasks/log/unified/plan.md` and `tasks/log/unified/work-breakdown.md` status tables to mark Phase 3 as `[DONE]` and set Current/Next to Phase 4.