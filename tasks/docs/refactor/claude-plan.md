# Docs Refactor Plan

## Governing Principle

`llms-full.txt` is the primary artifact. The docs site is a human-readable projection.
All decisions optimize for agent parsing, retrieval accuracy, and deterministic understanding.
No duplication. No narrative. No historical context. Current state only.

---

## 1. Target Docs Structure

### Design Rationale

One axis: what an agent needs to do, in order.

1. **Setup** - get from zero to first command
2. **API** - what commands exist, what they accept, what they return, how to recover
3. **Skills** - how skills work, how to author and run them
4. **Troubleshooting** - what breaks and how to fix it

No persona sections. No "recommended paths." No "getting started vs reference" split.
Every concept has exactly one home.

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

Not all sections required on every page. Reference pages (actions, errors) use
tabular format instead. The schema is a default, not a straitjacket.

---

## 2. Navigation Tree

```yaml
nav:
  - Docs Home: index.md
  - Setup: setup.md
  - API:
    - Overview: api/overview.md
    - CLI Reference: api/cli.md
    - Actions: api/actions.md
    - Snapshot Format: api/snapshot.md
    - Errors: api/errors.md
    - Devices: api/devices.md
    - Doctor: api/doctor.md
    - Timeouts: api/timeouts.md
    - Environment Variables: api/environment.md
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

**18 pages total.** Down from 33 current pages (45% reduction).

---

## 3. File-Level Classification

### Source docs in `docs/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/index.md` | MODIFY | Rewrite as minimal routing page: 4 sections, no link dumps, no duplication |
| `docs/agent-quickstart.md` | DELETE | Content absorbed into `setup.md` |
| `docs/first-time-setup.md` | MODIFY | Core of new `setup.md` - rewrite as single linear path |
| `docs/openclaw-first-run.md` | DELETE | OpenClaw-specific steps folded into `setup.md` as a short callout |
| `docs/running-clawperator-on-android.md` | DELETE | Actuator model explanation moved to `api/overview.md`; setup steps merged into `setup.md` |
| `docs/project-overview.md` | DELETE | Mission/philosophy absorbed into `api/overview.md` (2-3 lines); rest deleted |
| `docs/terminology.md` | DELETE | Terms defined inline where used; no standalone glossary |
| `docs/android-operator-apk.md` | DELETE | Package variants and installation merged into `setup.md` and `api/devices.md` |
| `docs/architecture.md` | DELETE | Relevant content (two-layer model) absorbed into `api/overview.md` |
| `docs/node-api-for-agents.md` | DELETE | Split: execution model to `api/overview.md`, CLI content to `api/cli.md`, action reference to `api/actions.md`, selector docs to `api/actions.md`, error guidance to `api/errors.md` |
| `docs/snapshot-format.md` | MODIFY | Becomes `api/snapshot.md` - update for current snapshot contract |
| `docs/navigation-patterns.md` | MODIFY | Becomes `api/navigation.md` - update CLI examples to flat commands |
| `docs/multi-device-workflows.md` | DELETE | Content merged into `api/devices.md` |
| `docs/compatibility.md` | KEEP | Becomes `troubleshooting/compatibility.md` - minimal changes |
| `docs/troubleshooting.md` | MODIFY | Becomes `troubleshooting/operator.md` - absorb crash-logs content |
| `docs/known-issues.md` | KEEP | Becomes `troubleshooting/known-issues.md` - minimal changes |
| `docs/crash-logs.md` | DELETE | Content merged into `troubleshooting/operator.md` |
| `docs/conformance-apk.md` | INTERNAL | Not in public docs; remains in `docs/` for contributors |
| `docs/release-procedure.md` | INTERNAL | Not in public docs; remains in `docs/` for contributors |
| `docs/release-reference.md` | INTERNAL | Not in public docs; remains in `docs/` for contributors |
| `docs/site-hosting.md` | INTERNAL | Not in public docs; remains in `docs/` for contributors |

### Source docs in `docs/ai-agents/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/ai-agents/android-recording.md` | MODIFY | Becomes `api/recording.md` - update for current recording contract |

### Source docs in `docs/reference/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/reference/action-types.md` | MODIFY | Becomes `api/actions.md` - absorb relevant content from `node-api-for-agents.md`, update for new flat CLI commands and selector flags |
| `docs/reference/execution-model.md` | DELETE | Content absorbed into `api/overview.md` |
| `docs/reference/timeout-budgeting.md` | MODIFY | Becomes `api/timeouts.md` - update examples to new CLI surface |
| `docs/reference/device-and-package-model.md` | MODIFY | Becomes `api/devices.md` - absorb multi-device-workflows content |
| `docs/reference/error-handling.md` | DELETE | Content merged into `api/errors.md` |
| `docs/reference/node-api-doctor.md` | MODIFY | Becomes `api/doctor.md` - update for current doctor behavior |
| `docs/reference/environment-variables.md` | MODIFY | Becomes `api/environment.md` - update env var names (OPERATOR_PACKAGE not RECEIVER_PACKAGE) |
| `docs/reference/snapshot-format.md` | N/A | Does not exist at this path; `docs/snapshot-format.md` is the source |

### Source docs in `docs/design/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/design/node-api-design.md` | INTERNAL | Remove from public docs. Keep in repo for contributors. |
| `docs/design/operator-llm-playbook.md` | INTERNAL | Remove from public docs. Keep in repo for contributors. |
| `docs/design/skill-design.md` | INTERNAL | Remove from public docs. Keep in repo for contributors. |
| `docs/design/generative-engine-optimization.md` | INTERNAL | Remove from public docs. Keep in repo for contributors. |
| `docs/design/node-api-design-guiding-principles.md` | INTERNAL | Remove from public docs. Keep in repo for contributors. |

### Source docs in `docs/skills/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `docs/skills/skill-from-recording.md` | DELETE | Content merged into `skills/authoring.md` |

