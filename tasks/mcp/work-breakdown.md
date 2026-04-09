# Clawperator MCP Server Work Breakdown

Parent plan: `tasks/mcp/plan.md`

## Executive Summary

2 PRs, 5 phases.

- PR-1 proves the transport and extracts shared services first.
- PR-2 expands the ergonomic tool surface and finishes docs plus real-device verification.

Do not start PR-2 until PR-1 is merged. This task is intentionally transport-first so the team can validate MCP correctness before investing in a broad named-tool surface.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | PR-2 waits on PR-1 merge |

## Hard Rules

1. Keep this task inside `apps/node/`, `docs/`, docs-site config, and `apps/node/README.md`. Do not create a separate top-level package.
2. Implement stdio transport only. Do not add HTTP, SSE, remote hosting, or registry submission work.
3. Build transport-neutral services first. Do not make MCP the third place where validation, operator-package resolution, or execution shaping is reimplemented.
4. Reuse canonical domain logic where possible. Do not call CLI formatter functions from the MCP layer if a structured domain or extracted shared service is available.
5. The `mcp serve` path must never write to stdout except through the MCP SDK transport. Do not use `console.log`, `process.stdout.write`, or helpers that write to stdout from the server path.
6. Every execution-backed MCP tool must use one shared helper for `commandId` and `taskId` generation.
7. Every tool that extracts data from `ResultEnvelope.stepResults` must use one shared extraction helper.
8. Build `apps/node` before running tests. Node tests execute built `dist/` artifacts.
9. Use the branch-local Node build and the `.dev` operator package for local verification unless the task explicitly needs the release APK.
10. When multiple devices are connected, always pass `--device`.
11. If the MCP layer needs selector mapping, use only the mapping from `tasks/mcp/plan.md`. Do not invent alternate selector keys.
12. Do not hand-edit `sites/docs/.build/` or `sites/docs/site/`.
13. Pin one exact MCP SDK version in `apps/node/package.json`. Do not use an open-ended “or higher” range.
14. PR-2 must not start until PR-1 is merged.
15. Use the exact MCP tool name `scroll_until` everywhere in implementation, tests, and docs.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `apps/node/src/domain/executions/runExecution.ts` | Canonical execution orchestration and post-processing |
| 2 | `apps/node/src/domain/executions/validateExecution.ts` | Canonical execution validation and supported actions |
| 3 | `apps/node/src/domain/executions/snapshotHelper.ts` (and peer helpers in `domain/executions/`) | `ResultEnvelope.stepResults[].data` field keys used for structured extraction; these are not in the TypeScript contracts |
| 4 | `apps/node/src/contracts/execution.ts` | Execution payload contract |
| 5 | `apps/node/src/contracts/result.ts` | Result envelope contract |
| 6 | `apps/node/src/contracts/errors.ts` | Stable error codes |
| 7 | `apps/node/src/contracts/selectors.ts` | Canonical selector contract |
| 8 | `apps/node/src/cli/index.ts` | Top-level CLI dispatch and stdout behavior |
| 9 | `apps/node/src/cli/registry.ts` | Existing command surface and help conventions |
| 10 | `apps/node/src/cli/commands/action.ts` | Current action behavior references |
| 11 | `apps/node/src/cli/commands/observe.ts` | Current observe behavior references |
| 12 | `apps/node/src/cli/commands/devices.ts` | Current device-listing behavior references |
| 13 | `apps/node/src/cli/commands/packages.ts` | Current package-listing behavior references and current CLI-only seam |
| 14 | `apps/node/src/cli/commands/serve.ts` | Current server transport behavior and duplication seams |
| 15 | `apps/node/package.json` | Publish surface, scripts, engines, shipped README |
| 16 | `apps/node/README.md` | Package-facing docs surface |
| 17 | `tasks/mcp/plan.md` | Stable contract and scope boundaries after code-first review |

## Background Context

These are useful framing, not pre-implementation requirements. Read before Phase 5 docs work, not before writing tool code.

