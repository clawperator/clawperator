# MCP Server Hardening Work Breakdown

Parent plan: `tasks/mcp/hardening/plan.md`

## Executive Summary

Three phases in one PR. All phases are hardening - no new tool surface.

- Phase 1 (thinking): Schema convergence - extract duplicated JSON Schema fragments to `mcp/schemas.ts`
- Phase 2 (default): Error surface - add genuinely missing test cases, re-baselined against the current suite
- Phase 3 (default): Transport hardening - strengthen transport invariant test, normalize timeout pattern, harden smoke script

Phases run sequentially. Build and test after each phase before committing.

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

## Hard Rules

1. Read `apps/node/src/test/integration/mcp.test.ts` in full before adding any test cases. Do not add a case that already exists.
2. Run `npm --prefix apps/node run build && npm --prefix apps/node run test` after each phase before committing.
3. Do not delete or loosen any existing test. Only add. Keep the existing pre-initialize silence check and add the initialize-handshake test alongside it.
4. Do not change the public JSON Schema shape of any existing MCP tool. The extraction in Phase 1 must produce byte-identical schemas.
5. Do not change the `mcp serve` global-flag interception behavior. It is intentional and documented. Do not move the MCP check to after `getGlobalOpts`.
6. Do not touch `sites/docs/.build/` or `sites/docs/site/` directly.
7. Use `node apps/node/dist/cli/index.js` for any local verification. Do not use the global `clawperator` binary.
8. One commit per phase. Do not batch phases into one commit.

## Required Reading

Read in this order before writing anything:

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/mcp/hardening/plan.md` | Scope, decision rules, out-of-scope list |
| 2 | `apps/node/src/test/integration/mcp.test.ts` | Full current coverage - read all 598 lines before adding any case |
| 3 | `apps/node/src/test/unit/mcpHelpers.test.ts` | Current unit coverage for helpers |
| 4 | `apps/node/src/test/unit/cliHelp.test.ts:158` | Confirms global-flag interception behavior is intentional and tested |
| 5 | `apps/node/src/mcp/tools/named.ts` | Contains the `selectorJsonSchema` to be extracted and the `read(all=true)` branches at lines 259-290 |
| 6 | `apps/node/src/mcp/selectors.ts` | Zod counterpart of the selector JSON Schema |
| 7 | `apps/node/src/mcp/tools/common.ts` | `applyMcpExecutionMetadata` timeout pattern |
| 8 | `apps/node/src/mcp/results.ts` | `extractStepDataValue` and its error codes |
| 9 | `apps/node/src/mcp/errors.ts` | Error taxonomy and sanitization |
| 10 | `validation/test_mcp_stdio_smoke.mjs` | Current smoke flow - read entirely before editing |

## PR Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | MCP server hardening | 1, 2, 3 | thinking / default / default | build, test |

---

## Phase 1: Schema Convergence

### Agent Tier

thinking

### Goal

Extract the duplicated JSON Schema fragments from `named.ts` into a shared `apps/node/src/mcp/schemas.ts` module so that future changes to the selector shape propagate from one place.

### Files or Surfaces To Change

- `apps/node/src/mcp/schemas.ts` - NEW file, exports shared JSON Schema fragments
- `apps/node/src/mcp/tools/named.ts` - remove local definitions, import from `../schemas.js`
- No other files unless the audit in Step 3 finds additional clear duplicates

### Steps

1. Read `apps/node/src/mcp/tools/named.ts` lines 101-119 to confirm the two local definitions being extracted: `nonWhitespaceStringJsonSchema` and `selectorJsonSchema`.

2. Create `apps/node/src/mcp/schemas.ts` with exactly these two exports. Content must be byte-identical to the current definitions in `named.ts`:

   ```ts
   export const nonWhitespaceStringJsonSchema = {
     type: "string",
     minLength: 1,
     pattern: "\\S",
   } as const;

   export const selectorJsonSchema = {
     type: "object",
     additionalProperties: false,
     minProperties: 1,
     properties: {
       id: nonWhitespaceStringJsonSchema,
       role: nonWhitespaceStringJsonSchema,
       text: nonWhitespaceStringJsonSchema,
       textContains: nonWhitespaceStringJsonSchema,
       desc: nonWhitespaceStringJsonSchema,
       descContains: nonWhitespaceStringJsonSchema,
     },
   } as const;
   ```

   Do not change the shape. Do not add or remove fields.

3. Audit the rest of `apps/node/src/mcp/` for any other JSON Schema fragments defined verbatim in more than one file. If found, extract them too. If not found, stop.

4. In `named.ts`, remove the two local definitions and import from `"../schemas.js"`. All existing uses inside `named.ts` should work without further changes.

5. Verify the exported `inputSchema` objects for all named tools are unchanged. Run a diff to confirm no property was added, removed, or renamed.

6. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.

### Acceptance Criteria

Mechanical:
- `apps/node/src/mcp/schemas.ts` exists and exports `nonWhitespaceStringJsonSchema` and `selectorJsonSchema`
- `grep -n "const selectorJsonSchema" apps/node/src/mcp/tools/named.ts` returns no output
- `grep -n "const nonWhitespaceStringJsonSchema" apps/node/src/mcp/tools/named.ts` returns no output
- `npm --prefix apps/node run build` exits 0
- `npm --prefix apps/node run test` exits 0
- The integration test `lists tools over the stdio protocol` still passes (schema shapes unchanged)

Human review:
- The extracted schemas are byte-identical to the originals
- No new file other than `schemas.ts` was created

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
grep -n "const selectorJsonSchema" apps/node/src/mcp/tools/named.ts
grep -n "const nonWhitespaceStringJsonSchema" apps/node/src/mcp/tools/named.ts
```

