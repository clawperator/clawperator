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

**Important:** because PRD-4 makes progress lines visible to agents in real time, the
format of those lines is now a live-streaming contract, not decoration. A noisy or
ambiguous format immediately affects agent experience. The convention defined here must
be followed consistently across all skills.

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

#### Output channels

Skills have three output channels. Each channel has a single, non-overlapping purpose:

| Channel | Mechanism | Purpose |
|---------|-----------|---------|
| Progress | `console.log('[skill:<id>] ...')` | In-flight orientation for humans and agents |
| Result | `console.log('✅ ...')` | The canonical skill output — one line, last |
| Error | `console.error('⚠️ ...')` | Abnormal conditions, failures, unexpected state |

These channels must not blur. Progress lines must never carry result data. Error lines
must not be used for progress. The `✅` result line must always be the last stdout line.

#### Progress line format

```
[skill:<short-id>] <present-tense description>...
```

Where `<short-id>` is the last segment of the skill's registry ID:
- `com.globird.energy.get-usage` → `get-usage`
- `com.solaxcloud.starter.get-battery` → `get-battery`
- `com.google.android.apps.chromecast.app.get-aircon-status` → `get-aircon-status`

The skill-id prefix allows attribution when multiple skills run in sequence or an agent
is reviewing accumulated output.

Examples:
```
[skill:get-usage] Launching GloBird app...
[skill:get-usage] Navigating to Energy tab...
[skill:get-usage] Capturing energy usage snapshot...
[skill:get-usage] Parsing results...
✅ GloBird usage: cost_so_far=$4.21, grid_usage=12.3kWh, solar_feed_in=8.1kWh
```

**Style rules:**
- Present tense, lowercase after the prefix, end with `...`
- One line per meaningful phase — not per action in the payload
- Do not log raw API responses, snapshot content, or intermediate data values
- Progress lines are for human and agent orientation only — not for machine parsing
- Progress lines must be ignorable: an agent or script that strips all `[skill:*]` lines
  must still get the complete, correct result from the remaining output

**What counts as a meaningful phase:**
- Before each `runClawperator` call (always)
- Between phases in multi-phase skills (preflight → navigate → read)
- Fallback or retry paths: `[skill:get-aircon-status] Direct read failed, navigating to tile...`
- Explicit long waits: `[skill:get-battery] Waiting for app to load (12s)...`

**What not to log:**
- Individual actions within the payload (tap, sleep, click)
- Intermediate data values (`[skill:get-usage] cost=$4.21` — that belongs in the `✅` line)
- Debug information that requires source code to interpret

#### JSON mode behaviour

In `--output json` mode, PRD-4 does not wire `onOutput` to stdout, so `[skill:*]` lines
do not appear on the terminal during execution. However, they ARE present in
`result.output` in the final JSON envelope, because `result.output` is the full
accumulated stdout string from the skill subprocess.

Agents parsing `--output json` results must treat `[skill:*]` lines in `result.output`
as ignorable progress noise. The canonical result is always the `✅` line. An agent
extracting the result value should filter for the `✅` prefix, not parse `result.output`
as a whole.

This is by design: `result.output` is a verbatim capture of the skill's stdout. Progress
lines appearing there does not break the JSON contract — the JSON envelope itself is
clean, and the `✅` line is always the semantic result.

### 2. Update all skills in `clawperator-skills`

Apply the convention to every skill, with depth proportional to complexity. Even simple
skills get at least one orientation line so an agent knows the skill has started.

**Artifact-backed skills (highest priority — longest execution, most opaque):**
Minimum 3 progress lines covering the major phases.

`com.globird.energy.get-usage`:
```
[skill:get-usage] Launching GloBird app...
[skill:get-usage] Navigating to Energy tab...
[skill:get-usage] Capturing energy usage snapshot...
[skill:get-usage] Parsing results...
```

`com.google.android.apps.chromecast.app.get-aircon-status`:
This skill has a preflight snapshot and a fallback navigation path. Log each branch:
```
[skill:get-aircon-status] Taking preflight snapshot...
[skill:get-aircon-status] Direct tile read succeeded...
```
or on the fallback path:
```
[skill:get-aircon-status] Taking preflight snapshot...
[skill:get-aircon-status] Direct read failed, navigating to aircon tile...
[skill:get-aircon-status] Capturing aircon status...
[skill:get-aircon-status] Parsing aircon data...
```

`com.solaxcloud.starter.get-battery`:
```
[skill:get-battery] Launching SolaX app...
[skill:get-battery] Waiting for data to load (12s)...
[skill:get-battery] Reading battery level...
```

`com.theswitchbot.switchbot.get-bedroom-temperature`:
```
[skill:get-bedroom-temperature] Launching SwitchBot app...
[skill:get-bedroom-temperature] Navigating to bedroom device...
[skill:get-bedroom-temperature] Reading temperature...
```

**Script-only skills with complex multi-step execution:**
3-4 lines covering the major phases.

`com.life360.android.safetymapd.get-location`:
```
[skill:get-location] Opening Life360...
[skill:get-location] Searching for <person>...
[skill:get-location] Capturing location snapshot...
[skill:get-location] Parsing location data...
```

`com.google.android.apps.chromecast.app.set-aircon`:
```
[skill:set-aircon] Verifying target state (<on|off>)...
[skill:set-aircon] Locating <ac_tile_name> tile...
[skill:set-aircon] Applying state change...
```

