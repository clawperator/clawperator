# PRD: Fix Snapshot Extraction Regression

**Status:** Required
**Affects:** `clawperator` (main repo) + `clawperator-skills` (skills repo)
**Discovered via:** Zero-shot Play Store automation session (see `google-play-skill-build-log.md`)
**Supporting analysis:** `snapshot-bug-skill-exposure.md`

---

## Is the Android binary involved?

No. The Android Operator APK correctly emits `[TaskScope] UI Hierarchy:` to logcat and has
always done so. The APK requires no changes.

This is a **Node API bug only.** The published npm package contains stale compiled
output with the wrong logcat marker. The TypeScript source in this repo is correct.

---

## Problem

`snapshot_ui` steps return `success: true` with `data.actual_format: "hierarchy_xml"` but
`data.text` is always empty on machines using the globally installed `clawperator` binary.
There is no error signal. An agent cannot distinguish this from a legitimate empty screen.

All 7 snapshot-using skills in `clawperator-skills` fail silently with generic error
messages. Users have no path to diagnosis from the skill output alone.

---

## Root cause

The compiled `snapshotHelper.js` in the published npm package (currently at
`/opt/homebrew/lib/node_modules/clawperator/dist/domain/executions/snapshotHelper.js`)
uses a completely different and incorrect algorithm:

**Published binary (broken):**
```js
// Filters logcat lines for a marker that does not exist in the Android app output
const snapshotLines = lines
  .filter((l) => l.includes("TaskScopeDefault:"))
  ...
```

**Current source (correct):**
```ts
// Searches for the actual marker emitted by the Android app
if (message.includes("[TaskScope] UI Hierarchy:")) {
  ...
```

The Android app emits: `D/E       : [TaskScope] UI Hierarchy:` followed by the XML.
The published binary's `TaskScopeDefault:` marker never matches any logcat line.
`extractSnapshotFromLogs` always returns `null`. `data.text` is never populated.

This is a **packaging regression** - the source was updated to use the correct marker but
the npm package was never rebuilt and republished. The installed binary is stale.

The published binary also exports only the singular `extractSnapshotFromLogs` function
and uses a completely different parsing algorithm (flat line filter vs. the correct
state-machine parser that handles multi-line XML blocks). This suggests the source was
substantially rewritten at some point without a corresponding package release.

---

## Scope

This PRD covers four required work streams. All four must ship together.

### Stream 1: `clawperator` - Fix the regression and add regression tests

### Stream 2: `clawperator` - Fix the silent failure contract

### Stream 3: `clawperator-skills` - Update skills for the new contract and document the workaround

### Stream 4: `clawperator-skills` - Fix binary preference order in `utils/common.js`

---

## Requirements

---

### Stream 1: Rebuild and fix the published binary

#### REQ-1.1 - Rebuild and republish the npm package

The compiled `dist/` output must be regenerated from the current TypeScript source and a
new npm package version must be published.

**Acceptance criteria:**
- `npm --prefix apps/node run build` produces `dist/domain/executions/snapshotHelper.js`
  that contains `[TaskScope] UI Hierarchy:` as the marker string
- The published package passes `clawperator observe snapshot --device-id <device>` end-
  to-end with non-empty `data.text` on a connected device with the Operator APK running
- `clawperator version` reports a version higher than the currently broken release

---

#### REQ-1.2 - Add a regression test: exact logcat format from the Android app

The existing `snapshotHelper.test.ts` tests verify correct parsing but do NOT verify the
exact logcat line format the Android app emits, nor do they guard against the specific
wrong marker that caused this regression.

**Required new test - add to `apps/node/src/test/unit/snapshotHelper.test.ts`:**

Test name: `"rejects TaskScopeDefault: marker (regression: published binary used this wrong marker)"`

Input: logcat lines containing `TaskScopeDefault:` with hierarchy-looking content but no
`[TaskScope] UI Hierarchy:` marker.

Expected output: `extractSnapshotFromLogs` returns `null`. This must pass to confirm the
source cannot regress to the old broken behavior.

