# Documentation Audit - Agent UI Loop Exploration

This document is an actionable audit for another agent to fix. It records every place
where the docs were wrong, incomplete, misleading, or missing compared to what was
actually observed during a live zero-shot Play Store automation session.

Each issue lists: the problem, the source of truth (code or observed behavior), the
doc file that needs editing, and the exact fix required.

---

## Priority 1: Wrong or actively misleading

---

### ISSUE-01: `snapshot_ui` silently returns `success: true` with empty `data.text`

**Problem:** The docs describe `snapshot_ui` as returning `data.text` containing the XML
hierarchy. What they don't say is that `data.text` can be empty while `success: true` and
`data.actual_format: "hierarchy_xml"` are still reported. There is no error code, no
`success: false`, and no diagnostic to indicate that no XML was captured.

**What actually happens:** The Node layer runs `adb logcat -d -v tag` and searches for
`[TaskScope] UI Hierarchy:` in the output. If the marker is not found, `data.text` is
left empty (or not set). The step result remains `success: true` and
`data.actual_format: "hierarchy_xml"`.

**Source of truth:** `apps/node/src/domain/executions/runExecution.ts` lines 165-170.
`attachSnapshotsToStepResults` is called only when `extractSnapshotsFromLogs` finds the
marker. When it does not, no `data.text` is written.

**Impact:** An agent observing `success: true` with `actual_format: "hierarchy_xml"` has
no signal that the snapshot failed. The only way to detect the failure is to check
`data.text` length.

**Doc file:** `docs/node-api-for-agents.md`, section "Action behavior notes", under
`snapshot_ui`.

**Current text:**
> `data.actual_format` is always `"hierarchy_xml"` for successful snapshot steps.

**Required fix:** Add a warning paragraph:

```
**Warning - empty data.text:** `snapshot_ui` returns `success: true` even when
`data.text` is empty. This can happen when logcat does not contain the expected
`[TaskScope] UI Hierarchy:` marker. Always check that `data.text` is non-empty before
parsing. An empty snapshot with `success: true` indicates a runtime extraction failure,
not an empty screen. See Troubleshooting for resolution steps.
```

Also fix the claim that `data.actual_format` is "always" `hierarchy_xml`. When
`data.text` is empty, the format field may still report `hierarchy_xml` but the data is
not valid. Reword to: "`data.actual_format` reports `"hierarchy_xml"` when the step
completes."

---

### ISSUE-02: `role` selector is undersold as "never alone" - incorrect for textfield

**Problem:** The NodeMatcher reference says:
> Low selectivity - many elements share a role. Use as a secondary constraint only,
> never alone.

This is accurate for roles like `button` and `text`, but it is **wrong for `textfield`**.
The `textfield` role maps to `android.widget.EditText`. In practice, there is usually at
most one active text input on screen. Many production apps (including Google Play Store)
assign no `resource-id` to their text inputs. For these apps, `role: "textfield"` is the
**only** reliable primary selector for entering text.

**What actually happens:** In the Play Store search flow, the active search input has no
`resource-id`, no content-desc, and no stable text. `role: "textfield"` was the only
matcher that worked. Using it alone was required and correct.

**Source of truth:** Live exploration, confirmed via `play_store_snap3.xml` - the active
`android.widget.EditText` has empty `resource-id`, empty `content-desc`, and empty `text`.

**Doc file:** `docs/node-api-for-agents.md`, NodeMatcher Reference table, `role` row.

**Required fix:** Expand the description to:
```
Matches by Clawperator semantic role name (`button`, `textfield`, `text`, `switch`,
`checkbox`, `image`, `listitem`, `toolbar`, `tab`). Derived from runtime role inference,
not the raw class string. Generally low selectivity - many elements share a role.
Exception: `role: "textfield"` maps to `android.widget.EditText` and is the correct
primary selector for text input fields in apps that do not assign resource-ids (which
includes many production apps). Use `role` as a secondary constraint for other roles.
```

---

### ISSUE-03: Click behavior on `clickable=false` nodes is not accurately described

