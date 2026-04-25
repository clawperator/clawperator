# Transparent Background Daemon

## Problem

Every `clawperator` command is a short-lived OS process. Before any execution runs,
each process must independently pay:

1. Node runtime startup and module loading (~100-200ms)
2. Device resolution
3. The full `doctor_ping` readiness handshake - a broadcast + logcat round trip that
   costs ~410ms on a typical device

In `clawperator serve` mode these startup costs are paid once and amortized across all
subsequent requests. But the dominant usage pattern in skills is the subprocess model:
`runClawperator()` in `skills/utils/common.js` calls `execFileSync("clawperator exec
...")` for each action. A skill like `install-app` that chains 10+ commands pays roughly
four seconds in handshake overhead alone, plus per-process startup cost on each call.

A transparent background daemon - where `clawperator snapshot` silently proxies to a
running serve process - makes the serve optimization available to all callers without
changing skill implementations.

**Expected benefit split:**
- Daemon alone (Phases 1-3): saves Node startup and module loading (~100-200ms per
  call) for all proxied commands. Minimal improvement on the `doctor_ping` handshake.
- Daemon + readiness cache (Phase 4 of this task pack adds the cache): saves the full
  ~410ms handshake on warm calls. The cache only works when callers share a process;
  the daemon makes the cache effective for ALL callers, including subprocesses.
  This is the primary latency win the daemon enables.

The key insight is that `apps/node/src/cli/commands/serve.ts` is already the daemon. It
is a 805-line Express HTTP server with routes for every execution path (`/execute`,
`/snapshot`, `/screenshot`, `/skills/:skillId/run`, `/devices`, `/events`). The missing
pieces are: Unix socket transport, PID and socket lifecycle management, CLI auto-start,
and a thin proxy layer in the CLI commands.

## Executive Summary

5-PR, 5-phase project. Each phase ships as its own independently reviewable PR.

| PR | Purpose | Phase(s) |
| --- | --- | --- |
| PR-1 | Extract app creation; add Unix socket transport and health endpoints to serve.ts | Phase 1 |
| PR-2 | `clawperator daemon start|stop|status|restart` lifecycle commands | Phase 2 |
| PR-3 | Proxy layer for `exec`, `snapshot`, `screenshot` with auto-start and opt-out | Phase 3 |
| PR-4 | Expand proxy to all flat action commands; add readiness cache | Phase 4 |
| PR-5 | Benchmark measurement and findings | Phase 5 |

Each PR must be merged before the next begins. PRs 1-2 are non-breaking infrastructure.
PR-3 introduces the first user-visible behavior change. PR-4 is mechanical rollout.
PR-5 is measurement only.

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

## Goal

Make sequential `clawperator` CLI calls - including those made by skills via
`execFileSync` - benefit from warm process state by transparently proxying commands
through a background daemon built on the existing `clawperator serve` Express server.
Once the Phase 4 readiness cache is also in place, all callers share the daemon's
in-process cache, eliminating the per-call handshake overhead.

## Why Now

- Commit 698e7edc (Node I/O optimization) landed the fast logcat path. The remaining
  ~410ms per-command cost is the `doctor_ping` handshake.
- Phase 4 of this task pack adds an in-process readiness cache that reduces the
  per-call handshake to near-zero on warm hits - but only for callers sharing a process.
  Skills are subprocess chains and cannot benefit from an in-process cache without a daemon.
- The daemon is the natural completion of the serve infrastructure already in the repo.
  `serve.ts` exists and is production-grade; this task adds the missing connective tissue.

## In Scope

- Extracting `createApp()` from `startServer()` in `serve.ts` so the app can be reused
  without binding a TCP port.
- Adding Unix domain socket support to `startServer()` (`socketPath` option alongside
  existing `port`/`host`).
