# Add structurally compact snapshot output

## Executive Summary

Let callers inspect a concise hierarchy without losing access to the unmodified raw snapshot. This pack has one PR and one phase, and is not started. All implementation, tests, and public documentation ship together.

## Status

| Item | Value |
| --- | --- |
| State | Not started |
| Total PRs | 1 |
| Total phases | 1 |
| Completed | None |
| Remaining | Phase 1 |
| Current / Next | Phase 1 |
| Blockers | Await `tasks/api/selector-inspection` PR-1; PR-2 is not required |

## Goal

Let callers inspect a concise hierarchy without losing access to the unmodified raw snapshot.

## Why Now

Observed CLI snapshot responses were roughly 29-61 KB for 68-139 nodes. MCP maxChars currently slices text, which can cut XML mid-node. Agents need structure and state, not arbitrary prefix truncation.

## In Scope

Opt-in Node projection, explicit node/text budgets, CLI/MCP parity, raw artifact path, and additive visibility handling.

## Out of Scope

Changing default raw snapshot output, semantic element matching in Node, node-handle actions, and claiming compact output reduces Android capture cost.

## Existing Artifact Scope

Extend only the existing surfaces named below and the explicitly named new files. Preserve unrelated commands, skills, and documentation. Do not edit other active task packs or implement their work incidentally.

## Surfaces and Ownership

| Surface | Owner |
| --- | --- |
| Projection and output budgeting | Node observe domain |
| Raw hierarchy | Existing Android snapshot action |

## Source Of Truth

| Topic | Authority |
| --- | --- |
| Snapshot path | `apps/node/src/domain/observe/snapshot.ts` |
| Extraction | `apps/node/src/domain/executions/snapshotHelper.ts` |
| CLI | `apps/node/src/cli/commands/observe.ts` |
| MCP truncation | `apps/node/src/mcp/tools/core.ts` |
| Existing tests | `apps/node/src/test/unit/snapshotHelper.test.ts` |
| MCP tests | `apps/node/src/test/integration/mcp.test.ts` |

Initial investigation used `5d23af5`; the final task audit used merged main `120c1eb`, including the shipped on-screen-log raw API. Preserve its controller-owned overlay identity, visibility metadata, canonical error codes, and strict input aliases. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck these source seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Deterministic Versus Judgment

Apply the output contract and decision rules verbatim. Implementation structure and explanatory prose permit judgment. If a required platform capability is unavailable, record evidence and stop the affected phase; do not silently change the public contract. Routine internal refactors may proceed within scope with findings recorded.

## Decision Rules

| Input | Behavior |
| --- | --- |
| No compact request | Existing raw output unchanged |
| compact requested | Parse full XML, produce valid JSON projection |
| maxNodes reached | Stop at a whole-node boundary; count omitted nodes |
| Per-node text limit reached | Truncate text/description explicitly with field flags |
| Malformed XML | SNAPSHOT_EXTRACTION_FAILED; retain requested raw artifact |
| Visibility attribute unavailable | visibleToUser=null; do not invent false or true |
| Existing maxChars supplied with compact | Reject incompatible options |

## Failure Modes To Prevent

False success, loss of original failure evidence, duplicated contract logic, and tests that only check whether a code path ran.

## Output Contract

Add CLI snapshot `--compact`, `--max-nodes` (1..1000, default 100), `--max-text-chars` (1..4096, default 256), `--raw-path` (nonblank host path, must not exist). max-nodes/max-text-chars require compact; raw-path is valid with either output. A file write error fails the formatting/capture command with a structured error and nonzero status, while retaining the original execution envelope; do not relabel a failed artifact write as success. MCP accepts compact/maxNodes/maxTextChars and `saveRaw?:boolean`; reject caller-provided rawPath. saveRaw writes to an exclusively created runtime-managed temporary file and returns rawArtifactPath. CLI raw-path remains caller-controlled. Preserve the existing MCP prohibition on arbitrary host output paths. Keep existing maxChars behavior for raw callers.

Compact JSON has `{schemaVersion:1, commandId, taskId, rawArtifactPath?, totalNodes, returnedNodes, omittedNodes, truncated, nodes:[...]}`. Node paths are child-index paths rooted at "0" in this raw XML capture only, not persistent handles or guaranteed query IDs. Nodes retain preorder `nodePath`, `parentPath`, resourceId, className, text, contentDescription, bounds, and checked/checkable/selected/enabled/clickable/scrollable/visibleToUser states. Distinguish unknown from false; use native JSON types. Preserve hierarchy containers, including unlabeled ones, because ancestry disambiguates controls. Full-tree preorder prefix means parents precede included children. Do not drop offscreen or obscured nodes heuristically. Field truncation uses Unicode code points, marks `textTruncated` and `contentDescriptionTruncated`, and contributes to top-level truncated. Budgeting is node count plus per-field length, not a claimed exact tokenizer budget.

Store raw XML exactly as received when raw-path is supplied, using exclusive creation. Compact projection does not overwrite the canonical envelope internally or alter the execution verdict. Present it as an additive `compact` field alongside execution metadata, omitting duplicate raw XML from the compact CLI/MCP response only. Keep raw success/failure metadata and error codes. Add one shared projection module for CLI and MCP; do not write a second selector engine. XML parser must reject DTD/external entities and handle escaped attributes. Use an existing suitable parser or add a small maintained dependency with these features verified; do not parse XML via regex.

## Idempotency

Reruns must preserve the stated semantics. IDs and capture timestamps may change; existing user artifacts must not be overwritten.

## Durable Follow-Up

Publish the contract in the authored docs named in the phase. Keep regression fixtures and tests in the source tree. Use `.agents/skills/task-cleanup/SKILL.md` only after all PRs are complete and durable guidance has migrated; do not delete this pack between PRs.
