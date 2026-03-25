## Prompt for PR-1: Docs Pipeline + Skeleton

```
You are implementing PR-1 of the Clawperator docs refactor. This is pure infrastructure work - new build pipeline, new nav structure, placeholder pages. No content authoring.

## Branch

Work on the `docs-refactor/phase-1` branch, created from `main` at commit 7a15048.

## Plan and Work Breakdown

Read these files FIRST before doing anything:
- `tasks/docs/refactor/plan.md` - full plan (Sections 1a, 3, 6 are most relevant to PR-1)
- `tasks/docs/refactor/work-breakdown.md` - task-level breakdown (Phase 0 + PR-1 tasks)

These are the authoritative specifications. Follow them precisely.

## Commit Discipline

This project uses Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). Make logical interim commits as each task or coherent sub-task is completed. Do NOT batch all work into one giant commit. Natural commit boundaries:

1. Task 0.1 (reference snapshot) - one commit
2. Task 1.1 (gitignore + remove generated docs) - one commit
3. Task 1.2 (assembly script) - one commit
4. Task 1.3 (generator scripts) - one commit (or one per generator if complex)
5. Task 1.4 (source-map.yaml rewrite) - one commit
6. Task 1.5 (mkdocs.yml rewrite) - one commit
7. Task 1.6 (build/validation script updates) - may be 2-3 commits (docs_build.sh, generate_llms_full.py, validate_docs_routes.py)
8. Task 1.7 (CI job) - one commit
9. Task 1.8 (placeholder pages + end-to-end verification) - one commit

Each commit should leave the repo in a non-broken state where possible. If a commit necessarily breaks things temporarily (e.g., removing generated docs before the new pipeline is wired), note it in the commit message.

## What You Are Building

You are replacing the current docs pipeline:

```
source-map.yaml -> agent-driven generation -> sites/docs/docs/ (committed) -> mkdocs build -> site/
```

With a new deterministic pipeline:

```
docs/ (authored, committed) + source-map.yaml (assembly manifest) + apps/node/src/ (code inputs)
  -> assemble.sh (deterministic script)
  -> sites/docs/.build/ (gitignored staging)
  -> mkdocs build
  -> sites/docs/site/ (gitignored HTML) + llms-full.txt
