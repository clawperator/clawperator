# Android Enter Text Implementation Findings

This file tracks implementation-time findings for `tasks/api/enter-text/`.
It is intentionally branch-local and temporary while the task pack is active.

## Current Status

- Phase 1 completed in `refactor(android): add enter_text strategy seam`
- Phase 2 completed in `feat(android): improve enter_text submit routing`
- Phase 3 completed in `feat(android): add api33 input-connection enter_text path`
- Phase 4 completed locally at the time of this note

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
- Review follow-up tightened the shipped API 33 implementation to the most
  truthful deterministic path:
  - move the cursor to the end with
    `setSelection(Int.MAX_VALUE, Int.MAX_VALUE)`
  - clear preceding text with `deleteSurroundingText(Int.MAX_VALUE, 0)`
  - replace via `commitText(text, 1)`
- We explicitly stopped inferring full-document length from surrounding-text
  windows because those windows can be truncated and would otherwise create a
  false-success partial-replace path.
- The input-connection bridge still treats dispatch onto a non-null
  accessibility input connection as success for mutating calls because this API
  surface exposes those mutators as fire-and-forget rather than boolean-return
  operations.
- `currentInputEditorInfo` is nullable on the Android API surface, so the API
  33 route now requires editor metadata only for best-effort submit. Missing
  editor info no longer blocks replace-style text entry.
- The strategy-level tests now carry the stronger correctness signal by
  exercising delete-fallback failure and stale-session behavior directly.
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
  `onStartInput()`, `onFinishInput()`, and `onUpdateSelection()` on debug
  builds so live runs can truthfully identify whether the API 33 path is
  actually active without widening production logcat exposure unnecessarily.

## Test Findings

- Unit coverage now exercises:
  - strategy routing through the legacy path
  - legacy `submit=true` editor-action vs click fallback behavior
  - API 33 routing when `ACTION_SET_TEXT` is unavailable
  - API 33 explicit failure cases for missing session and inactive session
  - API 33 lower-SDK skip behavior
  - API 33 replace behavior for pre-populated content
  - API 33 delete-and-commit behavior even when surrounding text is present
  - API 33 replace success even when editor info is missing
  - API 33 `clear=true` behavior with delete-and-commit replace semantics
  - API 33 explicit failure when the delete fallback cannot complete

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
- A later Amazon pass improved the live picture materially:
  - after clicking into the search surface and targeting
    `com.amazon.mShop.android.shopping:id/rs_search_src_text`, live logs showed
    `OperatorAccessibilityInputMethod` `onStartInput(...)` events from the
    `.dev` accessibility service
  - that proves the API 33 accessibility input-method capability is active on
    the device for at least one real editor session
  - the same run still logged
    `enter_text strategy=legacy_action_set_text submit_method=not_requested`,
    so Amazon search remains a legacy-route proof, not an API 33 strategy proof
- Because of that, the remaining API 33 live-verification gap is now narrower:
  the service capability is active, but we still do not have a truthful live
  editor surface that skips `ACTION_SET_TEXT` and forces
  `api33_input_connection`.

## Device / Environment Notes

- Local validation must keep using the branch-local Node build from
  `apps/node/dist/cli/index.js`, not a global `clawperator` install.
- Local live verification should keep using the `.dev` operator package.
- Device placeholders must remain redacted in notes and summaries; do not add
  raw serials here.

## Validation Notes

- Phase 3 validation completed with:
  - `npm --prefix apps/node run build`
  - `npm --prefix apps/node run test`
  - `./gradlew shared:test:testDebugUnitTest --tests 'clawperator.uitree.UiTreeManagerAndroidTest'`
  - `./gradlew app:assembleDebug app:testDebugUnitTest`
  - `./gradlew app:installDebug`
  - `git diff --check`
- Phase 4 validation completed with:
  - `PATH='/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin' ./scripts/docs_build.sh`
  - `npm --prefix apps/node run build`
  - `npm --prefix apps/node run test`
  - `./gradlew app:assembleDebug app:testDebugUnitTest`
  - `./gradlew app:installDebug`
  - `git diff --check`

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
