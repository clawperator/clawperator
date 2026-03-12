---
name: docs-generate
description: Regenerate the Clawperator public docs site from the canonical sources in clawperator/docs, clawperator/apps/node, and clawperator-skills/docs. Use when Codex needs to inventory doc sources, update sites/docs/source-map.yaml, refresh sites/docs/docs/*.md with minimal churn, review docs diffs, or emit docs build metadata for docs.clawperator.com.
---

# Docs Generate

Keep authored documentation in its current home. Treat `sites/docs/docs/` as generated public-site output.

## Source of Truth Contract

**`sites/docs/docs/` is generated output. Never edit it directly.**

Treat it like a build artifact - the same way you would never hand-edit a compiled binary or `dist/` output. Direct edits to generated files will be overwritten the next time the skill runs, and they obscure the real problem in the source.

When you find an error in a generated page:
1. Identify the source file via `sites/docs/source-map.yaml` (check the `sources:` field for the relevant output page).
2. Fix the error in the source file (`docs/`, `../clawperator-skills/docs/`, or `apps/node/src/`).
3. Re-run this skill to regenerate the affected output pages.
4. Commit the source fix and the regenerated output together.

Source locations by topic:
- Product overview, setup, architecture, troubleshooting, design: `docs/`
- Skills authoring, usage model, device prep: `../clawperator-skills/docs/`
- CLI reference, error codes, API contracts: `apps/node/src/`

Historical docs policy:
- Do not preserve stale planning docs, completed release checklists, or superseded roadmaps just for history.
- If a doc is no longer an active source of truth, delete it after migrating any remaining actionable content elsewhere.
- Treat stale public-doc pages as defects, not archive material.

## Workflow

Helper scripts for this skill live in the skill directory, not in the repo root:
- `.agents/skills/docs-generate/scripts/build_inventory.py`
- `.agents/skills/docs-generate/scripts/diff_report.py`
- `.agents/skills/docs-generate/scripts/write_build_metadata.py`

When this file refers to `scripts/...`, resolve that path relative to the skill directory first.

1. Confirm the repo roots exist:
   - Clawperator repo: current working tree
   - Skills repo: `../clawperator-skills` unless the user states otherwise
   - Public docs site: `sites/docs/`
2. Read `sites/docs/source-map.yaml` before editing docs output. It defines the public IA, slugs, output paths, and which sources feed each page.
3. Generate an inventory before rewriting anything:
   - Run `.agents/skills/docs-generate/scripts/build_inventory.py --repo-root <clawperator> --skills-root <clawperator-skills> --output <clawperator>/sites/docs/docs_inventory.json`
   - Use the inventory to confirm headings, doc areas, and candidate source files.
4. Preserve source-of-truth boundaries:
   - `docs/**/*.md` and `../clawperator-skills/docs/**/*.md` are authored narrative docs.
   - `apps/node/src/**/*.ts` and `apps/node/package.json` are the source of truth for CLI/API details.
   - Do not make the LLM the authority for Node API reference details when code inspection or CLI help can answer the question.
5. Generate into a scratch directory first:
   - Render proposed files into `sites/docs/.generated/`
   - Keep titles, slugs, and ordering stable unless `sites/docs/source-map.yaml` changes or the user requests an IA change.
6. Gate churn before copying files over:
   - Run `.agents/skills/docs-generate/scripts/diff_report.py <clawperator>/sites/docs/docs <clawperator>/sites/docs/.generated`
   - Prefer patch edits over full rewrites.
   - Reject reflow-only churn, title churn, or broad page rewrites without a source change that justifies them.
7. If the diff is acceptable, copy only the changed files from `.generated/` into `sites/docs/docs/`.
8. Emit build metadata after a successful regeneration:
   - Run `.agents/skills/docs-generate/scripts/write_build_metadata.py --repo-root <clawperator> --skills-root <clawperator-skills> --output <clawperator>/sites/docs/docs_build.json`
   - This is the docs build identifier. Do not hand-bump a docs version.

### Removing Docs

When a source doc should be deleted because it is stale or no longer useful, remove all of its public-doc references in the same change:

1. Delete the source doc.
2. Remove its entry from `sites/docs/source-map.yaml`.
3. Remove any nav entry from `sites/docs/mkdocs.yml`.
4. Remove any index or landing-page links that point to it.
5. Delete the generated page under `sites/docs/docs/`.
6. Re-run the normal inventory/diff/build-metadata flow so the docs site no longer contains dead links.

Do not leave deleted docs referenced in the docs site manifest or navigation.

## Churn Policy

- Prefer minimal edits to existing generated pages.
- Do not reorder navigation or rename output files unless `sites/docs/source-map.yaml` changes.
- Do not change page titles unless the source title changed or the current title is wrong.
- Do not rewrap paragraphs just to change formatting.
- Flag high churn before applying it. Use `.agents/skills/docs-generate/scripts/diff_report.py` thresholds as the default guardrail.
- If a user explicitly wants stale docs removed, prefer deletion plus link cleanup over adding "historical note" text.

## Node API Rules

- Use `apps/node/src/cli/index.ts` and command modules as the source of truth for CLI coverage and flags.
- Use `apps/node/src/contracts/**/*.ts` and related domain code for API contracts, errors, and result envelopes.
- If the repo has buildable CLI output, prefer extracting help text from the actual CLI over freehand summaries.
- Narrative pages may summarize the API, but reference details must stay anchored to code.

## Source Map Rules

- `sites/docs/source-map.yaml` is the canonical public-docs manifest.
- Keep it explicit:
  - output path
  - title
  - source files
  - generation mode (`copy`, `curated`, `code-derived`)
  - notes for bounded rewriting
- Add new public pages there before generating them.

## Resources

- `.agents/skills/docs-generate/scripts/build_inventory.py`
  - Generate `docs_inventory.json` from the three source areas.
- `.agents/skills/docs-generate/scripts/diff_report.py`
  - Summarize file and line churn between current docs and proposed docs.
- `.agents/skills/docs-generate/scripts/write_build_metadata.py`
  - Write deterministic build metadata from repo commits and the source-map checksum.
- `references/repo-docs.md`
  - Repo-specific source-of-truth map and generation contract.