- Adding `GET /ping` and `GET /version` health endpoints to the Express app.
- An in-process readiness cache in `deviceInteractivity.ts` with TTL=8s, keyed on
  `${resolvedDeviceId}:${operatorPackage}`, with 7 explicit invalidation triggers:
  TTL expiry, `DEVICE_NOT_INTERACTIVE`, `DEVICE_ACCESSIBILITY_NOT_RUNNING`,
  `DEVICE_SHELL_UNAVAILABLE`, `BROADCAST_FAILED`, `RESULT_ENVELOPE_TIMEOUT`,
  `SERVICE_UNAVAILABLE`. New exports: `ensureInteractiveAutomationReadyCached`,
  `invalidateReadinessCache`, `clearReadinessCacheForTesting`, `buildReadinessCacheKey`.
- Call site wiring in `runExecution.ts`: replace `ensureInteractiveAutomationReady`
  with `ensureInteractiveAutomationReadyCached`. The `skills.ts` pre-spawn readiness
  check stays uncached (no change to `resolveInteractiveSkillTarget`).
- `clawperator daemon start|stop|status|restart` lifecycle commands.
- A hidden `clawperator daemon run` command that is the actual foreground server process
  (see Decision Rules - Daemon lifecycle model).
- PID file, socket file, and log file lifecycle management under `~/.clawperator/`
  created with `0700` permissions.
- A shared `formatRunExecutionResultForCli(result, options)` helper used by both direct
  and proxied command paths, eliminating output divergence.
- A daemon proxy layer (`daemonProxy.ts`) for CLI commands with auto-start, liveness
  check, version verification, and direct-mode fallback.
- Proxy support for `exec`, `snapshot`, `screenshot`, and all flat action commands.
- `--no-daemon` command-local flag and `CLAWPERATOR_NO_DAEMON=1` env opt-out.
- `DAEMON_PROXY_ERROR` added to `apps/node/src/contracts/errors.ts` (new error code for
  post-dispatch proxy failures where the action may have executed but the response was
  lost).
- Brief public docs for `clawperator daemon` landing in the same PR as the command
  (PR-2), using `.agents/skills/docs-author/SKILL.md`.
- Unit tests for all new code, with test glob updated to cover nested test directories.
- Latency benchmark measurements (Phase 5).

## Out of Scope

- Windows named pipe transport (deferred; Unix socket only for this task pack).
- MCP transport changes.
- Android-side changes.
- Changes to the `clawperator serve` TCP/HTTP behavior or public API shape.
- Changes to skill package files in `../clawperator-skills`.
- The `skills.ts` pre-spawn readiness check (stays uncached - `resolveInteractiveSkillTarget`
  is not modified).
- `clawperator doctor` command behavior.
- Streaming/SSE proxy through the daemon socket.
- Multi-device concurrent daemon management beyond one-daemon-per-device.

## Existing Artifact Scope

The primary existing file touched is `apps/node/src/cli/commands/serve.ts`. The
`startServer()` function and `ServeOptions` interface are refactored in PR-1. The
existing TCP behavior is preserved exactly - only the internal structure changes.

`apps/node/src/cli/commands/execute.ts`, `observe.ts`, and `action.ts` are modified in
PR-3 and PR-4 to add a proxy-before-direct pattern. Existing behavior is preserved when
the daemon is absent or opted out.

`apps/node/src/cli/registry.ts` is modified to register the `daemon` command and to add
`--no-daemon` to the supported-flags lists for proxied commands.

## Surfaces and Ownership

