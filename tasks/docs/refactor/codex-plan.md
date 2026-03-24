# Docs Refactor Plan for Agent-First Public Docs

## Scope

This plan defines the target public docs system for the post-refactor Node API.

It is intentionally opinionated:

- `llms-full.txt` is the primary public artifact.
- The docs site is a projection of the same source, not an independent documentation system.
- Public docs are for agent execution and recovery first.
- Human readability matters only after agent clarity is satisfied.
- One concept gets one canonical page.
- Old structure should be deleted, not preserved.

This plan covers:

- docs structure and navigation
- source-of-truth layout
- docs generation pipeline changes
- related code/doc integration points that affect docs discoverability
- public vs internal docs separation

This plan does not implement the refactor.

## Working assumptions validated against the repo

- The current docs site is still organized by multiple conflicting axes: journey, persona, content type, internal architecture, and feature area.
- `docs/index.md` currently duplicates links across "Recommended paths", "Getting Started", "For AI Agents", and "Reference".
- `sites/docs/source-map.yaml` and `sites/docs/mkdocs.yml` currently duplicate structural intent.
- `reference/api-overview.md` is still a curated assembly instead of a single authored or single generated contract page.
- `docs/node-api-for-agents.md` is still a monolith and overlaps with `reference/*` pages.
- `docs/design/*` is contributor-facing, not agent-facing.
- `apps/node/src/cli/registry.ts` is now the actual canonical CLI surface after the refactor. `apps/node/src/cli/index.ts` is no longer the right primary source for command docs.
- The docs build and validator already depend on the source map. That is now part of the problem.

## Decision summary

1. Remove persona-based public sections entirely.
2. Remove "Recommended paths" entirely.
3. Remove `source-map.yaml` as a public-docs manifest.
4. Make `mkdocs.yml` nav the single public IA source.
5. Keep generated docs output in `sites/docs/docs/`, but generate it from a simpler pipeline with fewer abstractions.
6. Split `docs/node-api-for-agents.md` into smaller canonical pages, then delete the monolith.
7. Delete public architecture/design docs that do not help agents execute or recover.
8. Merge `tasks/docs/validate` and `tasks/docs/api-overview` into this refactor.
9. Treat `llms-full.txt` generation as a first-class output, not a side artifact.
10. Allow URL breaks. Update `llms.txt` and redirects accordingly.

## 1. Target docs structure

### Principles

- Keep setup linear.
- Put contracts in one place.
- Keep recovery separate from contracts.
- Keep skills separate from core runtime contracts.
- Delete conceptual pages that do not improve execution quality.
- Avoid standalone "overview" pages unless they add non-duplicative value.

### Final public structure

#### Home

- `index.md`
  - one-screen technical map
  - links to `llms.txt`, `llms-full.txt`, install/start, core reference, recovery
  - no link dump, no duplicate subsections, no persona split

#### Start

- `start/install-and-verify.md`
  - install CLI
  - prepare device or emulator
  - install/setup Operator APK
  - run `doctor`
  - state exact first-run contract
- `start/first-command.md`
  - shortest deterministic path from fresh install to successful command
  - replaces agent/openclaw split onboarding
- `start/operator-apk.md`
  - package variants, install/setup expectations, permission model

#### Reference

- `reference/cli-reference.md`
  - generated from CLI source
- `reference/execution-contract.md`
  - required execution payload shape
  - result envelope semantics
  - timeout and validation behavior
- `reference/action-types.md`
  - canonical action schemas and examples
- `reference/selector-matching.md`
  - selector flags
  - matcher semantics
  - container targeting rules
- `reference/snapshot-format.md`
  - canonical snapshot output contract
- `reference/device-targeting.md`
  - `deviceId`, `--device`, operator package, multi-device rules
- `reference/recording-format.md`
  - raw recording contract and current limitations
- `reference/doctor.md`
  - doctor output contract, fix behavior, docs URLs, exit behavior
- `reference/error-codes.md`
  - generated from code
- `reference/error-recovery.md`
  - recovery guidance keyed to error classes
- `reference/environment-variables.md`
  - installer/runtime env vars
- `reference/serve-api.md`
  - HTTP/SSE surface for remote agents

#### Skills

- `skills/usage-model.md`
- `skills/development-workflow.md`
- `skills/authoring-guidelines.md`
- `skills/skill-from-recording.md`
- `skills/device-prep-and-runtime-tips.md`
- `skills/blocked-terms-policy.md`

