# Daemon Closeout Findings

Base commit: `e4b6e1b4e90cd1be6b15e59ea664250952c33d76` (PR #240)
Original task pack: `tasks/node/daemon/`

---

## 1. High-Level Summary

All five phases of the daemon task pack were shipped in a single PR (#240) rather
than the planned five sequential PRs. The complete implementation is on `main`:
server extraction, Unix socket transport, lifecycle commands, transparent proxy for
all proxied commands, readiness cache, public docs, and latency measurements.

The remaining work is closeout - not continuation. Three small code/doc fixes are
needed, one behavioral question must be decided, and the temporary task files need
cleanup once correctness is confirmed.

---

## 2. What Is Implemented

### Serve infrastructure (Phase 1)

- `apps/node/src/cli/commands/serve.ts` - `createServeApp()` extracted; `startServer()`
  accepts `socketPath` (Unix) or `port`/`host` (TCP); throws if both or neither provided.
- `GET /ping` returns `{ ok: true }`. `GET /version` returns `{ version, buildIdentity }`.
- `apps/node/package.json` test glob updated to `dist/test/unit/**/*.test.js`.
- `apps/node/src/test/unit/serve/serve.test.ts` covers health endpoints and socket binding.

### Daemon lifecycle (Phase 2)

- `apps/node/src/domain/daemon/lifecycle.ts` - path helpers (`getDaemonDir`,
  `getDaemonSocketPath`, `getDaemonPidPath`, `getDaemonLogPath`, `getDaemonLockPath`),
  `sanitizeDaemonKey`, `withDaemonLock`, `isDaemonRunning`, `stopDaemon`,
  `spawnDaemonRun`, `readDaemonPidMetadata`, `writeDaemonPidMetadata`, `cleanupDaemonFiles`.
- Daemon files live under `~/.clawperator/daemon/` with mode `0700`.
  Socket, PID, log, and lock files are all named `daemon-<key>.<ext>`.
- `apps/node/src/cli/commands/daemon.ts` - `cmdDaemonRun`, `cmdDaemonStart`,
  `cmdDaemonStop`, `cmdDaemonStatus`, `cmdDaemonRestart`.
- `daemon start|stop|status|restart` registered in `registry.ts` with `topLevelBlock`
  (visible in top-level help). `daemon run` is registered but absent from all
  `--help` output.
- `DAEMON_START_FAILED`, `DAEMON_STOP_FAILED`, `DAEMON_PROXY_ERROR` in
  `apps/node/src/contracts/errors.ts`.
- `apps/node/src/test/unit/daemon/lifecycle.test.ts` covers path helpers,
  `sanitizeDaemonKey`, ownership checks, stop, lock, and concurrent-start handling.

### Transparent proxy (Phase 3)

- `apps/node/src/cli/daemonProxy.ts` - `tryDaemonExecution()`, `ensureDaemonReady()`,
  stale socket cleanup, version + build identity match, `hasCallerRelativeScreenshotPath`,
  post-dispatch safety boundary, `getDaemonPostTimeoutMs`.
- `formatRunExecutionResultForCli()` added to `apps/node/src/cli/output.ts` and used
  by both proxy and direct paths.
- `apps/node/src/cli/commands/execute.ts` - proxy-before-direct for `exec`;
  `allowPostDispatchFallback: false`.
- `apps/node/src/cli/commands/observe.ts` - proxy-before-direct for `snapshot`
  (`allowPostDispatchFallback: true`) and `screenshot` (`allowPostDispatchFallback: false`).
  Screenshots with caller-relative paths skip the proxy entirely via
  `hasCallerRelativeScreenshotPath`.
- Global `--no-daemon` parsed in `apps/node/src/cli/index.ts`.
  Command-local `--no-daemon` in `supportedFlags` for `exec`, `snapshot`, `screenshot`.
  `CLAWPERATOR_NO_DAEMON=1` env opt-out also checked in `tryDaemonExecution`.
- `apps/node/src/test/unit/daemon/daemonProxy.test.ts` covers proxy edge cases.

### Flat action proxy and readiness cache (Phase 4)

- All flat action commands in `apps/node/src/cli/commands/action.ts` wire
  `tryDaemonExecution` before `runExecution` with `allowPostDispatchFallback: false`.
  `--no-daemon` in `supportedFlags` for all action commands in `registry.ts`.
- Readiness cache in `apps/node/src/domain/doctor/checks/deviceInteractivity.ts`:
  TTL 8s, keyed on `resolvedDeviceId:operatorPackage`, module-level `Map<string, number>`.
  Exports: `buildReadinessCacheKey`, `ensureInteractiveAutomationReadyCached`,
  `invalidateReadinessCache`, `invalidateReadinessCacheForErrorCode`,
  `clearReadinessCacheForTesting`.
  Invalidation codes: `DEVICE_NOT_INTERACTIVE`, `DEVICE_ACCESSIBILITY_NOT_RUNNING`,
  `DEVICE_SHELL_UNAVAILABLE`, `BROADCAST_FAILED`, `RESULT_ENVELOPE_TIMEOUT`,
  `"SERVICE_UNAVAILABLE"` (string, not an `ERROR_CODES` entry).
- `apps/node/src/domain/executions/runExecution.ts` defaults to
  `ensureInteractiveAutomationReadyCached`; injection point preserved for tests.
- `apps/node/src/test/unit/daemon/actionProxy.test.ts` and
  `apps/node/src/test/unit/doctor/deviceInteractivity.test.ts` cover Phase 4.

### Docs

- `docs/api/daemon.md` - full daemon reference: lifecycle commands, JSON output
  shapes, path formula (with base64url key examples), version/build identity policy,
  proxy behavior, `--no-daemon` and `CLAWPERATOR_NO_DAEMON=1` opt-out, post-dispatch
  fallback boundary, error codes.
- `docs/api/errors.md` - daemon lifecycle and proxy error codes documented.
- `docs/api/overview.md` - daemon link added.
- `sites/docs/mkdocs.yml` - daemon page in API nav.

### Latency findings (Phase 5)

- `tasks/node/daemon/findings.md` - four measurements with Phase 4 cache active.
  Warm daemon snapshot: 0.742s vs direct 1.156s (36% faster, five calls).
  `close_app` exec: 0.207s vs 0.217s direct (within noise).

---

## 3. Verified Deviations From Plan

### A. `sanitizeDaemonKey` uses base64url encoding, not colon-to-hyphen

**Plan said:** replace `:` with `-`, remove `/` and whitespace;
`192.168.1.1:5555` - `192.168.1.1-5555`.

**Code** (`lifecycle.ts:158-163`): non-empty IDs become
`id-<base64url(rawDeviceId)>`.

**Assessment:** intentional improvement - base64url avoids collisions between
device IDs that differ only by separator characters. `docs/api/daemon.md` reflects
the base64url output correctly. `plan.md` Deterministic section is stale.

### B. Lock file implemented despite plan saying "not used for MVP"

**Plan said:** Unix domain socket bind is the natural exclusive lock; no lock file
needed.

**Code** (`lifecycle.ts:195-231`, `daemonProxy.ts:253-271`): `withDaemonLock()`
uses `openSync(lockPath, "wx")` with 3000ms timeout and 25ms polling. Called from
`cmdDaemonStart`, `cmdDaemonRun`, and `ensureDaemonReady`.

**Assessment:** this adds stale-lock risk the plan explicitly sought to avoid
(a crashed holder leaves a lock file until the next dead-PID cleanup). The lock
also serializes concurrent auto-starts, which the plan said were naturally handled
by `EADDRINUSE` on socket bind. Intentionality is unconfirmed; see Section 4.

### C. `screenshot` post-dispatch fallback is `false`, not `true`

**Plan said:** `screenshot` is an idempotent wrapper and may fall back after dispatch.

**Code** (`observe.ts:59`): `cmdObserveScreenshot` passes
`allowPostDispatchFallback: false`. Screenshots with caller-relative paths skip
the proxy entirely (`hasCallerRelativeScreenshotPath` returns early). For screenshots
with no path or an absolute path, a lost daemon response returns `DAEMON_PROXY_ERROR`
instead of falling back to direct.

**Assessment:** the relative-path guard is an improvement, but it does not replace
the fallback for the no-path / absolute-path cases the plan treated as idempotent.
Whether this is intentional must be decided; see Section 4.

### D. Version check uses build identity in addition to version string

**Plan said:** exact string match on `cliVersion === daemonVersion` only.

**Code** (`daemonProxy.ts:187-193`): `daemonVersionMatches()` also compares
`entryPath`, `mtimeMs`, and `size` from `getCliBuildIdentity()`. The `/version`
endpoint returns both fields.

**Assessment:** intentional improvement - catches same-version binaries replaced
on disk. `docs/api/daemon.md` documents the build identity policy. `plan.md`
Version check section is stale.

### E. `cmdDaemonRun` writes PID metadata after server starts, not before

**Plan said:** write the metadata file BEFORE starting the server.

**Code** (`daemon.ts:181-192`): `startServer({ socketPath, ... })` is awaited
first, then `writeDaemonPidMetadata` is called (inside `withDaemonLock`). If
`startServer` throws, no PID file is written.

**Assessment:** practically safe - no caller can reach the socket before the server
is listening, and `daemon status` / `daemon stop` check the PID file anyway. Not
a correctness issue; just differs from the plan's stated order.

---

## 4. Gaps / Risks / Things To Verify

**`registry.ts:314` HELP_DAEMON path is wrong** (confirmed against code).
The inline help says "The daemon uses a Unix domain socket under `~/.clawperator/`."
The actual path is `~/.clawperator/daemon/`. This is what an operator sees when they
run `clawperator daemon --help`. Fix required.

**`screenshot` fallback intentionality must be decided.**
`allowPostDispatchFallback: false` means a lost daemon response for a screenshot with
no path or an absolute path returns `DAEMON_PROXY_ERROR` to the caller, who must retry
manually. If that is the intended behavior, add a brief comment in `observe.ts` and
document it in `docs/api/daemon.md`. If it was unintentional, revert to `true` and add
a test covering the absolute-path case.

**`withDaemonLock` stale-lock risk.**
A crashed daemon process could leave a `.lock` file that blocks subsequent starts until
the next dead-PID cleanup cycle (at most 3000ms timeout). The plan explicitly avoided
this risk. The lock is not wrong, but the decision to add it should be confirmed and
the stale-lock cleanup behavior verified by test or comment.

**Live device smoke has not been confirmed** by this analysis. The following
verification should be run before treating the work as fully closed:

- Proxied `snapshot` stdout identical to `CLAWPERATOR_NO_DAEMON=1 snapshot` (after
  normalizing generated `commandId`/`taskId`).
- `daemon stop` then `snapshot` triggers auto-start and proxies correctly.
- `--no-daemon` before and after the command both force direct.
- `CLAWPERATOR_NO_DAEMON=1` forces direct.
- `daemon status` returns `pid`, `version`, `buildIdentity`, `uptimeSeconds`,
  `socketPath`.

---

## 5. Required Closeout Work

1. **Fix `registry.ts:314` HELP_DAEMON path string.**
   Change `~/.clawperator/` to `~/.clawperator/daemon/`. One line.

2. **Decide `screenshot` `allowPostDispatchFallback` intentionality.**
   Either add a comment in `observe.ts` explaining why `false` is correct for the
   absolute-path case, or change to `true` with a targeted test.

3. **Run validation clean.**

   ```bash
   npm --prefix apps/node run build && npm --prefix apps/node run test
   ./scripts/docs_build.sh
   ```

4. **Live device proxy/direct stdout diff** (if device available).

   ```bash
   node apps/node/dist/cli/index.js daemon start --device <device_id> --operator-package com.clawperator.operator.dev
   node apps/node/dist/cli/index.js snapshot --device <device_id> > /tmp/proxy.json
   CLAWPERATOR_NO_DAEMON=1 node apps/node/dist/cli/index.js snapshot --device <device_id> > /tmp/direct.json
   # normalize commandId/taskId before diffing
   node apps/node/dist/cli/index.js daemon stop --device <device_id>
   ```

5. **Update `tasks/node/io-optimizations/findings.md`** to note that subprocess
   skill latency is reduced via daemon proxy (per `plan.md` Durable Follow-Up item 4).

---

## 6. Task and Docs Cleanup

**After items 1-5 above are done:**

- Delete `tasks/node/daemon/` - all five phases are shipped; the plan and
  work-breakdown are now stale. The latency findings in `tasks/node/daemon/findings.md`
  can be deleted unless referenced from `tasks/node/io-optimizations/findings.md`.
- Delete `tasks/node/daemon-closeeout/` once this findings document is no longer needed
  as active reference.

**Nothing in `docs/api/daemon.md` or `docs/api/errors.md` needs deletion.** Those
are correct canonical docs for shipped behavior. `docs/api/daemon.md` correctly
documents `~/.clawperator/daemon/` paths, base64url key encoding, build identity
version policy, and all proxy behaviors.

---

## Relevant Files

| File | Role |
| --- | --- |
| `apps/node/src/cli/commands/serve.ts` | `createServeApp`, Unix socket, `/ping`, `/version` |
| `apps/node/src/domain/daemon/lifecycle.ts` | Paths, lock, spawn, stop, PID metadata |
| `apps/node/src/cli/commands/daemon.ts` | Lifecycle commands |
| `apps/node/src/cli/daemonProxy.ts` | `tryDaemonExecution`, version/build check, fallback boundary |
| `apps/node/src/cli/output.ts` | `formatRunExecutionResultForCli` |
| `apps/node/src/cli/commands/execute.ts` | `exec` proxy wiring |
| `apps/node/src/cli/commands/observe.ts` | `snapshot`/`screenshot` proxy wiring |
| `apps/node/src/cli/commands/action.ts` | Flat action command proxy wiring |
| `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` | Readiness cache |
| `apps/node/src/domain/executions/runExecution.ts` | Cached readiness default |
| `apps/node/src/cli/registry.ts` | Daemon registration, `--no-daemon` support, HELP_DAEMON (stale path - fix needed) |
| `apps/node/src/cli/index.ts` | Global `--no-daemon` parsing |
| `apps/node/src/contracts/errors.ts` | Daemon error codes |
| `apps/node/src/domain/version/compatibility.ts` | `getCliVersion`, `getCliBuildIdentity` |
| `docs/api/daemon.md` | Public daemon reference |
| `docs/api/errors.md` | Daemon error codes |
| `tasks/node/daemon/findings.md` | Latency measurements |
