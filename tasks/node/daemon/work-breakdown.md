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
| PR-4 | Expand proxy to all flat action commands; add readiness cache | Phase 4 | default | PR-3 merged |
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
- Do NOT bypass or skip the fallback path for pre-connect failures. A CLI command
  must never fail solely because the daemon is unavailable before dispatch.
- Do NOT fall back to direct after the HTTP request to the daemon has been dispatched
  for `exec` or mutating action commands. A lost response to a mutating action
  (`click`, `type`, `open-app`, `exec`) must surface as an error, not silently retry.
  Pre-dispatch failures may fall back. The only post-dispatch fallback exception is an
  explicitly idempotent wrapper command (`snapshot` or `screenshot`) that passes
  `allowPostDispatchFallback: true`.
- Do NOT change the stdout JSON shape, pretty-print behavior, exit codes, or
  `[Clawperator-Result]` semantics of any proxied command. Use
  `formatRunExecutionResultForCli(result, options)` (new shared helper) for both
  direct and proxied paths. Do NOT pass raw HTTP response bodies to stdout.
- Do NOT add any new CLI stdout that is not parseable JSON by default. Daemon lifecycle
  commands are agent-facing CLI commands, so `start|stop|status|restart` must return
  structured JSON success or registered structured error objects on stdout.
- Do NOT add daemon logic to `clawperator serve`. The daemon and serve remain
  separate commands. `daemon run` is the foreground server; `serve` continues to
  bind a TCP port.
- Do NOT change the `resolveInteractiveSkillTarget` pre-spawn readiness check in
  `skills.ts`. It stays uncached. Only `ensureInteractiveAutomationReady` in the main
  execution path is replaced with the cached variant in Phase 4.
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
| `apps/node/src/domain/config/resolveOperatorPackage.ts` | Existing helper for explicit/env/default operator package precedence; import it from `daemonProxy.ts` instead of inventing a second rule |
| `apps/node/src/cli/commands/observe.ts` | Proxy target for snapshot and screenshot |
| `apps/node/src/cli/commands/action.ts` | Phase 4 target; shows all flat action command patterns |
| `apps/node/src/cli/output.ts` | `formatSuccess` and `formatError` - basis for the shared `formatRunExecutionResultForCli` helper added in Phase 3 |
| `apps/node/src/cli/stdoutExitCode.ts` | Exit code determination logic - proxy output must pass this unchanged |
| `apps/node/src/domain/version/compatibility.ts` | `getCliVersion()` - used by `/version` endpoint and daemon client |
| `apps/node/src/cli/registry.ts` | Where to register `daemon` command and command-local `--no-daemon` flags |
| `apps/node/src/cli/index.ts` | Where global flags are parsed; `--no-daemon` must be accepted before or after the command |
| `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` | Phase 4 target for readiness cache - understand current `ensureInteractiveAutomationReady` and `probeInteractiveState` before modifying |
| `apps/node/src/domain/executions/runExecution.ts` | Phase 4 call site - where `ensureInteractiveAutomationReady` is called today |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Server extraction + Unix socket | Phase 1 | default | none |
| PR-2 | Daemon lifecycle commands | Phase 2 | default | PR-1 merged |
| PR-3 | Proxy layer - core commands | Phase 3 | thinking | PR-2 merged |
| PR-4 | Proxy expansion - action commands + readiness cache | Phase 4 | default | PR-3 merged |
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
- `apps/node/package.json` (update `test` and `test:unit` globs)
- `apps/node/src/test/unit/serve/serve.test.ts` (new)

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

6. Update both the `test` and `test:unit` scripts in `apps/node/package.json` to match
   nested test directories. The current glob only matches `dist/test/unit/*.test.js`
   plus a few explicit subdirectories. Change it to include `dist/test/unit/**/*.test.js`
   so the daemon and serve test subdirectories are automatically picked up. Verify the
   existing tests still run after the change.

7. Write unit tests covering:
   - `createServeApp()` returns an Express app with `GET /ping` returning `{ ok: true }`
   - `createServeApp()` returns an Express app with `GET /version` returning the
     expected version string
   - `startServer` with TCP options resolves to a Server object (prefer Node's built-in
     `fetch`/`http` against an ephemeral port; do not add `supertest` unless there is a
     separate reason to introduce the dependency)
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
Add `clawperator daemon start|stop|status|restart` user-facing commands and a hidden
`daemon run` foreground server process. Define PID, socket, and log file lifecycle.
Ship a first draft of `docs/api/daemon.md` in the same PR.

### Files to Change
- `apps/node/src/domain/daemon/lifecycle.ts` (new)
- `apps/node/src/cli/commands/daemon.ts` (new)
- `apps/node/src/cli/registry.ts` (register daemon command)
- `apps/node/src/contracts/errors.ts` (add daemon lifecycle error codes)
- `apps/node/src/test/unit/daemon/lifecycle.test.ts` (new)
- `docs/api/daemon.md` (new - initial draft)
- `docs/api/errors.md` (document daemon lifecycle error codes)
- `docs/api/overview.md` (add daemon link)
- `sites/docs/mkdocs.yml` (add daemon page to API nav)

### Daemon Model (Critical - Read Before Writing)

