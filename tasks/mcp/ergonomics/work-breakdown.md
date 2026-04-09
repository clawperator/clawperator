# MCP Server Ergonomics Work Breakdown

Parent plan: `tasks/mcp/ergonomics/plan.md`

## Executive Summary

Three phases in one PR. Blocked on `tasks/mcp/hardening/` merging first.

- Phase 1 (thinking): Bounded snapshot - add `maxChars` parameter to `snapshot` tool
- Phase 2 (thinking): Session configure tool - new `configure` tool with per-session defaults
- Phase 3 (default): Tests, docs, smoke update

Phases run sequentially. Build and test after each phase before proceeding.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 (after hardening merges) |
| Blockers | `tasks/mcp/hardening/` must be merged before starting |

## Hard Rules

1. Do not start this task until `tasks/mcp/hardening/` has merged to `main`.
2. Run `npm --prefix apps/node run build && npm --prefix apps/node run test` after each phase before committing.
3. Do not change any existing tool name, parameter name, or existing parameter behavior. `maxChars` and `configure` are purely additive.
4. Session state must be scoped to the `Server` instance created by `createMcpServer()`. Do not use a module-level global.
5. The integration test `lists tools over the stdio protocol` asserts exact tool order. After adding `configure`, update that assertion to include it at the correct position.
6. Do not touch `sites/docs/.build/` or `sites/docs/site/` directly.
7. Use `node apps/node/dist/cli/index.js` for any local verification. Do not use the global `clawperator` binary.
8. One commit per phase. Do not batch phases.
9. Docs changes go in Phase 3, not earlier. Implement first, document after.

## Required Reading

Read in this order before writing anything:

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/mcp/ergonomics/plan.md` | Scope, decision rules, and output contract |
| 2 | `apps/node/src/mcp/tools/core.ts` | Current `snapshot` handler - the file being extended in Phase 1 |
| 3 | `apps/node/src/mcp/tools/common.ts` | `executionToolOptionsSchema`, `buildCommonExecutionSchema`, `applyMcpExecutionMetadata`, `runExecutionTool` |
| 4 | `apps/node/src/mcp/tools/index.ts` | `getMcpTools` factory - needs signature update |
| 5 | `apps/node/src/mcp/server.ts` | `createMcpServer` - where session state is created |
| 6 | `apps/node/src/mcp/tools/named.ts` | Named tool handlers - need session default threading |
| 7 | `apps/node/src/mcp/errors.ts` | `buildMcpSuccessResult`, `buildMcpErrorResult` |
| 8 | `apps/node/src/test/integration/mcp.test.ts` | Existing test structure - required before adding new cases |

## PR Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | MCP ergonomics | 1, 2, 3 | thinking / thinking / default | build, test, docs build |

---

## Phase 1: Bounded Snapshot

### Agent Tier

thinking

### Goal

Add an optional `maxChars` parameter to the `snapshot` tool. When provided, the returned `snapshot` string is truncated to that many characters and `truncated: true` is added to the success payload. Callers that omit `maxChars` get unchanged behavior.

### Files or Surfaces To Change

- `apps/node/src/mcp/tools/core.ts` - extend `snapshotArgsSchema` and update `snapshot` handler
- No other files in this phase

### Steps

1. In `apps/node/src/mcp/tools/core.ts`, extend `snapshotArgsSchema`:

   ```ts
   const snapshotArgsSchema = executionToolOptionsSchema.extend({
     maxChars: z.number().int().positive().optional(),
   });
   ```

2. Update the `snapshot` tool's `inputSchema` to include `maxChars`. The `snapshot` tool currently uses `buildCommonExecutionSchema({})`. Change to:

   ```ts
   inputSchema: buildCommonExecutionSchema({
     maxChars: { type: "integer", minimum: 1 },
   }),
   ```

3. In the `snapshot` handler's `onSuccess` callback, after extracting the snapshot string from `extractStepDataValue`, apply the truncation:

   ```ts
   const snapshotText = extracted.value;
   const truncated = parsed.maxChars !== undefined && snapshotText.length > parsed.maxChars;
   const finalSnapshot = truncated ? snapshotText.slice(0, parsed.maxChars) : snapshotText;

   return buildSuccessResult({
     ...buildExecutionSuccessPayload(result),
     snapshot: finalSnapshot,
     ...(truncated ? { truncated: true } : {}),
   });
   ```

   The full snapshot is still captured from the device. Only the returned string is truncated. `truncated` is omitted from the payload when the snapshot fits within `maxChars`.

4. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.

5. Confirm the existing `calls snapshot over the stdio protocol` integration test still passes (it does not provide `maxChars` and must continue to work identically).

### Acceptance Criteria

Mechanical:
- `snapshotArgsSchema` includes `maxChars` as `z.number().int().positive().optional()`
- `snapshot` tool `inputSchema` includes `maxChars: { type: "integer", minimum: 1 }`
- When `maxChars` is provided and the snapshot is longer, the returned `snapshot` field is exactly `maxChars` characters long and `truncated` is `true`
- When `maxChars` is provided and the snapshot is shorter or equal, `truncated` is absent from the payload
- When `maxChars` is omitted, the snapshot tool behavior is byte-identical to the pre-change behavior
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- Truncation is applied after successful step data extraction, not before
- The error path (when `extractStepDataValue` fails) is not affected

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add maxChars parameter to MCP snapshot tool
```