| Surface | Files | Owner |
| --- | --- | --- |
| Server extraction | `apps/node/src/cli/commands/serve.ts` | PR-1 |
| Daemon domain | `apps/node/src/domain/daemon/lifecycle.ts` (new) | PR-2 |
| Daemon CLI command | `apps/node/src/cli/commands/daemon.ts` (new) | PR-2 |
| Proxy layer | `apps/node/src/cli/daemonProxy.ts` (new) | PR-3 |
| Execution commands | `apps/node/src/cli/commands/execute.ts`, `observe.ts` | PR-3 |
| Action commands | `apps/node/src/cli/commands/action.ts` | PR-4 |
| Readiness cache | `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` (modify) | PR-4 |
| Readiness call site | `apps/node/src/domain/executions/runExecution.ts` (modify) | PR-4 |
| CLI registry | `apps/node/src/cli/registry.ts` | PR-2, PR-3, PR-4 |
| Measurement findings | `tasks/node/daemon/findings.md` | PR-5 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| CLI commands, flags, aliases | `apps/node/src/cli/registry.ts` |
| Action types and parameters | `apps/node/src/contracts/execution.ts` |
| Error codes and meanings | `apps/node/src/contracts/errors.ts` |
| Result envelope shape | `apps/node/src/contracts/result.ts` |
| Serve command and routes | `apps/node/src/cli/commands/serve.ts` |
| Version utility | `apps/node/src/domain/version/compatibility.ts` |
| Execution domain | `apps/node/src/domain/executions/runExecution.ts` |
| Skills subprocess model | `../clawperator-skills/skills/utils/common.js` |
| CLI output formatting | `apps/node/src/cli/output.ts` |
| Exit code determination | `apps/node/src/cli/stdoutExitCode.ts` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Socket filename key: sanitize the raw `--device` option by replacing `:` with `-` and
  removing any `/` or whitespace. For `192.168.1.1:5555` use `192.168.1.1-5555`. For
  empty string (no `--device` given), use `default`. Do NOT pre-resolve the device ID.
- Socket path formula: `~/.clawperator/daemon-<sanitizedKey>.sock`
- PID path formula: `~/.clawperator/daemon-<sanitizedKey>.pid`
- Log path formula: `~/.clawperator/daemon-<sanitizedKey>.log`
- Directory creation mode: `0700` (owner-only read/write/execute)
- Auto-start timeout: 3000ms (3 seconds)
- Version check endpoint: `GET /version` returns `{ version: string }`
- Liveness check endpoint: `GET /ping` returns `{ ok: true }`
- `daemon status` output (when running): PID, version, uptime in seconds, socket path.
  The PID file stores the daemon PID; the start timestamp is written alongside it so
  uptime can be computed without an additional IPC call. Required for debugging stuck
  agent loops.
- Version mismatch action: kill old daemon, start fresh, wait up to 3s
- Stale socket action: socket file exists, connection refused - delete + restart
- Fallback condition (pre-connect): daemon unreachable after auto-start timeout -
  run direct for this call
- Fallback condition (post-dispatch): NEVER fall back to direct after the HTTP request
  has been sent to the daemon. Return the error directly; do not retry via direct mode.
- Device scope fallback: `CLAWPERATOR_NO_DAEMON` env OR `--no-daemon` flag - skip
  daemon and run direct. Note: multiple-device ambiguity is detected by the daemon's
  `runExecution` and returns `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` - same error as
  direct mode, so no pre-check needed.
- `close_app`-only executions: the daemon's `/execute` route handles these correctly
  (the serve path already bypasses `ensureInteractiveAutomationReady` for close_app).
  No special handling needed in the proxy layer.
- Shared output helper: `formatRunExecutionResultForCli(result, options)` takes a
  `RunExecutionResult` and `OutputOptions`, calls `formatSuccess({ envelope,
  deviceId, terminalSource, isCanonicalTerminal }, options)` on success or
  `formatError(result.error, options)` on failure. Both direct and proxied paths use
  this helper. Do NOT inline the formatting logic separately in each command.

**Requires judgment:**

- Stderr diagnostic message wording for fallback events
- Log format for daemon process log file
- Whether to print a "daemon started" notice on first auto-start (lean toward silent)
- Whether `daemon status/start/stop/restart` output should be JSON or line-oriented text
  (current plan: line-oriented text, consistent with lifecycle commands)

## Decision Rules

### Proxy path selection (first-match-wins)

