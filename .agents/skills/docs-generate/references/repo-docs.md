# Clawperator docs generation reference

## Canonical sources

- Core docs: `docs/**/*.md`
- Node API source of truth: `apps/node/src/**/*.ts`, `apps/node/package.json`
- Skills docs: `../clawperator-skills/docs/**/*.md`
- Public docs staging output: `sites/docs/.build/**/*.md`
- Public docs site output: `sites/docs/site/**/*.md`
- Public docs manifest: `sites/docs/source-map.yaml`

## Topic ownership

- Product overview, setup, troubleshooting, design docs:
  - Source from `docs/`
- CLI/API reference, commands, flags, contracts, result shapes:
  - Source from `apps/node/`
- Skills authoring and runtime usage:
  - Source from `../clawperator-skills/docs/`

## Public docs generation contract

- Generated staging output lives in `sites/docs/.build/`.
- Built site output lives in `sites/docs/site/`.
- **Never edit `sites/docs/.build/` or `sites/docs/site/` directly.** They are generated outputs. Fix errors in the source files listed above, then regenerate. Direct edits will be overwritten on the next run and hide the real defect.
- `source-map.yaml` `sources:` entries are validated by the assembly script and must point at real repo files or directories.
- Legacy helper outputs such as `sites/docs/docs_inventory.json` and `sites/docs/docs_build.json` may still be produced by standalone helper scripts, but they are not part of `./scripts/docs_build.sh`.

## Minimal-diff rules

- Keep the current output path unless the manifest changes.
- Keep the current page title unless the source title or scope changed.
- Prefer copying or lightly curating authored markdown over rewriting it.
- For code-derived pages, update only the sections affected by code changes.
- Reject edits that only reflow paragraphs, normalize punctuation, or restyle text.
