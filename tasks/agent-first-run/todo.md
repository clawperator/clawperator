# Agent First Run: Task Breakdown

Source: `tasks/agent-first-run/findings.md` (cold-start agent evaluation, 2026-03-18)

Each task is scoped to a single codebase, has a concrete change, and verifiable acceptance criteria.
Documentation relevant to the change is included in the task — not deferred.

---

## Codebase index

| Ref | Codebase | Notes |
|-----|----------|-------|
| `operator` | Android Operator APK | Kotlin; accessibility service; action handlers |
| `node` | Node CLI / API | TypeScript; `clawperator` binary; schema validation |
| `install` | install.sh | Bash; hosted at clawperator.com/install.sh |
| `docs` | Docs site | Markdown; hosted at docs.clawperator.com |

---

## PR plan

| PR | Tasks | Codebases | Rationale |
|----|-------|-----------|-----------|
| [DONE] PR-1 | T-01 | `operator` + `docs` | Correctness bug; ship fast and alone |
| [DONE] PR-2 | T-02, T-03, T-04 | `operator` + `docs` | New action primitives; one APK release |
| [DONE] PR-3 | T-05, T-08, T-10, T-11 | `node` + `docs` | Small, independent diagnostics and warning fixes |
| PR-4 | T-06, T-09 | `node` + `docs` | Payload authoring ergonomics; T-09 dry-run output benefits from T-06 |
| PR-5 | T-07 | `node` + `docs` | Skills scaffolding; substantial enough to stand alone |
| [DONE] PR-6 | T-12 | `install` + `docs` | Installer multi-device awareness |
| PR-7 | T-13, T-14 | `docs` | Link cleanup + action reference page; both docs-only, do together |

**Ordering constraints:**
- PR-1 before PR-2 (T-01 fixes the click that T-02 waits on)
- PR-3 before PR-6 (T-12 calls `doctor`; T-05 fixes its exit code)
- PR-2 before PR-7 (reference page should include the new action types)
- PR-4 before PR-7 (reference page should show `matcher` as canonical from the start)
- All other PRs are independent and can be parallelised

---

## PR-1 — `scroll_until` correctness fix
**Tasks:** T-01 | **Codebases:** `operator` + `docs`

Isolated because this is a correctness bug. Reviewers need to verify the termination logic change precisely; bundling with new features would obscure the diff and make bisection harder if a regression surfaces.

---

### [DONE] T-01 · Fix `scroll_until` + `clickAfter` miss on EDGE_REACHED
**Priority:** Blocker

**Problem:**
`scroll_until` with `clickAfter: true` does not click when termination is `EDGE_REACHED`, even if the target node is visible on screen at that moment. Agents using `scroll_until` + `clickAfter` for last-item-in-list targets (e.g. "About phone" in Samsung Settings) silently navigate nowhere.

**Change — operator:**
In the `scroll_until` termination handler, before returning `EDGE_REACHED`, query the accessibility tree for the target matcher. If the node is found and visible: execute the click, set `termination_reason = TARGET_FOUND`, return normally. If not found at the edge, return `EDGE_REACHED` as before. No change to any other termination path.

**Change — docs:**
In the `scroll_until` action reference entry, add an explicit note documenting when `clickAfter` fires: currently only on `TARGET_FOUND`; not on `EDGE_REACHED` or any other termination condition. Include the workaround (follow with an explicit `click` step) as a safety net for anyone running an older APK. Update this note once this PR ships.

**Acceptance criteria:**
- `scroll_until` with a target that is the last item in a RecyclerView and `clickAfter: true` → click fires, result shows `termination_reason: TARGET_FOUND`.
- `scroll_until` with a genuinely absent target and `clickAfter: true` → no click, `termination_reason: EDGE_REACHED`.
- Existing tests for `TARGET_FOUND` and `MAX_SCROLLS_REACHED` pass unchanged.
- Docs note for `clickAfter` is present and accurate for the shipped behavior.

**Note — companion issue (`tasks/api/scroll/todo.md` item 2):**
The scroll task file identifies a related but distinct issue: when a container disappears mid-loop (e.g. the RecyclerView is replaced during a settings navigation), the current implementation returns `EDGE_REACHED` when the correct reason is `CONTAINER_LOST`. This needs to be resolved in the same PR, because the corrected `clickAfter` logic must distinguish "edge reached with target visible" from "container disappeared" — conflating them would cause a false click. Implementors must read `tasks/api/scroll/todo.md` before starting T-01 and treat `CONTAINER_LOST` as in-scope for this PR.

**Dependencies:** None.

---

## PR-2 — New operator action primitives
**Tasks:** T-02, T-03, T-04 | **Codebases:** `operator` + `docs`

