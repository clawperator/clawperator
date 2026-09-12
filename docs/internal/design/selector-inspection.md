# Selector inspection and result transport

Public contracts live in [Selectors](../../api/selectors.md) and
[Actions](../../api/actions.md#action-query-ui). This document records the shared
resolver and transport decisions needed when extending them.

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

## Query failures and readiness

`QueryHierarchyUnavailableException` distinguishes a missing capture from a
successful zero-match result. The engine retains completed steps and the failed
query step, stops the sequence, and supplies terminal error fields to canonical
envelope serialization. Cancellation still propagates. Other non-throwing
failed-step results retain their existing sequence policy; this is not general
exception preservation for every action.

`UiTreeInspector.getUnavailableHierarchyDiagnostics` gathers service and window
availability without needing the missing root. Unknown values remain null;
`rootAvailable=false` describes the failed capture. Another window's root or
package must not be substituted as evidence for the requested application.
Public codes and data fields are owned by [query_ui](../../api/actions.md#action-query-ui).

Queries capture once. Callers needing a destination node after navigation should
use a bounded wait before querying and inspect the subsequent query result.
A query does not promise a settled screen or reserve a target for an action.

For the independently confirmed sensitive-root coverage gap and parked follow-up,
see [Accessibility hierarchy availability](accessibility-hierarchy.md).
