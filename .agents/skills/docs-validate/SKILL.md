---
name: docs-validate
description: Validate that docs changes respect the canonical source-of-truth boundaries and that generated docs were not edited directly. Use when reviewing docs diffs, before `./scripts/docs_build.sh`, or when `sites/docs/.build/` and `sites/docs/site/` need to be checked against their authored and code-derived sources.
---

# Docs Validate

Use this skill to validate that docs changes came from the right source files.

## Purpose

This skill checks the docs source-of-truth contract enforced by the build:

- `docs/` contains authored public docs
- `sites/docs/.build/` is generated staging output
- `sites/docs/site/` is build output

If the assembled docs or built site violate those build invariants, this skill
should fail.

## Workflow

1. Run the docs build:
   - `./scripts/docs_build.sh`
2. If it fails:
   - move the docs fix into the canonical source file or generator
   - rerun the build
3. If it passes:
   - the docs site and machine-facing artifacts are in sync

## Notes

- This skill is complementary to the normal docs route validator in
  `scripts/validate_docs_routes.py`.
- The old source-of-truth checker is retired and is not part of
  `./scripts/docs_build.sh`.
- Use the repo-local `docs-generate` skill to regenerate the staging output
  after correcting authored sources or code-derived generators.
