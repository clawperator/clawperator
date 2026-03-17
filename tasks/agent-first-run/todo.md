# Agent First Run: Task Breakdown

Source: `tasks/agent-first-run/findings.md` (cold-start agent evaluation, 2026-03-18)

Each task is scoped to a single codebase, has a concrete change, and has verifiable acceptance criteria.
Documentation relevant to the change is included in the task — not deferred.
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

## Group A — Android Operator

Requires a new APK build and release. T-01 is a correctness bug and should ship alone as soon as it is ready. T-02 through T-04 can travel together in one release.

---

### T-01 · Fix `scroll_until` + `clickAfter` miss on EDGE_REACHED
**Codebase:** `operator` + `docs`
**Priority:** Blocker

**Problem:**
`scroll_until` with `clickAfter: true` does not click when termination is `EDGE_REACHED`, even if the target node is visible on screen at that moment. Agents using `scroll_until` + `clickAfter` for last-item-in-list targets (e.g. "About phone" in Samsung Settings) silently navigate nowhere.

**Change — operator:**
In the `scroll_until` termination handler, before returning `EDGE_REACHED`, query the accessibility tree for the target matcher. If the node is found and visible: execute the click, set `termination_reason = TARGET_FOUND`, return normally. If not found at the edge, return `EDGE_REACHED` as before. No change to any other termination path.

**Change — docs:**
In the `scroll_until` action reference entry, add an explicit note documenting when `clickAfter` fires: currently only on `TARGET_FOUND`; not on `EDGE_REACHED` or any other termination condition. Include the workaround (follow with an explicit `click` step) for anyone running the old APK. Update this note once T-01 ships to reflect the corrected behavior.

**Acceptance criteria:**
- `scroll_until` with a target that is the last item in a RecyclerView and `clickAfter: true` → click fires, result shows `termination_reason: TARGET_FOUND`.
- `scroll_until` with a genuinely absent target and `clickAfter: true` → no click, `termination_reason: EDGE_REACHED`.
- Existing tests for `TARGET_FOUND` and `MAX_SCROLLS_REACHED` pass unchanged.
- Docs note for `clickAfter` is present and accurate for the shipped behavior.

**Dependencies:** None.

---

### T-02 · Add `wait_for_navigation` action
**Codebase:** `operator` + `docs`
**Priority:** High

**Problem:**
After clicking an item that triggers a screen transition, there is no built-in confirmation primitive. Agents must use a fixed `sleep` (900–1500ms) followed by `snapshot_ui` — slow and unreliable on low-end devices.

**Change — operator:**
Implement action type `wait_for_navigation`:
```
params: {
  expectedPackage?: string,    // poll until foreground package matches
  expectedNode?: NodeMatcher,  // poll until node is present (alternative)
  timeoutMs: number            // required; max 30000
}
```
Poll at ~200ms intervals. On success: `success: true`, `data.resolved_package`, `data.elapsed_ms`. On timeout: `success: false`, `data.error: "NAVIGATION_TIMEOUT"`, `data.last_package`. Require at least one of `expectedPackage` or `expectedNode`; fail validation if both absent.

**Change — docs:**
Add `wait_for_navigation` to the action type reference with full params schema, result shape, and a before/after example showing it replacing a `sleep` + `snapshot_ui` pattern.

**Acceptance criteria:**
- `wait_for_navigation` with correct `expectedPackage` resolves within actual transition time after a click.
- Wrong `expectedPackage` → times out, returns `NAVIGATION_TIMEOUT`.
- Neither param → `EXECUTION_VALIDATION_FAILED`.
- Docs entry exists and matches shipped behavior.

**Dependencies:** T-01 recommended first so click reliably fires before this wait is needed.

---

### T-03 · Add `read_key_value_pair` action
**Codebase:** `operator` + `docs`
**Priority:** High

**Problem:**
Reading a Settings-style label + adjacent value (e.g. `"Android version"` → `"16"`) requires a full `snapshot_ui` then manual XML parsing using index-based adjacency. Fragile and duplicated across every settings-reading skill.

**Change — operator:**
Implement action type `read_key_value_pair`:
```
params: {
  labelMatcher: NodeMatcher  // required
}
```
Find the node matching `labelMatcher`; traverse to the nearest sibling or parent-adjacent node with a non-empty text value and resource-id ending in `/summary` (or OEM equivalent). Return `{ label: string, value: string }`. If no value node found: `success: false`, `data.error: "VALUE_NODE_NOT_FOUND"`.