```ts
it("rejects TaskScopeDefault: marker (regression: published binary used this wrong marker)", () => {
  const lines = [
    "D/E       : TaskScopeDefault: <hierarchy rotation=\"0\">",
    "D/E       :   <node index=\"0\" text=\"Settings\" />",
    "D/E       : TaskScopeDefault: </hierarchy>",
  ];
  assert.strictEqual(extractSnapshotFromLogs(lines), null);
});
```

**Required new test - add to `apps/node/src/test/unit/snapshotHelper.test.ts`:**

Test name: `"handles the exact logcat line format the Android app emits (D/E tag prefix)"`

This test must use the exact `D/E       : ` tag prefix produced by the Android runtime,
including the multi-space padding. It verifies `extractLogMessage` parses this format.

```ts
it("handles the exact logcat line format the Android app emits (D/E tag prefix)", () => {
  const lines = [
    "D/E       : [TaskScope] UI Hierarchy:",
    "D/E       : <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
    "D/E       : <hierarchy rotation=\"0\">",
    "D/E       :   <node index=\"0\" text=\"\" resource-id=\"\" class=\"android.widget.FrameLayout\" package=\"com.android.vending\" content-desc=\"\" clickable=\"false\" enabled=\"true\" bounds=\"[0,0][1080,2340]\" />",
    "D/E       : </hierarchy>",
  ];

  const result = extractSnapshotFromLogs(lines);
  assert.ok(result !== null, "snapshot must not be null");
  assert.ok(result.includes("<hierarchy"), "must include hierarchy tag");
  assert.ok(result.includes("com.android.vending"), "must include package content");
  assert.ok(!result.includes("D/E"), "must strip logcat tag prefix from extracted content");
});
```

---

#### REQ-1.3 - Add a test: `attachSnapshotsToStepResults` does not set `data.text` when no snapshots extracted

Currently `attachSnapshotsToStepResults` is tested for the happy path (snapshots present)
and for alignment when fewer snapshots than steps exist. There is no test verifying
behavior when `snapshots` is an empty array - which is the exact state that occurs with
the broken binary.

**Required new test - add to `apps/node/src/test/unit/runExecution.test.ts`:**

Test name: `"does not set data.text when snapshot extraction returned no snapshots"`

```ts
it("does not set data.text when snapshot extraction returned no snapshots", () => {
  const stepResults: StepResult[] = [
    { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
  ];

  attachSnapshotsToStepResults(stepResults, []);

  // data.text must remain absent - not set to undefined or empty string
  assert.ok(!("text" in stepResults[0].data), "data.text must not be set when no snapshots extracted");
  assert.deepStrictEqual(stepResults[0].data, {});
});
```

This test documents the current behavior and prevents a future change from accidentally
setting `data.text = ""` or `data.text = undefined`, both of which would make the failure
even harder to detect.

---

### Stream 2: Fix the silent failure contract in `runExecution.ts`

#### REQ-2.1 - Emit a warning when snapshot extraction fails

When `snapshot_ui` steps complete ADB communication but `extractSnapshotsFromLogs`
returns an empty array, REQ-2.3 will set `success: false` with `SNAPSHOT_EXTRACTION_FAILED`.
The step result now carries the failure signal. In addition, a human-readable warning
must be emitted to stderr so that users running CLI commands interactively can diagnose
the problem without parsing JSON.

**Required change in `apps/node/src/domain/executions/runExecution.ts`:**

After applying REQ-2.3's `success: false` transform, check whether any `snapshot_ui`
step now has `data.error === "SNAPSHOT_EXTRACTION_FAILED"`. If so, emit a warning to
stderr for each affected step.

The warning must:
- Identify the specific step ID that is affected
- State that UI hierarchy extraction produced no output
- Suggest running `clawperator doctor` and checking the CLI version

The warning must NOT:
- Modify any field on the step result (REQ-2.3 handles that)
- Fail the overall execution
- Appear in stdout (which is the machine-readable result envelope)

**Acceptance criteria:**
- Running `clawperator execute` with a `snapshot_ui` action using the broken binary
  (or a mock that returns empty snapshots) produces a warning on stderr containing the
  step ID and the phrase "UI hierarchy extraction produced no output"