| File | Why it is useful |
| --- | --- |
| sibling repo `../clawperator-distribution/docs/decision-framework.md` | Distribution rationale; informs how to frame the MCP docs for technical audiences |
| sibling repo `../clawperator-distribution/videos/intro/v1/demo-flow-notes.md` | Demo proof constraints; useful if MCP becomes part of the distribution demo |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Extract shared services and prove MCP transport | 1, 2, 3 | thinking/thinking/default | protocol tests pass; minimal tools work; no stray stdout |
| PR-2 | Expand ergonomic tools and docs | 4, 5 | thinking/default | PR-1 merged; build/test/docs pass; real-device smoke passes |

## Phase 1: Extract Shared Transport-Neutral Services

### Agent Tier

thinking

### Goal

Extract the minimum shared typed services needed so MCP does not become a third transport-specific implementation.

### Files or Surfaces To Change

- transport-neutral shared surfaces under `apps/node/src/domain/` or equivalent
- `apps/node/src/cli/commands/serve.ts` only as needed to reuse extracted helpers
- related tests

### Steps

1. Extract typed helpers for the seams that are currently transport-specific. The primary target is `resolveOperatorPackageForRequest` in `apps/node/src/cli/commands/serve.ts` - move it to a shared module under `apps/node/src/domain/` or equivalent so MCP does not reimplement it. Read `serve.ts` for any other execution helpers that both `serve` and MCP would otherwise duplicate and extract those if the evidence is clear.
2. Keep the extraction minimal and evidence-based. Do not refactor unrelated command code.
3. Add focused unit tests for each extracted helper. At minimum cover:
   - operator-package resolution with an explicit caller value, with an env-var fallback, and with the default fallback
   - verify the existing `serve` integration tests still pass after extraction (no behavior change)
4. Update `serve.ts` to use the extracted helpers where that reduces duplication cleanly.

### Acceptance Criteria

- MCP can build on typed shared services rather than CLI string-returning helpers.
- `serve` is not left as a separate competing implementation for any extracted seam.
- Tests prove the extracted services preserve current behavior.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
refactor(node): extract shared services for mcp transport
```

## Phase 2: MCP Transport Scaffold And Protocol Safety

### Agent Tier

thinking

### Goal

Add the `mcp serve` command path, pin the SDK dependency, and prove protocol correctness before broad tool work begins.

### Files or Surfaces To Change

- `apps/node/package.json`
- `apps/node/package-lock.json`
- `apps/node/src/cli/index.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/commands/mcp.ts` or equivalent
- `apps/node/src/mcp/` transport files
- protocol-focused tests

### Steps

1. Add `@modelcontextprotocol/sdk` version `1.29.0` to `apps/node/package.json`. Before pinning, verify that this version is ESM-compatible (check the SDK's own `package.json` for `"type": "module"` or dual-CJS/ESM exports) and runs on Node 24 as required by the `engines` field.
2. Add a new top-level `mcp` CLI command with a `serve` subcommand.
3. Implement stdio MCP server bootstrap under `apps/node/src/mcp/`.
4. Add shared MCP helpers for:
   - execution ID generation using timestamp plus random suffix
   - selector mapping (call `isNodeMatcherEmpty()` from `contracts/selectors.ts` after mapping and reject at the MCP boundary if the result would be empty; do not let an all-empty `NodeMatcher` reach the execution layer)
   - envelope extraction
   - MCP error/result shaping

   Add unit tests for each helper before moving on:
   - execution ID helper: generates distinct IDs with the `mcp-<tool>-` prefix pattern; two calls produce different values
   - selector mapping helper: each MCP input field maps to the correct `NodeMatcher` field; all-empty input triggers rejection, not a pass-through
   - envelope extraction helper: correct field key is pulled from `stepResults[].data`; missing key returns a defined fallback or error, not `undefined` silently
5. Explicitly protect the `mcp serve` path from stray stdout writes. In `apps/node/src/cli/index.ts`, detect the `mcp serve` argv pattern before `getGlobalOpts` runs and before any `console.log` can fire. Route directly to the MCP bootstrap from that detection point. All pre-bootstrap errors must go to stderr. This prevents `maybeShowStarHint`, the `console.log(result)` dispatch path, and `UsageError` formatting from writing to stdout during server operation.
6. Add real protocol tests at `apps/node/src/test/integration/mcp.test.ts`, modeled on the repo’s existing long-running integration style (see `apps/node/src/test/integration/serve.test.ts`), covering:
   - no unexpected stdout bytes before initialize
   - initialize handshake
   - listTools
   - one invalid request path
   - clean exit on stdin close

### Acceptance Criteria

- `clawperator mcp serve` is a valid CLI path.
- The server boots over stdio without corrupting stdout.
- Protocol tests prove initialize, listTools, invalid request handling, and clean shutdown.
- Shared MCP helpers exist for IDs, selector mapping, envelope extraction, and error shaping.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
node apps/node/dist/cli/index.js mcp --help
```