All three are additive new action types with no behavior change risk to existing actions. Same implementation pattern (new handler + schema entry + docs). Traveling together justifies one APK release and one reviewer context-load.

---

### [DONE] T-02 · Add `wait_for_navigation` action
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

**Dependencies:** PR-1 recommended first so click reliably fires before this wait is needed.

---

### [DONE] T-03 · Add `read_key_value_pair` action
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

### [DONE] T-04 · Extend `read_text` validators
**Priority:** Medium

**Problem:**
`read_text` supports only `"temperature"` as a validator. An agent reading a version number or other structured value cannot validate the extracted text at the primitive level.

**Change — operator:**
Add two new validator forms:
1. `"validator": "version"` — passes for `/^\d+(\.\d+)*$/` (e.g. `"16"`, `"14.1.2"`).
2. `"validator": "regex"` with `"validatorPattern": "<pattern>"` — compiles and tests the pattern against extracted text.

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

## PR-3 — CLI diagnostics and warnings
**Tasks:** T-05, T-08, T-10, T-11 | **Codebases:** `node` + `docs`

Four small, independent changes that all make the CLI surface better information when something is wrong or ambiguous. None changes execution behavior. Coherent review story: "better error messages and diagnostics."

---

### [DONE] T-05 · Fix `doctor` exit code for multi-device ambiguity
**Priority:** Blocker

**Problem:**
`clawperator doctor` without `--device-id` exits 1 when multiple devices are connected, even if all devices are healthy. Breaks CI preflight checks on developer machines.

**Change — node:**
`MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` is ambiguity, not failure. Change its exit code to 0 (or introduce exit code 2 as "ambiguous/requires action" if a distinct code is preferred). Reserve exit 1 for genuine failures: APK not installed, handshake failed, adb unreachable.

**Change — docs:**
Update the CLI reference entry for `doctor` to document exit code semantics explicitly: 0 = healthy or ambiguous, 1 = genuine failure. Note the multi-device case.

**Acceptance criteria:**
- `doctor` with 2 healthy devices → exits 0, warning to stderr.
- `doctor` with device where APK not installed → exits 1.
- `doctor --device-id <serial>` healthy → exits 0 (unchanged).
- CLI reference documents exit code semantics.

**Dependencies:** None.

---

### [DONE] T-08 · Warn on missing or unset `CLAWPERATOR_SKILLS_REGISTRY`
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

### [DONE] T-10 · Emit snapshot settle warning; document settle delay pattern
**Priority:** Low

**Problem:**
A `snapshot_ui` taken within ~500ms of a preceding `click` captures the pre-navigation UI — the agent gets `success: true` with the wrong screen's content. Currently mentioned only as a "practical tip" in timeout budgeting docs; not called out in Navigation Patterns as a required step.

**Change — node:**
In the execution result post-processor: for each `snapshot_ui` step, if the preceding `click` step in the same execution completed < 500ms earlier, add `data.warn: "snapshot captured <N>ms after preceding click; UI may not have settled — consider adding a sleep step"`. Warning only; does not affect `success` or `status`.

**Change — docs:**
Add a "UI settle delay" section to the Navigation Patterns guide: why it's needed (accessibility hierarchy lags visual rendering), recommended range (500ms min; 1000–1500ms for OEM/slow devices), the canonical pattern (`sleep` between `click` and `snapshot_ui`), and note that the runtime warning above surfaces violations automatically.

**Acceptance criteria:**
- `click` → immediate `snapshot_ui` → snapshot step result contains `data.warn`.
- `click` → `sleep 1000ms` → `snapshot_ui` → no warning.
- Navigation Patterns guide contains the settle delay section.

**Dependencies:** None.

---

### [DONE] T-11 · Add inline recovery hint to `SERVICE_UNAVAILABLE` error
**Priority:** Low

**Problem:**
`SERVICE_UNAVAILABLE` (APK not installed) gives no recovery path in the error output. The fix (`operator setup`) is only discoverable via the error-codes docs page.

**Change — node:**
When error code is `SERVICE_UNAVAILABLE` and no receiver package is detected on the device, append to error detail: `"Hint: accessibility service not running. Run: clawperator operator setup --device-id <deviceId>"`. No separate docs change needed — the hint is self-documenting in the output.

**Acceptance criteria:**
- `execute` against a device with no APK → error output contains the `operator setup` hint with the correct `--device-id`.
- Other error codes → no hint appended.

**Dependencies:** None.

---

## PR-4 — Payload authoring ergonomics
**Tasks:** T-06, T-09 | **Codebases:** `node` + `docs`

