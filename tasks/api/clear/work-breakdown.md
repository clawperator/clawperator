# Android `clear` Contract Bug Fix Work Breakdown

Parent plan: `tasks/api/clear/plan.md`

## Executive Summary

1 PR, 2 phases. Phase 1 wires `clear` end-to-end through all six Android layers
and adds regression tests. Phase 2 updates public docs. All six layers must be
updated together so no partial state exists where `clear` is parsed but not
implemented, or implemented but not tested.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Update all six Android layers in the same phase: `AgentCommandParser`,
  `UiAction.EnterText`, `UiActionEngine`, `TaskUiScopeDefault`,
  `UiTreeManager` interface, and `UiTreeManagerAndroid`. Do not commit a state
  where `clear` is wired partway through the stack.
- Do not silently skip a failed clear step. If `clear=true` and `ACTION_SET_TEXT`
  with empty text fails, return `set_text_failed` before attempting the real
  text set.
- Do not use clipboard, paste, or selection tricks to implement clear. The only
  clear mechanism in this pack is `ACTION_SET_TEXT` with empty `CharSequence`.
- Do not implement `clear` for the API 33 input-connection route. That is out of
  scope for this pack.
- Do not fold any enter_text strategy improvements into this pack. Keep the diff
  focused on the `clear` wire.
- Update every existing caller of `UiTreeManager.setText()` to pass the new
  `clear` parameter with `false` as the default. Compile the Android module to
  confirm no call sites are missing.
- Tests for `clear=true`, `clear=false`, and `clear` absent are all required.
  Do not stop at verifying that `clear` is forwarded - also verify that the
  clear step is actually called (two `ACTION_SET_TEXT` calls) versus not called
  (one `ACTION_SET_TEXT` call).
- Do not edit generated docs directly. Update authored docs in `docs/api/` and
  then run `./scripts/docs_build.sh`.
- Use the branch-local Node build for validation, not the global `clawperator`
  binary.
- When multiple Android targets are connected, use `--device <device_serial>`
  explicitly.
- Do not record raw device serials. Use `<device_serial>` in all notes.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/api/clear/plan.md` | Contract boundaries and sequencing rules |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` | Drop point - the enter_text parsing block does not read `clear` |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt` | `EnterText` class has no `clear` field |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | How `EnterText` is dispatched to the task scope |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` | `enterText()` method that calls `UiTreeManager.setText()` |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt` | Interface `setText()` signature that needs a `clear` param |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` | Implementation that needs the clear step |
| `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt` | Existing test patterns for action dispatch |
| `apps/android/shared/data/operator/src/commonTest/kotlin/actiontask/operator/agent/AgentCommandParserDefaultTest.kt` | Existing parser test patterns |
| `docs/api/actions.md` | Current public docs that must be updated in Phase 2 |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Wire clear end-to-end, implement, test, and document | 1, 2 | default | none |

## Phase 1: Wire `clear` Through Android Stack

### Agent Tier

default

### Goal

Update all six Android layers so `clear=true` performs an explicit clear step
before text entry, `clear=false` preserves current behavior, and tests prove
both cases plus the absent-clear default.

### Files or Surfaces To Change

- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`
- Test files adjacent to the changed surfaces

### Steps

1. Open `AgentCommandParser.kt` and find the `enter_text` parsing block. Read
   the existing fields parsed in that block (`matcher`, `text`, `submit`,
   `retry`). Add `clear` alongside them:
   ```kotlin
   clear = params.booleanOrDefault("clear", false)
   ```
   Confirm that `clear` is forwarded into the constructed `UiAction.EnterText`.
   If `UiAction.EnterText` has no `clear` field yet, Step 2 adds it.

2. Open `UiAction.kt` and add `val clear: Boolean = false` to `UiAction.EnterText`.
   The default must be `false` to preserve backward compatibility for callers
   that do not pass `clear`.

3. Open `UiActionEngine.kt` and find `executeEnterText()`. Update the call to
   `taskScope.ui.enterText()` to forward `action.clear` from `UiAction.EnterText`.

4. Open `TaskUiScopeDefault.kt` and find the `enterText()` method. Add
   `clear: Boolean = false` as a parameter and forward it to `UiTreeManager.setText()`.

5. Open `UiTreeManager.kt` and add `clear: Boolean` to the `setText()` interface
   signature. Search the entire Android codebase for all call sites of `setText()`
   and update each one to pass `clear = false` as the default. Compile the
   Android module to confirm no callers are missing before continuing.

6. Open `UiTreeManagerAndroid.kt` and find the `setText()` implementation.
   Before the existing `ACTION_SET_TEXT` call, add the clear step when
   `clear=true`:
   ```kotlin
   if (clear) {
       val clearArgs = Bundle().apply {
           putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "")
       }
       val clearSucceeded = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, clearArgs)
       if (!clearSucceeded) {
           return false
       }
   }
   ```
   The clear step uses `ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE` with an empty
   string, which is the Android-documented way to clear a field via
   `ACTION_SET_TEXT`. A failed clear step must return `false` (or the equivalent
   failure result) before the text-set call is attempted.

7. Add regression tests:

   In `AgentCommandParserDefaultTest`:
   - `enter_text` JSON with `"clear": true` parses to `UiAction.EnterText(clear = true)`
   - `enter_text` JSON with `"clear": false` parses to `clear = false`
   - `enter_text` JSON without a `clear` key defaults to `clear = false`

   In `UiActionEngineDefaultTest`:
   - `enter_text` action with `clear = true` results in `clear = true` being
     forwarded to the task scope (verify via the mock recording)
   - `enter_text` action with `clear = false` results in `clear = false` being
     forwarded

   In a unit test adjacent to `UiTreeManagerAndroid` (or via a recording mock
   in the engine tests):
   - `clear = true`: verify two `ACTION_SET_TEXT` calls occur - first with empty
     text, then with the actual text
   - `clear = true` and the clear step fails: the mock node returns `false` for
     the first `ACTION_SET_TEXT`; verify `setText()` returns `false` and the
     second `ACTION_SET_TEXT` is not called
   - `clear = false`: verify only one `ACTION_SET_TEXT` call occurs with the
     actual text

8. Compile and run all tests:
   ```bash
   ./gradlew app:assembleDebug app:testDebugUnitTest
   npm --prefix apps/node run build
   npm --prefix apps/node run test
   ./scripts/apply_coding_standards.sh -f
   git diff --check
   ```

9. If a target is available:
   ```bash
   ./gradlew app:installDebug
   adb -s <device_serial> shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity
   node apps/node/dist/cli.js type "new text" --selector '<matcher_json>' --clear --device <device_serial> --operator-package com.clawperator.operator.dev
   ```
   Verify the field was cleared before the new text was written. Use a field
   with pre-existing content so the clear effect is observable. Record the
   result using `<device_serial>` as a placeholder.

### Acceptance Criteria

- All six Android layers parse, carry, and apply `clear`.
- `clear=true` calls `ACTION_SET_TEXT` with empty string before the real text
  set.
- A failed clear step returns `set_text_failed` explicitly and does not proceed
  to the text-set call.
- `clear=false` behavior is unchanged from before this fix.
- The Android module compiles with no missing-argument errors on `setText()`
  callers.
- Tests prove all three cases: `clear=true`, `clear=false`, `clear` absent.
- Tests prove that `clear=true` and a failing clear step stop before the text
  set call.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew app:installDebug
./scripts/clawperator_smoke_core.sh
./scripts/apply_coding_standards.sh -f
git diff --check
```

Plus live validation per Step 9 when a target is available, or an explicit
blocked reason naming the missing precondition.

### Expected Commit

```text
fix(android): wire clear through enter_text stack
```

## Phase 2: Docs Update

### Agent Tier

default

### Goal

Update public docs to accurately describe `clear` behavior after the fix ships.

### Files or Surfaces To Change

- `docs/api/actions.md`

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the authored-doc update.
2. Open `docs/api/actions.md` and find the `enter_text` section. Update the
   description of `clear` to match the shipped behavior: performing an explicit
   `ACTION_SET_TEXT` with empty string before writing new text, for targets
   that support `ACTION_SET_TEXT`. Note that `clear=false` preserves current
   replace behavior and that a failed clear step returns an explicit error.
3. Do not document behavior that has not shipped. If the API 33 input-connection
   path does not yet implement `clear`, do not describe `clear` behavior for
   custom editors.
4. Run `./scripts/docs_build.sh` and confirm it passes.

### Acceptance Criteria

- `docs/api/actions.md` accurately describes `clear` behavior for `enter_text`.
- `./scripts/docs_build.sh` passes.

### Validation

```bash
./scripts/docs_build.sh
git diff --check
```

### Expected Commit

```text
docs(api): document enter_text clear behavior
```