### Expected Commit

```text
feat(node): scaffold mcp transport and protocol tests
```

## Phase 3: PR-1 Minimal Tools

### Agent Tier

default

### Goal

Ship the smallest useful real MCP surface on top of the verified transport.

### Files or Surfaces To Change

- `apps/node/src/mcp/` tool files
- related tests

### Steps

1. Implement `devices` using the shared typed device-listing path.
2. Implement `snapshot` using the canonical observe/execution path.
3. Implement `execute` as a thin wrapper over the canonical validated execution contract. Callers provide `actions` (required, matching `ExecutionAction[]` from `contracts/execution.ts`), `deviceId` (optional), `operatorPackage` (optional), and `timeoutMs` (optional). The server generates `commandId` and `taskId` via the shared helper, sets `source` to `"mcp"`, and sets `expectedFormat` to `"android-ui-automator"`. Do not expose `commandId`, `taskId`, `source`, or `expectedFormat` as caller inputs. Use a light MCP schema for `actions`: require each element to have `id: string` and `type: string` with `params` as an optional passthrough object. Do not mirror all of `ActionParams` into Zod - let `validateExecution` do the real enforcement.
4. Support common execution-backed options where applicable:
   - `deviceId`
   - `operatorPackage`
   - `timeoutMs`
5. Add protocol-level tool-call tests for:
   - `devices`: valid call returns a list (may be empty if no device is connected in CI)
   - `snapshot`: valid call returns an envelope; test does not require a connected device but must confirm the response shape
   - `execute`: valid call with a minimal `actions` array (e.g., a single `sleep` action with `durationMs`); invalid call with missing `actions` field; invalid call with `actions` containing an element missing `type`
   - invalid tool name: confirm MCP-level error response, not a crash

   These tests must spawn the compiled binary as a subprocess and exchange real stdio MCP messages, not import handlers directly. Importing handlers bypasses the exact class of bug (stray writes, dispatch leaks) that the protocol tests exist to catch.

6. Stop after PR-1 and wait for merge.

### Acceptance Criteria

- `devices`, `snapshot`, and `execute` are callable through a real stdio MCP session.
- `execute` uses the canonical execution contract rather than inventing a new MCP-only payload shape.
- Common execution-backed options behave predictably.
- PR-1 stands on its own as a valid reviewable transport-first slice.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add core mcp tools
```

## Phase 4: PR-2 Named Tool Expansion

### Agent Tier

thinking

### Goal

Add ergonomic named tools only after the transport and canonical execute path are already proven.

### Files or Surfaces To Change

- `apps/node/src/mcp/` named tool files
- any helper extraction justified by actual duplication
- related tests

### Steps

1. Implement named tools for:
   - `open`
   - `click`
   - `type`
   - `read`
   - `press`
   - `wait`
   - `scroll_until`
2. Use explicit schemas:
   - `open`: exactly one of `appId` or `uri`; implement this as a Zod discriminated union or `superRefine` so the rejection is a schema-level error with a typed message, not a runtime `if/else` producing a generic throw
   - `click`: `selector` xor `coordinate`, optional `clickType` as enum of `"default"`, `"long_click"`, `"focus"`, defaults to `"default"` when omitted
   - `type`: required `text`, required `selector`, optional `submit`, optional `clear`
   - `read`: required `selector`, optional `all`, optional `container`; when `all` is false or omitted return first matched text as a string, when `all: true` return all matches as an array of strings
   - `press`: required `key` as enum of `"back"`, `"home"`, `"recents"`, validated at the MCP boundary
   - `wait`: required `selector`, optional `timeoutMs`
   - `scroll_until`: required `selector`, optional `container`, optional `clickAfter?: boolean`; use `scroll_until` action type when `clickAfter` is false or omitted, `scroll_and_click` action type when `clickAfter` is true
3. Add protocol-level tests for valid and invalid tool calls. Cover at minimum:
   - `open`: rejected when both `appId` and `uri` are provided; rejected when neither is provided; accepted with only `appId`; accepted with only `uri`
   - `click`: rejected when both `selector` and `coordinate` are provided; rejected when neither is provided
   - `press`: rejected when `key` is a value not in the enum (e.g., `"volume_up"`); accepted with each valid key
   - `read`: `all: false` or omitted returns a single string in the content; `all: true` returns an array
   - `scroll_until`: valid with `clickAfter` omitted; valid with `clickAfter: true`
   - any tool that accepts a selector: rejected when the selector object maps to an all-empty `NodeMatcher`
4. Do not add `packages`, `back`, or `scroll` in this task pack.

### Acceptance Criteria

- Named tools map cleanly onto canonical contracts and extracted shared services.
- Validation is protocol-level, not only direct handler-level.
- Selector and container semantics remain thin mappings over existing contracts.
- `scroll_until` exposes click-after behavior through one tool with `clickAfter?: boolean`, not through a second MCP tool.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): expand mcp named tools
```

