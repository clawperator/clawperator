You are implementing Phase 3 of the Clawperator Node API refactor on the
`api-refactor/phase-3` branch. 

Repos are at sibling paths:
  ~/src/clawperator       (Node API + Operator APK)
  ~/src/clawperator-skills  (skills - also needs commits)

CRITICAL ENVIRONMENT NOTE:
  The global `clawperator` binary has been uninstalled. You MUST use the
  local build at all times. Before running any CLI command:
    npm --prefix apps/node run build
  Then either:
    a) Set CLAWPERATOR_BIN=apps/node/dist/cli/index.js and run via:
         node apps/node/dist/cli/index.js <args>
    b) Or use the env var with skill scripts (common.js auto-detects the
       sibling build at ../clawperator/apps/node/dist/cli/index.js,
       so `cd ~/src/clawperator-skills && <command>` will find
       it automatically as long as apps/node/dist/ exists and is current)

  When testing with the dev Operator APK (preferred for local dev),
  always pass: --operator-package com.clawperator.operator.dev

  Device serials:
    emulator-5554   (Android 15 AOSP emulator - Pixel with Google Play)
    <physical-device-serial>     (Android 16 Samsung physical device)
  Both devices are attached. ALWAYS pass --device <serial> explicitly.


=== PHASE 3 SCOPE ===

Phase 3 adds ergonomic selector flags to all element-targeting commands,
replacing the JSON-heavy --selector flag with simple named flags that
agents and humans can guess intuitively.

See full spec: tasks/api/refactor/plan.md  ##Phase 3: Selector Flags

Key deliverables:

1. SELECTOR FLAGS on click/tap, type/fill, read, wait
   New flags (all optional; combine with AND semantics):
     --text <exact>           → NodeMatcher.textEquals
     --text-contains <sub>    → NodeMatcher.textContains
     --id <resource-id>       → NodeMatcher.resourceId
     --desc <exact>           → NodeMatcher.contentDescEquals
     --desc-contains <sub>    → NodeMatcher.contentDescContains
     --role <role>            → NodeMatcher.role

   --selector <json> remains as an advanced/fallback option.

   Mutual exclusion: --selector combined with any simple flag is an error
   (code EXECUTION_VALIDATION_FAILED, message "use --selector OR the simple
   flags, not both").

   Blank strings rejected at validation boundary (code EXECUTION_VALIDATION_FAILED).

   Multiple simple flags combine: --text "Login" --role button produces
   { textEquals: "Login", role: "button" }

2. CONTAINER FLAGS on scroll (and read if container makes sense there per plan)
   Same flag set with --container- prefix:
     --container-text, --container-text-contains, --container-id,
     --container-desc, --container-desc-contains, --container-role,
     --container-selector
   These populate the separate NodeMatcher passed as `container` in ActionParams.

3. UPDATE MISSING-SELECTOR ERRORS on click, type, read, wait to show the
   Phase 3 form (plan §Phase 3 failure-mode requirements):
     Error: click requires a selector.
     Use one of:
       --text <text>           Exact visible text
       --id <resource-id>      Android resource ID
       --desc <text>           Content description
       --role <role>           Element role
     Example:
       clawperator click --text "Wi-Fi"

4. UPDATE HELP TEXT for click, type, read, wait, scroll to document the
   new flags. Regenerate sites/docs/docs/ using the docs-generate skill
   (.agents/skills/docs-generate/) after updating canonical docs in docs/.

5. VERIFY --submit AND --clear on `type` command (carried from Phase 2).
   These should already work. If not, fix them.

Phase 3 is NODE/CLI-LAYER ONLY. The Android Operator APK does NOT need
changes - NodeMatcher fields already exist in the Kotlin contract.
Do NOT run Gradle unless something is broken that requires it.


=== IMPLEMENTATION APPROACH ===

The cleanest approach is:

a) Create a `resolveElementMatcherFromCli` function (suggest adding to
   apps/node/src/cli/registry.ts alongside the other helpers, or in a
   small new module apps/node/src/cli/selectorFlags.ts). It should:
   - Accept the `rest` tokens array
   - Read all selector-related flags
   - Detect mutual exclusion (--selector + any simple flag = error)
   - Detect blank string inputs
   - Return { ok: true, matcher: NodeMatcher } or { ok: false, error: string }

b) Replace the current --selector-only parsing in COMMANDS["click"],
   ["type"], ["read"], ["wait"] with calls to resolveElementMatcherFromCli.

c) For scroll, add a `resolveContainerMatcherFromCli` (or fold container
   logic into the same helper) to resolve --container-* flags.

d) Audit the existing `parseSelector` function in action.ts - it may
   overlap or be superseded.

The NodeMatcher interface is in apps/node/src/contracts/selectors.ts.
The domain builders (buildClickExecution, buildReadExecution, etc.) in
apps/node/src/domain/actions/ accept NodeMatcher directly - no changes
needed there.


