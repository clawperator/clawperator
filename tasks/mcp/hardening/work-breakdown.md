# MCP Server Hardening Work Breakdown

Parent plan: `tasks/mcp/hardening/plan.md`

## Executive Summary

Three phases in one PR. All phases are hardening - no new tool surface.

- Phase 1 (thinking): Schema convergence - extract duplicated JSON Schema fragments to `mcp/schemas.ts`
- Phase 2 (default): Error surface - add six missing validation test cases, audit error codes
- Phase 3 (default): Transport hardening - fix MCP interception bypass, normalize timeout pattern, harden smoke script

Phases run sequentially in one PR. Build and test after each phase.

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

1. Run `npm --prefix apps/node run build && npm --prefix apps/node run test` after each phase before committing.
2. Do not delete or loosen any existing test. Only add.
3. Do not change the public JSON Schema shape of any existing MCP tool. The extraction in Phase 1 must produce byte-identical schemas.
4. Do not touch `sites/docs/.build/` or `sites/docs/site/` directly.
5. Use `node apps/node/dist/cli/index.js` for any local verification. Do not use the global `clawperator` binary.
6. One commit per phase. Do not batch phases into one commit.
7. If a step reveals an unexpected finding (e.g., a third JSON Schema duplicate), log the finding, fix it if clearly in scope, and note it in the commit message. Do not silently skip it.

## Required Reading

Read in this order before writing anything:

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/mcp/hardening/plan.md` | Scope, decision rules, and failure modes |
| 2 | `apps/node/src/mcp/tools/named.ts` | Contains `selectorJsonSchema` and `nonWhitespaceStringJsonSchema` to be extracted |
| 3 | `apps/node/src/mcp/selectors.ts` | Zod `mcpSelectorSchema` - structural counterpart to the JSON Schema to be extracted |
| 4 | `apps/node/src/mcp/tools/common.ts` | `applyMcpExecutionMetadata` timeout pattern and `buildCommonExecutionSchema` |
| 5 | `apps/node/src/mcp/tools/core.ts` | `snapshot`, `execute`, and `devices` handlers |
| 6 | `apps/node/src/mcp/errors.ts` | Error taxonomy, sanitization, and string code inventory |
| 7 | `apps/node/src/mcp/results.ts` | `extractStepDataValue` and its error code strings |
| 8 | `apps/node/src/cli/index.ts` | `resolveMcpServeArgs` and the global opts parsing flow |
| 9 | `apps/node/src/test/integration/mcp.test.ts` | Current integration coverage - read all cases before adding |
| 10 | `apps/node/src/test/unit/mcpHelpers.test.ts` | Current unit coverage for helpers |
| 11 | `apps/node/src/test/unit/cliHelp.test.ts` | Current CLI unit tests |
| 12 | `validation/test_mcp_stdio_smoke.mjs` | Current smoke flow - read entirely before editing |

## PR Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | MCP server hardening | 1, 2, 3 | thinking / default / default | build, test, smoke |

---

## Phase 1: Schema Convergence

### Agent Tier

thinking

### Goal

Extract the duplicated JSON Schema fragments from `named.ts` into a shared `apps/node/src/mcp/schemas.ts` module, so future drift between the Zod schemas and JSON Schemas is caught in one place.

### Files or Surfaces To Change

- `apps/node/src/mcp/schemas.ts` - NEW file, exports shared JSON Schema fragments
- `apps/node/src/mcp/tools/named.ts` - remove local definitions, import from `../schemas.js`
- No other files unless the audit in Step 3 finds additional duplicates

### Steps

1. Read `apps/node/src/mcp/tools/named.ts` lines 101-119 to confirm the current local definitions of `nonWhitespaceStringJsonSchema` and `selectorJsonSchema`.

2. Create `apps/node/src/mcp/schemas.ts` with exactly these two exports. The content must be structurally identical to what is currently in `named.ts`:

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

   Do not change the shape. Do not add or remove properties. The goal is zero schema drift, not schema redesign.

3. Audit the rest of `apps/node/src/mcp/` for any other hand-copied JSON Schema fragments that are also defined elsewhere as Zod schemas. If found, extract them too. If not found, stop.

4. In `named.ts`, remove the local `nonWhitespaceStringJsonSchema` and `selectorJsonSchema` definitions and import from `"../schemas.js"`. All existing uses of both names inside `named.ts` should work without any other changes.

5. Verify the exported `inputSchema` objects for all named tools are unchanged. Run a quick diff to confirm no JSON Schema property was added, removed, or renamed.

6. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.

### Acceptance Criteria

Mechanical:
- `apps/node/src/mcp/schemas.ts` exists and exports `nonWhitespaceStringJsonSchema` and `selectorJsonSchema`
- `named.ts` contains no local definition of either name (grep for `const selectorJsonSchema` and `const nonWhitespaceStringJsonSchema` in `named.ts` - must return zero matches)
- `npm --prefix apps/node run build` exits 0
- `npm --prefix apps/node run test` exits 0
- Integration test `lists tools over the stdio protocol` passes (schema shapes are unchanged)

Human review:
- The extracted schemas are byte-identical to the originals (no properties added or removed)
- No new file other than `schemas.ts` was created

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
grep -n "const selectorJsonSchema" apps/node/src/mcp/tools/named.ts
grep -n "const nonWhitespaceStringJsonSchema" apps/node/src/mcp/tools/named.ts
```

