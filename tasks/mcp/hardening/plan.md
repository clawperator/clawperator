# MCP Server Hardening

## Executive Summary

Post-ship hardening pass for the MCP stdio server shipped in PR #161. Three focused phases in one PR:

- Phase 1: Centralize duplicated JSON Schema fragments into a shared helper
- Phase 2: Fill missing validation boundary test cases and audit error codes
- Phase 3: Fix MCP interception bypass for global flags, normalize timeout pattern, harden smoke script

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

Make the MCP server more correct, testable, and transport-safe by removing the drift risks and coverage gaps discovered during initial implementation review.

## Why Now

The v1 MCP server ships and works. Three structural problems exist that get harder to fix after client adoption grows:

- `selectorJsonSchema` and `nonWhitespaceStringJsonSchema` are hand-copied in `named.ts` from their Zod counterparts in `selectors.ts`. The two definitions will drift.
- Six specific validation boundary inputs have no regression coverage. The `execute` screenshot-block safety check and runtime extraction failure path are untested.
- `resolveMcpServeArgs` in `cli/index.ts` only intercepts when `argv[0] === "mcp"`. Any global flag before `mcp serve` (e.g., `--log-level debug mcp serve`) bypasses MCP interception and reaches stdout-writing paths. This will corrupt an MCP client's stdio stream.

## In Scope

- Extracting duplicated JSON Schema fragments into `apps/node/src/mcp/schemas.ts`
- Adding missing integration and unit test cases for MCP validation boundaries
- Fixing the `resolveMcpServeArgs` global-flag bypass
- Normalizing `wait` and `scroll_until` to pass `timeoutMs` through `applyMcpExecutionMetadata`, consistent with all other named tools
- Hardening the smoke script `read` step to tolerate live device state variance

## Out of Scope

- New MCP tools or parameters
- Ergonomics improvements (bounded snapshot, session defaults) - those are in `tasks/mcp/ergonomics/`
- Non-stdio transports
- Changes to the core Android execution engine
- Changes to the CLI surface outside the MCP interception path

## Existing Artifact Scope

`apps/node/src/mcp/` - all files are in scope for targeted changes. Existing public tool names and schemas are preserved as-is. JSON Schema fragments are moved, not changed.

`apps/node/src/cli/index.ts` - in scope only for the MCP interception fix (`resolveMcpServeArgs` and the global-flag bypass).

`apps/node/src/test/` - in scope for adding missing test cases. No existing test cases may be deleted.

`validation/test_mcp_stdio_smoke.mjs` - in scope for hardening the `read` step. The existing smoke flow (devices, open, snapshot, read) is preserved.

`docs/api/mcp.md` - in scope only if any behavior change requires a docs update. The interception fix does not change observable MCP behavior, so docs are unlikely to change.

## Surfaces and Ownership

| Surface | Path | Change type |
| --- | --- | --- |
| Shared JSON Schema helpers | `apps/node/src/mcp/schemas.ts` (NEW) | new file |
| Named tool schemas | `apps/node/src/mcp/tools/named.ts` | targeted refactor (import, not redefine) |
| MCP integration tests | `apps/node/src/test/integration/mcp.test.ts` | add missing cases |
| MCP unit tests | `apps/node/src/test/unit/mcpHelpers.test.ts` | add missing cases if not already covered |
| CLI MCP interception | `apps/node/src/cli/index.ts` | targeted fix |
| CLI unit tests | `apps/node/src/test/unit/cliHelp.test.ts` | add regression for bypass form |
| Smoke harness | `validation/test_mcp_stdio_smoke.mjs` | targeted hardening |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| MCP interception logic | `apps/node/src/cli/index.ts` |
| MCP transport lifecycle | `apps/node/src/mcp/server.ts` |
| Named tool schemas (Zod) | `apps/node/src/mcp/tools/named.ts`, `apps/node/src/mcp/selectors.ts` |
| Named tool schemas (JSON Schema) | `apps/node/src/mcp/tools/named.ts` (current local copies), `apps/node/src/mcp/tools/common.ts` |
| Error taxonomy and sanitization | `apps/node/src/mcp/errors.ts` |
| Step data extraction | `apps/node/src/mcp/results.ts` |
| Existing test coverage | `apps/node/src/test/integration/mcp.test.ts`, `apps/node/src/test/unit/mcpHelpers.test.ts` |
| Execution tool timeout pattern | `apps/node/src/mcp/tools/common.ts` (`applyMcpExecutionMetadata`) |

