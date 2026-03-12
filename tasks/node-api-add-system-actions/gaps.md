# Gaps to Close Before PR

Identified during `press_key` implementation review. Items are ordered easiest to hardest.
Raw key events are marked future (out of scope for this branch).

---

## GAP-A: Stale note in findings.md re: uppercase key rejection

**Status:** Closed (2026-03-12)
**Effort:** Trivial (one line)

`findings.md` line 123 records that `uppercase BACK -> EXECUTION_VALIDATION_FAILED` during live
testing. This was true at test time but is no longer true - the Node validation now normalizes
key case with `.toLowerCase()` before matching, so `BACK` is accepted.

**Fix:** Update that bullet in `findings.md` to reflect current behavior.

---

## GAP-B: Doctor output does not show which receiver package it targeted

**Status:** Open
**Effort:** Low

`clawperator doctor` silently defaults to the release receiver package
(`com.clawperator.operator`). When testing a debug build (`com.clawperator.operator.dev`),
the developer must remember to pass `--receiver-package` explicitly or the health check
validates the wrong APK. The current output gives no indication which package was used, so
a clean result can be misleading.

**Fix:** Add the targeted receiver package to `doctor` output so it is visible at a glance.
This is a display-only change - no behavior changes, just making an implicit default explicit.

---

## GAP-C: No machine-readable examples for high-use actions in the API docs

**Status:** Open
**Effort:** Editorial (no code changes)

The `press_key` examples added in this branch showed that concrete request/response pairs
make a feature much easier to verify and reason about. The rest of the commonly-used actions
(`click`, `enter_text`, `snapshot_ui`, `read_text`) have only param tables - no worked
examples showing the full payload and expected response shape.

**Fix:** Add request/response examples for `click`, `enter_text`, `snapshot_ui`, and
`read_text` in `docs/node-api-for-agents.md`, following the `press_key` example format.
Regenerate public docs after.

---

## GAP-D: No stable errorCode in the top-level failure envelope

**Status:** Open
**Effort:** Medium (three layers: Android envelope, Node parsing, docs)

`ClawperatorResultEnvelope.error` is a free-form `String?`. When the accessibility service is
unavailable, it currently emits `"Accessibility service is not available"` as plain prose. An
agent trying to branch on this condition must do fragile string-matching instead of comparing
against a stable, documented constant.

**Fix:**
- Add `errorCode: String?` to `ClawperatorResultEnvelope` (additive, backward-compatible)
- Define a Kotlin constant `ERROR_CODE_SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"` and emit
  it when the accessibility service is not running
- Surface the field in the Node API response (it already passes envelope fields through)
- Add `SERVICE_UNAVAILABLE` to the error code table in `docs/node-api-for-agents.md`
- Regenerate public docs

---

## GAP-E: No first-class primitive for raw key events (non-global keys)

**Status:** Future (out of scope for this branch)
**Effort:** Requires design pass

`press_key` covers Android accessibility global actions: `back`, `home`, `recents`. There is
no first-class way to send other keys like `enter`, `search`, `volume_up`, or `volume_down`.

The most tractable implementation path is Node-side ADB (`adb shell input keyevent <keycode>`),
following the same pattern as `close_app`. However this raises design questions about:

- ADB availability as a runtime dependency
- Whether keyboard input and global navigation should share an action type or be separate
- Keycode mapping and cross-OEM reliability
- Error semantics when ADB is not connected

**Action:** Defer to a follow-up branch. Document the gap in the API guide when implementing
so agents know the boundary explicitly.