**Change — docs:**
Add `read_key_value_pair` to the action type reference with params schema, result shape, both error codes (`NODE_NOT_FOUND`, `VALUE_NODE_NOT_FOUND`), and a Settings screen example.

**Acceptance criteria:**
- `read_key_value_pair({labelMatcher: {textEquals: "Android version"}})` on a Samsung Software information screen → `{label: "Android version", value: "16"}`.
- Label not found → `NODE_NOT_FOUND`.
- Label found, no adjacent summary → `VALUE_NODE_NOT_FOUND`.
- Docs entry exists and matches shipped behavior.

**Dependencies:** None.

---

### T-04 · Extend `read_text` validators
**Codebase:** `operator` + `docs`
**Priority:** Medium

**Problem:**
`read_text` supports only `"temperature"` as a validator. An agent reading a version number or other structured value cannot validate the extracted text at the primitive level.

**Change — operator:**
Add two new validator forms:
1. `"validator": "version"` — passes for `/^\d+(\.\d+)*$/` (e.g. `"16"`, `"14.1.2"`).
2. `"validator": "regex"` with `"validatorPattern": "<pattern>"` — compiles and tests the pattern.

On validator failure: `success: false`, `data.error: "VALIDATOR_MISMATCH"`, `data.raw_text: <extracted>`. Invalid regex pattern → `EXECUTION_VALIDATION_FAILED` at parse time.

**Change — docs:**
Update the `read_text` action reference entry to list all supported validators including the new forms, with examples and the `VALIDATOR_MISMATCH` error shape.

**Acceptance criteria:**
- `validator: "version"` on `"16"` → success. On `"Settings"` → `VALIDATOR_MISMATCH` with `raw_text`.
- `validator: "regex"`, `validatorPattern: "^\\d+"` on `"16"` → success.
- Invalid pattern → `EXECUTION_VALIDATION_FAILED`.
- Docs validator table updated.

**Dependencies:** None.

---

## Group B — Node CLI

Node/TypeScript only. No APK change required. Can ship as a single npm release.

---

### T-05 · Fix `doctor` exit code for multi-device ambiguity
**Codebase:** `node` + `docs`
**Priority:** Blocker

**Problem:**
`clawperator doctor` without `--device-id` exits 1 when multiple devices are connected, even if all devices are healthy. Breaks CI preflight checks on developer machines.

**Change — node:**
`MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` is ambiguity, not failure. Change its exit code to 0 (or a new distinct code 2 if preferred). Reserve exit 1 for genuine failures: APK not installed, handshake failed, adb unreachable.

**Change — docs:**
Update the CLI reference entry for `doctor` to document exit code semantics explicitly: 0 = healthy or ambiguous, 1 = genuine failure. Note the multi-device case.

**Acceptance criteria:**
- `doctor` with 2 healthy devices → exits 0, warning to stderr.
- `doctor` with device where APK not installed → exits 1.
- `doctor --device-id <serial>` healthy → exits 0 (unchanged).
- CLI reference documents exit code semantics.

**Dependencies:** None.

---

### T-06 · Add `execute --dry-run` flag
**Codebase:** `node` + `docs`
**Priority:** High

**Problem:**
Payload schema errors only surface after sending to the device. No local validation path exists. The `params` nesting error during the evaluation cost 2 round-trips before the correct structure was found.

**Change — node:**
Add `--dry-run` to `clawperator execute`. When set: parse and validate payload against full action schema, print validated execution plan (commandId, timeoutMs, per-action summary), exit 0 on valid / exit 1 on schema error. No device connection opened.

**Change — docs:**
Add `--dry-run` to the CLI reference `execute` entry with usage example and output format.

**Acceptance criteria:**
- `execute --execution valid.json --dry-run` → prints plan, exits 0, no adb activity.
- `execute --execution invalid.json --dry-run` → prints validation error with offending path, exits 1, no adb activity.
- `--dry-run` works without `--device-id`.
- CLI reference documents the flag.

**Dependencies:** None.

---

### T-07 · Add `skills new` scaffolding command; document `skills run` output envelope
**Codebase:** `node` + `docs`
**Priority:** High

**Problem:**
Creating a new skill requires manually replicating file structure from an existing skill — no `skills new` command exists. Separately: the `{ skillId, output, exitCode, durationMs }` wrapper returned by `skills run` is undocumented; its contract can only be discovered by running an existing skill.