**Problem:** The "Reading patterns" section in the Snapshot Output Format says:
> Match the text-bearing child node, then rely on the runtime to click a clickable
> ancestor when needed.

This is misleading. Clawperator does **not** walk up the tree to find a clickable ancestor.
Instead, it clicks the **center coordinates** of whatever node the matcher finds,
regardless of that node's `clickable` attribute. The click succeeds when those coordinates
fall within a `clickable=true` area (often a parent container). It fails with
`NODE_NOT_CLICKABLE` when the tap coordinates land on a non-interactive surface.

**What actually happens:** In Play Store exploration:
- `contentDescContains: "VLC for Android"` matched a `clickable=false` node at bounds
  `[240,824][660,949]`. The parent at bounds `[0,776][1080,1874]` was `clickable=true`.
  Clawperator tapped the center of the matched node's bounds `(450, 886)`, which fell
  within the parent's clickable area. The click registered correctly.
- `contentDescEquals: "Install"` matched a `clickable=false` node. Same mechanism.

**Source of truth:** The `NODE_NOT_CLICKABLE` error code exists in the error table, which
confirms the runtime does check clickability at the tap coordinates (not just the matched
node's attribute). But the check is coordinate-based, not tree-walk-based.

**Doc file:** `docs/node-api-for-agents.md`, Snapshot Output Format, "Reading patterns".

**Required fix:** Replace the misleading "rely on the runtime to click a clickable
ancestor" sentence with:

```
Clawperator taps the center of the matched node's bounding box. The `clickable`
attribute on the matched node does not gate the action - if the tap coordinates land on
a `clickable=true` area (such as a parent container), the tap registers. If the
coordinates land on a non-interactive surface, the step fails with `NODE_NOT_CLICKABLE`.
This means matching a non-clickable child node whose parent is a tap target works
correctly, as long as the child's bounding box is visually within the parent.
```

---

## Priority 2: Missing content that caused debugging time

---

### ISSUE-04: No troubleshooting entry for "snapshot returns empty data.text"

**Problem:** There is no troubleshooting guidance for the most impactful failure mode
discovered in this session: `snapshot_ui` returning `success: true` with empty `data.text`.
This cost significant debugging time during the exploration session.

**Source of truth:** Root cause is a mismatch between the logcat marker in
`apps/node/src/domain/executions/snapshotHelper.ts` (`[TaskScope] UI Hierarchy:`) and
what an outdated global binary searches for (`TaskScopeDefault:`). The fix is to use the
local build or update the global install.

**Doc file:** `docs/troubleshooting.md` - needs a new section.

**Required fix:** Add a new section between "Version Compatibility" and the end:

```markdown
## Snapshot returns empty data.text

If `snapshot_ui` returns `success: true` and `data.actual_format: "hierarchy_xml"` but
`data.text` is empty or absent, the snapshot extraction step failed silently.

### Diagnosis

Run this command to confirm the Android app IS emitting the hierarchy:

```bash
adb -s <device_serial> logcat -d -v tag | grep "TaskScope"
```

If you see output containing `[TaskScope] UI Hierarchy:`, the Android side is working.
The problem is in the Node CLI's logcat parsing.

### Cause: version mismatch in snapshotHelper

The Node CLI reads logcat and searches for the `[TaskScope] UI Hierarchy:` marker. An
older or mismatched CLI build may search for a different marker (`TaskScopeDefault:`),
causing every snapshot to be silently empty.

### Fix

1. Check the CLI version being used: `which clawperator && clawperator version`
2. If using a globally installed binary that is out of date, rebuild from source:
   ```bash
   npm --prefix apps/node run build
   ```
3. Or set `CLAW_BIN` to point to the local build when running skills:
   ```bash
   export CLAW_BIN=/path/to/clawperator/apps/node/dist/cli/index.js
   ```
4. Run `clawperator doctor` after updating to confirm the snapshot round-trip works.

The `clawperator doctor` command validates snapshot extraction as part of its checks.
```

---

### ISSUE-05: HTML entity encoding in XML attributes is not documented

**Problem:** The hierarchy_xml snapshot format section describes XML node attributes but
does not mention that `content-desc` and `text` values from some apps (notably Google
Play Store) use HTML entity encoding. Values like `&apos;`, `&amp;`, and `&lt;` appear
literally in the XML string.

**What actually happens:** Play Store suggestion nodes have content-desc like:
`"Search for &apos;vlc&apos;"`. Using `contentDescContains: "Search for 'vlc'"` fails
because the `'` in the matcher does not match the literal `&apos;` in the attribute.
Using `contentDescContains: "Search for"` works because it avoids the encoded character.

This caused a `RESULT_ENVELOPE_TIMEOUT` during exploration when the wrong substring was
used.

**Doc file:** `docs/node-api-for-agents.md`, section "Snapshot Output Format",
`hierarchy_xml` subsection.

**Required fix:** Add a note after the attribute table:

```
**HTML entity encoding:** Some apps (notably Google Play Store) store HTML entity-encoded
values in `content-desc` and `text` attributes. For example, an apostrophe appears as
`&apos;`, an ampersand as `&amp;`. These entity sequences are returned as-is in
`data.text` - they are not decoded. When targeting elements with special characters in
their labels, use `contentDescContains` or `textContains` with a substring that avoids
the encoded characters, rather than an exact match that would require knowing the encoded
form.

Example: for a node with `content-desc="Search for &apos;vlc&apos;"`, use:
- `contentDescContains: "Search for"` -- WORKS
- `contentDescEquals: "Search for 'vlc'"` -- FAILS (apostrophe not decoded)
```

---

### ISSUE-06: No documentation of `open_uri` / deep-link gap

**Problem:** There is no action type for opening an arbitrary URI, deep link, or Android
Intent. The `open_app` action only accepts an `applicationId`. Agents that need to open
a content-addressed page (Play Store app page, YouTube video, in-app link) have no
Clawperator-native way to do this.

The FAQ entry "When should I use direct `adb` instead?" exists but doesn't list this as
a use case. An agent reading the docs would not know they need to fall outside the API.

**Doc file:** `docs/node-api-for-agents.md`, Action Reference table and FAQ.

**Required fix #1:** Add a note under `open_app` in the action behavior notes:
```
**`open_app`:** Opens the app's default launch activity. There is no `open_uri` action
for deep links or content-addressed pages (e.g. `market://details?id=...` or
`https://` links). To open a specific URI, use `adb shell am start -a
android.intent.action.VIEW -d "<uri>"` outside the execution payload. This is a known
capability gap.
```

**Required fix #2:** Add to the FAQ:
```
**Can Clawperator open a specific URL or deep link?**
Not directly. The `open_app` action only supports launching an app by its `applicationId`.
To open a URI (such as a Play Store app page, a web URL, or a custom deep link), use
`adb shell am start` outside the Clawperator execution payload. On devices with multiple
apps registered for a URI scheme, this may trigger an "Open with" picker that your
automation must handle.
```

---

### ISSUE-07: `observe snapshot` vs `execute` + `snapshot_ui` behavior not explained

**Problem:** The CLI reference lists both `observe snapshot` (a subcommand) and
`snapshot_ui` (an action type within `execute`). The docs do not explain the relationship
between them, how they differ internally, or when to use one vs. the other.

**What actually happens:** `observe snapshot` builds a single-action execution internally
(`apps/node/src/domain/observe/snapshot.ts`) and calls the same `runExecution` code path.
Both go through the same `extractSnapshotsFromLogs` pipeline. They are functionally
equivalent. The subcommand is a convenience wrapper.

**Doc file:** `docs/node-api-for-agents.md`, section "Action behavior notes" under
`snapshot_ui`, and/or the CLI reference table.

**Required fix:** Add a note in the `snapshot_ui` action behavior:
```
`observe snapshot` (CLI subcommand) and `snapshot_ui` (execution action type) use the
same internal pipeline and produce identical output. Use `observe snapshot` for ad-hoc
inspection. Use `snapshot_ui` as a step within a multi-action execution payload.
```

---

## Priority 3: Incomplete or imprecise

---

### ISSUE-08: `timeoutMs` cap documented only in `sleep` note, not as a schema rule

**Problem:** The only mention of the 120-second execution timeout cap is buried in the
`sleep` action note: "It must fit within the execution `timeoutMs` budget, and
`timeoutMs` is capped at `120000`."

The actual cap is enforced as a schema validation rule for the entire execution payload
(`LIMITS.MAX_EXECUTION_TIMEOUT_MS = 120_000` in `apps/node/src/contracts/limits.ts`).
Submitting `timeoutMs: 180000` will fail with `EXECUTION_VALIDATION_FAILED`, not produce
a timeout. An agent writing a skill for a long-running operation (like an app install)
would not know they are limited to 120 seconds per execution.

**Doc file:** `docs/node-api-for-agents.md`, Execution Payload section.

**Required fix:** Add an explicit callout in the Execution Payload section:
```
**Execution timeout limit:** `timeoutMs` is validated against the schema. The maximum
allowed value is 120,000 ms (2 minutes). Executions that require longer running times
must be split into multiple payloads. For install or download operations, use
`wait_for_node` polling within the 120-second window.