### Source docs in `../clawperator-skills/docs/`

| File | Classification | Disposition |
|------|---------------|-------------|
| `usage-model.md` | MODIFY | Becomes `skills/overview.md` - tighten to contract style |
| `skill-development-workflow.md` | MODIFY | Becomes `skills/development.md` - update CLI examples |
| `skill-authoring-guidelines.md` | MODIFY | Becomes `skills/authoring.md` - absorb `skill-from-recording.md` and `blocked-terms-policy.md` |
| `device-prep-and-runtime-tips.md` | MODIFY | Becomes `skills/runtime.md` - update CLI examples |
| `blocked-terms-policy.md` | DELETE | Content absorbed into `skills/authoring.md` as a short section |

### Code-derived pages (generated from source code)

| Output | Classification | Source |
|--------|---------------|--------|
| `api/cli.md` | MODIFY | `apps/node/src/cli/registry.ts`, `apps/node/src/cli/commands/` - regenerate for new flat command surface |
| `api/errors.md` | MODIFY | `apps/node/src/contracts/errors.ts`, `apps/node/src/contracts/result.ts`, `apps/node/src/cli/registry.ts` - merge code-derived error codes with authored error-handling guidance into one page |

### Non-public source docs (INTERNAL, no action)

These files exist in `docs/` but are not part of the public docs site.
They remain in the repo as contributor references. No changes needed.

- `docs/conformance-apk.md`
- `docs/release-procedure.md`
- `docs/release-reference.md`
- `docs/site-hosting.md`
- `docs/design/*.md` (all 5 files)

---

## 4. PRD Evaluation

### PRD-1: Entry Points, Agent Discoverability, and Integration Hooks

**Still valid:**
- Doctor `docsUrl` field in `fix` object (section 3) - good idea, implement as specified
- `~/.clawperator/AGENTS.md` generated by `install.sh` (section 5) - implement as specified but with updated command examples using new flat CLI surface
- `llms.txt` alignment with shipped behavior (section 6) - critical, do last
- Diagnosis that docs are useful but not findable - correct