Both grep commands must return no output.

### Expected Commit

```text
refactor(node): centralize MCP JSON Schema fragments into shared schemas.ts
```

---

## Phase 2: Error Surface and Test Coverage

### Agent Tier

default

### Goal

Add the six missing MCP validation boundary test cases and verify the string error code inventory is complete.

### Files or Surfaces To Change

- `apps/node/src/test/integration/mcp.test.ts` - add cases a through f below
- `apps/node/src/test/unit/mcpHelpers.test.ts` - add case g (runtime extraction failure) if not already covered
- `apps/node/src/mcp/errors.ts` - add named string constants if any ad-hoc codes are found in tool handlers

### Steps

1. Read `apps/node/src/test/integration/mcp.test.ts` fully before adding anything. Note the `assertInvalidParams` and `assertRuntimeStructuredError` helper functions already present.

2. Add the following integration test cases inside the `describe("mcp stdio integration")` block. Each case must call `await client.initialize()` first.

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

   **Case d - `read` with `validator: "regex"` but no `validatorPattern`:**
   ```ts
   it("rejects read when validator is regex but validatorPattern is missing", async () => {
     await client.initialize();
     const response = await client.requestTool("read", {
       selector: { text: "Field" },
       validator: "regex",
     });
     assertInvalidParams(response);
   });
   ```

   **Case e - `execute` with caller-controlled `take_screenshot` path:**
   ```ts
   it("rejects execute when take_screenshot action includes a caller-controlled path", async () => {
     await client.initialize();
     const response = await client.requestTool("execute", {
       actions: [
         { id: "ss-1", type: "take_screenshot", params: { path: "/tmp/out.png" } },
       ],
     });
     assertInvalidParams(response);
   });
   ```

   **Case f - unknown tool name:**
   ```ts
   it("returns MethodNotFound for an unknown tool name", async () => {
     await client.initialize();
     const response = await client.requestTool("nonexistent_tool", {});
     assert.ok(response.error);
     assert.strictEqual(response.error?.code, -32601);
   });
   ```

3. For case g (runtime extraction failure producing tool-level `isError` with a string `code`): read `apps/node/src/test/unit/mcpHelpers.test.ts` and confirm it covers `extractStepDataValue` returning `MCP_STEP_NOT_FOUND` and `MCP_STEP_DATA_MISSING`. If either is missing, add unit test cases there. Do not add these to the integration test - they require device-side failure to trigger and are better tested at the unit level.

