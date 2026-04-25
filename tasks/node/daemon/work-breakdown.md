# Transparent Background Daemon Work Breakdown

Parent plan: `tasks/node/daemon/plan.md`

## Executive Summary

5 phases, 5 PRs. Each phase is a standalone mergeable unit. Phases 1-2 are
non-breaking infrastructure. Phase 3 introduces the first user-visible behavior
change. Phase 4 is mechanical rollout. Phase 5 is measurement.

| PR | Purpose | Phase | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Server extraction + Unix socket transport | Phase 1 | default | none |
| PR-2 | Daemon lifecycle commands | Phase 2 | default | PR-1 merged |
| PR-3 | Proxy layer for exec / snapshot / screenshot | Phase 3 | thinking | PR-2 merged |
| PR-4 | Expand proxy to all flat action commands | Phase 4 | fast | PR-3 merged |
| PR-5 | Latency measurement and findings | Phase 5 | fast | PR-4 merged |

Current state: planning. Phase 1 is the next step.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 5 |
| Total phases | 5 |
| Completed | 0 |
| Remaining | 5 |
| Current / Next | Phase 1 (PR-1) |
| Blockers | none |

## Hard Rules

- Do NOT start a phase until the previous PR is merged.
- Do NOT bypass or skip the fallback path. Every daemon interaction must have a
  working direct-mode fallback. A CLI command must never fail solely because the
  daemon is unavailable.
- Do NOT change the stdout JSON shape, pretty-print behavior, exit codes, or
  `[Clawperator-Result]` semantics of any proxied command. Use `formatSuccess` and
  `formatError` from `apps/node/src/cli/output.ts` on the proxied response body.
  Do NOT pass raw HTTP response bodies to stdout.
- Do NOT add daemon logic to `clawperator serve`. The daemon and serve remain
  separate commands. The daemon start command spawns the serve process on a Unix
  socket; the `serve` command continues to bind a TCP port.
- Do NOT change the `resolveInteractiveSkillTarget` pre-spawn readiness check in
  `skills.ts`. It stays uncached per `tasks/node/handshaking/plan.md`.
- Do NOT modify any Android-side code.
- Do NOT use port-based TCP transport for the daemon socket. Unix domain socket only
  (macOS/Linux). Windows is out of scope for this task pack.
- One commit per logical step. Do not batch Phase 1 and Phase 2 into one commit.
- If a deviation from this plan is required, stop and escalate. Do not re-derive
  the decisions locked in `tasks/node/daemon/plan.md`.
- Every phase that introduces behavior must include the tests that prove that
  behavior in the same phase and commit.