**Outdated:**
- Section 1 (index.md reordering) - the proposed reordering of the existing sections is moot; we are replacing the entire index structure, not reordering the current one
- Section 2 (align first-run guides) - we are collapsing multiple guides into one `setup.md`, not aligning three competing guides
- CLI command examples throughout - must use new flat surface (`snapshot` not `observe snapshot`, `click --text` not `action click --selector`, `--device` not `--device-id`)
- References to `agent-quickstart.md`, `openclaw-first-run.md` as separate pages - these will not exist as separate pages

**Should be removed:**
- Section 4 (`operator_event.sh` investigation and stub) - this is an OpenClaw integration issue, not a docs concern. Track separately if still relevant.

**Should be incorporated:**
- Doctor `docsUrl` implementation (section 3) - fold into this plan's execution
- `~/.clawperator/AGENTS.md` template (section 5) - fold into this plan, update template to reference new page URLs
- `llms.txt` alignment (section 6) - becomes the final step of this plan
- Testing plan for doctor changes (T1-T4) - reuse as-is

### PRD-2: Docs Structural Reform

**Still valid:**
- Core diagnosis: site mixes competing organizational models (user journeys, personas, content types, architecture) - accurate
- Principle: one concept = one home - adopted
- Principle: no persona-based sections - adopted
- Principle: no "recommended paths" - adopted
- `mkdocs.yml` and `source-map.yaml` update requirement - adopted
- Redirect plugin recommendation - adopted
- Pre-merge checklist (docs_build.sh, no orphaned pages, llms.txt URLs resolve) - reuse

**Outdated:**
- Proposed four-section structure (Get Started / Use Clawperator / Reference / Troubleshoot) - replaced by our structure (Setup / API / Skills / Troubleshooting) which is flatter and more agent-oriented. "Use Clawperator" as a section is too narrative.
- "Audit before designing" approach (section 1) - we already have the audit from this planning phase
- Dependency on PRD-1 completing first - we are doing everything in one pass
- "Do not rewrite content" scope boundary - we ARE rewriting content to contract style

**Should be removed:**
- Sequential dependency model (PRD-1 then PRD-2) - replaced by single execution plan

**Should be incorporated:**
- Redirect plugin setup for moved pages
- Pre-merge checklist items
- `docsUrl` update when pages move (search `apps/node/src/domain/doctor/checks/` for hardcoded URLs)

### Chat Session (`chat-session.md`)

**Still valid (and adopted):**
- Diagnosis of competing taxonomies, duplication, and persona-based sections
- "Agent-first" direction
- "Docs = API surface, not content"
- Contract-first page schema
- `llms-full.txt` as primary artifact
- "Delete 40-60% of current structure" target
- Kill entire sections: "Recommended paths", "For AI Agents", "Architecture"
- No synonyms - one term per concept
- Self-contained pages, minimal cross-linking
- Strict anchors on headings

**Outdated:**
- Proposed structure includes "Core Concepts" section - eliminated; concepts are embedded in `api/overview.md`
- Suggests separate "Runtime & Devices" section - merged into `api/devices.md`
- Suggests "split docs for humans vs agents" - rejected; single source, agent-first, humans can skim

---

## 5. Gaps in Current Docs

### API coverage gaps (must fix)

- **New flat commands undocumented**: `close`, `sleep`, `scroll`, `scroll-until`, `scroll-and-click`, `wait-for-nav`, `read-value` have no authored docs. They exist only in `registry.ts` help text.
- **Selector flags undocumented**: The new `--text`, `--text-contains`, `--id`, `--desc`, `--desc-contains`, `--role`, `--coordinate` flags and `--container-*` variants are not in any authored doc. Only in code.
- **`--json` flag**: New global shorthand not documented.
- **`--all` flag on `read`/`read-value`**: Requires `--json` - this constraint is not documented.
- **Command aliases**: Legacy nested commands (`observe snapshot`, `action click`, etc.) return `UNKNOWN_COMMAND` with `suggestion` field. This migration behavior is undocumented.

