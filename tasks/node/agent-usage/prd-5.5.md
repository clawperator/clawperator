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
[skill:<registry-id>] <present-tense description>...
```

Where `<registry-id>` is the full skill registry ID — not a short suffix. Short suffixes
are ambiguous as the skill set grows: `com.coles.search-products` and
`com.woolworths.search-products` would both produce `[skill:com.coles.search-products]`, which is
already a collision in the current registry. The full ID is unambiguous, grep-friendly,
and stable.

Examples:
```
[skill:com.globird.energy.get-usage] Launching GloBird app...
[skill:com.globird.energy.get-usage] Navigating to Energy tab...
[skill:com.globird.energy.get-usage] Capturing energy usage snapshot...
[skill:com.globird.energy.get-usage] Parsing results...
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
- Fallback or retry paths: `[skill:com.google.android.apps.chromecast.app.get-aircon-status] Direct read failed, navigating to tile...`
- Explicit long waits: `[skill:com.solaxcloud.starter.get-battery] Waiting for app to load (12s)...`

**What not to log:**
- Individual actions within the payload (tap, sleep, click)
- Intermediate data values (`[skill:com.globird.energy.get-usage] cost=$4.21` — that belongs in the `✅` line)
- Debug information that requires source code to interpret

#### JSON mode behaviour and `result.output` contract

**Contract:** In `--output json` mode, `result.output` in the final JSON envelope
contains the full accumulated stdout from the skill subprocess — including all
`[skill:*]` progress lines. This is by design. `result.output` is a verbatim capture,
not a filtered result. Consumers must not treat `result.output` as a structured payload.

The canonical result is always the `✅`-prefixed line. Consumers must filter for it:
```javascript
const resultLine = result.output.split('\n').find(l => l.startsWith('✅'));
```

Stripping all `[skill:*]` lines from `result.output` must leave the `✅` line intact.
If stripping progress lines would remove or corrupt the result, the skill is violating
the channel contract.

During execution in JSON mode, PRD-4 does not wire `onOutput` to stdout, so `[skill:*]`
lines do not appear on the terminal live. They are only visible in `result.output` after
the skill completes.

### 2. Update all skills in `clawperator-skills`

Apply the convention to every skill, with depth proportional to complexity. Even simple
skills get at least one orientation line so an agent knows the skill has started.

**Artifact-backed skills (highest priority — longest execution, most opaque):**
Minimum 3 progress lines covering the major phases.

`com.globird.energy.get-usage`:
```
[skill:com.globird.energy.get-usage] Launching GloBird app...
[skill:com.globird.energy.get-usage] Navigating to Energy tab...
[skill:com.globird.energy.get-usage] Capturing energy usage snapshot...
[skill:com.globird.energy.get-usage] Parsing results...
```

`com.google.android.apps.chromecast.app.get-aircon-status`:
This skill has a preflight snapshot and a fallback navigation path. Log each branch:
```
[skill:com.google.android.apps.chromecast.app.get-aircon-status] Taking preflight snapshot...
[skill:com.google.android.apps.chromecast.app.get-aircon-status] Direct tile read succeeded...
```
or on the fallback path:
```
[skill:com.google.android.apps.chromecast.app.get-aircon-status] Taking preflight snapshot...
[skill:com.google.android.apps.chromecast.app.get-aircon-status] Direct read failed, navigating to aircon tile...
[skill:com.google.android.apps.chromecast.app.get-aircon-status] Capturing aircon status...
[skill:com.google.android.apps.chromecast.app.get-aircon-status] Parsing aircon data...
```

`com.solaxcloud.starter.get-battery`:
```
[skill:com.solaxcloud.starter.get-battery] Launching SolaX app...
[skill:com.solaxcloud.starter.get-battery] Waiting for data to load (12s)...
[skill:com.solaxcloud.starter.get-battery] Reading battery level...
```