## Deterministic Versus Judgment

Deterministic:

- The `selectorJsonSchema` in `named.ts:107-119` is a verbatim structural duplicate of `mcpSelectorSchema` in `selectors.ts`. Move it; do not redesign it.
- The six missing test cases listed in Phase 2 are not optional. Add them exactly as specified.
- The `resolveMcpServeArgs` fix must handle global flags before `mcp serve`. The cleanest implementation is to move the MCP check to after `getGlobalOpts` has parsed the argv and produced `rest`.
- `wait` and `scroll_until` must pass `timeoutMs` to `applyMcpExecutionMetadata`, consistent with all other named tools. This is a pattern fix with no behavior change.

Judgment:

- Whether any additional JSON Schema fragments beyond `selectorJsonSchema` and `nonWhitespaceStringJsonSchema` warrant centralization. If the analysis reveals others, use judgment. If it does not, stop at the two confirmed cases.
- Whether the runtime extraction failure test belongs in the integration suite or in `mcpHelpers.test.ts`. Use the unit test if the integration path requires a live device; use integration if a no-device scenario is sufficient to trigger it.
- How many fallback candidates the hardened smoke `read` step should try. Two to three is a reasonable default.

## Decision Rules

| Decision point | Rule |
| --- | --- |
| JSON Schema fragment duplication | Move to `schemas.ts` only if the fragment is used in more than one place or is structurally identical to an existing Zod schema. Do not over-centralize. |
| JSON-RPC `InvalidParams` vs tool-level `isError` | `InvalidParams` (-32602) for MCP boundary/schema failures before execution starts. `isError: true` with a string `code` for all post-execution failures. |
| MCP interception bypass fix | Move the MCP check to after `getGlobalOpts` returns `rest`. Do not try to parse global flags inside `resolveMcpServeArgs`. |
| `wait` and `scroll_until` timeout | Pass `parsed.timeoutMs` (or `parsed.timeoutMs ?? <default>` as appropriate) to `applyMcpExecutionMetadata`, matching the pattern used by `open`, `click`, `type`, `read`, and `press`. |
| Smoke script read step | Try multiple candidate texts extracted from the snapshot. Accept success on the first that works. Fail only if all candidates fail. |

## Failure Modes To Prevent

- A future alias form or global flag bypassing MCP interception and writing to stdout
- A new named tool shipping with a local copy of `selectorJsonSchema` instead of importing from `schemas.ts`
- The `execute` screenshot-block safety check being removed without a test catching it
- The smoke script failing on transient device state when the MCP contract is actually correct
- `wait` or `scroll_until` silently ignoring `timeoutMs` due to not passing it to `applyMcpExecutionMetadata`

## Output Contract

This task produces:

- `apps/node/src/mcp/schemas.ts` with shared JSON Schema fragments
- Updated `named.ts` importing from `schemas.ts`
- New integration test cases in `mcp.test.ts` for the six missing boundary inputs
- Fixed MCP interception in `cli/index.ts`
- Normalized `wait`/`scroll_until` timeout pattern in `named.ts`
- Hardened smoke `read` step in `validation/test_mcp_stdio_smoke.mjs`
- A passing `npm --prefix apps/node run build && npm --prefix apps/node run test`

## Idempotency

If Phase 1 has already landed when a future agent picks up this task, mark it done and skip to Phase 2. If the `resolveMcpServeArgs` fix has already landed, mark Phase 3's interception step done and complete the rest. The task pack does not depend on all items remaining open.

## Durable Follow-Up

If the interception fix introduces a new engineering rule about MCP bootstrap safety, add a note to `docs/internal/design/mcp-server.md`. Do not leave it only in this task pack.
