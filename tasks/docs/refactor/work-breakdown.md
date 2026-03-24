# Docs Refactor - Work Breakdown

Parent plan: `tasks/docs/refactor/plan.md`

This work ships as **3 PRs**, strictly sequenced. Each PR is independently shippable and leaves the build in a working state.

| PR | Scope | Key Deliverable |
|----|-------|----------------|
| PR-1 | Pipeline + skeleton | New build pipeline works, old URLs redirect, placeholder pages |
| PR-2 | Core content + code | 9 critical pages + doctor docsUrl + AGENTS.md |
| PR-3 | Remaining content + cleanup | 11 secondary pages + delete old files + finalize llms artifacts |

Each PR contains multiple tasks. Tasks within a PR are ordered by dependency. Tasks within the same phase can be parallelized where noted.

This is a migration, not a perfection pass. Prioritize coherent structure, correct core documentation, and a deterministic build pipeline. Do not over-polish secondary pages. Prefer shipping a clean, correct system that can be refined in follow-ups.

---

## Hard Rules

These rules apply to all implementation work during this refactor.

### Code is the source of truth

Existing documentation is advisory only and not presumed accurate. For every authored page:
- The current implementation in code is the primary source of truth
- Existing docs (including the reference snapshot) are only supporting reference material
- Where docs and code conflict, code wins
- If behavior is unclear from code, inspect tests and command help output before writing docs
- Do not preserve wording from old docs unless it is verified against code
- Each commit message should note what code was verified against (e.g., "Verified against: `apps/node/src/cli/registry.ts`")

### Reference for verifying behavior

| Topic | Verify against |
|-------|---------------|
| CLI commands and flags | `apps/node/src/cli/registry.ts` |
| Selector flags | `apps/node/src/cli/selectorFlags.ts` |
| Action types | `apps/node/src/contracts/execution.ts`, `apps/node/src/contracts/selectors.ts` |
| Error codes | `apps/node/src/contracts/errors.ts` |
| Result envelope | `apps/node/src/contracts/result.ts` |
| Doctor checks | `apps/node/src/domain/doctor/checks/` |
| Serve command | `apps/node/src/cli/commands/serve.ts` |

### Implementation discipline

- Work one target page at a time
- For each page:
  1. Gather source material (old docs from reference snapshot + code)
  2. Verify behavior against code
  3. Draft the page
  4. Review the page against the plan and current implementation
  5. Run relevant validation
  6. Commit
- For complex pages (`setup.md`, `api/actions.md`, `api/selectors.md`, `api/errors.md`): draft commit, then review/fixup commit
- Use small, liberal commits. Do not batch multiple authored pages into one commit.

---

## Phase 0: Migration Prep

### Task 0.1: Create reference snapshot

**Goal:** Preserve a read-only copy of all current public docs before any rewriting begins.

**Steps:**
1. Create `tasks/docs/refactor/reference/`
2. Copy all current public docs sources into it (everything that appears in the current `source-map.yaml` or `mkdocs.yml`)
3. Add `README.md` to the directory with text: *"Reference snapshot only. May contain stale or incorrect documentation. Do not publish. Do not treat as authoritative over code."*
4. Commit

**Acceptance:**
- Reference snapshot exists with all current public doc sources
- README clearly marks it as non-authoritative
- Original files remain untouched

**Depends on:** Nothing.

---

## PR-1: Pipeline + Skeleton

Everything else depends on this PR. Must merge before content authoring begins in PR-2.

### Task 1.1: Remove committed generated docs and set up gitignore

**Goal:** Eliminate `sites/docs/docs/` from git tracking and set up gitignore entries for the new pipeline.

**Prerequisite (DONE):** `docs/skills/skill-from-recording.md` has been moved to `../clawperator-skills/docs/skill-from-recording.md` (commit 058021d in this repo, 41abd7b in skills repo).

**Steps:**
1. `git rm -r sites/docs/docs/` - remove generated docs from git
2. Add to `sites/docs/.gitignore`:
   ```
   .build/
   docs/
   ```
