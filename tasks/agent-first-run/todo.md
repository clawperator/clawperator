# Agent First Run: Task Breakdown

Source: `tasks/agent-first-run/findings.md` (cold-start agent evaluation, 2026-03-18)

Each task is scoped to a single codebase, has a concrete change, and has verifiable acceptance criteria.
Tasks are ordered so that dependencies are satisfied top-to-bottom within each group.

---

## Codebase index

| Ref | Codebase | Notes |
|-----|----------|-------|
| `operator` | Android Operator APK | Kotlin; accessibility service; action handlers |
| `node` | Node CLI / API | TypeScript; `clawperator` binary; schema validation |
| `install` | install.sh | Bash; hosted at clawperator.com/install.sh |
| `docs` | Docs site | Markdown; hosted at docs.clawperator.com |

---

## Group A — Android Operator: correctness and new primitives

Tasks in this group require a new APK build and release. Ship together where possible to justify one release cycle. T-01 is the exception — it is a correctness bug and should ship alone as soon as it is ready.

---

### T-01 · Fix `scroll_until` + `clickAfter` miss on EDGE_REACHED
**Codebase:** `operator`
**Priority:** Blocker

**Problem:**
`scroll_until` with `clickAfter: true` does not click when termination is `EDGE_REACHED`, even if the target node is visible on screen at that moment. This causes silent navigation failures when the target item sits at the very bottom of a scrollable list — the most common real-world case (e.g. "About phone" in Samsung Settings).

**Change:**
In the `scroll_until` termination handler, before setting `termination_reason = EDGE_REACHED` and returning, query the accessibility tree for the target matcher. If the node is found and visible:
- Execute the click.
- Set `termination_reason = TARGET_FOUND`.
- Return normally.

If the node is not found at the edge, return `EDGE_REACHED` as before. No change to any other termination path.

**Acceptance criteria:**
- `scroll_until` with a target that is the last item in a RecyclerView and `clickAfter: true` → click fires, result shows `termination_reason: TARGET_FOUND`.
- `scroll_until` with a target that is genuinely absent and `clickAfter: true` → no click, result shows `termination_reason: EDGE_REACHED`.
- Existing tests for `TARGET_FOUND` and `MAX_SCROLLS_REACHED` pass unchanged.

**Dependencies:** None.

---

### T-02 · Add `wait_for_navigation` action
**Codebase:** `operator`
**Priority:** High

**Problem:**
After clicking a list item that triggers a screen transition, there is no built-in way to confirm the navigation happened. Agents must use a fixed `sleep` (900–1500ms) followed by a `snapshot_ui`, which is both slow and unreliable on low-end devices.

**Change:**
Implement a new action type `wait_for_navigation` with params:
```
{
  expectedPackage?: string,   // poll until foreground package matches
  expectedNode?: NodeMatcher, // poll until this node is present (alternative to package)
  timeoutMs: number           // required; max 30000
}
```
Poll the accessibility tree at ~200ms intervals. On success: `success: true`, `data.resolved_package: <string>`, `data.elapsed_ms: <number>`. On timeout: `success: false`, `data.error: "NAVIGATION_TIMEOUT"`, `data.last_package: <string>`.

At least one of `expectedPackage` or `expectedNode` is required; fail validation if both are absent.

**Acceptance criteria:**
- After clicking an item that navigates to a new Activity, `wait_for_navigation` with correct `expectedPackage` resolves within actual transition time (not a fixed sleep).
- With wrong `expectedPackage`, times out and returns `NAVIGATION_TIMEOUT`.
- With neither param, returns `EXECUTION_VALIDATION_FAILED`.

**Dependencies:** T-01 recommended first so click reliably fires before this wait is needed.

---

### T-03 · Add `read_key_value_pair` action
**Codebase:** `operator`
**Priority:** High

**Problem:**
Reading a label + adjacent value from a Settings-style list (e.g. `"Android version"` → `"16"`) requires a full `snapshot_ui` followed by manual XML parsing with index-based adjacency. This is fragile and duplicated across every settings-reading skill.

