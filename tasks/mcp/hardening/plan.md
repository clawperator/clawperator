# MCP Server Hardening

## Executive Summary

Post-ship hardening pass for the MCP stdio server shipped in PR #161. Three focused phases in one PR:

- Phase 1: Centralize duplicated JSON Schema fragments into a shared helper
- Phase 2: Fill genuine missing test coverage (re-baselined against the current test suite)
- Phase 3: Strengthen the transport invariant test, normalize timeout pattern, harden smoke script

No new tools, no surface expansion. This is a correctness and coverage pass only.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

Make the MCP server more correct, testable, and transport-safe by removing drift risks and filling the coverage gaps that were not caught during initial implementation review.

## Why Now

The v1 MCP server ships and works. Three structural problems exist that get harder to fix after client adoption grows:

- `selectorJsonSchema` and `nonWhitespaceStringJsonSchema` are hand-copied in `named.ts` from their Zod counterparts. The two definitions will drift independently.
- The `read(all=true)` JSON parsing path in `named.ts` has three `MCP_STEP_DATA_INVALID` branches that have no test coverage. These are the only named-tool extraction paths not covered by the existing suite.
- The transport invariant test (`emits zero stdout bytes before initialize`) uses a 150 ms wait. This passes even if the subprocess exits early or the MCP server is misconfigured. A completing `initialize` handshake is the correct gate.

## In Scope

- Extracting duplicated JSON Schema fragments into `apps/node/src/mcp/schemas.ts`
- Adding unit test coverage for the three `read(all=true)` invalid-data branches in `named.ts`
- Adding unit or integration coverage for any other confirmed-missing `extractStepDataValue` paths
- Strengthening the transport invariant test to complete an `initialize` handshake instead of relying on a silence window
- Normalizing `wait` and `scroll_until` to pass `timeoutMs` through `applyMcpExecutionMetadata`, consistent with all other named tools
- Hardening the smoke script `read` step to tolerate live device state variance

## Out of Scope

- Changing the current `mcp serve` interception behavior. When global flags precede `mcp serve`, the CLI currently returns a usage message (`"mcp serve is a stdio transport"`). This is intentional, tested in `cliHelp.test.ts`, and documented in `docs/api/mcp.md`. Do not change it.
- New MCP tools or parameters (those are in `tasks/mcp/ergonomics/`)
- Non-stdio transports
- Changes to the core Android execution engine
- Deleting or loosening any existing test case

## Existing Artifact Scope

`apps/node/src/mcp/` - all files in scope for targeted changes. Existing public tool names and JSON Schemas are preserved as-is. JSON Schema fragments in Phase 1 are moved, not changed.

`apps/node/src/test/` - in scope for adding missing cases only. No existing test case may be deleted or loosened.

`validation/test_mcp_stdio_smoke.mjs` - in scope for hardening the `read` step. The existing smoke flow (devices, open, snapshot, read) is preserved.

`docs/api/mcp.md` - not in scope for this task. The global-flag behavior documented there is intentional and correct.

## Surfaces and Ownership

| Surface | Path | Change type |
| --- | --- | --- |
| Shared JSON Schema helpers | `apps/node/src/mcp/schemas.ts` (NEW) | new file |
| Named tool schemas | `apps/node/src/mcp/tools/named.ts` | import from `schemas.ts` instead of redefining |
| `read(all=true)` extraction helper | `apps/node/src/mcp/results.ts` or a new `apps/node/src/mcp/tools/readResult.ts` | extract testable helper |
| MCP unit tests | `apps/node/src/test/unit/mcpHelpers.test.ts` | add missing `read(all=true)` and `extractStepDataValue` cases |
| MCP integration tests | `apps/node/src/test/integration/mcp.test.ts` | strengthen transport invariant test; add `type` and `scroll_until` cases |
| Smoke harness | `validation/test_mcp_stdio_smoke.mjs` | harden `read` step |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current integration test coverage | `apps/node/src/test/integration/mcp.test.ts` (read all 598 lines before adding) |
| Current unit test coverage | `apps/node/src/test/unit/mcpHelpers.test.ts` |
| Current CLI interception behavior | `apps/node/src/cli/index.ts`, `apps/node/src/test/unit/cliHelp.test.ts:158` |
| Named tool schemas (Zod) | `apps/node/src/mcp/tools/named.ts`, `apps/node/src/mcp/selectors.ts` |
| Named tool schemas (JSON Schema) | `apps/node/src/mcp/tools/named.ts` (local copies to be extracted) |
| `read(all=true)` parsing logic | `apps/node/src/mcp/tools/named.ts` lines 259-290 |
| Step data extraction | `apps/node/src/mcp/results.ts` |
| Execution tool timeout pattern | `apps/node/src/mcp/tools/common.ts` (`applyMcpExecutionMetadata`) |