#### Recovery

- `recovery/troubleshooting.md`
- `recovery/version-compatibility.md`
- `recovery/known-issues.md`

### Explicit deletions from the public surface

- public architecture section
- public design/rationale section
- public OpenClaw-specific onboarding
- public project overview page
- public API overview page
- public monolithic agent guide
- public timeout page as a standalone page
- public crash-log backup page unless a concrete agent-facing runtime need remains

## 2. Navigation tree

This tree should replace `sites/docs/source-map.yaml` as the public IA manifest.

```yaml
nav:
  - Home: index.md
  - Start:
    - Install and Verify: start/install-and-verify.md
    - First Command: start/first-command.md
    - Operator APK: start/operator-apk.md
  - Reference:
    - CLI Reference: reference/cli-reference.md
    - Execution Contract: reference/execution-contract.md
    - Action Types: reference/action-types.md
    - Selector Matching: reference/selector-matching.md
    - Snapshot Format: reference/snapshot-format.md
    - Device Targeting: reference/device-targeting.md
    - Recording Format: reference/recording-format.md
    - Doctor: reference/doctor.md
    - Error Codes: reference/error-codes.md
    - Error Recovery: reference/error-recovery.md
    - Environment Variables: reference/environment-variables.md
    - Serve API: reference/serve-api.md
  - Skills:
    - Usage Model: skills/usage-model.md
    - Development Workflow: skills/development-workflow.md
    - Authoring Guidelines: skills/authoring-guidelines.md
    - Skill From Recording: skills/skill-from-recording.md
    - Device Prep and Runtime Tips: skills/device-prep-and-runtime-tips.md
    - Blocked Terms Policy: skills/blocked-terms-policy.md
  - Recovery:
    - Troubleshooting: recovery/troubleshooting.md
    - Version Compatibility: recovery/version-compatibility.md
    - Known Issues: recovery/known-issues.md
```

### Nav rules

- No page may appear twice.
- No persona section.
- No architecture section in public nav.
- No "recommended path" section.
- No conceptual overview pages if the same content belongs inside start/reference/recovery.

## 3. File-level classification

Classification scope: current public-doc inputs only.

### `docs/`

