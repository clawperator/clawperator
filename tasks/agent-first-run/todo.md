# Agent First Run TODO

Source: `tasks/agent-first-run/findings.md` (cold-start agent evaluation, 2026-03-18)

---

## Stage 1: Core correctness fixes

### Goals
- Eliminate silent behavioral failures in the execution layer
- Make scroll_until + clickAfter actually reliable
- Fix exit code semantics in the CLI

### Items

1. [ ] Fix `scroll_until` + `clickAfter: true` to click when target is visible at EDGE_REACHED
   - **Problem:** When `scroll_until` exhausts the list and hits the bottom edge, `clickAfter: true` does not fire — even if the target element is visible on screen at that moment. The action returns `success: true` with `termination_reason: EDGE_REACHED` and silently skips the click. This is the single most impactful correctness bug found.
   - **Change:** Before returning `EDGE_REACHED`, re-check the accessibility tree for the target matcher. If the target is present and visible, execute the click and return `termination_reason: TARGET_FOUND`. If not, return `EDGE_REACHED` as before. The distinction is: EDGE_REACHED should mean "reached the edge *and* target was not visible at termination," not "reached the edge" unconditionally.
   - **Why it matters:** Targets at the bottom of long lists (e.g., "About phone" in Samsung Settings) are the most common real-world case for `scroll_until`. The current behavior means `clickAfter` is unreliable for exactly this use case. An agent using `scroll_until` + `clickAfter` as intended will silently navigate nowhere and operate on the wrong screen.
   - **Dependencies:** None. Self-contained change to scroll_until termination logic in the Android Operator.

2. [ ] Fix `clawperator doctor` exit code when `--device-id` is not specified but all devices are healthy
   - **Problem:** Running `doctor` without `--device-id` when multiple devices are connected returns exit code 1 (MULTIPLE_DEVICES_DEVICE_ID_REQUIRED), even if both devices are individually healthy. In CI/CD pipelines this fails health checks unnecessarily.
   - **Change:** Exit code 1 should be reserved for genuine failures (APK not installed, handshake failed, adb unreachable). `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` is an ambiguity condition, not a failure — exit 0 with a warning, or introduce a distinct exit code (e.g., 2) for "ambiguous but not broken."
   - **Why it matters:** Any CI pipeline that runs `clawperator doctor` as a preflight check will break when a dev machine has both a phone and an emulator attached.
   - **Dependencies:** None.

---

## Stage 2: Navigation and execution reliability

### Goals
- Give agents reliable post-click navigation confirmation without requiring manual sleep+snapshot loops
- Reduce round-trips per screen transition
- Make action param naming consistent so agents don't have to remember two different key names for the same concept

### Items

3. [ ] Add `wait_for_navigation` action (or `assert_foreground_package` step)
   - **Problem:** After clicking a list item that navigates to a new screen, there is no built-in primitive to confirm the navigation occurred. The only option is: (a) sleep a fixed amount, (b) snapshot, (c) inspect `foreground_package` or screen title manually. This is 2 extra round-trips per transition and falls apart on slow devices where the fixed sleep is too short.
   - **Change:** Add an action (or a `wait_for_navigation` variant of `wait_for_node`) that polls until either: (a) the foreground package changes to an expected value, (b) a specified node appears, or (c) the timeout is reached. Minimal signature: `{ type: "wait_for_navigation", params: { expectedPackage: "com.android.settings", timeoutMs: 5000 } }`. On success, include the resolved `foreground_package` in result data. On timeout, `success: false` with a clear error.
   - **Why it matters:** Every multi-screen Settings navigation today requires an undocumented sleep of 900–1500ms. On a slow device this is a source of flakiness. On a fast device it wastes time. A poll-based navigation wait eliminates both problems.
   - **Dependencies:** `scroll_until` fix (item 1) should ship first so the click actually fires before this wait is needed.