`com.theswitchbot.switchbot.get-bedroom-temperature`:
```
[skill:com.theswitchbot.switchbot.get-bedroom-temperature] Launching SwitchBot app...
[skill:com.theswitchbot.switchbot.get-bedroom-temperature] Navigating to bedroom device...
[skill:com.theswitchbot.switchbot.get-bedroom-temperature] Reading temperature...
```

**Script-only skills with complex multi-step execution:**
3-4 lines covering the major phases.

`com.life360.android.safetymapd.get-location`:
```
[skill:com.life360.android.safetymapd.get-location] Opening Life360...
[skill:com.life360.android.safetymapd.get-location] Searching for <person>...
[skill:com.life360.android.safetymapd.get-location] Capturing location snapshot...
[skill:com.life360.android.safetymapd.get-location] Parsing location data...
```

`com.google.android.apps.chromecast.app.set-aircon`:
```
[skill:com.google.android.apps.chromecast.app.set-aircon] Verifying target state (<on|off>)...
[skill:com.google.android.apps.chromecast.app.set-aircon] Locating <ac_tile_name> tile...
[skill:com.google.android.apps.chromecast.app.set-aircon] Applying state change...
```

`com.coles.search-products`:
```
[skill:com.coles.search-products] Opening Coles app...
[skill:com.coles.search-products] Searching for "<query>"...
[skill:com.coles.search-products] Capturing search results...
[skill:com.coles.search-products] Parsing product listings...
```

`com.woolworths.search-products`:
```
[skill:com.woolworths.search-products] Opening Woolworths app...
[skill:com.woolworths.search-products] Searching for "<query>"...
[skill:com.woolworths.search-products] Capturing search results...
[skill:com.woolworths.search-products] Parsing product listings...
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
- The `[skill:<registry-id>]` format and how to derive the short-id
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
- `[skill:<registry-id>]` progress line additions to skill scripts in `clawperator-skills`
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

### Regression tests (required — do not skip)

Two tests protect the output contract for machine callers. Add these to the Node test
suite in `apps/node/` alongside the PRD-4 skill runner tests.

**R1 — progress lines appear before the result line in pretty mode**

Use the `runSkill` fixture infrastructure from PRD-4. Pick one representative updated
skill script (or a test fixture that mimics the pattern) and verify:
- `result.output` contains at least one `[skill:*]` line
- The `✅` line is the last non-empty line in `result.output`
- No `[skill:*]` line appears after the `✅` line

This protects against a future skill accidentally emitting progress after the result,
which would corrupt consumers that read the last line.

**R2 — result.output contract holds in JSON mode**

Invoke the same skill with JSON output mode. Verify:
- `JSON.parse(stdout)` succeeds (the terminal envelope is clean)
- `result.output` in the parsed envelope contains `[skill:*]` lines
- Filtering `result.output` lines by `startsWith('✅')` returns exactly one line
- That line is the canonical result

This test encodes the `result.output` contract explicitly so any future change that
breaks it (e.g. filtering progress lines from `result.output`) fails visibly.

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

- Every artifact-backed skill emits at least 3 `[skill:<registry-id>]` progress lines
  during a successful run, covering the major execution phases.
- Every skill emits at least 1 progress line (even simple skills).
- Progress lines arrive incrementally during execution — not batched at the end.
- No progress line contains the canonical result value (that belongs in `✅` only).
- `[skill:*]` lines are not visible on stdout during `--output json` execution.
- `result.output` in the JSON envelope contains progress lines — this is the defined
  contract. Filtering `result.output` for `startsWith('✅')` returns exactly one line,
  which is the canonical result.
- Regression test R1 passes: progress lines precede the `✅` line in `result.output`.
- Regression test R2 passes: JSON mode envelope is parseable; `result.output` contract
  holds; filtering for `✅` returns the correct result line.
- The `✅` result format and `⚠️` error format are unchanged for all skills.
- `skill-development-workflow.md` documents the channel table, the `[skill:<registry-id>]`
  format, the `result.output` contract, and the guardrail that progress lines must be ignorable.
- All skills that previously passed `--dry-run` still pass after this PR.
