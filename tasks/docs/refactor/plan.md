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

These rules prevent drift between the two manifest files and the generation pipeline.

**Authority hierarchy:**
- `mkdocs.yml` is the canonical navigation and page ordering.
- `source-map.yaml` is a flat composition manifest keyed by output path. It must align exactly with `mkdocs.yml` and must not define independent structure, ordering, or sectioning.
- If the two files disagree, `mkdocs.yml` wins. The build should fail.

**Link rewriting:**
- All relative links in source docs must be rewritten during generation to match final output paths defined in `source-map.yaml`.
- Intra-repo links: resolved via output path lookup in source-map.
- Cross-repo links (clawperator-skills): resolved via the same source-map mapping table.
- Unresolvable links: must fail the build. No silent broken links.

**Code vs authored precedence (curated pages):**
- Code-derived data is authoritative for structure, enumerations, and schemas.
- Authored content augments but cannot override code definitions.
- If code adds a new error code or selector flag, the curated page must include it. The generator should warn (or fail) on mismatch.

**Page boundary constraints:**
- `api/overview.md` must not exceed: one screen of concepts, one result envelope definition, one execution flow description. All detailed mechanics live in dedicated pages.
- Core reference pages (actions, selectors, errors) are explicitly designed to be used together. Cross-referencing between them is expected and acceptable. The "self-contained" principle means minimizing cross-dependencies, not eliminating them.

**Build failure conditions:**
- Any relative link that cannot be resolved to an output page
- Any code-derived enum (error code, selector flag) absent from its target curated page
- Any page in `mkdocs.yml` nav missing from disk
- Any page on disk in `sites/docs/docs/` absent from `mkdocs.yml` nav (excluding redirects)
- Any `source-map.yaml` output path not present in `mkdocs.yml` nav

**Terminology consistency:**
- Canonical terms must be used throughout. No synonyms.
  - "operator" (not "receiver")
  - "action" (not "command" when referring to execution payload actions)
  - "selector" (not "matcher" unless referring to the internal `NodeMatcher` type specifically)
  - "device" flag is `--device` (not `--device-id` as primary)
  - "timeout" flag is `--timeout` (not `--timeout-ms`)
- Each term is defined at first use on the page that owns the concept. Other pages use the term without redefining it.

**Source file deletion criteria:**
- A source file may only be deleted after:
  1. Its content exists in exactly one target page
  2. `docs-validate` passes
  3. `llms-full.txt` includes the migrated content
  4. `./scripts/docs_build.sh` succeeds
- Until all four conditions are met, the old source file remains.

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

### Source docs in `docs/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/index.md` | MODIFY | Rewrite as minimal routing page: 4 sections, links to machine-facing entrypoints, no link dumps |
| `docs/agent-quickstart.md` | DELETE | Absorbed into `setup.md` |
| `docs/first-time-setup.md` | MODIFY | Core of new `setup.md` - rewrite as single linear path |
| `docs/openclaw-first-run.md` | DELETE | OpenClaw-specific steps folded into `setup.md` as a short callout |
| `docs/running-clawperator-on-android.md` | DELETE | Actuator model to `api/overview.md`; setup steps to `setup.md` |
| `docs/project-overview.md` | DELETE | Mission absorbed into `api/overview.md` (2-3 lines); rest deleted |
| `docs/terminology.md` | DELETE | Terms defined inline where used; no standalone glossary |
| `docs/android-operator-apk.md` | DELETE | Package variants to `setup.md` and `api/devices.md` |
| `docs/architecture.md` | DELETE | Two-layer model absorbed into `api/overview.md` |
| `docs/node-api-for-agents.md` | DELETE | Split: execution model to `api/overview.md`, CLI to `api/cli.md`, actions to `api/actions.md`, selectors to `api/selectors.md`, errors to `api/errors.md`, serve to `api/serve.md` |
| `docs/snapshot-format.md` | MODIFY | Becomes `api/snapshot.md` - update for current contract |
| `docs/navigation-patterns.md` | MODIFY | Becomes `api/navigation.md` - update CLI examples to flat commands |
| `docs/multi-device-workflows.md` | DELETE | Merged into `api/devices.md` |
| `docs/compatibility.md` | KEEP | Becomes `troubleshooting/compatibility.md` - minimal changes |
| `docs/troubleshooting.md` | MODIFY | Becomes `troubleshooting/operator.md` - absorb crash-logs content |
| `docs/known-issues.md` | KEEP | Becomes `troubleshooting/known-issues.md` - minimal changes |
| `docs/crash-logs.md` | DELETE | Merged into `troubleshooting/operator.md` |
| `docs/conformance-apk.md` | INTERNAL | Not in public docs; remains in repo |
| `docs/release-procedure.md` | INTERNAL | Not in public docs; remains in repo |
| `docs/release-reference.md` | INTERNAL | Not in public docs; remains in repo |
| `docs/site-hosting.md` | INTERNAL | Not in public docs; remains in repo |