| File | Classification | Plan |
|---|---|---|
| `docs/index.md` | MODIFY | Replace link dump with minimal technical map keyed to Start, Reference, Recovery, and machine-facing routes. |
| `docs/agent-quickstart.md` | MODIFY | Fold into `start/first-command.md`. Keep useful deterministic first-command content only. |
| `docs/android-operator-apk.md` | MODIFY | Move to `start/operator-apk.md` and keep only install/package/permission contract. |
| `docs/architecture.md` | DELETE | Remove from public docs. Migrate any still-useful one-paragraph runtime model into `index.md` or `start/install-and-verify.md`. |
| `docs/compatibility.md` | MODIFY | Move to `recovery/version-compatibility.md`. Keep exact compatibility rule only. |
| `docs/conformance-apk.md` | INTERNAL | Not part of agent-facing public docs. Move to `docs/internal/` or keep excluded. |
| `docs/crash-logs.md` | INTERNAL | Backup crash capture is contributor/support material, not primary agent docs. Keep out of public nav. |
| `docs/first-time-setup.md` | MODIFY | Become the base for `start/install-and-verify.md`. |
| `docs/known-issues.md` | MODIFY | Move to `recovery/known-issues.md`. Keep only active, agent-relevant issues. |
| `docs/multi-device-workflows.md` | MODIFY | Merge into `reference/device-targeting.md`. |
| `docs/navigation-patterns.md` | MODIFY | Merge into `reference/selector-matching.md` and `recovery/troubleshooting.md` as applicable. |
| `docs/node-api-for-agents.md` | DELETE | Split useful content into `reference/execution-contract.md`, `reference/error-recovery.md`, `reference/serve-api.md`, and Start pages. Then delete. |
| `docs/openclaw-first-run.md` | DELETE | Remove OpenClaw-specific onboarding from public docs. Keep any universally useful setup steps in Start pages only. |
| `docs/project-overview.md` | DELETE | Remove as a standalone page. Any required mission text belongs in `index.md`. |
| `docs/release-procedure.md` | INTERNAL | Contributor/release-only. Remove from public docs. |
| `docs/release-reference.md` | INTERNAL | Contributor/release-only. Remove from public docs. |
| `docs/running-clawperator-on-android.md` | DELETE | Merge device model and responsibilities into `start/install-and-verify.md`. |
| `docs/site-hosting.md` | INTERNAL | Docs hosting/build details are contributor-only. |
| `docs/snapshot-format.md` | MODIFY | Move to `reference/snapshot-format.md`. |
| `docs/terminology.md` | DELETE | Inline essential terms into relevant pages. Do not keep a separate glossary page. |
| `docs/troubleshooting.md` | MODIFY | Move to `recovery/troubleshooting.md` and trim to operational recovery. |
| `docs/reference/action-types.md` | MODIFY | Keep as canonical action schema page, but align with new flat command surface and refactor behavior. |
| `docs/reference/device-and-package-model.md` | MODIFY | Rename/move to `reference/device-targeting.md`. |
| `docs/reference/environment-variables.md` | KEEP | Keep as dedicated reference page with link updates only. |
| `docs/reference/error-handling.md` | MODIFY | Rename/move to `reference/error-recovery.md`. |
| `docs/reference/execution-model.md` | MODIFY | Rename/move to `reference/execution-contract.md` and absorb timeout semantics. |
| `docs/reference/node-api-doctor.md` | MODIFY | Rename/move to `reference/doctor.md`; update for docs URLs and new recoverability guidance. |
| `docs/reference/timeout-budgeting.md` | DELETE | Merge into `reference/execution-contract.md`. |
| `docs/ai-agents/android-recording.md` | MODIFY | Move to `reference/recording-format.md`. Remove persona framing. |
| `docs/skills/skill-from-recording.md` | MODIFY | Keep in Skills section, update links and references only. |
| `docs/design/generative-engine-optimization.md` | INTERNAL | Not public agent execution docs. |
| `docs/design/node-api-design-guiding-principles.md` | INTERNAL | Contributor rationale only. |
| `docs/design/node-api-design.md` | INTERNAL | Contributor rationale only. |
| `docs/design/operator-llm-playbook.md` | INTERNAL | Contributor/runtime integration guidance only. |
| `docs/design/skill-design.md` | INTERNAL | Contributor design note only. |

### `../clawperator-skills/docs/`

| File | Classification | Plan |
|---|---|---|
| `../clawperator-skills/docs/usage-model.md` | KEEP | Keep as canonical skills runtime model. |
| `../clawperator-skills/docs/skill-development-workflow.md` | MODIFY | Rename output to `skills/development-workflow.md`; update for refactored CLI/examples and tighter structure. |
| `../clawperator-skills/docs/skill-authoring-guidelines.md` | MODIFY | Rename output to `skills/authoring-guidelines.md`; align examples and links. |
| `../clawperator-skills/docs/device-prep-and-runtime-tips.md` | KEEP | Keep with minor link/path cleanup only. |
| `../clawperator-skills/docs/blocked-terms-policy.md` | KEEP | Keep as-is with nav/path cleanup only. |

### `apps/node/` current docs inputs

| File or source group | Classification | Plan |
|---|---|---|
| `apps/node/README.md` | INTERNAL | Repo README, not public docs source. Keep out of public docs plan. |
| `apps/node/src/cli/index.ts` | DELETE | Remove as a docs-generation source. The registry now owns the real CLI surface. |
| `apps/node/src/cli/commands/*` | MODIFY | Stop treating command modules as primary docs inputs. Use them only when a command needs extra derived notes. |
| `apps/node/src/cli/registry.ts` | KEEP | Make this the canonical generator input for CLI reference, help tree, and command-group discovery. |
| `apps/node/src/cli/selectorFlags.ts` | KEEP | Add as explicit input to a generated `reference/selector-matching.md` page. |
| `apps/node/src/contracts/execution.ts` | KEEP | Canonical execution schema source. |
| `apps/node/src/contracts/selectors.ts` | KEEP | Canonical matcher schema source. |
| `apps/node/src/contracts/errors.ts` | KEEP | Canonical error-code source. |
| `apps/node/src/contracts/result.ts` | KEEP | Canonical result-envelope source. |
| `apps/node/src/contracts/doctor.ts` | KEEP | Canonical doctor report schema source. |
| `apps/node/src/contracts/skills.ts` | KEEP | Keep as supporting contract input for skills-related reference where needed. |
| `apps/node/src/contracts/limits.ts` | INTERNAL | Developer-oriented constants, not a standalone public page. |
| `apps/node/src/contracts/aliases.ts` | INTERNAL | Implementation detail unless surfaced through generated CLI reference. |
| `apps/node/src/contracts/scroll.ts` | KEEP | Supporting input for action/reference generation. |
| `apps/node/src/contracts/index.ts` | INTERNAL | Barrel file, not a docs source. |