=== TESTING ===

Unit tests are REQUIRED before moving to device verification:

In apps/node/src/test/unit/cliHelp.test.ts (or a new selectorFlags.test.ts):
  - --text "Login" produces textEquals:"Login" in the matcher
  - --id "com.foo:id/bar" produces resourceId:"com.foo:id/bar"
  - --desc "Submit" produces contentDescEquals:"Submit"
  - --text-contains "Log" produces textContains:"Log"
  - --desc-contains "Wi" produces contentDescContains:"Wi"
  - --role button produces role:"button"
  - --text "Login" --role button combines to both fields set
  - --text "Login" --selector '{"textEquals":"x"}' → EXECUTION_VALIDATION_FAILED
  - --text "" → EXECUTION_VALIDATION_FAILED (blank string)
  - No selector flags → MISSING_SELECTOR with Phase 3 help text
  - Container: --container-text "list" on scroll → container field populated
  - --container-selector '{"textEquals":"x"}' --container-text "y" → error

Always run: npm --prefix apps/node run build && npm --prefix apps/node run test
All 494+ existing tests must continue to pass.


=== SKILL VERIFICATION (do these in order) ===

--- STEP 1: com.android.settings.capture-overview on EMULATOR ---

Target device: emulator-5554
Reason for emulator first: AOSP Android is more predictable than Samsung
One UI; this verifies the baseline without OEM interference.

The skill is at:
  ~/src/clawperator-skills/skills/com.android.settings.capture-overview/

Run:
  cd ~/src/clawperator-skills
  DEVICE_ID=emulator-5554 \
  CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
  ./skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh \
    emulator-5554 com.clawperator.operator.dev

Expected output markers: TEXT_BEGIN / TEXT_END, SCREENSHOT|path=, SNAPSHOT|path=, ✅

The skill currently uses `runClawperator` which calls `execute --execution`.
After Phase 3 lands, assess whether to migrate the skill to use individual
flat Node API calls (open, snapshot, etc.) instead of the raw execute payload.
If migrating: replace runClawperator in the JS script with individual
`execFileSync(node, [cliPath, 'open', ...])` calls, or a small helper that
calls the flat commands. Migration makes the skills more readable and
exercises the Phase 3 surface. Leave skill in a working state either way.

--- STEP 2: com.android.vending.search-app on PHYSICAL DEVICE ---

Target device: <physical-device-serial>
The emulator DOES have com.android.vending but this skill is designated
for the physical device (Google Play Store behavior is more complete on
a signed-in physical device).

Run:
  cd ~/src/clawperator-skills
  DEVICE_ID=<physical-device-serial> \
  CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
  ./skills/com.android.vending.search-app/scripts/search_play_store.sh \
    <physical-device-serial> "VLC" com.clawperator.operator.dev org.videolan.vlc

This skill has significant selector logic (contentDescContains, role:textfield,
etc.). Once Phase 3 selector flags are working, update the skill's execute
payload selectors where Phase 3 flags would be cleaner - e.g., the
`enter-query` step uses `matcher: { role: "textfield" }` which could become
--role textfield if migrating to flat calls. However this skill is complex
(multi-step with optional adb deep-link path), so judge carefully whether full
migration or partial is appropriate. At minimum, verify the skill runs end-to-end
and produces: Path used: ..., App: ..., Install state: ..., ✅ App details page loaded

The skill.json lists `scripts` as an array - both .sh and .js files are
mentioned by name. Verify the script still correctly invokes the .js wrapper.

--- STEP 3: com.solaxcloud.starter.get-battery on PHYSICAL DEVICE ---

Target device: <physical-device-serial>
The Solax Cloud app (com.solaxcloud.starter) is already installed on the
physical device. This skill reads a battery percentage via resource ID selector.

Run:
  cd ~/src/clawperator-skills
  DEVICE_ID=<physical-device-serial> \
  CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
  ./skills/com.solaxcloud.starter.get-battery/scripts/get_solax_battery.sh \
    <physical-device-serial> com.clawperator.operator.dev

Expected output: ✅ SolaX battery level: <value>%

The skill uses `read_text` actions with resource ID selectors
(com.solaxcloud.starter:id/tv_pb_title and tv_pb_unit). This tests the
read command path end-to-end. After Phase 3, --id flag can target these
resource IDs directly if migrating to flat calls.

NOTE: the app requires ~12 seconds to load data after opening. The existing
12s sleep is intentional; do not reduce it. If the skill fails with a
"no node found" error, the app may have changed its resource IDs - take a
snapshot first and inspect the hierarchy to find the current ID.


=== MIGRATION DECISION GUIDE ===

