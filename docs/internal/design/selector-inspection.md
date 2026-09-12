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
than zero matches. No hierarchy recovery was added. The follow-up below adds typed query failure
diagnostics; broader action diagnostics remain a separate release task. Live proof is for API 35 only; offline tests do
not establish device compatibility on other API levels.

The standard Node test command passes. An additional run of flat unit-test files
revealed 19 existing skill-test failures; all 19 names also fail against unchanged
base commit `654d333`. Their contract-result and pretty-banner issues are outside
selector inspection. The new selector and transport tests pass independently.
Existing sibling skill consumers use scalar selectors; no skill contract or
version migration was needed for these additive surfaces.


## Independent emulator revalidation, 2026-09-12

Rechecked branch commit `1727cb39` using the branch-local Node CLI and the already
installed development Operator `0.10.0-d` on the open Android 15/API 35 arm64
emulator. The installed APK was not rebuilt or reinstalled for this pass; its
version and working query support were checked, but binary identity with the
branch was not established.

| Live check | Observed result |
| --- | --- |
| Display & touch visibility | 55 eligible nodes and 63 with `visibility=all`; eligible paths exactly matched the all-query nodes with `onScreen=true`. |
| Limits and empty results | `limit=1` returned one node, retained total 55, and set `truncated=true`; a nonexistent label returned zero successfully. |
| Blank labels | A container predicate with `textEquals=""` returned 11 blank-label nodes. |
| Observation identity | Seven consecutive query captures had seven distinct snapshot IDs. |
| Platform state | Dark theme switch matched XML on bounds and all seven state fields; screenshot inspection confirmed off. |
| Relational action and refreshed state | Click selected the switch using its role plus recycler-view ancestor. Queries observed checked false, then true, then false after restoration. |
| Relational query | A list-item predicate with recycler-view ancestor and switch descendant returned exactly one row after navigation settled; a switch requiring itself as a descendant returned zero. |
| API entry points | CLI query, raw `exec` with `query_ui`, and named MCP `query_ui` over stdio all returned the switch as unchecked. MCP exposed the parsed `query` object. |
| Large result transport | Settings overview with all visibility returned all 136 nodes and 57,377 UTF-8 bytes of intact `data.query`, without truncation or malformed-envelope failure. |
| Recovery | Leaving the Internet page with `press back` restored successful queries on Network & internet (58 nodes). |

### Gaps observed before the query failure fix

1. **Visible screen without an accessible hierarchy.** Navigate through Settings,
   Network & internet, then Internet. Three consecutive queries returned canonical
   failed envelopes with `error="Task execution failed: UI tree not available"`
   and empty `stepResults`, while a screenshot showed the populated Internet page.
   XML snapshot also failed with `SNAPSHOT_HIERARCHY_UNAVAILABLE` in its error
   text. This reproduces the shared hierarchy availability limitation; the cause
   of the missing root was not established. Queries correctly did not report
   success with zero matches.
2. **Failure diagnostics lack a stable hierarchy-specific query code.** These
   query envelopes retained command/task correlation but had no `errorCode` or
   failed query step. Named MCP reported generic `EXECUTION_FAILED`. The existing
   R6 action-result diagnostics work should preserve a failed-step identity and
   expose service/root/window evidence with a stable code, so callers need not
   classify human-readable error text.
3. **A fresh query is not a navigation-readiness check.** An immediate relational
   row query after a successful click into Display & touch returned zero. The
   same selector later returned one on the settled page. Callers needing a target
   after navigation must wait for readiness or make a bounded re-query; a single
   zero count only describes that capture. No automatic settling was proven.

The emulator was left on Display & touch with Dark theme restored to off. Local
raw JSON, XML, and screenshot evidence was retained outside the repository;
private device identifiers and host paths are intentionally absent from this
report. The host also emitted advisory log-write permission warnings while
queries succeeded; this was a local filesystem restriction, not a query failure.

This pass did not live-test the 256 KiB overflow boundary, unavailable-state nulls,
transport corruption or missing chunks, other Android versions, physical devices,
or other apps. Those behaviors remain covered only by the previously recorded
offline tests where applicable. This independent verification preceded the runtime fix described below.


## Query failure follow-up, 2026-09-12

Rebuilt and installed the development APK from the updated branch. Internet
settings still returned no active accessibility root while Android window
metadata identified an active, focused application window and screenshot capture
showed the populated page. The platform cause remains unproven. Selecting another
window would not establish that the returned hierarchy belongs to that screen,
so this change does not add window fallback or automatic retries.

A missing query tree now raises a typed failure. The engine preserves completed
steps, adds the failed query step, and stops before subsequent actions. The
canonical envelope carries `UI_TREE_UNAVAILABLE`; failed-step data contains the
same `errorCode`, human-readable `error`, and string-encoded `diagnostics` JSON.
Service and window evidence is collected without requiring a root. Unknown
values remain null. Cancellation still propagates, and existing non-throwing
failed-step sequence policy is unchanged. General action exception handling,
wait failures, and other R6 diagnostics remain separate work.

Live verification through the CLI and named MCP returned the same failed
query identity and stable code, with `serviceAvailable=true`,
`rootAvailable=false`, `windowCount=2`, and `foregroundPackage=null`. A raw
three-step execution retained a completed sleep and failed query, omitted the
later query, and preserved command/task correlation. Screenshot capture still
succeeded. These diagnostics fix the generic failure report; they do not make
the Internet hierarchy accessible.

After returning to Settings, clicked Display & touch, then used a bounded
`wait` with a `listitem` predicate, recycler-view ancestor, and switch descendant.
The following query with that same selector returned one row. This verifies the
supported navigation-readiness workflow. Queries remain single observations,
including when a destination is still loading; no implicit settling was added.
CLI help, MCP descriptions, and public action documentation now state this.

Validation: Android debug build and full debug unit tests passed (402 tests,
zero failures/errors, four existing skips). Node build and the standard suite
passed (306 tests), along with 53 focused query, transport, and MCP helper tests.
Regression tests cover retained steps, stopped sequences, canonical failure
serialization, cancellation, absent service, and unknown versus zero windows.
Live coverage is limited to the Android 15 emulator. The device was returned to
Display & touch; no setting values were changed during this follow-up.