## 4. PRD evaluation

### PRD-1: `tasks/docs/refactor/prd-1-entry-points.md`

#### Still valid

- Docs discoverability is still a real problem.
- `docs/index.md` still needs a single obvious machine-first entry flow.
- `doctor` should point to relevant docs for recovery.
- `~/.clawperator/AGENTS.md` from install remains high-value.
- `llms.txt` alignment with shipped behavior is required.
- `operator_event.sh` is still a legitimate integration/doc-discoverability concern if OpenClaw expects it.

#### Outdated or incorrect

- The proposed sequence still assumes the old public structure, especially `node-api-for-agents.md` as a stable destination.
- It treats `docs/index.md` as the main discovery fix. After this refactor, `llms.txt` and `llms-full.txt` are the primary machine entrypoints, and `index.md` becomes secondary.
- It assumes the docs site should preserve multiple first-run guides and order them. The better outcome is to collapse them.
- It frames some implementation items as prerequisites or follow-ups that can now be part of the same execution plan.

#### Remove from PRD-1

- Any recommendation that preserves `node-api-for-agents.md` as a canonical destination.
- Any recommendation that keeps separate first-run guides for agent vs OpenClaw.
- Any suggestion that docs architecture can remain mostly intact if entrypoints improve.

#### Incorporate into new plan

- `doctor` `docsUrl` support and docs-path maintenance
- install-time `~/.clawperator/AGENTS.md`
- `llms.txt` update
- `operator_event.sh` investigation/stub as part of docs discoverability integration

### PRD-2: `tasks/docs/refactor/prd-2-structure.md`

#### Still valid

- The current IA is structurally incoherent.
- Duplicate entry points must be collapsed.
- Public docs need one hierarchy and one home per concept.
- `mkdocs.yml` and the docs-generation workflow need coordinated change.
- Redirect handling should be explicit.

#### Outdated or incorrect

- The proposed four-section model still over-preserves human tutorial framing.
- "Use Clawperator" is weaker than a contract-first "Reference" section for agent retrieval.
- "Architecture" should not remain a public section.
- The PRD treats `source-map.yaml` as a given. That file should be removed from the public-docs architecture.
- It assumes `clawperator-skills` docs are coordinated separately. That is not true for this effort.
- It says "fix structure, not prose." That is too narrow. Several pages must be rewritten, split, or deleted for the structure to be truthful.

#### Remove from PRD-2

- public architecture section
- preserving `source-map.yaml` as the public manifest
- minimizing content rewrite as a hard constraint

#### Incorporate into new plan

- delete duplicate sections
- merge duplicate pages
- add redirects plugin
- validate links/builds after IA changes

### `tasks/docs/refactor/chat-session.md`

#### Still valid

- The diagnosis is correct: multiple taxonomies, repeated entrypoints, repo-structure leakage, and unresolved audience split.
- The recommendation to commit fully to agent-first docs is correct.
- The idea that docs should behave like an API surface is correct.

#### Outdated or incorrect

- The early proposed top-level grouping still leaves too much conceptual/tutorial framing.
- The suggestion to maintain separate human docs and agent docs is not the right target anymore. We want one system with one source of truth.

#### Incorporate into new plan

- one axis only
- one home per concept
- no persona sections
- no recommended paths
- delete duplicates aggressively

## 5. Gaps in the current plan and current docs

### Coverage gaps

- No single canonical page for the execution contract after the refactor.
- No canonical public page for selector-flag and matcher semantics, even though the CLI refactor made them central.
- No explicit public page for `serve` HTTP/SSE contracts.
- `reference/api-overview.md` is structurally wrong. It duplicates other pages and has no single source.
- `node-api-for-agents.md` still absorbs too many unrelated concepts.
- Recovery guidance is split between `error-handling.md`, `troubleshooting.md`, `known-issues.md`, and doctor docs without a precise separation.
- Multi-device targeting guidance is isolated in a persona page instead of living next to device/package contract docs.
- Timeout guidance is split away from the execution contract.
- Recording docs are persona-framed instead of being treated as a reference contract.

