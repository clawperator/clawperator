# Daemon Closeout Findings

Date: 2026-04-26
Base inspected: `main` at `e4b6e1b4e90cd1be6b15e59ea664250952c33d76`
Original task pack: `tasks/node/daemon/`

## Purpose

This document records the current daemon implementation state relative to the
original `tasks/node/daemon/` task pack. It is source material for a future
closeout task pack. It does not explain why the implementation landed out of
phase, and it does not prescribe a new task breakdown.

## High-Level Finding

`e4b6e1b4e90cd1be6b15e59ea664250952c33d76` contains more than PR-1. The current
codebase includes the server extraction, lifecycle commands, transparent daemon
proxy, flat action rollout, readiness cache, public daemon docs, generated docs
updates, and latency findings.

The remaining work is therefore not to implement PR-2 through PR-5 from scratch.
The remaining work is closeout: verify the landed behavior, fix any contract or
runtime defects, reconcile the temporary task files, and decide what durable
documentation should remain.

## Done

### PR-1 Server Extraction And Socket Transport

Status: implemented.

Evidence:

- `apps/node/src/cli/commands/serve.ts` exports `createServeApp()`.
- `startServer()` accepts `socketPath` as an alternative to TCP `port` and `host`.
- `/ping` returns `{ ok: true }`.
- `/version` returns CLI version metadata and build identity.
- `apps/node/src/test/unit/serve/serve.test.ts` covers serve app health endpoints
  and socket binding.
- `apps/node/package.json` now uses recursive unit and integration test globs, so
  nested daemon and serve tests are included by `npm --prefix apps/node run test`.

### PR-2 Daemon Lifecycle

Status: implemented.

Evidence:

- `apps/node/src/cli/commands/daemon.ts` implements `cmdDaemonRun`,
  `cmdDaemonStart`, `cmdDaemonStop`, `cmdDaemonStatus`, and `cmdDaemonRestart`.
- `apps/node/src/domain/daemon/lifecycle.ts` implements daemon path calculation,
  PID metadata, log paths, lock files, process ownership checks, spawning, stop,
  and metadata helpers.
- `apps/node/src/cli/registry.ts` registers `daemon start|stop|status|restart`
  and keeps `daemon run` internal to command handling rather than advertising it
  in top-level help.
- `docs/api/daemon.md` documents daemon lifecycle commands and output shapes.
- `apps/node/src/test/unit/daemon/lifecycle.test.ts` covers lifecycle behavior,
  stale sockets, concurrent starts, ownership, and startup failure cases.

### PR-3 Transparent Proxy For Exec, Snapshot, And Screenshot

Status: implemented.

Evidence:

- `apps/node/src/cli/daemonProxy.ts` implements `tryDaemonExecution()`, daemon
  startup, stale socket cleanup, version and build identity checks, daemon HTTP
  POST handling, and post-dispatch error behavior.
- `apps/node/src/contracts/errors.ts` includes `DAEMON_PROXY_ERROR`.
- `apps/node/src/cli/output.ts` includes `formatRunExecutionResultForCli()`.
- `apps/node/src/cli/commands/execute.ts` uses the proxy path for `exec`.
- `apps/node/src/cli/commands/observe.ts` uses the proxy path for `snapshot` and
  `screenshot`.
- `apps/node/src/cli/index.ts` parses global `--no-daemon`.
- `apps/node/src/cli/registry.ts` supports command-local `--no-daemon` for the
  proxied commands.
- `docs/api/daemon.md` documents transparent proxying, opt-out behavior, version
  policy, and dispatch-boundary fallback rules.
- `docs/api/errors.md` documents daemon lifecycle and proxy errors.
- `apps/node/src/test/unit/daemon/daemonProxy.test.ts`,
  `apps/node/src/test/unit/executeCommand.test.ts`, and
  `apps/node/src/test/unit/observe.test.ts` cover core proxy behavior.