---

## Phase 2: Session Configure Tool

### Agent Tier

thinking

### Goal

Add a `configure` MCP tool that stores per-session defaults for `deviceId`, `operatorPackage`, and `timeoutMs`. All execution tools merge these defaults: per-call value wins over session default. Session state is created fresh for each `Server` instance and is not persisted across restarts.

### Files or Surfaces To Change

- `apps/node/src/mcp/session.ts` - NEW: `SessionDefaults` type and `createSessionDefaults`
- `apps/node/src/mcp/server.ts` - create session defaults, pass to `getMcpTools`
- `apps/node/src/mcp/tools/index.ts` - update `getMcpTools` to accept and pass session defaults
- `apps/node/src/mcp/tools/common.ts` - add `mergeWithSessionDefaults` helper
- `apps/node/src/mcp/tools/core.ts` - add `configure` tool, update `getCoreMcpTools` signature, apply session merge in `snapshot` and `execute`
- `apps/node/src/mcp/tools/named.ts` - update `getNamedMcpTools` signature, apply session merge in all named tool handlers

### Steps

#### Step 1: Create session module

Create `apps/node/src/mcp/session.ts`:

```ts
export interface SessionDefaults {
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
}

export function createSessionDefaults(): SessionDefaults {
  return {};
}
```

#### Step 2: Add merge helper

In `apps/node/src/mcp/tools/common.ts`, import `SessionDefaults` and add:

```ts
import type { SessionDefaults } from "../session.js";

export function mergeWithSessionDefaults(
  options: ExecutionToolOptions,
  session: SessionDefaults,
): ExecutionToolOptions {
  return {
    deviceId: options.deviceId ?? session.deviceId,
    operatorPackage: options.operatorPackage ?? session.operatorPackage,
    timeoutMs: options.timeoutMs ?? session.timeoutMs,
  };
}
```

Also export `SessionDefaults` re-export from `common.ts` if it simplifies tool file imports, or import directly from `session.ts` in each tool file - use judgment on which is cleaner.

#### Step 3: Update tool factory signatures

In `apps/node/src/mcp/tools/index.ts`, update `getMcpTools` to accept session defaults:

```ts
import { createSessionDefaults, type SessionDefaults } from "../session.js";

export function getMcpTools(logger?: Logger, session?: SessionDefaults): McpToolDefinition[] {
  const s = session ?? createSessionDefaults();
  return [
    ...getCoreMcpTools(logger, s),
    ...getNamedMcpTools(logger, s),
  ];
}
```

Update `getCoreMcpTools(logger?, session?)` and `getNamedMcpTools(logger?, session?)` signatures in their respective files.

#### Step 4: Add configure tool

In `apps/node/src/mcp/tools/core.ts`, add a `configure` tool to `getCoreMcpTools`. Place it after `execute` in the returned array.

The `configure` tool schema and Zod validation use the same `nonEmptyOptionalStringSchema` already in `common.ts`:

```ts
const configureArgsSchema = z.object({
  deviceId: nonEmptyOptionalStringSchema.optional(),
  operatorPackage: nonEmptyOptionalStringSchema.optional(),
  timeoutMs: z.number().int().nonnegative().optional(),
}).strict();
```

The `configure` JSON Schema (for `inputSchema`) follows the same pattern as `executionToolOptionsSchema` but omits the common execution options that are not applicable to configure itself. Use `buildCommonExecutionSchema({})` is NOT appropriate here because configure is not an execution tool. Define the schema explicitly:

```ts
inputSchema: {
  type: "object",
  additionalProperties: false,
  properties: {
    deviceId: { type: "string", minLength: 1, pattern: "\\S" },
    operatorPackage: { type: "string", minLength: 1, pattern: "\\S" },
    timeoutMs: { type: "integer", minimum: 0 },
  },
},
```

The handler:

```ts
handler: async (args) => {
  const parsed = parseToolArguments(configureArgsSchema, args);
  if (parsed.deviceId !== undefined) session.deviceId = parsed.deviceId;
  if (parsed.operatorPackage !== undefined) session.operatorPackage = parsed.operatorPackage;
  if (parsed.timeoutMs !== undefined) session.timeoutMs = parsed.timeoutMs;

  const current: Record<string, unknown> = {};
  if (session.deviceId !== undefined) current.deviceId = session.deviceId;
  if (session.operatorPackage !== undefined) current.operatorPackage = session.operatorPackage;
  if (session.timeoutMs !== undefined) current.timeoutMs = session.timeoutMs;

  return buildSuccessResult({ session: current });
},
```

#### Step 5: Apply session merge in execution tools

In every execution tool handler that calls `runExecutionTool`, merge session defaults into `parsed` before use. The merge happens after `parseToolArguments` and before building the execution:

```ts
const parsed = parseToolArguments(snapshotArgsSchema, args);
const opts = mergeWithSessionDefaults(parsed, session);
// then use opts.deviceId, opts.operatorPackage, opts.timeoutMs
```

Apply this pattern to: `snapshot`, `execute` (in `core.ts`), and all named tools in `named.ts` (`open`, `click`, `type`, `read`, `press`, `wait`, `scroll_until`).

The `devices` tool does not take execution options and should not be changed.

#### Step 6: Wire session into server

In `apps/node/src/mcp/server.ts`, create session defaults before calling `getMcpTools` and pass them through:

```ts
import { createSessionDefaults } from "./session.js";

export function createMcpServer(): Server {
  const logger = ...;
  const session = createSessionDefaults();
  const tools = getMcpTools(logger, session);
  ...
}
```

#### Step 7: Update tool list assertion

In `apps/node/src/test/integration/mcp.test.ts`, find the test `lists tools over the stdio protocol`. It asserts:

```ts
assert.deepStrictEqual(
  tools.map(tool => tool.name),
  ["devices", "snapshot", "execute", "open", "click", "type", "read", "press", "wait", "scroll_until"],
);
```

Add `"configure"` at the correct position (after `"execute"`, before `"open"`):

```ts
["devices", "snapshot", "execute", "configure", "open", "click", "type", "read", "press", "wait", "scroll_until"],
```

#### Step 8: Build and test

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Acceptance Criteria

