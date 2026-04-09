# Clawperator MCP Server

## Executive Summary

Add a first-party stdio MCP server to Clawperator as a thin transport adapter over the existing Node execution substrate. The strongest implementation path is not to bolt MCP directly onto CLI string-producing helpers. It is to extract the missing transport-neutral services first, prove protocol correctness with a very small tool surface, and then expand into ergonomic named tools.

This task was planned across 2 PRs and 5 phases. For the shipped `add-mcp-server` run, the user explicitly overrode that split and required all five phases to land on a single branch and PR.

- PR-1: extract shared transport-neutral services and ship a minimal but real MCP server with protocol-tested core tools
- PR-2: expand the MCP tool surface, complete docs, and perform real-device verification

## Status

| Item | Value |
| --- | --- |
| State | completed |
| Total PRs | 2 planned, 1 used for this run |
| Total phases | 5 |
| Completed | 1, 2, 3, 4, 5 |
| Remaining | none |
| Current / Next | complete |
| Blockers | none |

## Goal

Ship an official Clawperator MCP server that can be launched locally from the branch-local Node build, speaks stdio MCP correctly, and exposes a small but high-value Android tool surface without creating a parallel execution stack.

## Why Now

Clawperator already has a strong execution engine and explicit contracts, but the current adoption path still expects agent builders to shell out to the CLI, parse JSON, and build their own wrappers. A first-party MCP server is a credible distribution wedge and product multiplier only if it is built as a thin adapter over the canonical substrate and validated like a real transport, not treated as a quick wrapper layer.

## In Scope

- A new first-party stdio MCP server shipped from `apps/node/`
- A new CLI entrypoint for starting the server from the branch-local build
- Extraction of missing transport-neutral services needed to avoid MCP/CLI/serve drift
- Shared MCP-side schema validation, selector mapping, execution ID generation, and envelope extraction
- A two-stage MCP tool rollout:
  - PR-1 minimal transport-valid surface:
    - `devices`
    - `snapshot`
    - `execute`
  - PR-2 ergonomic named tool expansion:
    - `open`
    - `click`
    - `type`
    - `read`
    - `press`
    - `wait`
    - `scroll_until`
- Protocol-level tests for initialize, listTools, callTool, invalid request handling, and clean shutdown
- Public docs for setup, configuration, tool surface, and verification
- Package-facing docs updates where the shipped npm surface needs them

## Out of Scope

- A separate new package outside `apps/node/`
- HTTP transport, SSE transport, remote hosting, auth, or cloud deployment
- MCP registry submission work
- Distribution repo asset production, recording, or scriptwriting
- Any planner, workflow engine, or autonomous agent loop
- New Android action primitives
- `packages`, `back`, `scroll`, skills, emulator lifecycle, or broad serve parity in v1 unless explicitly added in a follow-up task
- Returning screenshot binary blobs directly over MCP

## Existing Artifact Scope

`apps/node/src/cli/index.ts` - add only the top-level support required for a new `mcp` command path. Preserve normal CLI behavior for every non-MCP path.

`apps/node/src/cli/registry.ts` - add the `mcp` command help, routing, and supported flags. Do not opportunistically rewrite unrelated command definitions.

`apps/node/src/cli/commands/serve.ts` - may be touched only to extract transport-neutral helpers or shared resolution logic. Do not turn this task into a broad serve refactor.

`apps/node/src/cli/commands/action.ts`, `apps/node/src/cli/commands/observe.ts`, `apps/node/src/cli/commands/devices.ts`, `apps/node/src/cli/commands/packages.ts` - treat these as references for current behavior. The MCP implementation should prefer extracted transport-neutral services and canonical domain calls rather than calling CLI formatter functions that return strings.

`apps/node/src/domain/` - this is the preferred home for any reusable typed service extracted from CLI-only code.

`docs/`, `apps/node/README.md`, and docs-site config - add MCP documentation and navigation entries only. Do not broaden into unrelated docs cleanup.

