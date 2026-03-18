# Docs Site Guardrails

`sites/docs/` contains both generated output and deployable build artifacts.

- `sites/docs/docs/` is generated from canonical sources in `docs/`,
  `apps/node/src/`, and `../clawperator-skills/docs/` via the
  `.agents/skills/docs-generate/` workflow.
- `sites/docs/site/` is MkDocs build output and is not an authored surface.
- `sites/docs/static/` contains source-controlled root files for the docs site.

Do not hand-edit generated docs or built site files. Fix the real source, then
regenerate and validate with:

```bash
python3 scripts/validate_docs_source_of_truth.py
./scripts/docs_build.sh
```
