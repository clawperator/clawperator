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
| PR-6 | T-12 | `install` + `docs` | Installer multi-device awareness |
| PR-7 | T-13, T-14 | `docs` | Link cleanup + action reference page; both docs-only, do together |

**Ordering constraints:**
- PR-1 before PR-2 (T-01 fixes the click that T-02 waits on)
- PR-3 before PR-6 (T-12 calls `doctor`; T-05 fixes its exit code)
- PR-2 before PR-7 (reference page should include the new action types)
- PR-4 before PR-7 (reference page should show `matcher` as canonical from the start)
- All other PRs are independent and can be parallelised

---

## PR-4 — Payload authoring ergonomics
**Tasks:** T-06, T-09 | **Codebases:** `node` + `docs`

Dry-run and param naming normalization are both about making it easier to write correct payloads without round-tripping to the device. T-09 benefits from T-06 shipping in the same PR: the dry-run output should show `matcher` as canonical from the first release.

---

### T-06 · Add `execute --dry-run` flag
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

### T-09 · Normalize `matcher` / `target` param naming; add alias
**Priority:** Medium

**Problem:**
`click`, `read_text`, `enter_text`, `wait_for_node` use `matcher`. `scroll_and_click` and `scroll_until` use `target`. Same concept, two key names. Directly caused schema errors during the evaluation.

**Change — node:**
In schema validation for `scroll_and_click` and `scroll_until`: accept `matcher` as the canonical key; accept `target` as a deprecated alias that passes validation but adds `data.warn: "'target' is deprecated; use 'matcher'"` to the step result. Both present simultaneously → `EXECUTION_VALIDATION_FAILED`.

**Change — docs:**
Update `scroll_and_click` and `scroll_until` entries to show `matcher` as canonical. Add a deprecation notice for `target` with migration note.

**Acceptance criteria:**
- `scroll_until` with `matcher` → validates and executes correctly.
- `scroll_until` with `target` → validates, executes, result includes deprecation warning.
- Both present → `EXECUTION_VALIDATION_FAILED`.
- `scroll_and_click` same behavior.
- Docs show `matcher` as canonical.

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

### T-12 · Detect already-installed APK during multi-device install; add setup docs
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