**Change:**
Implement a new action type `read_key_value_pair` with params:
```
{
  labelMatcher: NodeMatcher  // required; matches the label node
}
```
Implementation: find the node matching `labelMatcher`; traverse to the nearest sibling or parent-adjacent node that carries a non-empty text value and has a resource-id ending in `/summary` or equivalent OEM pattern. Return:
```
{
  label: string,
  value: string
}
```
If no value node is found adjacent to the label: `success: false`, `data.error: "VALUE_NODE_NOT_FOUND"`.

**Acceptance criteria:**
- On a Samsung Settings Software information screen: `read_key_value_pair({labelMatcher: {textEquals: "Android version"}})` → `{label: "Android version", value: "16"}`.
- Label not found → `NODE_NOT_FOUND`.
- Label found but no adjacent summary → `VALUE_NODE_NOT_FOUND`.

**Dependencies:** None.

---

### T-04 · Extend `read_text` validators
**Codebase:** `operator`
**Priority:** Medium

**Problem:**
`read_text` supports only `"temperature"` as a validator. An agent reading a version number, IP address, or other structured value has no way to validate the extracted text at the primitive level.

**Change:**
Add two new validator forms:
1. `"validator": "version"` — passes for strings matching `/^\d+(\.\d+)*$/` (e.g. `"16"`, `"14.1.2"`). Fails for anything else.
2. `"validator": "regex"` combined with `"validatorPattern": "<pattern>"` — compiles the pattern and tests the extracted text against it.

On validator failure: `success: false`, `data.error: "VALIDATOR_MISMATCH"`, `data.raw_text: <extracted string>` so the agent can inspect the actual value.

**Acceptance criteria:**
- `read_text` with `validator: "version"` on a node containing `"16"` → `success: true`, `data.text: "16"`.
- Same on a node containing `"Settings"` → `success: false`, `data.error: "VALIDATOR_MISMATCH"`, `data.raw_text: "Settings"`.
- `validator: "regex"`, `validatorPattern: "^\\d+"` on `"16"` → `success: true`.
- Invalid regex pattern → `EXECUTION_VALIDATION_FAILED` at payload parse time.

**Dependencies:** None.

---

## Group B — Node CLI: correctness and new commands

Tasks in this group are Node/TypeScript only. No APK change required. Can ship as a single npm release.

---

### T-05 · Fix `doctor` exit code for multi-device ambiguity
**Codebase:** `node`
**Priority:** Blocker

**Problem:**
`clawperator doctor` without `--device-id` when multiple devices are connected exits 1 (`MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`), even when all devices are healthy. This breaks CI pipelines that run doctor as a preflight check on developer machines.

**Change:**
`MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` is an ambiguity condition, not a failure. Change the exit code for this specific case to 0 (or introduce exit code 2 as "ambiguous/requires action" if a distinct code is preferred). The existing exit 1 path should be reserved for genuine failures: APK not installed, handshake failed, adb unreachable.

**Acceptance criteria:**
- `clawperator doctor` with 2 healthy connected devices → exits 0, warning message printed to stderr.
- `clawperator doctor` with 1 device where APK is not installed → exits 1.
- `clawperator doctor --device-id <serial>` with healthy device → exits 0 (unchanged).

**Dependencies:** None.

---

### T-06 · Add `execute --dry-run` flag
**Codebase:** `node`
**Priority:** High

**Problem:**
Validating a JSON execution payload requires sending it to the device. A payload with a schema error (wrong key name, missing required field) only fails after the device receives it. There is no local validation path.

**Change:**
Add `--dry-run` to `clawperator execute`. When set:
1. Parse and validate the payload against the full action schema.
2. Print the validated execution plan: commandId, timeoutMs, and per-action summary (id, type, key params).
3. Exit 0 on valid payload, exit 1 on schema error with the validation error details.
4. Do not open any device connection.

**Acceptance criteria:**
- `clawperator execute --execution valid.json --dry-run` → prints plan, exits 0, no adb activity.
- `clawperator execute --execution invalid.json --dry-run` (e.g. action with wrong param key) → prints validation error with the offending path (same format as `EXECUTION_VALIDATION_FAILED`), exits 1, no adb activity.
- `--dry-run` without `--device-id` works (no device required).

**Dependencies:** None.

---

### T-07 · Add `skills new` scaffolding command
**Codebase:** `node`
**Priority:** High