4. [ ] Normalize `matcher` vs `target` param naming across scroll and click actions
   - **Problem:** `click`, `read_text`, `enter_text`, and `wait_for_node` all use `matcher` to specify the target node. `scroll_and_click` and `scroll_until` use `target` for the same concept. An agent constructing payloads from docs has to remember which key name applies to which action type. The first `scroll_and_click` attempt in the evaluation used `selector` (wrong) then `matcher` (wrong) before finding `target` (right).
   - **Change:** Pick one canonical key name — `matcher` is preferred since it's used by more action types — and apply it consistently across `scroll_and_click` and `scroll_until`. Maintain `target` as a deprecated alias with a schema warning during a transition window.
   - **Why it matters:** This is the kind of inconsistency that produces 2–3 failed API calls before the agent gets a working payload. Low code change effort, high agent onboarding impact.
   - **Dependencies:** None. Schema change with backwards-compatible alias.

5. [ ] Document (and enforce) the snapshot settle delay requirement
   - **Problem:** A snapshot taken immediately after a click captures the pre-navigation UI state. A sleep of 900–1500ms is required before the snapshot to capture the new screen. This is currently mentioned only as a "practical tip" in the timeout budgeting docs — it is not in the navigation patterns guide, not in action reference, and not enforced or warned about in the runtime.
   - **Change (runtime):** If `snapshot_ui` follows a `click` with no intervening `sleep`, emit a warning in the step result (`data.warn: "snapshot taken <Nms> after preceding click; UI may not have settled"`). Threshold: < 500ms.
   - **Change (docs):** Add "snapshot settle delay" as an explicit section in the Navigation Patterns guide with the recommended delay range (500–1500ms depending on device speed) and the rationale.
   - **Why it matters:** Without this, every new agent author will hit the same silent stale-snapshot problem, burn a round-trip debugging it, and add a hardcoded sleep without understanding why.
   - **Dependencies:** None for docs. Runtime warning is independent.

---

## Stage 3: API primitives and CLI ergonomics

### Goals
- Add extraction and validation primitives that make the most common Settings-style read patterns first-class
- Add skill scaffolding so authors don't have to reverse-engineer file structure from existing skills
- Add a dry-run path to accelerate payload iteration

### Items

6. [ ] Add `read_key_value_pair` action
   - **Problem:** Reading a label + adjacent summary from a Settings-style list (e.g., "Android version" → "16") requires: snapshot, regex parse XML, find label node index, read text of index+1 node. This is fragile (depends on DOM adjacency) and duplicated across every skill that reads a settings value.
   - **Change:** Add `{ type: "read_key_value_pair", params: { labelMatcher: { textEquals: "Android version" } } }` that returns `{ label: "Android version", value: "16" }` in result data. Implementation: find the node matching `labelMatcher`, then return the `text` attribute of the nearest sibling or parent-adjacent node with a non-empty `android:id/summary` resource-id pattern.
   - **Why it matters:** Settings-style key-value screens are a primary stated use case. Making this first-class removes the most fragile part of every settings-reading skill.
   - **Dependencies:** None.

7. [ ] Extend `read_text` validators beyond `"temperature"`
   - **Problem:** The `validator` field on `read_text` only accepts `"temperature"`. A validator for `"version"` (matches semver-like strings: digits and dots) and for arbitrary regex patterns (`"regex": "^[0-9]+"`) would allow extraction to be validated at the primitive level rather than in userland parsing code.
   - **Change:** Add `"version"` validator (passes for strings matching `/^\d+(\.\d+)*$/`). Add `{ "validator": "regex", "pattern": "^\\d+" }` form. Return `success: false` with `data.error: "VALIDATOR_MISMATCH"` when validation fails, so agents can treat a bad read as a step failure rather than silently accepting garbage.
   - **Why it matters:** Without validation, a read that returns the wrong node's text is indistinguishable from a correct read until the agent tries to use the value downstream.
   - **Dependencies:** None.