- Running with a working binary produces no such warning
- The result envelope `status` and `stepResults` carry the `success: false` / error
  fields set by REQ-2.3; REQ-2.1 only adds the human-readable stderr signal

---

#### REQ-2.2 - Document the `actual_format` / empty `data.text` contract gap in code comments

The `snapshot_ui` note in `docs/node-api-for-agents.md` currently states that
`data.actual_format` is `"hierarchy_xml"` and `data.text` contains the snapshot. It does
not state what happens when extraction fails.

**Required documentation update (as specified in `docs-audit.md` ISSUE-01):**

Add a warning to the `snapshot_ui` action behavior note:

```
**Warning - empty data.text:** `success: true` does not guarantee `data.text` is
populated. When the logcat extraction finds no `[TaskScope] UI Hierarchy:` marker,
`data.text` is absent. Always check `data.text` is non-empty before parsing.
See Troubleshooting for resolution steps.
```

Add a troubleshooting section for empty snapshots in `docs/troubleshooting.md`
(full text specified in `docs-audit.md` ISSUE-04).

---

#### REQ-2.3 - Change `snapshot_ui` step result to `success: false` when extraction produces no snapshots

Currently `snapshot_ui` steps that complete ADB communication successfully but produce
no XML are returned with `success: true` and an absent `data.text`. This is a misleading
contract: success means "the action ran without a device error", not "you got useful data".

**Required changes:**

1. In `apps/node/src/domain/executions/runExecution.ts`, after calling
   `attachSnapshotsToStepResults`, iterate over `snapshot_ui` steps that have
   `success: true` but no `data.text`. For each, set:
   - `success: false`
   - `data.error: "SNAPSHOT_EXTRACTION_FAILED"`
   - `data.message: "UI hierarchy extraction produced no output. The [TaskScope] UI Hierarchy: marker was not found in logcat. Check clawperator version compatibility."`

2. Add the new error code string `"SNAPSHOT_EXTRACTION_FAILED"` to
   `apps/node/src/contracts/errors.ts` (or wherever action-level error strings are
   declared) so it is part of the published contract surface.

3. Update `docs/node-api-for-agents.md` to document that `snapshot_ui` returns
   `success: false` with `data.error: "SNAPSHOT_EXTRACTION_FAILED"` when the logcat
   extraction finds no hierarchy block. Remove or update any text that implied
   `success: true` with empty `data.text` was a possible outcome.

4. Update the `SKILL.md` files for any skill that documents the `success: true` +
   empty `data.text` pattern as a state to check. After this change, skills should
   check `result.success === false && result.data?.error === "SNAPSHOT_EXTRACTION_FAILED"`
   instead of checking for empty `data.text`.

**Acceptance criteria:**
- Running `clawperator execute` with a `snapshot_ui` action when the broken binary is
  active (or using a mock that returns zero snapshots) produces a step result with
  `success: false` and `data.error === "SNAPSHOT_EXTRACTION_FAILED"`
- Running with a working binary where the marker is found produces `success: true`
  and non-empty `data.text` as before
- The new error string is exported from the errors contract module
- `docs/node-api-for-agents.md` is updated to reflect the new contract

**Skill compatibility note:**

The 7 snapshot-using skills in `clawperator-skills` currently check for empty `data.text`
after `runClawperator()`. After this change they will instead see `success: false`
(which most already handle at the top-level result check). Verify each skill's error
branch is triggered correctly and that no skill silently ignores `success: false`.

---

### Stream 3: Update `clawperator-skills`

#### REQ-3.1 - Add snapshot sanity check to `utils/common.js`

All 7 snapshot-using skills will receive a meaningless empty result with no diagnosis
when the broken binary is used. A single change to the shared utility benefits all skills.

**Required change in `skills/utils/common.js`:**

After parsing the result from `execFileSync`, check whether any `snapshot_ui` step has
`success: false` and `data.error === "SNAPSHOT_EXTRACTION_FAILED"`. If found, write a
diagnostic message to `process.stderr`.

Note: after REQ-2.3 ships, the clawperator binary itself will set these fields. This
check in `utils/common.js` provides a skills-layer fallback so the diagnostic appears
even if an older binary is used that does not yet set the error code - in that case,
also check for `success: true` with absent or empty `data.text` as the fallback
condition.

