# MCP Server Ergonomics

## Executive Summary

Agent-facing ergonomics pass for the MCP stdio server. Two concrete features in one PR:

- Bounded snapshot: optional `maxChars` parameter on the `snapshot` tool to limit XML output length
- Session configure: new `configure` tool for per-session `deviceId`, `operatorPackage`, and `timeoutMs` defaults

Three phases. Each implementation phase carries its own proving tests. Phase 3 is docs only.

**Blocked on `tasks/mcp/hardening/` merging first.**

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 (after hardening merges) |
| Blockers | `tasks/mcp/hardening/` must merge before this work starts |

## Goal

Reduce agent token cost for snapshot-heavy observe-decide-act loops and eliminate per-call boilerplate for repeated `deviceId`, `operatorPackage`, and `timeoutMs` values in long-lived MCP sessions.

## Why Now

Two concrete ergonomics problems compound as MCP usage grows:

1. `snapshot` returns full Android UI XML unconditionally. For large UI trees this can be thousands of tokens per call. Agents that only need orientation before a decision pay the full cost every time.

2. Every execution tool call requires `deviceId` and `operatorPackage` even when the session is pinned to a single device throughout. This is boilerplate the agent must repeat on every call or risk omitting.

Both problems are reducible without adding new Android execution primitives.

## In Scope

- `maxChars?: number` parameter on the `snapshot` tool - truncates the returned `snapshot` string at the specified character count and adds `truncated: true` to the success payload when applied
- Unit tests for `maxChars` truncation in the same phase as the implementation
- New `configure` MCP tool - accepts optional `deviceId`, `operatorPackage`, and `timeoutMs`; stores them in per-session process memory; subsequent execution tool calls merge these defaults (per-call wins)
- Unit tests for `mergeWithSessionDefaults` and session isolation in the same phase as the implementation
- Design note update for `configure` - it is the first MCP-only stateful surface; `docs/internal/design/mcp-server.md` must acknowledge it
- Docs update for both features in Phase 3 (`docs/api/mcp.md`)

## Out of Scope

- Foreground state check or thin readiness surface - requires a new execution action type not currently in the engine
- `validateOnly` mode for `execute` - requires Android runtime support
- Session state persistence across server restarts
- Clearing individual session defaults after they are set (restart the server or override per-call)
- New named tools beyond `configure`
- Non-stdio transports
- Changes to the core Android execution engine

## Existing Artifact Scope

`apps/node/src/mcp/tools/core.ts` - in scope to extend `snapshot` and add `configure`. Existing `devices`, `snapshot`, and `execute` behavior is preserved. `maxChars` is additive and changes nothing when omitted.

`apps/node/src/mcp/server.ts` - in scope to wire session state into `createMcpServer`.

`apps/node/src/mcp/tools/common.ts` - in scope to add the `mergeWithSessionDefaults` helper.

`apps/node/src/mcp/tools/named.ts` - in scope to update handler signatures and apply session merge.

`apps/node/src/mcp/tools/index.ts` - in scope to update `getMcpTools` signature.

`docs/api/mcp.md` and `docs/internal/design/mcp-server.md` - in scope for additive updates only.

## Surfaces and Ownership

| Surface | Path | Change type |
| --- | --- | --- |
| Snapshot tool | `apps/node/src/mcp/tools/core.ts` | additive (new parameter + truncation helper) |
| Configure tool | `apps/node/src/mcp/tools/core.ts` | new tool |
| Session state | `apps/node/src/mcp/session.ts` (NEW) | new module |
| Truncation helper | `apps/node/src/mcp/tools/core.ts` or `apps/node/src/mcp/results.ts` | new exported helper |
| Session merge helper | `apps/node/src/mcp/tools/common.ts` | new exported function |
| Tool factory signatures | `apps/node/src/mcp/tools/index.ts`, `core.ts`, `named.ts` | targeted update |
| MCP server bootstrap | `apps/node/src/mcp/server.ts` | targeted update |
| Unit tests | `apps/node/src/test/unit/mcpHelpers.test.ts` | add truncation and merge cases |
| Integration tests | `apps/node/src/test/integration/mcp.test.ts` | add configure and tool-list cases |
| MCP API docs | `docs/api/mcp.md` | additive |
| MCP design note | `docs/internal/design/mcp-server.md` | additive sentence |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Snapshot tool handler | `apps/node/src/mcp/tools/core.ts` |
| Execution options schema (Zod) | `apps/node/src/mcp/tools/common.ts` (`executionToolOptionsSchema`) |
| Execution options schema (JSON Schema) | `apps/node/src/mcp/tools/common.ts` (`buildCommonExecutionSchema`) |
| Tool factory wiring | `apps/node/src/mcp/tools/index.ts` |
| MCP server creation | `apps/node/src/mcp/server.ts` |
| Existing integration test patterns | `apps/node/src/test/integration/mcp.test.ts` |
| MCP public docs | `docs/api/mcp.md` |
| MCP design posture | `docs/internal/design/mcp-server.md` |