**Problem:**
Creating a new skill requires manually replicating file structure from an existing skill. There is no `skills new` command. The invocation contract (args, env vars, exit codes) is only learned by reading another skill's source.

**Change:**
Add `clawperator skills new <skill_id> --app <packageId> --intent <intent> [--summary <text>]`:
1. Create `<skills_root>/<skill_id>/` directory.
2. Write `SKILL.md` with frontmatter (`name`, `description`) and usage stub.
3. Write `skill.json` with all required fields populated from flags.
4. Write `scripts/run.sh` (bash shim: `node "$DIR/run.js" "$@"`).
5. Write `scripts/run.js` with the standard `runClawperator` boilerplate, device arg parsing, and a `// TODO: implement` stub for the execution payload.
6. Append the entry to `CLAWPERATOR_SKILLS_REGISTRY`.
7. Print the created paths and a pointer to the authoring guide.

**Acceptance criteria:**
- `clawperator skills new com.example.test-skill --app com.example --intent test` creates all 4 files with correct content and a valid registry entry.
- `clawperator skills list` shows the new skill immediately after.
- `clawperator skills run com.example.test-skill --device-id <id>` fails with a clear "not implemented" message from the stub (not a runtime crash).

**Dependencies:** None.

---

### T-08 · Warn on missing or unset `CLAWPERATOR_SKILLS_REGISTRY`
**Codebase:** `node`
**Priority:** Medium

**Problem:**
If `CLAWPERATOR_SKILLS_REGISTRY` is not set or points to a missing file, `clawperator skills list` returns empty with no error. The user has no signal that the registry is misconfigured vs. genuinely empty.

**Change:**
In the skills registry loader:
- If `CLAWPERATOR_SKILLS_REGISTRY` is unset: print to stderr `"warning: CLAWPERATOR_SKILLS_REGISTRY is not set; no skills loaded. Set this variable to the path of your skills-registry.json."` Exit 1.
- If set but the file does not exist: print `"error: CLAWPERATOR_SKILLS_REGISTRY points to a missing file: <path>"`. Exit 1.
- Apply to `skills list`, `skills get`, `skills search`, and `skills run`.

**Acceptance criteria:**
- `CLAWPERATOR_SKILLS_REGISTRY` unset → warning to stderr, exit 1.
- `CLAWPERATOR_SKILLS_REGISTRY` set to nonexistent path → error to stderr, exit 1.
- `CLAWPERATOR_SKILLS_REGISTRY` set and valid → behavior unchanged.

**Dependencies:** None.

---

### T-09 · Normalize `matcher` / `target` param naming; add alias
**Codebase:** `node`
**Priority:** Medium

**Problem:**
`click`, `read_text`, `enter_text`, and `wait_for_node` use `matcher` for the node selector. `scroll_and_click` and `scroll_until` use `target`. Same concept, two different key names. This is the proximate cause of payload schema errors during the evaluation.

**Change:**
In the action schema validation layer for `scroll_and_click` and `scroll_until`:
- Accept `matcher` as the canonical key (same as click/read_text).
- Accept `target` as a deprecated alias — pass validation but emit a schema-level warning in the execution result: `"data.warn: "'target' is deprecated; use 'matcher'"`.
- Update generated docs and `--dry-run` output (T-06) to show `matcher`.

**Acceptance criteria:**
- `scroll_until` payload using `matcher` → validates and executes correctly.
- `scroll_until` payload using `target` → validates, executes correctly, result includes deprecation warning.
- `scroll_until` payload using both → `EXECUTION_VALIDATION_FAILED` (ambiguous).
- `scroll_and_click` same behavior.

**Dependencies:** T-06 recommended first so dry-run output reflects the canonical name.

---

### T-10 · Emit snapshot settle warning when `snapshot_ui` immediately follows `click`
**Codebase:** `node`
**Priority:** Low

**Problem:**
A `snapshot_ui` taken within ~500ms of a preceding `click` step captures the pre-navigation UI state. This is an undocumented footgun. The agent gets a successful snapshot of the wrong screen.

