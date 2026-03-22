# PRD-5.5: Skill Progress Logging

Workstream: WS-5.5 (skills-repo companion to WS-4/WS-5)
Priority: 5.5 (after PRD-4, before or parallel with PRD-5)
Proposed PR: PR-5.5 (in `clawperator-skills` repo only — no Node CLI changes)

---

## Problem Statement

PRD-4 streams skill script stdout to the caller in real time. But every skill currently
produces a single line of output at the very end (the `✅` result line or a `⚠️` error).
The 30-120 seconds of execution between start and result is completely silent.

An agent cannot distinguish "still working" from "hung" from "already failed." The
original GloBird incident described this exactly:

> Running GloBird skill. 30 seconds pass. Is it working? Should I wait? Cancel?
> Check the device? I have no idea.

PRD-4 unlocked the pipe. This PRD fills it.

---

## Evidence

**From `skills/com.globird.energy.get-usage/scripts/get_globird_usage.js`:**

```javascript
// Skills build a full action list, call runClawperator once, then parse results.
// The only console output today is the final result or error line.
const { ok, result, error, raw } = runClawperator(execution, deviceId, receiverPkg);
// ... 60-120 seconds of silence ...
console.log(`✅ GloBird usage: cost_so_far=${cost}, ...`);
```

**From `skills/com.solaxcloud.starter.get-battery/scripts/get_solax_battery.js`:**

Same pattern — silent execution, single result line. The SolaX skill demonstrated this
in live testing: the `✅ SolaX battery level: 36.0%` line was the only output during a
27-second run.

**Architecture note:** `runClawperator` is a synchronous blocking call that sends the full
action payload to Android and waits for the result envelope. Node does not receive
per-action acknowledgments. Meaningful in-flight progress must come from the skill script
itself, before and between calls to `runClawperator`.

---

## Proposed Change

### 1. Logging convention

All skill scripts should emit progress using `console.log` with a `[skill]` prefix for
informational steps. The existing `⚠️` stderr pattern for errors remains unchanged. The
existing `✅` stdout final-result pattern remains unchanged.

**Style:**

```
[skill] <present-tense description of what is about to happen>
```

Examples:
```
[skill] Closing GloBird app and relaunching fresh...
[skill] Waiting for GloBird to load (8s)...
[skill] Navigating to Energy tab...
[skill] Capturing energy usage snapshot...
[skill] Parsing results...
```

**Rules:**
- Use `console.log` (stdout), not `console.error`
- Present tense, lowercase after `[skill]`, end with `...`
- One line per meaningful phase — not per action in the payload
- Do not log raw API responses or snapshot content (can be large; belongs in logs not stdout)
- The `✅` final result line is printed last, unchanged

**What counts as a meaningful phase:**
- Before each `runClawperator` call
- After a `runClawperator` call when the result must be processed before the next phase
  (multi-phase skills only)
- Fallback or retry paths: `[skill] Primary selector not found, trying fallback...`
- Long waits that are explicit in the skill: `[skill] Waiting for app to load (12s)...`

**What not to log:**
- Individual actions within the payload (tap, sleep, click) — these are sub-second and
  produce noise without value
- Intermediate data values mid-parse (wait for the `✅` line)
- Debug information that only makes sense with source code open

### 2. Update all skills in `clawperator-skills`

Apply the convention to every skill. Coverage per skill:

**Artifact-backed skills (highest priority — longest execution, most opaque):**

`com.globird.energy.get-usage`:
```
[skill] Launching GloBird app...
[skill] Navigating to Energy tab...
[skill] Capturing energy usage snapshot...
[skill] Parsing results...
```

`com.google.android.apps.chromecast.app.get-aircon-status`:
```
[skill] Taking preflight snapshot to detect current screen...
[skill] Checking aircon tile state...
[skill] Capturing aircon status...
[skill] Parsing aircon data...
```
(Note: this skill already has multi-phase logic with a fallback path — add a line at each
branch: `[skill] Direct read succeeded` or `[skill] Direct read failed, navigating to
aircon tile...`)

`com.solaxcloud.starter.get-battery`:
```
[skill] Launching SolaX app...
[skill] Waiting for data to load (12s)...
[skill] Reading battery level...
```

`com.theswitchbot.switchbot.get-bedroom-temperature`:
```
[skill] Launching SwitchBot app...
[skill] Navigating to bedroom device...
[skill] Reading temperature...
```

**Script-only skills with complex execution:**

`com.life360.android.safetymapd.get-location`:
```
[skill] Opening Life360...
[skill] Searching for <person> on the map...
[skill] Capturing location snapshot...
[skill] Parsing location data...
```

`com.google.android.apps.chromecast.app.set-aircon`:
```
[skill] Verifying target state: <on|off>...
[skill] Locating <ac_tile_name> tile...
[skill] Applying aircon state change...
```

