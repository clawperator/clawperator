# Daemon Closeout Findings

## Purpose

This document records what was implemented in the daemon task pack, what deviates from
the original plan, and what remains for closeout. It is intended as raw material for
a closeout task pack.

## High-Level Finding

The original task pack planned 5 sequential PRs. All 5 phases were implemented and
shipped in a single PR (#240, commit `e4b6e1b4`). The functional implementation is
complete and covers every phase described in `tasks/node/daemon/plan.md` and
`tasks/node/daemon/work-breakdown.md`. Several implementation details deviate from
the locked decisions in the plan; most are intentional improvements with
documentation updated to match, but a few are underdocumented or need reconciling.

## Done

### Phase 1 - Server extraction and Unix socket transport

- `createServeApp(options: ServeAppOptions)` extracted from `startServer()` in
  `apps/node/src/cli/commands/serve.ts` (line 154).
- `startServer` now accepts either `port`/`host` or `socketPath`; throws if both or
  neither are provided (line 91-93).
- `GET /ping` and `GET /version` added to `createServeApp`; `/version` returns both
  `version` string and `buildIdentity` object (see Phase 3 note below).
- `apps/node/package.json` test glob updated to `dist/test/unit/**/*.test.js`
  (confirmed at line 33-34 of `package.json`).
- `apps/node/src/test/unit/serve/serve.test.ts` added (151 lines).

### Phase 2 - Daemon lifecycle commands

- `apps/node/src/domain/daemon/lifecycle.ts` created (341 lines). Exports:
  `sanitizeDaemonKey`, `getDaemonDir`, `getDaemonSocketPath`, `getDaemonPidPath`,
  `getDaemonLogPath`, `getDaemonLockPath`, `withDaemonLock`, `isDaemonRunning`,
  `stopDaemon`, `spawnDaemonRun`, `readDaemonPidMetadata`, `writeDaemonPidMetadata`,
  `cleanupDaemonFiles`.
- `apps/node/src/cli/commands/daemon.ts` created (365 lines). Exports:
  `cmdDaemonRun`, `cmdDaemonStart`, `cmdDaemonStop`, `cmdDaemonStatus`,
  `cmdDaemonRestart`.
- `daemon` command registered in `apps/node/src/cli/registry.ts` with subcommands
  `start`, `stop`, `status`, `restart` (line 2671 area). The `daemon run` subcommand
  is registered but intentionally omitted from the daemon `--help` text (see HELP_DAEMON).
- `daemon` has a `topLevelBlock` entry and appears in top-level help.
- `DAEMON_START_FAILED`, `DAEMON_STOP_FAILED`, `DAEMON_PROXY_ERROR` added to
  `apps/node/src/contracts/errors.ts` (lines 75-77).
- Unit tests in `apps/node/src/test/unit/daemon/lifecycle.test.ts` (614 lines).
- `docs/api/daemon.md` created (315 lines).
- `docs/api/errors.md` updated: daemon codes documented (line 135).
- `docs/api/overview.md` updated with daemon link (line 17).
- `sites/docs/mkdocs.yml` updated with daemon page.

### Phase 3 - Proxy layer for exec, snapshot, screenshot

- `apps/node/src/cli/daemonProxy.ts` created (409 lines). Exports:
  `DaemonProxyOptions`, `DaemonHttpSuccess`, `DaemonHttpFailure`, `DaemonProxyDeps`,
  `tryDaemonExecution`, `getDaemonPostTimeoutMs`, `hasCallerRelativeScreenshotPath`,
  `parseDaemonRunExecutionResult`.
- `formatRunExecutionResultForCli` added to `apps/node/src/cli/output.ts` (lines 28-44).
- `apps/node/src/cli/commands/execute.ts` modified: `tryDaemonExecution` wired before
  `runExecution`; `allowPostDispatchFallback: false` for `exec`.
- `apps/node/src/cli/commands/observe.ts` modified: `snapshot` uses
  `allowPostDispatchFallback: true`; `screenshot` uses `allowPostDispatchFallback: false`.
- `--no-daemon` global flag wired in `apps/node/src/cli/index.ts` (line 136, 223-224).
- `--no-daemon` added to `supportedFlags` for `snapshot` and `screenshot` in
  `apps/node/src/cli/registry.ts`.
- Unit tests in `apps/node/src/test/unit/daemon/daemonProxy.test.ts` (571 lines).

### Phase 4 - Expand proxy to action commands and readiness cache

- `apps/node/src/cli/commands/action.ts` modified: all flat action command functions
  wire `tryDaemonExecution` before `runExecution` with `allowPostDispatchFallback: false`.
  `--no-daemon` added to all action command `supportedFlags` in `registry.ts`.
- Readiness cache implemented in
  `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` (lines 73-81, 395-424):
  - `READINESS_CACHE_TTL_MS = 8000`.
  - Module-level `readinessCache = new Map<string, number>()`.
  - `buildReadinessCacheKey`, `invalidateReadinessCache`,
    `invalidateReadinessCacheForErrorCode`, `clearReadinessCacheForTesting`,
    `ensureInteractiveAutomationReadyCached` all exported.
  - Invalidation codes: `DEVICE_NOT_INTERACTIVE`, `DEVICE_ACCESSIBILITY_NOT_RUNNING`,
    `DEVICE_SHELL_UNAVAILABLE`, `BROADCAST_FAILED`, `RESULT_ENVELOPE_TIMEOUT`,
    `"SERVICE_UNAVAILABLE"` (string).
- `apps/node/src/domain/executions/runExecution.ts` updated: default readiness call
  is now `ensureInteractiveAutomationReadyCached` (line 598).
- Unit tests in `apps/node/src/test/unit/daemon/actionProxy.test.ts` (97 lines) and
  `apps/node/src/test/unit/doctor/deviceInteractivity.test.ts` (172 lines).

### Phase 5 - Latency measurements

- `tasks/node/daemon/findings.md` created with all four measurements (Measurements
  A-D). Phase 4 cache was active. Key results: warm daemon snapshot 0.742s vs direct
  1.156s (36% faster); `close_app` daemon/direct diff was within noise (5%).

---

## Deviations From Plan

### 1. `sanitizeDaemonKey` uses base64url encoding, not colon-to-hyphen

**Plan (Deterministic section):** "sanitize the raw `--device` option by replacing
`:` with `-` and removing any `/` or whitespace. For `192.168.1.1:5555` use
`192.168.1.1-5555`."

**Actual** (`lifecycle.ts:158-163`): non-empty device IDs are encoded as
`id-<base64url(rawDeviceId)>`. The `docs/api/daemon.md` table (line 47) reflects the
base64url output.

The public doc was updated to match, but `plan.md` still describes the old formula.
No collision risk from the change, but there is a stale claim in the plan that would
mislead a future agent reading it.

### 2. Daemon directory is `~/.clawperator/daemon/`, not `~/.clawperator/`

**Plan:** "PID file, socket file, and log file lifecycle management under
`~/.clawperator/`."

**Actual** (`lifecycle.ts:166`): `getDaemonDir` returns
`path.join(homedir(), ".clawperator", "daemon")`. HELP_DAEMON in `registry.ts:314`
still says "The daemon uses a Unix domain socket under `~/.clawperator/`", which is
inaccurate - the actual path is `~/.clawperator/daemon/`.

### 3. Lock file was implemented despite plan saying "not used for MVP"

**Plan (Idempotency section):** "An atomic lock file... was considered for concurrent
auto-start serialization and was intentionally not used for MVP. Unix domain socket
bind is naturally exclusive."

**Actual** (`lifecycle.ts:195-231`, `daemonProxy.ts:253-271`): `withDaemonLock` is
implemented using `fs.openSync(lockPath, "wx")` and is called from `cmdDaemonStart`,
`cmdDaemonRun` (via `withDaemonLock`), and `ensureDaemonReady` in `daemonProxy.ts`.
The lock timeout is 3000ms with 25ms polling.

This is a concrete deviation from a locked decision in `plan.md`. The lock was added
to prevent concurrent spawn races that the plan said were handled by Unix socket
exclusive bind. The lock works but adds stale-lock risk that the plan explicitly
sought to avoid.

### 4. `screenshot` uses `allowPostDispatchFallback: false`, not `true`

**Plan (Decision Rules):** "explicitly idempotent wrapper command error - May return
null and run direct once." The plan listed `screenshot` as idempotent alongside
`snapshot`.

**Actual** (`observe.ts:59`): `cmdObserveScreenshot` passes
`allowPostDispatchFallback: false`. Screenshots with relative paths are skipped at
proxy entry via `hasCallerRelativeScreenshotPath` (returning `null` before dispatch).
Screenshots with absolute paths or no path go through with no post-dispatch fallback.

Whether this is intentional is unconfirmed. The plan was explicit: screenshot should
allow post-dispatch fallback. The relative-path guard is an addition, not a
replacement for the fallback.

### 5. Version check uses build identity, not version string only

**Plan (Version check section):** "Version comparison: exact string match
(`cliVersion === daemonVersion`). Semver comparison is not needed."

**Actual** (`daemonProxy.ts:187-193`): `daemonVersionMatches` checks both
`parsed.version === getCliVersion()` AND `buildIdentityMatches(parsed.buildIdentity,
getCliBuildIdentity())`. Build identity includes `entryPath`, `mtimeMs`, and `size`
(from `compatibility.ts:124-141`). The `/version` endpoint returns both
`version` and `buildIdentity` (serve.ts line 182 area).

This is stricter than the plan specified. It is a useful safety improvement (catches
a same-version binary replaced on disk), but `plan.md` Deterministic section still
says "exact string match" which is now incorrect.

### 6. `cmdDaemonRun` writes PID metadata after server starts, not before

**Plan (Phase 2 Steps, item 3):** "On startup: write a metadata file... Write BEFORE
starting the server."

**Actual** (`daemon.ts:181-192`): `startServer({ socketPath, ... })` is awaited
first, then `writeDaemonPidMetadata` is called. The write happens after the server is
listening and inside `withDaemonLock`. If `startServer` throws, no PID file is
written, which is correct, but the ordering differs from the plan.

---

## Remaining Work

### Documentation reconciliation

| Item | Location | Status |
| --- | --- | --- |
| `plan.md` still says colon-to-hyphen sanitization formula | `tasks/node/daemon/plan.md` Deterministic section | Stale vs actual base64url key |
| `plan.md` still says version check is string-only | `tasks/node/daemon/plan.md` Version check section | Stale vs actual build identity check |
| `plan.md` says no lock file for MVP | `tasks/node/daemon/plan.md` Idempotency section | Stale vs actual `withDaemonLock` |
| `HELP_DAEMON` says socket under `~/.clawperator/` | `apps/node/src/cli/registry.ts:314` | Should be `~/.clawperator/daemon/` |
| `docs/api/daemon.md` may need `screenshot` fallback behavior documented | `docs/api/daemon.md` | Plan says `screenshot` is idempotent; current code uses `false` |

### Verification and hardening items

- Confirm whether `screenshot` `allowPostDispatchFallback: false` is intentional. If
  `screenshot` with an absolute path loses a daemon response, the caller gets
  `DAEMON_PROXY_ERROR` and must re-request the screenshot manually. The plan said this
  was acceptable for retries. Resolution: explicit comment in `observe.ts` or revert
  to `true` as the plan specified, with a test covering the absolute-path case.

- Confirm whether `withDaemonLock` addresses a real observed race or was added
  speculatively. If retained, update `plan.md` to document the change and reason.
  If not needed, remove to match the plan's stated rationale.

- Verify live device smoke pass for the daemon proxy path:
  - `daemon start --device <id>` - structured JSON with `status: started`
  - `daemon status --device <id>` - returns `pid`, `version`, `buildIdentity`,
    `uptimeSeconds`, `socketPath`
  - `snapshot --device <id>` via daemon, then `CLAWPERATOR_NO_DAEMON=1 snapshot` -
    stdout should be identical (after normalizing `commandId`/`taskId`)
  - `daemon stop --device <id>` then `snapshot --device <id>` - auto-start triggers

- Run `npm --prefix apps/node run build && npm --prefix apps/node run test` clean and
  confirm all test files compile and pass, including the new nested test directories.

- Run `./scripts/docs_build.sh` and confirm no dead links or missing pages.

### Task cleanup (per `plan.md` Durable Follow-Up)

1. Delete `tasks/node/daemon/` folder after reviewing whether any surviving guidance
   needs migration to `docs/`. Candidates:
   - The confirmed deviations from this findings doc belong in `docs/api/daemon.md`
     if they affect user-visible or agent-visible behavior.
   - `tasks/node/daemon/findings.md` measurements may be referenced from a permanent
     measurement log if one exists; otherwise it can be deleted with the folder.
2. Update `tasks/node/io-optimizations/findings.md` to note that subprocess skill
   latency is reduced via daemon proxy, per `plan.md` item 4.

### Docs site generated output

- `sites/docs/.build/` should be regenerated from source after any doc edits.
  Do not hand-edit generated pages.

---

## Relevant Files

### Implementation

| File | Role |
| --- | --- |
| `apps/node/src/cli/commands/serve.ts` | Phase 1: `createServeApp`, Unix socket transport, `/ping`, `/version` |
| `apps/node/src/domain/daemon/lifecycle.ts` | Phase 2: path helpers, `withDaemonLock`, `spawnDaemonRun`, `stopDaemon`, PID metadata |
| `apps/node/src/cli/commands/daemon.ts` | Phase 2: `cmdDaemonRun`, `cmdDaemonStart`, `cmdDaemonStop`, `cmdDaemonStatus`, `cmdDaemonRestart` |
| `apps/node/src/cli/daemonProxy.ts` | Phase 3: `tryDaemonExecution`, `ensureDaemonReady`, `hasCallerRelativeScreenshotPath` |
| `apps/node/src/cli/output.ts` | Phase 3: `formatRunExecutionResultForCli` |
| `apps/node/src/cli/commands/execute.ts` | Phase 3: proxy-before-direct for `exec` |
| `apps/node/src/cli/commands/observe.ts` | Phase 3: proxy-before-direct for `snapshot`, `screenshot` |
| `apps/node/src/cli/commands/action.ts` | Phase 4: proxy-before-direct for all flat action commands |
| `apps/node/src/domain/doctor/checks/deviceInteractivity.ts` | Phase 4: readiness cache exports |
| `apps/node/src/domain/executions/runExecution.ts` | Phase 4: `ensureInteractiveAutomationReadyCached` as default |
| `apps/node/src/cli/registry.ts` | Daemon command registration, `--no-daemon` in `supportedFlags` |
| `apps/node/src/cli/index.ts` | Global `--no-daemon` flag parsing |
| `apps/node/src/contracts/errors.ts` | `DAEMON_START_FAILED`, `DAEMON_STOP_FAILED`, `DAEMON_PROXY_ERROR` |
| `apps/node/src/domain/version/compatibility.ts` | `getCliVersion`, `getCliBuildIdentity` |

### Tests

| File | Coverage |
| --- | --- |
| `apps/node/src/test/unit/serve/serve.test.ts` | Phase 1: `createServeApp`, `/ping`, `/version`, socket/TCP transport |
| `apps/node/src/test/unit/daemon/lifecycle.test.ts` | Phase 2: path helpers, `sanitizeDaemonKey`, `isDaemonRunning`, `stopDaemon`, lock |
| `apps/node/src/test/unit/daemon/daemonProxy.test.ts` | Phase 3: `tryDaemonExecution` edge cases, opt-out, fallback, version check, operator package |
| `apps/node/src/test/unit/daemon/actionProxy.test.ts` | Phase 4: representative action command proxy wiring |
| `apps/node/src/test/unit/doctor/deviceInteractivity.test.ts` | Phase 4: cache hit/miss/TTL/invalidation |
| `apps/node/src/test/unit/executeCommand.test.ts` | Extended for daemon proxy path |
| `apps/node/src/test/unit/observe.test.ts` | Extended for snapshot/screenshot proxy |
| `apps/node/src/test/unit/runExecution.test.ts` | Extended for runtime cache invalidation |

### Docs

| File | Role |
| --- | --- |
| `docs/api/daemon.md` | Primary public daemon reference |
| `docs/api/errors.md` | Daemon error codes documented (line 135) |
| `docs/api/overview.md` | Daemon link added (line 17) |
| `sites/docs/mkdocs.yml` | Daemon page added to API nav |
| `sites/docs/static/llms-full.txt` | Generated; updated in commit |
| `sites/landing/public/llms-full.txt` | Generated; updated in commit |

### Task Files

| File | Role |
| --- | --- |
| `tasks/node/daemon/plan.md` | Stable decision record; Status table still shows "PR-1 done" |
| `tasks/node/daemon/work-breakdown.md` | Phase-by-phase steps; Status table still shows "PR-1 done" |
| `tasks/node/daemon/findings.md` | Phase 5 latency measurements |