### PR-4 Flat Action Rollout And Readiness Cache

Status: implemented.

Evidence:

- `apps/node/src/cli/commands/action.ts` imports and uses `tryDaemonExecution()`.
- `apps/node/src/cli/registry.ts` exposes `--no-daemon` on flat action commands
  such as `click`, `open`, `type`, `read`, `wait`, `press`, `back`, `close`,
  `sleep`, `scroll`, `scroll-until`, `wait-for-nav`, and `read-value`.
- `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` includes a readiness
  cache keyed by resolved device ID and operator package.
- `apps/node/src/domain/executions/runExecution.ts` uses the cached readiness path
  and invalidates cache entries for relevant error codes.
- `apps/node/src/test/unit/daemon/actionProxy.test.ts` covers action proxy wiring.
- `apps/node/src/test/unit/doctor/deviceInteractivity.test.ts` covers readiness
  cache behavior.
- `tasks/node/daemon/findings.md` says Phase 4 readiness cache was active during
  latency measurements.

### PR-5 Latency Findings

Status: implemented as temporary findings.

Evidence:

- `tasks/node/daemon/findings.md` records direct versus daemon measurements for
  snapshot and `exec close_app`.
- The measurements include direct, daemon cold start, daemon warm, and cache-active
  cases.
- The findings state the observed daemon benefit is strongest for repeated
  snapshot-style calls and small for short host-side executions.

## Remaining Work

### Verify The Landed Implementation End To End

Run the branch-local Node validation before relying on the implementation:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

If a connected Android device is available, run live smoke using the branch-local
CLI and the debug operator package where appropriate:

```bash
node apps/node/dist/cli/index.js daemon start --device <device_id> --operator-package com.clawperator.operator.dev
node apps/node/dist/cli/index.js daemon status --device <device_id>
node apps/node/dist/cli/index.js snapshot --device <device_id> --operator-package com.clawperator.operator.dev
node apps/node/dist/cli/index.js snapshot --no-daemon --device <device_id> --operator-package com.clawperator.operator.dev
node apps/node/dist/cli/index.js daemon stop --device <device_id>
```

Important live checks:

- `daemon start` exits after spawning the background process.
- `daemon status` reports a running PID, version, build identity, uptime, and
  socket path.
- `daemon run` is not visible in top-level help.
- `snapshot`, `screenshot`, and `exec` preserve CLI JSON shape and exit-code
  behavior through both proxy and direct paths.
- `--no-daemon` works before and after the command.
- `CLAWPERATOR_NO_DAEMON=1` forces direct execution.
- No raw HTTP response body is ever passed through as CLI stdout.

### Run A Review Swarm Loop

The implementation landed broadly enough that it should receive a closeout review
instead of phase-by-phase review. The durable scope should include:

- Daemon lifecycle process ownership and stale file handling.
- Proxy fallback boundaries before and after dispatch.
- CLI output shape and exit-code preservation.
- Device ID and operator package propagation.
- `--no-daemon` global and command-local parsing.
- Readiness cache keying, TTL, and invalidation.
- Public docs accuracy.
- Test coverage gaps and false-confidence tests.

Any material findings should be fixed in code or docs and committed as narrow
follow-up commits.

### Reconcile Temporary Task Files

The original `tasks/node/daemon/` pack is no longer an unimplemented plan. It now
contains a mix of historical plan, work breakdown, review edits, and completed
latency findings.

Future closeout should decide whether to:

- Mark the original task pack as completed and keep it until closeout is finished.
- Move durable behavior notes into `docs/` or internal design docs.
- Delete obsolete temporary task files once durable material has been migrated.
- Preserve only measurement findings that still matter, or move them to an
  appropriate permanent location if they are useful after the task pack is removed.

### Check Documentation Boundaries

`docs/api/daemon.md` now documents full transparent proxy behavior. That is
appropriate only if the landed implementation is considered shipped behavior on
`main`.

