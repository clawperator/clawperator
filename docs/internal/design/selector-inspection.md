# Selector inspection and result transport

Public contracts live in [Selectors](../../api/selectors.md) and
[Actions](../../api/actions.md#action-query-ui). This document records the shared
resolver decisions and verification needed when extending them.

## Structural and visibility ownership

Android owns selection. `NodeResolver` indexes the original captured tree in
preorder and resolves candidates from the existing `UiTreeFilterer` projection.
`UiTree.sourceRoot` preserves structural ancestry, and filtered `UiNode.sourcePath`
values retain the original child indices. Both are transient capture metadata.
Subtree callers retain the enclosing tree with `copy(root = container)` so an
ancestor outside that container can still satisfy a relationship. Filtering a
projection again must preserve its paths.

Do not key identity by resource ID, bounds, or `UiNodeId`: fixtures deliberately
repeat all three. Paths identify nodes only in one capture. Descendant matching
uses the request's eligible candidates; structural ancestry uses the original
tree. Existing ancestor pruning and root retention are deliberate compatibility
rules. No occlusion heuristic or persistent accessibility handle is introduced.

Capture hints now preserve false checked, selected, scrollable, and checkable
values. Missing hints remain unknown. Legacy `UiNode.isClickable` includes
inherited clickability, so the query uses a separate platform-clickability hint.
Fallback nodes mark state unavailable instead of claiming false platform state.

## Large canonical results

Live Settings queries reproduced logcat splitting a roughly 42 KB result into
invalid JSON fragments. The query's 256 KiB response guard cannot solve logcat's
much smaller per-record limit.

`resultEnvelopeLogLines` retains small canonical lines unchanged. Larger logical
`[Clawperator-Result]` envelopes use `[Clawperator-Result-Chunk]` records. Each
record carries command/task identity, a zero-based index, chunk count, original
byte length, SHA-256, and base64 for at most 1024 bytes. This fits beneath logcat's
record limit even with escaped or Unicode identifiers. Android timestamp and
base64 helpers remain compatible with the declared API 21 minimum.

Each Node logcat reader owns one command's reassembly. It ignores other command
chunks, requires contiguous indices and consistent headers, validates base64,
checks byte length and SHA-256, then verifies reconstructed command/task identity
before passing the original canonical envelope to the existing parser. It caps
reassembly at 64 MiB, enough for the maximum action count of individually bounded
query results. Incomplete results time out; corruption fails explicitly. Neither
case replays the action. Public result shape and terminal-source classification
are unchanged. Consumers of large query results need the matching Node reader.

## Verification and limits

Validated with Node/CLI and debug Operator version 0.10.0 on an Android 15/API 35
arm64 emulator. Offline fixtures cover duplicate IDs and bounds, blank labels,
unknown/false state, relationship AND and self exclusion, hidden descendants,
pruned ancestors, repeated filtering, source order, limits, and UTF-8 overflow.
Parser, CLI, raw execution, MCP, and transport regressions cover malformed inputs,
flag placement, correlation, and large Unicode reassembly without extra dispatch.

Live Settings evidence includes:

- Overview: 136 total nodes, 100 returned, `truncated=true`; about 42 KB of intact
  serialized query data after the transport repair.
- Display & touch: 63 captured nodes versus 55 eligible on-screen nodes; visible
  paths equal the `onScreen=true` subset of the all-visibility capture.
- Dark theme: one switch, checked false, with seven state fields and bounds
  matching raw XML. Screenshot inspection confirms the switch is off.
- Named MCP over stdio and raw execution return the same switch state. Combined
  ancestor/descendant constraints isolate one container; a missing selector
  succeeds with count zero; six queries have six fresh snapshot IDs.

The Internet page intermittently exposed no active accessibility root while a
screenshot remained available. Query and XML snapshot reported failure rather
than zero matches. No recovery was added; richer hierarchy failure diagnostics
remain a separate release task. Live proof is for API 35 only; offline tests do
not establish device compatibility on other API levels.

The standard Node test command passes. An additional run of flat unit-test files
revealed 19 existing skill-test failures; all 19 names also fail against unchanged
base commit `654d333`. Their contract-result and pretty-banner issues are outside
selector inspection. The new selector and transport tests pass independently.
Existing sibling skill consumers use scalar selectors; no skill contract or
version migration was needed for these additive surfaces.
