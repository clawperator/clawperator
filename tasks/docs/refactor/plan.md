# Docs Refactor Plan - Final

## 1. Governing Principles

- `llms-full.txt` is the primary artifact. The docs site is a human-readable projection.
- Optimize for agent parsing, retrieval accuracy, and deterministic understanding.
- One concept = one canonical page. No duplication.
- Current state only. No historical context, deprecated APIs, or migration notes.
- Prefer deletion over preservation.
- Contract-first: schemas, shapes, and enumerations over prose explanations.
- Self-contained pages: an agent should resolve its question from a single page fetch.
- No persona sections. No "recommended paths." No "getting started vs reference" split.
- **Code is the source of truth.** Existing documentation is advisory only and not presumed accurate. Where docs and code conflict, code wins. Every authored page must be verified against the current implementation before it is finalized.
- **All canonical public docs live in one repo.** Skills docs, API docs, and setup docs are all authored in the main repo under `docs/`. The skills repo contains lightweight pointers only.

---

## 1a. Architectural Constraints

### Source structure = output structure

Authored docs live in `docs/` and are structured to match the final published layout directly. There is no intermediate "generated docs" directory committed to git. The build pipeline assembles a staging directory from authored sources + code-derived content, and MkDocs reads from that staging directory.

All canonical public docs - including skills docs - are authored in this repo under `docs/`. The `../clawperator-skills` repo contains only lightweight pointer docs (README, links to the docs site). This eliminates cross-repo copying, cross-repo link rewriting, and the associated drift risk.

This eliminates the false editing surface (`sites/docs/docs/`), makes drift architecturally impossible for authored pages, and means agents edit the file that gets published.

### Authority hierarchy

- `mkdocs.yml` is the canonical navigation and page ordering.
- `source-map.yaml` is reduced to a build assembly manifest. It defines only:
  - Code-derived pages (what code files generate what output)
  - Marker expansion specs (what authored pages contain `<!-- CODE-DERIVED: xxx -->` markers)
- Authored pages that map 1:1 from `docs/` to output need no entry in `source-map.yaml`. Their presence in `mkdocs.yml` nav is sufficient.

**Hard invariant (enforced by assembly script):**
- Every page in `mkdocs.yml` nav must have exactly one source: authored (`docs/`) or `code_derived` (source-map).
- `source-map.yaml` must not define output paths absent from `mkdocs.yml` nav.
- No two entries may produce the same output path.
- Violations fail the build.

### Link correctness

All authored docs live in `docs/` with paths matching the output structure. Relative links are correct by construction - a link from `docs/api/actions.md` to `../setup.md` resolves identically in source and in the assembled `.build/` output. No link rewriting is needed.