### Terminology gaps

- "agent guide", "API overview", "execution model", and "reference" overlap and are not cleanly separated.
- "Getting Started" currently mixes setup, conceptual background, and project overview.
- OpenClaw-specific framing leaks into public runtime docs.

### Pipeline gaps

- `source-map.yaml` duplicates the IA that `mkdocs.yml` already expresses.
- `generate_llms_full.py` compiles based on the source map, not the actual canonical nav.
- code-derived page generation is implicit and under-specified
- internal docs are excluded only by omission, not by an explicit mechanism
- `api-overview` curated generation has no single-source guarantee

## 6. Current vs proposed layout

| Current | Proposed | Notes |
|--------|--------|------|
| Home + Recommended paths + Getting Started + For AI Agents | Home + Start | Remove duplicate entry trees and persona split. |
| Getting Started | Start | Keep only setup/first-command/operator setup. |
| For AI Agents | Removed | Distribute content into Start and Reference. |
| Reference | Reference | Keep, but tighten around contracts only. |
| Architecture | Removed from public nav | Move or exclude as internal. |
| Design and Rationale | Removed from public nav | Internal only. |
| Troubleshooting | Recovery | Keep as operational recovery, not generic troubleshooting dump. |
| Skills | Skills | Keep as separate domain, tighten naming and links. |
| `reference/api-overview.md` | Deleted | Replace with stronger canonical contract pages. |
| `docs/node-api-for-agents.md` | Deleted after split | Split into Start + Reference pages. |
| `docs/terminology.md` | Deleted | Inline terms where used. |
| `docs/openclaw-first-run.md` | Deleted | Remove public OpenClaw-specific pathing. |
| `docs/running-clawperator-on-android.md` | Merged into Start | Avoid separate conceptual page. |
| `docs/multi-device-workflows.md` | Merged into `reference/device-targeting.md` | Put targeting rules next to device/package contract. |
| `docs/navigation-patterns.md` | Merged into `reference/selector-matching.md` and Recovery | Split contract vs tactics. |
| `docs/reference/timeout-budgeting.md` | Merged into `reference/execution-contract.md` | Reduce page count and duplication. |

## 7. Docs generation pipeline

### Current evaluation of `.agents/skills/docs-generate`

What is good:

- it enforces generated-output boundaries
- it keeps generated docs out of authored surfaces
- it already treats code-derived docs differently from copy pages
- it emits `llms-full.txt`

What is wrong for the target state:

- it treats `source-map.yaml` as canonical
- it encodes public IA twice, in `source-map.yaml` and `mkdocs.yml`
- it allows curated pages like `api-overview` that have no stable canonical source
- its churn policy is optimized for minimal edits, not structural simplification
- it compiles `llms-full.txt` from source-map section order instead of canonical nav order

### Required changes

1. Remove `sites/docs/source-map.yaml` from the public docs architecture.
2. Make `sites/docs/mkdocs.yml` the single canonical navigation manifest.
3. Update `.agents/skills/docs-generate/scripts/generate_llms_full.py` to walk the `mkdocs.yml` nav order, not source-map sections.
4. Replace "curated" page mode with one of:
   - authored source page
   - generated page from explicit code input
5. Replace `reference/api-overview.md` with:
   - either nothing
   - or an authored contract map page with one canonical file
6. Add explicit generators for:
   - CLI reference from `apps/node/src/cli/registry.ts`
   - error codes from `apps/node/src/contracts/errors.ts` plus related result contracts
   - selector matching from `apps/node/src/cli/selectorFlags.ts` plus selector contracts
7. Make page generation path-based and convention-based instead of source-map entry based.
8. Update `scripts/validate_docs_routes.py` and `scripts/docs_build.sh` to validate against nav and generated docs inventory, not source-map.
9. Add redirects support in `mkdocs.yml` and `sites/docs/requirements.txt`.

### Missing capabilities to add

- explicit internal-doc exclusion
- nav-driven `llms.txt` consistency checks
- nav-driven `llms-full.txt` generation
- generated-page provenance reporting without source-map
- dead-page detection after nav/file moves

