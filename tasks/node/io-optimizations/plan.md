# Snapshot I/O Optimizations

## Executive Summary

This task pack covers the immediate non-handshake Node-side snapshot I/O cleanup work identified in `tasks/node/io-optimizations/findings.md`. It is a Node-dominant task pack with 1 PR and 2 phases: Phase 1 ships live-stream snapshot extraction and removes redundant logcat passes, and Phase 2 tightens dispatch/preflight startup overhead and remeasures the result. Handshake redesign, Android-side filtering, and transport replacement are explicitly excluded and remain separate follow-up work.

## Status

| Item | Value |
| --- | --- |
| State | PR-1 complete |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | 1, 2 |
| Remaining | none |
| Current / Next | review-swarm-loop |
| Blockers | none |

## Goal

Reduce `clawperator snapshot` latency by removing redundant Node/ADB logcat overhead on the current transport path without changing the handshake model, Android snapshot generation contract, or the canonical `[Clawperator-Result]` envelope.

## Why Now

The current snapshot path is too slow for tight agent loops, and the branch findings already identify several low-risk, high-yield Node-only fixes. These are well enough understood to hand off now, while handshake redesign still needs a dedicated planning pass and Android-side improvements are a later project.

## In Scope

- Extend live snapshot parsing to support both tag-format and time-format log lines.
- Capture snapshot-relevant log lines from the existing live logcat stream in `waitForResultEnvelope`.
- Attach snapshot XML from captured live stream lines instead of relying on a post-success `logcat -d` pass.
- Remove the per-command `logcat -d` snapshot recovery path once live extraction is verified.
- Remove the per-command `logcat -c` clear once live extraction is verified.
- Reduce or replace the fixed 300 ms broadcast delay in `waitForResultEnvelope`.
- Start logcat earlier so attach delay is overlapped with remaining safe preflight work.
- Parallelize explicit-device `resolveDevice` and `checkApkPresence` where safe.
- Re-measure warm CLI and serve-mode snapshot latency after the above changes.

## Out of Scope

- Any readiness cache or handshake redesign work from `tasks/node/handshaking/findings.md`
- Any Android-side snapshot filtering, reduced-attribute output, or diff snapshot work from `tasks/node/io-optimizations/findings-deferred.md`
- Any replacement of broadcast/logcat transport with sockets or another persistent channel
- Any change to the `[Clawperator-Result]` envelope contract
- Any attempt to embed full snapshot XML directly in the single-line result envelope
- Recording transport changes

## Existing Artifact Scope

- `tasks/node/io-optimizations/findings.md`: in scope as the immediate source brief for this task pack; preserve its current immediate/deferred/handshake boundaries and do not broaden it during implementation.
- `tasks/node/io-optimizations/findings-deferred.md`: preserved as-is; out of scope for implementation changes in this pack.
- `tasks/node/handshaking/findings.md`: preserved as-is; reference only for exclusions and next-step gating.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/node/src/domain/executions/runExecution.ts` | Remove `logcat -d` and `logcat -c`, attach snapshots from live capture, overlap logcat startup, explicit-device preflight parallelism | PR-1 / Phase 1 and 2 |
| `apps/node/src/adapters/android-bridge/logcatResultReader.ts` | Capture live stream lines and reduce/replace fixed dispatch delay | PR-1 / Phase 1 and 2 |
| `apps/node/src/domain/executions/snapshotHelper.ts` | Support time-format parsing in addition to tag-format parsing | PR-1 / Phase 1 |
| `apps/node/src/test/unit/` | Regression coverage for parsing, capture, fallback removal, and dispatch timing behavior | PR-1 / Phase 1 and 2 |
| `apps/node/src/cli/commands/serve.ts` | No code changes expected; serve-mode is an operational note for docs, not a code surface in this pack | — |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Snapshot execution path | `apps/node/src/domain/executions/runExecution.ts` |
| Live result-envelope transport | `apps/node/src/adapters/android-bridge/logcatResultReader.ts` |
| Snapshot log parsing | `apps/node/src/domain/executions/snapshotHelper.ts` |
| Result envelope contract | `apps/node/src/contracts/result.ts` |
| Error and timeout behavior | `apps/node/src/contracts/errors.ts` |
| Current handshake exclusions | `tasks/node/handshaking/findings.md` |
| Deferred Android/transport work | `tasks/node/io-optimizations/findings-deferred.md` |
| Immediate findings and measured rationale | `tasks/node/io-optimizations/findings.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- This pack implements only the immediate non-handshake work listed in `tasks/node/io-optimizations/findings.md`.
- Live snapshot extraction must replace post-success `logcat -d` only after time-format parsing and live capture are in place.
- `logcat -c` must not be removed before live extraction is verified.
- `resolveDevice` and `checkApkPresence` may be parallelized only when `config.deviceId` is already explicit.
- The current `[Clawperator-Result]` envelope contract stays unchanged.
- Full snapshot XML must not be embedded in the single-line envelope.
- Any readiness cache or broader handshake change belongs to the separate handshake task, not this pack.
- **Replaced code paths are deleted, not wrapped.** Once `logcat -c` and `logcat -d` are superseded by live-stream extraction, remove their call sites entirely. Do not leave them behind a feature flag, a compatibility conditional, or a disabled-but-present fallback. There is no caller that needs the old behavior preserved.