Closeout should verify:

- `docs/api/daemon.md` matches the code in `apps/node/src/cli/daemonProxy.ts`,
  `apps/node/src/cli/commands/daemon.ts`, and `apps/node/src/cli/registry.ts`.
- `docs/api/errors.md` accurately describes `DAEMON_START_FAILED`,
  `DAEMON_STOP_FAILED`, and `DAEMON_PROXY_ERROR`.
- Generated docs output was regenerated from canonical sources.
- No docs page describes aspirational daemon behavior that is not implemented.

### Confirm Public Contract Preservation

The original task pack identified CLI contract preservation as the main risk. The
landed code added `formatRunExecutionResultForCli()`, but closeout still needs to
verify behavior rather than only implementation shape.

Specific comparisons to run:

- Direct versus proxied `snapshot` stdout shape.
- Direct versus proxied `screenshot` stdout shape.
- Direct versus proxied `exec` success stdout shape.
- Direct versus proxied validation failures.
- Device-resolution failures for no device, multiple devices, and bad explicit
  device ID.
- `DAEMON_PROXY_ERROR` exit code and JSON shape for post-dispatch response loss.

### Confirm Readiness Cache Safety

The cache is now implemented in `deviceInteractivity.ts`. Closeout should verify:

- Cache key uses resolved device ID and effective operator package.
- Cache TTL is short enough for device state changes.
- Cache invalidates on relevant automation failure codes.
- Direct mode and daemon mode do not accidentally share stale state across different
  devices or operator packages.
- Tests cover the safety cases, not only cache-hit happy paths.

### Confirm Daemon Process Hygiene

Closeout should verify:

- Socket, PID, log, and lock paths are deterministic and collision-resistant.
- PID metadata prevents killing unrelated processes after PID reuse.
- Stale socket cleanup removes only stale daemon sockets.
- Concurrent auto-starts do not create duplicate managed daemons.
- Version or build identity mismatch restarts the daemon rather than dispatching to
  stale code.
- Daemon log handling is sufficient for operators to debug startup failures.

## Relevant Files

Implementation:

- `apps/node/src/cli/commands/serve.ts`
- `apps/node/src/cli/commands/daemon.ts`
- `apps/node/src/domain/daemon/lifecycle.ts`
- `apps/node/src/cli/daemonProxy.ts`
- `apps/node/src/cli/commands/execute.ts`
- `apps/node/src/cli/commands/observe.ts`
- `apps/node/src/cli/commands/action.ts`
- `apps/node/src/cli/index.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/output.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/domain/doctor/checks/deviceInteractivity.ts`
- `apps/node/src/domain/executions/runExecution.ts`

Tests:

- `apps/node/src/test/unit/serve/serve.test.ts`
- `apps/node/src/test/unit/daemon/lifecycle.test.ts`
- `apps/node/src/test/unit/daemon/daemonProxy.test.ts`
- `apps/node/src/test/unit/daemon/actionProxy.test.ts`
- `apps/node/src/test/unit/doctor/deviceInteractivity.test.ts`
- `apps/node/src/test/unit/executeCommand.test.ts`
- `apps/node/src/test/unit/observe.test.ts`
- `apps/node/src/test/unit/runExecution.test.ts`

Docs and task files:

- `docs/api/daemon.md`
- `docs/api/errors.md`
- `docs/api/overview.md`
- `sites/docs/mkdocs.yml`
- `sites/docs/static/llms-full.txt`
- `sites/landing/public/llms-full.txt`
- `tasks/node/daemon/plan.md`
- `tasks/node/daemon/work-breakdown.md`
- `tasks/node/daemon/findings.md`

## Closeout Posture

Treat the daemon work as landed but not closed. The next task should be a hardening
and reconciliation pass over an existing implementation, not a continuation of the
old PR-1 through PR-5 rollout sequence.
