# Docs Refactor Plan

Moved from `tasks/node/agent-usage/` PRD-6 and PRD-7.

These are documentation-facing changes that must wait until the API refactoring
(`tasks/api/refactor/`) is complete. Writing docs against a moving API is waste.

---

## Status

Blocked on: `tasks/api/refactor/` (all phases complete)

## Contents

- `prd-6.md` - Docs entry points, AGENTS.md, llms.txt alignment, doctor docs links
- `prd-7.md` - Docs structural reform (four-section hierarchy, duplication collapse)

## Important Notes for Implementing Agent

1. PRD-6 and PRD-7 were written against the old API surface (`action click`,
   `observe snapshot`, etc.). When implementing, all command references,
   examples, and CLI snippets must use the new flat command surface from the
   API refactor.

2. PRD-6's `~/.clawperator/AGENTS.md` template must use the new commands:
   `clawperator snapshot`, `clawperator click --text "..."`, etc.

3. PRD-7's proposed four-section hierarchy (Get Started / Use / Reference /
   Troubleshoot) is still the right target, but the "Reference" section must
   document the new CLI surface, not the old one.

4. The `llms.txt` alignment in PRD-6 must describe the flat command surface.

5. The `docsUrl` values in `readinessChecks.ts` (PRD-6) may need updating if
   PRD-7 moves pages.

## Sequencing

PRD-6 before PRD-7. PRD-7 is the final PR in the entire project.
