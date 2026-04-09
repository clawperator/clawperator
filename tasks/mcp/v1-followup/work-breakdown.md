# Clawperator MCP V1 Follow-Up Work Breakdown

Parent plan: `tasks/mcp/v1-followup/plan.md`

## Executive Summary

This task turns post-implementation lessons from the shipped MCP server into a bounded hardening pass.

- 1 PR
- 4 phases
- all phases are still within the existing MCP v1 scope

The intent is not to expand the product. It is to reduce drift, sharpen diagnostics, and make future MCP review passes quieter because the recurring bug classes are removed at the source.

This follow-up should also capture a small number of agent-facing ergonomics improvements that repeatedly matter in practice:

- snapshot output is often much larger than agents need for the next decision
- agents repeat `deviceId`, `operatorPackage`, and timeout boilerplate on nearly every call
- some quick state checks still require a full snapshot when a thinner surface would do

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

1. Do not add new MCP tools in this task.
2. Do not add HTTP, SSE, or remote MCP transports.
3. Preserve the existing tool names and the current top-level CLI surface.
4. Keep stdout protocol-only on the `mcp serve` path.
5. Build before test for every Node validation cycle: `npm --prefix apps/node run build && npm --prefix apps/node run test`.
6. All MCP server verification commands must use the branch-local build, not any global `clawperator` install.
7. Do not loosen runtime validation just to reduce test flakiness. If a test is flaky, make the expected runtime state explicit.
8. Any new MCP error-shaping rules must preserve the current redaction guarantees for `stdout`, `stderr`, `command`, and `stack`.
9. Do not hand-edit `sites/docs/.build/` or `sites/docs/site/`.

## Required Reading

Read these in order before implementation:

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `apps/node/src/cli/index.ts` | MCP bootstrap and stdout risk surface |
| 2 | `apps/node/src/mcp/server.ts` | transport lifecycle and request routing |
| 3 | `apps/node/src/mcp/selectors.ts` | MCP selector schema and mapping |
| 4 | `apps/node/src/mcp/tools/common.ts` | shared validation, execution, and schema helpers |
| 5 | `apps/node/src/mcp/tools/core.ts` | core tool safety checks and runtime extraction paths |
| 6 | `apps/node/src/mcp/tools/named.ts` | named tool schema drift risk and read-tool extraction behavior |
| 7 | `apps/node/src/mcp/errors.ts` | MCP error taxonomy and payload preservation |
| 8 | `apps/node/src/contracts/aliases.ts` | canonical action-type aliases |
| 9 | `apps/node/src/contracts/inputAliases.ts` | canonical parameter alias normalization |
| 10 | `apps/node/src/domain/executions/runExecution.ts` | runtime error and envelope behavior |
| 11 | `apps/node/src/domain/executions/validateExecution.ts` | canonical runtime validation boundary |
| 12 | `apps/node/src/test/integration/mcp.test.ts` | current protocol and tool regression coverage |
| 13 | `apps/node/src/test/unit/mcpHelpers.test.ts` | helper-level regression expectations |
| 14 | `apps/node/src/test/unit/cliHelp.test.ts` | CLI bootstrap and argument-routing coverage |
| 15 | `validation/test_mcp_stdio_smoke.mjs` | real-session smoke verification assumptions |
| 16 | `docs/api/mcp.md` | current public MCP contract and operator guidance |

## Findings To Capture

These are the specific classes of follow-up work this pack should address:

1. MCP boundary validation and runtime normalization are still close enough to drift that repeated review comments caught real issues.
2. Alias-sensitive safety checks are easy to get wrong if they reason over raw input instead of canonical normalized input.
3. JSON-RPC `InvalidParams` and tool-level `isError` semantics need firmer decision boundaries.
4. Shared MCP JSON Schema generation should not be duplicated in multiple files.
5. Live-device verification needs to tolerate legitimate device-state variation without hiding contract regressions.
6. MCP error payloads are substantially more useful when execution context survives sanitization.
7. Bootstrap detection for `mcp serve` must continue to preempt every stdout-writing top-level path.
8. Agents still pay a large token and parsing penalty on `snapshot` because the default surface is full XML only.
9. Long-lived MCP sessions still lack an ergonomic way to set defaults for repeated execution-backed calls.
10. Agents sometimes need a thin “where am I?” or readiness answer before deciding whether a full snapshot is worth the cost.

