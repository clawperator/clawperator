# Docs Site Guardrails

`sites/docs/` contains the docs staging pipeline and deployable build artifacts.

- `docs/` contains authored public docs sources.
- `sites/docs/.build/` is generated staging output assembled from `docs/`,
  `apps/node/src/`, and the docs skill scripts.
- `sites/docs/site/` is MkDocs build output and is not an authored surface.
- `sites/docs/static/` contains source-controlled root files for the docs site.

Do not hand-edit generated staging or built site files. Fix the real source,
then regenerate and validate with:

```bash
./scripts/docs_build.sh
```