**Judgment required:**

- Broadcast delay approach: the findings recommend signal-based dispatch (fire once logcat emits its first stdout line, 100ms fallback timer) as the preferred landing. If signal-based is not stable enough on first attempt, the fallback is a reduced constant of 50ms with a measurement follow-up in the same PR. Do not default to 50ms without first attempting the signal-based path.
- Duration of the transition scaffolding (`logcat -d` kept as temporary fallback in Phase 1): remove it in the same phase, in step 6, as soon as tests prove live extraction. Do not carry it into Phase 2.
- Whether any serve-mode guidance belongs in code-adjacent help output - default is no; only add if the implementation actually changes a user-facing surface.

## Decision Rules

| Question | Rule |
| --- | --- |
| Which findings file governs implementation? | `tasks/node/io-optimizations/findings.md` only. Use `findings-deferred.md` and `handshaking/findings.md` only to keep boundaries intact. |
| When may `logcat -d` be removed? | Only after live stream capture is implemented and covered by unit tests proving snapshot extraction from time-format lines. |
| When may `logcat -c` be removed? | Only after live extraction is verified to bound snapshot collection correctly without shared-buffer dependence. |
| How should broadcast delay change be shipped? | Prefer signal-based dispatch if it is testable and stable; otherwise ship a reduced constant with explicit measurement follow-up in the same PR. |
| When may device resolution and APK checks run in parallel? | Only when `config.deviceId` is explicit. Auto-resolve stays sequential. |
| What happens if implementation pressure pushes toward handshake changes? | Stop and exclude them from this pack. Handshake work remains out of scope. |

## Failure Modes To Prevent

- A weaker agent accidentally pulls handshake caching or readiness redesign into this pack
- `logcat -d` is removed before live stream parsing actually works for time-format lines
- `logcat -c` is removed while snapshot capture still depends on a clean global log buffer
- Dispatch timing changes create envelope races or silent timeouts on slower devices or emulators
- Explicit-device parallelism is applied to auto-resolve flows and breaks device targeting
- Tests are added too late or are too weak to prove the new transport path actually replaced the old one
- Old `logcat -c` or `logcat -d` call sites are left behind a feature flag or compatibility conditional instead of being deleted

## Output Contract

After this task ships:

- Snapshot extraction uses the live logcat stream rather than a post-success `logcat -d` pass.
- Snapshot execution no longer relies on per-command `logcat -c`.
- Broadcast dispatch overhead is lower than the current fixed 300 ms default.
- Explicit-device preflight work is cleaner and slightly faster where safe.
- The `[Clawperator-Result]` envelope contract remains unchanged.
- The implementation includes tests that prove both parsing formats and the new live-capture path.
- The task concludes with updated measured latency numbers for warm CLI and serve-mode runs.

## Idempotency

- Snapshot capture is bounded by the dispatch-to-envelope interval for a given commandId, not by global logcat buffer state. Removing `logcat -c` must not change this: a re-run of the same snapshot command must not pick up lines from a previous command's window.
- Tests must produce stable pass/fail outcomes independent of prior logcat buffer state, because `logcat -c` will no longer be used to establish a clean baseline.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Handshake redesign questions and gates | `tasks/node/handshaking/findings.md` until that pack is authored |
| Deferred Android/transport backlog | `tasks/node/io-optimizations/findings-deferred.md` until later task authorship |
| Any user-visible serve-mode guidance added by this work | Public docs or CLI help only if the implementation actually changes a user-facing surface |

## Implementation Status

### Phase 1 - Live Stream Snapshot Extraction

Status: completed on 2026-04-25.

Acceptance:
- `snapshotHelper` parses both tag-format and live `-v time` TaskScopeDefault snapshot lines.
- `waitForResultEnvelope` returns snapshot lines captured from the live stream between dispatch start and the matching result envelope.
- `runExecution` attaches snapshot XML from captured live lines.
- The old per-command `logcat -c` clear and post-success `logcat -d -v tag` recovery call sites were deleted.

Validation:
- `npm --prefix apps/node run build` passed.
- `node --test apps/node/dist/test/unit/snapshotHelper.test.js apps/node/dist/test/unit/runExecution.test.js` passed.
- `npm --prefix apps/node run test` was run; unrelated skills CLI tests failed because the local host had both `<device_serial>` and `emulator-5554` connected and those tests reached real device selection instead of their fake adb path.
- Live smoke passed with `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json`; `envelope.stepResults[0].data.text` contained a well-formed `<hierarchy>` XML document.

### Phase 2 - Dispatch And Preflight Overhead Cleanup

Status: completed on 2026-04-25.