**Change:**
In the execution result post-processor, after execution completes: for each `snapshot_ui` step, check the elapsed time since the most recent preceding `click` step in the same execution. If < 500ms, add to the step result: `data.warn: "snapshot captured <N>ms after preceding click; UI may not have settled — consider adding a sleep step"`.

This is a warning only; it does not change `success` or `status`.

**Acceptance criteria:**
- Execution with `click` → immediate `snapshot_ui` (no sleep between) → snapshot step result contains `data.warn`.
- Execution with `click` → `sleep 1000ms` → `snapshot_ui` → no warning.
- Warning does not affect `success: true` on the snapshot step.

**Dependencies:** None.

---

### T-11 · Add inline recovery hint to `SERVICE_UNAVAILABLE` error output
**Codebase:** `node`
**Priority:** Low

**Problem:**
When the APK is not installed, the runtime returns `SERVICE_UNAVAILABLE`. The correct fix is `clawperator operator setup`, but this is only discoverable via the error-codes docs page. The error output itself gives no recovery path.

**Change:**
In the error formatting layer: when the error code is `SERVICE_UNAVAILABLE` and no receiver package is detected on the target device, append to the error detail: `"Hint: the accessibility service is not running. Run: clawperator operator setup --device-id <deviceId>"`.

**Acceptance criteria:**
- `clawperator execute` against a device with no APK installed → error output contains the `operator setup` hint with the correct `--device-id` value.
- Other error codes → no hint appended.

**Dependencies:** None.

---

## Group C — install.sh: multi-device awareness

### T-12 · Detect already-installed APK during multi-device install
**Codebase:** `install`
**Priority:** Medium

**Problem:**
When multiple devices are connected, the installer prints a generic "setup required" message for all of them. It does not check which devices already have the APK installed, so a user whose device is already configured sees the same message as someone who has never set up.

**Change:**
After detecting multiple devices, for each device serial run `clawperator doctor --device-id <serial> --output json` silently and parse the result. For devices where all critical checks pass: print `"✅ <serial> — Operator already installed and ready."` For devices where the APK check fails: print the existing setup instruction. If all devices are ready: print "All devices ready. No setup required."

**Acceptance criteria:**
- With 2 devices, one with APK installed and one without: installer correctly identifies which is ready and which needs setup.
- With 2 devices, both ready: installer prints "All devices ready."
- With 2 devices, neither ready: existing behavior unchanged.

**Dependencies:** T-05 (doctor exit code fix) should ship first so the doctor invocation here exits correctly.

---

## Group D — Docs

Documentation tasks. Should follow Group A and B so the reference material reflects the corrected and extended API.

---

### T-13 · Fix broken internal links
**Codebase:** `docs`
**Priority:** High (do first; establishes clean baseline for all other doc work)

**Problem:**
`reference/actions` returns 404. Several links in the agent quickstart return 404. Recent reorganization left dead links in agent-facing pages.

**Change:**
1. Audit all internal links in `ai-agents/` and `reference/` sections.
2. Fix or redirect each 404 to the correct current URL.
3. Add a CI check (e.g. `lychee` or `linkcheck`) that fails the docs build on broken internal links.

**Acceptance criteria:**
- All internal links in `ai-agents/` and `reference/` return 200.
- CI check runs on docs PRs and catches new broken links.

**Dependencies:** None.

---

### T-14 · Create single canonical action type reference page
**Codebase:** `docs`
**Priority:** High

**Problem:**
The action params schema is spread across `llms-full.txt`, the agent quickstart, and the Node API guide. A new agent author needs to fetch 4 pages and make 2 invalid API calls before the correct payload structure is clear. `reference/actions` is a 404.

**Change:**
Create `reference/action-types/` as a single page with, for each of the ~14 action types:
- Action type name
- Full params schema (key, type, required/optional, description)
- Result data shape (key, type, description)
- Minimal working example payload

Cross-link from: agent quickstart, `llms-full.txt`, navigation patterns guide.
Remove or redirect the stale `reference/actions` URL to this page.

**Acceptance criteria:**
- All 14 action types are documented with params, result shape, and example.
- Page is reachable at a stable URL.
- Agent quickstart, llms-full.txt, and navigation patterns each link to it.
- `reference/actions` redirects to the new page (no more 404).

