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

---

## 1a. Architectural Constraints

### Source structure = output structure

Authored docs live in `docs/` and are structured to match the final published layout directly. There is no intermediate "generated docs" directory committed to git. The build pipeline assembles a staging directory from authored sources + code-derived content + cross-repo copies, and MkDocs reads from that staging directory.

This eliminates the false editing surface (`sites/docs/docs/`), makes drift architecturally impossible for authored pages, and means agents edit the file that gets published.

### Authority hierarchy

- `mkdocs.yml` is the canonical navigation and page ordering.
- `source-map.yaml` is reduced to a build assembly manifest. It defines only:
  - Code-derived pages (what code files generate what output)
  - Cross-repo copies (what skills docs map to what output paths, with link rewrite rules)
  - Marker expansion specs (what authored pages contain `<!-- CODE-DERIVED: xxx -->` markers)
- Authored pages that map 1:1 from `docs/` to output need no entry in `source-map.yaml`. Their presence in `mkdocs.yml` nav is sufficient.
- If a page is in `mkdocs.yml` nav but missing from both `docs/` and `source-map.yaml`, the build fails.

### Link correctness

- Authored intra-repo links: correct by construction because source paths match output paths. A link from `docs/api/actions.md` to `../setup.md` resolves identically in source and output.
- Cross-repo links (skills docs copied from `../clawperator-skills/docs/`): rewritten at build time by the assembly script using a mapping table derived from `source-map.yaml`.
- Unresolvable links: must fail the build. No silent broken links.

### Code vs authored precedence

- Code-derived data is authoritative for structure, enumerations, and schemas.
- Authored content augments but cannot override code definitions.
- If code adds a new error code or selector flag, the expanded page must include it. The generator should warn (or fail) on mismatch.
- Marker-based injection: authored files may contain `<!-- CODE-DERIVED: <id> -->` markers. The assembly script replaces these with generated content from code sources. The authored file (with marker) is committed. The expanded file (with injected content) exists only in the build staging directory.

### Page boundary constraints

- `api/overview.md` must not exceed: one screen of concepts, one result envelope definition, one execution flow description. All detailed mechanics live in dedicated pages.
- Core reference pages (actions, selectors, errors) are explicitly designed to be used together. Cross-referencing between them is expected and acceptable. The "self-contained" principle means minimizing cross-dependencies, not eliminating them.

### Build failure conditions

- Any relative link that cannot be resolved to an output page
- Any code-derived enum (error code, selector flag) absent from its target page after marker expansion
- Any page in `mkdocs.yml` nav missing from the assembled staging directory
- Any page in the staging directory absent from `mkdocs.yml` nav (excluding redirects)

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
1. Their content exists in exactly one target page in `docs/`
2. `./scripts/docs_build.sh` succeeds
3. `llms-full.txt` includes the migrated content
4. All validation passes

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

**20 pages total.** Down from 33 current pages (39% reduction).

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
  skills/                           (cross-repo, copied at build time, gitignored)
    overview.md
    authoring.md
    development.md
    runtime.md
  troubleshooting/
    operator.md                     (authored)
    known-issues.md                 (authored)
    compatibility.md                (authored)
  design/                           (internal, not published)
    node-api-design.md
    operator-llm-playbook.md
    skill-design.md
    generative-engine-optimization.md
    node-api-design-guiding-principles.md
  conformance-apk.md                (internal, not published)
  release-procedure.md              (internal, not published)
  release-reference.md              (internal, not published)
  site-hosting.md                   (internal, not published)
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
| `docs/skills/skill-from-recording.md` | DELETE | Merged into skills/authoring in cross-repo |
| `docs/conformance-apk.md` | KEEP (internal) | Stays, not published |
| `docs/release-procedure.md` | KEEP (internal) | Stays, not published |
| `docs/release-reference.md` | KEEP (internal) | Stays, not published |
| `docs/site-hosting.md` | KEEP (internal) | Stays, not published |
| `docs/design/*.md` (all 5) | KEEP (internal) | Stay, not published |

After the refactor, the `docs/reference/`, `docs/ai-agents/`, and `docs/skills/` directories are empty and can be deleted.

### Cross-repo sources in `../clawperator-skills/docs/`

These files are the canonical source for skills docs. They are copied (with link rewriting) to `docs/skills/` at build time. The `docs/skills/` directory is gitignored.

| Source File | Target | Notes |
|------------|--------|-------|
| `usage-model.md` | `docs/skills/overview.md` | Tighten to contract style, update CLI examples |
| `skill-authoring-guidelines.md` | `docs/skills/authoring.md` | Absorb `skill-from-recording.md` + `blocked-terms-policy.md` |
| `skill-development-workflow.md` | `docs/skills/development.md` | Update CLI examples |
| `device-prep-and-runtime-tips.md` | `docs/skills/runtime.md` | Update CLI examples |
| `blocked-terms-policy.md` | DELETE | Absorbed into `skill-authoring-guidelines.md` |
| `skill-from-recording.md` (in this repo) | DELETE | Absorbed into `skill-authoring-guidelines.md` |

