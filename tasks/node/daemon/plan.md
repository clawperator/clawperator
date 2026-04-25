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
| PR-4 | Expand proxy to all flat action commands | Phase 4 |
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
`execFileSync` - benefit from an in-process readiness cache and warm device state by
transparently proxying commands through a background daemon built on the existing
`clawperator serve` Express server.

## Why Now

- Commit 698e7edc (Node I/O optimization) landed the fast logcat path. The remaining
  ~410ms per-command cost is the `doctor_ping` handshake.
- `tasks/node/handshaking/` plans an in-process readiness cache that reduces this to
  near-zero on warm hits - but only for callers sharing a process. Skills are subprocess
  chains and cannot benefit from an in-process cache without a daemon.
- The daemon is the natural completion of the serve infrastructure already in the repo.
  `serve.ts` exists and is production-grade; this task adds the missing connective tissue.

## In Scope

- Extracting `createApp()` from `startServer()` in `serve.ts` so the app can be reused
  without binding a TCP port.
- Adding Unix domain socket support to `startServer()` (`socketPath` option alongside
  existing `port`/`host`).
- Adding `GET /ping` and `GET /version` health endpoints to the Express app.
- `clawperator daemon start|stop|status|restart` lifecycle commands.
- PID file, socket file, and log file lifecycle management under `~/.clawperator/`.
- A daemon proxy layer (`daemonProxy.ts`) for CLI commands with auto-start, liveness
  check, version verification, and direct-mode fallback.
- Proxy support for `exec`, `snapshot`, `screenshot`, and all flat action commands.
- `--no-daemon` flag and `CLAWPERATOR_NO_DAEMON=1` env opt-out.
- Unit tests for all new code.
- Latency benchmark measurements (Phase 5).

## Out of Scope

- Windows named pipe transport (deferred; Unix socket only for this task pack).
- MCP transport changes.
- Android-side changes.
- Changes to the `clawperator serve` TCP/HTTP behavior or public API shape.
- Changes to skill package files in `../clawperator-skills`.
- The `skills.ts` pre-spawn readiness check (stays uncached per the handshaking plan).
- The in-process readiness cache itself (owned by `tasks/node/handshaking/plan.md`).
  That PR should land before or alongside Phase 4 to maximize daemon benefit.
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

- Socket path formula: `~/.clawperator/daemon-<resolvedDeviceId>.sock`
- PID path formula: `~/.clawperator/daemon-<resolvedDeviceId>.pid`
- Log path formula: `~/.clawperator/daemon-<resolvedDeviceId>.log`
- Auto-start timeout: 3000ms (3 seconds)
- Version check endpoint: `GET /version` returns `{ version: string }`
- Liveness check endpoint: `GET /ping` returns `{ ok: true }`
- Version mismatch action: kill old daemon, start fresh, wait up to 3s
- Stale socket action: socket file exists, connection refused - delete + restart
- Direct fallback condition: daemon unreachable after auto-start timeout
- Device scope fallback: device unresolvable without `--device` flag (multiple devices
  connected, none specified) - skip daemon, run direct silently
- Opt-out check: `CLAWPERATOR_NO_DAEMON=1` env OR `--no-daemon` flag - skip daemon
- `close_app`-only executions: the daemon's `/execute` route handles these correctly
  (the serve path already bypasses `ensureInteractiveAutomationReady` for close_app).
  No special handling needed in the proxy layer.

**Requires judgment:**

- Stderr diagnostic message wording for fallback events
- Log format for daemon process log file
- Whether to print a "daemon started" notice on first auto-start (lean toward silent)

## Decision Rules

### Proxy path selection (first-match-wins)

| Condition | Action |
| --- | --- |
| `CLAWPERATOR_NO_DAEMON=1` or `--no-daemon` flag is set | Skip daemon; run direct |
| Platform is Windows | Skip daemon; run direct |
| `deviceId` is not resolvable without user disambiguation | Skip daemon; run direct |
| Socket file missing | Auto-start daemon (up to 3s); proceed if started; else run direct |
| Socket file present, connection refused | Delete socket; auto-start daemon; proceed if started; else run direct |
| Socket alive but version mismatch | Stop old daemon; auto-start new one; proceed if started; else run direct |
| Socket alive and version matches | Proxy to daemon |
| Proxy request fails (network error) | Log to stderr; fall back to direct for this call; do not invalidate the socket |

### Version check

Use `getCliVersion()` from `apps/node/src/domain/version/compatibility.ts` for both
the daemon's `/version` response and the client-side version to compare against.

Version comparison: exact string match (`cliVersion === daemonVersion`). Semver
comparison is not needed - the daemon and CLI are always the same binary.

### Daemon auto-start

Auto-start is a fire-and-forget spawn of `clawperator daemon start --device <id>` as a
detached child process. The CLI then polls the socket path at 100ms intervals until it
is connectable or 3000ms elapses. If the socket is connectable, proxy the request. If
not, fall back to direct.

### Contract preservation during proxy

The proxy layer must produce CLI stdout output identical to the direct path. The
correct pattern is:

1. POST the `execution` payload and `{ deviceId, operatorPackage }` to `/execute`.
2. Parse the JSON response body into an `ExecutionResult`.
3. Call `formatSuccess` or `formatError` from `apps/node/src/cli/output.ts` with the
   parsed result and the same `options` (format, verbose, etc.) the command received.

Do NOT pass the raw HTTP response body as CLI output. Do NOT skip `formatSuccess` /
`formatError`. Exit codes are set by the `shouldCliStdoutForceExitCode1` logic in
`apps/node/src/cli/index.ts` which operates on the formatted string, not the HTTP
status code.

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

## Output Contract

PR-1 through PR-2 have no user-visible CLI output change. `clawperator serve` continues
to work identically. New `daemon` subcommands output line-oriented status text (not
JSON) to stdout, consistent with other lifecycle commands.

PR-3 onwards: proxied commands produce CLI output that is byte-for-byte identical to
the direct path for the same inputs. This is the verification target for PR-3.

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

## Durable Follow-Up

When this task pack is complete and all PRs are merged:

1. Add `clawperator daemon` to `docs/api/overview.md` and create
   `docs/api/daemon.md` documenting socket path, lifecycle commands, opt-out, and
   version behavior. Use `.agents/skills/docs-author/SKILL.md` for the docs phase.

2. Update `docs/api/errors.md` to note that proxied commands may surface daemon
   startup or connectivity errors as a new `DAEMON_UNAVAILABLE` warning (or similar)
   on stderr before falling back to direct mode.

3. Delete this task pack folder once all 5 PRs are merged and measurements are
   recorded. The final measurements belong in `tasks/node/daemon/findings.md` until
   migration to the permanent measurement log, if one exists.

4. If Phase 5 measurements confirm meaningful latency improvement for skill loops,
   update `tasks/node/io-optimizations/findings.md` to note that subprocess skill
   latency is now reduced via daemon proxy.

5. Coordinate with `tasks/node/handshaking/plan.md`: the in-process readiness cache
   that plan describes becomes maximally effective once the daemon is in place (all
   callers share the daemon's in-process state). Confirm the handshaking PR-1 has
   merged before or alongside Phase 4.
