# On-Screen Logs Work Breakdown

Parent plan: `tasks/api/on-screen-logs/plan.md`.

## Executive Summary

Two PRs, four sequential phases. PR-1 contains Phases 1-2: render/controller proof and raw execution integration. PR-2 contains Phases 3-4: CLI and final cross-surface proof. Use `default` tier for bounded implementation; use `thinking` tier if a failed proof requires revisiting the specified mechanism. Do not silently redesign it. Current state is planning only.

## Status

| Item | Value |
| --- | --- |
| State | in progress |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | Phase 1 |
| Remaining | 2-4 |
| Current / Next | Phase 2 |
| Blockers | PR-2 waits for PR-1 merge |

## Hard Rules

- Implement one phase at a time. Run its tests, fix failures, update findings/status, and commit before the next phase.
- Do not start, scaffold, validate, or review PR-2 work until PR-1 is merged and PR-2 is requested.
- Preserve unrelated working-tree changes. Use branch-local Node build and the debug Operator for live checks. Never use a global CLI to prove new commands.
- Keep all feature text, examples, tests, and documentation generic to Clawperator and Action Launcher. Do not import external project context or fixtures.
- Apply the parent contract literally. Escalate mechanism/contract changes with evidence; do not add application-overlay permission fallback, timers, metadata inference, or a larger logging system.
- Add tests in the same phase and commit as new behavior. No deferred test phase for earlier code.
- Keep Android operations on the main thread without blocking it while waiting for draw. Respect coroutine cancellation and execution deadlines.
- Do not alter unrelated overlay or app-selector behavior to make the proof pass.
- Public API changes include authored docs in the same PR. Use `.agents/skills/docs-author/SKILL.md` and `.agents/skills/docs-build/SKILL.md`; do not edit generated pages directly.
- Keep this task pack through both PRs. Do not push or merge without the active workflow's authorization.

## Required Reading

Read IN THIS ORDER before writing implementation:

| File | Why |
| --- | --- |
| `AGENTS.md` | Repository ownership, commits, validation, and docs rules |
| `tasks/api/on-screen-logs/plan.md` | Stable contract |
| This file's sequencing table and current-PR phases | Execution boundary |
| `apps/node/src/contracts/execution.ts`, `result.ts`, `errors.ts`, `aliases.ts` | Action/result types and known codes |
| `apps/node/src/domain/executions/validateExecution.ts` and its unit test | Strict schema and supported-action registration |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` | Android ingress validation |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`, `UiActionEngine.kt` | Existing action dispatch seam |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt` and its test | Service lifetime |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeInspectorAndroid.kt` and its test | Foreground/window reporting |
| `apps/node/src/domain/executions/runExecution.ts` | Current screenshot capture and result processing |
| `docs/api/actions.md` | Exemplar: parameter tables, defaults, failure behavior, examples |
| `.agents/skills/docs-author/SKILL.md`, `.agents/skills/docs-build/SKILL.md` | Required authored/generated docs workflow |

Test paths are listed in the parent plan; locate any same-name Kotlin file with `rg --files apps/android` before reading. Do not guess module dependencies from folder names. Read directly referenced DI and interface files as needed.

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Proved renderer and raw public actions | 1, 2 | default; thinking for blocked proof only | Must merge before PR-2 |
| PR-2 | CLI convenience and release-ready evidence/docs | 3, 4 | default | PR-1 merged and explicit continuation |

## Findings Format

Create `findings.md` at the start of Phase 1 using these sections, and update before each phase commit:

1. Environment: source revision, branch-local CLI/Operator versions, Android API, target type, display metrics/font scale, selected capture method. Use placeholders in committed commands, not personal identifiers or absolute host paths.
2. Phase status: pending/passed/blocked and commit reference when available.
3. Validation table: command, exit status, what the check proves, evidence path.
4. Live observations: expected/observed, capture files, interaction and hierarchy comparisons.
5. Decisions and deviations: source evidence, reason, whether escalation is required.
6. Remaining limitations: untested API/device combinations and follow-up disposition.

Retain large images/videos in ignored validation artifacts, not git. Record repeatable commands and summaries in findings. Never invent live proof when a device is unavailable; unit tests remain required and release proof remains pending.

## Phase 1: Android Controller and Mechanism Proof

### Agent Tier

default. Stop for thinking-tier review if trusted-overlay behavior cannot meet the contract.

### Goal

Implement a testable Android panel controller and prove its platform behavior before connecting public commands.

### Files or Surfaces To Change

Android service, controller/view implementation, necessary DI seams, controller tests and existing service/inspection tests. Choose the nearest suitable existing module after checking dependency direction; do not create a module or dependency cycle. Add a reproducible opt-in proof under `validation/on-screen-logs/` if a device harness is needed, with its own tests. Use test-only/instrumentation access to the controller; no temporary exported production receiver or hidden release command.