The skills currently use `runClawperator(execution, ...)` which bundles
multiple actions into a single execute payload. The alternative is calling
individual flat Node API commands from the JS script (open, snapshot, read, etc.).

Pros of migrating to flat calls:
  - Directly exercises Phase 3 selector flag surface
  - More readable scripts (each line = one UI action)
  - Easier to debug (each call returns a result immediately)
  - Better alignment with agent-facing docs

Cons:
  - More round-trips (each action = one process spawn)
  - Error handling needs to be explicit per step
  - Skills become longer

Recommendation: migrate the simpler skills (capture-overview, get-battery)
to flat calls since they're short and linear. Leave search-app on execute
payload since it has complex optional branching (adb direct path + fallback).
This is a judgment call - do what makes the skills cleaner and more
maintainable. Document the choice in SKILL.md if migrating.

If migrating, the pattern is:
  const result = JSON.parse(execFileSync(node, [cliPath, 'open', appId,
    '--device', deviceId, '--operator-package', operatorPkg, '--json'],
    { encoding: 'utf8' }));
  if (result.code) { /* error */ }

The sibling build is auto-detected by common.js; for direct calls,
resolve the path using:
  const siblingCli = resolve(__dirname, '..', '..', '..', '..', 'clawperator',
    'apps', 'node', 'dist', 'cli', 'index.js');

Never hardcode the full ~/... path. Use __dirname-relative paths
or rely on the CLAWPERATOR_BIN env var that users will set.


=== DOCUMENTATION ===

After all implementation and skill verification is complete:

1. Update docs/node-api-for-agents.md:
   - Document new selector flags for click, type, read, wait
   - Add --container-* flags for scroll
   - Show --text examples prominently in the quick reference

2. Update the relevant SKILL.md files in clawperator-skills if skill
   behavior or usage changed.

3. Regenerate sites/docs/docs/ via the docs-generate skill:
     .agents/skills/docs-generate/

4. Run docs validation:
     .agents/skills/docs-validate/
   It fails if sites/docs/docs/ changes without a canonical source change.

5. Mark Phase 3 as [DONE] in tasks/api/refactor/plan.md.


=== COMMIT DISCIPLINE ===

Commit at each logical breakpoint, not just at the end:
  - feat(cli): Phase 3 selector flag parsing (resolveElementMatcherFromCli)
  - test(cli): unit tests for selector flag resolution
  - feat(cli): wire selector flags to click, type, read, wait
  - feat(cli): container selector flags for scroll
  - feat(skills): migrate capture-overview to flat Node API calls  [if migrating]
  - fix(skills): verify/update search-app skill on physical device
  - fix(skills): verify/update get-battery skill on physical device
  - docs: update selector flag reference and regenerate docs site

Use conventional commits. Keep commits narrow and reviewable.
Both repos (~/src/clawperator and ~/src/clawperator-skills)
need their own commits when changes land in each.
Do NOT push unless explicitly asked.

Update tasks/api/refactor/phase-3-impl-plan.md as you make progress. Refer back to tasks/api/refactor/phase-3-impl-plan.md as necessary.


=== VALIDATION SEQUENCE ===

For each change, validate before committing:
  1. npm --prefix apps/node run build  (must be clean)
  2. npm --prefix apps/node run test   (494+ tests, 0 failures)
  3. Device smoke (once skill verification steps are reached)

For the smoke script after Phase 3:
  DEVICE_ID=<physical-device-serial> bash scripts/clawperator_smoke_core.sh
  (It uses flat Phase 2 commands already; verify it still passes)

For skills smoke:
  DEVICE_ID=<physical-device-serial> bash scripts/clawperator_smoke_skills.sh
  (Verify this does not call old command forms)


=== KNOWN ISSUES TO WATCH FOR ===

- The capture-overview skill calls the script with positional args
  (<device_id> <receiver_package>). If you change the skill to use env
  vars only, update SKILL.md and the script arg parsing accordingly.

- The Solax battery skill has a 12-second sleep that is intentional.
  If the app fails to load data, the resource IDs may have changed in
  an app update. Take a snapshot of the app after it loads and inspect
  the hierarchy before declaring the selectors broken.

- The search-app skill on the physical device (Samsung One UI) uses
  `contentDescEquals "Search Google Play"` which is Play Store-specific.
  If the device has Samsung Galaxy Store as a conflicting app store,
  the `buildDirectEntryExecution` path handles it with a picker click.
  Test both code paths if possible.

- The global `clawperator` binary is GONE. If any script exits with
  "command not found: clawperator", it means it fell through to the
  global binary fallback. Fix by ensuring the sibling build exists
  at apps/node/dist/cli/index.js (run build first) or by setting
  CLAWPERATOR_BIN explicitly.

- Do not hand-edit sites/docs/docs/ - it is generated output. Fix
  canonical sources in docs/ then regenerate.
