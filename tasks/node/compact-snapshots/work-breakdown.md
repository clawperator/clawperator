# Add structurally compact snapshot output Work Breakdown

Parent plan: `tasks/node/compact-snapshots/plan.md`

## Executive Summary

One PR and one phase. Implementation has not started. Each phase includes its own tests and docs. One bounded implementation PR.

## Status

| Item | Value |
| --- | --- |
| State | Not started |
| Total PRs | 1 |
| Total phases | 1 |
| Completed | None |
| Remaining | Phase 1 |
| Current / Next | Phase 1 |
| Blockers | Await `tasks/api/selector-inspection` PR-1; PR-2 is not required |

## Hard Rules

- Follow the dependency and release gates in `tasks/releases/v0.10/plan.md`. Implement only the requested PR; where this pack has two PRs, merge the first before starting the second. Update both task status tables and the release row after each merged PR.

- Follow the parent contract; do not invent alternative default behavior.
- Use branch-local Node output and the matching debug Operator for implementation validation. Never repair or uninstall packages on a device used by another task.
- Commit one logical phase with its tests and authored docs. Do not defer tests to another phase.
- Use the docs-author and docs-build skills for public changes. Do not hand-edit generated pages.
- When affected skill consumers require migration, coordinate changes and version bumps in the sibling skills repository with its active owner, and run its smoke checks per AGENTS.md. Do not silently expand this checkout into unrelated skill edits.
- Keep fixtures generic, using `com.example.fixture`, neutral labels, and caller-provided device IDs. Never copy application-specific research assets into this repository.
- Preserve commandId/taskId and explicit device/operator selection through every path. Do not add autonomous recovery or app-specific policy.
- Record plan deviations before committing. Stop for material contract changes; continue for equivalent internal implementation choices.
- Inspect existing tests listed below before editing. Where the affected path lacks coverage, add the specified regression cases in the same phase.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Topic | Authority |
| --- | --- |
| Governing repository rules | `AGENTS.md` |
| Stable task contract | `tasks/node/compact-snapshots/plan.md` |
| Snapshot path | `apps/node/src/domain/observe/snapshot.ts` |
| Extraction | `apps/node/src/domain/executions/snapshotHelper.ts` |
| CLI | `apps/node/src/cli/commands/observe.ts` |
| MCP truncation | `apps/node/src/mcp/tools/core.ts` |
| Existing tests | `apps/node/src/test/unit/snapshotHelper.test.ts` |
| MCP tests | `apps/node/src/test/integration/mcp.test.ts` |
| Public docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |
| Existing public contract exemplar (match its examples and caveats) | `docs/api/navigation.md` |
| Generated docs workflow | `.agents/skills/docs-build/SKILL.md` |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Projection and public options | 1 | default | Await `tasks/api/selector-inspection` PR-1; PR-2 is not required |

## Phase 1: Projection and public options

### Agent Tier

default

### Goal

Ship compact snapshot formatting without changing capture semantics.

### Files or Surfaces To Change

- `apps/node/src/domain/observe/compactSnapshot.ts`
- `apps/node/src/cli/commands/observe.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/mcp/tools/core.ts`
- `apps/node/src/test/unit/compactSnapshot.test.ts`
- `apps/node/src/test/unit/observe.test.ts`
- `apps/node/src/test/integration/mcp.test.ts`
- `docs/api/snapshot.md`
- `docs/api/mcp.md`

### Steps

1. Reuse snapshot extraction and execution metadata; add pure XML-to-projection conversion and exclusive raw output writing.
2. Expose validated CLI/MCP options and preserve raw mode, including existing MCP maxChars behavior.
3. Add generic XML fixtures covering repeated IDs, empty-label switches, escaped text, unknown attributes, Unicode, and large trees. Test schema/counts, not just smaller length.
4. On a dedicated target capture raw plus compact and compare every returned node with its raw path. Record payload sizes and latency as samples, not performance guarantees. Update docs and generated help.

### Acceptance Criteria

- Raw XML output is byte-for-byte preserved in its artifact; default snapshot callers are unchanged.
- Node-boundary truncation yields valid JSON, truthful omitted counts, and retained parent paths.
- Malformed XML and malicious entity declarations fail explicitly; absent visibility stays null.
- MCP rejects arbitrary rawPath, saveRaw returns a runtime-owned artifact, and default raw-mode callers stay unchanged.
- Invalid/missing flag values, blank paths, output collisions, compact/maxChars conflict, and CLI/MCP equivalence are covered.
- Compact output includes all retained state fields; no duplicate full XML appears in compact presentation.
- Human review: output accuracy matches observed evidence; scope covers the named surfaces only; important claims trace to tests or findings; schema, section order, and public help match the contract.

### Validation

Run from repository root, in order. Unit/subprocess tests are the primary reproducible gate. Live checks prove device integration only and require a dedicated target with the matching debug Operator, enabled accessibility, and an unlocked screen. A skipped live check is not a pass; record its unmet prerequisite.

```sh
npm --prefix apps/node ci
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
: "${DEVICE_ID:?Select a test device}"
CAPTURE_ROOT="$(mktemp -d)"
node apps/node/dist/cli/index.js snapshot --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev --compact --max-nodes 20 --raw-path "$CAPTURE_ROOT/hierarchy.xml"

```

### Expected Commit

```text
feat(snapshot): add bounded structural projection
```

## Execution Findings

Create `findings.md` at the start of the first phase, before source edits. Use these sections in order: Environment and Versions; Reproduction Inputs; Observed Results (command, exit code, JSON fields, artifact paths); Source Mapping; Decisions and Deviations; Validation (case, expected, actual, pass/fail/blocked); Remaining Work. Append phase-specific results before its commit. Do not paste sensitive or application-specific captures. Keep raw local evidence outside tracked files and use generic reproduction fixtures in tests.