```

## Current State (what exists now)

### Key existing files you must understand before modifying:

- `sites/docs/mkdocs.yml` - Current nav has ~38 pages across 8 sections. `docs_dir: docs` (points to `sites/docs/docs/`). Uses `terminal` theme with `strict: true`.
- `sites/docs/source-map.yaml` - ~246 lines. Has `site:`, `repos:`, `rules:`, `sections:` with `pages[]` entries each having `output`, `title`, `mode` (copy/curated/code-derived), `sources`.
- `sites/docs/docs/` - ~38 committed generated markdown files. This entire directory gets removed from git.
- `scripts/docs_build.sh` - Build orchestration. Current sequence: venv setup -> validate_source_of_truth.py -> mkdocs build -> generate_sitemap_metadata.py -> generate_llms_full.py -> copy static files -> validate_docs_routes.py -> verify output.
- `.agents/skills/docs-generate/scripts/generate_llms_full.py` - Reads `source-map.yaml` `sections[].pages[]` format, reads from `sites/docs/docs/`, writes to 3 output paths.
- `scripts/validate_docs_routes.py` - Takes `--site-dir`, `--source-map`, `--generated-docs-dir`, `--llms-txt`. Discovers routes from source-map `- output:` lines. Has `check_inner_page_links()` that reads from `--generated-docs-dir`.
- `.agents/skills/docs-validate/scripts/validate_source_of_truth.py` - Guards against editing committed generated docs without source changes. No longer needed in new pipeline.
- `.agents/skills/sitemaps-generate/scripts/generate_sitemap_metadata.py` - Patches sitemap.xml using source-map.yaml. Depends on old format.
- `sites/docs/requirements.txt` - Currently: `mkdocs>=1.5,<2.0`, `mkdocs-terminal>=0.1.0,<5.0`, `PyYAML>=5.1,<7.0`
- `.github/workflows/pull-request.yml` - Has android-unit-tests, node-tests, validation-tests jobs. NO docs build job.
- `.agents/skills/docs-generate/scripts/` - Contains `build_inventory.py`, `diff_report.py`, `generate_llms_full.py`, `write_build_metadata.py`. The first three are candidates for retirement/simplification.

### Authored source docs (in `docs/`):
These are the real source files. ~27 markdown files across `docs/`, `docs/reference/`, `docs/ai-agents/`, `docs/design/`, `docs/skills/`.

## Task-by-Task Instructions

### Task 0.1: Reference Snapshot

Create `tasks/docs/refactor/reference/`. Copy all current public docs sources into it. Add a README.md marking it non-authoritative. See work-breakdown for exact acceptance criteria.

### Task 1.1: Remove Committed Generated Docs + Gitignore

1. `git rm -r sites/docs/docs/` 
2. Add to `sites/docs/.gitignore`: `.build/` and `docs/`
3. Add to `docs/.gitignore` (create if needed): `api/cli.md`
4. Create empty directories: `docs/api/`, `docs/skills/`, `docs/troubleshooting/` (add `.gitkeep` files if needed)

Note: `docs/skills/skill-from-recording.md` was already moved to the skills repo in a prior commit. No action needed for it.

### Task 1.2: Assembly Script

Create `.agents/skills/docs-generate/scripts/assemble.sh` (or `.py` - Python may be easier for YAML parsing).

This script is the heart of the new pipeline. It must:

1. **resolve_pages**: Parse `sites/docs/mkdocs.yml` nav to extract all page paths. For each, determine if source is authored (`docs/`) or code-derived (`source-map.yaml`). FAIL if any page has no source. FAIL if source-map defines outputs not in nav. FAIL on duplicate output paths.
2. **clean_staging**: Remove and recreate `sites/docs/.build/`.
3. **copy_authored**: Copy authored pages from `docs/` to `.build/`, preserving structure. Skip `docs/internal/`.
4. **generate_code_derived**: Run generator scripts for code-derived pages (e.g., `api/cli.md`), write output to `.build/`.
5. **apply_markers**: For authored pages with `<!-- CODE-DERIVED: <id> -->` markers, run the associated generator and replace the marker in the `.build/` copy. FAIL if any marker remains unexpanded.
6. **validate_build**: Verify every nav page exists in `.build/`. Verify no unexpected pages. Verify no unexpanded markers.

Support `--verbose` flag. Exit non-zero on any validation failure.

The nav in mkdocs.yml is nested YAML. Example structure:
```yaml
nav:
  - Docs Home: index.md
  - Setup: setup.md
  - API:
    - Overview: api/overview.md
    - CLI Reference: api/cli.md
```
You need to recursively walk this to extract all page paths (the leaf string values). Ignore external URLs (like `https://clawperator.com`).

### Task 1.3: Generator Scripts

Create in `.agents/skills/docs-generate/scripts/`:

1. **`generate_cli_reference.py`** - Input: `apps/node/src/cli/registry.ts` + `apps/node/src/cli/commands/`. Output: full `api/cli.md`. Must parse the TypeScript to extract command names, summaries, flags, aliases. Keep the parser simple - regex/string matching is fine. This does not need to be a full TS parser.

2. **`generate_error_table.py`** - Input: `apps/node/src/contracts/errors.ts`. Output: markdown table for `<!-- CODE-DERIVED: error-codes -->` marker expansion.

3. **`generate_selector_table.py`** - Input: `apps/node/src/cli/selectorFlags.ts`. Output: markdown table for `<!-- CODE-DERIVED: selector-flags -->` marker expansion.

Each script must: run standalone, produce deterministic output, fail clearly if source files are missing.

### Task 1.4: Rewrite source-map.yaml

Replace the entire file with the reduced assembly manifest format. See plan Section 6 for the exact target schema:

```yaml
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

No `site:`, `repos:`, `rules:`, `sections:` blocks. No `mode: copy` entries. No `cross_repo` section.

### Task 1.5: Rewrite mkdocs.yml

Complete rewrite. Key changes:
1. `docs_dir: .build` (not `docs`)
2. New nav tree (exactly 20 pages in 4 sections + home + setup at top level):

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

3. Add `mkdocs-redirects` plugin with the full redirect map from plan Section 6 (approximately 30 redirects from old URLs to new).
4. Add `mkdocs-redirects` to `sites/docs/requirements.txt`.
5. Keep `strict: true`, `terminal` theme, `site_url`.
6. Remove the `clawperator.com` external link from nav.

### Task 1.6: Update Build and Validation Scripts

**`scripts/docs_build.sh`:**
- Add call to assembly script as FIRST step (after venv setup, before mkdocs build)
- Remove or skip `validate_source_of_truth.py` call
- The sitemap generation script (`generate_sitemap_metadata.py`) depends on the old source-map format. Either update it for the new format or remove the call if MkDocs-native `sitemap.xml` generation is sufficient. MkDocs generates `sitemap.xml` by default - check if that's adequate. If so, remove the `generate_sitemap_metadata.py` call.
- Update `validate_docs_routes.py` invocation: change `--generated-docs-dir` to point at `.build/`

**`generate_llms_full.py` (SIGNIFICANT REWRITE):**
This generates `llms-full.txt`, the PRIMARY artifact of the entire docs system.

Current: reads `source-map.yaml` sections → iterates `section.pages[]` → reads from `sites/docs/docs/`.

New: reads `mkdocs.yml` → walks nested nav structure → reads from `sites/docs/.build/`.

The nav YAML structure is different from source-map:
- Source-map has flat `sections[].pages[].output` and `sections[].pages[].title`
- mkdocs.yml has nested dicts: `[{section_title: [{page_title: page_path}, ...]}, ...]`

Must preserve 3 output paths: `sites/docs/site/llms-full.txt`, `sites/docs/static/llms-full.txt`, `sites/landing/public/llms-full.txt`.

**`validate_docs_routes.py` (SIGNIFICANT UPDATE):**
Current: discovers routes from source-map `- output:` lines, validates against `sites/docs/docs/`.

New: discover routes from `mkdocs.yml` nav (parse the nested YAML, extract all page paths). Validate against `.build/`. Update `--generated-docs-dir` to accept `.build/` path. The `--source-map` flag may become optional or removed. Keep `check_inner_page_links()` working - it should scan `.build/` for relative links.

**Retirement candidates:**
- `validate_source_of_truth.py` - remove or gut it. Drift is architecturally impossible for authored pages now.
- `build_inventory.py`, `diff_report.py`, `write_build_metadata.py` - can be deleted or left for now. They served the old agent-driven generation model. At minimum, make sure `docs_build.sh` no longer calls them.

### Task 1.7: CI Docs Build Job

Add to `.github/workflows/pull-request.yml`:

```yaml
  docs-build:
    name: Build Documentation
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Build docs
        run: ./scripts/docs_build.sh
```

The build only needs Python. No Android SDK, no Node.js.

### Task 1.8: Placeholder Pages + End-to-End Verification

Create minimal placeholder pages in `docs/` for all 20 nav entries. Format:

```markdown
# <Page Title>

Placeholder - content coming in PR-2/PR-3.
```

For pages with CODE-DERIVED markers (`api/errors.md`, `api/selectors.md`), include the markers:

```markdown
# Errors

Placeholder - content coming in PR-2.

<!-- CODE-DERIVED: error-codes -->
```

Then run the full pipeline:
1. Assembly script - verify `.build/` is complete
2. `./scripts/docs_build.sh` - verify full build succeeds
3. Verify `llms-full.txt` contains all 20 pages
4. Verify at least 5 redirects work
5. Do NOT remove placeholders - they stay until PR-2/PR-3 replaces them

## Important Constraints

- Never shorten "Clawperator" to "Claw" anywhere.
- Use regular dashes/hyphens, never em dashes.
- `sites/docs/site/` is the MkDocs HTML output directory. It is gitignored. Do not commit it.
- `sites/docs/.build/` is the new staging directory. It is gitignored. Do not commit it.
- `docs/api/cli.md` is code-derived and gitignored. Do not commit it.
- The `docs/internal/` directory is not published. The assembly script must skip it.
- The assembly script lives at `.agents/skills/docs-generate/scripts/` - NOT in `scripts/`.
- Keep `strict: true` in mkdocs.yml.
- After the full build runs, verify: `sites/docs/site/llms-full.txt` exists, `sites/docs/site/index.html` exists, `sites/docs/site/sitemap.xml` exists.

## Validation (before declaring done)

Run `./scripts/docs_build.sh` end-to-end. It must pass. Then verify:
- [ ] `sites/docs/.build/` contains exactly 20 markdown files matching the nav
- [ ] `llms-full.txt` contains all 20 pages in nav order
- [ ] `git status` shows no `sites/docs/docs/` tracked files
- [ ] At least 5 old URL redirects produce redirect HTML files in `sites/docs/site/`
- [ ] CI workflow file has docs-build job
- [ ] No placeholder content in `llms-full.txt` is missing (all 20 pages present)
```