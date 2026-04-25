# Snapshot I/O Optimizations

## Executive Summary

This task pack covers the immediate non-handshake Node-side snapshot I/O cleanup work identified in `tasks/node/io-optimizations/findings.md`. It is a Node-dominant task pack with 1 PR and 2 phases: Phase 1 ships live-stream snapshot extraction and removes redundant logcat passes, and Phase 2 tightens dispatch/preflight startup overhead and remeasures the result. Handshake redesign, Android-side filtering, and transport replacement are explicitly excluded and remain separate follow-up work.

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