### Source docs in `docs/ai-agents/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/ai-agents/android-recording.md` | MODIFY | Becomes `api/recording.md` - remove persona framing, update contract |

### Source docs in `docs/reference/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/reference/action-types.md` | MODIFY | Becomes `api/actions.md` - absorb from `node-api-for-agents.md`, add new flat commands, extract selectors to `api/selectors.md` |
| `docs/reference/execution-model.md` | DELETE | Absorbed into `api/overview.md` |
| `docs/reference/timeout-budgeting.md` | MODIFY | Becomes `api/timeouts.md` - update examples to new CLI surface |
| `docs/reference/device-and-package-model.md` | MODIFY | Becomes `api/devices.md` - absorb multi-device content |
| `docs/reference/error-handling.md` | DELETE | Merged into `api/errors.md` |
| `docs/reference/node-api-doctor.md` | MODIFY | Becomes `api/doctor.md` - update for docsUrl and current behavior |
| `docs/reference/environment-variables.md` | MODIFY | Becomes `api/environment.md` - update env var names |

### Source docs in `docs/design/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/design/node-api-design.md` | INTERNAL | Remove from public docs. Keep in repo. |
| `docs/design/operator-llm-playbook.md` | INTERNAL | Remove from public docs. Keep in repo. |
| `docs/design/skill-design.md` | INTERNAL | Remove from public docs. Keep in repo. |
| `docs/design/generative-engine-optimization.md` | INTERNAL | Remove from public docs. Keep in repo. |
| `docs/design/node-api-design-guiding-principles.md` | INTERNAL | Remove from public docs. Keep in repo. |

### Source docs in `docs/skills/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/skills/skill-from-recording.md` | DELETE | Merged into `skills/authoring.md` |

### Source docs in `../clawperator-skills/docs/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `usage-model.md` | MODIFY | Becomes `skills/overview.md` - tighten to contract style |
| `skill-development-workflow.md` | MODIFY | Becomes `skills/development.md` - update CLI examples |
| `skill-authoring-guidelines.md` | MODIFY | Becomes `skills/authoring.md` - absorb recording + blocked-terms |
| `device-prep-and-runtime-tips.md` | MODIFY | Becomes `skills/runtime.md` - update CLI examples |
| `blocked-terms-policy.md` | DELETE | Absorbed into `skills/authoring.md` |

### Code-derived sources in `apps/node/`