## Surfaces and Ownership

| Surface | Path | Change type |
| --- | --- | --- |
| CLI command entry | `apps/node/src/cli/index.ts` | targeted update |
| CLI registry | `apps/node/src/cli/registry.ts` | targeted update |
| MCP command wrapper | `apps/node/src/cli/commands/mcp.ts` or equivalent | new file |
| MCP transport implementation | `apps/node/src/mcp/` | new directory |
| Extracted transport-neutral services | `apps/node/src/domain/` or a similarly transport-neutral shared surface | new files or extraction |
| Shared selector/execution/result helpers | `apps/node/src/mcp/` and extracted shared surfaces | new files |
| Node tests | `apps/node/src/test/` and compiled `dist/test/` via build | new coverage |
| Package-facing docs | `apps/node/README.md` | targeted update |
| Public docs | `docs/` | new page plus references |
| Docs site manifests | `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml` | navigation/source-map update |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| CLI command names and flag conventions | `apps/node/src/cli/registry.ts` |
| Global flag parsing and top-level command dispatch | `apps/node/src/cli/index.ts` |
| Selector contract | `apps/node/src/contracts/selectors.ts` |
| Execution contract | `apps/node/src/contracts/execution.ts` |
| Result envelope contract | `apps/node/src/contracts/result.ts` |
| Error codes | `apps/node/src/contracts/errors.ts` |
| Canonical execution orchestration | `apps/node/src/domain/executions/runExecution.ts` |
| Execution validation | `apps/node/src/domain/executions/validateExecution.ts` |
| Current action behavior references | `apps/node/src/cli/commands/action.ts` |
| Current observe behavior references | `apps/node/src/cli/commands/observe.ts` |
| Current device and package listing behavior references | `apps/node/src/cli/commands/devices.ts`, `apps/node/src/cli/commands/packages.ts` |
| Current HTTP server transport behavior | `apps/node/src/cli/commands/serve.ts` |
| Package publish surface | `apps/node/package.json`, `apps/node/README.md` |
| Public docs authoring rules | `docs/`, `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml` |
| Distribution context for why the feature matters | sibling repo `../clawperator-distribution/docs/decision-framework.md`, sibling repo `../clawperator-distribution/videos/intro/v1/demo-flow-notes.md` |

## Deterministic Versus Judgment

Deterministic:

- v1 transport is stdio only
- the server lives in `apps/node/`
- stdout belongs exclusively to the MCP transport on the `mcp serve` path
- MCP should reuse extracted transport-neutral services and canonical domain functions, not CLI string formatters
- PR-1 tool surface is exactly:
  - `devices`
  - `snapshot`
  - `execute`
- PR-2 named-tool expansion is limited to:
  - `open`
  - `click`
  - `type`
  - `read`
  - `press`
  - `wait`
  - `scroll_until`
- selector objects map directly to `NodeMatcher`
- `type` supports `submit` and `clear`
- `click` accepts optional `clickType` as an enum of `"default"`, `"long_click"`, `"focus"`; defaults to `"default"` when omitted
- `press` validates `key` as an enum of `"back"`, `"home"`, `"recents"` at the MCP boundary; do not pass it as a free string to the domain layer
- `read` with `all` omitted or false returns the first matched text as a string; `read` with `all: true` returns all matches as an array of strings; both shapes are returned as structured JSON in the MCP content block
- execution-backed tools support `deviceId`, `operatorPackage`, and `timeoutMs`
- all execution-backed tools use one shared execution ID helper
- envelope extraction rules are implemented once and reused
- protocol validation must include initialize, listTools, callTool, invalid request, and clean shutdown
- MCP SDK version is pinned to `1.29.0`

Judgment:

- final internal file layout under `apps/node/src/mcp/`
- exact extracted service boundaries between `mcp/`, `serve`, and existing CLI paths
- exact tool descriptions and docs examples
- whether `screenshot` is ready for a follow-up task after contract hardening