`com.coles.search-products`:
```
[skill:search-products] Opening Coles app...
[skill:search-products] Searching for "<query>"...
[skill:search-products] Capturing search results...
[skill:search-products] Parsing product listings...
```

`com.woolworths.search-products`:
```
[skill:search-products] Opening Woolworths app...
[skill:search-products] Searching for "<query>"...
[skill:search-products] Capturing search results...
[skill:search-products] Parsing product listings...
```

**Script-only skills with simple, fast execution:**
One orientation line before the primary action.

`com.android.settings.capture-overview`:
```
[skill:capture-overview] Capturing system overview screenshot...
```

`com.android.vending.search-app`, `com.android.vending.install-app`:
```
[skill:search-app] Searching Play Store for "<query>"...
[skill:install-app] Installing app from Play Store details page...
```

### 3. Update `skill-development-workflow.md` in `clawperator-skills`

Add a "Progress logging" section documenting:
- The three output channels and their purposes (table from section 1)
- The `[skill:<short-id>]` format and how to derive the short-id
- The guardrail: progress lines must be ignorable; result is always the `✅` line
- JSON mode behaviour: lines appear in `result.output` but are not the canonical result
- What counts as a meaningful phase vs noise
- Before/after example of a skill with and without logging

---

## Deferred: Structured Logging Protocol

Freeform `[skill:<id>] ...` stdout is sufficient for the current stage. A structured
protocol is deliberately deferred until there is a concrete need to parse or filter skill
progress programmatically.

When structured logging becomes necessary, the likely approach is:

- Skill scripts emit JSON lines to stdout for progress events:
  ```json
  {"type":"progress","skillId":"get-usage","phase":"launching","message":"Launching GloBird app","ts":1711100000000}
  ```
- The CLI layer distinguishes progress events from result lines and formats them for
  pretty mode vs passes them through in JSON mode
- PRD-5's NDJSON log infrastructure captures these as structured events alongside the
  lifecycle events already logged at the Node layer

This requires: a defined JSON schema for skill progress events, CLI changes to parse and
format them, and coordination with PRD-5. The freeform convention adopted here is
forward-compatible: `[skill:*]`-prefixed lines are easy to detect and promote to
structured events later without changing the channel model.

See `tasks/log/unified/problem-definition.md` for the broader logging architecture
context.

---

## Why This Matters for Agent Success

An agent watching a 30-second skill run with progress logging can:
- Confirm the skill is making forward progress (not hung)
- Know which phase is slow (useful for diagnosing device issues)
- See fallback paths being taken (useful for understanding unexpected success paths)
- Identify the phase where a failure occurred without reading source code

Without it, every skill run is a black box that either succeeds or fails after a long
silence.

---

## Scope Boundaries

In scope:
- `[skill:<short-id>]` progress line additions to skill scripts in `clawperator-skills`
- `skill-development-workflow.md` authoring guide update (in `clawperator-skills`)
- All 11 skills in the current registry (proportional depth — artifact-backed first)

Out of scope:
- Node CLI changes (PRD-4 already handles streaming; no CLI changes needed)
- Structured logging protocol (explicitly deferred — see above)
- Changing the `✅` result format or `⚠️` error format
- Logging raw snapshot content or API response bodies
- Per-action logging within a single `runClawperator` call (requires APK changes)

---

## Dependencies

- PRD-4 merged — streaming infrastructure must be in place. Without PRD-4, `console.log`
  calls are buffered until skill exit, which is no better than today.
- No dependency on PRD-5. Progress lines appear in terminal output immediately. PRD-5
  will eventually capture them in the NDJSON log, but that is PRD-5's concern.
- No Node CLI changes required. The format convention carries real weight precisely
  because PRD-4 makes it live — but the contract is in the skill scripts, not the CLI.

---

## Testing Plan

No unit tests needed — additive stdout output with no logic changes.

### Manual verification (required for each updated skill)

Run each skill on a connected Android device. Confirm:

1. `[skill:<id>]` progress lines appear **before** the final `✅` result line
2. Progress lines arrive **incrementally** during execution (not all at once at the end)
3. The `✅` result line content and exit code are unchanged
4. `[skill:<id>]` lines are NOT visible on the terminal in `--output json` mode
5. In `--output json` mode: `result.output` in the JSON envelope contains the progress
   lines but the JSON envelope itself is clean and parseable

```bash
# Pretty mode — should show progress lines live, then ✅ result
clawperator skills run <skill-id> --device-id <device_serial>

# JSON mode — terminal shows only final JSON; progress lines in result.output
clawperator skills run <skill-id> --device-id <device_serial> --output json
```

---

## Acceptance Criteria

- Every artifact-backed skill emits at least 3 `[skill:<short-id>]` progress lines
  during a successful run, covering the major execution phases.
- Every skill emits at least 1 progress line (even simple skills).
- Progress lines arrive incrementally during execution — not batched at the end.
- No progress line contains the canonical result value (that belongs in `✅` only).
- `[skill:*]` lines are not visible on stdout during `--output json` execution.
- `result.output` in the JSON envelope contains progress lines — this is expected and
  correct. An agent filtering for `✅` still gets the right result.
- The `✅` result format and `⚠️` error format are unchanged for all skills.
- `skill-development-workflow.md` documents the channel table, the `[skill:<short-id>]`
  format, the JSON mode behaviour, and the guardrail that progress lines must be ignorable.
- All skills that previously passed `--dry-run` still pass after this PR.
