# Snapshot XML Contamination Fix

## Executive Summary

Fix the Node snapshot extraction path so non-snapshot logcat lines cannot be
inserted into `snapshot_ui` `data.text`. This is one PR with three phases:
audit the logging and extraction boundaries, implement tag-aware extraction with
regression coverage in the same phase, then validate against a live device and
update authored docs only where the shipped behavior is described. The existing
`findings.md` in this task folder is the seed evidence and should be preserved
as the investigation record.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

`snapshot_ui` must return clean hierarchy XML in `envelope.stepResults[].data.text`
even when Android system logcat lines are interleaved between the
`TaskScopeDefault` hierarchy lines. The fix must preserve existing snapshot
success metadata, result-envelope shape, JSON stdout cleanliness, unified
logging behavior, and SSE consumers.

## Why Now

A live physical-device snapshot reproduced invalid XML in `data.text` while the
command still reported `success`. Raw logcat showed `V/Configuration` lines
interleaved between `D/TaskScopeDefault` hierarchy lines. Node currently strips
the logcat tag before extraction, loses the source identity, and appends the
bare system message as hierarchy content.

## In Scope

- Harden `apps/node/src/domain/executions/snapshotHelper.ts` so snapshot
  extraction preserves or uses logcat source identity.
- Add focused regression tests that prove interleaved non-snapshot log lines do
  not enter extracted XML.
- Preserve current support for existing tested logcat shapes, including
  abbreviated `D/E` fixtures unless code proves they are obsolete and the tests
  are intentionally updated.
- Verify the fix through every Node surface that shares `runExecution()`
  snapshot post-processing.
- Update authored snapshot documentation if the extraction behavior described in
  docs changes.
- Record live validation results back into `findings.md`.

## Out of Scope

- Adding `--output xml`, `--pretty-payloads`, or any new CLI output format.
- Changing the `ResultEnvelope` shape or `snapshot_ui` step-result metadata.
- Moving hierarchy XML generation from Android logcat to a new transport.
- Reworking the unified logger, `clawperator logs`, or NDJSON event routing.
- Changing Android `TaskScopeDefault` logging unless Node-only hardening proves
  insufficient.
- Editing generated docs under `sites/docs/.build/` or `sites/docs/site/`
  directly.

## Existing Artifact Scope

- `tasks/node/contamination-bug/findings.md`: preserve existing evidence and
  append execution notes during Phase 1 and Phase 3. Do not rewrite it into a
  plan or delete the live reproduction details.
- `apps/node/src/domain/executions/snapshotHelper.ts`: in scope for a focused
  parser hardening change only. Do not broaden it into a general logcat parser
  framework unless the code proves that is the smallest correct fix.
- `apps/node/src/domain/executions/runExecution.ts`: in scope only if the fix
  needs a narrower logcat dump, added debug logging, or a small integration
  seam. Do not change result-envelope post-processing semantics casually.
- `docs/api/snapshot.md`: in scope only for authored documentation that describes
  extraction behavior or troubleshooting. Do not add speculative internals.
- `docs/internal/design/unified-logging.md`: required reading. Edit it only if
  implementation changes the unified logger contract, event routing, or logging
  separation model.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| Node snapshot extractor | Tag-aware extraction and contamination filtering | Phase 2 |