## Tool Surface Audit

A full audit of the named MCP tools against the underlying domain builders and `validateExecution.ts` was completed during the `add-mcp-server` PR review. The table below records each concern, its verdict, and where it was resolved.

| Concern | Verdict | Resolution |
| --- | --- | --- |
| `scroll_until` direction hardcoded to `"down"` | Fixed | `direction` is now a required enum field (`"down"`, `"up"`, `"left"`, `"right"`) on the `scroll_until` tool. PR commit `98b4afb`. |
| `read` missing `validator` / `validatorPattern` | Fixed | Both fields added to the `read` tool and `buildReadExecution`. `validator: "regex"` with `validatorPattern` required when set. PR commit `e3bd2dc`. |
| `click` missing `focus` + coordinate constraint | Not a gap | The constraint (coordinate + `clickType: "focus"` = invalid) is caught by `validateExecution.ts`, the same path as CLI. No MCP-layer change needed. |
| `open` and `press` hardcode timeouts in domain builders | Not a gap | `applyMcpExecutionMetadata` overrides `timeoutMs` from the caller when provided. The hardcoded builder defaults are only used when the caller omits the field. |
| `wait_for_navigation` not a named tool | Deliberate deferral | Complex action requiring at least one of `expectedPackage` or `expectedNode`, plus its own sub-timeout constraint. Fully reachable via the `execute` tool. |
| `sleep` not a named tool | Deliberate deferral | Reachable via `execute`. A named `sleep` tool adds little ergonomic value over `execute`. |
| `close_app` not a named tool | Deliberate deferral | Reachable via `execute`. Paired with `open`; may be worth adding as a named tool in a future expansion pass if agent usage shows demand. |
| `read_key_value_pair` not a named tool | Deliberate deferral | Reachable via `execute`. Narrow use case; not in v1 named-tool scope. |
| `take_screenshot` not a named tool | Deliberate deferral | Reachable via `execute`. The `execute` tool blocks caller-controlled `path` for safety. A future named `screenshot` tool would need a clear path policy before shipping. |
| `start_recording` / `stop_recording` not exposed | Deliberate deferral | Recording lifecycle is a multi-step flow. Reachable via `execute`. No named-tool wrapper planned for v1. |

### Notes For Future Expansion

- Before adding any new named tool, verify it is not already reachable with acceptable ergonomics via `execute`.
- `close_app` and `take_screenshot` are the most likely candidates for future named-tool promotion if agent usage data shows they are commonly needed.
- `wait_for_navigation` is the most complex deferred action. If promoted, its sub-timeout semantics and mutual-exclusion constraints need MCP-boundary validation on par with `wait`.

## PR Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | MCP v1 hardening and drift reduction | 1, 2, 3, 4 | thinking/default/default/default | build, test, smoke, docs alignment |

## Phase 1: Contract And Schema Convergence

### Agent Tier

thinking

### Goal

Remove the main schema-drift risks between MCP JSON Schemas, Zod validators, and canonical runtime normalization.

### Likely Work

- inventory every MCP schema fragment currently defined in more than one place
- consolidate common JSON Schema fragments where duplication is already causing review churn
- ensure selector fields, common execution options, and xor-style tool arguments are validated consistently across:
  - exposed MCP schemas
  - runtime Zod schemas
  - tool-handler assumptions
- add targeted regressions for whitespace-only selector fields and any similar boundary cases still missing

### Acceptance Criteria

- no duplicated common MCP JSON Schema helper remains without a documented reason
- MCP selector validation matches the exposed schema and runtime assumptions
- future changes to common execution options can be made in one place

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