Both greps must return no output.

### Expected Commit

```text
refactor(node): centralize MCP JSON Schema fragments into shared schemas.ts
```

---

## Phase 2: Error Surface and Test Coverage

### Agent Tier

default

### Goal

Fill the genuine coverage gaps in the MCP test suite. Do not add cases that already exist. The three real gaps are: `type` and `scroll_until` validation boundaries (integration), and the `read(all=true)` invalid-data branches (unit).

### Before You Start

Read `apps/node/src/test/integration/mcp.test.ts` in full. The following cases are already present and must not be re-added:

| Already covered | Location |
| --- | --- |
| `execute` with caller-controlled screenshot path | `mcp.test.ts:552` |
| `execute` with screenshot alias + caller path | `mcp.test.ts:561` |
| Unknown tool name returns `-32601` | `mcp.test.ts:570` |

### Files or Surfaces To Change

- `apps/node/src/test/integration/mcp.test.ts` - add cases a, b, c below
- `apps/node/src/mcp/results.ts` or `apps/node/src/mcp/tools/named.ts` - extract `read(all=true)` parsing logic into a testable helper
- `apps/node/src/test/unit/mcpHelpers.test.ts` - add unit cases d, e, f, g below

### Steps

#### Integration test cases (a, b, c)

These use the existing `assertInvalidParams` and `assertRuntimeStructuredError` helpers already in `mcp.test.ts`.

**Case a - `type` missing `selector`:**
```ts
it("rejects type when selector is missing", async () => {
  await client.initialize();
  const response = await client.requestTool("type", { text: "hello" });
  assertInvalidParams(response);
});
```

**Case b - `type` missing `text`:**
```ts
it("rejects type when text is missing", async () => {
  await client.initialize();
  const response = await client.requestTool("type", { selector: { text: "Field" } });
  assertInvalidParams(response);
});
```

**Case c - `scroll_until` invalid direction:**
```ts
it("rejects scroll_until when direction is invalid", async () => {
  await client.initialize();
  const response = await client.requestTool("scroll_until", {
    selector: { text: "Item" },
    direction: "diagonal",
  });
  assertInvalidParams(response);
});
```

#### Unit test cases for `read(all=true)` branches (d, e, f, g)

The three `MCP_STEP_DATA_INVALID` branches in `named.ts:259-290` are:

1. JSON parse of `extracted.value` throws → `"read returned invalid JSON array data"`
2. Parsed value is not an array → `"read returned non-array data for all=true"`
3. Array contains a non-string element → `"read returned non-string items in array for all=true"`