There are two distinct behaviors under `clawperator daemon`:

**`daemon run` (internal foreground server):**
- The actual daemon process. Not advertised in `--help` top-level block.
- Calls `startServer({ socketPath, verbose, logger })` from `serve.ts`.
- Writes its own PID to the PID file on startup.
- Runs until killed (SIGTERM or SIGKILL).
- This process IS the daemon. It never exits on its own.

**`daemon start` (user-facing launcher):**
- Spawns `daemon run --device <id>` as a detached child process.
- Redirects child stdout/stderr to the log file.
- Unrefs the child so the parent process can exit.
- Polls the socket at 100ms intervals up to 3000ms.
- Exits 0 with structured JSON stdout when socket is connectable.
- Exits nonzero with a registered structured error when the socket never becomes
  connectable.
- `daemon start` does NOT itself call `startServer`. It is only a spawner and poller.

`daemon stop`, `daemon status`, `daemon restart` operate on the socket and PID file
written by `daemon run`. They do NOT interact with `daemon start`.

The auto-start spawner in Phase 3 (`daemonProxy.ts`) spawns `daemon run` directly, not
`daemon start`, to avoid a spawn-then-polling-spawn chain.

### Steps

1. Create `apps/node/src/domain/daemon/lifecycle.ts`. This file owns path formulas and
   low-level operations. All path functions must use the sanitized key formula from
   `plan.md` (colons and slashes replaced with hyphens; empty/undefined becomes
   "default"). Required exports:

   ```typescript
   export function sanitizeDaemonKey(rawDeviceId: string | undefined): string
   // Replaces ':' with '-', removes '/' and whitespace. Empty/undefined -> 'default'.

   export interface DaemonPathsOptions { baseDir?: string }

   export function getDaemonDir(options?: DaemonPathsOptions): string
   // Returns `${os.homedir()}/.clawperator`
   // Creates the directory with mode 0o700 if it does not exist (mkdirSync, recursive).
   // Tests may pass baseDir so they never mutate the real user home.

   export function getDaemonSocketPath(rawDeviceId: string | undefined, options?: DaemonPathsOptions): string
   // `${getDaemonDir()}/daemon-${sanitizeDaemonKey(rawDeviceId)}.sock`

   export function getDaemonPidPath(rawDeviceId: string | undefined, options?: DaemonPathsOptions): string
   // `${getDaemonDir()}/daemon-${sanitizeDaemonKey(rawDeviceId)}.pid`

   export function getDaemonLogPath(rawDeviceId: string | undefined, options?: DaemonPathsOptions): string
   // `${getDaemonDir()}/daemon-${sanitizeDaemonKey(rawDeviceId)}.log`

   export async function isDaemonRunning(rawDeviceId: string | undefined, options?: DaemonPathsOptions): Promise<boolean>
   // Returns true if PID file exists and process is alive (kill(pid, 0) returns 0).

   export async function stopDaemon(rawDeviceId: string | undefined, options?: DaemonPathsOptions): Promise<'stopped' | 'not_running'>
   // Reads PID file, sends SIGTERM, waits up to 2s for process exit.
   // Removes PID and socket files. Returns 'not_running' if PID file does not exist.

   export function spawnDaemonRun(rawDeviceId: string | undefined, operatorPackage?: string, options?: DaemonPathsOptions): void
   // Spawns `node <dist>/cli/index.js daemon run [--device <id>] [--operator-package <pkg>]` as a detached child.
   // stdio MUST be: ['ignore', logFd, logFd] - stdin explicitly ignored, stdout and
   // stderr redirected to the open log file descriptor. Do NOT inherit parent stdin.
   // Set detached: true. Unref the child so the parent process exits cleanly.
   // Uses process.argv[1] (the current binary path) to find the CLI entry point.
   // Does NOT write the PID file - cmdDaemonRun writes its own PID on startup.
   ```

   Use `os.homedir()` from `node:os` for production defaults. Never hardcode a home
   path. Unit tests must use a temporary base directory or dependency injection; they
   must not create, delete, or kill processes from the real `~/.clawperator` state.

2. Add registered daemon lifecycle error codes to `apps/node/src/contracts/errors.ts`:
   - `DAEMON_START_FAILED`
   - `DAEMON_STOP_FAILED`

   Use these when lifecycle commands fail. Do not return plain strings such as
   "failed to start" on stdout, because `stdoutExitCode.ts` only assigns nonzero exit
   codes for structured error objects.

