# Daemon Closeout Work Breakdown

Parent plan: `tasks/node/daemon-closeout/plan.md`

## Executive Summary

2 phases in 1 PR. Phase 1 fixes one help-text defect and adds regression
coverage for the shipped screenshot no-fallback boundary. Phase 2 is a
findings update and task folder cleanup. Both phases ship together in one
reviewable PR. No merge gate between phases.

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Fix help defect, validate screenshot boundary, update findings, clean up | Phase 1, Phase 2 | default | none |

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Do NOT change any text in HELP_DAEMON other than the one path string at line 314 of
  `apps/node/src/cli/registry.ts`.
- Do NOT change `cmdObserveScreenshot` to `allowPostDispatchFallback: true`.
  The shipped code and `docs/api/daemon.md` agree that screenshot post-dispatch
  response loss returns `DAEMON_PROXY_ERROR` because screenshots can write host
  output files.
- Do NOT change any `observe.ts` behavior other than adding behavior-neutral
  injectable test seams and one comment explaining why screenshot fallback
  remains `false`.
- Do NOT delete any task folder before `npm --prefix apps/node run build`,
  `npm --prefix apps/node run test`, and `./scripts/docs_build.sh` all pass.
- Do NOT append to `tasks/node/io-optimizations/findings.md` if the daemon proxy
  note is already present (check before writing).
- If any validation step fails, stop and fix the failure. Do not proceed to Phase 2
  while tests or the docs build are broken.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/node/daemon-closeout/plan.md` | Locked decisions, scope, and correctness rules |
| `tasks/node/daemon-closeeout/findings.md` | Evidence for the confirmed defect, reconciled decision, and cleanup items |
| `apps/node/src/cli/registry.ts` | Locate HELP_DAEMON; confirm the exact line before editing |
| `apps/node/src/cli/commands/observe.ts` | Locate `cmdObserveScreenshot` and confirm the current fallback boundary |
| `apps/node/src/cli/daemonProxy.ts` | Understand `hasCallerRelativeScreenshotPath`, `DAEMON_PROXY_ERROR`, and the fallback boundary |
| `docs/api/daemon.md` | Confirm public docs describe screenshot post-dispatch fallback as no direct retry |
| `apps/node/src/test/unit/observe.test.ts` | See the existing test shape before adding the new case |
| `tasks/node/io-optimizations/findings.md` | Read in full before appending; confirm note is absent |

---

## Phase 1: Code Fixes and Validation

### Agent Tier
default

### Goal
Fix the HELP_DAEMON path string, preserve `screenshot`
`allowPostDispatchFallback: false` with regression coverage, and confirm the full
test and docs build pass.

### Files To Change

- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/commands/observe.ts`
- `apps/node/src/test/unit/observe.test.ts`

### Steps

1. Read `apps/node/src/cli/registry.ts`. Find the `HELP_DAEMON` constant. It contains
   the line:

   ```
     - The daemon uses a Unix domain socket under ~/.clawperator/.
   ```

   Change `~/.clawperator/` to `~/.clawperator/daemon/`. Change only this one string.
   Do not change any other text in the file.

2. Read `apps/node/src/cli/commands/observe.ts`. Find `cmdObserveScreenshot`. The call
   to `tryDaemonExecution` currently passes `allowPostDispatchFallback: false`.
   Keep that value. Add a one-line comment immediately before or after the flag
   explaining why: caller-relative paths are already short-circuited by
   `hasCallerRelativeScreenshotPath` before daemon startup, and screenshots that may
   write a host output file must return `DAEMON_PROXY_ERROR` after post-dispatch
   response loss instead of retrying direct.

3. Add behavior-neutral injectable test seams to `cmdObserveSnapshot` and
   `cmdObserveScreenshot`, mirroring the established `tryDaemonExecutionFn` and
   `runExecutionFn` pattern in `apps/node/src/cli/commands/execute.ts` and
   `apps/node/src/cli/commands/action.ts`. The production defaults must remain
   `tryDaemonExecution` and `runExecution`.

4. Read `apps/node/src/test/unit/observe.test.ts`. Add one new test case to
   `cmdObserveScreenshot` coverage:

   **Required case:** when `tryDaemonExecution` is injected to return a
   `RunExecutionResult` error with `ERROR_CODES.DAEMON_PROXY_ERROR` for a screenshot
   with no path or an absolute path, `cmdObserveScreenshot` must return the formatted
   proxy error and must not call the injected `runExecution` fallback.

   Use the same injectable `tryDaemonExecutionFn`/`runExecutionFn` pattern already
   present in `execute.ts` and action-command tests. The assertion should also verify
   that the options passed to `tryDaemonExecutionFn` include
   `allowPostDispatchFallback: false`.

5. Run the build and test suite:

   ```bash
   npm --prefix apps/node run build && npm --prefix apps/node run test
   ```

   All tests must pass before continuing.

6. Run the docs build:

   ```bash
   ./scripts/docs_build.sh
   ```

   Must succeed with no errors.

