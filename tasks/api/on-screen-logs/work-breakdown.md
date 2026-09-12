# On-Screen Logs Implementation

Contract: [plan.md](plan.md). Release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## Progress and Scope

| PR | Outcome | Phases | Dependency | Status |
| --- | --- | --- | --- | --- |
| PR-1 | Renderer and raw actions | 1-2 | None | [DONE] merged in `120c1eb782bbed67e1cb1fbe7c2080fdb302ff5d` |
| PR-2 | CLI convenience and public-interface proof | 3-4 | PR-1 merged | [DONE] implemented and validated locally; finalization pending |

PR-1 implementation and device evidence are retained in [findings.md](findings.md); use the merged source as authority. PR-2 is the final PR in this pack. Complete its CLI, regression coverage, live proof, documentation, in-scope repairs, and local commits. Phase 4 consumes Phase 3's commands; there is no approval pause between them.

## Context When Needed

- `apps/node/src/cli/registry.ts` and `apps/node/src/cli/commands/action.ts`: command registration and the shared mutation execution path.
- `apps/node/src/cli/daemonProxy.ts`: preserve uncertainty after dispatch without replaying mutations.
- `apps/node/src/domain/executions/validateExecution.ts` and `apps/node/src/test/unit/onScreenLogValidation.test.ts`: shipped schema and validation examples.
- `docs/api/on-screen-logs.md` and `apps/node/src/domain/executions/runExecution.ts`: existing raw API and screenshot-ordering limitation.
- `validation/on-screen-logs/`: existing raw/controller proof fixtures; they do not establish new CLI behavior.

## Phase 3: CLI Convenience [DONE]

### Goal

Expose `on-screen-log set` and `on-screen-log clear` as thin mappings to the merged actions.

### Files or Surfaces To Change

`apps/node/src/cli/registry.ts`, `apps/node/src/cli/commands/action.ts`, a focused builder `apps/node/src/domain/actions/onScreenLog.ts` (new), `apps/node/src/cli/daemonProxy.ts` only if required, `apps/node/src/test/unit/onScreenLogCommand.test.ts` (new), `cliRegistry.test.ts`, `cliHelp.test.ts`, `cliExitCode.test.ts`, `daemon/actionProxy.test.ts`, and `docs/api/on-screen-logs.md` plus generated CLI docs.

### Work

- Verify `git merge-base --is-ancestor 120c1eb782bbed67e1cb1fbe7c2080fdb302ff5d HEAD` succeeds and inspect the landed source contract. Do not replay PR-1 implementation or rely on its pre-squash commit IDs.
- Map exactly the flags in the parent plan; keep all panel state on Android. Do not overload the existing `logs` command.
- Use `runActionExecution` in `cli/commands/action.ts` for both commands, extending its existing seams narrowly. Validate via the canonical executor and preserve mutation `allowPostDispatchFallback:false`. Test no daemon, safe pre-dispatch fallback, and uncertain post-dispatch loss with zero duplicate dispatch. Do not duplicate the transport or silently renew TTL by replaying set.
- Add help/examples and valid/invalid/missing-value tests. Verify global and command-local options where existing conventions support them.
- Update authored docs via docs-author, regenerate, and run the new CLI against the debug device.

### Acceptance Criteria

- CLI-built actions match equivalent raw payloads with the same normalized defaults.
- Missing, repeated, unknown, invalid flags and invalid subcommands produce structured errors and nonzero status.
- JSON stdout remains parseable; pretty mode works. Explicit device/package and no-daemon behavior remain correct.
- Clear rejects every panel option; set rejects extra positional arguments and duplicate panel flags. Zero offsets survive parsing. Integral decimal/exponent numeric tokens normalize like equivalent raw numbers; fractional, blank, hexadecimal, nonfinite, and suffix-bearing tokens fail without dispatch.
- Uncertain post-dispatch loss never triggers a second mutation. Pre-dispatch fallback and explicit --no-daemon use the same validated payload.
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