### Missing contracts

- **Selector mutual exclusion rules**: `--selector` JSON vs shorthand flags (`--text`, etc.) are mutually exclusive. Not documented.
- **`--coordinate` vs selector exclusion**: Click supports either coordinate or selector, not both. Not documented.
- **`close` action**: Force-stop semantics not documented.
- **`sleep` action**: Duration parameter contract not documented.

### Error documentation gaps

- **New error codes**: `MISSING_SELECTOR`, `MISSING_ARGUMENT` from the refactor are not in authored error docs.
- **Renamed error codes**: `RECEIVER_NOT_INSTALLED` -> `OPERATOR_NOT_INSTALLED`, `RECEIVER_VARIANT_MISMATCH` -> `OPERATOR_VARIANT_MISMATCH` - old names may still appear in docs.
- **`UNKNOWN_COMMAND` with `suggestion` field**: New error shape for legacy command migration, undocumented.

### Terminology inconsistencies

- `receiver` vs `operator`: The refactor renamed "receiver" to "operator" everywhere. Docs may still contain "receiver" references.
- `--device-id` vs `--device`: Old flag name may persist in docs. Canonical is `--device` (alias: `--device-id`).
- `--timeout-ms` vs `--timeout`: Old flag name may persist. Canonical is `--timeout`.
- `--output json` vs `--json`: Both valid but docs should prefer `--json`.

### Duplication (to be eliminated)

- Brain/hand explanation appears in: `index.md`, `project-overview.md`, `running-clawperator-on-android.md`, `agent-quickstart.md`, `architecture.md`, `node-api-for-agents.md`
- Action type reference duplicated between: `node-api-for-agents.md`, `action-types.md`, `api-overview.md`
- Setup instructions duplicated across: `first-time-setup.md`, `openclaw-first-run.md`, `agent-quickstart.md`, `running-clawperator-on-android.md`
- Error handling guidance duplicated between: `error-handling.md`, `node-api-for-agents.md`
- Device targeting duplicated between: `device-and-package-model.md`, `multi-device-workflows.md`, `node-api-for-agents.md`

---

## 6. Current vs Proposed Layout