3. Add to `docs/.gitignore` (create if needed):
   ```
   api/cli.md
   ```
4. Create empty directories: `docs/api/`, `docs/skills/`, `docs/troubleshooting/`

**Acceptance:**
- `git status` shows `sites/docs/docs/` removed
- `docs/api/`, `docs/skills/`, and `docs/troubleshooting/` exist
- Gitignore entries are in place

**Depends on:** Nothing.

---

### Task 1.2: Write assembly script

**Goal:** Create the deterministic assembly script that builds the staging directory.

**Location:** `.agents/skills/docs-generate/scripts/assemble.sh` (or `.py` if the implementer prefers Python for link rewriting logic)

**Inputs:**
- `sites/docs/mkdocs.yml` (nav tree - determines which authored pages to copy)
- `sites/docs/source-map.yaml` (assembly manifest - defines code-derived, markers, cross-repo)
- `docs/` (authored pages)
- `../clawperator-skills/docs/` (cross-repo source)
- `apps/node/src/` (code inputs for generators)

**Output:** Fully assembled `sites/docs/.build/` directory ready for MkDocs.

**Behavior (clear phase boundaries):**

1. **resolve_pages** - Parse `mkdocs.yml` nav to get all page paths. For each, determine source: authored (`docs/`) or `code_derived` (source-map). Fail if any page has no source. Fail if source-map defines outputs not in nav. Fail if duplicate output paths exist.
2. **clean_staging** - Remove `sites/docs/.build/` if exists, create fresh.
3. **copy_authored** - Copy authored pages from `docs/` to `.build/` preserving structure. Skip `docs/internal/`.
4. **generate_code_derived** - Run generator scripts for code-derived pages, write to `.build/`.
5. **apply_markers** - For authored pages with `<!-- CODE-DERIVED: <id> -->` markers, run associated generator, replace marker in the `.build/` copy. Fail if any marker remains unexpanded.
6. **validate_build** - Verify every nav page exists in `.build/`. Verify no unexpected pages exist. Verify no unexpanded markers. Log summary.

Supports `--verbose` flag to log all link rewrites and source resolutions.

**Acceptance:**
- Script runs without error when called with placeholder authored pages
- `.build/` contains exactly the pages listed in nav
- Script exits non-zero on: missing page, orphan source-map entry, duplicate output path, unexpanded marker
- Markers are expanded correctly

**Depends on:** Task 1.1 (gitignore setup)

---

### Task 1.3: Write code-derived generator scripts

**Goal:** Create deterministic Python scripts that generate docs content from TypeScript source.

**Location:** All scripts live in `.agents/skills/docs-generate/scripts/`

**Scripts to create:**

1. **`generate_cli_reference.py`**
   - Input: `apps/node/src/cli/registry.ts`, `apps/node/src/cli/commands/`
   - Output: Complete `api/cli.md` page with every command, flag, alias
   - Must parse the `COMMANDS` object in `registry.ts` to extract: command name, summary, help text, flags, aliases
   - Output format: markdown with page schema from plan Section 2

2. **`generate_error_table.py`**
   - Input: `apps/node/src/contracts/errors.ts`
   - Output: Markdown table of error codes with code, meaning, and HTTP status
   - For marker expansion in `api/errors.md`

3. **`generate_selector_table.py`**
   - Input: `apps/node/src/cli/selectorFlags.ts`
   - Output: Markdown table of selector flags with flag name, type, description, mutual exclusion rules
   - For marker expansion in `api/selectors.md`

**Acceptance:**
- Each script runs standalone and produces valid markdown
- Output is deterministic (same input = same output)
- Scripts fail with clear error if source files are missing or unparseable

**Depends on:** Nothing (can run in parallel with 1.1 and 1.2)

---

### Task 1.4: Rewrite source-map.yaml

**Goal:** Replace the current full-page manifest with the reduced assembly manifest.

**Current state:** ~40 page entries with modes (copy, code-derived, curated), sources, rules, sections.