## Deterministic Versus Judgment

Deterministic:

- The `selectorJsonSchema` in `named.ts` is a verbatim structural duplicate of the Zod `mcpSelectorSchema` shape. Extract it; do not redesign it.
- The six lines of existing tests that cover screenshot-path blocking and unknown tool name must not be replaced or counted as new coverage. Read the test file in full before adding any cases.
- The `read(all=true)` branches at `named.ts:259`, `named.ts:270`, and `named.ts:281` are the three specific untested paths. Cover each one.
- The transport invariant test must complete an `initialize` handshake and verify the response is a valid JSON-RPC message, not just check for 150 ms silence.
- `wait` and `scroll_until` must pass `timeoutMs` to `applyMcpExecutionMetadata` as the third argument, consistent with all other named tools.

Judgment:

- Whether the `read(all=true)` parsing logic warrants extraction into a testable helper function or is better tested by injecting shaped data via the unit test layer. Prefer extraction if the function boundary is clean; test in place if extraction would require significant restructuring.
- Whether any other JSON Schema fragments beyond `selectorJsonSchema` and `nonWhitespaceStringJsonSchema` warrant centralization. Stop at the confirmed duplicates unless the audit reveals clear additional cases.

## Decision Rules

| Decision point | Rule |
| --- | --- |
| JSON Schema fragment duplication | Move to `schemas.ts` only if the fragment appears verbatim in more than one file. Do not unify fragments that differ. |
| `mcp serve` global-flag behavior | Do not change. Current behavior (usage message for global flags before `mcp serve`) is intentional per `docs/api/mcp.md:50` and `cliHelp.test.ts:158`. |
| Transport invariant test | Complete an `initialize` handshake. Verify the response is valid JSON-RPC. Do not rely on silence windows. |
| `read(all=true)` test location | Unit test if the parsing logic can be extracted into a pure function; integration test only for the happy path. |
| `wait` and `scroll_until` timeout | Pass `parsed.timeoutMs` (or `parsed.timeoutMs ?? <fallback>` as appropriate) as the third argument to `applyMcpExecutionMetadata`. No behavior change. |

## Failure Modes To Prevent

- A future named tool shipping with a local copy of `selectorJsonSchema` instead of importing from `schemas.ts`
- The `read(all=true)` invalid-data branches silently going unnoticed because they surface as generic runtime errors
- The transport invariant test passing for a broken MCP server that exits before completing `initialize`
- `wait` or `scroll_until` silently ignoring `timeoutMs` because of inconsistent pattern
- The smoke script failing on transient device state when the MCP contract is actually correct

## Output Contract

This task produces:

- `apps/node/src/mcp/schemas.ts` with shared JSON Schema fragments
- Updated `named.ts` importing from `schemas.ts`
- Unit tests covering each of the three `read(all=true)` invalid-data branches
- A strengthened transport invariant integration test that completes `initialize`
- New integration test cases for `type` (missing required fields) and `scroll_until` (invalid direction)
- Normalized `wait`/`scroll_until` timeout pattern in `named.ts`
- Hardened smoke `read` step in `validation/test_mcp_stdio_smoke.mjs`
- A passing `npm --prefix apps/node run build && npm --prefix apps/node run test`

## Idempotency

If Phase 1 has already landed, mark it done and skip to Phase 2. If specific test cases are already present, mark them done and add only what is missing. The task pack does not depend on all items remaining open.

## Durable Follow-Up

No docs changes are required for this task. The interception behavior is already documented correctly. If the transport invariant fix introduces new engineering guidance, add a note to `docs/internal/design/mcp-server.md` in the same commit.