4. Audit the string error codes used across `apps/node/src/mcp/tools/core.ts` and `apps/node/src/mcp/tools/named.ts`. Every string used as a `code:` field in `buildMcpErrorResult` calls must appear as a named constant or as one of the standard string values from `results.ts` (`MCP_STEP_NOT_FOUND`, `MCP_STEP_DATA_MISSING`, `MCP_STEP_DATA_INVALID`). If any raw string literal is found, define a named constant in `errors.ts` or `results.ts` and replace the usage.

5. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.

### Acceptance Criteria

Mechanical:
- All six cases (a-f) are present in `mcp.test.ts` and pass
- `mcpHelpers.test.ts` covers `MCP_STEP_NOT_FOUND` and `MCP_STEP_DATA_MISSING` error paths
- No raw string literal used as a `code` in a `buildMcpErrorResult` call without a named constant
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- Each test case targets the exact failure mode (not a superset or approximation)
- The unknown-tool test asserts the correct JSON-RPC error code -32601, not -32602

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Expected Commit

```text
test(node): add missing MCP validation boundary and error surface coverage
```

---

## Phase 3: Transport Hardening and Pattern Consistency

### Agent Tier

default

### Goal

Fix the MCP interception bypass for global flags preceding `mcp serve`, normalize `wait` and `scroll_until` to follow the same timeout pattern as all other named tools, and harden the smoke script `read` step against transient device state.

### Files or Surfaces To Change

- `apps/node/src/cli/index.ts` - fix MCP interception to handle global flags before `mcp serve`
- `apps/node/src/test/integration/mcp.test.ts` - add regression test for global-flag form
- `apps/node/src/mcp/tools/named.ts` - normalize `wait` and `scroll_until` timeout
- `validation/test_mcp_stdio_smoke.mjs` - harden `read` step with fallback candidates
- `docs/internal/design/mcp-server.md` - add a note about the interception rule if the fix introduces a non-obvious invariant

### Steps

#### Fix 1: MCP interception bypass

1. Read `apps/node/src/cli/index.ts` lines 230-260 to understand the current flow: `resolveMcpServeArgs` runs at `argv[0]` / `argv[1]` before global opts are parsed.

2. The bug: `resolveMcpServeArgs(argv)` checks `argv[0] === "mcp"`. If any global flag precedes `mcp serve` (e.g., `--log-level debug mcp serve`), `argv[0]` is `--log-level`, not `mcp`, and the MCP path is not taken. The CLI then proceeds to stdout-writing paths that corrupt the MCP client's stdio stream.

3. Fix: Move the MCP check to after `getGlobalOpts` has stripped the global flags into their own fields and returned `rest`. After the `getGlobalOpts` call in `main()`, check if `global.rest[0] === "mcp"` and `global.rest[1] === "serve"`. If so, run the MCP server and return. Remove or inline `resolveMcpServeArgs` as appropriate.

   The ordering concern: `getGlobalOpts` can throw `UsageError` for invalid flags, and that error path uses `console.log` (stdout). This is acceptable because an invalid global flag before `mcp serve` is a caller error. The MCP interception is for well-formed invocations.

   The `--version` check at line 258 runs after the original MCP check but before `getGlobalOpts`. After the refactor, `--version mcp serve` would reach `getGlobalOpts`. Verify that `getGlobalOpts` handles `--version` as a passthrough token (it is not a flag `getGlobalOpts` knows about, so it goes into `rest`). If it does, the `--version` guard at line 258 will still fire before the MCP path. Confirm this ordering is correct and adjust if not.

4. After fixing, verify manually:
   ```bash
   npm --prefix apps/node run build
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' | node apps/node/dist/cli/index.js --log-level debug mcp serve
   ```
   The output must be a JSON-RPC response, not a help string or error message.

#### Fix 2: Regression test for global-flag interception