| Condition | Action |
| --- | --- |
| `CLAWPERATOR_NO_DAEMON=1` or `--no-daemon` flag is set | Skip daemon; run direct |
| Platform is Windows | Skip daemon; run direct |
| Socket file missing | Auto-start daemon (up to 3s); proceed if started; else run direct |
| Socket file present, connection refused (stale) | Delete socket; auto-start daemon; proceed if started; else run direct |
| Socket alive but version mismatch | Stop old daemon; auto-start new one; proceed if started; else run direct |
| Socket alive and version matches | Proxy to daemon |
| Request not yet dispatched; connection error | Log to stderr; run direct for this call |
| Request already dispatched; any error (response lost, timeout, etc.) | Return error to caller; do NOT retry via direct mode |

### Version check

Use `getCliVersion()` from `apps/node/src/domain/version/compatibility.ts` for both
the daemon's `/version` response and the client-side version to compare against.

Version comparison: exact string match (`cliVersion === daemonVersion`). Semver
comparison is not needed - the daemon and CLI are always the same binary.

### Daemon lifecycle model

Two commands exist; only one is user-facing:

- `clawperator daemon run` (internal, not advertised in top-level help): the foreground
  server process. Starts `startServer({ socketPath })`, writes its own PID file, runs
  until killed. This is the process that IS the daemon.
- `clawperator daemon start` (user-facing): spawns `daemon run` as a detached child
  process with stdout/stderr redirected to the log file. Polls the socket until
  connectable (up to 3s), then exits with a status message. It does NOT itself run the
  server.

`daemon stop`, `daemon status`, and `daemon restart` operate on the PID file and socket
file written by `daemon run`.

The auto-start spawner in `daemonProxy.ts` spawns `daemon run` directly (not
`daemon start`), to avoid a spawn-polling-spawn chain.

### Daemon auto-start flow

Unix domain sockets have exclusive bind semantics. If two CLI processes both try to
spawn `daemon run` at the same moment, the second bind fails with `EADDRINUSE` and that
process exits. Both CLI processes poll and connect to the first one. No lock file is
needed. The socket bind is the natural lock.

1. Spawn `clawperator daemon run --device <id>` as detached child process.
2. Poll socket at 100ms intervals up to 3000ms.
3. If socket is connectable and version matches: proxy request.
4. If timeout: print stderr diagnostic, run direct.

### Contract preservation during proxy

The proxy layer must produce CLI stdout output identical to the direct path. The
correct pattern is:

1. POST the `execution` payload and `{ deviceId, operatorPackage }` to `/execute`.
2. Parse the JSON response body into a `RunExecutionResult`.
3. Call `formatRunExecutionResultForCli(result, options)` - the shared helper that
   calls `formatSuccess({ envelope, deviceId, terminalSource, isCanonicalTerminal },
   options)` on success or `formatError(result.error, options)` on failure.

Do NOT pass the raw HTTP response body as CLI output. Do NOT inline `formatSuccess`
or `formatError` separately in proxy and direct paths - the shared helper is the
contract. Exit codes are set by `shouldCliStdoutForceExitCode1` in
`apps/node/src/cli/index.ts`, which operates on the formatted string, not the HTTP
status code.

Both the direct path (current code in `execute.ts`, `observe.ts`, `action.ts`) and the
proxy path must use this same helper. Refactor the direct path in the same PR that
adds the proxy path (Phase 3).

## Failure Modes To Prevent

1. **Silent contract breakage.** Proxied commands must produce the same stdout JSON
   shape, pretty-print behavior, exit code, and `[Clawperator-Result]` semantics as
   direct commands. A proxy that passes through raw HTTP response bodies will break
   agents that parse CLI output.

2. **Daemon version skew.** A stale daemon running an older binary must not silently
   serve requests to a newer CLI. The version check must happen before proxying.

3. **Zombie sockets.** A socket file left behind by a crashed daemon will cause all
   future auto-starts to stall on a dead socket. Stale socket detection and cleanup
   must be part of the auto-start path.

4. **Ambiguous device binding.** A daemon socket keyed on one device must not silently
   serve requests targeted at a different device. The cache key must use the resolved
   device ID, not the raw `--device` option string.

5. **Multi-device confusion.** When `--device` is omitted and multiple devices are
   connected, device resolution fails. The proxy must detect this before consulting the
   daemon, not after.

