# Snapshot Bug: Skill Exposure Analysis

This document answers whether the new Play Store skills work around the broken global
binary snapshotHelper, and audits all skills in the repo for the same exposure.

**Short answer:** No workaround exists in any skill. All 10 skills in the repo use the
same code path and are equally broken on machines where the global `clawperator` binary
is installed.

---

## The bug, briefly

`apps/node/src/domain/executions/snapshotHelper.ts` (local source, correct):
```
searches logcat for: [TaskScope] UI Hierarchy:
```

`/opt/homebrew/lib/node_modules/clawperator/dist/.../snapshotHelper.js` (global install, broken):
```
searches logcat for: TaskScopeDefault:
```

The Android app emits `[TaskScope] UI Hierarchy:`. The global binary's marker never
matches. `data.text` is always empty. `success: true` is still returned.

---

## How binary selection works in `utils/common.js`

All skills delegate to `runClawperator()` in `skills/utils/common.js`:

```js
let clawBin = clawBinOverride || process.env.CLAW_BIN || 'clawperator';
let cmd = clawBin;

if (cmd === 'clawperator') {
  try {
    execFileSync('which', ['clawperator'], { stdio: 'ignore' });
    // 'which' succeeded -> use global binary as-is, no further check
  } catch (e) {
    // 'which' failed -> fall back to local build
    const localCli = process.env.CLAW_CLI_PATH ||
      resolve(__dirname, '..', '..', '..', 'clawperator', 'apps', 'node', 'dist', 'cli', 'index.js');
    if (existsSync(localCli)) {
      cmd = 'node';
      args = [localCli, ...args];
    }
  }
}
```

**The local fallback only activates when `which clawperator` fails** - i.e. when the
global binary is NOT installed. On a machine with the global binary installed (the
normal state after `npm install -g clawperator` or `brew install clawperator`), the
fallback never runs and the broken binary is used unconditionally.

The only available override is the `CLAW_BIN` env var, which bypasses the `if (cmd ===
'clawperator')` branch entirely and uses whatever path is provided.

---

## Audit: every skill in the repo

| Skill | Uses snapshot? | Workaround for bug? | Behavior when `data.text` is empty |
|-------|---------------|--------------------|------------------------------------|
| `com.android.settings.capture-overview` | yes | none | `console.error("⚠️ Could not capture settings overview")` + exit 2 |
| `com.coles.search-products` | yes | none | `console.error("⚠️ Could not capture Coles search snapshot")` + exit 2 |
| `com.woolworths.search-products` | yes | none | same pattern as Coles + exit 2 |
| `com.globird.energy.get-usage` | yes | none | `console.error("⚠️ Could not capture GloBird usage snapshot")` + exit 2 |
| `com.life360.android.safetymapd.get-location` | yes | none | exits without output (no explicit error for null snapText path) |
| `com.theswitchbot.switchbot.get-bedroom-temperature` | yes (read_text) | none | `console.error("⚠️ Could not parse bedroom temperature")` + exit 2 |
| `com.solaxcloud.starter.get-battery` | yes (read_text) | none | `console.error("⚠️ Could not parse SolaX battery level")` + exit 2 |
| `com.google.android.apps.chromecast.app.get-aircon-status` | yes (read_text) | none | uses `data.text` from `read_text` steps, not `snapshot_ui` |
| `com.android.vending.search-app` (new) | yes | none | `console.error("No snapshot returned.")` + exit 3 |
| `com.android.vending.install-app` (new) | yes | none | `console.error("Preflight snapshot returned empty.")` + exit 3 |

**No skill has a workaround.** Every skill that uses snapshots will silently fail on the
broken global binary with a generic error message that gives no hint about the root cause.

### Note on `read_text` skills

`com.theswitchbot`, `com.solaxcloud`, and `com.google.android.apps.chromecast` use
`read_text` action steps rather than `snapshot_ui`. The `read_text` data is returned in
`data.text` on the step result, extracted directly by the Android runtime - NOT through
the logcat snapshot pipeline. **These skills are not affected by the snapshotHelper bug**
and work correctly with the global binary.

---

## The new Play Store skills specifically

Neither `search_play_store.js` nor `install_play_app.js` contains any workaround:

- No `CLAW_BIN` check
- No version detection before calling `runClawperator`
- No diagnostic message pointing to the binary bug when `data.text` is empty

The skills were **validated using `CLAW_BIN` set to the local build** during development.
That env var is not documented in either skill's `SKILL.md` or in `utils/common.js`'s
public interface.

The test I ran (`CLAW_BIN=.../dist/cli/index.js node install_play_app.js ...`) would
FAIL without that env var on a standard install:

```
Preflight snapshot returned empty. Is the device on the app details page?
```

This error message is actively misleading - the device IS on the correct page, the issue
is the binary. A user following the error message would check device state, navigate away,
try again, and keep getting the same result.

---

## What a correct fix looks like

There are three valid approaches, ordered by impact:

### Fix A: Fix the global binary (fix the root cause)

In `apps/node/src/domain/executions/snapshotHelper.ts`, the marker is correct. The bug
is that the dist published to npm/homebrew was built from an older source that used
`TaskScopeDefault:`.

**Required action:** Rebuild and republish the npm package. The local source is already
correct - this is purely a packaging/release issue.

Until a new version is published, every globally installed binary is broken for snapshot
extraction.

### Fix B: Add a snapshot sanity check to `utils/common.js`

After `runClawperator` returns, check whether any `snapshot_ui` step has an empty
`data.text` despite `success: true`. If so, emit a specific warning:

```js
// In runClawperator, after parsing the result:
const snapshotSteps = (result?.envelope?.stepResults || [])
  .filter(s => s.actionType === 'snapshot_ui' && s.success && !s.data?.text);

if (snapshotSteps.length > 0) {
  process.stderr.write(
    '[clawperator-skills] WARNING: snapshot_ui returned success:true but data.text is empty.\n' +
    'This is a known issue with the globally installed clawperator binary.\n' +
    'Fix: set CLAW_BIN to a local build, e.g.:\n' +
    '  CLAW_BIN=/path/to/clawperator/apps/node/dist/cli/index.js\n'
  );
}
```

This would make the failure immediately diagnosable for all skills without changing any
skill code. The warning goes to stderr so it doesn't contaminate skill output.

### Fix C: Prefer local build when both are available

Change the binary resolution in `utils/common.js` to prefer the local build over the
global binary when a local build exists at the expected sibling path. This would mean
skill authors and power users always get the latest local build automatically:

```js
// Current: use global if 'which clawperator' succeeds
// Proposed: prefer local build if it exists
const localCli = process.env.CLAW_CLI_PATH ||
  resolve(__dirname, '..', '..', '..', 'clawperator', 'apps', 'node', 'dist', 'cli', 'index.js');

if (existsSync(localCli)) {
  cmd = 'node';
  args = [localCli, ...args];
} else {
  // fall through to global
}
```

This is a more aggressive change and has a downside: users with separate installs of
skills and the main repo could get unexpected binary resolution. But for the typical
developer workflow (sibling repos) it would always work correctly.

---

## Immediate mitigation (no code change required)

Until Fix A ships, users must set `CLAW_BIN` to avoid broken snapshots:

```bash
export CLAW_BIN=/path/to/clawperator/apps/node/dist/cli/index.js
```

This should be documented in:
- `skills/utils/common.js` (comment on the CLAW_BIN env var)
- `docs/troubleshooting.md` (ISSUE-04 from docs-audit.md)
- Each skill's `SKILL.md` Notes section, or a shared `skills/README.md`

---

## Recommended actions for the fixing agent

1. **Fix A is the correct long-term fix.** Rebuild and republish the npm package from the
   current source. The `snapshotHelper.ts` fix is already in the repo - this is a release
   action.

2. **Fix B should be added to `utils/common.js`** regardless of Fix A shipping, because
   the silent failure mode (`success: true`, empty `data.text`) will recur any time there
   is a version mismatch between the binary and the app.

3. **Update the two new Play Store skills' `SKILL.md`** Notes sections to document the
   `CLAW_BIN` workaround explicitly, until Fix A ships.

4. **Add the `CLAW_BIN` workaround** to `docs/troubleshooting.md` as described in
   ISSUE-04 of `docs-audit.md` (already written, ready to apply).
