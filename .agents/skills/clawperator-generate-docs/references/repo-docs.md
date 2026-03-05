# Clawperator docs generation reference

## Canonical sources

- Core docs: `docs/**/*.md`
- Node API source of truth: `apps/node/src/**/*.ts`, `apps/node/package.json`
- Skills docs: `../clawperator-skills/docs/**/*.md`
- Public docs site output: `sites/docs/docs/**/*.md`
- Public docs manifest: `sites/docs/source-map.yaml`

## Topic ownership

- Product overview, setup, troubleshooting, design docs:
  - Source from `docs/`
- CLI/API reference, commands, flags, contracts, result shapes:
  - Source from `apps/node/`
- Skills authoring and runtime usage:
  - Source from `../clawperator-skills/docs/`

## Public docs generation contract

- Generated output lives in `sites/docs/docs/`.
- Scratch output lives in `sites/docs/.generated/`.
- Inventory output lives in `sites/docs/docs_inventory.json`.
- Build metadata lives in `sites/docs/docs_build.json`.

## Minimal-diff rules

- Keep the current output path unless the manifest changes.
- Keep the current page title unless the source title or scope changed.
- Prefer copying or lightly curating authored markdown over rewriting it.
- For code-derived pages, update only the sections affected by code changes.
- Reject edits that only reflow paragraphs, normalize punctuation, or restyle text.