**Dependencies:** T-13 (link audit) first. T-09 (matcher normalization) should ship before this so the page documents `matcher` as canonical.

---

### T-15 · Document `scroll_until` `clickAfter` semantics
**Codebase:** `docs`
**Priority:** High

**Problem:**
`clickAfter` on `scroll_until` fires only on `TARGET_FOUND`, not on `EDGE_REACHED`. This is undocumented. Every new agent author discovers it the hard way.

**Change:**
In the action type reference (T-14) and in any existing `scroll_until` content, add an explicit note:
> "`clickAfter` fires only when `termination_reason` is `TARGET_FOUND`. It does not fire on `EDGE_REACHED` or any other termination condition. If the target may sit at the very bottom of the list, follow `scroll_until` with an explicit `click` step as a fallback."

After T-01 ships, update this note to reflect the new behavior (target visible at EDGE_REACHED → click fires).

**Acceptance criteria:**
- Action type reference page for `scroll_until` explicitly documents when `clickAfter` fires.
- Includes the workaround (explicit `click` fallback) until T-01 ships.

**Dependencies:** T-14. Update required after T-01.

---

### T-16 · Document snapshot settle delay in Navigation Patterns guide
**Codebase:** `docs`
**Priority:** Medium

**Problem:**
The UI settle delay required between a `click` and a subsequent `snapshot_ui` is mentioned only as a "practical tip" in the timeout budgeting docs. It is not in the navigation patterns guide and is not presented as a required step.

**Change:**
Add a "UI settle delay" section to the Navigation Patterns guide covering:
- Why it's needed (accessibility hierarchy lags behind visual rendering)
- Recommended range: 500ms minimum, 1000–1500ms for slower/OEM devices
- Pattern: always insert `{ type: "sleep", params: { durationMs: 1000 } }` between a `click` and the next `snapshot_ui`
- Note that T-10 (runtime warning) will surface violations automatically once shipped

**Acceptance criteria:**
- Navigation Patterns guide contains a dedicated section on settle delay.
- Recommended delay values are explicit and attributed to a rationale (not just "add a sleep").

**Dependencies:** T-13.

---

### T-17 · Document `skills run` output envelope
**Codebase:** `docs`
**Priority:** Medium

**Problem:**
The `{ skillId, output, exitCode, durationMs }` JSON wrapper returned by `clawperator skills run` is not documented anywhere. An agent invoking a skill and parsing its output must discover this by running an existing skill.

**Change:**
Add the `skills run` output schema to the Skills Usage Model page and the CLI reference. Cover:
- The JSON wrapper fields and types
- That `output` is the raw stdout of the skill script
- That `exitCode` reflects the script's exit code (0 = success)
- That stdout conventions (e.g. `RESULT|status=success|...`) are skill-defined, not enforced by the runner
- Example output from a successful and a failed run

**Acceptance criteria:**
- Skills usage model page documents the `skills run` output schema.
- CLI reference documents `skills run` output format.

**Dependencies:** T-13.

---

### T-18 · Document multi-device installer scenarios
**Codebase:** `docs`
**Priority:** Low

**Problem:**
The first-time setup page has no entry for the case where multiple devices are connected. Users with a phone + emulator encounter the multi-device warning with no docs guidance.

**Change:**
Add a "Multiple devices connected" section to the first-time setup troubleshooting page covering:
- Why the installer stops at device selection
- How to proceed with `operator setup --device-id`
- How to check if a device is already set up (`doctor --device-id`)
- The expected output when one device is ready and one isn't

**Acceptance criteria:**
- First-time setup page contains a "Multiple devices" troubleshooting entry.
- Entry covers both the "never set up" and "already set up on one device" cases.

**Dependencies:** T-13.

---

## Dependency summary

```
T-01 ──────────────────────────────────────────► T-02 (ship before, not required)
T-05 ──────────────────────────────────────────► T-12
T-06 ──────────────────────────────────────────► T-09 (dry-run output shows canonical names)
T-13 ──► T-14 ──► T-15
T-13 ──► T-16
T-13 ──► T-17
T-13 ──► T-18
T-01 (shipped) ──► update T-15 note
T-09 (shipped) ──► T-14 reflects canonical param names
```

All other tasks are independent.