| Node unit tests | Regression coverage for noisy interleaved logcat and compatibility cases | Phase 2 |
| Node runExecution tests | Integration-style coverage if parser-only tests do not prove attachment behavior | Phase 2 |
| CLI/API live validation | Branch-local snapshot and exec validation on a physical device or emulator | Phase 3 |
| Docs | Snapshot extraction docs, if behavior details change | Phase 3 |
| Task findings | Append audit and live validation notes | Phase 1 and Phase 3 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Snapshot extractor behavior | `apps/node/src/domain/executions/snapshotHelper.ts` |
| Snapshot post-processing and attachment | `apps/node/src/domain/executions/runExecution.ts` |
| Existing snapshot extractor tests | `apps/node/src/test/unit/snapshotHelper.test.ts` |
| Existing runExecution post-processing tests | `apps/node/src/test/unit/runExecution.test.ts` |
| Android hierarchy emission | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt` |
| Android `snapshot_ui` metadata | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` |
| Result envelope contract | `apps/node/src/contracts/result.ts` |
| Snapshot public docs | `docs/api/snapshot.md` |
| Unified logging boundaries | `docs/internal/design/unified-logging.md`, `apps/node/src/contracts/logging.ts`, `apps/node/src/adapters/logger.ts` |
| Serve snapshot surface | `apps/node/src/cli/commands/serve.ts` |
| MCP snapshot surface | `apps/node/src/mcp/tools/core.ts` |
| Existing investigation evidence | `tasks/node/contamination-bug/findings.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- The bug is in Node snapshot extraction, not in `--output pretty`.
- Preserve the outer response shape and `data.text` location.
- Preserve successful step metadata such as `actual_format`, `foreground_package`,
  `has_overlay`, `overlay_package`, and `window_count`.
- Tests for the contamination case must be added in the same commit as the
  extractor fix.
- The extractor must not append messages from a different logcat tag/source once
  a hierarchy block is open.
- Build before test. Node tests may exercise built `dist/` artifacts elsewhere,
  so do not run build and test in parallel.
- Use the branch-local CLI from `apps/node/dist/cli/index.js` for live
  validation, not a global `clawperator` binary.

**Judgment required:**

- Whether to ignore interleaved non-snapshot log lines or terminate the active
  snapshot block when a different tag appears. The preferred default is ignore
  different-tag noise and keep collecting same-tag hierarchy lines until
  `</hierarchy>`.
- Whether `runExecution()` should additionally narrow the post-success logcat
  dump. Parser hardening is required either way.
- Whether `docs/api/snapshot.md` needs a narrow wording update after the final
  implementation.

## Decision Rules

| Question | Rule |
| --- | --- |
| Should a non-TaskScope line inside an open snapshot be included? | No. It must not appear in `data.text`. |
| Should different-tag noise fail the snapshot? | No by default. Ignore different-tag lines and continue collecting same-tag XML until `</hierarchy>`, unless a test proves this creates false positives. |
| Should bracketed Clawperator markers still terminate a snapshot? | Yes when they come from the same snapshot-producing tag and appear before `</hierarchy>`. Preserve existing malformed or partial block handling unless tests prove a safer behavior. |
| Which tag should start a snapshot? | Start only from a line whose message includes `[TaskScope] UI Hierarchy:`. Preserve source identity from that line and use it for subsequent lines. |
| Should abbreviated historical fixtures keep working? | Yes, unless implementation discovers they cannot be represented safely. If changed, document why in `findings.md` and update tests intentionally. |
| Should this task alter unified logging? | No. Unified logger NDJSON routing, terminal cleanliness, and EventEmitter/SSE separation are protected boundaries. |
| What if a live device is unavailable? | Unit tests remain the primary gate. Record the device limitation in `findings.md`, but do not skip the required synthetic contamination regression. |

## Failure Modes To Prevent

- Returning `success` with invalid `data.text` containing system log messages.
- Fixing only `clawperator snapshot` while leaving `exec`, serve, MCP, or skills
  paths vulnerable through shared `runExecution()`.
- Filtering too broadly and dropping legitimate XML lines or colons inside XML
  attributes.
- Breaking older or abbreviated logcat line formats already covered by tests.
- Polluting JSON stdout with diagnostics or logger output.
- Changing SSE/EventEmitter behavior while working near `runExecution()`.
- Treating live validation as a substitute for unit regression tests.
- Hand-editing generated docs instead of authored docs.

## Output Contract

After the PR:

- `extractSnapshotFromLogs()` and `extractSnapshotsFromLogs()` return hierarchy
  text that contains only the snapshot block lines emitted by the snapshot
  source.
- Interleaved `V/Configuration` or other non-snapshot logcat lines do not appear
  in extracted XML.
- `clawperator snapshot --output pretty` keeps the same response shape, but
  `data.text` is clean XML.
- Any `runExecution()` caller with `snapshot_ui` receives the same metadata and
  envelope structure as before.
- Tests explicitly prove the noisy-log regression and compatibility behavior.

## Idempotency

- Re-running the extractor on the same log lines returns the same snapshot list.
- Re-running a successful snapshot command may capture different UI state, but
  interleaved non-snapshot logs must never be included in `data.text`.
- Re-running docs build regenerates generated docs from authored sources only.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Tag-aware extraction behavior | `apps/node/src/domain/executions/snapshotHelper.ts` and unit tests |
| Snapshot extraction contract and troubleshooting | `docs/api/snapshot.md` if changed |
| Logging architecture boundaries | `docs/internal/design/unified-logging.md` only if logger semantics change |
| Temporary live reproduction and validation details | `tasks/node/contamination-bug/findings.md` until task cleanup |
