# Selector inspection and result transport

Public contracts live in [Selectors](../../api/selectors.md) and
[Actions](../../api/actions.md#action-query-ui). This document records the shared
resolver and transport decisions needed when extending them.

## Structural and visibility ownership

Android owns selection. `NodeResolver` indexes the original captured tree in
preorder and resolves candidates from the existing `UiTreeFilterer` projection.
`UiTree.sourceRoot` preserves structural ancestry, and filtered `UiNode.sourcePath`
values retain the original child indices. Both are transient capture metadata.
Scoped actions resolve the enclosing tree and restrict target candidate paths to
strict descendants of the selected container. An ancestor outside that container
can still satisfy a relationship. Filtering a
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

For the independently confirmed sensitive-root coverage gap and required v0.10 follow-up,
see [Accessibility hierarchy availability](accessibility-hierarchy.md).

## Strict action dispatch

`TaskUiScopeDefault` applies one cardinality policy to candidates returned by
`NodeResolver`. Container uniqueness is checked before target selection. Strict
container failures and ambiguity are terminal, while absent immediate targets
retain existing retries. A strict wait retains its most recent typed missing
selection if its timeout expires during a retry delay. Read-all counts nodes for
scope enforcement but retains legacy filtering of blank text in its text result.

Scroll searches re-resolve their scrollable scope and target on every capture,
including the capture immediately preceding a swipe. A target that appears there
ends the search without a gesture; ambiguity prevents that gesture. The final
click resolves the scope and target again. No observation path or accessibility
reference crosses executions. Tests use duplicate IDs and bounds to prevent an
accidental identity shortcut.

`StrictSelectionException` carries a code, exact count, and bounded serialized
candidate summaries. The engine retains prior steps and the failed step and
stops later actions. This is specific to strict selection; R6 still owns general
failure preservation and action receipts. Existing raw on-screen-log behavior,
query failures, visibility, and per-node sensitivity metadata are preserved.

Legacy omitted/false strict keeps first-match defaults. Explicit containers now
scope targets to strict descendants, including search checks and the final click.
Consumers must use matching v0.10 Node and Operator builds: an older parser can
ignore these new fields. No replay is authorized by a failed or missing transport
result.

## Validation and compatibility

R4 was merged in `8cab7adb`. Its verification covered Node build/306 standard
tests, query and transport/MCP coverage, Android builds/unit tests, docs, and live
API 35 query/XML state parity, relational navigation, and large canonical results.
Its sensitivity follow-up is documented in
[accessibility hierarchy availability](accessibility-hierarchy.md).

R5 local acceptance on 2026-09-12 used branch-local Node/Operator v0.10.0:

- Android debug build and all debug unit tests: 421 tests, zero failures/errors.
- Node build and standard suite: 306 passed. Explicit selector, query, MCP helper,
  and execution-validation suite: 197 passed. The standard suite includes stdio
  MCP integration; retain explicit flat-file checks until test discovery is
  consolidated.
- Docs build, generated routes, and diff whitespace checks passed.
- Android 15/API 35 arm64 emulator, matching development APK: queried the unique
  Settings Internet row, performed a strict click within its explicit recycler
  container, then verified the Internet toolbar with a strict wait and query.
  A screenshot confirmed the destination. A broad title click returned
  `NODE_AMBIGUOUS` with seven candidates. Final-build MCP and raw executions
  confirmed preserved preceding query results, skipped later actions, exact
  correlation, and scoped unique navigation. Private evidence was retained in
  temporary local files, including `r5-final-live.json` and `r5-internet.png`.
- Offline dispatch spies cover zero/one/two targets, duplicate containers, scope
  self-exclusion, blank labels/read-all, delayed waits, bounded scroll progress,
  fresh pre-gesture checks, changed containers, and changed final-click targets.
  Duplicate-container proof is fixture-based; the live screen is not claimed to
  contain duplicate containers.
- The sibling runtime skills' offline entrypoint passed 83 tests. Existing
  container-based replay callers target children of their category/pager scopes;
  no payload or version migration was required. Their authenticated physical
  device scenarios were not run. Other Android versions remain unproven live.

The earlier extra flat `skills.test.ts` run had 19 failures reproducible on
unchanged `654d333`, involving missing SkillResult `result` fields and pretty
output/banner expectations. This remains a separate skill workstream follow-up:
repair those expectations/contracts and rerun that file. It is not part of the
standard Node suite or evidence of a strict-selector regression.