The message must:
- Identify this as the known snapshotHelper version mismatch issue
- State the `CLAW_BIN` workaround explicitly with example path
- Direct users to `clawperator doctor` and `clawperator version --check-compat`

Example format:
```
[clawperator-skills] WARNING: snapshot_ui step "<id>" extraction failed
(SNAPSHOT_EXTRACTION_FAILED). This is a known issue when the globally installed
clawperator binary is out of date with the Android Operator APK.
Fix: set CLAW_BIN to a local or updated build:
  export CLAW_BIN=/path/to/clawperator/apps/node/dist/cli/index.js
Or run: clawperator version --check-compat
```

**Acceptance criteria:**
- Running any skill with the broken binary prints the warning to stderr before exiting
- Running any skill with a working binary (or with `CLAW_BIN` set correctly) prints no
  such warning
- The warning does not affect the exit code or stdout of any skill

---

#### REQ-3.2 - Update `com.android.vending.search-app` SKILL.md

The Notes section of the search skill must document the `CLAW_BIN` workaround.

**Required addition to
`skills/com.android.vending.search-app/SKILL.md`, Notes section:**

```
- If snapshot extraction fails silently (skill exits with "No snapshot returned" despite
  the device being on the correct screen), the globally installed `clawperator` binary
  may be out of date. Set `CLAW_BIN` to a local or updated build:
  `export CLAW_BIN=/path/to/clawperator/apps/node/dist/cli/index.js`
  Then run `clawperator version --check-compat` to confirm compatibility.
```

---

#### REQ-3.3 - Update `com.android.vending.install-app` SKILL.md

Same requirement as REQ-3.2 for the install skill.

**Required addition to
`skills/com.android.vending.install-app/SKILL.md`, Notes section:**

```
- If the skill exits with "Preflight snapshot returned empty" despite the device showing
  the app details page, the globally installed `clawperator` binary may be out of date.
  Set `CLAW_BIN` to a local or updated build:
  `export CLAW_BIN=/path/to/clawperator/apps/node/dist/cli/index.js`
  Then run `clawperator version --check-compat` to confirm compatibility.
```

---

#### REQ-3.4 - Update the existing skills' error messages to be less misleading (optional but recommended)

Skills like Coles, Woolworths, GloBird, Life360, and Settings exit with messages like
"Could not capture Coles search snapshot" when `data.text` is empty. These messages
give no indication whether the problem is the app, the network, the device, or the binary.

After REQ-3.1 ships (the shared warning in `utils/common.js`) and REQ-2.3 ships (step
returns `success: false`), users will see the binary warning before the skill-level error
and the step result will be clearly marked as failed. Updating individual skill error
messages is not required for correctness but is a quality improvement.

**If addressed:** Change the `else` branches in each skill from:
```js
console.error('Could not capture X snapshot');
```
to:
```js
console.error('Could not capture X snapshot. Check stderr for diagnostic details.');
```

This is lower priority than REQ-3.1 through REQ-3.3.

---

### Stream 4: Fix binary preference order in `utils/common.js`

#### REQ-4.1 - Prefer local sibling build over global binary in `utils/common.js`

The current resolution order in `utils/common.js` is:
1. `CLAW_BIN` env var (explicit override)
2. Global `clawperator` binary (via `which`)
3. Local sibling build fallback (only when global binary absent)

Step 3 never fires for users who have installed the global binary, which is the common
case. When the global binary is stale (the current bug), there is no automatic fallback
to a working local build even when one is present at the sibling repo path.

**Required change in `skills/utils/common.js`:**

Swap steps 2 and 3 so the preference order becomes:
1. `CLAW_BIN` env var (explicit override - unchanged)
2. Local sibling build (if `existsSync` confirms the path is present)
3. Global `clawperator` binary (via `which` or direct invocation)

The sibling build path to check:
```
path.resolve(__dirname, '../../../../clawperator/apps/node/dist/cli/index.js')
```
(relative to `skills/utils/common.js`)