## Decision Rules

### Transport and packaging

| Decision point | Rule |
| --- | --- |
| Runtime transport | stdio only in v1 |
| Packaging | ship from `apps/node/`, not a separate repo or package |
| Entry command | `clawperator mcp serve` |
| Dependency strategy | pin `@modelcontextprotocol/sdk` to `1.29.0` in `apps/node/package.json`. Before merging, verify this version installs cleanly on Node 24 (`npm install` with no `--legacy-peer-deps` required), that the SDK's own `package.json` has `"type": "module"` or a dual-CJS/ESM `exports` map, and that no peer-dep warning fires. |
| Stdio safety rule | stdout belongs exclusively to the MCP transport. The `mcp serve` path must not write anything to stdout except protocol messages emitted by the MCP SDK. Detect `mcp serve` in `apps/node/src/cli/index.ts` before `getGlobalOpts` runs and before any `console.log` can fire, then route directly to the MCP bootstrap; all pre-bootstrap errors must go to stderr |

### PR-1 minimal tool surface

| Tool | Purpose | Why it is in PR-1 |
| --- | --- | --- |
| `devices` | list connected devices | lowest-risk protocol and env proof |
| `snapshot` | capture current UI hierarchy | proves structured observation |
| `execute` | run a validated execution payload | exposes the canonical substrate directly and avoids premature wrapper sprawl |

### PR-2 named tool surface

| Tool | Purpose | Backing behavior |
| --- | --- | --- |
| `open` | open app or URI through one discriminated input schema | existing open-app and open-uri behavior |
| `click` | tap element or coordinates, including supported click types | existing click behavior |
| `type` | type into a selected element, including submit and clear options | existing type behavior |
| `read` | read matching element text | existing read behavior |
| `press` | press `back`, `home`, or `recents` | existing keypress behavior |
| `wait` | wait until a matching UI element appears | existing wait behavior |
| `scroll_until` | scroll until target appears, optionally click | existing scroll-until behavior |

Do not add `packages`, `back`, `scroll`, skills, or emulator tools in this task pack.

For this task pack, the exact MCP tool name is `scroll_until`. Do not alternate between `scroll-until` and `scroll_until` in code, tests, or docs.

### `open` input shape

| Input case | Required behavior |
| --- | --- |
| caller passes `appId` | use the open-app execution path |
| caller passes `uri` | use the open-uri execution path |
| caller passes both | reject at schema validation |
| caller passes neither | reject at schema validation |

Do not infer app-vs-URI from one untyped `target` string in the MCP layer. Implement the mutual exclusion as a Zod discriminated union or `superRefine` so rejection is a schema-level error with a typed message, not a runtime `if/else`.

### `scroll_until` input shape

| Input field | Required behavior |
| --- | --- |
| `selector` | required target selector |
| `container` | optional container selector using the same NodeMatcher mapping |
| `clickAfter` | optional boolean; when true, expose canonical scroll-and-click behavior through the same tool |

Do not split this into separate MCP tools in this task pack. Use one `scroll_until` tool with `clickAfter?: boolean`.

When `clickAfter` is false or omitted, use the `scroll_until` canonical action type. When `clickAfter` is true, use the `scroll_and_click` canonical action type. Both are in `apps/node/src/contracts/aliases.ts`. Verify the exact strings against `apps/node/src/domain/executions/validateExecution.ts` before wiring.

**Critical implementation note:** the action type STRING itself changes between these two cases. Using the `"scroll_until"` action type string with `clickAfter: true` in params is a mis-wiring - the param would be silently ignored or cause a validation error. When `clickAfter: true`, the action type must be `"scroll_and_click"`. Read `apps/node/src/domain/actions/scrollUntil.ts` to see how the existing action builder enforces this distinction before wiring the MCP tool.

### `execute` input shape

