# Add structurally compact snapshot output Implementation

Contract: [plan.md](plan.md). Dependencies and release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## PR Scope

| PR | Purpose | Phase | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Projection and public options | 1 | R4 merged; R5 is not required (see `docs/internal/design/selector-inspection.md`) |

Implement the requested PR through its acceptance criteria, relevant checks, in-scope repairs, docs, and local commits. A dependency becoming available does not authorize the next PR. Routine implementation choices are yours; raise only decisions that change the contract or scope.

## PR-1: Projection and public options

Ship compact snapshot formatting without changing capture semantics.

### Work

- Reuse snapshot extraction and execution metadata; add pure XML-to-projection conversion and exclusive raw output writing.
- Expose validated CLI/MCP options and preserve raw mode, including existing MCP maxChars behavior.
- Add generic XML fixtures covering repeated IDs, empty-label switches, escaped text, unknown attributes, Unicode, and large trees. Test schema/counts, not just smaller length.
- On a dedicated target capture raw plus compact and compare every returned node with its raw path. Record payload sizes and latency as samples, not performance guarantees. Update docs and generated help.

### Affected Sources

- `apps/node/src/domain/observe/compactSnapshot.ts`
- `apps/node/src/cli/commands/observe.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/mcp/tools/core.ts`
- `apps/node/src/test/unit/compactSnapshot.test.ts`
- `apps/node/src/test/unit/observe.test.ts`
- `apps/node/src/test/integration/mcp.test.ts`
- `docs/api/snapshot.md`
- `docs/api/mcp.md`

### Acceptance Evidence

- Raw XML output is byte-for-byte preserved in its artifact; default snapshot callers are unchanged.
- Node-boundary truncation yields valid JSON, truthful omitted counts, and retained parent paths.
- Malformed XML and malicious entity declarations fail explicitly; absent visibility stays null.
- MCP rejects arbitrary rawPath, saveRaw returns a runtime-owned artifact, and default raw-mode callers stay unchanged.
- Invalid/missing flag values, blank paths, output collisions, compact/maxChars conflict, and CLI/MCP equivalence are covered.
- Compact output includes all retained state fields; no duplicate full XML appears in compact presentation.

### Live Entry Points

Use these for the device proof described above, after building the matching tools. They do not replace the acceptance assertions.

```sh
: "${DEVICE_ID:?Select a test device}"
CAPTURE_ROOT="$(mktemp -d)"
node apps/node/dist/cli/index.js snapshot --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev --compact --max-nodes 20 --raw-path "$CAPTURE_ROOT/hierarchy.xml"
```

## Validation and Completion

Use AGENTS.md for shared validation policy. Build Node before tests that consume dist. Relevant checks for this pack are:

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
```

Live verification requires a dedicated, explicitly selected device, an unlocked screen, enabled accessibility, and the matching debug Operator. Offline tests prove the stated contracts; device checks prove integration and pixels. Record unavailable live evidence rather than treating it as passed.

Use `.agents/skills/docs-author/SKILL.md` for the named public docs and `.agents/skills/docs-build/SKILL.md` for regeneration. Run checks for each behavior change; repeat successful checks only after new changes or an unresolved integration concern.

Keep concise findings with versions, reproduction inputs, observed results/artifact paths, decisions, and remaining limitations. Preserve private captures outside tracked files. Update progress and commit validated logical units. Completion includes correcting in-scope failures, not merely producing a first implementation.