| Source | Classification | Role |
|--------|---------------|------|
| `apps/node/src/cli/registry.ts` | KEEP | Primary generator input for `api/cli.md` |
| `apps/node/src/cli/selectorFlags.ts` | KEEP | Generator input for `api/selectors.md` |
| `apps/node/src/cli/commands/serve.ts` | KEEP | Source for `api/serve.md` |
| `apps/node/src/contracts/errors.ts` | KEEP | Generator input for error codes in `api/errors.md` |
| `apps/node/src/contracts/result.ts` | KEEP | Source for result envelope in `api/overview.md` |
| `apps/node/src/contracts/execution.ts` | KEEP | Source for execution payload in `api/overview.md` |
| `apps/node/src/contracts/selectors.ts` | KEEP | Source for matcher contract in `api/selectors.md` |
| `apps/node/src/contracts/doctor.ts` | KEEP | Source for doctor report in `api/doctor.md` |

---

## 5. Comparison-Informed Improvements

### Adopted from codex-plan

1. **Separate selectors page** (`api/selectors.md`): Selectors are a cross-cutting concept used by click, scroll, read, wait-for-node, and other commands. A dedicated canonical page avoids duplication across action entries and gives agents a single fetch target for "how do I specify a target element." Strongest structural improvement from codex.

2. **Serve API page** (`api/serve.md`): The `serve` command exists in `registry.ts` with HTTP/SSE surface. Agents using remote control need this contract documented.

3. **Nav-driven `llms-full.txt` generation**: `generate_llms_full.py` should walk `mkdocs.yml` nav order, not source-map sections. This ensures the primary artifact and the docs site share the same ordering.

4. **`selectorFlags.ts` as explicit generator input**: This file is the canonical definition of shorthand selector flags and should be an explicit code source for `api/selectors.md`.

### Rejected from codex-plan

1. **Remove `source-map.yaml` entirely**: Too disruptive. The docs-generate skill, docs-validate skill, and `generate_llms_full.py` all depend on it. Rewriting the entire pipeline is not justified when source-map.yaml can be updated to match the new structure. The dual-manifest concern is valid but deferred.

2. **Split setup into 3 pages** (install-and-verify, first-command, operator-apk): For agents, one linear page is better. One fetch, one path, no navigation decisions.

3. **Keep skills at 6 pages**: `skill-from-recording.md` and `blocked-terms-policy.md` are small enough to merge into `skills/authoring.md`. Fewer pages = less retrieval ambiguity.

4. **`docs/internal/` directory + frontmatter flag**: Overengineering for pre-alpha. Current "not in source-map = not published" convention works.

5. **Merge timeouts into execution contract**: Would make `api/overview.md` too heavy. Timeout budgeting is distinct operational guidance.

6. **Split navigation-patterns across selectors + recovery**: Navigation patterns content is operational agent guidance that doesn't fit neatly into either destination. Keep as standalone page.

7. **Separate error-codes and error-recovery pages**: Single `api/errors.md` means one fetch for both code meaning and recovery action.

---

## 6. Pipeline / Generation Plan

### Current Pipeline

```
source-map.yaml  -->  docs-generate skill  -->  sites/docs/docs/  -->  mkdocs build  -->  site/
                                            -->  generate_llms_full.py  -->  llms-full.txt
```

### Pipeline After Refactor

Same flow, updated inputs:

1. **`source-map.yaml`** - Full rewrite. 4 sections, 20 pages. Modes:
   - `api/cli.md`: `mode: code-derived` from `registry.ts` + command modules
   - `api/errors.md`: `mode: curated` - merges code-derived error codes with authored recovery guidance
   - `api/selectors.md`: `mode: curated` - merges code-derived flag definitions with authored matcher contract
   - All other pages: `mode: copy` from a single authored source file
   - Temporarily increase churn limits (`max_changed_files`, `max_line_churn`, `max_percent_churn`) for the refactor. Restore maintenance-safe values after landing.

2. **`mkdocs.yml`** - Full nav rewrite matching Section 3. Add `mkdocs-redirects` plugin:
   - Add `mkdocs-redirects` to `sites/docs/requirements.txt`
   - Add redirect map covering all old page paths to new destinations. This is a one-time migration artifact - after the refactor lands, the map is static and does not require ongoing maintenance:
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