Dry-run and param naming normalization are both about making it easier to write correct payloads without round-tripping to the device. T-09 benefits from T-06 shipping in the same PR: the dry-run output should show `matcher` as canonical from the first release.

---

### [DONE] T-06 · Add `execute --dry-run` flag
**Priority:** High

**Problem:**
Payload schema errors only surface after sending to the device. No local validation path exists. The `params` nesting error during the evaluation cost 2 round-trips before the correct structure was found.

**Change — node:**
Add `--dry-run` to `clawperator execute`. When set: parse and validate payload against full action schema, print validated execution plan (commandId, timeoutMs, per-action summary with id, type, key params), exit 0 on valid / exit 1 on schema error with offending path. No device connection opened.

**Change — docs:**
Add `--dry-run` to the CLI reference `execute` entry with usage example and output format.

**Acceptance criteria:**
- `execute --execution valid.json --dry-run` → prints plan, exits 0, no adb activity.
- `execute --execution invalid.json --dry-run` → prints validation error with offending path, exits 1, no adb activity.
- `--dry-run` works without `--device-id`.
- CLI reference documents the flag.

**Dependencies:** None.

---

### [DONE] T-09 · Standardize on `matcher` param for all node-matching actions
**Priority:** Medium

**Problem:**
`click`, `read_text`, `enter_text`, `wait_for_node` use `matcher`. `scroll_and_click` and `scroll_until` use `target`. Same concept, two key names. Directly caused schema errors during the evaluation.

**Decision — clean break (pre-alpha):**
Since Clawperator is pre-alpha with no external users, we made a **breaking change** rather than maintaining backward compatibility. The `target` param has been **removed entirely**. All actions now consistently use `matcher` for node selection.

**Change — node + android:**
- `scroll_and_click` and `scroll_until` now require `matcher` (was `target`)
- Payloads using `target` will fail validation with `EXECUTION_VALIDATION_FAILED`
- The Node layer no longer performs any normalization; Android receives `matcher` directly

**Change — docs:**
Update `scroll_and_click` and `scroll_until` entries to show `matcher` as the only valid param. No mention of `target` (no deprecation notice - the param is gone).

**Migration for existing code:**
Replace `target: { ... }` with `matcher: { ... }` in all `scroll_and_click` and `scroll_until` actions.

**Acceptance criteria:**
- `scroll_until` with `matcher` → validates and executes correctly on Android.
- `scroll_until` with `target` → validation fails (`EXECUTION_VALIDATION_FAILED`).
- `scroll_and_click` same behavior.
- All six node-matching actions use consistent `matcher` naming.
- Docs show only `matcher` as valid param.

**Dependencies:** T-06 in the same PR so dry-run output reflects canonical name from day one.

---

## PR-5 — Skills scaffolding
**Tasks:** T-07 | **Codebases:** `node` + `docs`

Substantial enough to stand alone: new CLI command, file templates, registry mutation, and two docs sections. Bundling with other changes would make the PR harder to review and harder to revert if the scaffolding output needs iteration.

---

### T-07 · Add `skills new` scaffolding command; document `skills run` output envelope
**Priority:** High

**Problem:**
Creating a new skill requires manually replicating file structure from an existing skill — no `skills new` command exists. Separately, the `{ skillId, output, exitCode, durationMs }` wrapper returned by `skills run` is undocumented and can only be discovered by running an existing skill.

**Change — node:**
Add `clawperator skills new <skill_id> --app <packageId> --intent <intent> [--summary <text>]`. Creates: skill directory, `SKILL.md` with frontmatter + usage stub, `skill.json` with all required fields, `scripts/run.sh` shim, `scripts/run.js` with `runClawperator` boilerplate and `// TODO: implement` stub, registry entry appended to `CLAWPERATOR_SKILLS_REGISTRY`. Prints created paths and pointer to authoring guide.

**Change — docs:**
1. Add `skills new` to CLI reference with all flag documentation.
2. Add `skills run` output schema to the Skills Usage Model page and CLI reference: `{ skillId, output, exitCode, durationMs }` field definitions, that `output` is raw stdout, that stdout conventions (e.g. `RESULT|status=success|...`) are skill-defined not runner-enforced, example output from a successful and a failed run.

**Acceptance criteria:**
- `skills new com.example.test --app com.example --intent test` creates all files with correct content and a valid registry entry.
- `skills list` shows the new skill immediately after.
- `skills run com.example.test --device-id <id>` exits non-zero with "not implemented" message (not a crash).
- CLI reference documents `skills new` and `skills run` output schema.

**Dependencies:** None.

---

## PR-6 — Installer multi-device awareness
**Tasks:** T-12 | **Codebases:** `install` + `docs`