## Deterministic Versus Judgment

Deterministic:

- `maxChars` truncation is `snapshot.slice(0, maxChars)`. No ellipsis, no XML-aware break point.
- When truncation applies, the success payload includes `truncated: true`. When the full snapshot fits, `truncated` is omitted entirely.
- The `configure` success payload shape is `{ session: { ...currentValues } }`. Only fields that are currently set appear. This is the single canonical shape. Use it in the handler, the tests, and the docs.
- `configure` parameter names are `deviceId`, `operatorPackage`, and `timeoutMs` - identical to the per-call names on all execution tools.
- Session default merge rule: `effectiveValue = perCallValue ?? sessionDefault`. Applied independently for each of the three fields.
- `configure` validates `deviceId` and `operatorPackage` as non-empty strings when provided. Empty or whitespace-only values are `InvalidParams`.
- Session state is on the `Server` instance created by `createMcpServer`, not a module-level global. Two separate `createMcpServer()` calls produce two independent session stores.
- Tests for truncation and session-default merge are unit tests that do not require a connected device.

Judgment:

- Where exactly to define the truncation helper (inline in the `snapshot` handler vs. extracted to `results.ts`). Prefer extraction if the function boundary is clean, so the unit test can import it directly.
- How to thread session state to tool handlers (through `getMcpTools` signature vs. closure). Prefer the explicit parameter approach for testability.

## Decision Rules

| Decision point | Rule |
| --- | --- |
| `configure` success payload | Always `{ session: { ...currentValues } }`. Omit unset fields. This shape is used in the handler, the unit tests, the integration tests, and the docs. |
| `truncated` field | Include as `true` only when truncation was applied. Omit when the full snapshot fits within `maxChars`. |
| `configure` validation | Use `nonEmptyOptionalStringSchema` (already in `common.ts`) for `deviceId` and `operatorPackage`. |
| Session state scope | One object per `createMcpServer()` call. Never a module-level global. |
| Test location | Truncation and merge-precedence tests are unit tests. Integration tests cover protocol-level behavior (tool list includes `configure`, `configure` call succeeds and returns correct shape). |
| Design note requirement | `configure` is the first MCP-only stateful surface. Add a sentence to `docs/internal/design/mcp-server.md` acknowledging that session-local state is an exception to the stateless posture, bounded to the `configure` tool only. |

## Failure Modes To Prevent

- `plan.md` and `work-breakdown.md` specifying different `configure` payload shapes (resolved: `{ session: { ... } }` is canonical everywhere)
- Tests that `return` on any runtime error, passing without ever proving truncation or session merge
- Session state leaking between test cases (each integration test spawns its own client; each unit test uses an independent session object)
- `snapshot` behavior changing for callers that omit `maxChars` (the existing path must be byte-identical)
- The tool list order changing without updating `lists tools over the stdio protocol` in `mcp.test.ts`
- `configure` accepting blank `deviceId` and causing silent DEVICE_NOT_FOUND errors downstream

## Output Contract

This task produces:

- `apps/node/src/mcp/session.ts` with `SessionDefaults` and `createSessionDefaults`
- An exported truncation helper and updated `snapshot` tool with `maxChars` parameter
- New `configure` tool with session state wiring through all execution tools
- Unit tests covering: truncation (5 cases), `mergeWithSessionDefaults` (3 cases), session isolation (1 case)
- Integration tests covering: `configure` in tool list, `configure` call shape, blank-value rejection
- Updated `docs/api/mcp.md` with `maxChars` and `configure` documentation
- A sentence in `docs/internal/design/mcp-server.md` acknowledging session-local state
- A passing `npm --prefix apps/node run build && npm --prefix apps/node run test`
- A passing `./scripts/docs_build.sh`

## Idempotency

If `maxChars` is already implemented when a future agent picks this up, mark Phase 1 done and go to Phase 2. If `configure` is already implemented, mark Phase 2 done and go to Phase 3. Each phase is independently checkable by its acceptance criteria.

## Durable Follow-Up

If session defaults prove useful in practice and agents encounter pain from re-specifying them, the next ergonomics iteration is a mechanism to clear individual defaults at runtime. That work is out of scope here and should go in a new task only if usage evidence supports it.
