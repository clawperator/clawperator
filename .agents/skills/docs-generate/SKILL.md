---
name: docs-generate
description: Regenerate the Clawperator public docs site from the canonical sources in clawperator/docs, clawperator/apps/node, and clawperator-skills/docs. Use when Codex needs to inventory doc sources, update sites/docs/source-map.yaml, assemble sites/docs/.build/, or review docs diffs.
---

# Docs Generate

Assemble the public docs site from authored markdown and code-derived inputs.
Treat `sites/docs/.build/` as generated staging output, not an authored surface.

## Source of Truth Contract

`docs/` is the authored public docs tree. `apps/node/src/` is the source of
truth for CLI/API behavior. `source-map.yaml` only describes code-derived page
generation and marker expansion.

When you find an error in a generated page:
1. Identify whether it comes from authored docs or code-derived output.
2. Fix the authored source in `docs/` or the code source in `apps/node/src/`.
3. Re-run the docs build workflow.
4. Commit the source fix and the regenerated output together.

Historical docs policy:
- Do not preserve stale planning docs, completed release checklists, or superseded roadmaps just for history.
- If a doc is no longer an active source of truth, delete it after migrating any remaining actionable content elsewhere.
- Treat stale public-doc pages as defects, not archive material.

## Workflow

Helper scripts for this skill live in the skill directory, not in the repo root.
When this file refers to `scripts/...`, resolve that path relative to the skill
directory first.

1. Confirm the repo roots exist:
   - Clawperator repo: current working tree
   - Public docs site: `sites/docs/`
2. Read `sites/docs/mkdocs.yml` and `sites/docs/source-map.yaml` before editing docs build logic.
3. Run the deterministic assembly step:
   - `.agents/skills/docs-generate/scripts/assemble.py`
4. If you need to inspect the generated CLI or marker output directly, run the relevant helper:
   - `.agents/skills/docs-generate/scripts/generate_cli_reference.py`
   - `.agents/skills/docs-generate/scripts/generate_error_table.py`
   - `.agents/skills/docs-generate/scripts/generate_selector_table.py`
5. Validate the assembled docs and built site:
   - `./scripts/docs_build.sh`
6. If the build fails, fix the underlying source or generator and rerun the build.

## Removing Docs

When a source doc should be deleted because it is stale or no longer useful,
remove all of its public-doc references in the same change:

1. Delete the source doc.
2. Remove its nav entry from `sites/docs/mkdocs.yml`.
3. Remove any `source-map.yaml` entry that points at it.
4. Remove any index or landing-page links that point to it.
5. Regenerate the docs build.

Do not leave deleted docs referenced in the docs site manifest or navigation.

## Churn Policy

- Prefer minimal edits to existing authored pages.
- Do not reorder navigation or rename output files unless the IA changes.
- Do not rewrap paragraphs just to change formatting.
- If a user explicitly wants stale docs removed, prefer deletion plus link cleanup over adding "historical note" text.

## Node API Rules

- Use `apps/node/src/cli/registry.ts` and command modules as the source of truth for CLI coverage and flags.
- Use `apps/node/src/contracts/**/*.ts` and related domain code for API contracts, errors, and result envelopes.
- If the repo has buildable CLI output, prefer extracting help text from the actual CLI over freehand summaries.
- Narrative pages may summarize the API, but reference details must stay anchored to code.

## Source Map Rules

- `sites/docs/source-map.yaml` only defines code-derived pages and marker expansions.
- Add new code-derived pages or markers there before generating them.

## Resources

- `.agents/skills/docs-generate/scripts/assemble.py`
  - Deterministic docs staging assembly.
- `.agents/skills/docs-generate/scripts/generate_llms_full.py`
  - Build the primary `llms-full.txt` artifact from `mkdocs.yml` and `.build/`.