5. In `mcp.test.ts`, add a test inside `describe("mcp stdio integration")`:

   ```ts
   it("emits zero stdout bytes before initialize when global flags precede mcp serve", async () => {
     const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
     const child = spawn(process.execPath, ["dist/cli/index.js", "--log-level", "debug", "mcp", "serve"], {
       cwd: packageRoot,
       stdio: ["pipe", "pipe", "pipe"],
     });
     const stdoutChunks: Buffer[] = [];
     child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
     await new Promise(resolve => setTimeout(resolve, 150));
     child.kill("SIGTERM");
     await new Promise(resolve => child.once("exit", resolve));
     const totalBytes = stdoutChunks.reduce((n, c) => n + c.length, 0);
     assert.strictEqual(totalBytes, 0, "global flag before mcp serve must not produce stdout before initialize");
   });
   ```

#### Fix 3: Normalize `wait` and `scroll_until` timeout

6. In `apps/node/src/mcp/tools/named.ts`, find the `wait` tool handler. It currently calls:
   ```ts
   buildWaitExecution(selector, parsed.timeoutMs)
   ...
   applyMcpExecutionMetadata(execution, "wait")
   ```
   Change to pass `parsed.timeoutMs` to `applyMcpExecutionMetadata` as the third argument:
   ```ts
   applyMcpExecutionMetadata(execution, "wait", parsed.timeoutMs)
   ```
   The behavior is identical (both paths set the same value) but the pattern is now consistent with `open`, `click`, `type`, `read`, and `press`.

7. Find the `scroll_until` tool handler. It currently calls:
   ```ts
   applyMcpExecutionMetadata(buildScrollUntilExecution(..., parsed.timeoutMs ?? 30_000), "scroll_until")
   ```
   Change to:
   ```ts
   applyMcpExecutionMetadata(buildScrollUntilExecution(..., parsed.timeoutMs ?? 30_000), "scroll_until", parsed.timeoutMs ?? 30_000)
   ```
   Again, no behavior change - just consistent pattern.

#### Fix 4: Harden smoke script `read` step

8. In `validation/test_mcp_stdio_smoke.mjs`, the current `read` step extracts a single candidate text from the snapshot and uses it as a `{ text: candidateText }` selector. If that exact text is not found (transient state change), the smoke fails.

   Change `extractCandidateText` to extract multiple candidates:
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

   Update the `read` step to try each candidate in order, accepting the first success:
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

   Remove the old single-candidate `extractCandidateText` function and the old `candidateText` log.

9. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.

10. If `docs/internal/design/mcp-server.md` does not already contain a note about the MCP interception invariant (that `mcp serve` must be intercepted regardless of global flag position), add a brief note there.

### Acceptance Criteria

Mechanical:
- `node apps/node/dist/cli/index.js --log-level debug mcp serve` produces zero non-JSON-RPC stdout bytes before an initialize message is sent
- The new regression test in `mcp.test.ts` passes
- `named.ts` `wait` handler calls `applyMcpExecutionMetadata` with three arguments
- `named.ts` `scroll_until` handler calls `applyMcpExecutionMetadata` with three arguments
- `validation/test_mcp_stdio_smoke.mjs` contains `extractCandidateTexts` (plural) and a candidate loop
- `npm --prefix apps/node run build && npm --prefix apps/node run test` exits 0

Human review:
- The MCP interception fix does not break any non-MCP CLI invocation
- The timeout normalization makes no behavior change (same value, different call site)
- The smoke hardening still fails clearly if the MCP contract is actually broken

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' | node apps/node/dist/cli/index.js --log-level debug mcp serve
```

The second command must produce a JSON-RPC response (first line of stdout is a valid JSON object with `"id":1`).

### Expected Commit

```text
fix(node): harden MCP transport interception, timeout consistency, and smoke verification
```

---

## Final Verification

After all three phases and commits:

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
node apps/node/dist/cli/index.js mcp --help
```

If the smoke harness is available on a device:

```bash
node validation/test_mcp_stdio_smoke.mjs
```