| Input field | Required behavior |
| --- | --- |
| `actions` | required array of `ExecutionAction` objects matching `apps/node/src/contracts/execution.ts` |
| `deviceId` | optional pass-through |
| `operatorPackage` | optional pass-through |
| `timeoutMs` | optional override |

The MCP server generates `commandId`, `taskId`, `source`, and `expectedFormat`. Callers never provide these fields. `source` is fixed to `"mcp"`. `expectedFormat` is fixed to `"android-ui-automator"`.

### Selector mapping

| MCP input field | NodeMatcher field |
| --- | --- |
| `id` | `resourceId` |
| `role` | `role` |
| `text` | `textEquals` |
| `textContains` | `textContains` |
| `desc` | `contentDescEquals` |
| `descContains` | `contentDescContains` |

Container selectors, where supported, use the same mapping under a nested `container` object.

After mapping any MCP selector input to `NodeMatcher`, call `isNodeMatcherEmpty()` from `contracts/selectors.ts`. If the result is empty, reject at the MCP boundary with a clear validation error. Do not let an all-empty matcher reach `runExecution`.

Coordinates are absolute integer screen pixels:

| MCP input field | Required behavior |
| --- | --- |
| `coordinate.x` | non-negative integer pixel coordinate |
| `coordinate.y` | non-negative integer pixel coordinate |

### Common execution-backed options

| Option | Rule |
| --- | --- |
| `deviceId` | optional pass-through to canonical execution paths |
| `operatorPackage` | optional pass-through, otherwise env/default resolution. A blank string `""` is not a valid value - reject it at the MCP boundary with a validation error before it reaches `resolveOperatorPackageForRequest`. Omitting the field is valid; providing `""` is not. |
| `timeoutMs` | supported for execution-backed tools where the canonical path already supports timeout behavior |

### Result and error shape

| Condition | Required behavior |
| --- | --- |
| Tool succeeds | return structured JSON content, not formatted CLI strings |
| Tool fails with known Clawperator error | surface that code in structured error data |
| Tool fails before execution due to invalid MCP input | reject at the schema boundary with a precise validation message |
| MCP protocol misuse | return correct MCP protocol errors rather than faking tool results |

**MCP wire format distinction - required reading before implementation:**

The MCP SDK distinguishes two fundamentally different error response types. Implementors must know which to use in each case:

| Failure class | Wire format | When to use |
| --- | --- | --- |
| Clawperator runtime error (known error code) | `{ isError: true, content: [{ type: "text", text: JSON.stringify({ code, message }) }] }` | Tool executed, but device returned an error, e.g. `NO_DEVICES`, `EXECUTION_CONFLICT_IN_FLIGHT`, `EXECUTION_VALIDATION_FAILED` |
| Unknown exception from `runExecution` | `{ isError: true, content: [{ type: "text", text: exceptionMessage }] }` | Uncaught throw from the domain layer; must not crash the server process |
| Invalid tool input (Zod schema rejection) | MCP `InvalidParams` error response - returned automatically by the SDK when schema validation fails | Callers send wrong types or missing required fields |
| Unknown MCP method or protocol violation | MCP protocol-level error - returned by the SDK itself | Malformed JSON-RPC; never handled by tool code |

Every execution-backed tool handler must wrap `runExecution` in a try/catch. Any uncaught exception that escapes the domain layer must be caught and returned as `isError: true` in the tool response content. It must never crash the stdio server process.

The implementation phase must define one shared extraction helper that documents exactly which `ResultEnvelope.stepResults[].data` fields are used for convenience extraction. If snapshot text or screenshot path behavior is not stable enough, do not promise convenience fields beyond what the canonical envelope safely provides.

Before writing this helper, read `apps/node/src/domain/executions/snapshotHelper.ts` to find snapshot-specific field keys. For `read_text` action result keys and other action data keys, the authoritative source is `apps/node/src/domain/executions/validateExecution.ts` and the domain action builder for `read_text`. These keys are not declared in the TypeScript contracts and must be confirmed from domain code before implementation. Do not assume `snapshotHelper.ts` covers non-snapshot data keys.