**Rationale for safety:**
- `CLAW_BIN` remains the explicit override for users with non-sibling repo layouts
- The `existsSync` check means this only activates when the local build is actually present
- Users without a sibling checkout fall through to the global binary as before
- Local build always tracks the source tree, so it stays compatible with the APK

**Required stderr log line when local build is selected:**
```
[clawperator-skills] INFO: using local sibling build: <path>
```

This makes the selection auditable without being noisy (INFO, not WARNING).

**Acceptance criteria:**
- Running any skill when `CLAW_BIN` is unset and the sibling build exists at the expected
  path uses the sibling build path (confirmed by the INFO log line on stderr)
- Running any skill when `CLAW_BIN` is unset and no sibling build exists falls through
  to the global `clawperator` binary as before
- Running any skill with `CLAW_BIN` set always uses that value regardless of sibling
  build presence

---

## Acceptance criteria (all streams)

The fix is complete when ALL of the following are true:

1. `npm --prefix apps/node run build && npm --prefix apps/node run test` passes with the
   two new tests in `snapshotHelper.test.ts` and one new test in `runExecution.test.ts`

2. Running `clawperator observe snapshot --device-id <device>` with the updated binary
   returns non-empty `data.text` (or a clear error if the screen is locked or the
   Operator APK is not responding)

3. Running `node search_play_store.js <device> "Firefox"` without `CLAW_BIN` set uses
   the local sibling build when present (confirmed by INFO log on stderr) - or produces
   the diagnostic warning if only the broken global binary is available

4. Running `node install_play_app.js <device>` without `CLAW_BIN` set when already on
   the app details page: if snapshotHelper is broken, produces the diagnostic warning
   on stderr rather than only "Preflight snapshot returned empty"

5. When snapshot extraction fails (no logcat marker found), the `snapshot_ui` step
   returns `success: false` with `data.error: "SNAPSHOT_EXTRACTION_FAILED"` rather
   than `success: true` with absent `data.text`

6. `clawperator version --check-compat` reports compatible after the new binary is
   installed

7. `docs/node-api-for-agents.md` and `docs/troubleshooting.md` contain the additions
   specified in `docs-audit.md` ISSUE-01 and ISSUE-04, and the `snapshot_ui` contract
   section reflects the updated `success: false` behavior

8. Running any skill with no `CLAW_BIN` set and a local sibling build present logs
   `[clawperator-skills] INFO: using local sibling build: <path>` to stderr

---

## Out of scope

- Updating the skills authoring guide (`docs/skill-authoring-guidelines.md`) with
  guidance on the new `success: false` / `SNAPSHOT_EXTRACTION_FAILED` contract. This is
  a good follow-on but not required to unblock the fix. REQ-2.3 covers updating
  `docs/node-api-for-agents.md`; the authoring guide can be updated separately.

---

## Implementation order

1. Add the three new tests (`snapshotHelper.test.ts` x2, `runExecution.test.ts` x1) -
   these are currently passing in the local build and will validate the fix is correct

2. Rebuild the package (`npm --prefix apps/node run build`) - the source is already
   correct, no code changes needed for the extraction logic

3. Add the `success: false` / `SNAPSHOT_EXTRACTION_FAILED` change to `runExecution.ts`
   (REQ-2.3) - do this before the warning change so the warning can check `success`

4. Add the stderr warning to `runExecution.ts` (REQ-2.1) - now that step results
   carry `success: false`, the warning signals the path to diagnosis

5. Add the error code string to `contracts/errors.ts` (REQ-2.3)

6. Fix binary preference order in `utils/common.js` (REQ-4.1)

7. Add the snapshot sanity check warning to `utils/common.js` (REQ-3.1) - update
   to check `success === false && data.error === "SNAPSHOT_EXTRACTION_FAILED"` rather
   than checking for empty `data.text`, since REQ-2.3 now makes the failure explicit

8. Update the two Play Store SKILL.md files (REQ-3.2, REQ-3.3)

9. Update `docs/node-api-for-agents.md` and `docs/troubleshooting.md` (REQ-2.2,
   REQ-2.3 docs component)

10. Publish the new npm package version

Steps 1-9 can be done in a single PR. Step 10 is a release action.