3. Create `apps/node/src/cli/commands/daemon.ts` with five exported functions:

   - `cmdDaemonRun(options: { deviceId?: string; operatorPackage?: string; verbose?: boolean }): Promise<void>`
     - THE FOREGROUND SERVER. Calls `startServer({ socketPath, verbose, logger })`.
     - On startup: write a metadata file (or extend the PID file) containing:
       `{ pid: process.pid, startedAt: Date.now() }` (JSON). This is what
       `daemon status` reads to compute PID and uptime. Write BEFORE starting the server.
     - Never returns (long-running). Handles SIGTERM: stop server, delete PID/socket/
       metadata files, exit 0.
     - stdout is redirected to the log file by the spawner - do not print to stdout.

   - `cmdDaemonStart(options: { format: OutputOptions["format"]; deviceId?: string; operatorPackage?: string }): Promise<string>`
     - If socket is already alive (GET /ping succeeds), returns
       `formatSuccess({ ok: true, daemon: { status: "already_running", socketPath } }, options)`.
     - Calls `spawnDaemonRun(deviceId, operatorPackage)`. Polls socket at 100ms up to 3s.
     - Returns `formatSuccess({ ok: true, daemon: { status: "started", socketPath } }, options)`
       on success.
     - Returns `formatError({ code: ERROR_CODES.DAEMON_START_FAILED, message, details }, options)`
       on timeout.

   - `cmdDaemonStop(options: { format: OutputOptions["format"]; deviceId?: string }): Promise<string>`
     - Calls `stopDaemon(deviceId)`.
     - Returns `formatSuccess({ ok: true, daemon: { status: "stopped" | "not_running", socketPath } }, options)`.
     - Returns `formatError({ code: ERROR_CODES.DAEMON_STOP_FAILED, message, details }, options)`
       if termination or cleanup fails.

   - `cmdDaemonStatus(options: { format: OutputOptions["format"]; deviceId?: string }): Promise<string>`
     - Checks socket liveness via GET /ping. On alive: reads PID metadata file, calls
       GET /version, computes uptime from `Date.now() - startedAt`. Returns
       `formatSuccess({ ok: true, daemon: { status: "running", pid, version, uptimeSeconds, socketPath } }, options)`.
     - On not alive: returns
       `formatSuccess({ ok: true, daemon: { status: "not_running", socketPath } }, options)`.

   - `cmdDaemonRestart(options: { format: OutputOptions["format"]; deviceId?: string }): Promise<string>`
     - Calls `cmdDaemonStop` then `cmdDaemonStart` in sequence.

4. Register in `registry.ts`. The `daemon` command must have subcommands `start`, `stop`,
   `status`, `restart`. The `run` subcommand must be registered and functional but must
   NOT appear in the `topLevelBlock` or in `--help` output. Use the existing subcommand
   dispatch pattern (see how `recording` subcommands are handled).

5. Write `docs/api/daemon.md` (initial draft) covering:
   - What the daemon is and why it exists
   - `daemon start|stop|status|restart` command reference
   - JSON stdout shapes for running, started, stopped, already-running, and not-running
   - Socket path formula (mention sanitization)
   - Version policy for the lifecycle endpoints
   - Known limitation: proxy is not yet active (coming in PR-3)
   Do NOT document `--no-daemon`, `CLAWPERATOR_NO_DAEMON=1`, auto-start, or transparent
   proxy behavior as available until PR-3 implements them.
   Use `.agents/skills/docs-author/SKILL.md` for this step.

6. Update `docs/api/errors.md` to include `DAEMON_START_FAILED` and
   `DAEMON_STOP_FAILED`.

7. Add a link to `daemon.md` in `docs/api/overview.md`, and add the page to the API
   nav in `sites/docs/mkdocs.yml`.

8. Run `./scripts/docs_build.sh` and confirm it succeeds.

9. Write unit tests in `apps/node/src/test/unit/daemon/lifecycle.test.ts`:
   - `sanitizeDaemonKey` converts `'192.168.1.1:5555'` to `'192.168.1.1-5555'`
   - `sanitizeDaemonKey` returns `'default'` for empty string and undefined
   - `getDaemonSocketPath` returns the correct path formula
   - `getDaemonPidPath` returns the correct path formula
   - `getDaemonLogPath` returns the correct path formula
   - `isDaemonRunning` returns false when PID file does not exist
   - `isDaemonRunning` returns false when PID file exists but process is not alive
   - `stopDaemon` returns `'not_running'` when PID file does not exist
   - `stopDaemon` sends SIGTERM and removes files when daemon is running (mock process)
   - lifecycle command outputs are valid JSON in default mode
   - start timeout returns `DAEMON_START_FAILED` and a nonzero CLI exit code
   - stop cleanup failure returns `DAEMON_STOP_FAILED` and a nonzero CLI exit code

### Acceptance Criteria
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
- All new unit tests in `lifecycle.test.ts` pass.
- `clawperator daemon start --device <id>` returns JSON with `daemon.status == "started"` and exits 0.
- `clawperator daemon status --device <id>` returns JSON with PID, version, uptime, and socket path when running.
- `clawperator daemon stop --device <id>` cleans up PID and socket files and returns JSON with `daemon.status == "stopped"`.
- `clawperator daemon restart --device <id>` stops then restarts the daemon and returns structured JSON.
- `clawperator daemon start` when already running returns JSON with `daemon.status == "already_running"` and exits 0.
- `clawperator daemon stop` when not running returns JSON with `daemon.status == "not_running"` and exits 0.
- lifecycle command failure paths return registered error codes and exit 1.
- `clawperator daemon run` does not appear in `clawperator --help` output.
- `docs/api/daemon.md` exists, is linked from `docs/api/overview.md`, appears in
  `sites/docs/mkdocs.yml`, and `./scripts/docs_build.sh` succeeds.
- `docs/api/errors.md` documents `DAEMON_START_FAILED` and `DAEMON_STOP_FAILED`.

### Validation
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
./scripts/docs_build.sh