### Potential new skills

No new skill is strictly required.

Preferred approach:

- extend `docs-generate`
- extend `docs-validate`
- keep docs refactor inside the current skills rather than creating a new one-off skill

Only create a new skill if the code-derived reference generation becomes a reusable standalone workflow with its own scripts and validation gates.

## 8. Internal docs handling

### Recommendation

Use both:

- directory convention: `docs/internal/`
- frontmatter flag: `internal: true`

### Why both

- directory convention makes contributor intent obvious
- frontmatter provides a hard skip signal during transition
- this is simple enough for the project and does not introduce a full metadata system

### Rules

- Public docs generator must ignore any file under `docs/internal/`.
- Public docs generator must also ignore any file with `internal: true`.
- Public nav must not reference internal files.
- `llms-full.txt` must exclude internal docs.
- Existing internal-only docs should be moved under `docs/internal/` during execution where practical.

## 9. Integration with other tasks

### `tasks/docs/validate`

Decision: merge into this effort.

Reason:

- relative-link validation is part of making the new docs architecture safe
- the current task is not a separate product concern
- nav/file churn during this refactor will otherwise create avoidable breakage

Execution impact:

- absorb the task into the pipeline phase
- close the task when nav-driven validation and inner-link checks are part of the normal build

### `tasks/docs/api-overview`

Decision: merge into this effort.

Reason:

- `reference/api-overview.md` is not an isolated page problem
- it is a symptom of the current duplicated architecture
- the correct fix is structural: delete it or replace it with a single-source page as part of the broader IA cleanup

Execution impact:

- do not keep a curated overview page as a special case
- close the task when the page is either deleted or replaced with a single canonical source

## 10. Execution plan

### Phase 1: flatten the information architecture

- delete persona sections from nav
- delete recommended-path sections from `docs/index.md`
- define final nav in `mkdocs.yml`
- add redirects plugin
- define final output paths

### Phase 2: split and delete the monoliths

- split `docs/node-api-for-agents.md`
- merge `docs/agent-quickstart.md`, `docs/first-time-setup.md`, `docs/openclaw-first-run.md`, and `docs/running-clawperator-on-android.md` into the new Start section
- merge `docs/multi-device-workflows.md` and `docs/reference/device-and-package-model.md`
- merge `docs/navigation-patterns.md` into reference/recovery destinations
- merge `docs/reference/timeout-budgeting.md` into execution contract
- delete obsolete pages

### Phase 3: move internal docs out of the public surface

- move release/site/design/conformance docs to `docs/internal/` where worth keeping
- exclude them from generation
- remove all public-nav references

### Phase 4: fix generation and validation

- remove `source-map.yaml`
- update `docs-generate`
- update `generate_llms_full.py`
- update `docs-validate`
- update `scripts/validate_docs_routes.py`
- update `scripts/docs_build.sh`

### Phase 5: fix machine-facing entrypoints

- rewrite `sites/docs/static/llms.txt` to only point at canonical pages
- regenerate `llms-full.txt` from final nav order
- update docs links emitted from `doctor`
- add or update install-time `~/.clawperator/AGENTS.md`

### Phase 6: validate and cut over

- run docs generation
- run docs validation
- run `./scripts/docs_build.sh`
- verify redirects
- verify `llms.txt`
- verify `llms-full.txt`
- verify any `docsUrl` values in doctor outputs

## 11. Non-negotiable acceptance criteria

- `llms-full.txt` is generated from the same canonical structure as the docs site.
- `mkdocs.yml` is the only public IA manifest.
- `source-map.yaml` is removed.
- no public page appears in more than one nav location
- `node-api-for-agents.md` no longer exists as a public page
- `reference/api-overview.md` no longer exists in curated form
- public design/architecture docs are removed or excluded
- all public docs paths resolve in the built site
- internal docs are excluded deterministically
- `llms.txt` points only to canonical pages
- public docs surface area is materially smaller than the current tree

## 12. Recommended default implementation stance

When choosing between preserving a page and deleting it:

- prefer deletion
- migrate only the minimum necessary content
- favor contract pages over narrative pages
- avoid introducing new overview pages unless they eliminate more duplication than they create

The correct end state is not "better organized versions of the existing docs".

The correct end state is a smaller, stricter, machine-first documentation system.
