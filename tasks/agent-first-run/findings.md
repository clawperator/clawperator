# Clawperator Evaluation: Cold-Start Agent Findings

## What this document is

This is a first-principles evaluation of Clawperator — an Android UI automation runtime that uses a brain/hand model (LLM = brain, Clawperator = hand). A cold-start agent was given a connected Samsung Galaxy S22, no prior knowledge of the product, and a single task: install Clawperator from scratch and retrieve the Android OS version using only the documented UI automation API (no `adb shell getprop`).

The agent followed the full install path, learned the execution model through runtime observation, navigated Android Settings to find the Android version, and built a reusable private skill. Every finding below came from direct experience — not from assumptions or prior knowledge.

**Why it exists:** The output of this evaluation is the source of truth for `tasks/agent-first-run/todo.md`, which breaks the findings into 14 concrete tasks across 7 PRs. An agent implementing any of those tasks should read the relevant section here to understand the context, the exact failure mode, and the rationale behind the proposed fix.

**Key outcome:** Android version = **16** on SM-S901E. Skill `com.android.settings.get-android-version` runs end to end. The path had 5 notable friction points, all documented below.

**Date:** 2026-03-18

---

**Device:** Samsung Galaxy S22 (SM-S901E)
**Result:** Android version **16** (confirmed from raw UI snapshot XML)
**Skill:** `com.android.settings.get-android-version` — runs end to end, first attempt
**Date:** 2026-03-18

---

## 1. Install experience

**Verdict: Smooth, with one real friction point.**

The install path (`curl -fsSL https://clawperator.com/install.sh | bash`) worked cleanly on macOS Darwin arm64. All dependencies (Node 22, adb, curl, git) were auto-detected without prompting. The APK was downloaded and checksummed automatically.

**The friction:** Two devices were connected (physical `<serial_redacted>` + emulator `emulator-5554`). The script correctly aborted the APK install and told me to run `clawperator operator setup --device-id <id>` manually — but there was no friction here because the Operator APK was already installed on the physical device from a prior session. The script didn't detect this; it just stopped at device selection.

**What was missing:** The installer didn't tell me that if the APK is already installed, `doctor --device-id` will just confirm readiness. I had to learn this by running doctor first. A message like *"APK already installed on <serial_redacted> — run doctor to verify"* would have removed that uncertainty.

**Error messages:** Helpful and actionable. The MULTIPLE_DEVICES_DEVICE_ID_REQUIRED code and the exact `--device-id` flag to pass are shown immediately.

---

## 2. Device setup experience

**Verdict: Frictionless when device is already prepared. Zero guidance when it isn't.**

`clawperator doctor --device-id <serial_redacted> --output pretty` produced a clean pass on all 7 checks including handshake. This is the best-case path.

**What wasn't documented upfront:** The `doctor` output says "Ready to use Clawperator" but doesn't tell you what "operator setup" actually does (grant accessibility + notification permissions, install APK, verify handshake). There's no troubleshooting path surfaced when the APK isn't installed yet — you're pointed at a docs URL.

**Recovery:** When setup fails (APK not installed), the error surfaced is `SERVICE_UNAVAILABLE`. The docs reference the error code, but mapping that code to "you need to run `operator setup`" requires reading a separate error-codes page. A direct "did you mean: `clawperator operator setup`?" suggestion in the error output would help.

---

## 3. First contact with the runtime

**Verdict: The learning curve is real but not steep. The main trap is the action payload schema.**

**What was not obvious from the docs:**
The `execute` command's JSON payload structure has nested `params` objects per action. My first attempt used top-level keys on the action object directly (`target`, `selector`, `direction` alongside `id` and `type`) — this failed with `EXECUTION_VALIDATION_FAILED: Unrecognized key(s)`. The error correctly named the offending keys but didn't say *where* they should go.

The fix (`params: { target, direction, ... }`) was obvious in retrospect but required trial and error. The quickstart examples in `llms-full.txt` show the correct structure; I had to fetch docs a second time to find them.

