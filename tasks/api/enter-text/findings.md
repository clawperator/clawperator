# `enter_text` Findings

## Scope

This note reviews how `enter_text` currently works in Clawperator's Android Operator app, where the API surface is too narrow for modern app text entry, and which Android accessibility APIs are relevant for improving reliability.

## Current Implementation

### Android runtime path today

`enter_text` flows through the task runtime into `UiTreeManagerAndroid.setText()`:

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt:541`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt:76`

What it does today:

1. Resolve the matched node from the current filtered UI tree.
2. Walk up to the first ancestor that is editable or exposes `ACTION_SET_TEXT`.
3. Best-effort focus with `ACTION_FOCUS` and `ACTION_CLICK`.
4. Call `performAction(ACTION_SET_TEXT, bundleWithText)`.
5. If `submit=true`, do a best-effort `ACTION_CLICK` on the target after the text is set.

Relevant code:

- `firstEditableAncestorOrSelf()` only recognizes nodes as text-entry candidates when they are editable or expose `ACTION_SET_TEXT`:
  `apps/android/shared/data/uitree/src/main/kotlin/clawperator/accessibilityservice/AccessibilityNodeInfoExtAndroid.kt:610`
- `setText()` only uses `ACTION_SET_TEXT` and does not try any other text-entry path:
  `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt:76`

### Current API/contract mismatch

The Node contract and CLI expose `clear`, but the Android runtime ignores it:

- Node execution contract includes `clear?: boolean`:
  `apps/node/src/contracts/execution.ts:6`
- `buildTypeTextExecution()` sends `clear` down to Android:
  `apps/node/src/domain/actions/typeText.ts:4`
- CLI advertises `--clear`:
  `apps/node/src/cli/registry.ts:559`
- Android parser for `enter_text` only reads `matcher`, `text`, `submit`, and `retry`:
  `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt:208`

So today the API implies at least two behaviors that do not actually exist:

- explicit clear-before-type behavior
- a meaningful submit/editor-action behavior

### Accessibility service capabilities currently enabled

The service is configured for window-content retrieval, gestures, and key-event filtering, but not for accessibility IME support:

- Static XML config:
  `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml:13`
- Runtime flag setup:
  `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt:35`

Notably absent:

- `AccessibilityServiceInfo.FLAG_INPUT_METHOD_EDITOR`
- `AccessibilityService.onCreateInputMethod()`
- `AccessibilityService.getInputMethod()`
- any use of `InputMethod.AccessibilityInputConnection`

## What Android Accessibility APIs Actually Offer

### 1. `ACTION_SET_TEXT`

Official Android docs say `ACTION_SET_TEXT`:

- is available from API 21
- sets the text of the node
- clears the field when invoked with `null` or empty text
- moves the cursor to the end

Source:

- [AccessibilityNodeInfo.ACTION_SET_TEXT](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo#ACTION_SET_TEXT)
- [AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_TEXT](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo.AccessibilityAction#ACTION_SET_TEXT)

Implications for Clawperator:

- Clawperator is already using the standard accessibility text-set path.
- The current implementation does not use the documented clear behavior, even though the Node API exposes `clear`.
- This path only works when the app exposes an editable node or an accessibility node that implements `ACTION_SET_TEXT`.

### 2. `ACTION_SET_SELECTION`

Android exposes `ACTION_SET_SELECTION` to move or extend selection in accessible text fields.

Source:

- [AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_SELECTION](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo.AccessibilityAction#ACTION_SET_SELECTION)

Implications:

- Clawperator could support cursor-aware edits for accessible fields.
- This would allow append, prepend, replace-selection, and select-all style flows instead of only full replacement.
- It still depends on the target app exposing a real accessible text editor.

### 3. `ACTION_PASTE`

Android also exposes `ACTION_PASTE`, which pastes current clipboard content when the node supports it.

Source:

- [AccessibilityNodeInfo.AccessibilityAction.ACTION_PASTE](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo.AccessibilityAction#ACTION_PASTE)

Implications:

- This can be a useful fallback when `ACTION_SET_TEXT` is unsupported but the app provides a paste-capable text surface.
- It requires clipboard management and brings privacy / state-restoration considerations.
- Support is app-dependent, just like `ACTION_SET_TEXT`.

### 4. `ACTION_IME_ENTER`

From API 30, Android exposes `ACTION_IME_ENTER`, which triggers the editor's IME action when the node is focused and editable.

Source:

- [AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo.AccessibilityAction#ACTION_IME_ENTER)

Implications:

- This is a better match for `submit=true` than Clawperator's current post-set click.
- It is still conditional on the node exposing that action.
- Clawperator should prefer this over a blind click when available.

### 5. Accessibility-service IME APIs on API 33+

Android 13 introduced accessibility IME support:

- `AccessibilityServiceInfo.FLAG_INPUT_METHOD_EDITOR`
- `AccessibilityService.onCreateInputMethod()`
- `AccessibilityService.getInputMethod()`
- `InputMethod.AccessibilityInputConnection`

Sources:

- [AccessibilityServiceInfo.FLAG_INPUT_METHOD_EDITOR](https://developer.android.com/reference/android/accessibilityservice/AccessibilityServiceInfo#FLAG_INPUT_METHOD_EDITOR)
- [AccessibilityService.getInputMethod()](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService#getInputMethod())
- [InputMethod](https://developer.android.com/reference/android/accessibilityservice/InputMethod)
- [InputMethod.AccessibilityInputConnection](https://developer.android.com/reference/android/accessibilityservice/InputMethod.AccessibilityInputConnection)

The key capabilities here are important:

- `commitText(...)`
- `performEditorAction(...)`
- `setSelection(...)`
- text/selection inspection via surrounding-text APIs

This is materially different from `ACTION_SET_TEXT`.

Why it matters:

- `ACTION_SET_TEXT` acts on the accessibility node only if the app exposes the right action.
- `AccessibilityInputConnection` talks to the currently active editor through the IME/input-connection layer.
- Many custom editors are not `EditText`, but still behave as text editors by implementing `onCreateInputConnection()` and returning `true` from `onCheckIsTextEditor()`.

Android's own docs explicitly describe custom text editors that are not `EditText` or `WebView` but still support text input through `onCreateInputConnection()`.

Source:

- [Custom text editors](https://developer.android.com/develop/ui/views/touch-and-input/stylus-input/custom-text-editors)

That means some "hacky" mainstream app text surfaces may be unreachable via `ACTION_SET_TEXT` but still reachable through the input-connection path once focused.

## Key Conclusions

### 1. Clawperator's current API is too narrow

Today `enter_text` really means:

- find a node
- try `ACTION_SET_TEXT`
- maybe click afterwards

That is not enough to describe the range of strategies needed in real apps.

### 2. Accessibility can help more than Clawperator currently uses

Yes, Android accessibility APIs provide more than Clawperator currently uses.

The most important missing pieces are:

- `ACTION_IME_ENTER` for submit
- `ACTION_SET_SELECTION` for cursor-aware editing
- `ACTION_PASTE` as a fallback path
- API-33+ accessibility IME / `AccessibilityInputConnection`

### 3. Accessibility still cannot guarantee text entry into every custom UI

If an app does not expose:

- an editable accessibility node
- a node action such as `ACTION_SET_TEXT` or `ACTION_PASTE`
- or a usable input connection after focus

then accessibility alone will not create a reliable text-entry channel.

Android docs are clear that app developers must expose actions and accessibility metadata on custom views for services to discover and use them:

- [Accessibility actions and custom widgets](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo.AccessibilityAction)
- [Make custom views more accessible](https://developer.android.com/guide/topics/ui/accessibility/custom-views)

So the ceiling here is app-dependent.

## Recommended Direction

### Phase 1 - Fix obvious contract and runtime gaps

1. Implement real `clear` behavior in Android runtime.
   - For `ACTION_SET_TEXT` targets, use the documented empty-text clear behavior before writing replacement text.
   - If the clear attempt fails, report that explicitly.

2. Make `submit` map to real editor behavior.
   - Prefer `ACTION_IME_ENTER` when the target exposes it.
   - Fall back to the current post-entry click only as best effort.

3. Add richer step diagnostics.
   - Record which strategy was attempted: `set_text`, `ime_enter`, `paste`, `input_connection_commit_text`, etc.
   - Include whether the node advertised `isEditable` and which accessibility actions were present.

This would already make the current API more honest and debuggable.

### Phase 2 - Add strategy-based text entry on the Android side

Add an internal strategy ladder instead of a single `setText()` implementation. Suggested order:

1. Focus target.
2. If node supports `ACTION_SET_TEXT`, use it.
3. If `submit=true` and node supports `ACTION_IME_ENTER`, invoke it.
4. If node supports `ACTION_PASTE`, optionally use clipboard-paste fallback.
5. On API 33+, if the target has focus and the service has an active `AccessibilityInputConnection`, use `commitText()` and `performEditorAction()`.

This should be runtime-selected based on node capabilities and API level, not guessed from app name.

### Phase 3 - Broaden the public contract

`enter_text` probably needs a richer public shape. Example directions:

- `mode`: `replace | append | prepend | paste | auto`
- `submitAction`: `none | ime | click | auto`
- `clearFirst`: explicit replacement for the current ambiguous `clear`
- `preferInputConnection`: opt into the API-33+ path when available

Even if some flags start as Android-only, the contract should describe the strategy being requested, not just "somehow type this text".

### Phase 4 - Add capability-aware observation and tests

Before claiming success, verify:

- visible text changed as expected
- selection/cursor changed if relevant
- expected submit behavior happened
- the strategy used matched available capabilities

Important regression cases:

1. Standard `EditText` with `ACTION_SET_TEXT`
2. Field that supports `ACTION_IME_ENTER`
3. Custom editor that lacks `ACTION_SET_TEXT` but exposes an input connection on API 33+
4. Field that only allows paste
5. Compose / custom-view surfaces where none of the above are exposed, to confirm clean failure and diagnostics

## Practical Guidance

If the goal is "make text entry more reliable in modern apps", the best forward path is:

1. Keep `ACTION_SET_TEXT` as the first-class path for accessible editable nodes.
2. Stop pretending that click-after-set is a real submit strategy.
3. Add `ACTION_IME_ENTER` and `ACTION_PASTE` support.
4. Invest in API-33+ accessibility IME support with `AccessibilityInputConnection`.
5. Expand the API so callers can ask for a strategy, not just a string payload.

## Bottom Line

Clawperator is currently under-using Android's text-entry capabilities.

The current implementation is not wrong, but it is only the narrowest accessibility path. For mainstream apps with custom text surfaces, the biggest opportunity is not a more clever use of `ACTION_SET_TEXT`. It is adding the newer accessibility IME/input-connection path on API 33+, plus explicit fallback strategies like IME enter and paste.
