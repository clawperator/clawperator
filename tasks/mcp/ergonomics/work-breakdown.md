# MCP Server Ergonomics Work Breakdown

Parent plan: `tasks/mcp/ergonomics/plan.md`

## Executive Summary

Three phases in one PR. Blocked on `tasks/mcp/hardening/` merging first.

- Phase 1 (thinking): Bounded snapshot - `maxChars` parameter plus unit tests for truncation behavior
- Phase 2 (thinking): Session configure tool - `configure` tool, session wiring, unit tests for merge precedence across all three fields plus isolation, design note
- Phase 3 (default): Docs only - `docs/api/mcp.md` and docs build

Tests live in the same phase as the behavior they prove. Phase 3 contains no new test cases.

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
3. The `configure` success payload is `{ session: { ...currentValues } }` everywhere: in the handler, unit tests, integration tests, and docs. There is no other shape.
4. Tests for truncation (Phase 1) and session merge (Phase 2) are unit tests. They must not `return` early on runtime errors - they must assert the specific behavior deterministically without a connected device.
5. `mergeWithSessionDefaults` coverage must explicitly prove precedence for `deviceId`, `operatorPackage`, and `timeoutMs`. Do not stop at `deviceId` only.
6. Do not change any existing tool name, parameter name, or existing parameter behavior. All changes are additive.
7. Session state is on the `Server` instance from `createMcpServer()`. Never a module-level global.
8. The integration test `lists tools over the stdio protocol` asserts exact tool order. Update it when `configure` is added.
9. Do not touch `sites/docs/.build/` or `sites/docs/site/` directly. Use `.agents/skills/docs-author/SKILL.md` for the docs phase.
10. One commit per phase. Do not batch phases.
11. Docs changes belong in Phase 3 only. Implement and test first.

## Required Reading

Read in this order before writing anything:

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/mcp/ergonomics/plan.md` | Canonical decisions including payload shape and test placement rules |
| 2 | `apps/node/src/mcp/tools/core.ts` | Current `snapshot` handler being extended in Phase 1 |
| 3 | `apps/node/src/mcp/tools/common.ts` | `executionToolOptionsSchema`, `buildCommonExecutionSchema`, `nonEmptyOptionalStringSchema`, `applyMcpExecutionMetadata` |
| 4 | `apps/node/src/mcp/tools/index.ts` | `getMcpTools` factory - needs signature update in Phase 2 |
| 5 | `apps/node/src/mcp/server.ts` | `createMcpServer` - where session state is created in Phase 2 |
| 6 | `apps/node/src/mcp/tools/named.ts` | Named tool handlers - receive session defaults in Phase 2 |
| 7 | `apps/node/src/test/integration/mcp.test.ts` | Existing test structure and exact tool-list assertion to update |
| 8 | `apps/node/src/test/unit/mcpHelpers.test.ts` | Existing unit test patterns to follow |
| 9 | `docs/internal/design/mcp-server.md` | Current design posture - read before Phase 2 to understand where to add the session-state note |

## PR Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | MCP ergonomics | 1, 2, 3 | thinking / thinking / default | build, test, docs build |

---

## Phase 1: Bounded Snapshot

### Agent Tier

thinking

### Goal

Add `maxChars?: number` to the `snapshot` tool. Extract the truncation logic into a testable helper. Prove all truncation cases with unit tests. Existing callers that omit `maxChars` must see byte-identical behavior.

### Files or Surfaces To Change

- `apps/node/src/mcp/tools/core.ts` - extend schema and handler; export `applySnapshotMaxChars` helper
- `apps/node/src/test/unit/mcpHelpers.test.ts` - add 5 unit cases for `applySnapshotMaxChars`

### Steps

#### Step 1: Extract a testable truncation helper

Add and export `applySnapshotMaxChars` from `core.ts`:

```ts
export interface SnapshotMaxCharsResult {
  snapshot: string;
  truncated?: true;
}