- Do not use the globally installed `clawperator` binary for validation. Use the
  branch-local build from `apps/node/dist/cli/index.js`.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/node/daemon/plan.md` | Stable contract, locked decisions, failure modes |
| `apps/node/src/cli/commands/serve.ts` | The daemon's Express app - understand `startServer()`, `createApp`-equivalent pattern, all routes, and the TCP binding |
| `apps/node/src/cli/commands/execute.ts` | Primary proxy target; shows how `runExecution` is called and formatted |
| `apps/node/src/cli/commands/observe.ts` | Proxy target for snapshot and screenshot |
| `apps/node/src/cli/commands/action.ts` | Phase 4 target; shows all flat action command patterns |
| `apps/node/src/cli/output.ts` | `formatSuccess` and `formatError` - the proxy must use these |
| `apps/node/src/cli/stdoutExitCode.ts` | Exit code determination logic - proxy output must pass this unchanged |
| `apps/node/src/domain/version/compatibility.ts` | `getCliVersion()` - used by `/version` endpoint and daemon client |
| `apps/node/src/cli/registry.ts` | Where to register `daemon` command and `--no-daemon` flags |
| `tasks/node/handshaking/plan.md` | The in-process readiness cache that becomes maximally effective once the daemon exists |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Server extraction + Unix socket | Phase 1 | default | none |
| PR-2 | Daemon lifecycle commands | Phase 2 | default | PR-1 merged |
| PR-3 | Proxy layer - core commands | Phase 3 | thinking | PR-2 merged |
| PR-4 | Proxy expansion - action commands | Phase 4 | fast | PR-3 merged |
| PR-5 | Measurement | Phase 5 | fast | PR-4 merged |

---

## Phase 1: Server Extraction and Unix Socket Transport

### Agent Tier
default

### Goal
Refactor `serve.ts` so the Express app can be created independently of transport
binding. Add Unix socket support and health endpoints. No CLI behavior change.

### Files to Change
- `apps/node/src/cli/commands/serve.ts`
- `apps/node/src/test/unit/serve/` (new test file or extend existing)

### Steps

1. Read `serve.ts` in full. Understand the current structure: `cmdServe` calls
   `startServer`, which builds the Express app inline and binds via `app.listen(port,
   host)`.

2. Extract the Express app construction into a new exported function `createServeApp`:
   ```typescript
   export function createServeApp(options: ServeAppOptions): express.Application
   ```
   Where `ServeAppOptions` is `ServeOptions` without `port` and `host`. The function
   returns the configured Express app without binding it.

3. Update `startServer` to accept either TCP (`port`, `host`) or Unix socket
   (`socketPath`) binding:
   ```typescript
   interface ServeOptions {
     port?: number;
     host?: string;
     socketPath?: string; // new
     verbose: boolean;
     logger?: Logger;
     resolveInteractiveSkillTargetImpl?: typeof resolveInteractiveSkillTarget;
   }
   ```
   Binding logic: if `socketPath` is set, call `app.listen(socketPath, ...)`. If
   `port` is set, call `app.listen(port, host, ...)`. Exactly one of the two must be
   provided; throw if both or neither are provided.

4. Add two new endpoints to `createServeApp` (before the error handler):
   ```
   GET /ping   - returns { ok: true }
   GET /version - returns { version: string }  (use getCliVersion())
   ```
   Import `getCliVersion` from `apps/node/src/domain/version/compatibility.ts`.

5. Ensure `cmdServe` continues to pass `{ port, host }` to `startServer`. No behavior
   change for the `serve` CLI command.

6. Write unit tests covering:
   - `createServeApp()` returns an Express app with `GET /ping` returning `{ ok: true }`
   - `createServeApp()` returns an Express app with `GET /version` returning the
     expected version string
   - `startServer` with TCP options resolves to a Server object (use supertest or
     direct port binding on an ephemeral port)
   - `startServer` with `socketPath` resolves and accepts connections on the socket
   - `startServer` throws when neither `port` nor `socketPath` is provided

### Acceptance Criteria
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
- `GET /ping` returns `{"ok":true}` on a running serve instance.
- `GET /version` returns `{"version":"0.7.9"}` (or current version) on a running serve instance.
- `clawperator serve` continues to start on TCP and print the startup message unchanged.
- No existing serve tests regress.

### Validation
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
# Smoke check: serve still starts on TCP
node apps/node/dist/cli/index.js serve --port 3099 &
sleep 1
curl -s http://localhost:3099/ping
curl -s http://localhost:3099/version
kill %1
```

### Expected Commit
```text
refactor(node): extract createServeApp and add Unix socket transport (#<n>)
```

---

## Phase 2: Daemon Lifecycle Commands

### Agent Tier
default

### Goal
Add `clawperator daemon start|stop|status|restart` commands with PID, socket, and log
file lifecycle management.

### Files to Change
- `apps/node/src/domain/daemon/lifecycle.ts` (new)
- `apps/node/src/cli/commands/daemon.ts` (new)
- `apps/node/src/cli/registry.ts` (register daemon command)
- `apps/node/src/test/unit/daemon/lifecycle.test.ts` (new)

### Steps