8. [ ] Add `clawperator skills new <skill_id>` scaffolding command
   - **Problem:** Creating a new skill requires manually copying the file structure from an existing skill: `SKILL.md`, `skill.json`, `scripts/run.sh`, `scripts/run.js`. There is no `skills new` command in the CLI. The file structure was reverse-engineered during the evaluation.
   - **Change:** Add `clawperator skills new <skill_id> --app <packageId> --intent <intent>` that creates: the skill directory under the local skills root, a stub `SKILL.md` with frontmatter, a `skill.json` with all required fields populated from flags, a `scripts/run.sh` → `scripts/run.js` pair with the standard `runClawperator` boilerplate, and a registry entry in `CLAWPERATOR_SKILLS_REGISTRY`. Print the created paths and a "next steps" message pointing to the authoring guide.
   - **Why it matters:** Every new skill author currently has to cargo-cult from an existing skill. This also means the invocation contract (args, env vars, exit codes) is only learned by reading someone else's code.
   - **Dependencies:** None. Pure CLI addition.

9. [ ] Add `--dry-run` flag to `clawperator execute`
   - **Problem:** During skill development, testing whether a JSON payload is valid requires sending it to the device and paying a full round-trip cost. A payload with a schema error (e.g., wrong param key) only fails after the device receives it. There is no way to validate the payload structure locally before dispatch.
   - **Change:** `clawperator execute --execution <file> --dry-run` parses and validates the payload against the full JSON schema, prints the validated execution plan in human-readable form (action list with types and key params), and exits without sending anything to the device.
   - **Why it matters:** The `params` nesting error during the evaluation produced 2 failed API calls before the schema was understood. Dry-run eliminates this entire class of iteration cost.
   - **Dependencies:** None.

10. [ ] Fix silent failure when `CLAWPERATOR_SKILLS_REGISTRY` is unset or points to a missing file
    - **Problem:** If the env var is not set (e.g., a new shell without sourcing `.zshrc`, or a CI environment), `clawperator skills list` returns an empty result with no error or warning. The user has no signal that the registry is misconfigured vs. genuinely empty.
    - **Change:** If `CLAWPERATOR_SKILLS_REGISTRY` is unset, print a warning to stderr: `"CLAWPERATOR_SKILLS_REGISTRY is not set; no skills loaded. Set this variable to your registry JSON path."` If set but the file doesn't exist, exit with a clear error. In both cases, `skills list` should return a non-zero exit code so scripts can detect the misconfiguration.
    - **Why it matters:** Silent empty results caused by env misconfiguration waste time debugging the wrong layer.
    - **Dependencies:** None.

---

## Stage 4: Documentation consolidation and cleanup

### Goals
- Make the execution payload schema discoverable in one place
- Document `skills run` output contract
- Fix 404 links and scattered cross-references
- Document the multi-device installer behavior and APK-already-installed path

### Items

11. [ ] Create a single canonical action type reference page
    - **Problem:** The action schema (params structure per action type) is spread across `llms-full.txt`, the agent quickstart page, and the Node API guide. An agent author had to fetch 4 pages and make 2 invalid API calls before the correct payload structure was clear. The `reference/actions` URL returns 404, suggesting a recent reorganization left a gap.
    - **Change:** Create `reference/action-types/` (or restore the 404 URL) as a single page with a complete table: action type name, params schema (all keys, types, required/optional), result data shape, and a minimal example payload for each of the ~14 action types. Cross-link this page from the quickstart, the llms-full.txt, and the navigation patterns guide. Remove or update the stale `reference/actions` URL.
    - **Why it matters:** This is the highest-leverage docs change. The evaluation found that execution schema fragmentation caused more wasted time than any single product gap.
    - **Dependencies:** Items 4 (naming normalization) should ship first so the reference page reflects the canonical param names.