Note: The source files in `../clawperator-skills/docs/` must be renamed/restructured to match target filenames. After the refactor, the skills repo files should be named `overview.md`, `authoring.md`, `development.md`, `runtime.md`.

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

1. **Remove `source-map.yaml` entirely**: Partially adopted. The file is dramatically reduced in scope (only tracks code-derived pages, cross-repo copies, and marker expansions) but not eliminated. It still serves as the assembly manifest for the build pipeline. The dual-manifest problem is largely resolved because authored pages no longer appear in source-map.yaml.

2. **Split setup into 3 pages** (install-and-verify, first-command, operator-apk): For agents, one linear page is better. One fetch, one path, no navigation decisions.

3. **Keep skills at 6 pages**: `skill-from-recording.md` and `blocked-terms-policy.md` are small enough to merge into `skills/authoring.md`. Fewer pages = less retrieval ambiguity.

4. **`docs/internal/` directory + frontmatter flag**: Internal docs stay in `docs/` (in their existing locations like `docs/design/`). They are excluded from publishing by not being in `mkdocs.yml` nav and not being copied to the build staging directory. No new mechanism needed.

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
  + source-map.yaml      (assembly manifest for non-trivial pages only)
  + apps/node/src/       (code inputs)
  + ../clawperator-skills/docs/  (cross-repo source)
         |
         v  assemble_docs.sh (deterministic script)

sites/docs/.build/       (gitignored staging directory)
         |
         v  mkdocs build

sites/docs/site/         (gitignored final HTML)
  + llms-full.txt        (generated, copied to static/)
```

### Assembly steps (`assemble_docs.sh`)

This is a new deterministic script (not agent-driven). It runs as the first step of `docs_build.sh`.

1. **Clean staging:** Remove `sites/docs/.build/`, create fresh.
2. **Copy authored pages:** Copy all files from `docs/` that are referenced in `mkdocs.yml` nav to `sites/docs/.build/` preserving directory structure. Internal files (not in nav) are skipped.
3. **Copy cross-repo pages:** Copy skills docs from `../clawperator-skills/docs/` to `sites/docs/.build/skills/`, rewriting relative links using mapping table from `source-map.yaml`.
4. **Generate code-derived pages:** Run generator scripts to produce `sites/docs/.build/api/cli.md` from `registry.ts` and command modules.
5. **Expand code-derived markers:** For authored pages containing `<!-- CODE-DERIVED: <id> -->` markers, copy to staging with markers replaced by generated content. Currently applies to:
   - `api/errors.md`: `<!-- CODE-DERIVED: error-codes -->` expanded from `contracts/errors.ts`
   - `api/selectors.md`: `<!-- CODE-DERIVED: selector-flags -->` expanded from `cli/selectorFlags.ts`
6. **Validate staging:** Verify every page in `mkdocs.yml` nav exists in `.build/`. Fail if any are missing.

### What changes in existing components

**`source-map.yaml`** - Dramatically simplified. No longer lists every page. Only defines:
```yaml
# Assembly manifest - only non-trivial pages need entries
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

cross_repo:
  - source_root: ../clawperator-skills/docs
    target_dir: skills
    files:
      - source: overview.md
      - source: authoring.md
      - source: development.md
      - source: runtime.md
    link_rewrites:
      # source-relative link -> output-relative link
      # (defined as needed for cross-repo links that break)
```

**`sites/docs/docs/`** - Deleted from git. The entire directory is removed from version control. Add to `.gitignore`.

**`sites/docs/.build/`** - New gitignored staging directory. MkDocs `docs_dir` points here.

**`docs/api/cli.md`** - Gitignored. Fully code-derived, generated at build time. Add `docs/api/cli.md` to `.gitignore`.

**`docs/skills/`** - Gitignored. Cross-repo copies, generated at build time. Add `docs/skills/` to `.gitignore`.

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

**`generate_llms_full.py`** - Update to read from `.build/` directory, walk `mkdocs.yml` nav order.

**`validate_docs_routes.py`** - Add inner-page relative link validation. Update to validate against `.build/` directory.

**`validate_source_of_truth.py`** - Dramatically simplified or removed. Drift is no longer possible for authored pages (source = output). Only needed for code-derived pages and cross-repo copies, which can be validated by checking that generator inputs haven't changed without re-running assembly.

**`diff_report.py` / `build_inventory.py`** - May be retired. The churn gating was designed to prevent large agent-driven rewrites of committed generated output. With no committed generated output, the primary use case is gone. Churn control for authored docs is handled by normal PR review.

**`docs-generate` skill** - Scope dramatically reduced. No longer responsible for copying authored pages. Only needed when:
- Generating code-derived content (`api/cli.md`) from code
- Expanding code-derived markers in authored pages
- The skill becomes a wrapper around the deterministic generator scripts, not a full-tree generation agent.

**`docs-validate` skill** - Simplified. Validates that:
- All pages in `mkdocs.yml` nav exist in `docs/` (authored) or are defined in `source-map.yaml` (generated/cross-repo)
- Code-derived generators are up to date (code inputs haven't changed without regeneration)
- No authored page accidentally edits a gitignored path

**`llms.txt`** - Rewrite both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt` to point at canonical pages.