### Execution IDs

| Item | Rule |
| --- | --- |
| `commandId` | generated by one shared helper using an `mcp-<tool>-<timestamp>-<random>` style prefix |
| `taskId` | generated alongside `commandId` by the same helper |
| Scope | all execution-backed tools use this helper rather than ad hoc string construction |

### Device targeting

| Condition | Behavior |
| --- | --- |
| `deviceId` omitted and exactly one device is available | allow existing resolution behavior |
| `deviceId` omitted and multiple devices are available | preserve the current Clawperator error contract |
| `deviceId` provided | pass through unchanged |

Long-running server configuration, such as `CLAWPERATOR_OPERATOR_PACKAGE`, `ADB_PATH`, and Node runtime expectations, must be documented explicitly for Claude Desktop or equivalent MCP clients.

## Failure Modes To Prevent

- Producing any stray stdout output on the `mcp serve` path and corrupting the MCP stdio protocol stream. Specific threat sources: `maybeShowStarHint` (called at multiple points in `index.ts` including the `--version` path, the `doctor` path, and the post-dispatch upgrade check), `console.log(result)` at line 341, and `UsageError` formatting at line 213. MCP detection must occur before any of these can fire - before `main()` enters normal dispatch, not inside it.
- Wrapping CLI string-returning helpers instead of reusing extracted typed services and canonical domain functions
- Copying request validation or operator-package resolution into a third transport-specific implementation
- Shipping a minimal MCP server without protocol-level initialize/listTools/callTool tests
- Over-promising convenience extraction from `ResultEnvelope.stepResults[].data` when those fields are not a stable contract
- Leaving execution ID generation ad hoc across tools
- Letting MCP schemas drift from the actual selector and execution contracts
- Declaring success without real stdio MCP smoke validation against a connected device or emulator
- Treating `EXECUTION_CONFLICT_IN_FLIGHT` from concurrent tool calls as a bug to fix rather than expected behavior to document
- Letting an uncaught exception from `runExecution` crash the stdio server process instead of returning an `isError: true` tool response
- Accepting a blank string `""` as `operatorPackage` at the MCP tool boundary. Blank string must be rejected with a validation error, not passed through to `resolveOperatorPackageForRequest`. Per the repo's explicit contract (CLAUDE.md): reject blank strings at validation boundaries when they are not valid values.

## Output Contract

This task is complete when all of the following are true:

- PR-1 ships:
  - extracted transport-neutral services needed for MCP and future transport reuse
  - `clawperator mcp serve`
  - protocol-tested `devices`, `snapshot`, and `execute` tools
- PR-2 ships:
  - named ergonomic tools listed in this plan
  - package-facing and public docs
  - real-device or emulator verification
- the `mcp serve` code path is verified to avoid stray stdout writes outside MCP protocol traffic
- protocol tests prove initialize, listTools, callTool, invalid request handling, and clean shutdown
- smoke validation uses a standalone Node script that speaks stdio MCP protocol directly; it does not depend on Claude Desktop or any external GUI client to pass

## Stability Expectations

- Tool registration names and schemas must remain stable once PR-1 merges. Any rename is a breaking change for existing MCP client configurations.
- Rebuilding docs must overwrite generated outputs deterministically from authored sources. Do not hand-edit generated output.

## Durable Follow-Up

- Public usage docs must live in `docs/` and docs-site config, not only in `tasks/`
- Package-facing npm usage notes must live in `apps/node/README.md`
- Any stable MCP-specific implementation notes that future contributors need should live under `docs/internal/design/` if they exceed code-local comments
- Distribution-story updates belong in the sibling `../clawperator-distribution/` repo as a separate follow-up, not as lingering notes in this task pack
