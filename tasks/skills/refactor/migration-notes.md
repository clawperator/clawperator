# Skills Refactor Migration Notes

## Overview
Refactoring all 11 skills in ~/src/clawperator-skills to use optimized node API from recent Clawperator changes (commit f7362bf..c407cfa).

## Key Technical Discoveries

### Execution Action Types
The execution payload supports a **limited set** of action types:
- `close_app` - close an application
- `open_app` - open an application
- `sleep` - pause execution for specified duration
- `click` - click on an element via matcher
- `scroll_and_click` - scroll within a container and click on an element
- `snapshot_ui` - capture UI hierarchy as text
- `read_text` - read text from a matched element
- `scroll` - scroll in a specified direction

**NOT SUPPORTED in execution payloads** (even though they are CLI commands):
- `take_screenshot` - this is a CLI command, not an action type. Cannot be used in execution payloads.
- `wait_for_nav` - this is a CLI command for polling, not an execution action
- `enter_text` - appears in some older skills but may not be a valid action type

### Skills Updated: Terminology Changes
All 11 skills have been updated to use `operator_package` terminology (replacing `receiver_package`):

#### Core Skills (Infrastructure)
- [ ] **com.android.settings.capture-overview** ✅ DONE
  - Removed adb screencap dependency
  - Uses snapshot_ui for hierarchy capture
  - Created placeholder screenshot file for output format compatibility
  - Increased settle sleep from 2000ms to 3000ms

- [ ] **utils/common.js** ✅ DONE (SHARED)
  - Fixed warnOnSnapshotExtractionFailure to check `result.envelope.stepResults` (not `result.stepResults`)
  - Changed command from `execute --execution` to `exec` (positional argument)
  - Updated "receiver package" → "operator package" in comments

#### Play Store Skills
- [ ] **com.android.vending.search-app** ✅ DONE
  - Updated usage strings: `[receiver_package]` → `[operator_package]`
  - Kept adb `am start` for market:// URI (still functional)
  - Updated SKILL.md

- [ ] **com.android.vending.install-app** ✅ DONE
  - Updated usage strings
  - Updated SKILL.md

#### Device Control Skills
- [ ] **com.globird.energy.get-usage** ✅ DONE
  - Updated operator_package terminology

- [ ] **com.google.android.apps.chromecast.app.get-climate** ✅ DONE
  - Updated operator_package terminology

- [ ] **com.google.android.apps.chromecast.app.set-climate** ✅ DONE
  - Already had correct terminology (no changes needed)

#### Location & Home Skills
- [ ] **com.life360.android.safetymapd.get-location** ✅ DONE
  - Updated operator_package terminology
  - **Removed `take_screenshot` action** - was not a valid action type in execution payload
  - Removed screenshot-related env vars and output format (RETURN_SCREENSHOT, SCREENSHOT_DIR, etc.)
  - Simplified SKILL.md documentation
  - Removed unused `extractFinalPath` helper function

- [ ] **com.theswitchbot.switchbot.get-bedroom-temperature** ✅ DONE
  - Updated operator_package terminology

#### Grocery/Retail Search Skills
- [ ] **com.coles.search-products** ✅ DONE
  - Updated operator_package terminology
  - Uses `enter_text` action (status: needs validation on device)

- [ ] **com.woolworths.search-products** ✅ DONE
  - Updated operator_package terminology
  - Uses `enter_text` action (status: needs validation on device)

#### Solar/Battery Skills
- [ ] **com.solaxcloud.starter.get-battery** ✅ DONE
  - Updated operator_package terminology

## Implementation Status

### Completed
1. ✅ All 11 skills updated with operator_package terminology
2. ✅ common.js fixed for proper envelope path handling
3. ✅ CLI command updated from `execute --execution` to `exec`
4. ✅ Unsupported action types removed (take_screenshot)
5. ✅ All changes committed to clawperator-skills main branch

### Pending
1. ⏳ Device testing:
   - Test capture-overview on device (<device_serial>) to verify simplified screenshot handling
   - Test life360 without screenshot action
   - Validate enter_text action support in coles and woolworths skills
   - Spot-check other skills for runtime behavior

2. ⏳ Clawperator worktree:
   - Verify that common.js changes in skills work with current clawperator binary
   - Check if any API contract updates are needed
   - Validate operator APK compatibility

## Key Changes Summary

### What Changed
- **Terminology**: `receiver_package` → `operator_package` across all skills and documentation
- **CLI**: `execute --execution` → `exec` for cleaner command interface
- **Action Types**: Removed unsupported `take_screenshot` from execution payloads (use snapshot_ui instead)
- **Screenshot Handling**: Simplified capture-overview and life360 to not attempt visual screenshots via execution API

### What Stayed The Same
- Core execution patterns remain unchanged
- Matcher-based element selection still works
- Snapshot capture via `snapshot_ui` action unchanged
- All skill entry points and shell wrappers unchanged

## Validation Checklist

- [ ] Device testing: skills/com.android.settings.capture-overview on <device_serial>
- [ ] Device testing: skills/com.globird.energy.get-usage (reads energy stats)
- [ ] Device testing: skills/com.life360.android.safetymapd.get-location (removed take_screenshot)
- [ ] Device testing: Spot-check coles/woolworths for enter_text action support
- [ ] Verify clawperator binary alignment with refactored skills API

## Notes

- All skills now use consistent operator_package parameter naming
- Screenshot functionality is best handled at the clawperator CLI level (`screenshot` command) rather than in execution payloads
- `enter_text` action may need validation - if not supported, coles/woolworths skills will fail on type actions
- Migration is backwards-compatible at the shell wrapper level; no external API changes to skill invocation signatures