## Phase 5: Docs And Real-Device Verification

### Agent Tier

default

### Goal

Document the shipped MCP surface clearly and verify it against a real client plus a connected device or emulator.

### Files or Surfaces To Change

- `apps/node/README.md`
- `docs/` new or updated MCP docs
- `sites/docs/source-map.yaml`
- `sites/docs/mkdocs.yml`
- optional `validation/` entry if a reusable MCP smoke harness is added

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the docs-authoring workflow.
2. Update `apps/node/README.md` for the npm-shipped MCP surface. Include at minimum: a short description of what the MCP server is, the `clawperator mcp serve` command, a Claude Desktop `mcpServers` JSON block using `node` as the command and the installed binary path as the arg, and a note on the `ADB_PATH` env requirement.
3. Add public docs covering:
   - what the MCP server is
   - exact launch command
   - branch-local development command example
   - Claude Desktop configuration example
   - Node version requirement
   - environment configuration for long-running MCP processes, including `CLAWPERATOR_OPERATOR_PACKAGE` and `ADB_PATH`; note that Claude Desktop and similar MCP clients typically do not inherit the shell PATH, so `ADB_PATH` must be set explicitly in the client env block rather than relying on PATH resolution
   - the shipped MCP tool list with parameter-level documentation for each tool: what each parameter accepts, which are required vs optional, and at least one example call shape
   - behavior when no device is connected at server start: the server starts successfully and returns errors on tool calls rather than failing to boot; document this so Claude Desktop users who launch the server before connecting a device know what to expect
   - device-selection caveats, including that concurrent tool calls may surface `EXECUTION_CONFLICT_IN_FLIGHT` if two execution-backed tools are called simultaneously; document this as expected behavior, not a bug
   - a short smoke-test flow
4. Update docs-site navigation and source-map entries.
5. Run the docs build workflow instead of hand-editing generated outputs.
6. If the implementation produced a reusable verification path, place it under `validation/`, not as a one-off script under `scripts/`.
6a. Add a design note under `docs/internal/design/` covering the durable MCP-specific decisions that future contributors will need: why stdio-only in v1, why `execute` uses a light MCP schema and defers to `validateExecution` rather than mirroring `ActionParams`, and why named tools call action builders rather than the CLI formatter functions. This is required by the repo's docs discipline for internal design guidance that is not obvious from the code alone.
7. Perform one real end-to-end MCP smoke test against a connected device or emulator. At minimum prove:
   - `devices`
   - `snapshot` returns parseable XML with at least one extractable node element, not just `ok: true`
   - `open` or `execute`
   - one selector-driven interaction
8. Record any verification caveats directly in the docs or a durable design note if contributors will need them later.

### Acceptance Criteria

- Package-facing and public docs both reflect the shipped MCP surface.
- `./scripts/docs_build.sh` passes.
- A real MCP client can start the server and successfully call the minimum smoke-test sequence.
- The docs do not promise registry submission, hosted infrastructure, or tools not yet shipped.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(node): document mcp server and verification
```