| Current Path | Proposed Path | Action |
|-------------|--------------|--------|
| `index.md` | `index.md` | Rewrite: minimal routing, 4 sections |
| `getting-started/running-clawperator-on-android.md` | - | Delete: content split to `setup.md` and `api/overview.md` |
| `getting-started/terminology.md` | - | Delete: terms defined inline |
| `getting-started/first-time-setup.md` | `setup.md` | Rewrite: single linear setup path |
| `getting-started/openclaw-first-run.md` | - | Delete: absorbed into `setup.md` |
| `getting-started/project-overview.md` | - | Delete: mission in `api/overview.md` |
| `getting-started/android-operator-apk.md` | - | Delete: absorbed into `setup.md` + `api/devices.md` |
| `architecture/architecture.md` | - | Delete: content in `api/overview.md` |
| `ai-agents/agent-quickstart.md` | - | Delete: absorbed into `setup.md` |
| `ai-agents/android-recording.md` | `api/recording.md` | Move + update |
| `ai-agents/node-api-for-agents.md` | - | Delete: split across `api/` pages |
| `ai-agents/navigation-patterns.md` | `api/navigation.md` | Move + update |
| `ai-agents/multi-device-workflows.md` | - | Delete: merged into `api/devices.md` |
| `reference/cli-reference.md` | `api/cli.md` | Regenerate from code |
| `reference/api-overview.md` | - | Delete: replaced by `api/overview.md` |
| `reference/action-types.md` | `api/actions.md` | Rewrite: absorb content from `node-api-for-agents.md`, add new commands |
| `reference/execution-model.md` | - | Delete: content in `api/overview.md` |
| `reference/timeout-budgeting.md` | `api/timeouts.md` | Move + update examples |
| `reference/device-and-package-model.md` | `api/devices.md` | Rewrite: absorb multi-device content |
| `reference/snapshot-format.md` | `api/snapshot.md` | Move + update |
| `reference/error-codes.md` | `api/errors.md` | Rewrite: merge with error-handling, add new codes |
| `reference/error-handling.md` | - | Delete: merged into `api/errors.md` |
| `reference/node-api-doctor.md` | `api/doctor.md` | Move + update |
| `reference/environment-variables.md` | `api/environment.md` | Move + update var names |
| `design/node-api-design.md` | - | Delete from public docs |
| `design/operator-llm-playbook.md` | - | Delete from public docs |
| `design/skill-design.md` | - | Delete from public docs |
| `troubleshooting/compatibility.md` | `troubleshooting/compatibility.md` | Keep (minimal changes) |
| `troubleshooting/troubleshooting.md` | `troubleshooting/operator.md` | Rename + absorb crash-logs |
| `troubleshooting/known-issues.md` | `troubleshooting/known-issues.md` | Keep (minimal changes) |
| `troubleshooting/crash-logs.md` | - | Delete: merged into `troubleshooting/operator.md` |
| `skills/usage-model.md` | `skills/overview.md` | Move + tighten |
| `skills/skill-from-recording.md` | - | Delete: merged into `skills/authoring.md` |
| `skills/skill-development-workflow.md` | `skills/development.md` | Move + update |
| `skills/skill-authoring-guidelines.md` | `skills/authoring.md` | Rewrite: absorb recording + blocked-terms |
| `skills/device-prep-and-runtime-tips.md` | `skills/runtime.md` | Move + update |
| `skills/blocked-terms-policy.md` | - | Delete: absorbed into `skills/authoring.md` |

**Summary:** 33 current pages -> 18 proposed pages. 15 pages deleted. 0 duplication.

---

## 7. Docs Generation Pipeline

### Current State

- `source-map.yaml` defines pages with `mode: copy`, `mode: curated`, `mode: code-derived`
- `docs-generate` skill reads `source-map.yaml`, copies/generates pages to `sites/docs/docs/`
- `generate_llms_full.py` concatenates all generated pages into `llms-full.txt`
- `docs-validate` skill checks that generated output changes only when sources changed
- `docs_build.sh` runs MkDocs build

### Required Changes

#### `source-map.yaml` - Full Rewrite

Replace current 8-section, 33-page structure with the 4-section, 18-page structure
from Section 2. Every entry needs:
- Updated `output:` paths
- Updated `sources:` references
- Correct `mode:` (most pages become `copy` from a single authored source)

Specific mode decisions:
- `api/cli.md`: `mode: code-derived` from `apps/node/src/cli/registry.ts` + commands
- `api/errors.md`: `mode: curated` - merges code-derived error codes with authored recovery guidance
- All other pages: `mode: copy` from a single authored source file

The `rules:` section should be updated:
- Remove or increase `max_changed_files: 12` - this refactor will touch far more than 12 files
- Remove or increase `max_line_churn: 400` and `max_percent_churn: 20` for the refactor PR
- After the refactor lands, reinstate reasonable churn limits for ongoing maintenance

#### `mkdocs.yml` - Full Rewrite

Replace entire `nav:` tree with the structure from Section 2.
Add `mkdocs-redirects` plugin for moved pages (see Section 8 of PRD-2).

Required additions to `mkdocs.yml`:
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

Add `mkdocs-redirects` to `sites/docs/requirements.txt`.

#### `generate_llms_full.py` - No structural changes needed

The script iterates `source-map.yaml` sections and concatenates pages. Since the
source-map drives it, updating the source-map is sufficient. However, review the
output header and ensure it reflects the new structure accurately.

#### `docs-generate` skill - Update SKILL.md

- Update the documented page list and source mapping
- Update churn thresholds or add a flag to bypass them for structural refactors
- Verify the `code-derived` generation for `api/cli.md` handles the new `registry.ts` command structure