**Target state:** Only defines code-derived pages and marker expansions. No cross-repo section (skills docs are now authored in this repo). See plan Section 6 for exact schema.

**Acceptance:**
- No authored `mode: copy` entries remain
- No `cross_repo` section
- `code_derived` and `markers` sections are present and correct
- File is valid YAML
- Assembly script can parse it

**Depends on:** Task 1.2 (assembly script defines the schema it reads)

---

### Task 1.5: Rewrite mkdocs.yml

**Goal:** Replace the entire nav tree and configure the new build pipeline.

**Changes:**
1. Set `docs_dir: .build`
2. Replace `nav:` with the tree from plan Section 3 (20 pages)
3. Add `mkdocs-redirects` plugin with full redirect map from plan Section 6
4. Keep `strict: true`
5. Add `mkdocs-redirects` to `sites/docs/requirements.txt`

**Acceptance:**
- Nav contains exactly 20 pages in 4 sections
- `docs_dir` points to `.build`
- Redirects plugin is configured
- `requirements.txt` includes `mkdocs-redirects`

**Depends on:** Nothing (can run in parallel with other Phase 1 tasks)

---

### Task 1.6: Update build and validation scripts

**Goal:** Update `docs_build.sh`, `generate_llms_full.py`, and `validate_docs_routes.py` for the new pipeline.

**Changes:**

1. **`scripts/docs_build.sh`:**
   - Add call to `.agents/skills/docs-generate/scripts/assemble.sh` as first step (before MkDocs build)
   - Remove or skip `validate_source_of_truth.py` call (drift is no longer possible for authored pages)
   - MkDocs build reads from `.build/`
   - `generate_llms_full.py` reads from `.build/`

2. **`generate_llms_full.py`:**
   - Read pages from `sites/docs/.build/` instead of `sites/docs/docs/`
   - Walk `mkdocs.yml` nav order instead of source-map sections
   - Write to same output locations

3. **`validate_docs_routes.py`:**
   - Add inner-page relative link validation (`check_inner_page_links`)
   - Validate against `.build/` directory
   - Check all links in generated docs resolve to built files

**Acceptance:**
- `docs_build.sh` runs end-to-end with placeholder content (assembly + MkDocs build + llms-full + validation)
- `llms-full.txt` is generated in nav order
- Relative link validation catches broken links

**Depends on:** Tasks 1.2, 1.3, 1.4, 1.5 (all pipeline components must exist)

---

### Task 1.7: End-to-end pipeline verification

**Goal:** Verify the complete pipeline works with placeholder content before any real authoring begins.

**Steps:**
1. Create minimal placeholder pages in `docs/` for all 20 nav entries (e.g., `# Page Title\n\nPlaceholder - content coming in PR-2/PR-3.`)
2. Run assembly script - verify `.build/` is complete
3. Run `docs_build.sh` - verify site builds
4. Verify `llms-full.txt` contains all 20 pages
5. Verify redirects work for at least 5 old URLs
6. Do NOT remove placeholder content - they remain until replaced by real content in PR-2/PR-3

**Acceptance:**
- Full pipeline runs without error
- All 20 pages appear in built site
- `llms-full.txt` contains all 20 pages in correct order
- At least 5 redirects resolve correctly
- Placeholders remain in place for PR-2/PR-3 to replace

**Depends on:** All of PR-1 (1.1-1.6)

**PR-1 is complete after this task passes. Open PR, get review, merge.**

---

## PR-2: Core Content + Code Changes

The 9 highest-impact pages + code changes. These are the pages agents hit first and most often, requiring the most verification against code.

After PR-1 merges, create a new branch from main for PR-2.

Every page must follow:
- Contract-first style (see page schema in plan Section 2)
- New flat CLI surface (`snapshot` not `observe snapshot`, `click --text` not `action click --selector`)
- Canonical flag names (`--device`, `--json`, `--timeout`, `--operator-package`)
- Canonical terminology ("operator" not "receiver", "selector" not "matcher")
- No historical context, no deprecated behavior, no migration notes
- Current state only
- Verified against code (see Hard Rules section for verification reference table)