### Steps

1. Record baseline app bounds, active package, snapshot matches, screenshot, and accessibility configuration using Android Settings or a generic fixture screen.
2. Implement pure validation/geometry/state logic and the custom-drawn noninteractive view. Follow every default and overflow rule in the plan.
3. Implement service-owned lifecycle, generation-scoped expiry and bounded draw acknowledgement. Add exact-panel identity to inspection without dropping raw overlay metadata.
4. Test invalid replacement preservation, successful replacement, expiry, cancellation, detach, and configuration changes.
5. Exercise the controller on an emulator with a full-display screenshot and a short ADB screen recording. Verify capture playback and readable updated text, not merely file existence. Verify taps, scrolls, editable text focus, navigation, and app bounds with panel shown/hidden.
6. Record whether draw acknowledgement sufficiently orders the subsequent capture in practice. Do not claim compositor synchronization. If captures repeatedly contain old labels, stop and document the mechanism gap before Phase 2.

### Acceptance Criteria

- One window; physical left/right geometry works in portrait and landscape with non-default font scale.
- Draw callback and TTL use generation identity; old expiry cannot clear a replacement.
- Invalid text/color/layout leaves the old display unchanged. Render timeout/cancellation cannot cause late attachment.
- Own labels cannot be found through app text matchers; other windows remain reported.
- Screenshot and playable video contain the overlay. Interactions and app bounds remain unchanged.

### Validation

Run from repository root:

```sh
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew shared:data:operator:testDebugUnitTest
./gradlew shared:test:testDebugUnitTest
./gradlew app:installDebug
adb devices
```

Select a disposable target explicitly. Use the existing permission script's help/current contract before enabling the debug service. Run controller tests in whichever module owns the new code as well; record exact command in findings. Live proof requires a connected interactive target and the new debug APK. Verify a short recording with Android's `screenrecord` help for the device's supported limits, stop/finalize gracefully, pull, and play it. Always remove the panel afterward. Capture on at least the available API level and document the minimum-version compatibility path; do not imply all versions were live-tested.

### Expected Commit

```text
feat(android): add service-owned on-screen log panel
```

## Phase 2: Raw Execution Contract and Public Documentation

### Agent Tier

default.

### Goal

Make the proven controller available through raw exec and existing execute transports, with truthful results and public docs.

### Files or Surfaces To Change

Node execution contracts, aliases/action registration as required, strict validator, errors, tests; Android parser/actions/engine and tests; existing transport tests; authored `docs/api/on-screen-logs.md`, `actions.md`, `snapshot.md`, `errors.md`, and relevant serve/MCP descriptions; docs navigation/generated output.

### Steps

1. Add both canonical actions and shared field schema without loosening existing actions. Reject unrelated params on either new action.
2. Add Android parsing and engine/controller dispatch via normal execution serialization. No parallel transport, custom broadcast shortcut, or host-owned renderer.
3. Emit string-valued result data and structured failure codes. Test app-root-unavailable handling: use established service readiness, not an app-node prerequisite for rendering.
4. Add snapshot `operator_overlay_visible` data; preserve raw window semantics. Test own-overlay identity and other overlay coexistence.
5. Prove raw `exec`, serve execute, and MCP execute carry identical fields/results. Existing generic MCP schema accepts action params; validate through the canonical executor rather than duplicating permissive schemas.
6. Create docs using the actions page as the parameter/default/error exemplar. Reread against source and refine before committing. Declare static timing and capture limits prominently.
7. Run repeated raw set -> screenshot -> replace -> screenshot -> clear sequences on the device. Verify successive labels and expiry; record failures rather than rerunning until one succeeds.

### Acceptance Criteria

- Required valid/invalid cases: defaults, both anchors/alignments, each numeric boundary, zero offsets, missing/blank text, too-long text, forbidden controls, numeric strings, floats, null, invalid/normalized colors, unknown keys, irrelevant params, clear with nonempty params.
- Node and direct Android validation agree. Failed execution has nonzero CLI status and failed envelope/step information.
- Service unavailable, layout failure, render failure, render timeout, and cancellation have tests; no late view after failure.
- Raw API docs ship with the API; transport claims are tested. No CLI convenience implementation yet.