export function applySnapshotMaxChars(
  snapshot: string,
  maxChars: number | undefined,
): SnapshotMaxCharsResult {
  if (maxChars === undefined || snapshot.length <= maxChars) {
    return { snapshot };
  }
  return { snapshot: snapshot.slice(0, maxChars), truncated: true };
}
```

The helper is a pure function with no imports from the MCP layer. This makes it directly importable by the unit test.

#### Step 2: Extend snapshot tool schema and handler

In `core.ts`, extend `snapshotArgsSchema`:

```ts
const snapshotArgsSchema = executionToolOptionsSchema.extend({
  maxChars: z.number().int().positive().optional(),
});
```

Update the `snapshot` tool `inputSchema` (currently `buildCommonExecutionSchema({})`):

```ts
inputSchema: buildCommonExecutionSchema({
  maxChars: { type: "integer", minimum: 1 },
}),
```

Update the `onSuccess` callback in the `snapshot` handler. After extracting `extracted.value`, apply the helper:

```ts
const { snapshot, truncated } = applySnapshotMaxChars(extracted.value, parsed.maxChars);
return buildSuccessResult({
  ...buildExecutionSuccessPayload(result),
  snapshot,
  ...(truncated ? { truncated } : {}),
});
```

#### Step 3: Add unit tests

In `apps/node/src/test/unit/mcpHelpers.test.ts`, import `applySnapshotMaxChars` and add:

**Case 1 - `maxChars` omitted (no truncation):**
```ts
it("applySnapshotMaxChars returns full snapshot when maxChars is undefined", () => {
  const result = applySnapshotMaxChars("abcde", undefined);
  assert.strictEqual(result.snapshot, "abcde");
  assert.strictEqual(result.truncated, undefined);
});
```

**Case 2 - snapshot shorter than limit (no truncation):**
```ts
it("applySnapshotMaxChars returns full snapshot when length is below maxChars", () => {
  const result = applySnapshotMaxChars("abc", 10);
  assert.strictEqual(result.snapshot, "abc");
  assert.strictEqual(result.truncated, undefined);
});
```

**Case 3 - snapshot exactly equal to limit (no truncation):**
```ts
it("applySnapshotMaxChars returns full snapshot when length equals maxChars", () => {
  const result = applySnapshotMaxChars("abcde", 5);
  assert.strictEqual(result.snapshot, "abcde");
  assert.strictEqual(result.truncated, undefined);
});
```

**Case 4 - snapshot longer than limit (truncation applied):**
```ts
it("applySnapshotMaxChars truncates and sets truncated when length exceeds maxChars", () => {
  const result = applySnapshotMaxChars("abcdefgh", 4);
  assert.strictEqual(result.snapshot, "abcd");
  assert.strictEqual(result.truncated, true);
});
```

**Case 5 - `maxChars: 1` (minimum valid value):**
```ts
it("applySnapshotMaxChars handles maxChars of 1", () => {
  const result = applySnapshotMaxChars("abc", 1);
  assert.strictEqual(result.snapshot, "a");
  assert.strictEqual(result.truncated, true);
});
```

Do not add a test for `maxChars: 0` or negative - those are rejected by the Zod schema (`z.number().int().positive()`) before the helper is called.

#### Step 4: Build and test

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

Confirm the existing `calls snapshot over the stdio protocol` integration test still passes.

### Acceptance Criteria

Mechanical:
- `applySnapshotMaxChars` is exported and importable from unit tests
- All 5 unit cases pass
- `snapshotArgsSchema` includes `maxChars: z.number().int().positive().optional()`
- `snapshot` tool `inputSchema` includes `maxChars: { type: "integer", minimum: 1 }`
- Existing snapshot integration test passes unchanged
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- `truncated` is `true` (not `"true"`, not `1`) when applied
- `truncated` is absent (not `false`, not `undefined` as a present key) when not applied
- No behavior change for callers that omit `maxChars`

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

Add `configure` tool and per-session defaults. Prove merge precedence and session isolation with unit tests in this phase. Add the design note to `mcp-server.md`.

### Files or Surfaces To Change

- `apps/node/src/mcp/session.ts` - NEW: `SessionDefaults`, `createSessionDefaults`
- `apps/node/src/mcp/tools/common.ts` - add `mergeWithSessionDefaults` helper
- `apps/node/src/mcp/tools/index.ts` - update `getMcpTools` signature
- `apps/node/src/mcp/tools/core.ts` - add `configure` tool; update `getCoreMcpTools` signature; apply session merge in `snapshot` and `execute`
- `apps/node/src/mcp/tools/named.ts` - update `getNamedMcpTools` signature; apply session merge in all named tool handlers
- `apps/node/src/mcp/server.ts` - create session defaults and pass to `getMcpTools`
- `apps/node/src/test/unit/mcpHelpers.test.ts` - add unit cases covering merge precedence for all three fields plus isolation
- `apps/node/src/test/integration/mcp.test.ts` - update tool-list assertion; add 3 integration cases
- `docs/internal/design/mcp-server.md` - add session-state sentence

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

#### Step 3: Add unit tests for merge helper and isolation

In `apps/node/src/test/unit/mcpHelpers.test.ts`, import `mergeWithSessionDefaults` and `createSessionDefaults`, then add:

At minimum, cover each merged field explicitly. The unit cases below are required:

**Case 1 - `deviceId`: session default used when per-call value is absent:**
```ts
it("mergeWithSessionDefaults uses session deviceId when per-call deviceId is absent", () => {
  const session = createSessionDefaults();
  session.deviceId = "session-device";
  const result = mergeWithSessionDefaults({}, session);
  assert.strictEqual(result.deviceId, "session-device");
});
```

**Case 2 - `deviceId`: per-call value overrides session default:**
```ts
it("mergeWithSessionDefaults uses per-call deviceId over session default", () => {
  const session = createSessionDefaults();
  session.deviceId = "session-device";
  const result = mergeWithSessionDefaults({ deviceId: "call-device" }, session);
  assert.strictEqual(result.deviceId, "call-device");
});
```

**Case 3 - `operatorPackage`: per-call value overrides session default:**
```ts
it("mergeWithSessionDefaults uses per-call operatorPackage over session default", () => {
  const session = createSessionDefaults();
  session.operatorPackage = "com.session.operator";
  const result = mergeWithSessionDefaults({ operatorPackage: "com.call.operator" }, session);
  assert.strictEqual(result.operatorPackage, "com.call.operator");
});
```

**Case 4 - `timeoutMs`: session default used when per-call timeoutMs is absent:**
```ts
it("mergeWithSessionDefaults uses session timeoutMs when per-call timeoutMs is absent", () => {
  const session = createSessionDefaults();
  session.timeoutMs = 1234;
  const result = mergeWithSessionDefaults({}, session);
  assert.strictEqual(result.timeoutMs, 1234);
});
```

**Case 5 - mixed precedence across all three fields:**
```ts
it("mergeWithSessionDefaults applies precedence independently across all three fields", () => {
  const session = createSessionDefaults();
  session.deviceId = "session-device";
  session.operatorPackage = "com.session.operator";
  session.timeoutMs = 2000;

  const result = mergeWithSessionDefaults({
    deviceId: "call-device",
    timeoutMs: 500,
  }, session);

  assert.strictEqual(result.deviceId, "call-device");
  assert.strictEqual(result.operatorPackage, "com.session.operator");
  assert.strictEqual(result.timeoutMs, 500);
});
```

**Case 6 - all fields absent remain undefined:**
```ts
it("mergeWithSessionDefaults leaves all fields undefined when both sources are absent", () => {
  const result = mergeWithSessionDefaults({}, createSessionDefaults());
  assert.strictEqual(result.deviceId, undefined);
  assert.strictEqual(result.operatorPackage, undefined);
  assert.strictEqual(result.timeoutMs, undefined);
});
```

**Case 7 - two sessions are independent:**
```ts
it("two separate SessionDefaults objects do not share state", () => {
  const s1 = createSessionDefaults();
  const s2 = createSessionDefaults();
  s1.deviceId = "device-one";
  s1.operatorPackage = "com.one";
  s1.timeoutMs = 111;
  assert.strictEqual(s2.deviceId, undefined);
  assert.strictEqual(s2.operatorPackage, undefined);
  assert.strictEqual(s2.timeoutMs, undefined);
});
```

You may combine cases if the assertions stay explicit, but the final unit coverage must still prove precedence or fallback for all three fields and independence of separate session objects. After the phase is complete, a reviewer should be able to point to at least one explicit assertion for each of these facts: `deviceId` fallback, `deviceId` override, `operatorPackage` override or fallback, `timeoutMs` override or fallback, mixed-field precedence, and session isolation.

#### Step 4: Update tool factory signatures

Update `getMcpTools` in `apps/node/src/mcp/tools/index.ts` to accept a session parameter:

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

Update `getCoreMcpTools(logger?, session: SessionDefaults)` and `getNamedMcpTools(logger?, session: SessionDefaults)` signatures. Session is required (not optional) once the factory provides it, so use a non-optional parameter with a default:

```ts
export function getCoreMcpTools(logger?: Logger, session: SessionDefaults = createSessionDefaults()): McpToolDefinition[]
```

#### Step 5: Add configure tool

In `getCoreMcpTools`, add `configure` after `execute` in the returned array.

Zod schema:

```ts
const configureArgsSchema = z.object({
  deviceId: nonEmptyOptionalStringSchema.optional(),
  operatorPackage: nonEmptyOptionalStringSchema.optional(),
  timeoutMs: z.number().int().nonnegative().optional(),
}).strict();
```

JSON Schema for `inputSchema` (not `buildCommonExecutionSchema` - `configure` is not an execution tool):

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

Handler - applies updates and returns the current session state as `{ session: { ...values } }`:

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

#### Step 6: Apply session merge in all execution tools

In every tool handler that calls `runExecutionTool`, call `mergeWithSessionDefaults` after `parseToolArguments` and before building the execution:

```ts
const parsed = parseToolArguments(snapshotArgsSchema, args);
const opts = mergeWithSessionDefaults(parsed, session);
// use opts.deviceId, opts.operatorPackage, opts.timeoutMs
```

Apply to: `snapshot`, `execute` (in `core.ts`), and all named tools in `named.ts` (`open`, `click`, `type`, `read`, `press`, `wait`, `scroll_until`). Do not apply to `devices` or `configure` - neither takes execution options.

#### Step 7: Wire session into server

In `apps/node/src/mcp/server.ts`:

```ts
import { createSessionDefaults } from "./session.js";