---

### Task 2.1: Setup page

**Output:** `docs/setup.md` (replaces placeholder from PR-1)

**Content:** Single linear path from zero to first successful command. Covers:
- Install CLI (`curl | sh` or npm)
- Prepare device (physical or emulator)
- Install Operator APK (release vs debug variants)
- Grant permissions
- Run `clawperator doctor` to verify
- Run first command (`clawperator snapshot`)

**Agent and OpenClaw emphasis:** The primary consumer of this page is an agent (especially OpenClaw) performing first-time setup autonomously. The page must:
- Include an explicit "Agent / OpenClaw Setup" section that covers:
  - How OpenClaw invokes Clawperator (brain/hand relationship)
  - The exact sequence an agent should execute to go from fresh install to verified working state
  - How to confirm success programmatically (`clawperator doctor --json`, checking exit codes)
  - Common first-run failure modes an agent will hit and how to recover without human intervention
- Ensure every step has a machine-verifiable success condition (exit code, JSON output field, or command to run)
- Not assume a human is reading - instructions must be unambiguous enough for an agent to execute literally
- Call out where `--device` and `--operator-package` flags are needed (agent will likely have multiple devices or debug APK)

The page is one linear path, but it must serve agents as its primary audience. Human-friendly prose is secondary to precise, executable steps.

**Sources to draw from:** `tasks/docs/refactor/reference/` copies of `first-time-setup.md`, `agent-quickstart.md`, `openclaw-first-run.md`, `running-clawperator-on-android.md`, `android-operator-apk.md`. Verify all steps against actual CLI behavior.

**Key constraint:** One path. No branching into separate "human" vs "agent" tracks. But the single path must be agent-executable throughout.

**Depends on:** PR-1 merged

---

### Task 2.2: API Overview

**Output:** `docs/api/overview.md` (replaces placeholder)

**Content:** Execution model, result envelope contract, core concepts. Must not exceed one screen of concepts + one envelope definition + one execution flow description. All detailed mechanics go to dedicated pages.

Covers:
- What Clawperator is (2-3 lines: deterministic actuator, brain/hand model)
- Execution payload shape (commandId, taskId, source, steps[])
- Result envelope shape (envelope.status, stepResults[].success, error codes)
- How status + stepResults relate
- Pointer to dedicated pages for actions, selectors, errors, etc.

**Sources:** Reference copies of `execution-model.md`, `architecture.md`, `project-overview.md`, `node-api-for-agents.md`. Verify against `apps/node/src/contracts/execution.ts` and `apps/node/src/contracts/result.ts`.

**Depends on:** PR-1 merged

---

### Task 2.3: Actions page

**Output:** `docs/api/actions.md` (replaces placeholder)

**Content:** Every action type with parameters, outputs, and failure modes. Tabular format.

Must cover all current actions: `click`, `scroll`, `scroll_until`, `scroll_and_click`, `read_text`, `read_value`, `enter_text`, `press_key`, `wait_for_node`, `wait_for_nav`, `snapshot_ui`, `screenshot`, `close`, `sleep`, `open_app`, `open_uri`

For each action: name, required params, optional params, output shape, common failure modes.

Reference selectors page for selector parameters (do not duplicate selector docs here - just note "see Selectors").

**Sources:** Reference copies of `action-types.md`, `node-api-for-agents.md`. Verify against `apps/node/src/contracts/execution.ts`.

**Depends on:** PR-1 merged

---

### Task 2.4: Selectors page

**Output:** `docs/api/selectors.md` (replaces placeholder)

**Content:** NodeMatcher contract, selector flags, shorthand vs JSON, container targeting, mutual exclusion rules.

Must include `<!-- CODE-DERIVED: selector-flags -->` marker where the generated flag table should be injected.

Covers:
- Shorthand flags: `--text`, `--text-contains`, `--id`, `--desc`, `--desc-contains`, `--role`, `--coordinate`
- Container flags: `--container-text`, `--container-id`, etc.
- JSON `--selector` flag (mutual exclusive with shorthand flags)
- `--coordinate` vs selector mutual exclusion
- NodeMatcher type definition
- Container matching semantics