7. **If a device is connected**, run the live smoke sequence using the branch-local
   build and debug operator package. This step is optional; skip it when no device is
   available and note the omission in the commit message.

   ```bash
   # Start daemon and proxy a snapshot through it
   node apps/node/dist/cli/index.js daemon start --device <device_id> --operator-package com.clawperator.operator.dev

   # Proxy path
   node apps/node/dist/cli/index.js snapshot --device <device_id> --operator-package com.clawperator.operator.dev > /tmp/proxy-out.json

   # Direct path
   CLAWPERATOR_NO_DAEMON=1 node apps/node/dist/cli/index.js snapshot --device <device_id> --operator-package com.clawperator.operator.dev > /tmp/direct-out.json

   # The outputs must be identical after normalizing the generated commandId and taskId fields.
   # Use jq or a short node script to nullify those fields before diffing.

   node apps/node/dist/cli/index.js daemon stop --device <device_id>

   # Confirm --no-daemon before and after the command both force direct
   node apps/node/dist/cli/index.js --no-daemon snapshot --device <device_id> --operator-package com.clawperator.operator.dev
   node apps/node/dist/cli/index.js snapshot --no-daemon --device <device_id> --operator-package com.clawperator.operator.dev
   ```

   Replace `<device_id>` with the serial from `clawperator devices` or `adb devices`.
   Prefer the physical device if both a physical device and emulator are connected.

### Acceptance Criteria

**Mechanical:**
- `rg -n "under ~/.clawperator/\\." apps/node/src/cli/registry.ts` returns zero
  matches.
- `rg -n "under ~/.clawperator/daemon/" apps/node/src/cli/registry.ts` matches the
  corrected line in HELP_DAEMON.
- `rg -n "allowPostDispatchFallback: false" apps/node/src/cli/commands/observe.ts`
  still matches the screenshot proxy options.
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0.
- `./scripts/docs_build.sh` exits 0.

**Human review:**
- The HELP_DAEMON change is the only diff in `registry.ts`.
- The `observe.ts` diff contains only injectable test seams and the screenshot
  fallback-boundary comment; no production behavior is altered.
- The new test in `observe.test.ts` exercises the post-dispatch no-fallback path for
  `cmdObserveScreenshot`, not just the pre-dispatch or relative-path path.

### Validation

```bash
# Correctness checks
! rg -n "under ~/.clawperator/\\." apps/node/src/cli/registry.ts
rg -n "under ~/.clawperator/daemon/" apps/node/src/cli/registry.ts
rg -n "allowPostDispatchFallback: false" apps/node/src/cli/commands/observe.ts

# Full build and test
npm --prefix apps/node run build && npm --prefix apps/node run test

# Docs build
./scripts/docs_build.sh
```

### Expected Commit

```text
fix(node): correct HELP_DAEMON path and cover screenshot proxy boundary
```

---

## Phase 2: IO-Optimizations Update and Task Cleanup

### Agent Tier
fast

### Goal
Append one note to `tasks/node/io-optimizations/findings.md`, then delete the three
temporary task folders.

### Files To Change

- `tasks/node/io-optimizations/findings.md` (append only)
- `tasks/node/daemon/` (delete entire folder)
- `tasks/node/daemon-closeeout/` (delete entire folder)
- `tasks/node/daemon-closeout/` (delete entire folder - this task pack itself)

### Steps

1. Read `tasks/node/io-optimizations/findings.md` in full. Confirm it does not
   already contain a note about the daemon proxy or subprocess skill latency
   improvement. If it does, skip step 2.

2. Append the following note to the end of `tasks/node/io-optimizations/findings.md`:

   ```markdown
   ## Daemon Proxy Update

   The transparent daemon proxy (PR #240, commit `e4b6e1b4`) reduces per-call
   latency for subprocess skill loops. Skills that call `clawperator` via
   `execFileSync` now benefit from the daemon's warm process state and the
   in-process readiness cache (TTL 8s) without any skill-side changes.

   Measured improvement for warm sequential snapshot calls: ~0.414s per call
   (1.156s direct vs 0.742s warm daemon). Five-call cold-start sequence was
   ~32% faster overall than direct mode. The improvement is strongest for
   repeated observation or action loops. Short host-side executions such as
   `close_app` show minimal improvement (~5%, within noise margin).
   ```

3. Delete the `tasks/node/daemon/` folder and all files within it.

4. Delete the `tasks/node/daemon-closeeout/` folder and all files within it.

5. Delete the `tasks/node/daemon-closeout/` folder (this task pack itself). Delete
   all files including `plan.md` and `work-breakdown.md` before committing.

### Acceptance Criteria

**Mechanical:**
- `ls tasks/node/daemon/ 2>/dev/null` returns nothing (folder deleted).
- `ls tasks/node/daemon-closeeout/ 2>/dev/null` returns nothing (folder deleted).
- `ls tasks/node/daemon-closeout/ 2>/dev/null` returns nothing (folder deleted).
- `tasks/node/io-optimizations/findings.md` contains "Daemon Proxy Update" section.

**Human review:**
- The appended note references the correct commit and latency numbers from
  `tasks/node/daemon/findings.md` before deletion.
- No other content in `tasks/node/io-optimizations/findings.md` is changed.

### Validation

```bash
ls tasks/node/daemon/ 2>/dev/null && echo "NOT DELETED" || echo "deleted ok"
ls tasks/node/daemon-closeeout/ 2>/dev/null && echo "NOT DELETED" || echo "deleted ok"
ls tasks/node/daemon-closeout/ 2>/dev/null && echo "NOT DELETED" || echo "deleted ok"
grep "Daemon Proxy Update" tasks/node/io-optimizations/findings.md
```

### Expected Commit

```text
chore(tasks): close out daemon task pack and update io-optimizations findings
```
