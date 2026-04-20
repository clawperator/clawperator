# Android `clear` Contract Bug Fix

## Executive Summary

The `clear` option for `enter_text` is part of the public Clawperator contract
(Node API, CLI help, and execution format) but the Android runtime never parses
or applies it. Callers who set `clear=true` receive no error but the runtime
behaves identically to `clear=false`. This pack fixes the silent contract
violation in a single PR: 2 phases (wire + implement, then docs).

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

After this pack ships, `clear=true` on `enter_text` will perform an explicit
clear step before writing new text on Android for nodes that support
`ACTION_SET_TEXT`. Callers who previously set `clear=true` and received silent
no-op behavior will now receive actual clearing behavior. Callers who set
`clear=false` or omit `clear` will see no behavior change.

## Why Now

The public surface documents `clear` as a supported parameter:

- CLI help exposes `--clear`: `apps/node/src/cli/registry.ts` (type command)
- Node execution contract includes `clear?: boolean`: `apps/node/src/contracts/execution.ts`
- `buildTypeTextExecution()` includes `clear` in the params sent to Android:
  `apps/node/src/domain/actions/typeText.ts`

But the Android runtime drops it at the parser level without error:

- `AgentCommandParser` does not read `clear` from the `enter_text` JSON block
- `UiAction.EnterText` has no `clear` field
- `UiTreeManagerAndroid.setText()` never applies a clear step

The current state is the worst outcome: the contract promises behavior it does
not deliver and returns no error. Agents that already pass `clear=true` get
no signal that the field was ignored.

## In Scope

- Parse `clear` from the `enter_text` JSON payload in `AgentCommandParser`
- Add `clear: Boolean = false` to `UiAction.EnterText`
- Wire `clear` through `UiActionEngine`, `TaskUiScopeDefault`, `UiTreeManager`
  interface, and `UiTreeManagerAndroid` implementation
- Implement the clear step in `UiTreeManagerAndroid` as `ACTION_SET_TEXT` with
  an empty `CharSequence`, followed by the real text set
- Return an explicit error when `clear=true` and the clear step fails
- Add regression tests for `clear=true`, `clear=false`, and `clear` absent
- Update public docs to accurately describe `clear` behavior

## Out of Scope

- Implementing `clear` for the API 33 input-connection path - that is part of
  the enter_text strategy pack (`tasks/api/enter-text/`)
- Changing the Node or CLI contract shape - `clear` already exists there
- Non-Android runtimes

## Sequencing

This pack should merge before the enter_text strategy pack's PR-1. The
strategy pack's Phase 1 refactors `UiTreeManager.setText()` into an internal
strategy seam. If this pack ships first, the seam interface must carry `clear`
through unchanged even though the strategy pack does not implement new clear
behavior.

If the enter_text strategy pack is already in progress when this pack ships,
the implementer must verify that the seam interface is updated to include the
`clear` field before this bug fix is merged.

## Existing Artifact Scope

- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`:
  parse `clear` from the `enter_text` JSON block
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`:
  add `clear: Boolean = false` to `UiAction.EnterText`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`:
  forward `clear` from `UiAction.EnterText` to `taskScope.ui.enterText()`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`:
  accept `clear` and pass it to `UiTreeManager.setText()`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`:
  add `clear: Boolean` to the `setText()` interface signature
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`:
  implement the clear step before the real text set when `clear=true`
- Test files adjacent to the changed surfaces
- `docs/api/actions.md`: document the actual `clear` behavior

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `AgentCommandParser.kt` | Parse `clear` from JSON | PR-1 / Phase 1 |
| `UiAction.kt` | Add `clear` field to `EnterText` | PR-1 / Phase 1 |
| `UiActionEngine.kt` | Forward `clear` to `enterText()` | PR-1 / Phase 1 |
| `TaskUiScopeDefault.kt` | Accept and forward `clear` | PR-1 / Phase 1 |
| `UiTreeManager.kt` | Add `clear` param to interface | PR-1 / Phase 1 |
| `UiTreeManagerAndroid.kt` | Implement clear step | PR-1 / Phase 1 |
| Test files | Regression coverage | PR-1 / Phase 1 |
| `docs/api/actions.md` | Document clear behavior | PR-1 / Phase 2 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current Node contract | `apps/node/src/contracts/execution.ts` (`clear?: boolean` in `ActionParams`) |
| CLI clear flag | `apps/node/src/cli/registry.ts` (type command, `--clear` flag) |
| Clear in execution builder | `apps/node/src/domain/actions/typeText.ts` (`buildTypeTextExecution`) |
| Android drop point | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` (enter_text parsing block, no `clear` read) |
| UiAction field gap | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt` (`EnterText` class, no `clear` field) |
| Android clear mechanism | `AccessibilityNodeInfo.ACTION_SET_TEXT` with `ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE` set to empty string - the Android-documented way to clear a field |
| Existing dispatch tests | `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt` |
| Existing parser tests | `apps/android/shared/data/operator/src/commonTest/kotlin/actiontask/operator/agent/AgentCommandParserDefaultTest.kt` |
| Public docs | `docs/api/actions.md` |