**What required trial and error:**
- `scroll_and_click` vs `scroll_until` — the difference between them (bounded loop vs direct scroll+click) wasn't obvious from names alone
- `scroll_until` with `clickAfter: true` only clicks on `TARGET_FOUND`, not on `EDGE_REACHED` — this is not documented explicitly. I discovered it empirically when the "About phone" element was visible at the bottom of the list but the click never fired because the scroll reached the edge first
- The `matcher` vs `target` naming inconsistency (click uses `matcher`, scroll uses `target`) — this tripped me up in the first `scroll_and_click` attempt

**The result envelope was easy to read** once you understand the structure. `envelope.status` + `stepResults[].success` + `stepResults[].data` is consistent and predictable.

---

## 4. Answering the original question

**Verdict: Achievable but required 6 round-trips due to the click-after-EDGE_REACHED gap.**

The right command was NOT obvious. The natural path would be:
1. Open Settings
2. Execute `scroll_until` with `target: {textContains: "About phone"}` and `clickAfter: true`

This fails silently on Samsung because the list is long enough that the `scroll_until` reaches the edge of the list *while* the target is visible but not the edge termination condition. It scrolled 7 times, hit EDGE_REACHED, and did not click — despite "About phone" being on screen.

**Workaround required:** Separate `scroll_until` (to scroll to bottom) + explicit `click` with `textEquals: "About phone"`. This is two executions instead of one and is non-obvious from the docs.

The output (`read_text` returning "16") was easy to interpret. The raw XML source confirms the node:
```xml
<node text="Android version" resource-id="android:id/title" ... />
<node text="16" resource-id="android:id/summary" ... />
```

**Navigation path actually required (Samsung-specific):**
Settings main → scroll to bottom → click "About phone" → scroll down → click "Software information" → snapshot → read "Android version"

That's 5 round-trips just to get one value. A direct `open_uri` into the Software information deep link (if one exists) would reduce this to 2.

---

## 5. Settings app navigation challenges

**Samsung-specific layout creates a double-nested path that isn't obvious ahead of time.**

Stock Android shows Android version directly on "About phone". Samsung hides it under "About phone > Software information". There is no way to know this without running a snapshot first.

**Where the API helped:**
`scroll_until` with `maxScrolls` prevented infinite loops. `takeSnapshot()` after each navigation step made it possible to inspect the screen state programmatically without guessing.

**Where the API fell short:**
- No direct "read key-value pair from settings screen" primitive. I had to parse XML text nodes manually using index-based adjacency (`texts[idx+1]` after "Android version"). This works but is fragile.
- No `wait_for_package` or `wait_for_activity` action. After clicking an item I had to use `sleep` to wait for the screen to transition, which adds 0.5–1.5s of dead time per click.
- `scroll_until` EDGE_REACHED without click is a behavioral gap: if the target is at the very bottom of the list, the target may be visible when the edge is reached, but the `clickAfter` won't fire.

---

## 6. Agent experience (critical)

**Exploration:** Good. `snapshot_ui` returns clean hierarchy XML. Parsing text nodes with a regex (`text="([^"]+)"`) is trivial. The XML structure is predictable.

**Iteration:** Acceptable. Each round-trip (execute → snapshot → decide) takes 2–5 seconds for a simple flow. For multi-step navigation, this accumulates. A combined "scroll until visible, then wait for stable UI, then snapshot" action would be more efficient.

**Recovery:** Weak. When a `scroll_until` terminates at EDGE_REACHED without clicking, the failure mode is silent. The step reports `success: true` with `termination_reason: EDGE_REACHED` — but the agent has no way to know whether the click happened or not without taking a new snapshot and checking the current package/activity. There is no "did navigation succeed" feedback primitive.

**Where the observe → decide → execute → return loop broke down:**

