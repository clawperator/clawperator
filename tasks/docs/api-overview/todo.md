# API Overview Page Follow-up TODO

## Establish a single authored source for `reference/api-overview.md`

### Problem

`reference/api-overview.md` is a `curated` source-map entry assembled from
multiple source files rather than having one canonical authored doc.

Relevant source-map entry (`sites/docs/source-map.yaml`):

```yaml
- output: reference/api-overview.md
  title: API Overview
  mode: curated
  sources:
    - ...
```

Because the page is assembled by the docs-generate skill from several sources,
there is no single file an editor can update to keep it accurate. If any
contributing source drifts - for example, if the execution payload schema
changes in `docs/node-api-for-agents.md` but the curated assembly logic is not
updated - the overview page can silently become inconsistent with the real
contract.

### Why it matters

- `reference/api-overview.md` is linked from `docs/index.md`, the agent
  quickstart, and the For AI Agents section of the nav. It is one of the first
  pages a cold-start agent encounters.
- The `llms.txt` and `llms-full.txt` surfaces also include it, so drift here
  affects machine-readable onboarding material.
- Curated mode is harder to audit than a single-source `copy` or `inline` page.

### Desired outcome

Evaluate whether `reference/api-overview.md` should be:

1. **Converted to a single authored source** in `docs/reference/api-overview.md`
   with `mode: copy` in the source-map. This is the simplest path and gives one
   canonical file to update.
2. **Kept as curated** but with an explicit test or CI check that verifies the
   assembled page stays consistent with its contributing sources after any
   contract change.

Option 1 is preferred once the API surface stabilizes enough to justify a
static authored overview page.

### Guardrails

- Do not change the output path or nav title - agents and llms.txt consumers
  have the current URL indexed.
- Any conversion must be followed by a docs-generate run and docs_build.sh
  validation before commit.
- If keeping curated mode, document the contributing sources explicitly in the
  source-map entry comment so future editors know where to make changes.