**Sources:** `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts`. Reference copies of `node-api-for-agents.md` and `action-types.md` for context.

**Depends on:** PR-1 merged

---

### Task 2.5: Errors page

**Output:** `docs/api/errors.md` (replaces placeholder)

**Content:** Every error code with meaning and recovery action in a single page.

Must include `<!-- CODE-DERIVED: error-codes -->` marker where the generated error table should be injected.

Authored sections cover:
- Error classification (Node CLI errors, Android-side errors, per-step errors)
- Fast triage model: how to read envelope.status + stepResults to classify failures
- Recovery actions keyed to error classes
- New error codes from the refactor: `MISSING_SELECTOR`, `MISSING_ARGUMENT`, `UNKNOWN_COMMAND` (with `suggestion` field), `OPERATOR_NOT_INSTALLED`, `OPERATOR_VARIANT_MISMATCH`

**Sources:** `apps/node/src/contracts/errors.ts` (primary). Reference copy of `error-handling.md` for recovery guidance patterns.

**Depends on:** PR-1 merged

---

### Task 2.6: Devices page

**Output:** `docs/api/devices.md` (replaces placeholder)

**Content:** Device targeting, package model, multi-device rules.

Covers:
- `deviceId` as ADB serial
- `--device` flag (alias: `--device-id`)
- Device resolution: single device (auto), multiple devices (must specify)
- `--operator-package` flag (release: `com.clawperator.operator`, debug: `com.clawperator.operator.dev`)
- Multi-device deterministic patterns: always pass `--device` when multiple connected
- Cold-start device enumeration

**Sources:** Reference copies of `device-and-package-model.md`, `multi-device-workflows.md`. Verify against CLI help output and `registry.ts`.

**Depends on:** PR-1 merged

---

### Task 2.7: Doctor page

**Output:** `docs/api/doctor.md` (replaces placeholder)

**Content:** Readiness checks, what they validate, fix behavior, remediation steps.

**Sources:** Reference copy of `node-api-doctor.md`. Verify against `apps/node/src/domain/doctor/checks/` and `apps/node/src/cli/commands/doctor.ts`.

**Depends on:** PR-1 merged

---

### Task 2.8: Serve page

**Output:** `docs/api/serve.md` (replaces placeholder)

**Content:** HTTP/SSE server contract, endpoints, usage patterns.

**Sources:** `apps/node/src/cli/commands/serve.ts`, `registry.ts`. Reference copy of `node-api-for-agents.md` for any existing serve documentation.

**Depends on:** PR-1 merged

---

### Task 2.9: Doctor docsUrl code changes

**Goal:** Add `docsUrl` field to doctor output so agents can find relevant docs for each check.

**Changes:**
1. Add `docsUrl?: string` to fix type in `apps/node/src/contracts/doctor.ts`
2. Render `docsUrl` in pretty mode output in `apps/node/src/cli/commands/doctor.ts`
3. Populate `docsUrl` in readiness checks in `apps/node/src/domain/doctor/checks/` - use new page URLs (e.g., `https://docs.clawperator.com/setup/` for install checks, `https://docs.clawperator.com/api/devices/` for device checks)
4. Add unit tests:
   - T1: docsUrl present in JSON output when fix has one
   - T2: docsUrl absent when fix has none
   - T3: docsUrl rendered in pretty mode
   - T4: docsUrl URLs are valid (point to real pages)

**Acceptance:**
- `npm --prefix apps/node run build` succeeds
- `npm --prefix apps/node run test` passes
- Doctor output includes docsUrl for relevant checks

**Depends on:** Task 2.7 (doctor page must exist for URLs to be valid)

---

### Task 2.10: AGENTS.md from install.sh

**Goal:** Generate `~/.clawperator/AGENTS.md` during CLI installation.

**Content of generated file:**
- Brief description of Clawperator
- Link to `https://docs.clawperator.com/llms.txt`
- Link to `https://docs.clawperator.com/llms-full.txt`
- Quick-start commands using new flat CLI surface
- Link to setup page