**Change — node:**
Add `clawperator skills new <skill_id> --app <packageId> --intent <intent> [--summary <text>]`. Creates: skill directory, `SKILL.md` with frontmatter + usage stub, `skill.json` with all required fields, `scripts/run.sh` shim, `scripts/run.js` with `runClawperator` boilerplate and `// TODO: implement` stub, registry entry in `CLAWPERATOR_SKILLS_REGISTRY`. Prints created paths and pointer to authoring guide.

**Change — docs:**
1. Add `skills new` to CLI reference with flag documentation.
2. Add `skills run` output schema to the Skills Usage Model page and CLI reference: `{ skillId, output, exitCode, durationMs }` field definitions, that `output` is raw stdout, that stdout conventions are skill-defined not runner-enforced, example of successful and failed run output.

**Acceptance criteria:**
- `skills new com.example.test --app com.example --intent test` creates all files with correct content and a valid registry entry.
- `skills list` shows the new skill immediately.
- `skills run com.example.test --device-id <id>` fails with "not implemented" (not a crash).
- CLI reference documents `skills new` and `skills run` output schema.

**Dependencies:** None.

---

### T-08 · Warn on missing or unset `CLAWPERATOR_SKILLS_REGISTRY`
**Codebase:** `node` + `docs`
**Priority:** Medium

**Problem:**
If `CLAWPERATOR_SKILLS_REGISTRY` is unset or points to a missing file, `skills list` returns empty silently. No signal that the registry is misconfigured vs. genuinely empty.

**Change — node:**
In the registry loader: if env var unset → stderr warning + exit 1. If set but file missing → stderr error + exit 1. Apply to `skills list`, `get`, `search`, `run`.

**Change — docs:**
Add a troubleshooting entry to the Skills Usage Model page: "skills list returns empty — check `CLAWPERATOR_SKILLS_REGISTRY`" with diagnosis steps.

**Acceptance criteria:**
- Env var unset → warning to stderr, exit 1.
- Env var set to missing file → error to stderr, exit 1.
- Valid env var → behavior unchanged.
- Troubleshooting entry exists in docs.

**Dependencies:** None.

---

### T-09 · Normalize `matcher` / `target` param naming; add alias
**Codebase:** `node` + `docs`
**Priority:** Medium

**Problem:**
`click`, `read_text`, `enter_text`, `wait_for_node` use `matcher`. `scroll_and_click` and `scroll_until` use `target`. Same concept, two names. Directly caused schema errors during the evaluation.

**Change — node:**
In schema validation for `scroll_and_click` and `scroll_until`: accept `matcher` as canonical; accept `target` as deprecated alias that passes validation but adds `data.warn: "'target' is deprecated; use 'matcher'"` to the result. Both present → `EXECUTION_VALIDATION_FAILED`.

**Change — docs:**
Update `scroll_and_click` and `scroll_until` entries in the action type reference to show `matcher` as the canonical key. Add a deprecation notice for `target` with migration note.

**Acceptance criteria:**
- `scroll_until` with `matcher` → validates and executes correctly.
- `scroll_until` with `target` → validates, executes, result includes deprecation warning.
- Both present → `EXECUTION_VALIDATION_FAILED`.
- `scroll_and_click` same behavior.
- Docs show `matcher` as canonical.

**Dependencies:** T-06 recommended first so dry-run output reflects canonical name.

---

### T-10 · Emit snapshot settle warning; document settle delay pattern
**Codebase:** `node` + `docs`
**Priority:** Low

**Problem:**
A `snapshot_ui` taken within ~500ms of a preceding `click` captures the pre-navigation UI. This is an undocumented footgun: the agent gets `success: true` with the wrong screen's content. Mentioned only as a "practical tip" in timeout budgeting docs; not in Navigation Patterns.

**Change — node:**
In the execution result post-processor: for each `snapshot_ui` step, if the preceding `click` step completed < 500ms earlier in the same execution, add `data.warn: "snapshot captured <N>ms after preceding click; UI may not have settled — consider adding a sleep step"`. Warning only; does not affect `success` or `status`.

**Change — docs:**
Add a "UI settle delay" section to the Navigation Patterns guide: why it's needed, recommended range (500ms min; 1000–1500ms for OEM/slow devices), the canonical pattern (`sleep` between `click` and `snapshot_ui`), note that the runtime warning (above) surfaces violations automatically.

**Acceptance criteria:**
- `click` → immediate `snapshot_ui` → snapshot step result contains `data.warn`.
- `click` → `sleep 1000ms` → `snapshot_ui` → no warning.
- Navigation Patterns guide contains the settle delay section.