To make these testable without a live device, extract the parsing logic from `named.ts` into a pure helper function. The function takes the extracted string value and returns either a `string[]` or an error descriptor. The exact shape of the helper and its location (`results.ts` or a separate `readResult.ts`) are left to implementation judgment - pick whichever requires less restructuring. The contract is: the helper is exported and the unit test imports and calls it directly.

After extracting:

**Case d - `read(all=true)`: invalid JSON:**
```ts
it("returns MCP_STEP_DATA_INVALID when read all=true value is not valid JSON", () => {
  const result = parseReadAllResult("not-json");
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "MCP_STEP_DATA_INVALID");
});
```

**Case e - `read(all=true)`: parsed value is not an array:**
```ts
it("returns MCP_STEP_DATA_INVALID when read all=true value parses to a non-array", () => {
  const result = parseReadAllResult('"a string"');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "MCP_STEP_DATA_INVALID");
});
```

**Case f - `read(all=true)`: array contains non-string:**
```ts
it("returns MCP_STEP_DATA_INVALID when read all=true array contains a non-string", () => {
  const result = parseReadAllResult('[1, 2, 3]');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "MCP_STEP_DATA_INVALID");
});
```

**Case g - `read(all=true)`: valid string array (happy path):**
```ts
it("returns ok with string array when read all=true value is a valid string array", () => {
  const result = parseReadAllResult('["a", "b"]');
  assert.strictEqual(result.ok, true);
  if (result.ok) assert.deepStrictEqual(result.values, ["a", "b"]);
});
```

Also verify that `mcpHelpers.test.ts` already covers `MCP_STEP_NOT_FOUND` (no matching step) and `MCP_STEP_DATA_MISSING` (key absent) for `extractStepDataValue`. If either is missing, add it.

#### Build and test

Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.

### Acceptance Criteria

Mechanical:
- Cases a, b, c are present in `mcp.test.ts` and pass
- Cases d, e, f, g are present in a unit test file and pass
- `grep -n "MCP_STEP_DATA_INVALID" apps/node/src/test/unit/mcpHelpers.test.ts` returns at least three matches (one per branch)
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- No test case re-adds something already covered - verify against the already-covered table above
- Each `read(all=true)` case targets a distinct branch (invalid JSON, non-array, non-string element)

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Expected Commit

```text
test(node): add missing MCP validation boundary and read extraction coverage
```

---

## Phase 3: Transport Hardening and Pattern Consistency

### Agent Tier

default

### Goal

Strengthen the transport invariant test from a silence window to a full `initialize` handshake. Normalize `wait` and `scroll_until` timeout pattern. Harden the smoke script read step.

Do not change the `mcp serve` global-flag interception behavior.

### Files or Surfaces To Change

- `apps/node/src/test/integration/mcp.test.ts` - keep the 150 ms silence test and add a handshake test beside it
- `apps/node/src/mcp/tools/named.ts` - normalize `wait` and `scroll_until` timeout
- `validation/test_mcp_stdio_smoke.mjs` - harden `read` step with fallback candidates
- `docs/internal/design/mcp-server.md` - add a sentence about the transport invariant if not already present

### Steps

#### Fix 1: Strengthen the transport invariant test

The existing test `emits zero stdout bytes before initialize` waits 150 ms and checks byte count. Keep it. It proves that nothing leaks to stdout before the first client request is sent. On its own it is insufficient because it still passes if the subprocess exits early or never reaches a working state.

Add a second test that successfully completes an `initialize` handshake:

```ts
it("completes initialize over stdio and returns valid JSON-RPC", async () => {
  await client.initialize();
  // If initialize completed without throwing, the server is producing valid JSON-RPC
  // on stdout. The McpIntegrationClient's drainMessages would throw on non-JSON bytes.
});
```

Do not remove the existing silence-window test. The two tests cover different failure modes and both should remain.

Also add a dedicated test for the `initialize` response structure:

```ts
it("initialize response includes server name and protocol version", async () => {
  const response = await client.initialize();
  const info = (response.result as { serverInfo?: { name?: string }; protocolVersion?: string });
  assert.strictEqual(info.serverInfo?.name, "clawperator");
  assert.strictEqual(typeof info.protocolVersion, "string");
});
```

If this is already covered by the existing `completes initialize and returns server info` test, skip it.

#### Fix 2: Normalize `wait` timeout

In `apps/node/src/mcp/tools/named.ts`, find the `wait` tool handler:

```ts
buildWaitExecution(selector, parsed.timeoutMs)
...
applyMcpExecutionMetadata(execution, "wait")
```

Add `parsed.timeoutMs` as the third argument to `applyMcpExecutionMetadata`:

```ts
applyMcpExecutionMetadata(execution, "wait", parsed.timeoutMs)
```

No behavior change. The same `timeoutMs` is applied via both paths; this just makes the pattern consistent with `open`, `click`, `type`, `read`, and `press`.

#### Fix 3: Normalize `scroll_until` timeout

In the `scroll_until` handler:

```ts
applyMcpExecutionMetadata(buildScrollUntilExecution(..., parsed.timeoutMs ?? 30_000), "scroll_until")
```

Add the timeout as the third argument:

```ts
applyMcpExecutionMetadata(buildScrollUntilExecution(..., parsed.timeoutMs ?? 30_000), "scroll_until", parsed.timeoutMs ?? 30_000)
```

No behavior change.

#### Fix 4: Harden smoke script `read` step

In `validation/test_mcp_stdio_smoke.mjs`, the current `read` step extracts a single candidate text and uses it immediately. If that exact text is absent when `read` is called, the smoke fails for non-contract reasons.

Change `extractCandidateText` to `extractCandidateTexts` (returning up to 5 candidates):

```js
function extractCandidateTexts(snapshotXml, maxCandidates = 5) {
  const candidates = [];
  const matches = [
    ...snapshotXml.matchAll(/\btext="([^"]+)"/g),
    ...snapshotXml.matchAll(/\bcontent-desc="([^"]+)"/g),
  ];
  for (const match of matches) {
    const value = decodeXmlEntities(match[1] ?? "").trim();
    if (value.length > 0 && !candidates.includes(value)) {
      candidates.push(value);
    }
    if (candidates.length >= maxCandidates) break;
  }
  return candidates;
}
```

Update the `read` call site to try each candidate in order:

```js
const candidateTexts = extractCandidateTexts(snapshotXml);
if (candidateTexts.length === 0) {
  throw new Error("Could not find any non-empty text or content-desc value in the live snapshot");
}

let readResult;
let usedCandidate;
for (const candidate of candidateTexts) {
  const attempt = await session.request("tools/call", {
    name: "read",
    arguments: { selector: { text: candidate }, deviceId: selectedDevice, operatorPackage },
  }, 30000);
  if (!attempt?.isError) {
    readResult = attempt;
    usedCandidate = candidate;
    break;
  }
}
if (!readResult) {
  throw new Error(`read failed for all ${candidateTexts.length} candidate selectors`);
}
console.log(`Using selector text ${JSON.stringify(usedCandidate)}`);
```

Remove the old `extractCandidateText` (singular) function and the old candidate log line.

#### Fix 5: Design doc note

Read `docs/internal/design/mcp-server.md`. If it does not already state that stdout is reserved exclusively for JSON-RPC messages after `mcp serve` is invoked (without global flags), and that this invariant is enforced at the entry point before any CLI formatting runs, add a brief sentence to that effect. Do not add a full new section - a sentence addition to the existing bootstrap paragraph is sufficient.

#### Build and test

Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.

### Acceptance Criteria

Mechanical:
- Integration test suite contains a test that completes an `initialize` handshake (not just a 150 ms wait)
- `named.ts` `wait` handler calls `applyMcpExecutionMetadata` with three arguments
- `named.ts` `scroll_until` handler calls `applyMcpExecutionMetadata` with three arguments
- `validation/test_mcp_stdio_smoke.mjs` contains `extractCandidateTexts` (plural) and iterates candidates
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- The `mcp serve` interception behavior is unchanged (global flags still produce usage; the CLI unit test at `cliHelp.test.ts:158` still passes)
- The timeout normalization makes no behavior change (same value applied, different call site)
- The smoke hardening still fails clearly for real MCP contract regressions

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Expected Commit

```text
fix(node): strengthen MCP transport invariant, timeout consistency, and smoke verification
```

---

## Final Verification

After all three phases and commits:

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
node apps/node/dist/cli/index.js mcp --help
```

If a device is available:

```bash
node validation/test_mcp_stdio_smoke.mjs
```
