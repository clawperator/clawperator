# MCP Server Ergonomics

## Executive Summary

Agent-facing ergonomics pass for the MCP stdio server. Two concrete features in one PR:

- Bounded snapshot: optional `maxChars` parameter on the `snapshot` tool to limit XML output length
- Session configure: new `configure` tool for per-session `deviceId`, `operatorPackage`, and `timeoutMs` defaults

Three phases: implement bounded snapshot, implement configure tool, then docs and tests.

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

1. `snapshot` returns full Android UI XML unconditionally. For large UI trees, this can be thousands of tokens per call. Agents that only need to check if a specific node exists, or that are making preliminary orientation decisions, pay the full cost every time.

2. Every execution tool call requires `deviceId` and `operatorPackage` to be specified, even when the session is pinned to a single device and operator throughout. This is boilerplate the agent must repeat on every call or risk omitting.

Both problems are reducible without adding new Android execution primitives.

## In Scope

- `maxChars?: number` parameter on the `snapshot` tool - truncates the returned `snapshot` string at the specified character count and adds `truncated: true` to the payload
- New `configure` MCP tool - accepts optional `deviceId`, `operatorPackage`, and `timeoutMs`; stores them in per-session process memory; subsequent execution tool calls merge these defaults (per-call wins)
- Session state lifecycle: initialized empty at server start, mutable via `configure`, not persisted across server restarts
- Tests for both features
- Docs update for both features (`docs/api/mcp.md`, `apps/node/README.md` if the npm-facing surface changed)

## Out of Scope

- Foreground state check or thin readiness surface - requires a new execution action type not currently in the engine
- `validateOnly` mode for `execute` - requires Android runtime support
- Session state persistence across server restarts
- Clearing individual session defaults (call `configure` with new values or restart the server)
- New named tools beyond `configure`
- Non-stdio transports
- Changes to the core Android execution engine

## Existing Artifact Scope

`apps/node/src/mcp/tools/core.ts` - in scope to extend `snapshot` and add `configure`. Existing `devices`, `snapshot`, and `execute` behavior is preserved. `maxChars` is additive.

`apps/node/src/mcp/server.ts` - in scope to wire session state creation into `createMcpServer`.

`apps/node/src/mcp/tools/common.ts` - in scope to add session default merge helper.

`apps/node/src/mcp/tools/named.ts` - in scope to update handler signatures to receive session defaults.

`apps/node/src/mcp/tools/index.ts` - in scope to update `getMcpTools` signature.

`docs/api/mcp.md` - in scope for `maxChars` and `configure` documentation. Existing content preserved.

## Surfaces and Ownership

| Surface | Path | Change type |
| --- | --- | --- |
| Snapshot tool | `apps/node/src/mcp/tools/core.ts` | additive (new parameter) |
| Configure tool | `apps/node/src/mcp/tools/core.ts` | new tool added |
| Session state | `apps/node/src/mcp/session.ts` (NEW) | new module |
| Tool factory signatures | `apps/node/src/mcp/tools/index.ts`, `common.ts`, `core.ts`, `named.ts` | targeted update |
| MCP server bootstrap | `apps/node/src/mcp/server.ts` | targeted update |
| Integration tests | `apps/node/src/test/integration/mcp.test.ts` | add cases |
| MCP API docs | `docs/api/mcp.md` | additive |

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

## Deterministic Versus Judgment

Deterministic:

- `maxChars` truncates by character count (not byte count, not token count). Truncation point is exact: `snapshot.slice(0, maxChars)`.
- When `maxChars` truncation applies, the success payload includes `truncated: true`. When it does not apply (full snapshot fits), `truncated` is omitted.
- `configure` tool parameter names are `deviceId`, `operatorPackage`, and `timeoutMs` - identical to the per-call parameter names on execution tools.
- Session default merge rule: per-call value, if provided and non-empty, wins. Session default applies only when the per-call value is absent (`undefined`).
- `configure` returns the full current session state after applying the update, even if no fields changed.
- Session state is stored in the `Server` instance created by `createMcpServer`. It is not a module-level global.

Judgment:

- Whether `configure` should validate that `deviceId` and `operatorPackage` are non-empty when provided, or pass them through for the execution tool to reject. Prefer validating at the `configure` boundary (same rules as per-call: non-empty string or omitted).
- How to thread session state through to tool handlers. Prefer passing a mutable `SessionDefaults` object through `getMcpTools` rather than a module-level singleton, so test isolation is maintained.

## Decision Rules

| Decision point | Rule |
| --- | --- |
| `maxChars` truncation boundary | Truncate with `snapshot.slice(0, maxChars)`. Do not pad, ellipsize, or try to find a valid XML break point. |
| `truncated` field presence | Include `truncated: true` only when truncation was applied. Omit when the full snapshot fits within `maxChars`. |
| Session default merge | `effectiveDeviceId = options.deviceId ?? session.deviceId`. Apply the same rule for `operatorPackage` and `timeoutMs`. |
| `configure` validation | Reject blank strings (`""`, whitespace-only) for `deviceId` and `operatorPackage` using the same `nonEmptyOptionalStringSchema` already used in `executionToolOptionsSchema`. |
| Session state scope | One `SessionDefaults` object per `createMcpServer()` call. Not a module-level global. |
| `configure` success payload | Return `{ deviceId, operatorPackage, timeoutMs }` showing the current session state after the update. Omit fields that are still unset. |

## Failure Modes To Prevent

- `maxChars` splitting multi-byte UTF-8 characters (JS `slice` operates on UTF-16 code units, not bytes - this is acceptable; document it)
- Session state leaking between test cases in the integration test suite (use one client per test, as current tests already do - new tests must follow the same pattern)
- `configure` accepting empty-string `deviceId` silently and causing confusing DEVICE_NOT_FOUND errors on subsequent calls
- `snapshot` behavior changing for callers that do not provide `maxChars` (the existing path must be byte-identical to the pre-change behavior)
- The tool list changing order or count due to adding `configure` (the integration test `lists tools over the stdio protocol` asserts exact tool order - update that assertion to include `configure`)

## Output Contract

This task produces:

- `apps/node/src/mcp/session.ts` with `SessionDefaults` type and `createSessionDefaults()`
- Updated `snapshot` tool with `maxChars` parameter
- New `configure` tool
- Updated tool factory signatures to receive session defaults
- Integration tests for `maxChars` truncation and `configure` session behavior
- Updated `docs/api/mcp.md` documenting both features
- A passing `npm --prefix apps/node run build && npm --prefix apps/node run test`

## Idempotency

If `maxChars` is already implemented when a future agent picks up this task, mark Phase 1 done and skip to Phase 2. If `configure` is already implemented, mark Phase 2 done and go to Phase 3. Each phase is independently checkable.

## Durable Follow-Up

If session defaults prove useful in practice and future agents encounter repeated boilerplate, the next ergonomics iteration is to support clearing individual defaults (e.g., `configure({ deviceId: null })` using a sentinel). That work is out of scope here and should go in a new task if evidence of demand exists.