### Validation

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew shared:data:operator:testDebugUnitTest shared:test:testDebugUnitTest
./gradlew app:assembleDebug app:testDebugUnitTest app:installDebug
./scripts/docs_build.sh
node apps/node/dist/cli/index.js devices
node apps/node/dist/cli/index.js doctor --device <device_serial> --operator-package com.clawperator.operator.dev
node apps/node/dist/cli/index.js exec <execution-json-path> --device <device_serial> --operator-package com.clawperator.operator.dev
```

Store a generic example payload in validation fixtures with fixed task/action IDs and these actions in order: set text `FLOW-001: Observe settings`, screenshot to a caller-provided absolute output path, clear. Run a second sequence with replacement text and custom style. Test bad payloads in validation-only mode using the current CLI help. Existing transport tests use doubles where no device exists; those prove routing/schema, not pixels.

### Expected Commit

```text
feat(api): expose on-screen log actions with verified rendering results
```

PR-1 is now eligible for review. Do not begin PR-2 until merge and continuation. Keep findings and this multi-PR pack.

## Phase 3: CLI Convenience

### Agent Tier

default.

### Goal

Expose `on-screen-log set` and `on-screen-log clear` as thin mappings to the merged actions.

### Files or Surfaces To Change

`apps/node/src/cli/registry.ts`, a focused command/builder beside existing action commands, daemon integration if required, CLI/help/exit-code/daemon tests, and `docs/api/on-screen-logs.md` plus generated CLI docs.

### Steps

1. Confirm PR-1 is merged and its action contract is present before editing.
2. Map exactly the flags in the parent plan; keep all panel state on Android. Do not overload the existing `logs` command.
3. Use the common execution path including daemon proxying. Preserve the no-post-dispatch-fallback rule for mutations.
4. Add help/examples and valid/invalid/missing-value tests. Verify global and command-local options where existing conventions support them.
5. Update authored docs via docs-author, regenerate, and run the new CLI against the debug device.

### Acceptance Criteria

- CLI-built actions match equivalent raw payloads with the same normalized defaults.
- Missing, repeated, unknown, invalid flags and invalid subcommands produce structured errors and nonzero status.
- JSON stdout remains parseable; pretty mode works. Explicit device/package and no-daemon behavior remain correct.
- Existing host `logs` tests and help remain unchanged.

### Validation

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
node apps/node/dist/cli/index.js on-screen-log --help
node apps/node/dist/cli/index.js on-screen-log set --text "FLOW-001: Observe settings" --anchor right --device <device_serial> --operator-package com.clawperator.operator.dev
node apps/node/dist/cli/index.js on-screen-log clear --device <device_serial> --operator-package com.clawperator.operator.dev
```

Also run set/clear with `--no-daemon`, custom colors, zero offsets, and invalid/missing values. Capture raw stdout/status in the validation artifact.

### Expected Commit

```text
feat(cli): add on-screen log set and clear commands
```

## Phase 4: Cross-Surface Regression and Handoff

### Agent Tier

default.

### Goal

Prove the complete interface across lifecycle, interaction, and capture, and reconcile docs with actual behavior.

### Files or Surfaces To Change

`validation/on-screen-logs/` harness/fixtures/tests, directly implicated Android/Node regression tests and fixes, authored docs refinements, task status/findings. This does not defer the earlier phases' tests.

### Steps

1. Run a live matrix: defaults; left/right anchor crossed with left/right alignment; nonzero offsets; both color forms; multiline wrapping/truncation; invalid layout; replace; clear twice; short TTL; replacement before expiry; service restart; rotation; increased font scale.
2. Compare app bounds/foreground and text matching before/during/after. Put a label on the overlay that is absent from the app and require app read/wait not to find it. Test another real overlay/dialog without treating it as owned instrumentation.
3. Record one short playable video showing label replacement and clear; retain full-display screenshots for styles. Check assets visually and record what is or is not visible.
4. Run at least ten sequential set/capture/replace/clear cycles without hidden retries. Record missing/stale frames and lifecycle anomalies. Fix them with regression tests or mark the gate blocked.
5. Reread docs against code and findings. Retain only demonstrated capture claims, include known platform limits, and verify the raw/CLI output keys and units.
6. Update completed statuses, preserve the task until PR-2 finalization, and identify durable facts for task-cleanup. No app-specific examples or workflows.

### Acceptance Criteria

- Accuracy: documented success means draw acknowledgement; media review proves the displayed labels without asserting atomic capture.
- Scope: static text/style only, no timer/streaming/metadata system.
- Evidence: findings link commands and observed results; unsupported/unavailable device scenarios are labelled.
- Format: public schemas, help, docs, and returned string-valued data agree.
- All required tests pass and artifacts are readable/playable. Any unproved live gate remains pending rather than declared complete.

### Validation

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew shared:data:operator:testDebugUnitTest shared:test:testDebugUnitTest
./scripts/docs_build.sh
git diff --check
```

Run the opt-in validation harness using its documented target/output arguments. Restore any device settings changed during proof and clear the panel. Record the exact invocation and exit status in findings. No public upload of media is required.

### Expected Commit

```text
test(api): verify on-screen log lifecycle and capture behavior
```