1. Create `apps/node/src/domain/daemon/lifecycle.ts`. This file owns the canonical path
   formulas and low-level lifecycle operations. It must export:

   ```typescript
   export function getDaemonDir(): string
   // Returns: `${os.homedir()}/.clawperator`
   // Creates the directory if it does not exist.

   export function getDaemonSocketPath(deviceId: string): string
   // Returns: `${getDaemonDir()}/daemon-${deviceId}.sock`

   export function getDaemonPidPath(deviceId: string): string
   // Returns: `${getDaemonDir()}/daemon-${deviceId}.pid`

   export function getDaemonLogPath(deviceId: string): string
   // Returns: `${getDaemonDir()}/daemon-${deviceId}.log`

   export async function isDaemonRunning(deviceId: string): Promise<boolean>
   // Returns true if the PID file exists and the process is alive (kill(pid, 0)).

   export async function stopDaemon(deviceId: string): Promise<'stopped' | 'not_running'>
   // Reads PID file, sends SIGTERM, waits up to 2s for process exit, removes PID
   // and socket files. Returns 'not_running' if PID file does not exist.

   export async function startDaemonProcess(deviceId: string): Promise<void>
   // Spawns `node dist/cli/index.js daemon start --device <deviceId>` (or equivalent)
   // as a detached background process. Redirects stdout/stderr to the log file.
   // Writes the child PID to the PID file. Unref the child so the parent exits.
   ```

   Path formula is deterministic. Use `os.homedir()` from Node `node:os`. Never
   hardcode a user home path.

2. Create `apps/node/src/cli/commands/daemon.ts` with four exported functions:

   - `cmdDaemonStart(options: { deviceId?: string; operatorPackage?: string }): Promise<string>`
     - Resolves `deviceId`. If daemon is already running (socket alive), prints
       "Daemon already running for device <id>." and exits.
     - Starts the Express app from `createServeApp()` on the Unix socket path for the
       resolved device ID.
     - Writes the PID file.
     - Prints "Daemon started for device <id> at <socketPath>." to stdout.

   - `cmdDaemonStop(options: { deviceId?: string }): Promise<string>`
     - Resolves `deviceId`. Calls `stopDaemon`. Prints result.

   - `cmdDaemonStatus(options: { deviceId?: string }): Promise<string>`
     - Resolves `deviceId`. Checks socket liveness via `GET /ping`. Prints running/not
       running, version, and socket path.

   - `cmdDaemonRestart(options: { deviceId?: string; operatorPackage?: string }): Promise<string>`
     - Calls stop then start in sequence.

   Note: `cmdDaemonStart` is the process that *is* the daemon (it runs the Express app
   in the foreground of a background process). It is distinct from the auto-start
   spawner in Phase 3. The lifecycle.ts `startDaemonProcess()` is the spawner; this
   command is the server entry point.

3. Register in `registry.ts`:
   ```
   COMMANDS["daemon"] = {
     name: "daemon",
     group: "Server",
     supportedFlags: [],
     summary: "Manage the background daemon process",
     ...
   }
   ```
   Subcommands: `start`, `stop`, `status`, `restart`. Use the existing subcommand
   dispatch pattern (see how `recording` subcommands are handled).

4. Write unit tests in `apps/node/src/test/unit/daemon/lifecycle.test.ts`:
   - `getDaemonSocketPath` returns the correct path formula
   - `getDaemonPidPath` returns the correct path formula
   - `getDaemonLogPath` returns the correct path formula
   - `isDaemonRunning` returns false when PID file does not exist
   - `isDaemonRunning` returns false when PID file exists but process is dead
   - `stopDaemon` returns `not_running` when PID file does not exist
   - `stopDaemon` sends SIGTERM and removes files when daemon is running (mock process)