**`llms-full.txt`** - Generated at build time from assembled `.build/` directory, written to `sites/docs/static/llms-full.txt` and `sites/landing/public/llms-full.txt`.

### New scripts to create

| Script | Purpose |
|--------|---------|
| `assemble_docs.sh` (or `.py`) | Deterministic assembly: copy authored pages, copy cross-repo, generate code-derived, expand markers, validate staging |
| `generate_cli_reference.py` | Generate `api/cli.md` from `registry.ts` + command modules |
| `generate_error_table.py` | Generate error code table for marker expansion in `api/errors.md` |
| `generate_selector_table.py` | Generate selector flag table for marker expansion in `api/selectors.md` |

These replace the agent-driven generation with deterministic scripts.

---

## 7. Internal Docs Handling

### Policy

Internal docs are excluded by **not being in `mkdocs.yml` nav**.

The assembly script (`assemble_docs.sh`) only copies files referenced in `mkdocs.yml` nav to the build staging directory. Files in `docs/` that are not in the nav are never copied, never built, and never published.

No frontmatter flags. No `docs/internal/` directory. No special markers. If a file in `docs/` is not in `mkdocs.yml` nav, it is internal. This is enforced architecturally: internal files physically do not exist in the staging directory that MkDocs reads from.

### Internal Docs Inventory (Post-Refactor)

Files in `docs/` that are NOT in `mkdocs.yml` nav and NOT published:

- `docs/conformance-apk.md`
- `docs/release-procedure.md`
- `docs/release-reference.md`
- `docs/site-hosting.md`
- `docs/design/node-api-design.md`
- `docs/design/operator-llm-playbook.md`
- `docs/design/skill-design.md`
- `docs/design/generative-engine-optimization.md`
- `docs/design/node-api-design-guiding-principles.md`

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

### Phase 1: Pipeline Infrastructure

Set up the new build pipeline before writing any content.

1. Create `docs/api/` and `docs/troubleshooting/` directories
2. Add `.gitignore` entries:
   - `docs/api/cli.md` (code-derived)
   - `docs/skills/` (cross-repo copies)
   - `sites/docs/.build/` (staging directory)
3. Remove `sites/docs/docs/` from git tracking (git rm -r, add to `.gitignore`)
4. Write `assemble_docs.sh` - deterministic assembly script (copy authored, copy cross-repo with link rewriting, generate code-derived, expand markers, validate staging)
5. Write generator scripts: `generate_cli_reference.py`, `generate_error_table.py`, `generate_selector_table.py`
6. Rewrite `source-map.yaml` to reduced assembly manifest (code-derived, markers, cross-repo only)
7. Rewrite `mkdocs.yml`: new nav tree, `docs_dir: .build`, add `mkdocs-redirects` plugin with redirect map
8. Add `mkdocs-redirects` to `sites/docs/requirements.txt`
9. Update `docs_build.sh` to call `assemble_docs.sh` before MkDocs build
10. Update `generate_llms_full.py` to read from `.build/`, walk `mkdocs.yml` nav order
11. Update `validate_docs_routes.py`: add inner-page relative link validation, point at `.build/`
12. Simplify `validate_source_of_truth.py` (only validates code-derived pages) or remove
13. Verify pipeline works end-to-end with placeholder content

### Phase 2: Write Source Docs

Author the 20 target pages directly in `docs/` in their final locations. Each uses contract-first style, new flat CLI surface, no historical references, no duplication.

Pages are written to `docs/` in the target structure. Skills pages are written to `../clawperator-skills/docs/` with renamed filenames matching the target.

