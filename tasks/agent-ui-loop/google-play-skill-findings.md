# Google Play Skill - Findings Summary

Synthesized findings from the zero-shot exploratory session documented in
`google-play-skill-build-log.md`. These are the distilled lessons for future agents
and for improving the Clawperator API and documentation.

---

## What was built

Two skills in `../clawperator-skills`:
- `com.android.vending.search-app` - search for an app and navigate to its details page
- `com.android.vending.install-app` - install from the details page and confirm result

Both skills were developed via live exploratory UI automation against a physical Android
device, with no pre-written knowledge of the Play Store's UI structure.

---

## Critical bug: global binary snapshot extraction broken

**Summary:** The globally installed `clawperator` binary (`v0.2.1` from homebrew) has a
broken `snapshotHelper.js` that searches for `TaskScopeDefault:` in logcat lines. The
Android app emits `[TaskScope] UI Hierarchy:`. These never match. Result: `data.text` is
always empty on `snapshot_ui` steps, and `success: true` is returned with no indication
of the failure.

**Impact:** Any agent using the global `clawperator` binary will get empty snapshots.
This makes UI inspection completely non-functional with the default tooling. An agent
would have no way to observe the device state.

**Workaround:** Set `CLAW_BIN=/path/to/local/dist/cli/index.js` or rebuild and reinstall
the package.

**Fix location:** `apps/node/src/domain/executions/snapshotHelper.ts` in the main repo.
The local source already has the correct implementation.

**Hidden failure mode:** The API contract does not distinguish between:
- "snapshot taken, no XML found" (broken snapshotHelper)
- "snapshot taken, XML extracted" (working)

Both return `success: true` and `actual_format: hierarchy_xml`. An agent gets no error
signal and must check whether `data.text` is non-empty. This contract gap should be fixed.

---

## Play Store selector strategy

**Key finding: no resource-ids anywhere.** The Play Store's entire interactive UI surface
uses obfuscated resource-ids (empty strings). Every selector must use `text`, `content-desc`,
or `role`. This is by design - Google obfuscates their APK.

### Reliable selectors by element

| Element | Reliable selector | Why |
|---------|------------------|-----|
| Search tab (bottom nav) | `textEquals: "Search"` | Tab label text is stable |
| Search bar (inactive) | `contentDescEquals: "Search Google Play"` | A11y label is stable |
| Search input (active EditText) | `role: "textfield"` | No resource-id; role targets EditText class |
| Search suggestion | `contentDescContains: "Search for"` | Avoids HTML entity issues |
| App result entry | `contentDescContains: "<AppName>"` | Content-desc contains name+developer multiline |
| Install button | `contentDescEquals: "Install"` | Stable a11y label |
| Open button (post-install) | `textEquals: "Open"` | Stable text label |
| Uninstall button | `textEquals: "Uninstall"` | Stable text label |
| Navigate back (full page) | `contentDescEquals: "Navigate up"` | Standard Android back |
| Close sheet (bottom sheet) | `contentDescEquals: "Close sheet"` | Bottom sheet dismiss |

### HTML entity encoding in content-desc

Play Store wraps values in HTML entities: `&apos;`, `&amp;`, `&lt;` etc. The raw XML
attribute value contains these entities. Matching against decoded characters will fail.

**Correct approach:** Always use `contentDescContains` with a substring that avoids
entity-encoded characters. Never use `contentDescEquals` for values that contain
app names or search terms with special characters.

Example: suggestion content-desc is `"Search for &apos;vlc&apos;"`. Match with:
- `contentDescContains: "Search for"` - WORKS
- `contentDescEquals: "Search for 'vlc'"` - FAILS (entity not decoded)
- `contentDescContains: "Search for 'vlc'"` - FAILS (entity not decoded)

### Clickable=false elements still work as click targets

Multiple Play Store elements have `clickable="false"` on the matched node but work
correctly when clicked. Clawperator taps the center of the matched node's bounding box.
If that bounding box falls within a `clickable="true"` ancestor, the tap registers on
the ancestor.