The `wait_for_node` action has its own `timeoutMs` parameter (passed to the Android
runtime). It operates within the outer execution's `timeoutMs` budget. If the outer
execution times out first, the whole execution fails.
```

---

### ISSUE-09: `wait_for_node` `timeoutMs` parameter not listed in Action Reference table

**Problem:** The Action Reference table shows `wait_for_node` with only:
> Required: `matcher: NodeMatcher`, Optional: `retry: object`

The `wait_for_node` action accepts a `timeoutMs` parameter that controls how long the
Android runtime polls for the node. This is separate from the execution-level `timeoutMs`.
It is not listed.

**Doc file:** `docs/node-api-for-agents.md`, Action Reference table, `wait_for_node` row.

**Required fix:** Update the optional params column:
```
`timeoutMs: number` (Android-side poll timeout in ms, default varies),
`retry: object`
```

---

### ISSUE-10: `close_app` result semantics documented but buried

**Problem:** The behavior of `close_app` returning `success: false` IS documented
correctly in the Action behavior notes section. However, the Result Envelope section
also shows per-action `data` keys for `close_app` as:
> `application_id`, `error` (`"UNSUPPORTED_RUNTIME_CLOSE"`), `message`

These are buried and not cross-referenced. An agent scanning the error table would find
`UNSUPPORTED_RUNTIME_CLOSE` missing from the error code list, which is confusing.

**Doc file:** `docs/node-api-for-agents.md`, Error Codes table.

**Required fix:** Add `UNSUPPORTED_RUNTIME_CLOSE` to the error codes table with an
explanatory note:
```
| `UNSUPPORTED_RUNTIME_CLOSE` | Expected result on all `close_app` steps. The Android runtime does not support a force-stop action response - the Node layer handles close via `adb shell am force-stop` before dispatching. Treat as non-fatal. |
```

---

### ISSUE-11: Reading patterns section only covers Settings example; doesn't generalize

**Problem:** The "Reading patterns" section in the Snapshot Output Format uses an Android
Settings screenshot as its only example. This is a well-behaved app with stable resource-
ids. The guidance ("scroll containers have `scrollable=true`, use as container in
`scroll_and_click`") is correct but only describes the easy case.

Many production apps (Play Store, Instagram, TikTok, banking apps) obfuscate resource-
ids. The current docs do not prepare an agent for this common reality.

**Doc file:** `docs/node-api-for-agents.md`, Snapshot Output Format, "Reading patterns".

**Required fix:** Add a paragraph after the existing reading patterns:
```
**Apps with obfuscated or missing resource-ids:** Many production apps set
`resource-id=""` on all or most nodes. In this case, fall back to content-desc and text
matchers. The priority order for these apps is:
- `contentDescEquals` for elements with stable accessibility labels (icon buttons, tabs)
- `textEquals` for elements with stable visible text (button labels, section headers)
- `contentDescContains` / `textContains` when the value may include dynamic content or
  special characters (HTML entities, locale-specific text, counts)