1. **After click → no navigation confirmation.** Clicking "About phone" returned `success: true`, but whether the app navigated to the About phone sub-screen was only determinable by taking a new snapshot. There's no `wait_for_navigation` or `current_package` check.
2. **scroll_until EDGE_REACHED ≠ failure but also ≠ click.** This ambiguity caused a silent miss on the first navigation attempt.
3. **Snapshot latency after click.** The snapshot immediately following a click captures the pre-navigation state. A `sleep` of 900–1500ms was required before the snapshot to get the post-navigation view. This is undocumented.

---

## 7. Skill creation experience

**Verdict: The file structure was clear; the invocation contract was not documented in one place.**

**What was clear:**
- Directory layout: `skill.json`, `SKILL.md`, `scripts/run.sh` → `run.js`
- Registry entry format (mirrors `skill.json`)
- `runClawperator()` utility in `utils/common.js` does the heavy lifting

**What was unclear:**
- The registry file location is only in `CLAWPERATOR_SKILLS_REGISTRY` env var. If you miss setting this (or the shell doesn't have it), `skills list` silently returns nothing.
- There is no `clawperator skills new <skill_id>` scaffolding command visible in the CLI help. The skill file structure had to be reverse-engineered from an existing skill.
- `skills run` returns a JSON envelope wrapping stdout/stderr/exitCode — this is the runtime contract, but it's not in any docs page. Discovering it required running an existing skill and observing the output.

**Iteration loop:**
The skill ran successfully on the first attempt (15.8s end to end). This was possible because the manual navigation in Phases 3–5 had already mapped the exact UI path. The skill is essentially a scripted replay of the manual navigation with added fallback logic.

**What would have made the iteration loop faster:**
- A `clawperator skills validate <skill_id>` command to check registry entry, file existence, and script syntax before running
- A `--dry-run` flag for `execute` that shows the compiled payload without sending it to the device
- Inline docs for the `run.js` function signature (what args, what env vars, what exit codes)

---

## 8. Documentation quality

**Gaps:**
- The action schema (params structure per action type) is spread across `llms-full.txt` and the agent quickstart page. It's not in a single reference table. I had to fetch docs twice to get the correct parameter names.
- `scroll_until` `clickAfter` behavior on EDGE_REACHED is not documented at all.
- The `snapshot_ui` settle delay requirement (sleep after click before snapshot) is mentioned as a "practical tip" in timeout budgeting but not as a required step in navigation patterns.
- Private skill registration workflow is scattered: creation format is in authoring guidelines, registry path is in env vars doc, `skills run` output format is undocumented.

**Stale/missing cross-links:**
The `reference/actions` URL (404) suggests docs were recently reorganized. Several conceptual links in the agent quickstart point to other pages that returned 404.

**What slowed me down most:**
The `params` nesting error on the first `execute` attempt cost 2 round-trips. The `clickAfter` EDGE_REACHED gap cost 1 additional round-trip and a close read of step results to understand why the click didn't fire.

**Could I have succeeded without internal context that leaked through?**
Yes, but I needed to fetch 4 different docs pages and make 2 invalid API calls before the execution format clicked. A single reference page with all action types and their full param schemas would have eliminated this.

---

## 9. API and CLI gaps

1. **`scroll_until` + `clickAfter: true` does not click on EDGE_REACHED.** This is undocumented and counterintuitive. If the target is visible at the edge of the list, you still have to click it manually.

2. **No `wait_for_navigation` or `assert_package` action.** After clicking a list item that navigates to a new screen, there is no built-in way to confirm the navigation happened. You must: (a) sleep, (b) snapshot, (c) check `foreground_package` or screen title. This is 2 extra round-trips per screen transition.

3. **No `read_key_value_pair` action.** Reading a Settings key-value (label + adjacent summary) requires snapshot + manual XML parsing. A `read_setting_value(labelText)` action that returns the adjacent summary would be extremely useful for Settings-like screens.

4. **`read_text` `validator` is nearly useless.** Only `"temperature"` is supported. Extending this to `"version"`, `"android-version"`, or a regex validator would make extraction much more reliable.

5. **`scroll_and_click` parameter naming inconsistency.** The `target` param name on `scroll_and_click` vs `matcher` on `click` is confusing. They serve the same logical purpose (select a UI node) but use different key names in params.

6. **`clawperator doctor` exits 1 on MULTIPLE_DEVICES even when all named device checks pass.** Running `doctor` without `--device-id` returns exit code 1 even if both devices are healthy. In a CI/CD context this would fail pipelines unnecessarily.

7. **No `clawperator skills new` scaffolding command.** Creating a new skill requires manually replicating file structure from an existing skill.

---

## 10. Determinism vs. reality

**Where determinism held:** Execution payloads were deterministic. Given the same UI state, the same action sequence produced the same result every time. `scroll_until` termination conditions are predictable once you understand EDGE_REACHED semantics. The result envelope structure is fully consistent.

**Where reality diverged:**

- **Timing non-determinism:** The time between a click and the new screen being fully rendered in the accessibility hierarchy varied from ~400ms to ~1200ms. Using a fixed 900ms sleep works for this device but would need tuning for slower devices.
- **Samsung One UI overlay:** The "Software update is available" banner at the top of the Settings main screen is injected dynamically by Samsung. It shifts the list positions but doesn't break `textContains` selectors since those target text content, not position.
- **scroll_until with EDGE_REACHED on last-item target:** The action reported success but effectively missed its target. This is the single biggest gap between "deterministic execution" and actual behavior.

---

## 11. If I were building this

Ranked by impact:

1. **Fix `scroll_until` + `clickAfter: true` on EDGE_REACHED.** If the target is visible when the edge is reached, click it. This single change would eliminate the most common silent failure mode for list navigation.

2. **Add `wait_for_activity` / `assert_foreground_package` action.** Post-click navigation confirmation is the second most common source of fragility. Agents should be able to say "I expect to be in com.android.settings/.AboutPhoneActivity; confirm or fail."

3. **Consolidate action type reference to one docs page.** The current state requires stitching together information from 3+ pages. A single table with all action types, their params, and their result shapes would cut agent onboarding time significantly.

4. **Add `read_key_value_pair(label)` action.** Settings-style screens are a primary use case. This action should be a first-class primitive.

5. **`clawperator skills new <skill_id>` scaffolding.** Low effort, high value for onboarding.

6. **Document `skills run` output envelope.** The `{skillId, output, exitCode, durationMs}` wrapper is not documented anywhere I could find.

7. **Extend `read_text` validators.** Add `"version"` and regex-based validators so extraction can be validated at the primitive level rather than in userland.

8. **Add `--dry-run` to `execute`.** Parsing and validating the payload without sending it to the device would accelerate the iteration loop during skill development.

---

## 12. Final verdict

**Can a cold-start agent succeed end to end with no prior skill knowledge?**
Yes, but only after 2 invalid API calls and 4 doc page fetches to nail the payload schema. The core loop (observe → decide → execute → return) is sound and the result envelope is consistent. The biggest blocker is not the product itself but the scattered, incomplete documentation for the execution payload format.

**What percentage of the way is this product toward being production-ready for autonomous agent workflows?**
~65%. The runtime layer is solid: the handshake, APK install, accessibility grants, snapshot quality, and action primitives are all working. What's missing is polish around:
- deterministic post-click navigation confirmation
- consolidated docs
- the scroll_until + clickAfter EDGE_REACHED gap

**The two or three things that most block production readiness:**

1. **Silent click miss on EDGE_REACHED.** An agent that calls `scroll_until` + `clickAfter` and assumes it navigated will silently be operating on the wrong screen. This is a correctness bug, not a usability issue.

2. **No post-navigation confirmation primitive.** Every screen transition requires a sleep + snapshot + heuristic check. This makes multi-step flows unreliable on slow devices and verbose to write.

3. **Documentation fragmentation for the execution schema.** Until the action reference is in one place, every new agent will spend 2–3 iterations just fixing payload format errors before doing any useful work.