6. **Test-only behavior divergence.** Unit tests that mock the daemon socket must
   exercise the same code path as the live proxy. The proxy function must be injectable
   for testing.

7. **Partial proxy rollout regression.** If Phase 4 (action commands) is incomplete,
   some commands proxy and some do not. The proxy must be a fallback (direct still
   works), not a replacement, so partial rollout is safe.

8. **Post-dispatch duplicate side effects.** If a mutating action (`click`, `type`,
   `open-app`, arbitrary `exec`) is dispatched to the daemon and the response is lost,
   falling back to direct re-executes the action. The fallback boundary is strict:
   pre-connect/pre-dispatch failures may fall back to direct; post-dispatch failures
   must return an error and stop. Read-only commands (`snapshot`, `screenshot`) may
   still fall back on response loss because re-execution is safe, but this must be
   classified explicitly - not assumed for all commands.

## Output Contract

PR-1: no user-visible change. `clawperator serve` is unchanged.

PR-2: adds `clawperator daemon start|stop|status|restart` with line-oriented status
text output (not JSON). `clawperator daemon run` is a hidden internal command; it should
not appear in top-level `--help` but must still be registered and functional.

PR-3 onwards: proxied commands produce CLI output that is byte-for-byte identical to
the direct path for the same inputs. This is the primary verification target for PR-3.

`GET /ping` response: `{ "ok": true }`
`GET /version` response: `{ "version": "<semver>" }`

## Idempotency

- `daemon start` when the daemon is already running should return a "daemon already
  running" message and exit 0 without starting a second process.
- `daemon stop` when no daemon is running should return "daemon not running" and exit 0.
- `daemon restart` is always `stop + start`, idempotent.
- The socket, PID, and log files must not be left in an inconsistent state if the
  daemon process is killed mid-operation. Stale file cleanup on next `start` or
  `auto-start` is the recovery path.

Note: an atomic lock file (`fs.openSync(lockPath, 'wx')`) was considered for
concurrent auto-start serialization and was intentionally not used for MVP. Unix
domain socket bind is naturally exclusive - if two CLI processes both spawn `daemon
run` simultaneously, the second bind fails with `EADDRINUSE` and that process exits
cleanly. Both callers poll and connect to the first. The socket bind is the natural
lock with no stale-file risk. If concurrent spawn issues arise in practice, a lock
file can be layered on top without changing the rest of the protocol.

## Durable Follow-Up

PR-2 must include a first draft of `docs/api/daemon.md` covering the `daemon`
lifecycle commands, socket path formula, opt-out options, and version policy.
PR-3 must update `docs/api/daemon.md` to document the proxy behavior and the
post-dispatch fallback boundary. Both docs phases must use `.agents/skills/docs-author/
SKILL.md` and run `./scripts/docs_build.sh` before committing.

When this task pack is complete and all PRs are merged:

1. Verify `docs/api/daemon.md` is complete and `docs/api/overview.md` links to it.
   Update both if incomplete.

2. Update `docs/api/errors.md` to note that proxied commands may surface daemon
   startup or connectivity errors as a new `DAEMON_UNAVAILABLE` warning (or similar)
   on stderr before falling back to direct mode.

3. Delete this task pack folder once all 5 PRs are merged and measurements are
   recorded. The final measurements belong in `tasks/node/daemon/findings.md` until
   migration to the permanent measurement log, if one exists.

4. If Phase 5 measurements confirm meaningful latency improvement for skill loops,
   update `tasks/node/io-optimizations/findings.md` to note that subprocess skill
   latency is now reduced via daemon proxy.

5. The in-process readiness cache (implemented in Phase 4) is maximally effective in
   combination with the daemon proxy - all callers, including subprocess skills, share
   the daemon's in-process state. Confirm Phase 4 is complete and the cache is active
   before recording final Phase 5 measurements. Label Phase 5 measurements as "daemon
   only" (Phases 1-3) vs "daemon + cache" (Phase 4 merged) to distinguish the two wins.