**Changes:** Update `install.sh` to write this file after successful installation.

**Acceptance:**
- After running `install.sh`, `~/.clawperator/AGENTS.md` exists
- File contains valid URLs pointing to new page structure
- File uses flat CLI commands (not old nested forms)

**Depends on:** Task 2.1 (setup page must exist for URLs)

---

### PR-2 Validation (before opening PR)

1. `./scripts/docs_build.sh` succeeds
2. `npm --prefix apps/node run build && npm --prefix apps/node run test` passes
3. All 9 content pages verified against code (commit messages cite sources)
4. Zero occurrences of "receiver", deprecated command forms, or deprecated flag names in new pages
5. Doctor docsUrl unit tests pass
6. Remaining 11 pages are still placeholders (expected - they ship in PR-3)

**PR-2 is complete after validation passes. Open PR, get review, merge.**

---

## PR-3: Remaining Content + Cleanup

Secondary API pages, skills pages, troubleshooting pages, index page, llms artifacts, old file deletion, and repo metadata updates.

After PR-2 merges, create a new branch from main for PR-3.

Same authoring rules as PR-2 (see Hard Rules section).

---

### Task 3.1: Remaining API pages

**Outputs** (each replaces its placeholder):
- `docs/api/snapshot.md` - Snapshot output format. Source: reference copy of `snapshot-format.md`. Verify against actual snapshot output.
- `docs/api/timeouts.md` - Timeout budgeting. Source: reference copy of `timeout-budgeting.md`. Update examples to flat CLI.
- `docs/api/environment.md` - All environment variables. Source: reference copy of `environment-variables.md`. Update "RECEIVER" to "OPERATOR".
- `docs/api/navigation.md` - Navigation patterns. Source: reference copy of `navigation-patterns.md`. Update CLI examples.
- `docs/api/recording.md` - Recording format. Source: reference copy of `android-recording.md`. Remove persona framing.

Each page should follow the page schema and use current CLI surface.

**Depends on:** PR-2 merged

---

### Task 3.2: Skills docs

**Output:** New files in `docs/skills/` (each replaces its placeholder):
- `docs/skills/overview.md` - what skills are, how they run, runtime model
- `docs/skills/authoring.md` - authoring guidelines, recording-to-skill conversion, blocked terms
- `docs/skills/development.md` - development workflow
- `docs/skills/runtime.md` - device prep and runtime tips

**Source material** (in `../clawperator-skills/docs/`):
- `usage-model.md` -> `overview.md`
- `skill-authoring-guidelines.md` + `skill-from-recording.md` + `blocked-terms-policy.md` -> `authoring.md`
- `skill-development-workflow.md` -> `development.md`
- `device-prep-and-runtime-tips.md` -> `runtime.md`

Must explicitly define in `overview.md`: skill = deterministic wrapper, clawperator = execution substrate, agent = planner.

All content must be verified against actual skill implementation, not just copied from old docs.

**Depends on:** PR-2 merged

---

### Task 3.3: Troubleshooting pages

**Outputs** (each replaces its placeholder):
- `docs/troubleshooting/operator.md` - Operator app troubleshooting + crash log access (from reference copies of `troubleshooting.md` + `crash-logs.md`)
- `docs/troubleshooting/known-issues.md` - move from `docs/known-issues.md`, minimal changes
- `docs/troubleshooting/compatibility.md` - move from `docs/compatibility.md`, minimal changes

**Depends on:** PR-2 merged

---

### Task 3.4: Index page

**Output:** `docs/index.md` (replaces placeholder)

**Content:** Minimal routing page. 4 sections (Setup, API, Skills, Troubleshooting). Links to `llms.txt` and `llms-full.txt`. No link dumps, no duplicate subsections, no persona split.

Write this last, after all other pages exist, so all links are valid.

**Depends on:** Tasks 3.1-3.3 complete

---

### Task 3.5: Finalize llms artifacts