export function createMcpServer(): Server {
  const logger = ...;
  const session = createSessionDefaults();
  const tools = getMcpTools(logger, session);
  ...
}
```

#### Step 8: Update integration tests

In `apps/node/src/test/integration/mcp.test.ts`:

**Update the tool-list assertion** to include `"configure"` after `"execute"`:

```ts
assert.deepStrictEqual(
  tools.map(tool => tool.name),
  ["devices", "snapshot", "execute", "configure", "open", "click", "type", "read", "press", "wait", "scroll_until"],
);
```

**Add 3 integration cases:**

**Case A - `configure` with no args returns empty session:**
```ts
it("configure with no args returns empty session state", async () => {
  await client.initialize();
  const result = await client.callTool("configure", {});
  assert.strictEqual(result.isError, undefined);
  const payload = parseToolPayload(result) as { session?: Record<string, unknown> };
  assert.deepStrictEqual(payload.session, {});
});
```

**Case B - `configure` with deviceId reflects it in the response:**
```ts
it("configure stores deviceId and returns it in session state", async () => {
  await client.initialize();
  const result = await client.callTool("configure", { deviceId: "test-device-abc" });
  assert.strictEqual(result.isError, undefined);
  const payload = parseToolPayload(result) as { session?: Record<string, unknown> };
  assert.deepStrictEqual(payload.session, { deviceId: "test-device-abc" });
});
```

**Case C - blank deviceId is rejected:**
```ts
it("rejects configure when deviceId is blank", async () => {
  await client.initialize();
  const response = await client.requestTool("configure", { deviceId: "" });
  assert.ok(response.error);
  assert.strictEqual(response.error?.code, -32602);
});
```

Do not add a test that calls `snapshot` after `configure` and asserts behavior based on device state. That path is non-deterministic without a connected device. The unit tests in Step 3 prove the merge precedence; these integration tests prove the protocol shape.

#### Step 9: Add design note

Read `docs/internal/design/mcp-server.md`. Find the section describing the transport-focused, stateless posture (currently around the "thin MCP boundary" and "named tools use domain builders" sections). Add a sentence in the appropriate location:

> Session-local state is a deliberate exception: the `configure` tool stores `deviceId`, `operatorPackage`, and `timeoutMs` defaults in the process memory of the running MCP server instance. This state is bounded to the `configure` tool, scoped to a single `createMcpServer()` call, and not persisted across restarts.

Add it once. Do not add a new full section.

#### Step 10: Build and test

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Acceptance Criteria

Mechanical:
- `apps/node/src/mcp/session.ts` exists and exports `SessionDefaults` and `createSessionDefaults`
- Unit tests explicitly prove `mergeWithSessionDefaults` behavior for `deviceId`, `operatorPackage`, and `timeoutMs`, include at least one mixed-field precedence case, and prove session isolation
- All 3 integration cases (A, B, C) pass
- Tool-list integration test includes `"configure"` at position 4 (after `"execute"`)
- `configure` with `deviceId: ""` returns `-32602`
- `configure` with `deviceId: "x"` returns `{ session: { deviceId: "x" } }` - not a flat shape
- `configure` with no args returns `{ session: {} }` - not `{ session: null }` or `{}`
- `docs/internal/design/mcp-server.md` contains the session-state sentence
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- Session state is not a module-level global (verify it is created inside `createMcpServer`)
- `devices` and `configure` tool handlers do not call `mergeWithSessionDefaults`
- All other execution tools do call `mergeWithSessionDefaults`
- `mergeWithSessionDefaults` coverage does not stop at `deviceId`; it also proves `operatorPackage` and `timeoutMs`
- The `configure` payload shape is `{ session: { ... } }` consistently - not a flat object

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add configure tool for per-session MCP execution defaults
```