Priority order (most impactful first):
1. `docs/setup.md` - single setup path
2. `docs/api/overview.md` - execution model, result envelope, core concepts
3. `docs/api/actions.md` - all action types with new commands
4. `docs/api/selectors.md` - selector flags, matcher contract, container targeting (with `<!-- CODE-DERIVED: selector-flags -->` marker)
5. `docs/api/errors.md` - all error codes with recovery guidance (with `<!-- CODE-DERIVED: error-codes -->` marker)
6. `docs/api/cli.md` - generated by `generate_cli_reference.py` (not hand-authored)
7. `docs/api/devices.md` - device targeting + multi-device
8. `docs/api/snapshot.md` - snapshot format
9. `docs/api/doctor.md` - readiness checks
10. `docs/api/timeouts.md` - timeout budgeting
11. `docs/api/environment.md` - environment variables
12. `docs/api/serve.md` - HTTP/SSE server contract
13. `docs/api/navigation.md` - navigation patterns
14. `docs/api/recording.md` - recording format
15. `../clawperator-skills/docs/overview.md` - usage model (renamed from `usage-model.md`)
16. `../clawperator-skills/docs/authoring.md` - authoring guidelines + recording + blocked-terms (renamed, absorbs content)
17. `../clawperator-skills/docs/development.md` - development workflow (renamed from `skill-development-workflow.md`)
18. `../clawperator-skills/docs/runtime.md` - device prep and runtime (renamed from `device-prep-and-runtime-tips.md`)
19. `docs/troubleshooting/operator.md` - troubleshooting + crash logs
20. `docs/index.md` - minimal routing page (write last, after all targets exist)

`docs/troubleshooting/known-issues.md` and `docs/troubleshooting/compatibility.md` are moved from their current locations with minimal changes.

### Phase 3: Code Changes

1. Doctor `docsUrl` in fix type (`apps/node/src/contracts/doctor.ts`)
2. Doctor `docsUrl` rendering (`apps/node/src/cli/commands/doctor.ts`)
3. Populate `docsUrl` in readiness checks (`apps/node/src/domain/doctor/checks/`) - use new page URLs
4. Unit tests for doctor changes (T1-T4 from PRD-1)
5. `~/.clawperator/AGENTS.md` generation in `install.sh`

### Phase 4: Build and Validate

1. Run `assemble_docs.sh` to produce `sites/docs/.build/`
2. Run `./scripts/docs_build.sh` (which now calls assembly + MkDocs build + llms-full generation + validation)
3. Rewrite `llms.txt` (both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt`)
4. Run `validate_docs_routes.py` (with new relative link checking)
5. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`
6. Verify `llms-full.txt` is coherent top-to-bottom

### Phase 5: Cleanup

1. Delete old source files per the deletion criteria in Section 1a:
   - Remove old `docs/reference/`, `docs/ai-agents/`, `docs/skills/` directories (content migrated to new locations)
   - Remove absorbed files: `docs/agent-quickstart.md`, `docs/first-time-setup.md`, `docs/openclaw-first-run.md`, `docs/running-clawperator-on-android.md`, `docs/project-overview.md`, `docs/terminology.md`, `docs/android-operator-apk.md`, `docs/architecture.md`, `docs/node-api-for-agents.md`, `docs/snapshot-format.md`, `docs/navigation-patterns.md`, `docs/multi-device-workflows.md`, `docs/crash-logs.md`, `docs/troubleshooting.md`, `docs/compatibility.md`, `docs/known-issues.md`
2. Delete old skills repo files that were renamed/absorbed: `usage-model.md`, `skill-authoring-guidelines.md`, `skill-development-workflow.md`, `device-prep-and-runtime-tips.md`, `blocked-terms-policy.md`, `skill-from-recording.md`
3. Delete task files listed in Section 8
4. Delete `tasks/docs/refactor/docs-pipeline-proposal.md`
5. Update `CLAUDE.md` to reflect new docs structure and pipeline
6. Update `docs-generate` and `docs-validate` skill SKILL.md files to reflect new pipeline

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
- [ ] `docs/skills/` is gitignored (cross-repo copies)
- [ ] `assemble_docs.sh` produces a complete staging directory deterministically
- [ ] MkDocs `docs_dir` points to `.build/`
- [ ] `source-map.yaml` only contains code-derived, marker, and cross-repo entries (no authored copy pages)

### Structural Integrity

- [ ] Every page in `mkdocs.yml` nav exists in assembled `sites/docs/.build/`
- [ ] No unexpected page in `.build/` is absent from `mkdocs.yml` nav (excluding redirects)
- [ ] No page appears in more than one nav section
- [ ] No two pages cover the same concept as primary content
- [ ] All relative links in assembled pages resolve to valid output pages
- [ ] `validate_docs_routes.py` passes including inner-page relative link checks

### Machine-Facing Artifacts

- [ ] Every URL in `llms.txt` resolves to a built HTML page
- [ ] `llms-full.txt` contains all 20 pages in nav order, no missing sections
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