**Steps:**
1. Rewrite `llms.txt` (both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt`) with all canonical page URLs
2. Run `generate_llms_full.py` to produce final `llms-full.txt`
3. Verify `llms-full.txt` contains all 20 pages in nav order
4. Review `llms-full.txt` top-to-bottom for coherence

**Depends on:** Tasks 3.1-3.4 complete

---

### Task 3.6: Cleanup

**Goal:** Remove old files, update repo metadata.

**Steps:**
1. Move internal docs to `docs/internal/`: `conformance-apk.md`, `release-procedure.md`, `release-reference.md`, `site-hosting.md`, `design/` (entire directory)
2. Delete old authored source files:
   - `docs/reference/` directory
   - `docs/ai-agents/` directory
   - Individual files: `agent-quickstart.md`, `first-time-setup.md`, `openclaw-first-run.md`, `running-clawperator-on-android.md`, `project-overview.md`, `terminology.md`, `android-operator-apk.md`, `architecture.md`, `node-api-for-agents.md`, `snapshot-format.md`, `navigation-patterns.md`, `multi-device-workflows.md`, `crash-logs.md`, `troubleshooting.md`, `compatibility.md`, `known-issues.md`
3. Update skills repo: replace docs with lightweight pointers to `https://docs.clawperator.com/skills/`
4. Delete reference snapshot: `tasks/docs/refactor/reference/`
5. Update `CLAUDE.md`:
   - Update docs architecture description
   - Update validation commands for new pipeline
   - Remove references to `sites/docs/docs/` as generated output
   - Update `docs-generate` and `docs-validate` skill descriptions
   - Note that skills docs are canonical in this repo, not the skills repo
6. Update `.agents/skills/docs-generate/SKILL.md` for new pipeline scope
7. Update `.agents/skills/docs-validate/SKILL.md` for new validation scope
8. Retire or simplify `diff_report.py`, `build_inventory.py`, `validate_source_of_truth.py`

**Depends on:** Tasks 3.1-3.5 complete

---

### PR-3 Validation (before opening PR)

1. `./scripts/docs_build.sh` succeeds with zero warnings
2. `npm --prefix apps/node run build && npm --prefix apps/node run test` passes
3. `llms-full.txt` contains all 20 pages, coherent top-to-bottom
4. Every URL in `llms.txt` resolves to a built HTML page
5. Zero placeholder pages remain
6. Zero occurrences of "receiver" in authored docs
7. No old docs remain outside `docs/internal/`
8. All relative links resolve
9. Grep for deprecated terms: "observe snapshot", "action click", "--timeout-ms" returns zero
10. At least 5 redirects resolve correctly
11. Skills repo updated with pointer docs
12. `CLAUDE.md` reflects new reality
13. Run full build one final time after cleanup to verify nothing broke

**PR-3 is complete after validation passes. Open PR, get review, merge.**

---

## Dependency Graph

```
PR-1: Pipeline + Skeleton
  0.1 (reference snapshot)
    |
  1.1 (gitignore) ──┐
  1.2 (assembly)  ──┤
  1.3 (generators) ─┤──→ 1.6 (build scripts) ──→ 1.7 (verify + placeholders)
  1.4 (source-map) ─┤
  1.5 (mkdocs.yml) ─┘
    |
  [merge PR-1]

PR-2: Core Content + Code (branch from main after PR-1 merges)
  2.1 (setup)       ──→ 2.10 (AGENTS.md)
  2.2 (overview)
  2.3 (actions)
  2.4 (selectors)
  2.5 (errors)
  2.6 (devices)
  2.7 (doctor)       ──→ 2.9 (doctor docsUrl code)
  2.8 (serve)
    |
  [merge PR-2]

PR-3: Remaining Content + Cleanup (branch from main after PR-2 merges)
  3.1 (remaining API) ──┐
  3.2 (skills)        ──┤──→ 3.4 (index) ──→ 3.5 (llms) ──→ 3.6 (cleanup)
  3.3 (troubleshoot)  ──┘
    |
  [merge PR-3]
```