Absolute links (https://, #anchors within same page) are untouched.

**Validation:** The build must fail on any unresolvable relative link.

### Code vs authored precedence

- Code-derived data is authoritative for structure, enumerations, and schemas.
- Authored content augments but cannot override code definitions.

**Marker-based pages** (`api/errors.md`, `api/selectors.md`):
- Authored files contain `<!-- CODE-DERIVED: <id> -->` markers. The assembly script replaces these with generated content from code sources. The authored file (with marker) is committed. The expanded file (with injected content) exists only in the build staging directory.
- Generator output is authoritative for enumerations (error codes, selector flags).
- Build must fail if:
  - A `<!-- CODE-DERIVED: ... -->` marker remains unexpanded in the staging output.
  - The generator produces entries that the authored prose references by name but does not match (stale renames).
- The authored prose around markers provides semantics (recovery guidance, usage notes). It augments the generated table but cannot redefine what the code declares.

### Page boundary constraints

- `api/overview.md` must not exceed: one screen of concepts, one result envelope definition, one execution flow description. All detailed mechanics live in dedicated pages.
- Core reference pages (actions, selectors, errors) are explicitly designed to be used together. Cross-referencing between them is expected and acceptable. The "self-contained" principle means minimizing cross-dependencies, not eliminating them.

### Nav structural constraints

- Maximum 2 levels deep (section > page). No sub-sub-sections.
- Target ~6 pages per section (soft limit; API section is larger by design).
- Total target: ~22 pages. Growth beyond 25 requires justification.
- These constraints keep `llms-full.txt` coherent and retrieval predictable.

### Build failure conditions

The build must fail if any of these are true:

- Any relative link cannot be resolved to an output page
- Any `<!-- CODE-DERIVED: ... -->` marker remains unexpanded in staging output
- Any page in `mkdocs.yml` nav is missing from the assembled staging directory
- Any page in the staging directory is absent from `mkdocs.yml` nav (excluding redirects)
- Any `source-map.yaml` entry defines an output path not present in `mkdocs.yml` nav
- Any `mkdocs.yml` nav path appears more than once
- Any two source-map entries produce the same output path

### Terminology consistency

- Canonical terms must be used throughout. No synonyms.
  - "operator" (not "receiver")
  - "action" (not "command" when referring to execution payload actions)
  - "selector" (not "matcher" unless referring to the internal `NodeMatcher` type specifically)
  - "device" flag is `--device` (not `--device-id` as primary)
  - "timeout" flag is `--timeout` (not `--timeout-ms`)
- Each term is defined at first use on the page that owns the concept. Other pages use the term without redefining it.

### Old source file deletion criteria

During the refactor, old source files (e.g., `docs/node-api-for-agents.md`) being replaced by new files in the target structure may only be deleted after:
1. All target pages that depend on the old file's content are complete
2. `./scripts/docs_build.sh` succeeds
3. `llms-full.txt` includes the migrated content
4. All validation passes

Example: do not delete the five setup-related legacy docs until `setup.md`, `api/overview.md`, `api/devices.md`, and `troubleshooting/operator.md` are all complete, since setup-adjacent material may feed into all of them.

### Migration mode rules

These rules apply during the refactor and are dropped after it lands.

1. **Reference snapshot:** Before any content rewriting begins, copy all current public docs sources into `tasks/docs/refactor/reference/` as a read-only migration snapshot. This folder is not published, not linked in nav, and not treated as source of truth. It exists purely so implementing agents can reference old content without risk of editing it. Delete after the refactor lands. Mark the directory clearly: *"Reference snapshot only. May contain stale or incorrect documentation. Do not publish. Do not treat as authoritative over code."*

2. **Code is authoritative, old docs are not.** Existing documentation is advisory reference material only. For every authored page:
   - The current implementation in code is the primary source of truth.
   - Where docs and code conflict, code wins.
   - If behavior is unclear from code, inspect tests and command help output before writing docs.
   - Do not preserve wording from old docs unless it is verified against code.
   - Each commit message or PR description should note what code was verified against (e.g., "Verified against: `apps/node/src/cli/registry.ts`, `apps/node/src/contracts/errors.ts`").

3. **One page at a time.** Work one target page at a time. For each page:
   - Gather source material (old docs from reference snapshot + code).
   - Verify behavior against code.
   - Draft the page.
   - Review the page against the plan and current implementation.
   - Run relevant validation (`docs_build.sh` or subset).
   - Commit.
   - For complex pages (`setup.md`, `api/actions.md`, `api/selectors.md`, `api/errors.md`): draft commit, then review/fixup commit.
   - Use small, liberal commits. Do not batch multiple authored pages into one commit.

4. **No mass deletion until validation passes.** Old source files remain available (in their original locations and in the reference snapshot) until all dependent target pages are complete and validated.

---

## 2. Target Docs Structure

### Design Rationale

One axis: what an agent needs to do, in order.

1. **Setup** - get from zero to first successful command
2. **API** - what commands exist, what they accept, what they return, how to recover
3. **Skills** - how skills work, how to author and run them
4. **Troubleshooting** - what breaks and how to fix it

### Page Schema

Every page follows this structure where applicable:

```
# <Topic>
## Purpose          (1-2 lines: what this enables)
## When to use      (concrete triggers)
## Inputs           (exact parameters / state)
## Behavior         (deterministic description)
## Output           (exact shape)
## Failure modes    (enumerated with recovery)
## Example          (minimal, runnable)
```

Reference pages (actions, errors, selectors) use tabular format instead.
The schema is a default, not a straitjacket.

---

## 3. Navigation Tree

```yaml
nav:
  - Docs Home: index.md
  - Setup: setup.md
  - API:
    - Overview: api/overview.md
    - CLI Reference: api/cli.md
    - Actions: api/actions.md
    - Selectors: api/selectors.md
    - Snapshot Format: api/snapshot.md
    - Errors: api/errors.md
    - Devices: api/devices.md
    - Doctor: api/doctor.md
    - Timeouts: api/timeouts.md
    - Environment Variables: api/environment.md
    - Serve API: api/serve.md
    - Navigation Patterns: api/navigation.md
    - Recording Format: api/recording.md
  - Skills:
    - Overview: skills/overview.md
    - Authoring: skills/authoring.md
    - Development Workflow: skills/development.md
    - Device Prep and Runtime: skills/runtime.md
  - Troubleshooting:
    - Operator App: troubleshooting/operator.md
    - Known Issues: troubleshooting/known-issues.md
    - Version Compatibility: troubleshooting/compatibility.md
```

**22 pages total.** Down from 33 current pages (33% reduction).

### Page Descriptions

| Page | Content | Primary Sources |
|------|---------|----------------|
| `index.md` | Minimal routing: 4 sections, links to `llms.txt`/`llms-full.txt`, no link dumps | New |
| `setup.md` | Single linear path: install CLI, prepare device, install APK, run doctor, first command | `first-time-setup.md`, `agent-quickstart.md`, `openclaw-first-run.md`, `running-clawperator-on-android.md`, `android-operator-apk.md` |
| `api/overview.md` | Execution model, result envelope contract, core concepts (brain/hand, two-layer model) | `execution-model.md`, `architecture.md`, `project-overview.md`, parts of `node-api-for-agents.md` |
| `api/cli.md` | Every command, flag, alias - generated from code | `registry.ts`, command modules |
| `api/actions.md` | Every action type with params, outputs, failure modes | `action-types.md`, parts of `node-api-for-agents.md` |
| `api/selectors.md` | NodeMatcher, selector flags, shorthand vs JSON, container targeting, mutual exclusion rules | `selectorFlags.ts`, `selectors.ts`, parts of `node-api-for-agents.md`, parts of `action-types.md` |
| `api/snapshot.md` | Snapshot output format and parsing contract | `snapshot-format.md` |
| `api/errors.md` | Every error code with meaning and recovery action | `error-codes` (code-derived) + `error-handling.md` (authored) merged |
| `api/devices.md` | Device targeting, package model, multi-device rules | `device-and-package-model.md`, `multi-device-workflows.md` |
| `api/doctor.md` | Readiness checks, what they validate, fix behavior, docsUrl | `node-api-doctor.md` |
| `api/timeouts.md` | Timeout budgeting for common workflows | `timeout-budgeting.md` |
| `api/environment.md` | All environment variables | `environment-variables.md` |
| `api/serve.md` | HTTP/SSE server contract, endpoints, usage | `serve.ts` command, parts of `node-api-for-agents.md` |
| `api/navigation.md` | Observe-decide-act loops, scrolling patterns, overlay handling, OEM variation | `navigation-patterns.md` |
| `api/recording.md` | Android recording format, current limitations, step candidate contract | `android-recording.md` |
| `skills/overview.md` | What skills are, how they run, runtime model. Must explicitly define: skill = deterministic wrapper, clawperator = execution substrate, agent = planner. | `usage-model.md` |
| `skills/authoring.md` | Authoring guidelines, recording-to-skill conversion, blocked terms | `skill-authoring-guidelines.md`, `skill-from-recording.md`, `blocked-terms-policy.md` |
| `skills/development.md` | Development workflow | `skill-development-workflow.md` |
| `skills/runtime.md` | Device prep and runtime tips | `device-prep-and-runtime-tips.md` |
| `troubleshooting/operator.md` | Operator app troubleshooting, crash log access | `troubleshooting.md`, `crash-logs.md` |
| `troubleshooting/known-issues.md` | Current known issues | `known-issues.md` |
| `troubleshooting/compatibility.md` | Version compatibility rules | `compatibility.md` |

---

## 4. File-Level Classification

After the refactor, `docs/` is restructured to match the published output layout directly. New files are written to their target paths inside `docs/`. Old files that are fully absorbed are deleted. Internal files remain in `docs/` but are not in `mkdocs.yml` nav and are not copied to the build staging directory.

### Target `docs/` layout (post-refactor)

```
docs/
  index.md                          (authored)
  setup.md                          (authored)
  api/
    overview.md                     (authored)
    cli.md                          (code-derived, generated at build time, gitignored)
    actions.md                      (authored)
    selectors.md                    (authored + CODE-DERIVED marker for flag table)
    snapshot.md                     (authored)
    errors.md                       (authored + CODE-DERIVED marker for error code table)
    devices.md                      (authored)
    doctor.md                       (authored)
    timeouts.md                     (authored)
    environment.md                  (authored)
    serve.md                        (authored)
    navigation.md                   (authored)
    recording.md                    (authored)
  skills/                           (authored)
    overview.md
    authoring.md
    development.md
    runtime.md
  troubleshooting/
    operator.md                     (authored)
    known-issues.md                 (authored)
    compatibility.md                (authored)
  internal/                         (internal, not published - clear structural signal)
    conformance-apk.md
    release-procedure.md
    release-reference.md
    site-hosting.md
    design/
      node-api-design.md
      operator-llm-playbook.md
      skill-design.md
      generative-engine-optimization.md
      node-api-design-guiding-principles.md
```

### Old files: disposition

These files exist in the current `docs/` tree and must be handled during the refactor.

| Old File | Action | New Location |
|----------|--------|-------------|
| `docs/index.md` | Rewrite in place | `docs/index.md` |
| `docs/agent-quickstart.md` | DELETE | Content absorbed into `docs/setup.md` |
| `docs/first-time-setup.md` | DELETE | Replaced by `docs/setup.md` |
| `docs/openclaw-first-run.md` | DELETE | Content absorbed into `docs/setup.md` |
| `docs/running-clawperator-on-android.md` | DELETE | Content split to `docs/setup.md` and `docs/api/overview.md` |
| `docs/project-overview.md` | DELETE | Mission absorbed into `docs/api/overview.md` |
| `docs/terminology.md` | DELETE | Terms defined inline where used |
| `docs/android-operator-apk.md` | DELETE | Content absorbed into `docs/setup.md` and `docs/api/devices.md` |
| `docs/architecture.md` | DELETE | Two-layer model absorbed into `docs/api/overview.md` |
| `docs/node-api-for-agents.md` | DELETE | Split across `docs/api/` pages |
| `docs/snapshot-format.md` | DELETE | Replaced by `docs/api/snapshot.md` |
| `docs/navigation-patterns.md` | DELETE | Replaced by `docs/api/navigation.md` |
| `docs/multi-device-workflows.md` | DELETE | Merged into `docs/api/devices.md` |
| `docs/compatibility.md` | MOVE | To `docs/troubleshooting/compatibility.md` |
| `docs/troubleshooting.md` | DELETE | Replaced by `docs/troubleshooting/operator.md` (absorbs crash-logs) |
| `docs/known-issues.md` | MOVE | To `docs/troubleshooting/known-issues.md` |
| `docs/crash-logs.md` | DELETE | Merged into `docs/troubleshooting/operator.md` |
| `docs/reference/action-types.md` | DELETE | Replaced by `docs/api/actions.md` |
| `docs/reference/execution-model.md` | DELETE | Absorbed into `docs/api/overview.md` |
| `docs/reference/timeout-budgeting.md` | DELETE | Replaced by `docs/api/timeouts.md` |
| `docs/reference/device-and-package-model.md` | DELETE | Replaced by `docs/api/devices.md` |
| `docs/reference/error-handling.md` | DELETE | Merged into `docs/api/errors.md` |
| `docs/reference/node-api-doctor.md` | DELETE | Replaced by `docs/api/doctor.md` |
| `docs/reference/environment-variables.md` | DELETE | Replaced by `docs/api/environment.md` |
| `docs/ai-agents/android-recording.md` | DELETE | Replaced by `docs/api/recording.md` |
| `docs/skills/skill-from-recording.md` | DELETE | Already moved to skills repo (058021d), content absorbed into `docs/skills/authoring.md` |
| `docs/conformance-apk.md` | KEEP (internal) | Stays, not published |
| `docs/release-procedure.md` | KEEP (internal) | Stays, not published |
| `docs/release-reference.md` | KEEP (internal) | Stays, not published |
| `docs/site-hosting.md` | KEEP (internal) | Stays, not published |
| `docs/design/*.md` (all 5) | KEEP (internal) | Stay, not published |

After the refactor, the `docs/reference/`, `docs/ai-agents/` directories are empty and can be deleted.

### Skills docs consolidation

Skills docs are now authored in the main repo at `docs/skills/`. The `../clawperator-skills` repo retains only lightweight pointer docs (README with links to the docs site).

Content sources for the new `docs/skills/` pages:

| New File | Primary Source | Also Absorbs |
|----------|---------------|-------------|
| `docs/skills/overview.md` | `../clawperator-skills/docs/usage-model.md` | - |
| `docs/skills/authoring.md` | `../clawperator-skills/docs/skill-authoring-guidelines.md` | `skill-from-recording.md` (already in skills repo), `blocked-terms-policy.md` |
| `docs/skills/development.md` | `../clawperator-skills/docs/skill-development-workflow.md` | - |
| `docs/skills/runtime.md` | `../clawperator-skills/docs/device-prep-and-runtime-tips.md` | - |

After authoring the new pages in `docs/skills/`, update the skills repo:
- Replace current docs with lightweight pointers to `https://docs.clawperator.com/skills/`
- Keep repo-local contributor guidance (README, CONTRIBUTING if any)

### Code-derived sources in `apps/node/`

| Source | Role |
|--------|------|
| `apps/node/src/cli/registry.ts` | Primary input for generating `docs/api/cli.md` |
| `apps/node/src/cli/selectorFlags.ts` | Input for `<!-- CODE-DERIVED: selector-flags -->` marker in `docs/api/selectors.md` |
| `apps/node/src/contracts/errors.ts` | Input for `<!-- CODE-DERIVED: error-codes -->` marker in `docs/api/errors.md` |
| `apps/node/src/contracts/result.ts` | Reference for result envelope in `docs/api/overview.md` (authored, not injected) |
| `apps/node/src/contracts/execution.ts` | Reference for execution payload in `docs/api/overview.md` (authored, not injected) |
| `apps/node/src/contracts/selectors.ts` | Reference for matcher contract in `docs/api/selectors.md` (authored, not injected) |
| `apps/node/src/contracts/doctor.ts` | Reference for doctor report in `docs/api/doctor.md` (authored, not injected) |

---

## 5. Comparison-Informed Improvements

### Adopted from codex-plan

1. **Separate selectors page** (`api/selectors.md`): Selectors are a cross-cutting concept used by click, scroll, read, wait-for-node, and other commands. A dedicated canonical page avoids duplication across action entries and gives agents a single fetch target for "how do I specify a target element." Strongest structural improvement from codex.

2. **Serve API page** (`api/serve.md`): The `serve` command exists in `registry.ts` with HTTP/SSE surface. Agents using remote control need this contract documented.

3. **Nav-driven `llms-full.txt` generation**: `generate_llms_full.py` should walk `mkdocs.yml` nav order, not source-map sections. This ensures the primary artifact and the docs site share the same ordering.

4. **`selectorFlags.ts` as explicit generator input**: This file is the canonical definition of shorthand selector flags and should be an explicit code source for `api/selectors.md`.

### Rejected from codex-plan

1. **Remove `source-map.yaml` entirely**: Partially adopted. The file is dramatically reduced in scope (only tracks code-derived pages and marker expansions) but not eliminated. It still serves as the assembly manifest for the build pipeline. The dual-manifest problem is resolved because authored pages no longer appear in source-map.yaml and cross-repo copying was eliminated by consolidating skills docs into the main repo.

2. **Split setup into 3 pages** (install-and-verify, first-command, operator-apk): For agents, one linear page is better. One fetch, one path, no navigation decisions.

3. **Keep skills at 6 pages**: `skill-from-recording.md` and `blocked-terms-policy.md` are small enough to merge into `skills/authoring.md`. Fewer pages = less retrieval ambiguity.

4. **Frontmatter flag for internal docs**: Rejected the frontmatter flag, but adopted the `docs/internal/` directory convention. Provides a clear structural signal without requiring agents to check metadata.

5. **Merge timeouts into execution contract**: Would make `api/overview.md` too heavy. Timeout budgeting is distinct operational guidance.

6. **Split navigation-patterns across selectors + recovery**: Navigation patterns content is operational agent guidance that doesn't fit neatly into either destination. Keep as standalone page.

7. **Separate error-codes and error-recovery pages**: Single `api/errors.md` means one fetch for both code meaning and recovery action.

---

## 6. Pipeline / Generation Plan

### Current Pipeline (being replaced)

```
source-map.yaml  -->  docs-generate skill (agent)  -->  sites/docs/docs/ (committed)  -->  mkdocs build  -->  site/
                                                    -->  generate_llms_full.py          -->  llms-full.txt
```

Problems: `sites/docs/docs/` is committed but generated (false editing surface, drift risk). Agent-driven generation is non-deterministic. Full-tree copy for 80% of pages that need no transformation.

### New Pipeline

```
docs/                    (authored, committed, structure = output structure)
  + source-map.yaml      (assembly manifest for code-derived pages only)
  + apps/node/src/       (code inputs for generators)
         |
         v  .agents/skills/docs-generate/scripts/assemble.sh

sites/docs/.build/       (gitignored staging directory)
         |
         v  mkdocs build

sites/docs/site/         (gitignored final HTML)
  + llms-full.txt        (generated, copied to static/)
```

### Assembly steps (`.agents/skills/docs-generate/scripts/assemble.sh`)

This is a new deterministic script (not agent-driven). It runs as the first step of `docs_build.sh`.

1. **resolve_pages:** Parse `mkdocs.yml` nav to get all page paths. For each, determine source: authored (`docs/`) or `code_derived` (source-map). Fail if any page has no source. Fail if source-map defines outputs not in nav.
2. **clean_staging:** Remove `sites/docs/.build/`, create fresh.
3. **copy_authored:** Copy all authored pages from `docs/` that are referenced in `mkdocs.yml` nav to `sites/docs/.build/` preserving directory structure. Internal files (`docs/internal/`) are skipped.
4. **generate_code_derived:** Run generator scripts to produce `sites/docs/.build/api/cli.md` from `registry.ts` and command modules.
5. **apply_markers:** For authored pages containing `<!-- CODE-DERIVED: <id> -->` markers, replace markers in the `.build/` copy with generated content. Fail if any marker remains unexpanded. Currently applies to:
   - `api/errors.md`: `<!-- CODE-DERIVED: error-codes -->` expanded from `contracts/errors.ts`
   - `api/selectors.md`: `<!-- CODE-DERIVED: selector-flags -->` expanded from `cli/selectorFlags.ts`
6. **validate_build:** Verify every page in `mkdocs.yml` nav exists in `.build/`. Verify no unexpected pages exist. Verify no unexpanded markers remain. Fail on violations.

### What changes in existing components

**`source-map.yaml`** - Dramatically simplified. No longer lists every page. Only defines:
```yaml
# Assembly manifest - only code-derived and marker pages need entries
# Authored pages are discovered from mkdocs.yml nav + docs/ directory
code_derived:
  - output: api/cli.md
    generator: scripts/generate_cli_reference.py
    sources:
      - apps/node/src/cli/registry.ts
      - apps/node/src/cli/commands/

markers:
  - page: api/errors.md
    marker: error-codes
    generator: scripts/generate_error_table.py
    sources:
      - apps/node/src/contracts/errors.ts
  - page: api/selectors.md
    marker: selector-flags
    generator: scripts/generate_selector_table.py
    sources:
      - apps/node/src/cli/selectorFlags.ts
```

**`sites/docs/docs/`** - Deleted from git. The entire directory is removed from version control. Add to `.gitignore`.

**`sites/docs/.build/`** - New gitignored staging directory. MkDocs `docs_dir` points here.

**`docs/api/cli.md`** - Gitignored. Fully code-derived, generated at build time. Add `docs/api/cli.md` to `.gitignore`.

**`docs/skills/`** - Authored in this repo. Not gitignored. Skills docs are consolidated here from the skills repo.

**`mkdocs.yml`** - Full nav rewrite matching Section 3. `docs_dir` changes to `.build/`. Add `mkdocs-redirects` plugin:
- Add `mkdocs-redirects` to `sites/docs/requirements.txt`
- Add redirect map (one-time migration, static after landing):
  ```yaml
  plugins:
    - search
    - redirects:
        redirect_maps:
          'getting-started/first-time-setup.md': 'setup.md'
          'getting-started/running-clawperator-on-android.md': 'setup.md'
          'getting-started/openclaw-first-run.md': 'setup.md'
          'getting-started/project-overview.md': 'api/overview.md'
          'getting-started/terminology.md': 'api/overview.md'
          'getting-started/android-operator-apk.md': 'api/devices.md'
          'ai-agents/agent-quickstart.md': 'setup.md'
          'ai-agents/node-api-for-agents.md': 'api/overview.md'
          'ai-agents/android-recording.md': 'api/recording.md'
          'ai-agents/navigation-patterns.md': 'api/navigation.md'
          'ai-agents/multi-device-workflows.md': 'api/devices.md'
          'architecture/architecture.md': 'api/overview.md'
          'reference/api-overview.md': 'api/overview.md'
          'reference/cli-reference.md': 'api/cli.md'
          'reference/action-types.md': 'api/actions.md'
          'reference/execution-model.md': 'api/overview.md'
          'reference/timeout-budgeting.md': 'api/timeouts.md'
          'reference/device-and-package-model.md': 'api/devices.md'
          'reference/snapshot-format.md': 'api/snapshot.md'
          'reference/error-codes.md': 'api/errors.md'
          'reference/error-handling.md': 'api/errors.md'
          'reference/node-api-doctor.md': 'api/doctor.md'
          'reference/environment-variables.md': 'api/environment.md'
          'design/node-api-design.md': 'api/overview.md'
          'design/operator-llm-playbook.md': 'api/overview.md'
          'design/skill-design.md': 'skills/overview.md'
          'troubleshooting/troubleshooting.md': 'troubleshooting/operator.md'
          'troubleshooting/crash-logs.md': 'troubleshooting/operator.md'
          'skills/usage-model.md': 'skills/overview.md'
          'skills/skill-from-recording.md': 'skills/authoring.md'
          'skills/skill-development-workflow.md': 'skills/development.md'
          'skills/skill-authoring-guidelines.md': 'skills/authoring.md'
          'skills/device-prep-and-runtime-tips.md': 'skills/runtime.md'
          'skills/blocked-terms-policy.md': 'skills/authoring.md'
  ```

**`generate_llms_full.py`** - Significant rewrite. This script generates `llms-full.txt`, the primary artifact of the entire docs system. Current implementation walks `source-map.yaml` sections with `title` and `pages` lists, reads from `sites/docs/docs/`. Must be rewritten to:
- Parse `mkdocs.yml` nav structure (nested YAML, different format from source-map sections)
- Read page content from `sites/docs/.build/` instead of `sites/docs/docs/`
- Preserve the three output locations: `sites/docs/site/llms-full.txt`, `sites/docs/static/llms-full.txt`, `sites/landing/public/llms-full.txt`
- Handle nested nav entries correctly (section titles from nav keys, page paths from nav values)

This is not a trivial path change - it is a structural rewrite of the input parsing.

**`validate_docs_routes.py`** - Significant update. Current implementation takes `--generated-docs-dir` pointing at `sites/docs/docs/` and `--source-map` to discover expected routes. Must be updated to:
- Discover expected routes from `mkdocs.yml` nav instead of (or in addition to) source-map
- Validate against `.build/` directory instead of `sites/docs/docs/`
- Add inner-page relative link validation (`check_inner_page_links`)
- Update `--generated-docs-dir` flag to point at `.build/` (or rename the flag for clarity)

**`sitemaps-generate` skill** - The `generate_sitemap_metadata.py` script currently runs after MkDocs build and patches `sitemap.xml` using `source-map.yaml`. Since `source-map.yaml` is being dramatically reduced, this script must be updated to work with the new format or removed if MkDocs-native sitemap generation is sufficient. Evaluate during PR-1 implementation.

**`validate_source_of_truth.py`** - Dramatically simplified or removed. Drift is no longer possible for authored pages (source = output). Only needed for code-derived pages, which can be validated by checking that generator inputs haven't changed without re-running assembly.

**`diff_report.py` / `build_inventory.py` / `write_build_metadata.py`** - May be retired. The churn gating was designed to prevent large agent-driven rewrites of committed generated output. With no committed generated output, the primary use case is gone. Churn control for authored docs is handled by normal PR review.

**`docs-generate` skill** - Rearchitected. Becomes the home for all docs build tooling. The skill's `scripts/` directory contains:

| Script | Purpose |
|--------|---------|
| `assemble.sh` (or `.py`) | Entry point: deterministic assembly (copy authored, copy cross-repo, generate code-derived, expand markers, validate staging) |
| `generate_cli_reference.py` | Generate `api/cli.md` from `registry.ts` + command modules |
| `generate_error_table.py` | Generate error code table for marker expansion in `api/errors.md` |
| `generate_selector_table.py` | Generate selector flag table for marker expansion in `api/selectors.md` |

These replace agent-driven generation with deterministic scripts. `docs_build.sh` calls `.agents/skills/docs-generate/scripts/assemble.sh` as its first step.

The skill SKILL.md is updated to document:
- The assembly pipeline and its phases
- How to add new code-derived or cross-repo pages
- How to add new marker expansions

**`docs-validate` skill** - Simplified. Validates that:
- All pages in `mkdocs.yml` nav exist in `docs/` (authored) or are defined in `source-map.yaml` (code-derived)
- Code-derived generators are up to date (code inputs haven't changed without regeneration)
- No authored page accidentally edits a gitignored path

**`llms.txt`** - Rewrite both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt` to point at canonical pages.

**`llms-full.txt`** - Generated at build time from assembled `.build/` directory, written to `sites/docs/static/llms-full.txt` and `sites/landing/public/llms-full.txt`.

---

## 7. Internal Docs Handling

### Policy

Internal docs live in `docs/internal/`. This directory is:
- Never listed in `mkdocs.yml` nav
- Never copied to the build staging directory by the assembly script
- Structurally invisible to the public docs site

The `docs/internal/` convention gives agents and contributors a clear signal: everything outside `docs/internal/` is public, everything inside is contributor-only. No cross-referencing `mkdocs.yml` required to determine a file's status.

The assembly script enforces this: it skips `docs/internal/` entirely and only copies files referenced in `mkdocs.yml` nav.

### Internal Docs (Post-Refactor)

Files moved to `docs/internal/`:

- `docs/internal/conformance-apk.md`
- `docs/internal/release-procedure.md`
- `docs/internal/release-reference.md`
- `docs/internal/site-hosting.md`
- `docs/internal/design/node-api-design.md`
- `docs/internal/design/operator-llm-playbook.md`
- `docs/internal/design/skill-design.md`
- `docs/internal/design/generative-engine-optimization.md`
- `docs/internal/design/node-api-design-guiding-principles.md`

---

## 8. Integration with Related Tasks

### Folded-in work (from previously separate tasks)

These items were tracked separately but are now part of this plan:

- **Inner-page relative link validation** (was `tasks/docs/validate/`): Add `check_inner_page_links` to `validate_docs_routes.py`. Required because every page is moving.
- **API overview disposition** (was `tasks/docs/api-overview/`): `api/overview.md` is a single authored source. The curated mode is eliminated.
- **Doctor `docsUrl`** (was PRD-1): Add `docsUrl?: string` to `fix` type, render in pretty mode, populate for initial checks.
- **`~/.clawperator/AGENTS.md`** (was PRD-1): Generate from `install.sh` with updated command examples and page URLs.
- **`llms.txt` alignment** (was PRD-1): Final step of this plan.

### Task files to delete after all work completes

- `tasks/docs/refactor/plan.md` (this file)
- `tasks/docs/refactor/work-breakdown.md`

### Out of scope

- Landing page update (`sites/landing/app/page.js`) - follow-up PR after docs refactor lands.

---

## 9. Execution Sequence

This work ships as 3 PRs, strictly sequenced. Each PR is independently shippable and leaves the build in a working state.

This is a migration, not a perfection pass. Prioritize coherent structure, correct core documentation, and a deterministic build pipeline. Do not over-polish secondary pages in the first pass. Prefer shipping a clean, correct, strongly structured system that can be refined in follow-up PRs.

**Review artifact:** For content PRs (PR-2 and PR-3), `llms-full.txt` is the canonical review artifact - not the HTML site. Reviewing the concatenated text file gives the most accurate picture of what agents will consume. The HTML site is a projection and may obscure structural issues visible in the flat text.

### PR-1: Pipeline + skeleton

**Scope:** Phase 0 (migration prep) + Phase 1 (infrastructure) + placeholder content for all 22 pages.

**Goal:** New build pipeline works end-to-end. Old URLs redirect. Site serves placeholder pages. No content judgment needed in review.

**Recommended model:** fast. This is mechanical infrastructure work - scripts, config files, gitignore, placeholders. No content judgment or code verification needed.

Steps:
1. Create reference snapshot: copy all current public docs sources into `tasks/docs/refactor/reference/` with README marking it non-authoritative
2. Create `docs/api/`, `docs/skills/`, and `docs/troubleshooting/` directories
3. Add `.gitignore` entries: `docs/api/cli.md`, `sites/docs/.build/`, `sites/docs/docs/`
4. `git rm -r sites/docs/docs/` - remove generated docs from git
5. Write `.agents/skills/docs-generate/scripts/assemble.sh` with clear phase boundaries (resolve_pages, clean_staging, copy_authored, generate_code_derived, apply_markers, validate_build)
6. Write generator scripts in `.agents/skills/docs-generate/scripts/`: `generate_cli_reference.py`, `generate_error_table.py`, `generate_selector_table.py`
7. Rewrite `source-map.yaml` to reduced assembly manifest (code-derived and markers only)
8. Rewrite `mkdocs.yml`: new nav tree, `docs_dir: .build`, add `mkdocs-redirects` plugin with redirect map
9. Add `mkdocs-redirects` to `sites/docs/requirements.txt`
10. Update `docs_build.sh` to call assembly script before MkDocs build; update or remove `sitemaps-generate` script call (it currently depends on old source-map format); update `validate_docs_routes.py` invocation flags
11. Rewrite `generate_llms_full.py` to parse `mkdocs.yml` nav (not source-map sections), read from `.build/`, preserve three output paths. This is a structural rewrite, not a path change.
12. Update `validate_docs_routes.py`: discover expected routes from `mkdocs.yml` nav, validate against `.build/`, add inner-page relative link validation
13. Simplify or remove `validate_source_of_truth.py`
14. Create placeholder pages in `docs/` for all 20 nav entries (minimal: `# Page Title\n\nPlaceholder - content coming in PR-2/PR-3.`)
15. Add `docs-build` job to `.github/workflows/pull-request.yml` - install Python deps, run `docs_build.sh`, fail on error. This is critical: Cloudflare deploys on merge to main, so a broken build in any PR means a broken live site.
16. Verify pipeline works end-to-end: assembly, MkDocs build, llms-full generation, redirects

**Estimated scope:** ~15-20 files. Pure infrastructure.

**Acceptance:**
- `./scripts/docs_build.sh` succeeds
- `sites/docs/.build/` contains all 22 pages
- `llms-full.txt` generates in nav order
- At least 5 old URL redirects resolve correctly
- No `sites/docs/docs/` in git
- CI `docs-build` job passes on the PR

### PR-2: Core content + code changes

**Scope:** The 9 highest-impact authored pages + code-derived CLI reference + doctor/AGENTS.md code changes. These are the pages agents hit first and most often, and the pages requiring the most verification against code.

**Goal:** The critical API surface is documented accurately. Agents can perform setup, execute commands, use selectors, handle errors, and target devices using only the new docs.

**Recommended model:** thinking. These are the highest-stakes pages requiring cross-referencing code against docs, verifying contract accuracy, and writing precise technical content. Code changes (doctor docsUrl) also need careful reasoning.

Follow migration mode rules throughout: one page at a time, verify against code, commit after each page.

Pages (in authoring order):
1. `docs/setup.md` - single setup path (agent/OpenClaw-friendly)
2. `docs/api/overview.md` - execution model, result envelope, core concepts
3. `docs/api/actions.md` - all action types with params, outputs, failure modes
4. `docs/api/selectors.md` - selector flags, matcher contract, container targeting (with `<!-- CODE-DERIVED: selector-flags -->` marker)
5. `docs/api/errors.md` - all error codes with recovery guidance (with `<!-- CODE-DERIVED: error-codes -->` marker)
6. `docs/api/cli.md` - verify generated output from `generate_cli_reference.py`
7. `docs/api/devices.md` - device targeting + multi-device
8. `docs/api/doctor.md` - readiness checks
9. `docs/api/serve.md` - HTTP/SSE server contract

Code changes:
10. Doctor `docsUrl` in fix type (`apps/node/src/contracts/doctor.ts`)
11. Doctor `docsUrl` rendering (`apps/node/src/cli/commands/doctor.ts`)
12. Populate `docsUrl` in readiness checks (`apps/node/src/domain/doctor/checks/`)
13. Unit tests for doctor changes (T1-T4)
14. `~/.clawperator/AGENTS.md` generation in `install.sh`

**Estimated scope:** ~12-15 files. High-stakes content requiring careful review.

**Acceptance:**
- `./scripts/docs_build.sh` succeeds
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes
- Doctor `docsUrl` unit tests pass
- All 9 pages verified against code (commit messages cite sources)
- Zero occurrences of "receiver", deprecated command forms, or deprecated flag names in new pages
- Selector mutual exclusion rules documented
- New error codes documented

### PR-3: Remaining content + cleanup

**Scope:** Secondary API pages, skills pages, troubleshooting pages, index page, llms artifacts, old file deletion, and repo metadata updates.

**Goal:** All 22 pages are final content. Old docs deleted. Repo is clean. llms artifacts are finalized.

**Recommended model:** default. Secondary pages need accurate content but are less complex than PR-2. Cleanup tasks (moves, deletes, metadata updates) are mechanical. Default balances quality with throughput.

Remaining content pages:
1. `docs/api/snapshot.md` - snapshot format
2. `docs/api/timeouts.md` - timeout budgeting
3. `docs/api/environment.md` - environment variables
4. `docs/api/navigation.md` - navigation patterns
5. `docs/api/recording.md` - recording format
6. `docs/skills/overview.md` - usage model
7. `docs/skills/authoring.md` - authoring guidelines + recording + blocked-terms
8. `docs/skills/development.md` - development workflow
9. `docs/skills/runtime.md` - device prep and runtime
10. `docs/troubleshooting/operator.md` - troubleshooting + crash logs
11. `docs/index.md` - minimal routing page (write last)

Move with minimal changes:
12. `docs/troubleshooting/known-issues.md` (from `docs/known-issues.md`)
13. `docs/troubleshooting/compatibility.md` (from `docs/compatibility.md`)

Finalize artifacts:
14. Rewrite `llms.txt` (both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt`)
15. Verify `llms-full.txt` is coherent top-to-bottom

Cleanup:
16. Move internal docs to `docs/internal/`: `conformance-apk.md`, `release-procedure.md`, `release-reference.md`, `site-hosting.md`, `design/` (entire directory)
17. Delete old source files:
    - Remove `docs/reference/`, `docs/ai-agents/` directories
    - Remove absorbed files: `agent-quickstart.md`, `first-time-setup.md`, `openclaw-first-run.md`, `running-clawperator-on-android.md`, `project-overview.md`, `terminology.md`, `android-operator-apk.md`, `architecture.md`, `node-api-for-agents.md`, `snapshot-format.md`, `navigation-patterns.md`, `multi-device-workflows.md`, `crash-logs.md`, `troubleshooting.md`, `compatibility.md`, `known-issues.md`
18. Update skills repo: replace docs with lightweight pointers to `https://docs.clawperator.com/skills/`
19. Delete reference snapshot: `tasks/docs/refactor/reference/`
20. Update `CLAUDE.md` to reflect new docs structure and pipeline
21. Update `docs-generate` and `docs-validate` skill SKILL.md files
22. Retire or simplify `diff_report.py`, `build_inventory.py`, `validate_source_of_truth.py`
23. Delete task files listed in Section 8

**Estimated scope:** ~25+ files but mostly mechanical. Secondary pages are simpler (less multi-source absorption, more straightforward moves/rewrites).

**Acceptance:**
- All acceptance criteria from Section 10 pass
- `./scripts/docs_build.sh` succeeds with zero warnings
- `llms-full.txt` contains all 22 pages, coherent top-to-bottom
- No old docs remain outside `docs/internal/`
- No placeholder pages remain
- Skills repo updated with pointer docs
- `CLAUDE.md` reflects new reality

---

## 10. Validation / Acceptance Criteria

### Build and Test

- [ ] `./scripts/docs_build.sh` succeeds with zero warnings (includes assembly + MkDocs build + llms-full generation + route validation)
- [ ] `npm --prefix apps/node run build` succeeds
- [ ] `npm --prefix apps/node run test` passes
- [ ] Doctor `docsUrl` unit tests pass (T1-T4)

### Pipeline Architecture

- [ ] `sites/docs/docs/` does not exist in git (removed from tracking, in `.gitignore`)
- [ ] `sites/docs/.build/` is gitignored
- [ ] `docs/api/cli.md` is gitignored (code-derived)
- [ ] `docs/skills/` is authored (not gitignored, not cross-repo)
- [ ] `assemble.sh` produces a complete staging directory deterministically
- [ ] MkDocs `docs_dir` points to `.build/`
- [ ] `source-map.yaml` only contains code-derived and marker entries (no authored copy pages, no cross-repo)

### Structural Integrity

- [ ] Every page in `mkdocs.yml` nav exists in assembled `sites/docs/.build/`
- [ ] No unexpected page in `.build/` is absent from `mkdocs.yml` nav (excluding redirects)
- [ ] No page appears in more than one nav section
- [ ] No two pages cover the same concept as primary content
- [ ] All relative links in assembled pages resolve to valid output pages
- [ ] `validate_docs_routes.py` passes including inner-page relative link checks

### Machine-Facing Artifacts

- [ ] Every URL in `llms.txt` resolves to a built HTML page
- [ ] `llms-full.txt` contains all 22 pages in nav order, no missing sections
- [ ] `llms-full.txt` is coherent top-to-bottom (no orphaned cross-references, no undefined terms)

### Content Accuracy

- [ ] All CLI examples use flat commands (`snapshot`, `click`, `press`, not `observe snapshot`, `action click`, `action press-key`)
- [ ] All flag references use canonical names (`--device`, `--json`, `--timeout`, `--operator-package`)
- [ ] Zero occurrences of "receiver" in authored docs under `docs/` (replaced by "operator")
- [ ] Zero occurrences of deprecated command forms in authored docs
- [ ] Zero occurrences of deprecated flag names (`--timeout-ms`, `--output json` without `--json` context) in authored docs
- [ ] Selector mutual exclusion rules documented in `docs/api/selectors.md`
- [ ] New error codes (`MISSING_SELECTOR`, `MISSING_ARGUMENT`, `UNKNOWN_COMMAND` with `suggestion`) documented in `docs/api/errors.md`
- [ ] `serve` command HTTP/SSE contract documented in `docs/api/serve.md`
- [ ] Code-derived markers (`<!-- CODE-DERIVED: error-codes -->`, `<!-- CODE-DERIVED: selector-flags -->`) expand correctly in assembled output

### Surface Area Reduction

- [ ] Total public pages: 20 (down from 33)
- [ ] Zero persona sections in nav
- [ ] Zero "recommended paths" sections
- [ ] Zero standalone architecture/design pages in public nav
- [ ] `node-api-for-agents.md` does not exist as a public page
- [ ] `reference/api-overview.md` does not exist
- [ ] Old `docs/reference/`, `docs/ai-agents/` directories are removed
