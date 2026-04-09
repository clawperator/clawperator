# Clawperator MCP V1 Follow-Up

## Executive Summary

Document the highest-value follow-up work discovered while implementing and hardening the first-party MCP stdio server. This is not a greenfield feature plan. It is a post-ship hardening and ergonomics pack based on the actual issues, regressions, review feedback, and live-device behavior observed during the `add-mcp-server` branch.

This follow-up should ship across 1 PR and 4 phases:

- Phase 1: contract and schema convergence
- Phase 2: runtime and error-surface hardening
- Phase 3: transport and verification hardening
- Phase 4: agent ergonomics and docs polish

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

Make the shipped MCP server more deterministic, easier to debug, and less prone to schema drift or transport regressions without expanding the public tool surface beyond the current v1 scope.

## Why Now

The current MCP server works and is already heavily tested, but the implementation experience exposed several classes of follow-up work that are better handled deliberately than reactively:

- MCP boundary validation drifted from runtime normalization in multiple places
- protocol-safety guarantees depended on subtle bootstrap behavior
- some runtime extraction failures were hard to classify cleanly between JSON-RPC errors and tool errors
- live-device verification exposed flaky snapshot and app-state assumptions
- common MCP JSON Schemas and runtime validators were close enough to drift that repeated review catches were needed
- error payload diagnostics became materially more useful once envelope context was preserved
- agent usage still pays a high token and payload cost for common observe-decide-act loops
- long-lived sessions still require repetitive per-call defaults that are easy for agents to get wrong

These are exactly the sorts of issues that get harder to fix after client adoption grows.

## In Scope

- Unifying MCP JSON Schemas and runtime validation boundaries where drift is still possible
- Hardening runtime normalization and alias handling for MCP-only safety checks
- Clarifying MCP error taxonomy and making tool/runtime failures more diagnosable
- Improving transport bootstrap safety and regression coverage for stdout discipline
- Making MCP verification less flaky on live devices and more explicit about acceptable runtime states
- Evaluating bounded, agent-oriented snapshot output that reduces XML parsing cost without weakening the canonical surface
- Evaluating session-default ergonomics for repeated `deviceId`, `operatorPackage`, and timeout usage
- Evaluating a minimal agent-oriented readiness or foreground-state surface where it clearly reduces full-snapshot dependence
- Tightening MCP-facing docs where current behavior is subtle or non-obvious

## Out of Scope

- Broadly mirroring the full CLI surface in MCP
- Adding non-stdio transports
- Reworking the core Clawperator execution engine for non-MCP callers
- Broad serve API redesign
- Registry submission, packaging changes, or desktop-client-specific wrappers
- Changing the existing public tool names or removing shipped tools
- Returning raw screenshot bytes over MCP

## Existing Artifact Scope

`apps/node/src/mcp/` - in scope for refactors that reduce contract drift, improve error handling, or harden transport/tool behavior.

`apps/node/src/cli/index.ts` and MCP command entry surfaces - in scope only for MCP bootstrap and stdout-discipline improvements.

`apps/node/src/contracts/` - in scope when MCP correctness depends on canonical alias or validation behavior already owned there.

`apps/node/src/test/` and `validation/` - in scope for regression coverage and more reliable verification.

`docs/` and `apps/node/README.md` - in scope only for MCP documentation accuracy or operator-facing verification guidance.

## Surfaces and Ownership

| Surface | Path | Change type |
| --- | --- | --- |
| MCP tool helpers | `apps/node/src/mcp/tools/` | targeted refactor |
| MCP schemas and selector mapping | `apps/node/src/mcp/` | targeted hardening |
| CLI MCP bootstrap | `apps/node/src/cli/index.ts`, `apps/node/src/cli/commands/mcp.ts` | targeted hardening |
| Canonical alias normalization | `apps/node/src/contracts/aliases.ts`, `apps/node/src/contracts/inputAliases.ts` | reference or targeted extension |
| MCP tests | `apps/node/src/test/` | new coverage and reliability improvements |
| Smoke verification harness | `validation/test_mcp_stdio_smoke.mjs` | targeted hardening |
| MCP docs | `docs/api/mcp.md`, `apps/node/README.md`, internal design notes if needed | targeted update |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| CLI bootstrap and stdout behavior | `apps/node/src/cli/index.ts` |
| MCP transport entrypoint | `apps/node/src/mcp/server.ts` |
| MCP tool schemas and handlers | `apps/node/src/mcp/tools/` |
| Canonical alias normalization | `apps/node/src/contracts/aliases.ts`, `apps/node/src/contracts/inputAliases.ts` |
| Execution validation and action support | `apps/node/src/domain/executions/validateExecution.ts` |
| Execution runtime behavior | `apps/node/src/domain/executions/runExecution.ts` |
| Result envelope and step data | `apps/node/src/contracts/result.ts`, action builders, snapshot helpers |
| MCP docs | `docs/api/mcp.md`, `apps/node/README.md` |

## Deterministic Versus Judgment

Deterministic:

- stdout must remain protocol-only on the `mcp serve` path
- MCP boundary validation must reject blank optional strings and empty selectors
- safety-sensitive MCP preflight checks must account for canonical alias normalization
- runtime extraction failures inside a successful tool call should stay tool-level errors, not JSON-RPC `InvalidParams`
- shared MCP JSON Schema generation should not be duplicated across core and named tools

Judgment:

- how far to centralize schema generation before the abstraction becomes harder to maintain
- which live-device failures should be retried versus explicitly accepted as valid runtime states
- which MCP error payload fields are genuinely useful to preserve for clients
- whether future drift-reduction work belongs in `contracts/` or in MCP-only helpers
- whether agent-ergonomics improvements belong in existing tools, sibling tools, or MCP resources/session state

## Decision Rules

| Decision point | Rule |
| --- | --- |
| JSON-RPC `InvalidParams` vs tool error | Use `InvalidParams` only for MCP boundary/schema failures before execution starts |
| Runtime extraction or envelope-shape failures after execution | Return tool-level `isError` payloads with string error codes and preserved execution context |
| Alias-sensitive MCP safety checks | Normalize through canonical execution input mapping before making the decision |
| Shared MCP input schema fragments | Define once in shared helpers unless there is a tool-specific reason not to |
| Live-device smoke failures | Distinguish contract regressions from acceptable runtime-state variability before changing behavior |
| Agent-oriented ergonomics additions | Prefer narrow additions that reduce token cost or repeated boilerplate without duplicating the whole CLI |

## Failure Modes To Prevent

- MCP schema and runtime validation drifting apart again
- a future alias form bypassing an MCP-only safety guard
- stdout contamination from a previously unconsidered top-level CLI path
- runtime extraction issues being misreported as caller parameter errors
- duplicated helper logic diverging across core and named tools
- verification scripts failing for incidental device state rather than contract regressions
- agents burning large token budgets on raw XML when a bounded summary would do
- agents repeatedly mis-specifying per-call defaults in long-lived sessions

## Output Contract

This task pack must leave behind:

- a finished `tasks/mcp/v1-followup/plan.md`
- a finished `tasks/mcp/v1-followup/work-breakdown.md`

The documents must be directly executable by a follow-up agent and should prioritize the work by impact, not by code ownership convenience.

## Idempotency

- The task pack should remain valid even if a subset of follow-up fixes lands before a future agent starts.
- When an item is already fixed, the future implementer should mark it done and continue; the pack should not depend on every item remaining open.

## Durable Follow-Up

Any follow-up work that changes the public MCP contract, runtime diagnostics guidance, or verification expectations must be reflected in durable docs under `docs/` and not left only in this task pack.