Mechanical:
- `apps/node/src/mcp/session.ts` exists and exports `SessionDefaults` and `createSessionDefaults`
- `configure` tool appears in `tools/list` after `execute`
- `configure` with no args returns `{ session: {} }` (or `{ session: { ...fields that are set } }`)
- `configure` with `deviceId: ""` returns an `InvalidParams` error
- `configure` with `deviceId: "some-device"` returns `{ session: { deviceId: "some-device" } }`
- After calling `configure({ deviceId: "test-device" })`, calling `snapshot` without `deviceId` passes `"test-device"` as the device ID (the call will likely fail with `DEVICE_NOT_FOUND` or similar, but the error must NOT be a missing-deviceId error)
- Per-call `deviceId` in a subsequent `snapshot` call overrides the session default
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- Session state is not a module-level global (confirm it is on the `session` object passed through from `createMcpServer`)
- The `devices` tool is not affected (no session merge)
- All named tools now call `mergeWithSessionDefaults` before building their execution

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add configure tool for per-session MCP execution defaults
```

---

## Phase 3: Tests, Docs, and Smoke Update

### Agent Tier

default

### Goal

Add integration tests for the new features, document both features in `docs/api/mcp.md`, and optionally exercise `configure` in the smoke harness.

### Files or Surfaces To Change

- `apps/node/src/test/integration/mcp.test.ts` - add cases for `maxChars` and `configure`
- `docs/api/mcp.md` - document `maxChars` parameter and `configure` tool
- `validation/test_mcp_stdio_smoke.mjs` - add optional `configure` step before execution calls
- `apps/node/README.md` - update only if the npm-facing surface description changed materially

### Steps

#### Step 1: Add integration test cases

Add these cases to `mcp.test.ts` inside `describe("mcp stdio integration")`:

**`maxChars` truncation:**
```ts
it("snapshot with maxChars truncates the snapshot and sets truncated: true", async () => {
  await client.initialize();

  const result = await client.callTool("snapshot", {
    ...(await getPreferredExecutionArgs()),
    maxChars: 10,
  });

  if (result.isError) {
    assertRuntimeStructuredError(result);
    return;
  }

  const payload = parseToolPayload(result) as { snapshot?: string; truncated?: boolean };
  assert.strictEqual(typeof payload.snapshot, "string");
  assert.ok((payload.snapshot?.length ?? 0) <= 10);
  assert.strictEqual(payload.truncated, true);
});
```

**`configure` with no args returns current (empty) session:**
```ts
it("configure with no args returns current session state", async () => {
  await client.initialize();

  const result = await client.callTool("configure", {});
  assert.strictEqual(result.isError, undefined);
  const payload = parseToolPayload(result) as { session?: Record<string, unknown> };
  assert.ok(typeof payload.session === "object" && payload.session !== null);
});
```

**`configure` with blank deviceId is rejected:**
```ts
it("rejects configure when deviceId is blank", async () => {
  await client.initialize();

  const response = await client.requestTool("configure", { deviceId: "" });
  assertInvalidParams(response);
});
```

**`configure` stores deviceId and subsequent snapshot uses it:**
```ts
it("configure deviceId is used by subsequent snapshot call", async () => {
  await client.initialize();

  const configResult = await client.callTool("configure", { deviceId: "fake-device-for-session-test" });
  assert.strictEqual(configResult.isError, undefined);

  const snapshotResult = await client.callTool("snapshot", {});
  // The snapshot should fail (fake device is not connected), but it must fail with
  // a runtime structured error (DEVICE_NOT_FOUND or similar), not a schema error.
  // If there happens to be a real device, it may succeed - that is also acceptable.
  if (snapshotResult.isError) {
    assertRuntimeStructuredError(snapshotResult);
  }
});
```

**Per-call `deviceId` overrides session default:**
```ts
it("per-call deviceId overrides configure session default", async () => {
  await client.initialize();

  await client.callTool("configure", { deviceId: "session-device" });

  // Call snapshot with an explicit deviceId - the session default must not win.
  const result = await client.callTool("snapshot", {
    ...(await getPreferredExecutionArgs()),
  });

  // We cannot assert the exact device used without a real device, but we can assert
  // that the call does not fail with a schema validation error.
  if (result.isError) {
    const payload = parseToolPayload(result) as { code?: string };
    assert.strictEqual(typeof payload.code, "string");
  } else {
    const payload = parseToolPayload(result) as { snapshot?: string };
    assert.strictEqual(typeof payload.snapshot, "string");
  }
});
```

#### Step 2: Update docs

Use the docs-author skill at `.agents/skills/docs-author/SKILL.md` for the docs update. Do not hand-edit `sites/docs/.build/`.

In `docs/api/mcp.md`:

- In the `snapshot` tool section, add a `maxChars` parameter entry. Include: type (`integer`), minimum value (1), behavior description (truncates returned XML at the given character count; sets `truncated: true` in the payload when applied), and a note that truncation operates on UTF-16 code units (JS string characters) and may split multi-byte characters.
- Add a new `configure` tool section. Include: purpose (set per-session execution defaults), all three parameters (`deviceId`, `operatorPackage`, `timeoutMs`) with types and semantics, the precedence rule (per-call wins), lifetime (session, not persisted), and the return payload shape (`{ session: { ...current values } }`).

After editing `docs/api/mcp.md`, run:

```bash
./scripts/docs_build.sh
```

Confirm it exits 0.

#### Step 3: Update smoke script

In `validation/test_mcp_stdio_smoke.mjs`, add a `configure` call before the `open` call, using the selected device and operator package:

```js
await session.request("tools/call", {
  name: "configure",
  arguments: {
    deviceId: selectedDevice,
    operatorPackage,
  },
}, 5000);
console.log(`Configured session defaults: deviceId=${selectedDevice}, operatorPackage=${operatorPackage}`);
```

After this, the `open`, `snapshot`, and `read` calls can omit `deviceId` and `operatorPackage` to exercise the session default path. Update those calls to omit the two arguments.

This exercises the full session-default code path in a live smoke run.

#### Step 4: Final build and test

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
./scripts/docs_build.sh
```

### Acceptance Criteria

Mechanical:
- All five new integration test cases are present and pass
- `docs/api/mcp.md` contains a `maxChars` entry in the `snapshot` section
- `docs/api/mcp.md` contains a `configure` tool section with parameter table and precedence rule
- `./scripts/docs_build.sh` exits 0
- Smoke script includes a `configure` call before any execution calls
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- Docs describe current shipped behavior, not aspirational behavior
- The `configure` session test correctly asserts runtime error (not schema error) when a fake device is used
- The smoke script still fails clearly for real contract regressions (it does not swallow errors)

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(node): document MCP snapshot maxChars and configure tool
```

---

## Final Verification

After all three phases and commits:

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
node apps/node/dist/cli/index.js mcp --help
./scripts/docs_build.sh
```

If a device is available:

```bash
node validation/test_mcp_stdio_smoke.mjs
```