`com.coles.search-products`:
```
[skill] Opening Coles app...
[skill] Searching for "<query>"...
[skill] Capturing search results...
[skill] Parsing product listings...
```

`com.woolworths.search-products`:
```
[skill] Opening Woolworths app...
[skill] Searching for "<query>"...
[skill] Capturing search results...
[skill] Parsing product listings...
```

**Script-only skills with simple execution (minimal logging needed):**

`com.android.settings.capture-overview`, `com.android.vending.search-app`,
`com.android.vending.install-app`: Add one line before the primary action only.

### 3. Update `skill-development-workflow.md` in `clawperator-skills`

Add a "Progress logging" section to the authoring guide documenting:
- The `[skill]` convention and when to use it
- The three output channels: `[skill]` progress (stdout), `✅` result (stdout), `⚠️` error (stderr)
- What counts as a meaningful phase vs noise
- Example before/after of a skill with and without logging

---

## Deferred: Structured Logging Protocol

Freeform `[skill] ...` stdout is sufficient for the current stage. A structured protocol
is deliberately deferred until there is a concrete need to parse or filter skill progress
programmatically.

When structured logging becomes necessary, the likely approach is:

- Skill scripts emit JSON lines to stdout for progress events:
  ```json
  {"type":"progress","phase":"launching","message":"Launching GloBird app","ts":1711100000000}
  ```
- The CLI layer (or a new `clawperator skill-log` helper command) distinguishes progress
  events from result lines and formats them for pretty mode vs passes them through in
  JSON mode
- PRD-5's NDJSON log infrastructure captures these as structured events alongside the
  lifecycle events already logged at the Node layer

This requires: a defined JSON schema for skill progress events, CLI changes to parse and
format them, and coordination with PRD-5. Track as a future enhancement when the need
arises. The freeform convention adopted here is forward-compatible: `[skill]`-prefixed
lines are easy to detect and promote to structured events later.

---

## Why This Matters for Agent Success

An agent watching a 30-second skill run with progress logging can:
- Confirm the skill is making forward progress (not hung)
- Know which phase is slow (useful for diagnosing device issues)
- See fallback paths being taken (useful for understanding why a run succeeded
  differently than expected)
- Identify the phase where a failure occurred without reading source code

Without it, every skill run is a black box that either succeeds or fails with no
intermediate signal.

---

## Scope Boundaries

In scope:
- `console.log('[skill] ...')` additions to skill scripts in `clawperator-skills`
- `skill-development-workflow.md` authoring guide update
- All 11 skills in the current registry (proportional coverage — artifact-backed first)

Out of scope:
- Node CLI changes (PRD-4 already handles streaming; no CLI changes needed here)
- Structured logging protocol (explicitly deferred — see above)
- Changing the `✅` result format or `⚠️` error format
- Logging raw snapshot content or API response bodies
- Per-action logging within a single `runClawperator` call (requires APK changes)

---

## Dependencies

- PRD-4 merged — the streaming infrastructure must be in place for progress lines to
  reach the caller. Without PRD-4, these `console.log` calls are buffered until the
  skill exits, which is no better than today.
- No dependency on PRD-5 (logging infrastructure). Progress lines appear in the terminal
  output immediately. PRD-5 will eventually capture them in the NDJSON log as well,
  but that is PRD-5's concern.
- No Node CLI changes required.

---

## Testing Plan

No unit tests needed — this is additive stdout output with no logic changes.

### Manual verification (required for each skill)

Run each updated skill on a connected Android device. Confirm:

1. Progress lines appear **before** the final `✅` result line
2. Progress lines arrive **incrementally** during execution (not all at once at the end) —
   this proves PRD-4 streaming is working and the logs are not buffered
3. The `✅` result line and exit code are unchanged
4. In `--output json` mode: progress lines are NOT present in stdout (the PRD-4 JSON mode
   guard suppresses them)

Verification command:
```bash
clawperator skills run <skill-id> --device-id <device_serial>
# Should show [skill] progress lines arriving live, then ✅ result

clawperator skills run <skill-id> --device-id <device_serial> --output json
# Should show only the final JSON envelope — no [skill] lines
```

---

## Acceptance Criteria

- Every artifact-backed skill emits at least 3 `[skill]` progress lines during a
  successful run, covering the major phases of execution.
- Progress lines appear incrementally during execution — not batched at the end.
- `--output json` produces no `[skill]` lines in stdout (JSON envelope only).
- The `✅` result format and `⚠️` error format are unchanged for all skills.
- `skill-development-workflow.md` documents the `[skill]` convention, what counts as a
  meaningful phase, and the three output channels.
- All skills that previously passed `--dry-run` still pass after this PR.
