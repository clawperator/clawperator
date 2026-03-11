# API Improvement Suggestions

These observations came from reading the source code and performing the docs-audit work
in this task folder. Each item is a gap or rough edge in the current API that caused
friction during the Play Store automation session or is likely to cause friction for
future agents doing similar exploratory work.

Items are roughly ordered by impact.

---

## GAP-01: No standalone `scroll` action

**Problem:** `scroll_and_click` is the only scroll mechanism. There is no action that
scrolls a container without also clicking a target. This forces awkward patterns:

- To scroll down to expose more content before a snapshot, there is no direct action.
- `scroll_and_click` requires a `target` matcher. If the desired target is not yet
  visible, the action fails rather than scrolling to find it.
- The workaround is chaining a `sleep` and hoping the content loads, or using
  `scroll_and_click` with `maxSwipes` as a blunt instrument.

**Impact:** Agents doing exploratory snapshotting cannot pan through long lists without
also committing to a click. Intermediate state visibility - one of the core benefits of
the observe-decide-act loop - is lost.

**Suggested improvement:** Add a `scroll` action:
```json
{
  "id": "scroll1",
  "type": "scroll",
  "params": {
    "container": { "resourceId": "com.example.app:id/list" },
    "direction": "down",
    "amount": 1
  }
}
```

---

## GAP-02: `enter_text` `clear` param accepted but not implemented

**Problem:** The Node contract accepts `clear: boolean` on `enter_text`. The Android
runtime silently ignores it. The docs note this explicitly:
> "The Node contract still accepts `clear`, but the Android runtime does not implement
> it yet, so it currently has no effect."

This creates a silent contract lie. An agent that reads the parameter name and sends
`clear: true` will believe the field was cleared. It was not. If the field had prior
content, the new text is appended or merged unpredictably depending on the input widget.

**Impact:** High. Any flow that re-uses a text input field (search fields, forms with
back-navigation) is broken silently.

**Suggested improvement:** Implement `clear` in the Android runtime. The mechanism is
well-known: call `performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)` with
`ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE` set to an explicit empty string, or triple-click
to select-all followed by the new text. Until it is implemented, the Node layer should
reject `clear: true` with an explicit error rather than silently ignoring it.

---

## GAP-03: `open_uri` action for deep links and content-addressed pages is now implemented

**Status:** Done.

**Previous gap:** `open_app` only accepted an `applicationId`. There was no action for
opening a URI, deep link, or Android Intent, so agents that needed to navigate to a
specific content page (Play Store app detail page, YouTube video, in-app link) had to
exit the execution payload model and use raw `adb shell am start`.

**Resolution:** Clawperator now supports an `open_uri` action:
```json
{
  "id": "nav1",
  "type": "open_uri",
  "params": {
    "uri": "market://details?id=com.actionlauncher.playstore"
  }
}
```

The Android implementation uses `Intent(Intent.ACTION_VIEW, Uri.parse(uri))`. The docs
now note that a chooser dialog may appear on devices with multiple handlers for the URI
scheme, and the action is available from the Node API and CLI.

---

## GAP-04: `wait_for_node` has no total-wait-time semantic

**Problem:** `wait_for_node` uses a `retry` object (maxAttempts + delays) to control
polling. There is no way to say "wait up to N milliseconds for this node to appear."

To approximate "wait up to 30 seconds," an agent must calculate: with `initialDelayMs=500`,
`maxDelayMs=3000`, `backoffMultiplier=2.0`, and `maxAttempts=?`, approximately how many
attempts fit in 30 seconds? This is non-obvious arithmetic and produces non-deterministic
actual wait times due to jitter.

**Impact:** Medium. Long-running operations (app installs, downloads, page loads) are
hard to handle correctly. The current `UiReadiness` preset burns through its retry
delays in roughly 6.5 seconds before accounting for the work done on each attempt. An
agent that does not know the preset defaults or cannot do the math will either timeout
too early or burn excessive retries.

**Suggested improvement:** Accept an optional `timeoutMs` at the action level for
`wait_for_node` (and possibly `click`, `read_text`) that caps the total polling duration
regardless of `maxAttempts`. Internally this could be implemented as a deadline check
at each retry iteration. This is the model most developers expect from a "wait for
element" primitive.

---

## GAP-05: No hardware/system key press action

**Problem:** There is no action for pressing Android hardware or system keys. Common
automation needs include:

- **Back button** - navigate back within an app or dismiss a dialog
- **Home button** - return to the launcher
- **Recent apps** - task switcher
- **Volume keys** - sometimes required for media app testing
- **Enter/Search key** - alternative to `submit: true` on `enter_text`

All of these require falling outside the execution payload to `adb shell input keyevent`.

**Impact:** Medium. Back-navigation is extremely common. Many UI flows are expressed
as "tap X, then tap Back, then observe." Without a `press_key` action, agents cannot
express this as a single atomic execution.

**Suggested improvement:** Add a `press_key` action:
```json
{
  "id": "back1",
  "type": "press_key",
  "params": {
    "key": "BACK"
  }
}
```
A small well-documented enum of key names (`BACK`, `HOME`, `RECENTS`, `ENTER`,
`VOLUME_UP`, `VOLUME_DOWN`) would cover the common cases without exposing raw keycodes.

---

## GAP-06: `sleep.durationMs` is silently clamped, not validated

**Status:** Completed on 2026-03-11. The Node validation layer now rejects
`sleep.durationMs` values above `120000` ms with `EXECUTION_VALIDATION_FAILED`,
unit tests cover the boundary behavior, and the public Node API docs have been
updated and regenerated to describe the validated range.