## Phase 2: Runtime And Error-Surface Hardening

### Agent Tier

thinking

### Goal

Make runtime failures easier to classify and debug without confusing them with caller-side parameter errors.

### Likely Work

- audit every place MCP tool handlers throw or return errors after execution has already started
- enforce a strict rule:
  - boundary/schema failures => JSON-RPC `InvalidParams`
  - runtime/envelope/step-data failures => tool-level `isError`
- review MCP error payload shaping to keep useful execution context while preserving current redaction
- standardize string error codes for MCP-only tool/runtime extraction failures where codes are currently ad hoc or absent

### Acceptance Criteria

- no post-execution parsing or extraction failure is surfaced as `InvalidParams`
- tool-level runtime failures preserve enough context for GUI-client debugging
- tests explicitly cover at least one runtime extraction failure path

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

## Phase 3: Transport And Verification Hardening

### Agent Tier

default

### Goal

Reduce the remaining fragility in MCP bootstrap detection and live verification.

### Likely Work

- review `mcp serve` interception against all top-level global argv forms that could otherwise reach stdout paths
- add regression coverage for those argv forms if they are meant to be intercepted
- harden the stdio smoke script so failures classify clearly as:
  - bootstrap/transport failure
  - schema/contract failure
  - acceptable live-device variance
- review the integration test expectations for snapshot and similar tools so real device state does not create false failures

### Acceptance Criteria

- no known top-level global argv form can bypass MCP interception and reach a stdout-writing non-MCP path
- the smoke script fails clearly and does not hang on early child exit
- integration tests remain deterministic enough for repeated local reruns

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
node validation/test_mcp_stdio_smoke.mjs
```

## Phase 4: Agent Ergonomics And Docs Polish

### Agent Tier

thinking

### Goal

Capture the highest-leverage agent-facing improvements without turning MCP v1 follow-up into a broad new surface expansion.

### Likely Work

- evaluate a bounded snapshot response mode or sibling surface that gives agents a compact, stable summary instead of forcing full XML every time
- evaluate process-level session defaults for repeated `deviceId`, `operatorPackage`, and timeout usage, with explicit per-call overrides
- evaluate whether a minimal foreground-state or readiness surface would reduce unnecessary full snapshots and blind retries
- evaluate whether `execute` should grow a `validateOnly`-style MCP affordance rather than forcing agents to infer runtime validation from failed real calls
- evaluate whether correlation IDs, retryability hints, or concurrency hints should be exposed more explicitly for agent branching logic
- update `docs/api/mcp.md` for any contract or diagnostics clarifications introduced by Phases 1-3
- add concise operator guidance where live-device verification assumptions are non-obvious
- update `apps/node/README.md` only if the npm-facing surface changed materially
- add or update internal design notes only if the hardening changes create a durable new engineering rule

### Acceptance Criteria

- the task leaves a clear recommendation for which agent-ergonomics additions are worth shipping next and which are intentionally deferred
- any accepted ergonomics additions remain narrow, bounded, and consistent with the existing MCP contract philosophy
- docs describe current shipped MCP behavior without over-promising
- diagnostics guidance reflects the actual preserved error payloads and logging path
- docs build succeeds if any docs changed

### Validation

```bash
./scripts/docs_build.sh
```

## Final Verification

Run after all phases:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
node apps/node/dist/cli/index.js mcp --help
node validation/test_mcp_stdio_smoke.mjs
```

If docs changed:

```bash
./scripts/docs_build.sh
```

## Expected Outcome

When this follow-up lands, the MCP server should feel less like a newly shipped adapter and more like a stable first-class interface:

- fewer review comments should uncover contract drift
- runtime failures should be easier to interpret from clients
- safety-sensitive guards should reason over canonical normalized input
- bootstrap and smoke verification should be less brittle
- docs should better match the lived operator experience of running MCP locally
- the next step for agent-oriented improvements should be explicit rather than implicit guesswork
