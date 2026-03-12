# Scroll API Testing Findings

## Scope

Review target: Claude's work in `claude/inspiring-pare`

Secondary verification target: Settings skill in sibling repo `../clawperator-skills`

Device used:
- `<device_id>`

Receiver package used:
- `com.clawperator.operator.dev`

## What I verified

I reviewed the Android scroll implementation, Node validation/contracts, docs updates, and the new smoke script.

I also ran:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew testDebugUnitTest :app:assembleDebug
./gradlew :app:installDebug
adb shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity
DEVICE_ID=<device_id> CLAWPERATOR_RECEIVER_PACKAGE=com.clawperator.operator.dev ./scripts/clawperator_smoke_scroll.sh
ADB_SERIAL=<device_id> ../clawperator-skills/skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh <device_id> com.clawperator.operator.dev
```

Results after fixes:
- Node build: PASS
- Node test suite: PASS
- Android unit tests: PASS
- Android debug assemble/install: PASS
- `clawperator_smoke_scroll.sh`: PASS
- `com.android.settings.capture-overview`: PASS

## Issues found and fixed

### 1. `scrollOnce` misclassified empty/childless containers as `moved`

Problem:
- `TaskUiScopeDefault.scrollOnce()` only returned `edge_reached` when both signatures were non-null and identical.
- If `leadingChildSignature()` returned `null`, the code fell through to `moved`.
- That contradicts the intended contract and Claude's own discovery notes.

Impact:
- Empty scrollable containers, or containers whose visible children cannot produce a signature, could report false movement.

Fix applied:
- Treat `sigBefore == null` or `sigAfter == null` as `edge_reached`.

Files:
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`

### 2. Node contract exported an unsupported `TARGET_FOUND` termination reason

Problem:
- `apps/node/src/contracts/scroll.ts` advertised `TARGET_FOUND`.
- No current runtime path or validation path supports `scroll_until` with `until` / `target`.

Impact:
- TypeScript consumers could code against a result that cannot actually be emitted.

Fix applied:
- Removed `TARGET_FOUND` from the exported type and cleaned up the comment.

Files:
- `apps/node/src/contracts/scroll.ts`

### 3. The new scroll smoke script was not validating the real Settings list

Problems:
- It auto-selected the first visible scrollable container, which on Samsung Settings is the outer `ScrollView`, not the actual `RecyclerView`.
- Its `leading_signature()` helper assumed an ASCII tree even though `snapshot_ui` currently returns `hierarchy_xml`.
- The original `grep | head` pipeline was also vulnerable to `SIGPIPE` under `set -o pipefail`.

Observed effect before fix:
- The script could report success while exercising the wrong container.
- It also exited with code `141` during final signature extraction.

Fix applied:
- Explicitly target `com.android.settings:id/recycler_view` for both down and up scroll checks.
- Replaced the brittle shell pipeline with a small Node XML text extractor.

Files:
- `scripts/clawperator_smoke_scroll.sh`

### 4. The Settings skill in `../clawperator-skills` was broken against current Clawperator contracts

Problems:
- It sent `snapshot_ui.params.format`, which now fails strict validation.
- It did not emit the `RESULT|...` line promised by its own skill contract.
- It did not capture or emit the screenshot path promised by the skill docs.
- The usage docs were wrong about required arguments.

Observed effect before fix:
- The skill failed immediately with:
  - `EXECUTION_VALIDATION_FAILED`
  - `Unrecognized key(s) in object: 'format'`

Fix applied:
- Removed the invalid `format` param.
- Added the expected `RESULT|...`, `TEXT_BEGIN/TEXT_END`, and `SCREENSHOT|path=...` output.
- Added actual `adb exec-out screencap -p` capture.
- Corrected skill/README usage examples to include `<device_id>`.

Files:
- `../clawperator-skills/skills/com.android.settings.capture-overview/scripts/capture_settings_overview.js`
- `../clawperator-skills/skills/com.android.settings.capture-overview/SKILL.md`
- `../clawperator-skills/README.md`
- `../clawperator-skills/docs/usage-model.md`

## Important remaining issues

These should be handled in a separate path rather than folded into this scroll change.

### A. Auto-detecting the "first scrollable" is not reliable on nested-scroll screens

Evidence:
- On Samsung Settings, the first scrollable node is `com.android.settings:id/coordinator` (`ScrollView`), not the actual list `com.android.settings:id/recycler_view`.
- This caused the original smoke script to validate the wrong surface.

Impact:
- Agents relying on `scroll` without an explicit `container` can get misleading behavior on nested-scroll layouts.

Recommendation:
- Separate follow-up to improve container resolution heuristics or expose a clearer disambiguation strategy in docs/results.

### B. `scrollLoop()` currently treats mid-loop container loss as `EDGE_REACHED`

Location:
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`

Problem:
- If the container disappears mid-loop because the app navigated away or the view tree changed unexpectedly, the code maps that to `EDGE_REACHED`.

Impact:
- Agents can receive a false-success terminal reason instead of a drift/navigation signal.

Recommendation:
- Separate follow-up to distinguish true edge exhaustion from container disappearance mid-loop.

### C. Other skills repo assets still use the old `snapshot_ui.params.format` shape

I found additional stale references in `../clawperator-skills`, for example:
- `skills/com.globird.energy.get-usage/scripts/get_globird_usage.js`
- `skills/com.globird.energy.get-usage/artifacts/usage.recipe.json`
- `skills/com.solaxcloud.starter.get-battery/artifacts/battery.recipe.json`

Impact:
- These likely fail under the same strict validation path.

Recommendation:
- Separate sweep across `clawperator-skills` to update all legacy `snapshot_ui` payloads and re-verify affected skills.

## EM assessment

The core scroll implementation is directionally good and the branch is now in much better shape after validation, but the original submission was not yet review-ready.

Main reasons:
- A real edge-case bug existed in the Android runtime.
- The exported Node contract overstated unsupported behavior.
- The supplied smoke test did not prove what it claimed to prove on a real device.
- The requested Settings skill verification initially failed due to stale sibling-repo contract usage.

After the fixes above:
- The branch is materially stronger.
- The shipped verification story is now credible.
- The remaining risk is concentrated in container auto-detection and mid-loop container loss semantics, which should be split into a dedicated follow-up.