### Acceptance Criteria
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
- `clawperator daemon start --device <id>` starts a background server on the socket.
- `clawperator daemon status --device <id>` prints version and socket path when running.
- `clawperator daemon stop --device <id>` stops the server and cleans up PID/socket files.
- `clawperator daemon restart` is `stop + start` and leaves a running daemon.
- `clawperator daemon start` when already running prints "already running" and exits 0.
- `clawperator daemon stop` when not running prints "not running" and exits 0.
- All unit tests pass.

### Validation
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
# Live smoke: start, status, stop
node apps/node/dist/cli/index.js daemon start --device <device_id>
node apps/node/dist/cli/index.js daemon status --device <device_id>
node apps/node/dist/cli/index.js daemon stop --device <device_id>
node apps/node/dist/cli/index.js daemon status --device <device_id>
```

Replace `<device_id>` with the serial from `adb devices`.

### Expected Commit
```text
feat(node): add clawperator daemon lifecycle commands (#<n>)
```

---

## Phase 3: CLI Proxy for exec, snapshot, screenshot

### Agent Tier
thinking

### Goal
Add a proxy layer that transparently routes `exec`, `snapshot`, and `screenshot`
through the background daemon when available, with auto-start, version check, stale
socket cleanup, and direct-mode fallback.

### Files to Change
- `apps/node/src/cli/daemonProxy.ts` (new)
- `apps/node/src/cli/commands/execute.ts` (modify)
- `apps/node/src/cli/commands/observe.ts` (modify)
- `apps/node/src/cli/registry.ts` (add `--no-daemon` to exec/snapshot/screenshot flags)
- `apps/node/src/test/unit/daemon/daemonProxy.test.ts` (new)

### Steps

1. Create `apps/node/src/cli/daemonProxy.ts`. This is the highest-risk file in the
   project. Read `tasks/node/daemon/plan.md` Section "Decision Rules" carefully before
   writing.

   Required exports:

   ```typescript
   export interface DaemonProxyOptions {
     deviceId: string;          // must be resolved (post-device-resolution)
     operatorPackage: string;   // must be resolved
     noDaemon?: boolean;        // true = skip proxy, run direct
   }

   // Returns true if daemon is alive and version-matched.
   export async function isDaemonReady(options: DaemonProxyOptions): Promise<boolean>

   // Tries to proxy execution through the daemon.
   // Returns null if proxy is unavailable, opted-out, or device is unresolvable.
   // Returns ExecutionResult on success.
   // Never throws.
   export async function tryDaemonExecution(
     execution: unknown,
     options: DaemonProxyOptions
   ): Promise<ExecutionResult | null>
   ```

   Internal implementation of `tryDaemonExecution`:
   a. Check opt-out (`CLAWPERATOR_NO_DAEMON` env or `options.noDaemon`). Return null.
   b. Check platform (skip on Windows). Return null.
   c. Check `options.deviceId` is non-empty. Return null if blank.
   d. Resolve socket path via `getDaemonSocketPath(options.deviceId)`.
   e. Check liveness: try `GET /ping` on the socket. Handle ENOENT (socket missing) and
      ECONNREFUSED (stale socket).
      - If ENOENT: go to step (f) auto-start.
      - If ECONNREFUSED: delete socket file; go to step (f) auto-start.
      - If alive: check version via `GET /version`. If mismatch: call `stopDaemon` +
        auto-start; else proceed to step (g).
   f. Auto-start: spawn `clawperator daemon start --device <id>` as detached process
      (use `startDaemonProcess` from lifecycle.ts). Poll socket at 100ms intervals up
      to 3000ms. If socket is connectable and version matches: proceed to step (g).
      Otherwise: print stderr diagnostic "Daemon start timed out; running direct." and
      return null.
   g. POST to `http+unix://<socketPath>//execute` with body:
      ```json
      { "execution": <execution>, "deviceId": "<deviceId>", "operatorPackage": "<pkg>" }
      ```
      Use the `node:http` module with `socketPath` option or a Unix socket HTTP client.
      Do NOT use `fetch()` here (it does not support Unix sockets in all Node versions).
   h. Parse response body as JSON into `ExecutionResult`.
   i. Return the parsed result. On any network error, print stderr diagnostic and
      return null.

   Contract preservation is critical: `tryDaemonExecution` returns the raw
   `ExecutionResult` object. The calling command handler must then call `formatSuccess`
   or `formatError` on it, the same way it would after a direct `runExecution` call.
   This is the only correct pattern.

2. Modify `apps/node/src/cli/commands/execute.ts`.
   In `cmdExecute`, after the payload is loaded and validated, replace:
   ```typescript
   const result = await runExecution(payload, { deviceId, operatorPackage, ... });
   ```
   With:
   ```typescript
   const result =
     (await tryDaemonExecution(payload, { deviceId: resolvedDeviceId, operatorPackage, noDaemon }))
     ?? await runExecution(payload, { deviceId: resolvedDeviceId, operatorPackage, ... });
   ```
   Where `noDaemon` is resolved from the `--no-daemon` flag or `CLAWPERATOR_NO_DAEMON`
   env. `resolvedDeviceId` must be the post-resolution device ID (the same value passed
   to `runExecution`).

3. Modify `apps/node/src/cli/commands/observe.ts`.
   In `cmdObserveSnapshot` and `cmdObserveScreenshot`, apply the same proxy-before-
   direct pattern. These internally build a `snapshot_ui` or `screenshot` execution and
   call `runExecution`. Replace the `runExecution` call with:
   ```typescript
   const result =
     (await tryDaemonExecution(execution, { deviceId: resolvedDeviceId, operatorPackage, noDaemon }))
     ?? await runExecution(execution, { ... });
   ```

4. In `registry.ts`, add `"--no-daemon"` to `supportedFlags` for `exec`, `snapshot`,
   and `screenshot` commands. Add `"--no-daemon"` to `EXEC_PAYLOAD_FLAG_ALIASES` (or
   the appropriate flags structure). The flag must appear in `clawperator exec --help`.

5. Write unit tests in `apps/node/src/test/unit/daemon/daemonProxy.test.ts`:
   - `tryDaemonExecution` returns null when `CLAWPERATOR_NO_DAEMON=1` is set
   - `tryDaemonExecution` returns null when `--no-daemon` flag is set
   - `tryDaemonExecution` returns null when deviceId is blank
   - `tryDaemonExecution` returns null and prints stderr when auto-start times out
     (mock `startDaemonProcess` and `isDaemonReady` to simulate timeout)
   - `tryDaemonExecution` returns the result when daemon is alive and version matches
     (mock the HTTP request)
   - `tryDaemonExecution` stops old daemon and starts fresh when version mismatches
     (mock stop, start, and HTTP request)
   - `tryDaemonExecution` deletes stale socket and restarts when ECONNREFUSED
   - `tryDaemonExecution` returns null on network error after successful start (mock
     HTTP to throw after socket is alive)
   - Proxy result passed to `formatSuccess` produces identical output to direct result
     (compare formatted strings for a known ExecutionResult fixture)

   Make the HTTP client and lifecycle functions injectable for testing. Do not test
   against a real socket in unit tests.

### Acceptance Criteria
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
- All unit tests in `daemonProxy.test.ts` pass.
- With daemon running: `clawperator snapshot --device <id>` proxies to daemon (confirm
  via daemon log showing the request).
- With daemon running: `clawperator exec <payload.json> --device <id>` proxies to
  daemon.
- With daemon stopped: `clawperator snapshot --device <id>` auto-starts daemon and
  proxies (first call starts daemon, subsequent calls hit warm daemon).
- With `CLAWPERATOR_NO_DAEMON=1`: commands run direct with no daemon interaction.
- With `--no-daemon`: commands run direct.
- CLI stdout output is identical between proxy path and direct path for the same
  execution. Verify by running both and diffing stdout.
- Exit codes are correct: 0 on success, 1 on execution failure, same as direct path.
- `[Clawperator-Result]` appears in stdout for terminal-producing executions.

### Validation
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test

# Start daemon manually, then test proxy
node apps/node/dist/cli/index.js daemon start --device <device_id>

# Proxy path
node apps/node/dist/cli/index.js snapshot --device <device_id> > /tmp/proxy-out.json

# Direct path (opt-out)
CLAWPERATOR_NO_DAEMON=1 node apps/node/dist/cli/index.js snapshot --device <device_id> > /tmp/direct-out.json

# Diff (should match on all fields except timing-sensitive fields like timestamps)
diff /tmp/proxy-out.json /tmp/direct-out.json

# Verify auto-start (stop daemon first)
node apps/node/dist/cli/index.js daemon stop --device <device_id>
node apps/node/dist/cli/index.js snapshot --device <device_id>  # should auto-start

node apps/node/dist/cli/index.js daemon stop --device <device_id>
```

### Expected Commit
```text
feat(node): proxy exec, snapshot, screenshot through background daemon (#<n>)
```

---

## Phase 4: Expand Proxy to All Flat Action Commands

### Agent Tier
fast

### Goal
Apply the same proxy-before-direct pattern from Phase 3 to all flat action commands in
`action.ts`.

### Files to Change
- `apps/node/src/cli/commands/action.ts`
- `apps/node/src/cli/registry.ts` (add `--no-daemon` to action command supported flags)
- `apps/node/src/test/unit/daemon/actionProxy.test.ts` (new or extend existing)

### Context Note
Before starting this phase, confirm that `tasks/node/handshaking/plan.md` PR-1 (the
in-process readiness cache) has been merged. If it has, the daemon now holds a warm
readiness cache for all callers. If it has not yet merged, note this in the commit
message but proceed - the proxy is valuable regardless.

### Steps

1. Read `apps/node/src/cli/commands/action.ts` in full. Identify all exported `cmd*`
   functions that call `runExecution`. List them explicitly.

2. For each `cmd*` function, apply the same proxy-before-direct pattern used in
   Phase 3. The pattern is always:
   ```typescript
   const result =
     (await tryDaemonExecution(execution, { deviceId: resolvedDeviceId, operatorPackage, noDaemon }))
     ?? await runExecution(execution, { deviceId: resolvedDeviceId, operatorPackage, ... });
   ```
   `noDaemon` must be threaded from the calling options object. Add `noDaemon?: boolean`
   to each options interface that does not already have it.

3. Note: `close_app`-only executions bypass `ensureInteractiveAutomationReady` in
   `runExecution.ts` today. The daemon's `/execute` route preserves this behavior
   because it calls `runExecution` internally. No special handling is needed in the
   proxy for `close_app`.

4. In `registry.ts`, add `"--no-daemon"` to `supportedFlags` for each action command
   (open, close, click, type, read, wait, press, back, scroll, etc.).

5. Write or extend unit tests:
   - One representative action command (e.g., `cmdActionClick`) proxies to daemon when
     available (mock `tryDaemonExecution`).
   - Same command falls back to direct when `tryDaemonExecution` returns null (mock).
   - `--no-daemon` disables proxy for action commands.
   These tests prove the wiring pattern. The proxy behavior itself is already covered by
   `daemonProxy.test.ts` from Phase 3.

### Acceptance Criteria
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
- All `cmd*` functions in `action.ts` use the proxy-before-direct pattern.
- `--no-daemon` flag is listed in `--help` for action commands.
- With daemon running, action commands are visible in the daemon log.
- With daemon stopped, action commands run direct (no regression).

### Validation
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test

# With daemon running, verify an action command proxies
node apps/node/dist/cli/index.js daemon start --device <device_id>
node apps/node/dist/cli/index.js open-app com.android.settings --device <device_id>
# Check daemon log shows the request:
tail -n 20 ~/.clawperator/daemon-<device_id>.log

node apps/node/dist/cli/index.js daemon stop --device <device_id>
```

### Expected Commit
```text
feat(node): expand daemon proxy to all flat action commands (#<n>)
```

---

## Phase 5: Latency Measurement and Findings

### Agent Tier
fast

### Goal
Measure actual latency improvement for the daemon proxy, specifically for sequential
CLI calls and for a simulated skill loop. Record findings.

### Files to Change
- `tasks/node/daemon/findings.md` (new - create at the start of this phase)

### Prerequisites
- A physical device connected and accessible via `adb`.
- `clawperator daemon start --device <device_id>` running.
- Branch-local build available at `apps/node/dist/cli/index.js`.

### Steps

1. Create `tasks/node/daemon/findings.md` with the following structure at the top:
   ```markdown
   # Daemon Latency Findings

   Date: <date>
   Device: <device model and Android version>
   Baseline commit: <commit SHA of PR #238 or current main>
   Test commit: <current branch HEAD SHA>
   ```

2. Run the following timed sequences and record each result in `findings.md`.

   **Measurement A: Sequential `clawperator snapshot` calls (direct mode)**
   ```bash
   CLAWPERATOR_NO_DAEMON=1 \
   time (for i in 1 2 3 4 5; do
     node apps/node/dist/cli/index.js snapshot --device <device_id> > /dev/null
   done)
   ```

   **Measurement B: Sequential `clawperator snapshot` calls (daemon mode, cold start)**
   ```bash
   node apps/node/dist/cli/index.js daemon stop --device <device_id> 2>/dev/null; true
   time (for i in 1 2 3 4 5; do
     node apps/node/dist/cli/index.js snapshot --device <device_id> > /dev/null
   done)
   ```
   Record first-call time separately from subsequent calls.

   **Measurement C: Sequential `clawperator snapshot` calls (daemon mode, warm)**
   ```bash
   node apps/node/dist/cli/index.js daemon start --device <device_id>
   time (for i in 1 2 3 4 5; do
     node apps/node/dist/cli/index.js snapshot --device <device_id> > /dev/null
   done)
   ```

   **Measurement D: `clawperator exec` with a simple action payload (direct vs daemon)**
   ```bash
   # Create a minimal close_app payload for timing
   echo '{"commandId":"t1","taskId":"t1","action":{"type":"close_app"}}' > /tmp/timing-exec.json
   CLAWPERATOR_NO_DAEMON=1 \
   time (for i in 1 2 3; do
     node apps/node/dist/cli/index.js exec /tmp/timing-exec.json --device <device_id> > /dev/null
   done)
   # vs daemon
   time (for i in 1 2 3; do
     node apps/node/dist/cli/index.js exec /tmp/timing-exec.json --device <device_id> > /dev/null
   done)
   ```

3. Record findings in these sections of `findings.md`:
   - Raw measurement table (A, B cold, B warm, C, D direct, D daemon)
   - Per-call average for direct path
   - Per-call average for daemon warm path
   - First-call overhead for daemon auto-start
   - Assessment: is the improvement significant enough to confirm the daemon approach?
   - Any anomalies observed

4. If the `tasks/node/handshaking/` PR-1 readiness cache has also merged, re-run
   Measurements B and C with the cache active and note the difference.

5. Commit `findings.md` once measurements are recorded.

### Acceptance Criteria
- `tasks/node/daemon/findings.md` exists and contains all four measurement results.
- The findings table includes per-call averages for direct and daemon warm paths.
- The improvement (or lack thereof) is assessed honestly and without rounding up.

### Validation
```bash
# findings.md exists and contains all required sections
grep -l "Measurement A\|Measurement B\|Measurement C\|Measurement D" tasks/node/daemon/findings.md
```

### Expected Commit
```text
docs(tasks): record daemon latency benchmark findings (#<n>)
```