# Live smoke: start, status, stop
node apps/node/dist/cli/index.js daemon start --device <device_id>
node apps/node/dist/cli/index.js daemon status --device <device_id>
node apps/node/dist/cli/index.js daemon stop --device <device_id>
node apps/node/dist/cli/index.js daemon status --device <device_id>

# Verify daemon run is hidden from help
! node apps/node/dist/cli/index.js --help | grep "daemon run"
```

Replace `<device_id>` with the serial from `adb devices`.

### Expected Commit
```text
feat(node): add clawperator daemon lifecycle commands and docs (#<n>)
```

---

## Phase 3: CLI Proxy for exec, snapshot, screenshot

### Agent Tier
thinking

### Goal
Add a proxy layer that transparently routes `exec`, `snapshot`, and `screenshot`
through the background daemon. Introduce the shared CLI result formatter. Wire in
auto-start, version check, stale socket cleanup, and fallback safety.
Update `docs/api/daemon.md` to document the proxy behavior.

### Files to Change
- `apps/node/src/contracts/errors.ts` (add `DAEMON_PROXY_ERROR`)
- `apps/node/src/cli/daemonProxy.ts` (new)
- `apps/node/src/cli/output.ts` (add `formatRunExecutionResultForCli`)
- `apps/node/src/cli/commands/execute.ts` (modify)
- `apps/node/src/cli/commands/observe.ts` (modify)
- `apps/node/src/cli/index.ts` (accept global `--no-daemon`)
- `apps/node/src/cli/registry.ts` (add command-local `--no-daemon` to exec/snapshot/screenshot)
- `apps/node/src/test/unit/daemon/daemonProxy.test.ts` (new)
- `docs/api/daemon.md` (update - document proxy behavior)
- `docs/api/errors.md` (document daemon error codes added to `errors.ts`)

### Shared Output Helper (Step 1 - Do This First)

Before writing any proxy code, add `formatRunExecutionResultForCli` to
`apps/node/src/cli/output.ts`:

```typescript
export function formatRunExecutionResultForCli(
  result: RunExecutionResult,
  options: OutputOptions
): string {
  if (result.ok) {
    return formatSuccess(
      {
        envelope: result.envelope,
        deviceId: result.deviceId,
        terminalSource: result.terminalSource,
        isCanonicalTerminal: result.terminalSource === "clawperator_result",
      },
      options
    );
  }
  return formatError(result.error, options);
}
```

Then refactor `execute.ts`, `observe.ts`, and any other command that currently calls
`formatSuccess`/`formatError` directly on a `RunExecutionResult` to use this helper
instead. This refactor is in scope for this PR. Do it before adding proxy calls so
that proxy and direct paths use exactly the same code.

### Steps

1. Add `DAEMON_PROXY_ERROR` to `apps/node/src/contracts/errors.ts`:
   ```typescript
   DAEMON_PROXY_ERROR: "DAEMON_PROXY_ERROR",
   ```
   This code is returned when a request was dispatched to the daemon but the response
   was lost. It must be a registered error code, not a hardcoded string.

2. Add `formatRunExecutionResultForCli` to `output.ts` as specified above.

3. Refactor existing direct-path callers in `execute.ts` and `observe.ts` to use
   `formatRunExecutionResultForCli`. Confirm output is identical before proceeding.

4. Create `apps/node/src/cli/daemonProxy.ts`. Read `tasks/node/daemon/plan.md`
   sections "Decision Rules" and "Failure Modes" before writing.

   **Device ID usage**: the proxy takes the raw `--device` option string as-is. Do NOT
   pre-resolve the device ID. The daemon's `runExecution` resolves it internally. Pass
   the raw value to both `getDaemonSocketPath()` (for socket selection) and to the
   `/execute` request body. If the device is ambiguous (no `--device`, multiple
   connected), the daemon returns `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` - same error
   as direct mode, same behavior.

   **Fallback safety - dispatch boundary**: track whether the HTTP request body has
   been written to the socket. Before writing: pre-dispatch. After writing: post-
   dispatch. Only pre-dispatch failures may fall back to direct. Post-dispatch failures
   must be returned as errors. Classify `snapshot` and `screenshot` as idempotent
   (they may fall back on response loss), but `exec` must not.

   Required exports:

   ```typescript
   export interface DaemonProxyOptions {
     rawDeviceId?: string;      // raw --device option value, may be undefined
     operatorPackage?: string;
     noDaemon?: boolean;
     allowPostDispatchFallback?: boolean; // true only for idempotent wrapper commands
   }

   export interface DaemonHttpSuccess {
     ok: true;
     body: string;
   }

   export interface DaemonHttpFailure {
     ok: false;
     error: unknown;
     dispatched: boolean; // true after the request body was written to the socket
   }

   export interface DaemonProxyDeps {
     spawnDaemonRunFn?: typeof spawnDaemonRun;
     httpGetFn?: (socketPath: string, path: string) => Promise<string>;
     httpPostFn?: (socketPath: string, path: string, body: unknown) => Promise<DaemonHttpSuccess | DaemonHttpFailure>;
     isDaemonAliveFn?: (socketPath: string) => Promise<boolean>;
   }

   // Returns null if proxy is unavailable or opted-out (pre-dispatch only).
   // Returns RunExecutionResult on success.
   // Returns RunExecutionResult with error on non-idempotent post-dispatch failure.
   // May return null after dispatch only when allowPostDispatchFallback is true.
   // Never throws.
   export async function tryDaemonExecution(
     execution: unknown,
     options: DaemonProxyOptions,
     deps?: DaemonProxyDeps
   ): Promise<RunExecutionResult | null>
   ```

   Internal implementation of `tryDaemonExecution`:
   a. If `CLAWPERATOR_NO_DAEMON` env or `options.noDaemon`: return null (pre-dispatch).
   b. If platform is Windows: return null (pre-dispatch).
   c. Get socket path via `getDaemonSocketPath(options.rawDeviceId)` and resolve the
      effective operator package in the CLI process with the existing helper:
      `import { resolveOperatorPackageForRequest } from "../domain/config/resolveOperatorPackage.js";`
      from the new `apps/node/src/cli/daemonProxy.ts`, then call
      `resolveOperatorPackageForRequest(options.operatorPackage)`. This preserves direct
      mode behavior even if an already-running daemon was started with a different
      `CLAWPERATOR_OPERATOR_PACKAGE` environment. Do not create a second precedence
      rule. If the helper moved during an earlier PR, mirror its exact current
      contract: explicit CLI option, then nonblank `CLAWPERATOR_OPERATOR_PACKAGE`, then
      `DEFAULT_OPERATOR_PACKAGE`.
   d. Check liveness: try GET /ping on the socket.
      - ENOENT: go to auto-start (step e).
      - ECONNREFUSED (stale socket): delete socket file; go to auto-start (step e).
      - Alive: check version. If mismatch: call `stopDaemon`; go to auto-start (step e).
      - Version matches: proceed to step (f).
      - All of the above are pre-dispatch.
   e. Auto-start: call `spawnDaemonRun(rawDeviceId, effectiveOperatorPackage)`. Poll
      socket at 100ms intervals up to 3000ms. Unix socket bind is exclusive - if two
      CLIs spawn simultaneously, the second `daemon run` exits on EADDRINUSE; both CLIs
      poll until the first one is connectable. No lock file needed. If timeout: print
      stderr diagnostic; return null.
   f. **Dispatch boundary.** POST to socket `/execute` with
      `{ execution, deviceId: rawDeviceId, operatorPackage: effectiveOperatorPackage }`.
      The production HTTP helper must report whether a failure happened before or after
      the request body was written; the injected `httpPostFn` uses `dispatched` for tests.
   g. Parse JSON response into `RunExecutionResult`.
   h. Return the parsed result.
   i. On response error after dispatch:
      - if `options.allowPostDispatchFallback === true`, return null so the caller can
        safely rerun the idempotent wrapper command directly
      - otherwise return `{ ok: false, error: { code: ERROR_CODES.DAEMON_PROXY_ERROR,
        message: 'Daemon response lost; action may have executed' } }`
      Use `ERROR_CODES` from `errors.ts`. Do NOT fall back to direct for `exec` or action
      commands.

5. Modify `execute.ts`. Replace the `runExecution` call with:
   ```typescript
   const proxyResult = await tryDaemonExecution(payload, {
     rawDeviceId: options.deviceId,
     operatorPackage,
     noDaemon,
     allowPostDispatchFallback: false,
   });
   const result = proxyResult ?? await runExecution(payload, { deviceId: options.deviceId, operatorPackage, ... });
   return formatRunExecutionResultForCli(result, options);
   ```
   `noDaemon` is read from `ctx.noDaemon`, `hasFlag(rest, '--no-daemon')`, or
   `process.env.CLAWPERATOR_NO_DAEMON`.

6. Modify `observe.ts` with the same pattern for `cmdObserveSnapshot` and
   `cmdObserveScreenshot`. Build the execution with `buildSnapshotExecution` or
   `buildScreenshotExecution` before proxying; do not call `observeSnapshot` or
   `observeScreenshot` and then try to proxy after the fact. These wrapper commands are
   read-only and idempotent, so pass `allowPostDispatchFallback: true`; the proxy may
   return null on response loss for these.

7. In `index.ts`, add global parsing for boolean `--no-daemon` and expose it on
   `HandlerContext`. In `registry.ts`, add `"--no-daemon"` to `supportedFlags` for
   `exec`, `snapshot`, and `screenshot`. Both placements are valid:
   `clawperator --no-daemon snapshot` and `clawperator snapshot --no-daemon`. The flag
   must appear in top-level global help and in the command's `--help` output.

8. Update `docs/api/daemon.md` to document: auto-start behavior, opt-out flags,
   post-dispatch fallback boundary and why (double-action risk), and the `snapshot`/
   `screenshot` idempotent exception. Update `docs/api/errors.md` for
   `DAEMON_PROXY_ERROR`. Run `./scripts/docs_build.sh`.

9. Write unit tests in `apps/node/src/test/unit/daemon/daemonProxy.test.ts`. Use
   injectable `deps` parameter - do NOT test against a real socket.

   Required test cases:
   - Returns null when `CLAWPERATOR_NO_DAEMON=1` is set
   - Returns null when `noDaemon: true` is passed
   - `clawperator --no-daemon snapshot` and `clawperator snapshot --no-daemon` both run
     direct and exit 0 on a mocked success path
   - Returns null when auto-start times out (mock `spawnDaemonRun`, mock socket never becomes alive)
   - Returns result when daemon is alive and version matches (mock HTTP)
   - Stops old daemon and restarts when version mismatches (mock stop, spawn, HTTP)
   - Deletes stale socket file and restarts when ECONNREFUSED
   - Passes the effective operator package in the `/execute` request body: explicit
     option beats env; nonblank `CLAWPERATOR_OPERATOR_PACKAGE` is used when no explicit
     option exists; blank env falls back to `DEFAULT_OPERATOR_PACKAGE`; no explicit
     option or env sends `DEFAULT_OPERATOR_PACKAGE`
   - Returns null for `snapshot` on network error after dispatch only when
     `allowPostDispatchFallback: true` is set
   - Returns result with `ERROR_CODES.DAEMON_PROXY_ERROR` for `exec` on response loss
     after dispatch (verify the code matches `errors.ts`)
   - Two concurrent auto-starts: both spawn `daemon run`, socket becomes connectable once,
     both callers receive a result (mock: second spawn exits immediately on EADDRINUSE,
     both poll succeed)
   - `formatRunExecutionResultForCli` on a successful proxied result produces identical
     string to `formatRunExecutionResultForCli` on a direct result for the same fixture

### Acceptance Criteria
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
- All unit tests in `daemonProxy.test.ts` pass.
- With daemon running: `clawperator snapshot --device <id>` proxies (confirm via daemon log).
- With daemon running: `clawperator exec <payload.json> --device <id>` proxies.
- With daemon stopped: `clawperator snapshot --device <id>` auto-starts daemon.
- `CLAWPERATOR_NO_DAEMON=1` runs direct with no daemon interaction.
- `clawperator snapshot --no-daemon --device <id>` runs direct.
- `clawperator --no-daemon snapshot --device <id>` runs direct.
- CLI stdout is identical between proxy and direct paths for the same fixed execution
  input. Wrapper commands with generated IDs must be compared after normalizing
  `commandId` and `taskId`.
- Exit code is 0 on success and 1 on execution failure, same as direct path.
- `[Clawperator-Result]` appears in stdout for terminal-producing executions.
- `./scripts/docs_build.sh` succeeds.

### Validation
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
./scripts/docs_build.sh

node apps/node/dist/cli/index.js daemon start --device <device_id>

# Proxy vs direct diff with a fixed execution payload
printf '%s\n' '{"commandId":"daemon-diff","taskId":"daemon-diff","source":"test","expectedFormat":"android-ui-automator","timeoutMs":30000,"actions":[{"id":"close","type":"close_app","params":{"applicationId":"com.android.settings"}}]}' > /tmp/daemon-diff.json
node apps/node/dist/cli/index.js exec /tmp/daemon-diff.json --device <device_id> > /tmp/proxy-out.json
CLAWPERATOR_NO_DAEMON=1 node apps/node/dist/cli/index.js exec /tmp/daemon-diff.json --device <device_id> > /tmp/direct-out.json
diff /tmp/proxy-out.json /tmp/direct-out.json

# Verify auto-start
node apps/node/dist/cli/index.js daemon stop --device <device_id>
node apps/node/dist/cli/index.js snapshot --device <device_id>
node apps/node/dist/cli/index.js daemon status --device <device_id>

node apps/node/dist/cli/index.js daemon stop --device <device_id>
```

### Expected Commit
```text
feat(node): proxy exec, snapshot, screenshot through background daemon (#<n>)
```

---

## Phase 4: Expand Proxy to All Flat Action Commands + Readiness Cache

### Agent Tier
default

### Goal
Apply the same proxy-before-direct pattern from Phase 3 to all flat action commands in
`action.ts`, plus registry-only flat commands that build executions through
`cmdExecute` (`wait-for-nav`, `read-value`). Also implement the in-process readiness
cache in `deviceInteractivity.ts` so the daemon's warm process state eliminates the
per-call handshake overhead for all callers. Both halves of this phase must land in the
same PR - the proxy expansion and the cache work together.

### Files to Change
- `apps/node/src/cli/commands/action.ts`
- `apps/node/src/cli/registry.ts` (add `--no-daemon` to action command supported flags and thread `ctx.noDaemon`)
- `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` (add cache)
- `apps/node/src/domain/executions/runExecution.ts` (wire cached call)
- `apps/node/src/test/unit/daemon/actionProxy.test.ts` (new or extend existing)
- `apps/node/src/test/unit/doctor/deviceInteractivity.test.ts` (extend existing) or
  `apps/node/src/test/unit/domain/readiness/deviceInteractivity.test.ts` (new)

### Part A: Proxy Expansion

1. Read `apps/node/src/cli/commands/action.ts` in full. Identify all exported `cmd*`
   functions that call `runExecution`. List them explicitly before writing any changes.

2. For each `cmd*` function, apply the same proxy-before-direct pattern used in
   Phase 3. The pattern is always:
   ```typescript
   const proxyResult = await tryDaemonExecution(execution, {
     rawDeviceId: options.deviceId,
     operatorPackage,
     noDaemon,
     allowPostDispatchFallback: false,
   });
   const result = proxyResult ?? await runExecution(execution, { deviceId: options.deviceId, operatorPackage, ... });
   return formatRunExecutionResultForCli(result, options);
   ```
   `noDaemon` must be threaded from the calling options object. Add `noDaemon?: boolean`
   to each options interface that does not already have it. These are all mutating
   commands - post-dispatch response loss must NOT fall back to direct (the proxy's
   error return is the correct behavior).

3. Note: `close_app`-only executions bypass `ensureInteractiveAutomationReady` in
   `runExecution.ts` today. The daemon's `/execute` route preserves this behavior
   because it calls `runExecution` internally. No special handling is needed in the
   proxy for `close_app`.

4. In `registry.ts`, add `"--no-daemon"` to `supportedFlags` for each action command
   (open, close, click, type, read, wait, press, back, scroll, scroll-until,
   scroll-and-click, sleep, wait-for-nav, read-value, etc.). Thread `ctx.noDaemon` into
   command options. For `wait-for-nav` and `read-value`, which currently call
   `cmdExecute`, pass `noDaemon` into `cmdExecute` so their opt-out behavior matches the
   other flat commands.

5. Write unit tests in `actionProxy.test.ts`:
   - One representative action command (e.g., `cmdActionClick`) proxies to daemon when
     available (mock `tryDaemonExecution`).
   - Same command falls back to direct when `tryDaemonExecution` returns null (mock).
   - `--no-daemon` disables proxy for action commands.
   These tests prove the wiring pattern. The proxy behavior itself is already covered by
   `daemonProxy.test.ts` from Phase 3.

### Part B: Readiness Cache

The in-process cache eliminates the ~410ms `doctor_ping` handshake on warm daemon calls.
Combined with the daemon, all callers (including subprocess skills) share this warm state.

All decisions below are locked. Do not re-derive them.

**Cache constants (add to `deviceInteractivity.ts`):**
```typescript
const READINESS_CACHE_TTL_MS = 8000; // 8 seconds
```

**Cache key formula:**
```typescript
export function buildReadinessCacheKey(resolvedDeviceId: string, operatorPackage: string): string {
  return `${resolvedDeviceId}:${operatorPackage}`;
}
```
Both inputs are post-resolution values. The resolved device ID is used (not the raw
`--device` option string) so network ADB serials like `192.168.1.1:5555` resolve to
a stable key without needing extra sanitization here.

**Cache store (module-level, in `deviceInteractivity.ts`):**
```typescript
const readinessCache = new Map<string, number>(); // key -> timestamp of last success
```

**New exports from `deviceInteractivity.ts`:**

```typescript
export function buildReadinessCacheKey(resolvedDeviceId: string, operatorPackage: string): string

export async function ensureInteractiveAutomationReadyCached(
  config: RuntimeConfig,
  options?: Parameters<typeof ensureInteractiveAutomationReady>[1]
): Promise<InteractiveAutomationReadyResult>
// On cache hit within TTL: return immediately without calling the real probe.
// On cache miss: call ensureInteractiveAutomationReady. On success: store timestamp.
// On any cache-invalidating error: invalidate the key (if present) and return the error.

export function invalidateReadinessCache(resolvedDeviceId: string, operatorPackage: string): void
// Deletes the cache entry for this key. Idempotent - no-op if key not present.

export function clearReadinessCacheForTesting(): void
// Clears the entire cache map. For use in tests only.

export function invalidateReadinessCacheForErrorCode(
  resolvedDeviceId: string,
  operatorPackage: string,
  code: string | undefined | null
): void
// Invalidates only when code is one of the locked invalidation triggers.
```

6. Implement the exports above in `deviceInteractivity.ts`. `ensureInteractiveAutomationReadyCached`
   must keep the same call shape as `ensureInteractiveAutomationReady` so
   `RunExecutionOptions.ensureInteractiveAutomationReadyFn` remains injectable. Build
   the key from `config.deviceId` and `config.operatorPackage`; `runExecution.ts`
   sets `config.deviceId` to the resolved device ID before calling readiness. If a test
   calls the cached helper without `config.deviceId`, fail closed by skipping the cache
   and delegating to `ensureInteractiveAutomationReady`.

   Call
   `ensureInteractiveAutomationReady` (the existing function) as the cache miss path
   inside `ensureInteractiveAutomationReadyCached`. Do NOT modify `ensureInteractiveAutomationReady`
   itself.

**Invalidation triggers (deterministic - do not add others without explicit decision):**
Delete the cache key when any of these failures is observed:
1. `DEVICE_NOT_INTERACTIVE`
2. `DEVICE_ACCESSIBILITY_NOT_RUNNING`
3. `DEVICE_SHELL_UNAVAILABLE`
4. `BROADCAST_FAILED`
5. `RESULT_ENVELOPE_TIMEOUT`
6. Android envelope `errorCode === "SERVICE_UNAVAILABLE"` (this string is documented
   in `docs/api/errors.md` as Android-emitted and is not currently part of the Node
   `ERROR_CODES` enum)
7. TTL expiry (implicit - the timestamp comparison handles this on the next cache read)

The first five are checked against `ERROR_CODES` from `apps/node/src/contracts/errors.ts`.
`SERVICE_UNAVAILABLE` is checked as a runtime envelope `errorCode` string, not as
`ERROR_CODES.SERVICE_UNAVAILABLE`.

7. In `runExecution.ts`: find the call to `ensureInteractiveAutomationReady` and
   replace the default with `ensureInteractiveAutomationReadyCached`. Preserve the
   existing `options.ensureInteractiveAutomationReadyFn` injection point for tests.
   After the readiness call, invalidate the cache in `runExecution.ts` when later
   runtime failures prove readiness was stale:
   - `runCloseAppPreflight` returns `DEVICE_SHELL_UNAVAILABLE`
   - broadcast failure diagnostics return `BROADCAST_FAILED`
   - timeout diagnostics return `RESULT_ENVELOPE_TIMEOUT`
   - a received result envelope has `status === "failed"` and
     `errorCode === "SERVICE_UNAVAILABLE"`

   The `resolveInteractiveSkillTarget` pre-spawn path in `skills.ts` is NOT modified -
   that check stays uncached.

8. Write unit tests in `apps/node/src/test/unit/doctor/deviceInteractivity.test.ts`
   or `apps/node/src/test/unit/domain/readiness/deviceInteractivity.test.ts`:
   - Cache hit: second call within TTL skips the real probe (verify probe not called)
   - Cache miss: first call invokes the real probe
   - Cache expiry: call after TTL has elapsed invokes the real probe again
   - Each invalidating readiness error code: verify cache entry is deleted on the
     matching error
   - `invalidateReadinessCache` removes the entry for a specific key only
   - `invalidateReadinessCacheForErrorCode` invalidates only the listed codes and treats
     `SERVICE_UNAVAILABLE` as a string input
   - `clearReadinessCacheForTesting` empties the map completely
   - `buildReadinessCacheKey` produces `${deviceId}:${operatorPackage}`

9. Extend `apps/node/src/test/unit/runExecution.test.ts` for runtime invalidation after
   a previous cache success:
   - `BROADCAST_FAILED` invalidates the cache
   - `RESULT_ENVELOPE_TIMEOUT` invalidates the cache
   - envelope `errorCode: "SERVICE_UNAVAILABLE"` invalidates the cache

### Acceptance Criteria
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
- All `cmd*` functions in `action.ts` use the proxy-before-direct pattern.
- `wait-for-nav` and `read-value` preserve proxy and `--no-daemon` behavior through
  their `cmdExecute` delegation.
- `--no-daemon` flag is listed in `--help` for action commands and works before or
  after the command.
- All readiness cache unit tests pass.
- Runtime invalidation tests pass for `BROADCAST_FAILED`, `RESULT_ENVELOPE_TIMEOUT`,
  and `SERVICE_UNAVAILABLE`.
- With daemon running, action commands are visible in the daemon log.
- With daemon stopped, action commands run direct (no regression).
- Second consecutive proxied snapshot call (within 8s) does not trigger a `doctor_ping`
  broadcast (verify via daemon log).

### Validation
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test

# Proxy expansion check
node apps/node/dist/cli/index.js daemon start --device <device_id>
node apps/node/dist/cli/index.js open-app com.android.settings --device <device_id>
tail -n 20 ~/.clawperator/daemon-<device_id>.log

# Cache effectiveness check: two consecutive snapshots; second should show no doctor_ping
node apps/node/dist/cli/index.js snapshot --device <device_id> > /dev/null
node apps/node/dist/cli/index.js snapshot --device <device_id> > /dev/null
tail -n 40 ~/.clawperator/daemon-<device_id>.log

node apps/node/dist/cli/index.js daemon stop --device <device_id>
```

### Expected Commit
```text
feat(node): expand daemon proxy to action commands and add readiness cache (#<n>)
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
- Branch-local build available at `apps/node/dist/cli/index.js`.
- Note on expected wins: daemon alone (Phases 1-3) eliminates Node startup (~100-200ms
  per call). The ~410ms handshake reduction requires Phase 4 (readiness cache) to also
  be merged. Run Phase 5 after Phase 4 lands if possible; if not, label measurements
  as "daemon only" and record expected additional improvement separately.

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
   printf '%s\n' '{"commandId":"t1","taskId":"t1","source":"timing","expectedFormat":"android-ui-automator","timeoutMs":30000,"actions":[{"id":"close","type":"close_app","params":{"applicationId":"com.android.settings"}}]}' > /tmp/timing-exec.json
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
   - Whether Phase 4 (readiness cache) is merged: yes/no
   - Raw measurement table (A, B cold, B warm, C, D direct, D daemon)
   - Per-call average for direct path
   - Per-call average for daemon warm path
   - First-call overhead for daemon auto-start
   - Breakdown: how much improvement is from startup elimination vs handshake cache
   - Assessment: is the improvement significant enough to confirm the daemon approach?
   - Any anomalies observed

4. If Phase 4 (readiness cache) has merged: re-run Measurements B and C with it active.
   Label these rows "daemon + cache" in the table. The handshake elimination is the
   primary latency win; measurements without the cache should not be presented as the
   full expected improvement.

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