- `role: "textfield"` for text inputs when no resource-id is present

Note: `content-desc` values may contain newlines when an element's label spans multiple
pieces of information (e.g. app name + developer name in Play Store results). Use
`contentDescContains` with a known stable substring rather than a full match.
```

---

### ISSUE-12: FAQ "When to use adb directly" doesn't list URI/intent as a valid case

**Problem:** The FAQ answer "Use `adb` only for diagnostics or gaps not covered by the
API" is correct but too vague. It does not enumerate what those gaps are, leaving an
agent to discover them the hard way.

**Doc file:** `docs/node-api-for-agents.md`, FAQ section.

**Required fix:** Expand the answer:
```
**When should I use direct `adb` instead?**
Use `adb` directly for operations not covered by the execution payload API:
- **Opening specific URIs or deep links** (`adb shell am start -a
  android.intent.action.VIEW -d <uri>`) - there is no `open_uri` action type.
- **Diagnostics** when you need to inspect raw device state (logcat, package list,
  window focus).
- **Pre-flight setup** that is outside the automation loop (granting permissions,
  installing APKs).

For routine UI automation, use Clawperator so result/error semantics stay consistent.
```

---

## Summary table

| Issue | Severity | Doc file | Section |
|-------|----------|----------|---------|
| ISSUE-01: empty `data.text` silent success | P1 - wrong | `docs/node-api-for-agents.md` | Action behavior notes / snapshot_ui |
| ISSUE-02: `role: "textfield"` guidance wrong | P1 - wrong | `docs/node-api-for-agents.md` | NodeMatcher Reference |
| ISSUE-03: click behavior on `clickable=false` inaccurate | P1 - wrong | `docs/node-api-for-agents.md` | Snapshot Output / Reading patterns |
| ISSUE-04: no troubleshooting entry for empty snapshot | P2 - missing | `docs/troubleshooting.md` | New section |
| ISSUE-05: HTML entity encoding not documented | P2 - missing | `docs/node-api-for-agents.md` | Snapshot Output / hierarchy_xml |
| ISSUE-06: no `open_uri` gap documented | P2 - missing | `docs/node-api-for-agents.md` | Action notes + FAQ |
| ISSUE-07: `observe snapshot` vs `snapshot_ui` not explained | P2 - missing | `docs/node-api-for-agents.md` | Action behavior notes |
| ISSUE-08: `timeoutMs` cap buried in sleep note | P3 - incomplete | `docs/node-api-for-agents.md` | Execution Payload |
| ISSUE-09: `wait_for_node` `timeoutMs` param not listed | P3 - incomplete | `docs/node-api-for-agents.md` | Action Reference table |
| ISSUE-10: `UNSUPPORTED_RUNTIME_CLOSE` missing from error table | P3 - incomplete | `docs/node-api-for-agents.md` | Error Codes |
| ISSUE-11: Reading patterns only covers resource-id-rich apps | P3 - incomplete | `docs/node-api-for-agents.md` | Snapshot Output / Reading patterns |
| ISSUE-12: "When to use adb" FAQ too vague | P3 - incomplete | `docs/node-api-for-agents.md` | FAQ |

---

## What the docs got right (don't change)

These were accurate and saved time during the exploration:

- `close_app` behavior description (success: false is expected, non-fatal) - correct
- `enter_text` `clear` param gap noted explicitly - correct
- `data.error` vs top-level `error` distinction - correct
- Selector priority order (`resourceId` > `contentDescEquals` > ... > `role`) - correct
- `RESULT_ENVELOPE_TIMEOUT` error code description - accurate
- Per-action `data` keys reference table - accurate
- `scroll_and_click` retry knob documentation - detailed and useful
- `EXECUTION_CONFLICT_IN_FLIGHT` single-flight semantics - accurate
- Version compatibility (`major.minor` matching) - accurate
- Troubleshooting sections for permissions, USB debugging, wireless - accurate