This means an agent should not check `clickable="true"` before attempting a click.
The click will work as long as the tap coordinates land on a touchable surface.

---

## The observe-decide-act loop in practice

### What worked well

1. **Single action + re-observe** was reliable. The loop cost was tolerable for
   exploration. Multi-step batching is appropriate only when steps are confirmed.

2. **Content-desc as semantic labels** - Play Store's accessibility labels are informative
   and stable. `contentDescEquals` and `contentDescContains` worked for the majority of
   cases without needing to know resource-ids.

3. **`role: "textfield"`** for input targeting was reliable and generalizes to any app
   that uses `android.widget.EditText`. Likely the right default for search inputs
   across many apps.

4. **`wait_for_node`** is the right tool for install completion. Fixed sleeps work for
   short operations, but install duration is unpredictable. The skill uses `wait_for_node`
   polling for `textEquals: "Open"` with a 120-second timeout.

5. **close + open pattern** - Closing the app before opening ensures a clean state.
   `close_app` always returns `success: false` (documented gap), but the pre-flight
   force-stop in the node layer still runs. The pattern is correct even if the step
   result is misleading.

### What created friction

1. **HTML entity encoding in content-desc** - cost one timeout (`RESULT_ENVELOPE_TIMEOUT`)
   before the pattern was understood. This is an API documentation gap. The docs say
   content-desc is matched as a substring but don't warn about HTML entity encoding.

2. **No deep link action** - There is no `open_uri` or `intent` action type. Reaching
   a specific app's Play Store page by package ID requires `adb shell am start` outside
   the execution payload. This is a genuine capability gap for direct-entry workflows.
   A skill that wants to use the known-package path must shell out to adb directly.

3. **`snapshot_ui` with empty `data.text` gives no error signal** - The silent failure
   mode cost significant debugging time. An API that returns `success: true` with empty
   data is harder to debug than one that returns an error.

4. **`close_app` always returns `success: false`** - Documented gap (Gap B from plan.md),
   but still confusing. An agent checking step success will see a failure on what is
   actually a normal operation. Consider renaming the result or adding a `pre_flight_ok`
   field.

5. **Multiline content-desc** - App entries in search results have `content-desc` values
   that span multiple lines (app name + developer + newline). This is valid XML but
   unusual. The matcher works correctly, but it's surprising to agents expecting single-
   line values.

---

## Blocking states documented

| State | Detection signal | Recommended handling |
|-------|-----------------|---------------------|
| Login required | `text="Sign in"` present | Exit with error; user must authenticate manually |
| Open with picker (multi-store device) | `text="Open with"` present | Click `textEquals: "Google Play Store"` |
| App not found | No result nodes after search | Exit with error |
| Paid app | Price text (e.g. `$4.99`) instead of "Install" | Exit with error; cannot install without payment |
| Already installed | `text="Open"` + `text="Uninstall"`, no `text="Install"` | Exit successfully (no-op) |
| Update available | `text="Update"` present | Same flow as install |
| Install in progress | `text="Cancel"` present, `text="Open"` absent | Wait for `text="Open"` |
| Incompatible device | Informational text, no Install button | Exit with error |

---

## Direct-entry path via package ID

The `market://details?id=<package>` deep link works for reaching a specific app's page
directly. However:

1. **Not supported natively by Clawperator.** The `open_app` action only supports
   `applicationId`. There is no `open_uri` action. Skills must use `execFileSync` with
   `adb shell am start` to fire the intent.

2. **"Open with" picker on multi-store devices.** Devices with Samsung Galaxy Store
   (or other app stores) installed will show a picker dialog. Skills must handle this
   as a blocking state.

3. **Opens a bottom sheet, not a full page.** The direct entry renders a compact bottom
   sheet view rather than the full app details page. The content is the same and the
   Install button works identically, but the navigation chrome is different (`Close sheet`
   vs `Navigate up`).