**Dependencies:** None.

---

### T-11 · Add inline recovery hint to `SERVICE_UNAVAILABLE` error
**Codebase:** `node`
**Priority:** Low

**Problem:**
`SERVICE_UNAVAILABLE` (APK not installed) gives no recovery path in the error output. The fix (`operator setup`) is only discoverable via the error-codes docs page.

**Change — node:**
When error code is `SERVICE_UNAVAILABLE` and no receiver package detected on the device, append to error detail: `"Hint: accessibility service not running. Run: clawperator operator setup --device-id <deviceId>"`.

No separate docs change needed — the hint is self-documenting in the output.

**Acceptance criteria:**
- `execute` against a device with no APK → error output contains the `operator setup` hint with the correct `--device-id`.
- Other error codes → no hint appended.

**Dependencies:** None.

---

## Group C — install.sh

### T-12 · Detect already-installed APK during multi-device install; add setup docs
**Codebase:** `install` + `docs`
**Priority:** Medium

**Problem:**
When multiple devices are connected, the installer prints the same "setup required" message regardless of whether any device already has the APK installed. A user whose device is already configured gets the same output as someone who has never set up. The first-time setup docs page has no entry for the multi-device case.

**Change — install:**
After detecting multiple devices, for each serial run `clawperator doctor --device-id <serial> --output json` silently and parse the result. Print per-device status: `✅ <serial> — ready` or `⚠ <serial> — setup required: clawperator operator setup --device-id <serial>`. If all devices ready: print "All devices ready. No setup required."

**Change — docs:**
Add a "Multiple devices connected" troubleshooting section to the first-time setup page: why the installer stops at device selection, how to proceed with `operator setup --device-id`, how to check if a device is already set up (`doctor --device-id`), expected output for each case.

**Acceptance criteria:**
- 2 devices, one with APK installed → installer correctly labels each.
- 2 devices, both ready → "All devices ready."
- 2 devices, neither ready → existing behavior unchanged.
- First-time setup page contains the multi-device troubleshooting section.

**Dependencies:** T-05 (doctor exit code fix) should ship first so the doctor invocation here exits correctly.

---

## Group D — Standalone docs cleanup

These tasks are not tied to a specific feature. They establish foundations that benefit all agent-facing content.

---

### T-13 · Fix broken internal links; add CI link check
**Codebase:** `docs`
**Priority:** High — do before T-14

**Problem:**
`reference/actions` is a 404. Several links in the agent quickstart return 404. Recent docs reorganization left dead links in agent-facing pages.

**Change:**
1. Audit all internal links in `ai-agents/` and `reference/` sections.
2. Fix or redirect each 404.
3. Add a CI check (e.g. `lychee`) that fails the docs build on broken internal links going forward.

**Acceptance criteria:**
- All internal links in `ai-agents/` and `reference/` return 200.
- CI check runs on docs PRs.

**Dependencies:** None.

---

### T-14 · Create single canonical action type reference page
**Codebase:** `docs`
**Priority:** High — do after Group A ships

**Problem:**
The action params schema is spread across `llms-full.txt`, the agent quickstart, and the Node API guide. A new agent needs to fetch 4 pages and make 2 failed API calls before the payload structure is clear.

**Change:**
Create `reference/action-types/` as a single page covering all action types (including new ones from T-02, T-03, T-04): full params schema, result data shape, minimal example payload per type. Cross-link from agent quickstart, `llms-full.txt`, navigation patterns guide. Redirect the stale `reference/actions` URL to this page.

**Acceptance criteria:**
- All action types documented with params, result shape, example.
- Page reachable at a stable URL.
- Agent quickstart, `llms-full.txt`, and navigation patterns each link to it.
- `reference/actions` redirects here.

**Dependencies:** T-13. Best done after Group A (T-02, T-03, T-04) ships so new action types are included from the start. T-09 should ship first so `matcher` is shown as canonical throughout.

---

## Dependency summary

```
T-01 ──────────────────────────────► T-02 (recommended before, not hard gate)
T-05 ──────────────────────────────► T-12
T-06 ──────────────────────────────► T-09 (dry-run output reflects canonical name)
T-13 ──────────────────────────────► T-14
T-02, T-03, T-04 (shipped) ────────► T-14 (covers complete action set)
T-09 (shipped) ────────────────────► T-14 (documents matcher as canonical)
T-01 (shipped) ────────────────────► update T-01 docs note re: clickAfter behavior
```

All other tasks are independent.