A bash change to install.sh and a first-time setup docs addition. Kept separate from Node work because it's a different codebase and a different reviewer concern (onboarding flow vs. runtime behavior).

---

### [DONE] T-12 · Detect already-installed APK during multi-device install; add setup docs
**Priority:** Medium

**Problem:**
When multiple devices are connected, the installer prints the same generic "setup required" output regardless of whether any device already has the APK installed. A user whose device is already configured sees the same message as someone who has never set up. The first-time setup docs page has no entry for the multi-device case.

**Change — install:**
After detecting multiple devices, for each serial run `clawperator doctor --device-id <serial> --output json` silently and parse the result. Print per-device status: `✅ <serial> — ready` or `⚠ <serial> — setup required: clawperator operator setup --device-id <serial>`. If all devices ready: print "All devices ready. No setup required."

**Change — docs:**
Add a "Multiple devices connected" troubleshooting section to the first-time setup page: why the installer stops at device selection, how to proceed with `operator setup --device-id`, how to check if a device is already set up with `doctor --device-id`, expected output for each case.

**Acceptance criteria:**
- 2 devices, one with APK installed and one without → installer correctly labels each.
- 2 devices, both ready → "All devices ready."
- 2 devices, neither ready → existing behavior unchanged.
- First-time setup page contains the multi-device troubleshooting section.

**Dependencies:** PR-3 (T-05 doctor exit code fix) should ship first so the doctor invocation here exits correctly.

---

## PR-7 — Docs cleanup and action reference page
**Tasks:** T-13, T-14 | **Codebases:** `docs`

Both tasks are docs-only with no behavior change. The link audit (T-13) is done first on the branch — fixing dead links and adding the CI check — then the reference page (T-14) is built on top of that clean baseline. The CI check validates the new page's links immediately. One reviewer context-load for all docs work.

---

### T-13 · Fix broken internal links; add CI link check
**Priority:** High

**Problem:**
`reference/actions` is a 404. Several links in the agent quickstart return 404. Recent docs reorganization left dead links in agent-facing pages.

**Change:**
1. Audit all internal links in `ai-agents/` and `reference/` sections.
2. Fix or redirect each 404 to the correct current URL.
3. Add CI link validation using the approach specified in `tasks/docs/validate/todo.md`:
   - Extend `scripts/validate_docs_routes.py` with a `check_inner_page_links()` function that follows relative `../` links inside authored markdown pages (the current validator checks source-map routes and absolute URLs but does not follow relative cross-page links).
   - Enable MkDocs `strict: true` so any remaining broken reference raises a build error.
   - Do not introduce a separate `lychee` dependency — the Python validator + MkDocs strict is the chosen implementation path.

**Acceptance criteria:**
- All internal links in `ai-agents/` and `reference/` return 200.
- `validate_docs_routes.py` catches broken relative `../` links and fails CI.
- MkDocs `strict: true` is enabled; build fails on any broken mkdocs reference.
- CI check runs on docs PRs and catches new broken links introduced by T-14 immediately.

**Dependencies:** None (within this PR, do this before T-14).

---

### T-14 · Create single canonical action type reference page
**Priority:** High

**Problem:**
The action params schema is spread across `llms-full.txt`, the agent quickstart, and the Node API guide. A new agent needs to fetch 4 pages and make 2 failed API calls before the payload structure is clear.

**Change:**
Create `reference/action-types/` as a single page covering all action types including the new ones from PR-2 (T-02, T-03, T-04): full params schema, result data shape, minimal working example payload per type. Cross-link from agent quickstart, `llms-full.txt`, and navigation patterns guide. Redirect the stale `reference/actions` URL to this page.

**Acceptance criteria:**
- All action types documented with params, result shape, and example — including `wait_for_navigation`, `read_key_value_pair`.
- `read_text` validators entry reflects extended forms from T-04.
- `scroll_until` and `scroll_and_click` entries show `matcher` as canonical (reflecting T-09).
- Page reachable at a stable URL.
- Agent quickstart, `llms-full.txt`, and navigation patterns each link to it.
- `reference/actions` redirects here.

**Dependencies:** PR-2 (new action types to document), PR-4 (canonical `matcher` param name).

---

## Dependency summary

```
PR-1 ──► PR-2         (T-01 click fix before T-02 navigation wait; recommended, not hard gate)
PR-3 ──► PR-6         (T-05 doctor exit code before T-12 installer uses doctor)
PR-2 ──► PR-7         (new action types exist before reference page is written)
PR-4 ──► PR-7         (canonical matcher name before reference page is written)

PR-3, PR-4, PR-5, PR-6 are independent of each other and of PR-1/PR-2.
PR-7 is the only PR with multiple upstream dependencies — work on it last.
```