#### `docs-validate` skill - No changes needed

The validation logic is source-map-driven. Updating source-map.yaml is sufficient.

#### `llms.txt` - Rewrite

Both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt` must be
rewritten to reflect the new page URLs and structure. This is the last step.

#### `llms-full.txt` - Regenerate

After all source pages are written and `source-map.yaml` is updated, run
`generate_llms_full.py` to produce the new compiled artifact.

---

## 8. Internal Docs Handling

### Convention: Directory-Based Exclusion

Internal docs are excluded by **not being in `source-map.yaml`**.

No frontmatter flags. No special markers. If a file in `docs/` is not listed in
`source-map.yaml`, it is internal. The generated output and public site only
contain what the source-map specifies.

This is already the de facto behavior (files like `conformance-apk.md`,
`release-procedure.md`, `site-hosting.md` are in `docs/` but not in
`source-map.yaml`). The refactor formalizes this by also removing `docs/design/`
pages from the source-map.

### Internal docs inventory (post-refactor)

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

No action needed for these files. They remain in the repo as contributor context.

---

## 9. Integration with Other Tasks

### `tasks/docs/validate/todo.md` - MERGE into this effort

**Justification:** The validate task proposes two things:

1. Enable MkDocs `strict: true` - already done (current `mkdocs.yml` has `strict: true`)
2. Add inner-page relative link validation to `validate_docs_routes.py`

Item 1 is complete. Item 2 should be done as part of this refactor because we are
moving/renaming every page. Running the refactor without relative link validation
would leave broken internal links undetected. Add the `check_inner_page_links`
function to `validate_docs_routes.py` as part of execution.

After completion, delete `tasks/docs/validate/todo.md`.

### `tasks/docs/api-overview/todo.md` - MERGE into this effort

**Justification:** The task asks whether `api-overview.md` should become a single
authored source (`mode: copy`) instead of `mode: curated`. This refactor answers
the question: `api/overview.md` will be a single authored source file with
`mode: copy`. The curated mode is eliminated.

After completion, delete `tasks/docs/api-overview/todo.md`.

### `tasks/docs/refactor/plan.md` - SUPERSEDED by this plan

This plan (`claude-plan.md`) supersedes `plan.md`. Delete `plan.md` after this
plan is accepted. Its content (sequencing, implementation notes) is fully
incorporated here.

### PRD-1 code changes - FOLD INTO this effort

The following PRD-1 deliverables are execution items in this plan:

- Doctor `docsUrl` field: add `docsUrl?: string` to `fix` type, render in pretty mode, populate for initial checks
- `~/.clawperator/AGENTS.md` generated by `install.sh`: implement as specified in PRD-1 section 5 with updated URLs
- `llms.txt` alignment: final step of this plan

### Landing page update - SEPARATE

The landing page pseudocode update (`sites/landing/app/page.js`) noted in
`plan.md` is related but independent. It can be a follow-up PR after the docs
refactor lands. Do not include it in this execution plan to keep scope contained.

---

## 10. Execution Sequence

### Phase 1: Infrastructure

1. Add `mkdocs-redirects` to `sites/docs/requirements.txt`
2. Update `source-map.yaml` with new structure (temporarily increase churn limits)
3. Update `mkdocs.yml` with new nav tree and redirect maps
4. Add relative link validation to `validate_docs_routes.py`

### Phase 2: Write New Source Docs

Author the 18 target pages. Each page uses contract-first style, new CLI surface,
no historical references, no duplication.

Priority order (most impactful first):
1. `setup.md` - single setup path
2. `api/overview.md` - execution model, result envelope, core concepts
3. `api/actions.md` - all action types with new commands
4. `api/errors.md` - all error codes with recovery guidance
5. `api/cli.md` - regenerate from code
6. `api/devices.md` - device targeting + multi-device
7. `api/snapshot.md` - snapshot format
8. `api/doctor.md` - readiness checks
9. `api/timeouts.md` - timeout budgeting
10. `api/environment.md` - environment variables
11. `api/navigation.md` - navigation patterns
12. `api/recording.md` - recording format
13. `skills/overview.md` - usage model
14. `skills/authoring.md` - authoring guidelines + recording + blocked-terms
15. `skills/development.md` - development workflow
16. `skills/runtime.md` - device prep and runtime
17. `troubleshooting/operator.md` - troubleshooting + crash logs
18. `index.md` - minimal routing page (write last, after all targets exist)

### Phase 3: Code Changes

1. Doctor `docsUrl` in `fix` type (`apps/node/src/contracts/doctor.ts`)
2. Doctor `docsUrl` rendering (`apps/node/src/cli/commands/doctor.ts`)
3. Populate `docsUrl` in readiness checks (`apps/node/src/domain/doctor/checks/readinessChecks.ts`) - use new page URLs
4. Unit tests for doctor changes (T1-T4 from PRD-1)
5. `~/.clawperator/AGENTS.md` generation in `install.sh`

### Phase 4: Generate and Validate

1. Run docs-generate skill to produce `sites/docs/docs/`
2. Run `generate_llms_full.py` to produce `llms-full.txt`
3. Rewrite `llms.txt` (both `sites/docs/static/llms.txt` and `sites/landing/public/llms.txt`)
4. Run `./scripts/docs_build.sh`
5. Run docs-validate skill
6. Run `validate_docs_routes.py` (with new relative link checking)
7. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`
8. Verify `llms-full.txt` is coherent top-to-bottom