**Problem:** The Android parser silently clamps `sleep.durationMs` to 120,000 ms:
```kotlin
params.longOrDefault("durationMs", 0L).coerceIn(0L, 120_000L)
```

The execution-level `timeoutMs` is strictly validated and returns
`EXECUTION_VALIDATION_FAILED` on out-of-range values. `sleep.durationMs` follows the
opposite pattern - values above the cap are silently reduced without any error signal.

An agent that sends `sleep: { durationMs: 180000 }` believing it will sleep 3 minutes
will actually sleep 2 minutes with no indication that the value was truncated.

**Impact:** Low-medium. Inconsistent with the explicit validation model. Could cause
subtle timing bugs in long-running flows.

**Resolution:** `sleep.durationMs` is now validated against the execution cap and
fails with `EXECUTION_VALIDATION_FAILED` on out-of-range values, consistent with
`timeoutMs`.

---

## GAP-07: `MAX_ACTIONS` limit differs between Node and Android parser

**Problem:** The Node contract enforces `MAX_EXECUTION_ACTIONS = 50`
(`apps/node/src/contracts/limits.ts`). The Android parser enforces `MAX_ACTIONS = 64`
(`apps/android/.../AgentCommandParser.kt`).

The Node layer rejects payloads with more than 50 actions before dispatch. The Android
layer would accept up to 64. These limits should be in sync.

**Impact:** Low in practice (the Node layer catches it first), but indicates drift
between the two enforcement boundaries. If a payload ever bypasses the Node layer
(direct broadcast, testing), the Android runtime behaves differently than documented.

**Suggested improvement:** Align the constants. The canonical value should live in one
place (the Node contracts are the agent-facing contract) and the Android parser should
be updated to match.

---

## GAP-08: Undocumented action type aliases

**Problem:** The Android parser accepts several undocumented aliases:
- `type_text` - alias for `enter_text`
- `find_node` - alias for `wait_for_node`

These are benign (the parser handles them silently), but their existence is not
documented anywhere. An agent that guesses `type_text` (the natural name) will succeed,
but an agent reading the docs would never know this works and might believe its payload
was wrong.

**Impact:** Low. The aliases exist precisely because agents do guess these names. Worth
documenting rather than removing.

**Suggested improvement:** Add a "Accepted aliases" note to the action reference table
or a dedicated subsection listing known aliases. This would also serve as a useful
signal that the project is aware agent guesses are predictable and has accommodated them.

---

## GAP-09: No keyboard dismissal action

**Problem:** After `enter_text` (especially without `submit: true`), the on-screen
keyboard may remain visible, blocking elements below it. There is no `dismiss_keyboard`
action. Workarounds:

- `click` a non-input element (unreliable - the click must land on something not
  blocked by the keyboard)
- Use `submit: true` (submits the form, which is not always desired)
- Use `adb shell input keyevent 111` (KEYCODE_ESCAPE) outside the execution payload

**Impact:** Medium. Keyboard overlap is a common cause of `NODE_NOT_FOUND` and
`NODE_NOT_CLICKABLE` errors after text input. The failure mode is opaque without a
screenshot to correlate.

**Suggested improvement:** Either add a `press_key` action (see GAP-05, which would
cover this via `KEYCODE_BACK` or `KEYCODE_ESCAPE`), or implement a specific
`dismiss_keyboard` action that calls
`InputMethodManager.hideSoftInputFromWindow` via accessibility service.

---

## GAP-10: `read_text` validator coverage is minimal

**Problem:** The `validator` param on `read_text` supports only `"temperature"`.
The mechanism exists and is extensible, but almost no validators are implemented.
Common automation needs include:

- Numeric range validation (price, rating, count)
- Non-empty assertion (confirm a field has content before proceeding)
- Pattern matching (version strings, timestamps)

**Impact:** Low for current use cases. Medium for agents trying to build robust
flows that verify state before proceeding.

**Suggested improvement:** This is a nice-to-have that does not block anything today,
but the validator registry should be extended over time. At minimum, `"non_empty"` and
`"numeric"` would cover a large fraction of real use cases.

---

## GAP-11: CLI `action` USAGE error does not identify the unknown subcommand

Status: Completed

**Resolution:** The CLI now includes the unrecognised action subcommand in the
`USAGE` payload so callers can distinguish typos from version skew:

```json
{"code":"USAGE","message":"Unknown action subcommand 'open-uri'. Valid: action open-app|open-uri|click|read|wait|type [options]"}
```

This removes the ambiguity for humans and agents by echoing the rejected input
and the valid subcommand set in the same response.

**Impact:** Low. This is a UX and debuggability improvement for typo handling and
version-skew diagnosis.

**Implemented in:** `apps/node/src/cli/index.ts`

---

## Summary table

| ID | Area | Impact | Type |
|----|------|--------|------|
| GAP-01 | No standalone `scroll` action | High | Missing feature |
| GAP-02 | `enter_text` `clear` silently no-ops | High | Silent failure |
| GAP-03 | `open_uri` deep link action implemented | Done | Closed |
| GAP-04 | `wait_for_node` no total-time semantic | Medium | Ergonomics |
| GAP-05 | No hardware/system key press | Medium | Missing feature |
| GAP-06 | `sleep.durationMs` silently clamped | Low-medium | Completed |
| GAP-07 | `MAX_ACTIONS` mismatch (50 vs 64) | Low | Contract drift |
| GAP-08 | Undocumented action type aliases | Low | Docs gap |
| GAP-09 | No keyboard dismissal | Medium | Missing feature |
| GAP-10 | `read_text` validator coverage minimal | Low | Limited feature |
| GAP-11 | CLI `action` USAGE error identifies the unknown subcommand | Done | Closed |