12. [ ] Document `scroll_until` `clickAfter` behavior explicitly, including EDGE_REACHED semantics
    - **Problem:** The `clickAfter` parameter exists on `scroll_until` but its exact firing condition (only `TARGET_FOUND`, not `EDGE_REACHED`) is not documented anywhere. An agent author would reasonably expect it to click whenever the target is visible at termination.
    - **Change:** In the action type reference (item 11) and in any existing `scroll_until` docs, add a note: *"`clickAfter` fires only when `termination_reason` is `TARGET_FOUND`. It does not fire on `EDGE_REACHED`, `MAX_SCROLLS_REACHED`, or other termination conditions. If the target may be at the very bottom of the list, follow `scroll_until` with an explicit `click` step."* Update this note once item 1 ships to reflect the new behavior.
    - **Why it matters:** Without this, every agent author hits the same silent miss and has to read step results carefully to figure out that `EDGE_REACHED` ≠ click.
    - **Dependencies:** Can ship before item 1 (documents current behavior as a warning). Must be updated after item 1 ships.

13. [ ] Document `skills run` output envelope
    - **Problem:** The `{ skillId, output, exitCode, durationMs }` JSON wrapper returned by `clawperator skills run` is not documented on any page. An agent invoking a skill and parsing its output has to discover this contract by running an existing skill and observing stdout.
    - **Change:** Add the `skills run` output schema to the skills usage model page and the CLI reference. Include: field names, types, and what `output` contains (raw stdout of the script). Note that skills communicate their result via stdout conventions (e.g., `RESULT|status=success|...`) which are skill-defined, not enforced by the runner.
    - **Why it matters:** Without this, skills cannot be reliably invoked by agents that parse the runner output.
    - **Dependencies:** None.

14. [ ] Fix broken links and 404s in agent-facing docs
    - **Problem:** `reference/actions` returns 404. Several links in the agent quickstart point to pages that return 404. This suggests a recent docs reorganization was not fully completed.
    - **Change:** Audit all internal links in the agent-facing docs section (`ai-agents/`, `reference/`). Fix or redirect each 404. Add a CI check that fails on internal broken links.
    - **Why it matters:** Broken links force agents and developers to fall back to `llms-full.txt` or trial-and-error, both of which are slower than the docs being authoritative.
    - **Dependencies:** None. Should be done before any other docs work to establish a clean baseline.

15. [ ] Add installer guidance for multi-device and APK-already-installed scenarios
    - **Problem:** When multiple devices are connected, the install script aborts APK install and tells the user to run `operator setup --device-id`. It does not check whether the APK is already installed on any of the connected devices. A user whose APK is already installed sees the same "setup required" message as one who has never set up, creating unnecessary uncertainty.
    - **Change (installer):** Before printing the multi-device warning, run `clawperator doctor --device-id <each_device>` silently and detect which (if any) already have the APK installed and handshake passing. If found: print *"APK already installed on <serial> — run `clawperator doctor --device-id <serial>` to verify readiness."* If not found: print the existing setup instructions.
    - **Change (docs):** Add a "Multiple devices" troubleshooting entry to the first-time setup page covering this exact scenario.
    - **Why it matters:** The ambiguity between "setup never done" and "setup already done on one of N devices" caused an unnecessary verification loop in the evaluation.
    - **Dependencies:** None.

16. [ ] Document `SERVICE_UNAVAILABLE` → `operator setup` recovery path inline in the error output
    - **Problem:** When the APK is not installed, the runtime returns `SERVICE_UNAVAILABLE`. The docs reference this code but mapping it to the fix (`clawperator operator setup`) requires reading the error-codes page. The error output itself does not suggest the recovery action.
    - **Change:** When `SERVICE_UNAVAILABLE` is returned and no receiver package is detected on the device, append to the error: *`"Hint: accessibility service not running. Run: clawperator operator setup --device-id <deviceId>"`*
    - **Why it matters:** This is the most common first-time setup failure. Putting the fix in the error output eliminates a docs lookup.
    - **Dependencies:** None.