**Recommendation:** Use the in-app search path as the default. Use the direct-entry path
as an optimization when the package ID is known and the agent wants to skip search. The
skill already implements this fallback logic.

---

## API gaps identified

### Gap: no `open_uri` action

Agents frequently need to open a specific URL or URI (Play Store app page, YouTube video,
web page in browser). The current API has `open_app` (by applicationId) but no way to
open an arbitrary URI. A future `open_uri` action with a `uri` parameter would close this
gap.

### Gap: snapshot empty text is indistinguishable from successful empty snapshot

`snapshot_ui` returns `success: true` and `actual_format: hierarchy_xml` even when
`data.text` is empty. An agent should be able to distinguish:
- "Snapshot taken, no hierarchy available" (e.g., screen off, secure screen)
- "Snapshot extraction failed" (e.g., broken snapshotHelper)
- "Snapshot taken, hierarchy empty" (unusual but possible)

Suggested fix: return `success: false` with an error code when `data.text` is empty.

### Gap: `close_app` step result is always `success: false`

The Android `close_app` step always returns `success: false`. The actual close happens
in the node layer's pre-flight, not the Android step. An agent checking step-level success
sees a failure signal on a working operation.

Suggested fix: Either return `success: true` when the pre-flight close succeeded, or
rename the result field to `android_step_supported: false` to clarify the semantics.

### Gap: `StepResult.error` is at `data.error`, not top-level

Agents looking for `stepResult.error` will always see undefined. The actual error is at
`stepResult.data.error`. This should be consistent with the envelope-level `error` field.

### Gap: no `wait_for_node` timeout feedback

When `wait_for_node` times out, the execution fails with a timeout error but there is no
partial result showing what nodes WERE visible when it timed out. A timeout snapshot would
help agents understand why the wait failed.

---

## Guidance for future agents

### Approaching a new app with Clawperator

1. Start with a snapshot before any actions to understand the current state.
2. Look for content-desc values first. They are more stable semantic labels than text.
3. If content-desc is empty, fall back to text matching.
4. If neither is available, use `role: "textfield"` for inputs.
5. Never assume resource-ids are present. Many production apps obfuscate them.
6. After any navigation or action, always re-observe before the next action.

### Using matchers reliably

- Prefer `contentDescContains` over `contentDescEquals` when the value might contain
  special characters or HTML entities.
- Use `textEquals` for known stable labels (button text, tab labels).
- Use `textContains` as a fallback when full text is unknown or may vary.
- `role: "textfield"` is reliable for any `android.widget.EditText`.

### Timing guidance

- App cold start: at least 3-4 seconds sleep.
- Navigation between screens: 2-3 seconds is usually enough.
- For unpredictable waits (installs, network): use `wait_for_node` not fixed sleep.
- Play Store is generally responsive. Waits can be on the short end.

### When to extract a reusable skill

A flow is ready to become a skill when:
1. The selector strategy is verified against the live UI (not guessed from docs).
2. The known failure modes (blocking states) are documented.
3. The flow has been confirmed end-to-end at least once.
4. The timing parameters have been validated on a real device.

---

## What to improve in Clawperator docs

1. **Warn about HTML entity encoding** in the NodeMatcher documentation. Add an example
   showing `contentDescContains` as the correct approach for Play Store-style content.

2. **Document `close_app` result semantics** explicitly. State that `success: false` on
   the Android step is expected and the pre-flight close still runs.

3. **Add a troubleshooting entry** for "snapshot_ui returns empty data.text" - check the
   logcat manually, check that the APK version matches the CLI version, rebuild if needed.

4. **Add `open_uri` to the roadmap** - document the gap and the current workaround
   (adb shell am start outside the execution payload).

5. **Add a selector strategy guide** to the API docs with the priority order
   (resourceId > contentDescEquals > textEquals > textContains > contentDescContains > role)
   and explain when each is appropriate.