3. **`generate_llms_full.py`** - Update to walk `mkdocs.yml` nav order for page concatenation instead of source-map section order. This ensures `llms-full.txt` matches the canonical navigation.

4. **`docs-generate` skill** - Update SKILL.md with new page list, source mapping, and churn thresholds.

5. **`docs-validate` skill** - No structural changes needed. Source-map-driven validation still works after the source-map rewrite.

6. **`validate_docs_routes.py`** - Add inner-page relative link validation (`check_inner_page_links`).

7. **`llms.txt`** - Rewrite both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt` to point at canonical pages.

8. **`llms-full.txt`** - Regenerate from final nav order after all source pages are written.

---

## 7. Internal Docs Handling

### Policy

Internal docs are excluded by **not being in `source-map.yaml`**.

No frontmatter flags. No `docs/internal/` directory. No special markers. If a file in `docs/` is not listed in `source-map.yaml`, it is internal. The generated output and public site only contain what the source-map specifies.

This is the existing de facto behavior. This refactor formalizes it by also removing `docs/design/` pages from the source-map.

### Internal Docs Inventory (Post-Refactor)

Files in `docs/` that are NOT in `source-map.yaml` and NOT published:

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

### `tasks/docs/validate/todo.md` - MERGE

Inner-page relative link validation is required for this refactor - moving every page without it would leave broken links undetected. Add `check_inner_page_links` to `validate_docs_routes.py`. Delete the task file after completion.

### `tasks/docs/api-overview/todo.md` - MERGE

This refactor answers the question: `api/overview.md` is a single authored source with `mode: copy`. The curated mode for api-overview is eliminated. Delete the task file after completion.

### PRD-1 Code Changes - FOLD IN

- Doctor `docsUrl` field: add `docsUrl?: string` to `fix` type, render in pretty mode, populate for initial checks
- `~/.clawperator/AGENTS.md` generated by `install.sh`: implement with updated command examples and page URLs
- `llms.txt` alignment: final step of this plan

### Task Files to Delete After Completion

- `tasks/docs/validate/todo.md`
- `tasks/docs/api-overview/todo.md`
- `tasks/docs/refactor/claude-plan.md`
- `tasks/docs/refactor/codex-plan.md`
- `tasks/docs/refactor/prd-1-entry-points.md`
- `tasks/docs/refactor/prd-2-structure.md`
- `tasks/docs/refactor/chat-session.md`

### Landing Page Update - SEPARATE

Follow-up PR after docs refactor lands.

---

## 9. Execution Sequence

### Phase 1: Infrastructure

1. Add `mkdocs-redirects` to `sites/docs/requirements.txt`
2. Rewrite `source-map.yaml` with new 4-section, 20-page structure (increase churn limits)
3. Rewrite `mkdocs.yml` nav tree and add redirect maps
4. Add `check_inner_page_links` to `validate_docs_routes.py`

### Phase 2: Write Source Docs

Author the 20 target pages. Each uses contract-first style, new flat CLI surface, no historical references, no duplication.

Priority order (most impactful first):
1. `setup.md` - single setup path
2. `api/overview.md` - execution model, result envelope, core concepts
3. `api/actions.md` - all action types with new commands
4. `api/selectors.md` - selector flags, matcher contract, container targeting
5. `api/errors.md` - all error codes with recovery guidance
6. `api/cli.md` - regenerate from code
7. `api/devices.md` - device targeting + multi-device
8. `api/snapshot.md` - snapshot format
9. `api/doctor.md` - readiness checks
10. `api/timeouts.md` - timeout budgeting
11. `api/environment.md` - environment variables
12. `api/serve.md` - HTTP/SSE server contract
13. `api/navigation.md` - navigation patterns
14. `api/recording.md` - recording format
15. `skills/overview.md` - usage model
16. `skills/authoring.md` - authoring guidelines + recording + blocked-terms
17. `skills/development.md` - development workflow
18. `skills/runtime.md` - device prep and runtime
19. `troubleshooting/operator.md` - troubleshooting + crash logs
20. `index.md` - minimal routing page (write last, after all targets exist)

### Phase 3: Code Changes

1. Doctor `docsUrl` in fix type (`apps/node/src/contracts/doctor.ts`)
2. Doctor `docsUrl` rendering (`apps/node/src/cli/commands/doctor.ts`)
3. Populate `docsUrl` in readiness checks (`apps/node/src/domain/doctor/checks/`) - use new page URLs
4. Unit tests for doctor changes (T1-T4 from PRD-1)
5. `~/.clawperator/AGENTS.md` generation in `install.sh`

### Phase 4: Generate and Validate

1. Run docs-generate skill to produce `sites/docs/docs/`
2. Update `generate_llms_full.py` to walk `mkdocs.yml` nav order
3. Generate `llms-full.txt`
4. Rewrite `llms.txt` (both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt`)
5. Run `./scripts/docs_build.sh`
6. Run docs-validate skill
7. Run `validate_docs_routes.py` (with new relative link checking)
8. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`
9. Verify `llms-full.txt` is coherent top-to-bottom

### Phase 5: Cleanup

1. Delete absorbed source files from `docs/` per the deletion criteria in Section 1a (all four conditions must be met before removing any source file)
2. Delete task files listed in Section 8
3. Restore churn limits in `source-map.yaml` to maintenance-safe values

---

## 10. Validation / Acceptance Criteria

### Build and Test

- [ ] `./scripts/docs_build.sh` succeeds with zero warnings
- [ ] `npm --prefix apps/node run build` succeeds
- [ ] `npm --prefix apps/node run test` passes
- [ ] Doctor `docsUrl` unit tests pass (T1-T4)

### Structural Integrity

- [ ] Every page in `mkdocs.yml` nav exists on disk in `sites/docs/docs/`
- [ ] No page on disk in `sites/docs/docs/` is absent from `mkdocs.yml` (excluding redirects)
- [ ] Every `source-map.yaml` output path is present in `mkdocs.yml` nav
- [ ] No page appears in more than one nav section
- [ ] No two pages cover the same concept as primary content
- [ ] All relative links in generated pages resolve to valid output pages
- [ ] `validate_docs_routes.py` passes including inner-page relative link checks
- [ ] `docs-validate` skill passes

### Machine-Facing Artifacts

- [ ] Every URL in `llms.txt` resolves to a built HTML page
- [ ] `llms-full.txt` contains all 20 pages in nav order, no missing sections
- [ ] `llms-full.txt` is coherent top-to-bottom (no orphaned cross-references, no undefined terms)

### Content Accuracy

- [ ] All CLI examples use flat commands (`snapshot`, `click`, `press`, not `observe snapshot`, `action click`, `action press-key`)
- [ ] All flag references use canonical names (`--device`, `--json`, `--timeout`, `--operator-package`)
- [ ] Zero occurrences of "receiver" in `sites/docs/docs/` (replaced by "operator")
- [ ] Zero occurrences of deprecated command forms in `sites/docs/docs/`
- [ ] Zero occurrences of deprecated flag names (`--timeout-ms`, `--output json` without `--json` context) in `sites/docs/docs/`
- [ ] Selector mutual exclusion rules documented in `api/selectors.md`
- [ ] New error codes (`MISSING_SELECTOR`, `MISSING_ARGUMENT`, `UNKNOWN_COMMAND` with `suggestion`) documented in `api/errors.md`
- [ ] `serve` command HTTP/SSE contract documented in `api/serve.md`

### Surface Area Reduction

- [ ] Total public pages: 20 (down from 33)
- [ ] Zero persona sections in nav
- [ ] Zero "recommended paths" sections
- [ ] Zero standalone architecture/design pages in public nav
- [ ] `node-api-for-agents.md` does not exist as a public page
- [ ] `reference/api-overview.md` does not exist in curated form
