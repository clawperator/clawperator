# Android Enter Text Implementation Findings

This file tracks implementation-time findings for `tasks/api/enter-text/`.
It is intentionally branch-local and temporary while the task pack is active.

## Current Status

- Phase 1 completed in `refactor(android): add enter_text strategy seam`
- Phase 2 completed in `feat(android): improve enter_text submit routing`
- Phase 3 in progress locally at the time of this note
- Phase 4 not started yet

## Runtime Findings

- The Android `enter_text` path is now structured as an internal first-match-wins
  strategy ladder inside
  `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`.
- The legacy `ACTION_SET_TEXT` route remains first in the ladder. This matches
  the task pack requirement to preserve current replace semantics when that path
  is available.
- The legacy route now prefers `ACTION_IME_ENTER` for `submit=true` when the
  target node exposes it and falls back to a click only as best effort.
- Phase 3 introduces an Android-only `TextInputConnectionSource` bridge in
  `apps/android/shared/data/toolkit/src/main/kotlin/clawperator/accessibilityservice/TextInputConnectionSource.kt`
  so API 33 input-connection behavior can be unit tested without a live
  accessibility service.
- The API 33 route is guarded by `Build.VERSION.SDK_INT >= TIRAMISU` and only
  runs after the legacy route is unavailable or fails.

## API 33 Replace Semantics

- The task pack requires replace semantics, not append-at-cursor semantics.
- The shipped API 33 implementation therefore uses a two-stage replace plan:
  - Preferred path: if the current text length is knowable from
    `EditorInfo.initialSurroundingText`, select `0..length` and replace via
    `commitText(text, 1)`.
  - Fallback path: if full length is not knowable, read `getSurroundingText()`,
    and if that still does not provide a deterministic full-selection path,
    move the cursor to the end with `setSelection(Int.MAX_VALUE, Int.MAX_VALUE)`
    and clear preceding text with `deleteSurroundingText(Int.MAX_VALUE, 0)`
    before `commitText(text, 1)`.
- We should keep watching whether any real editor rejects the fallback
  end-and-delete sequence even when an input connection is active. Unit tests
  prove the intended contract; live proof is still pending.

## Service / Capability Findings

- The operator accessibility service now opts into API 33 input-method-editor
  support by:
  - adding `flagInputMethodEditor` to
    `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml`
  - OR-ing `AccessibilityServiceInfo.FLAG_INPUT_METHOD_EDITOR` into the runtime
    service flags on API 33+
  - overriding `onCreateInputMethod()` and returning a service-owned
    `InputMethod` implementation on API 33+
- Extra lifecycle diagnostics were added around `onCreateInputMethod()`,
  `onStartInput()`, `onFinishInput()`, and `onUpdateSelection()` so live runs
  can truthfully identify whether the API 33 path is actually active.

## Test Findings

- Unit coverage now exercises:
  - strategy routing through the legacy path
  - legacy `submit=true` editor-action vs click fallback behavior
  - API 33 routing when `ACTION_SET_TEXT` is unavailable
  - API 33 explicit failure cases for missing session, inactive session, and
    missing editor info
  - API 33 lower-SDK skip behavior
  - API 33 replace behavior for pre-populated content
  - API 33 selection-before-commit behavior when the current text length is
    known
  - API 33 `clear=true` behavior with the selection step preserved

## Live Validation Findings

- Legacy live validation is complete on a physical Android target using the
  branch-local Node CLI and the `.dev` operator package.
- A truthful legacy proof was captured on a standard accessible search field.
  Runtime logs showed:
  - `enter_text strategy=legacy_action_set_text submit_method=ime_action`
  - `enter_text strategy=legacy_action_set_text submit_method=not_requested`
- Play Store search was useful as a legacy-path proof only. It did not truthfully
  prove the API 33 path because the target field still exercised the legacy
  `ACTION_SET_TEXT` route.
- Attempted custom-editor candidates so far have not produced a truthful API 33
  proof:
  - Amazon search was not stably targetable with the current selector used
    during exploration.
  - Other candidate surfaces produced timeouts or unreliable command envelopes,
    so they are not evidence.
- At the time of writing, no live run has shown the new input-method lifecycle
  logs (`onCreateInputMethod`, `onStartInput`, `onFinishInput`,
  `onUpdateSelection`) and no live run has emitted
  `enter_text strategy=api33_input_connection ...`.
- Because of that, API 33 live verification is currently blocked on proving
  that the service capability is active on-device and on finding an editor that
  truthfully requires the custom input-connection route.

## Device / Environment Notes

- Local validation must keep using the branch-local Node build from
  `apps/node/dist/cli/index.js`, not a global `clawperator` install.
- Local live verification should keep using the `.dev` operator package.
- Device placeholders must remain redacted in notes and summaries; do not add
  raw serials here.

## Follow-up Watch List

- Confirm whether a suitable custom-editor surface already exists in an
  installed app or skill flow that reliably avoids the legacy `ACTION_SET_TEXT`
  path.
- Confirm on-device whether the accessibility service is exposing the API 33
  input-method lifecycle after install/rebind, using logs rather than
  assumptions.
- If final live proof remains blocked, keep the write-up explicit that API 33
  behavior is verified by unit coverage plus blocked live preconditions, not by
  a successful on-device custom-editor demonstration.