## Deterministic - Do Not Re-derive

- `clear=true` means: call `ACTION_SET_TEXT` with an empty `CharSequence` first,
  then call `ACTION_SET_TEXT` with the actual text. Both calls use the same
  `ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE` Bundle key.
- If the clear step (empty `ACTION_SET_TEXT`) fails, return an explicit error
  using the `set_text_failed` failure point. Do not silently proceed to the real
  text set when the clear step was requested but failed.
- `clear=false` or `clear` absent means current behavior is unchanged.
- Do not use clipboard mutation (`ACTION_PASTE`, `ACTION_COPY`) or text
  selection tricks to implement clear. The only clear mechanism in this pack is
  `ACTION_SET_TEXT` with empty `CharSequence`.
- The `UiTreeManager.setText()` interface signature must gain a `clear: Boolean`
  parameter. Every existing caller of `setText()` outside of `TaskUiScopeDefault`
  must be updated to pass `clear = false` as the default. The Android module
  must compile after the interface change.
- Do not implement `clear` behavior for the API 33 input-connection route. That
  belongs in the enter_text strategy pack.

## Decision Rules

| Question | Rule |
| --- | --- |
| How is `clear=true` implemented? | `ACTION_SET_TEXT` with empty `CharSequence`, then `ACTION_SET_TEXT` with actual text. Both use `ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE` in a Bundle. |
| What if the empty `ACTION_SET_TEXT` fails? | Return explicit error using `set_text_failed`. Do not silently proceed to text entry. |
| What if the node does not support `ACTION_SET_TEXT` at all? | The regular text-entry failure path applies regardless of `clear`. The clear step only runs after a target node is identified and the `ACTION_SET_TEXT` path would be attempted anyway. |
| Does `clear=false` change anything? | No. `clear=false` or `clear` absent preserves existing behavior completely. |
| Can `clear=true` produce a different failure mode than `clear=false`? | Yes. If the clear step itself fails, the caller gets `set_text_failed` even if the subsequent text set would have succeeded. That is correct - the requested operation (clear then type) did not complete. |
| When must docs change? | This fix changes user-visible behavior for callers who pass `clear=true`. Docs must reflect actual behavior before the PR is merged. |
| Should `clear=true` be a no-op when the field is already empty? | No. Always attempt the clear step when `clear=true` is requested. The resulting behavior is the same (empty then typed), but the implementation is consistent and testable. |

## Failure Modes To Prevent

- `clear` is parsed and carried through the stack but the clear step is never
  called in `UiTreeManagerAndroid`
- The empty `ACTION_SET_TEXT` fails and the text set proceeds silently anyway
- `clear=true` is treated as optional and skipped rather than surfaced as an
  error when the clear step fails
- `UiTreeManager.setText()` gains the `clear` parameter but callers outside
  `TaskUiScopeDefault` are not updated, causing a compilation failure
- Tests only check that `clear` is forwarded but not that the clear step is
  actually called in the Android runtime
- Docs continue to omit or vaguely describe `clear` after the fix ships

## Output Contract

After PR-1, Phase 1:

- `clear=true` on `enter_text` performs an explicit clear step before writing
  new text on `ACTION_SET_TEXT` targets.
- Failed clear steps return explicit errors with `set_text_failed`.
- `clear=false` behavior is unchanged.
- All stack layers (parser, UiAction, UiActionEngine, TaskUiScopeDefault,
  UiTreeManager interface, UiTreeManagerAndroid) carry `clear` consistently.
- Tests prove all three cases: `clear=true`, `clear=false`, and `clear` absent.

After PR-1, Phase 2:

- Public docs accurately describe `clear` behavior.

## Idempotency

- Re-running `enter_text` with `clear=true` on the same field should produce
  consistent results: clear the field, then write new text.
- The clear + set sequence is not atomic, but each step is deterministic.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Public `clear` behavior | `docs/api/actions.md` |
| Android clear implementation notes | Code comment in `UiTreeManagerAndroid.setText()` if the clear step has non-obvious behavior warranting explanation |