---

## Phase 3: Docs

### Agent Tier

default

### Goal

Document `maxChars` and `configure` in `docs/api/mcp.md`. Run the docs build. No new test cases in this phase.

### Files or Surfaces To Change

- `docs/api/mcp.md` - document `maxChars` parameter and `configure` tool
- Run `./scripts/docs_build.sh`
- `apps/node/README.md` - update only if the npm-facing surface description changed materially (likely not needed)

### Steps

Use `.agents/skills/docs-author/SKILL.md` for this phase. Do not hand-edit generated files.

1. In `docs/api/mcp.md`, find the `snapshot` tool section. Add a `maxChars` parameter entry covering:
   - Type: `integer`, minimum: `1`, optional
   - Behavior: truncates the returned `snapshot` string to at most `maxChars` characters using JS `slice` (UTF-16 code units, not bytes)
   - When applied: `truncated: true` is present in the success payload
   - When not applied (full snapshot fits): `truncated` is absent

2. Add a new `configure` tool section in `docs/api/mcp.md` covering:
   - Purpose: set per-session defaults for `deviceId`, `operatorPackage`, and `timeoutMs`
   - All three parameters with types and semantics
   - Precedence rule: per-call value wins over session default
   - Session lifetime: process memory only, not persisted across server restarts
   - Success payload shape: `{ session: { ...currentValues } }` with only set fields present
   - A brief example showing a `configure` call followed by a `snapshot` call that omits `deviceId`

3. Run `./scripts/docs_build.sh` and confirm it exits 0.

4. If `apps/node/README.md` mentions the tool surface explicitly, add `configure` to the list. If it only has a general description, no change is needed.

### Acceptance Criteria

Mechanical:
- `docs/api/mcp.md` contains a `maxChars` entry in the `snapshot` section
- `docs/api/mcp.md` contains a `configure` tool section with parameter table and precedence rule
- `docs/api/mcp.md` shows `{ session: { ... } }` as the `configure` success payload shape
- `./scripts/docs_build.sh` exits 0

Human review:
- Docs describe current shipped behavior only - no aspirational or partially-implemented features
- The `configure` payload example matches the handler implementation (`{ session: { ... } }`)
- The `maxChars` truncation note mentions UTF-16 code units, not bytes

### Validation

```bash
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
./scripts/docs_build.sh
node apps/node/dist/cli/index.js mcp --help
```

If a device is available:

```bash
node validation/test_mcp_stdio_smoke.mjs
```