### Phase 5: Cleanup

1. Delete old source files that were absorbed (do NOT delete - they remain as authored sources; only the source-map and generated output change). Clarification: the "source" files for pages that were merged or deleted should be evaluated. If a source file's content is fully absorbed into a new file, the old source can be deleted from `docs/` to prevent drift. If it still serves as a contributor reference, keep it but ensure it is not in `source-map.yaml`.
2. Delete `tasks/docs/validate/todo.md`
3. Delete `tasks/docs/api-overview/todo.md`
4. Delete `tasks/docs/refactor/plan.md`
5. Delete `tasks/docs/refactor/prd-1-entry-points.md`
6. Delete `tasks/docs/refactor/prd-2-structure.md`
7. Delete `tasks/docs/refactor/chat-session.md`
8. Restore churn limits in `source-map.yaml` to maintenance-safe values

---

## 11. Validation Checklist (Pre-Merge)

- [ ] `./scripts/docs_build.sh` succeeds with zero warnings
- [ ] `npm --prefix apps/node run build` succeeds
- [ ] `npm --prefix apps/node run test` passes
- [ ] Every page in `mkdocs.yml` exists on disk in `sites/docs/docs/`
- [ ] No page on disk in `sites/docs/docs/` is absent from `mkdocs.yml`
- [ ] Every URL in `llms.txt` resolves to a built HTML page
- [ ] `llms-full.txt` contains all 18 pages in order, no missing sections
- [ ] No page appears in more than one nav section
- [ ] No two pages cover the same concept as primary content
- [ ] All CLI examples use flat commands (`snapshot`, `click`, `press`, not `observe snapshot`, `action click`, `action press-key`)
- [ ] All flag references use canonical names (`--device`, `--json`, `--timeout`, `--operator-package`)
- [ ] No references to "receiver" (replaced by "operator")
- [ ] No references to deprecated/old command forms except in redirect configuration
- [ ] Doctor `docsUrl` unit tests pass (T1-T4)
- [ ] `validate_docs_routes.py` passes including relative link checks
- [ ] `docs-validate` skill passes
- [ ] Grep for "receiver" in `sites/docs/docs/` returns zero results (excluding redirect config)
- [ ] Grep for `observe snapshot`, `action click`, `--device-id` (without `--device` context), `--timeout-ms` in `sites/docs/docs/` returns zero results