Acceptance:
- `waitForResultEnvelope` now dispatches on first live stdout from logcat with a 100 ms fallback timer instead of the old 300 ms fixed delay.
- Explicit-device execution starts the main logcat waiter before `resolveDevice` and `checkApkPresence`, and those two checks run in parallel.
- Auto-resolve execution remains sequential before logcat starts, preserving device targeting behavior.
- Tests cover signal dispatch, timeout diagnostics, explicit-device fast path behavior, and auto-resolve sequencing.
- Measurements were captured in `work-breakdown.md`.

Validation:
- `npm --prefix apps/node run build` passed.
- `node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- `npm --prefix apps/node run test` was run; unrelated skills CLI tests still failed because two real devices were connected and those tests reached real adb device selection.
- Live skill timing comparison was run with global `0.7.7` and local `0.7.8`.

### Review Swarm Loop

Status: in progress on 2026-04-25.

Pass 1:
- Fixed early explicit-device waiter timeout accounting so the result timeout starts at broadcast dispatch rather than logcat spawn.
- Fixed first-chunk logcat replay capture so snapshot capture begins only after the attachment/prologue chunk has been processed and broadcast dispatch starts.
- Added focused regression coverage for both boundaries.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.

Pass 2:
- Review found the deferred explicit-device waiter could still time out during preflight, and replayed matching envelopes or split replayed snapshot chunks could still be accepted before dispatch.
- Fixed result-envelope handling so timeout, envelope parsing, and snapshot capture begin only after broadcast dispatch succeeds.
- Added regression tests for ignored pre-dispatch envelopes and split replayed snapshot chunks.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed and returned hierarchy XML.

Pass 3:
- Review found the Pass 2 gate started too late, after `am broadcast` completed, which could drop Android envelopes or snapshot lines emitted during receiver execution.
- Fixed the dispatch boundary so timeout, envelope parsing, and snapshot capture start when the actual broadcast dispatch begins, while deferred preflight and pre-dispatch replay remain excluded.
- Updated direct callers of `waitForResultEnvelope` to mark dispatch start explicitly.
- Added regression tests for synchronous failure envelopes and snapshot lines emitted before broadcast command completion.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.

Pass 4:
- Review found explicit-device preflight cancellation could leave the early logcat waiter alive until stdout or fallback dispatch, and later replay chunks could still arrive before capture was fully bounded.
- Added an abort signal to the early result waiter so preflight cancellation settles and kills logcat immediately.
- Replaced host/device timestamp comparison with a short signal-triggered replay-drain window before broadcast dispatch, keeping replay chunks outside capture without relying on synchronized clocks.
- Added regression coverage for no-stdout cancellation and multi-chunk replay before dispatch.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.

Pass 5:
- Review found live `logcat -v time` snapshot parsing covered the `D/Tag(pid):` form but not the PID/TID column form (`pid tid D Tag:`).
- Added parser support and regression coverage for PID/TID `-v time` lines.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.

Pass 6:
- Review found the no-output fallback could still fire after stdout was observed and interrupt replay draining.
- Cleared the fallback timer on first stdout so only the signal replay-drain timer controls dispatch after attachment is proven.
- Added regression coverage where replay chunks continue beyond the old fallback window.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.

Pass 7:
- Review found thrown pre-dispatch exceptions could bypass explicit cancellation and leave the early logcat waiter alive.
- Added a pre-dispatch `finally` cancellation guard that aborts the early waiter unless broadcast has been released.
- Added regression coverage for a throwing readiness preflight.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.

Pass 8:
- Review found replayed partial log lines could straddle the dispatch boundary, and blank `deviceId` could take the explicit-device fast path even though resolution treats it as omitted.
- Cleared incomplete pending logcat content when dispatch capture starts.
- Aligned explicit-device fast-path detection with nonblank device IDs.
- Added regression coverage for partial replay completion after dispatch and blank `deviceId` fast-path avoidance.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.

Pass 9:
- Review found continuous stdout could reset replay-drain dispatch indefinitely, and the task pack still needed warm CLI / serve-mode snapshot latency measurements.
- Added an absolute max replay-drain cap after first stdout so noisy logcat cannot block dispatch forever.
- Added regression coverage for continuous logcat output before dispatch.
- Captured warm CLI and serve-mode snapshot measurements in `work-breakdown.md`.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.

Pass 10:
- Review found stale malformed result-looking replay lines for older commands could fail the fresh command after replay-drain dispatch.
- Prefiltered result-envelope parsing to lines that reference the current command ID before treating malformed JSON as fatal.
- Added regression coverage for stale malformed replay followed by the current command envelope.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.

Pass 11:
- Review found the absolute max replay-drain cap could still start dispatch while old snapshot replay lines were arriving, allowing stale snapshots to enter the capture window.
- Added a short snapshot-capture quarantine when dispatch is forced by the max replay-drain cap, while keeping envelope parsing and timeout accounting tied to dispatch start.
- Added regression coverage for stale snapshot blocks emitted immediately after forced dispatch followed by fresh snapshot lines.
- Validation: `npm --prefix apps/node run build && node --test apps/node/dist/test/integration/executeLogging.test.js apps/node/dist/test/unit/runExecution.test.js apps/node/dist/test/unit/snapshotHelper.test.js` passed.
- Live smoke: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` passed with `hasHierarchy: true`.
