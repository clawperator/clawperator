---
name: docs-validate
description: Validate that docs changes respect the canonical source-of-truth boundaries and that generated docs were not edited directly. Use when reviewing docs diffs, before `./scripts/docs_build.sh`, or when `sites/docs/docs/` changed and you need to confirm the matching authored sources changed too.
---

# Docs Validate

Use this skill to validate that docs changes came from the right source files.

## Purpose

This skill guards the docs source-of-truth contract:

- `sites/docs/docs/` is generated output
- `sites/docs/site/` is build output
- authored docs live in `docs/`, `apps/node/src/`, and `../clawperator-skills/docs/`

If generated docs changed without a corresponding canonical source change, this
skill should fail.

## Workflow

1. Read `sites/docs/source-map.yaml` to identify the source files for any
   changed generated page.
2. Run the validator script:
   - `.agents/skills/docs-validate/scripts/validate_source_of_truth.py --repo-root <clawperator> --skills-root <clawperator-skills>`
3. If it fails:
   - move the docs fix into the canonical source file
   - regenerate the docs output through the docs workflow
   - rerun this skill
4. If it passes:
   - continue to docs generation or docs site build validation

## Notes

- This skill is complementary to the normal docs route validator in
  `scripts/validate_docs_routes.py`.
- Use the repo-local `docs-generate` skill to regenerate `sites/docs/docs/`
  after correcting authored sources.