## Phase 4: Cross-Surface Regression and Handoff [DONE]

### Goal

Prove the complete interface across lifecycle, interaction, and capture, and reconcile docs with actual behavior.

### Files or Surfaces To Change

`validation/on-screen-logs/` harness/fixtures/tests, directly implicated Android/Node regression tests and fixes, authored docs refinements, task status/findings. This does not defer the earlier phases' tests.

### Work

- Add `validation/on-screen-logs/run_cli_contract_proof.sh` and `test_cli_contract_proof.sh` beside the existing raw/controller harnesses. The new opt-in harness takes `--device <device_serial> --output-dir <absolute_path>`, uses branch-local CLI commands and the debug Operator, records a result per case, fails on unmet assertions, and clears the panel/restores changed device settings on normal completion and interruption. Test parsing, cleanup, and failure propagation using fake command executables in the same phase. Do not treat the fixed-scenario debug Activity as proof of the new CLI. Run a live matrix: defaults; left/right anchor crossed with left/right alignment; nonzero offsets; both color forms; multiline wrapping/truncation; invalid layout; replace; clear twice; short TTL; replacement before expiry; service restart; rotation; increased font scale.
- Compare app bounds/foreground and text matching before/during/after. Put a label on the overlay that is absent from the app and require app read/wait not to find it. Test another real overlay/dialog without treating it as owned instrumentation.
- Record one short playable video showing label replacement and clear; retain full-display screenshots for styles. Check assets visually and record what is or is not visible.
- Run at least ten cycles of separate, awaited CLI set -> screenshot -> replacement set -> screenshot -> clear executions without hidden retries. Do not use the combined PR-1 JSON fixtures to prove capture pixels. Record the label expected in each image and inspect every cycle; no OCR or image-model dependency is required. Record missing/stale frames and lifecycle anomalies. Fix them with regression tests or mark the gate blocked.
- Reread docs against code and findings. Retain only demonstrated capture claims, include known platform limits, and verify the raw/CLI output keys and units.
- Update completed statuses, preserve the task until PR-2 finalization, and identify durable facts for task-cleanup. No app-specific examples or workflows.

### Acceptance Criteria

- Accuracy: documented success means draw acknowledgement; media review proves the displayed labels without asserting atomic capture.
- Scope: static text/style only, no timer/streaming/metadata system.
- Evidence: findings link commands and observed results; unsupported/unavailable device scenarios are labelled.
- Format: public schemas, help, docs, and returned string-valued data agree.
- All required tests pass and artifacts are readable/playable. Any unproved live gate remains pending rather than declared complete.

### Validation

```sh
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew shared:data:operator:testDebugUnitTest shared:test:testDebugUnitTest
./scripts/docs_build.sh
git diff --check
```

Run the new public-CLI proof harness (not only the debug controller harness):

```sh
bash validation/on-screen-logs/test_overlay_mechanism_proof.sh
bash validation/on-screen-logs/test_raw_execution_contract.sh
bash validation/on-screen-logs/test_cli_contract_proof.sh
bash validation/on-screen-logs/run_cli_contract_proof.sh --device <device_serial> --output-dir <absolute_output_dir>
```

The new harness/tests must be implemented in Phase 4 before these commands can pass. Restore any device settings changed during proof and clear the panel. Record the exact invocation and exit status in findings. No public upload of media is required.

## Completion

Use AGENTS.md for shared build/device rules and the docs-author/docs-build skills for public docs. Run the relevant Node checks after Phase 3 changes and again only when subsequent changes warrant it. Phase 4's Android checks and live evidence cover integration with the merged renderer. Retain meaningful evidence in findings, update PR-2 progress and the release row, and commit validated logical units. Preserve real limitations and complete unaffected work if a device gate is unavailable. Keep the pack until PR-2 finalization.

PR-2 local completion: see [findings.md](findings.md#pr-2-validation-and-capture-proof) for the final validation matrix, inspected media, in-scope harness repairs, and platform limits. Preserve this pack until finalization; no publication or merge was performed.
