# Live overlay templates work breakdown

Stable scope and contract: [plan.md](plan.md).

## Task 1 / PR 1: Foreground-application observation

Status: [DONE]. Implemented and validated on 2026-09-19.

Delivered the reusable observer, existing accessibility ingress integration,
bounded Android proof consumer, and regression tests. Android and documentation
checks passed. Pixel 10 Pro Fold evidence includes 42 split-screen pane focus
changes, keyboard input in both panes, system transitions, and service reconnect.
The final 20-switch run measured 103-107 ms event-to-observation latency.

The durable [observer design and evidence](../../docs/internal/design/foreground-application-observation.md)
records the contract, lifecycle, repeatable proof, excluded failed input attempts,
and platform limits. Changed emulator settings were restored. Task 2 remains
not started and can consume this observer without changing snapshot semantics.

## Task 2 / PR 2: Overlay templates and live metadata

Status: Not started. Depends on Task 1; may stack on its validated branch.

- Add the mutually exclusive template/text contract, strict placeholder parser,
  literal-delimiter escape, resource bounds, and matching Node/Android tests.
  Preserve literal text behavior, existing aliases, and structured errors.
- Resolve metadata and locale values in Android. Cache device values and app
  metadata appropriately; invalidate package metadata on updates and refresh
  system language independently of per-app language settings.
- Extend layout for inline icons, multiline text, wrapping, alignment, and
  truncation. Resolve app fields coherently and discard late old-app results.
- Wire subscriptions to overlay lifetime. Verify cancellation on replacement,
  expiry, clear, detach, and layout failure; redraw never resets absolute expiry.
- Add CLI `--template` and support it through existing raw CLI, Serve, and MCP
  execution. Keep no-replay-after-uncertain-dispatch behavior.
- Update public and internal docs and regenerate tracked outputs. Inspect runtime
  skill consumers and update them only if affected, following lockstep rules.

Acceptance cases:

- Every listed token renders correctly, including all three distinct language
  fields and full-width version codes; literal text containing token syntax is
  unchanged. Unknown/malformed tokens and both/neither input fields fail before
  changing an existing panel. Test escaping, blank and oversized inputs, and
  bounded expansion; metadata is never recursively parsed as template syntax.
- CLI valid, invalid, repeated, and missing values; common options before and
  after the command; nonzero errors and structured JSON. Generic transports
  carry the same canonical contract.
- One template stays accurate across rapid app switches without further Node
  calls. Missing metadata, package replacement, adaptive icons, long names,
  multiline layout, and system-locale changes have explicit tested behavior.
- App-specific language overrides do not change system-language tokens.
  Device-only templates do not subscribe to foreground observation.
- Clear/expiry during lookup or refresh cannot resurrect the panel. Refresh
  preserves TTL, draw guarantees, touch-through behavior, and selector exclusion.
- Inspect separate awaited set/screenshot/clear captures and video of switches;
  verify pixels and app identity rather than relying on process success alone.

## Validation and prerequisites

For each task, run Android checks from the repository root (where `gradlew` lives):

```bash
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

For Task 2, build Node before running its tests from repository root:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

For authored docs in either task, run `./scripts/docs_build.sh`. Do not run docs
regeneration concurrently with Node/live proof because it replaces dependencies
and compiled output. Run applicable existing overlay validation scripts and
extend their coverage for demonstrated regressions; new harnesses belong in
`validation/` and should be wired into CI.

Live verification requires a connected physical device (preferred) or emulator,
matching debug APK, and enabled Operator accessibility service. Check `adb
devices` before selecting it; pass explicit `--device <device_serial>` and
`--operator-package com.clawperator.operator.dev` to branch-local Node commands.
Use repository setup/permission helpers as needed. Restore changed device
settings and leave the overlay hidden. Preserve raw evidence locally without
committing private identifiers or machine paths.

Offline tests prove parsing and controlled lifecycle/selection behavior. They
do not prove real event delivery, foreground accuracy, locale updates, or icon
capture. Report any live prerequisites that block verification and what remains
unproven; do not mark those acceptance cases passed from unit tests alone.

## Completion

For the assigned task, finish implementation, relevant checks, in-scope fixes,
docs, and narrow local Conventional Commits with hooks enabled. Update its
status and evidence references without claiming the other task is complete.
Do not push or create a PR unless the active user request/workflow authorizes it.

Retain concise completed Task 1 status while Task 2 remains. Once both tasks are
complete and validated, use `.agents/skills/task-cleanup/SKILL.md` to retire the
pack after preserving durable decisions and any actionable follow-up. Cleanup
does not require a merge and must not assert one.
