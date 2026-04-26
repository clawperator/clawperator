# Daemon Closeout

## Executive Summary

2-phase, 1-PR closeout pass over the daemon implementation that shipped in
`e4b6e1b4` (PR #240). All five original phases are implemented. This task
fixes two concrete defects, runs the full validation suite, updates one
permanent findings file, and deletes the temporary task pack files.

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

## Goal

Leave the daemon work fully closed: two code defects fixed, tests green, docs
build clean, one permanent findings update made, and all temporary task files
deleted.

## Why Now

`tasks/node/daemon-closeeout/findings.md` identified two defects and one
required permanent update that were not part of the implementation PR. The
task pack files for the original daemon work are now stale and should be
deleted once the defects are resolved.

## In Scope

- Fix stale path string in `HELP_DAEMON` in `apps/node/src/cli/registry.ts`.
- Fix `screenshot` `allowPostDispatchFallback` in
  `apps/node/src/cli/commands/observe.ts` and add a regression test.
- Pass `npm --prefix apps/node run build && npm --prefix apps/node run test`.
- Pass `./scripts/docs_build.sh`.
- Live device smoke for the proxy path (if a device is connected).
- Update `tasks/node/io-optimizations/findings.md` with a daemon proxy note.
- Delete `tasks/node/daemon/`, `tasks/node/daemon-closeeout/`, and
  `tasks/node/daemon-closeout/` (this folder) after all other work is committed.

## Out of Scope

- No new daemon functionality.
- No changes to `docs/api/daemon.md` or other public docs pages (they are
  already correct per `findings.md`).
- No refactoring of `withDaemonLock` - the lock was added intentionally; its
  presence does not require removal or further architectural change now.
- No changes to `tasks/node/daemon/plan.md` - that file is being deleted, not
  updated.

## Existing Artifact Scope

`apps/node/src/cli/registry.ts` - only the one-line HELP_DAEMON path string
is in scope. No other registry content changes.

`apps/node/src/cli/commands/observe.ts` - only `cmdObserveScreenshot`'s
`allowPostDispatchFallback` flag and a brief comment are in scope. No other
observe content changes.

`apps/node/src/test/unit/observe.test.ts` - one new test case for the
absolute-path screenshot fallback behavior is in scope.

`tasks/node/io-optimizations/findings.md` - one appended note at the end of
the file is in scope. No existing content changes.

## Surfaces and Ownership

| Surface | Files | Phase |
| --- | --- | --- |
| CLI registry help text | `apps/node/src/cli/registry.ts` | 1 |
| Screenshot proxy fallback | `apps/node/src/cli/commands/observe.ts` | 1 |
| Screenshot proxy test | `apps/node/src/test/unit/observe.test.ts` | 1 |
| IO-optimizations findings | `tasks/node/io-optimizations/findings.md` | 2 |
| Task folder cleanup | `tasks/node/daemon/`, `tasks/node/daemon-closeeout/`, `tasks/node/daemon-closeout/` | 2 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Daemon file paths | `apps/node/src/domain/daemon/lifecycle.ts` (`getDaemonDir`) |
| Screenshot proxy fallback | `apps/node/src/cli/commands/observe.ts`, `apps/node/src/cli/daemonProxy.ts` |
| Relative-path screenshot guard | `apps/node/src/cli/daemonProxy.ts` (`hasCallerRelativeScreenshotPath`) |
| CLI registration | `apps/node/src/cli/registry.ts` |
| Test coverage | `apps/node/src/test/unit/observe.test.ts` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Daemon directory is `~/.clawperator/daemon/`. This is what
  `getDaemonDir` in `lifecycle.ts` returns and what `docs/api/daemon.md`
  documents. The HELP_DAEMON fix must use this exact string.
- `screenshot` `allowPostDispatchFallback` must be `true`. Rationale: a
  screenshot with no path or an absolute path is idempotent from the device's
  perspective - re-shooting produces a fresh capture and does not double-apply
  a side-effecting action. The `hasCallerRelativeScreenshotPath` guard
  handles caller-relative paths separately by short-circuiting before dispatch.
  This matches the plan's stated intent and is consistent with how `snapshot`
  is treated.
- The regression test proves: when `tryDaemonExecution` returns `null` after
  dispatch and `allowPostDispatchFallback: true`, `cmdObserveScreenshot` falls
  back to direct and succeeds.

**Judgment not required** for either code fix. Both have locked answers above.

## Failure Modes To Prevent

1. **Wrong path string.** The HELP_DAEMON fix must change `~/.clawperator/` to
   `~/.clawperator/daemon/` exactly. Do not change any other text in the
   HELP_DAEMON constant or in any other help block.

2. **`screenshot` test exercises the wrong path.** The new test must exercise
   `cmdObserveScreenshot` with a non-relative path and confirm that when
   `tryDaemonExecution` returns null after dispatch, the command falls back
   to direct and the final output is a success result. A test that only
   exercises `allowPostDispatchFallback: false` behavior or only checks the
   `hasCallerRelativeScreenshotPath` guard does not satisfy this.

3. **Cleanup before validation.** Do not delete task folders until both
   `npm test` and `./scripts/docs_build.sh` pass.

4. **Stale generated output.** If `./scripts/docs_build.sh` modifies
   `sites/docs/.build/` or `sites/docs/site/`, commit those changes together
   with the source that triggered them. Do not commit a docs build with only
   generated output and no source change.

## Output Contract

Phase 1 produces one commit with:
- `registry.ts` HELP_DAEMON path string corrected
- `observe.ts` `allowPostDispatchFallback` set to `true` with comment
- `observe.test.ts` new regression test passing

Phase 2 produces one commit with:
- `tasks/node/io-optimizations/findings.md` note appended
- `tasks/node/daemon/` deleted
- `tasks/node/daemon-closeeout/` deleted
- `tasks/node/daemon-closeout/` deleted

## Idempotency

Both phases are safe to rerun. The HELP_DAEMON fix is idempotent. The test
addition is idempotent. The folder deletions are idempotent (`rm -rf` with
nonexistent target succeeds). The findings append is the only non-idempotent
step; verify the note has not already been appended before adding it.

## Durable Follow-Up

None. This task produces no new durable artifacts. Its only durable output is
the correction of `allowPostDispatchFallback: true` in `observe.ts`, which is
expressed in the code itself.
