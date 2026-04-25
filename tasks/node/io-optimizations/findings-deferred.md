# Snapshot I/O Optimization: Deferred Findings

Date: 2026-04-25
Scope: Structural and higher-cost work intentionally deferred from the completed Node-side I/O optimization cleanup

## Summary

These items remain important for long-term snapshot performance, but they were intentionally out of scope for the completed Node-side I/O cleanup summarized in `tasks/node/io-optimizations/findings.md`.

They are deferred because they require Android contract changes, transport redesign, or broader architectural planning. Convert the relevant finding into a dedicated task pack before implementation.

## Deferred Implementation (Structural / High Cost)

### D1 - Android-side UI tree filtering

**What changes:**
Accept filter parameters in the `snapshot_ui` action (e.g., package name, window index, resource-id prefix, or visible/actionable-only flag). Only traverse and serialize matching nodes.

**Why it matters:**
Measured traversal: 569-630ms for 212 nodes / 87KB on a moderately complex screen. This is the absolute latency floor - no amount of Node optimization can reduce it. Filtering to a relevant subtree (e.g., foreground app only, visible nodes only) could reduce this to under 300ms on typical screens.

**Why it is deferred:**
Requires Android contract changes, a new action parameter schema, and validation of partial snapshot semantics. Breaking change risk if existing callers depend on full-tree output.

**What it unlocks:**
Sub-500ms full round trips on typical screens, even with logcat transport.

**Where to investigate first:**

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt` - `logUiTree()` calls `uiTreeInspector.getCurrentUiHierarchyDump()`, logs the hierarchy, and reports `elapsed_ms`, `node_count`, and `max_depth`.
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` - `executeSnapshotUi()` routes `snapshot_ui` through `TaskScope.logUiTree()`.
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/accessibilityservice/AccessibilityNodeInfoExtAndroid.kt` - `AccessibilityNodeInfo.buildUiTree()` and `mapToUiNode()` recursively traverse `AccessibilityNodeInfo` and map nodes.
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeFilterer.kt` and existing `filterOnScreenOnly()` call sites - useful prior art for visible-node filtering.

**Planning guidance:**

A future task pack should start by measuring the Android side directly, not by changing Node transport again. Capture at least:

- `TaskScopeDefault.logUiTree()` `elapsed_ms`, `node_count`, and `max_depth`
- hierarchy byte size
- foreground package / window count metadata already emitted by snapshot results
- timing split, if added, between root acquisition, `AccessibilityNodeInfo` traversal, filtering, hierarchy serialization, and log emission

Then propose the smallest contract that can reduce traversal or serialization cost while preserving current full-tree behavior by default. Good first candidates are an opt-in foreground-package or visible/actionable-only filter, plus tests proving unfiltered `snapshot_ui` remains unchanged.

### D2 - Reduced attribute set in snapshot output

**What changes:**
Omit always-false or rarely-used boolean attributes from the serialized XML. Return a compact representation rather than the full AccessibilityNodeInfo dump.

**Why it matters:**
The 87KB XML contains many redundant boolean attributes (e.g., `scrollable="false"`, `long-clickable="false"`). A reduced set would shrink payload, reduce logcat line count, and lower Android serialization time.

**Why it is deferred:**
Requires Android-side changes to the serializer in `TaskScopeDefault`. Any attribute removal is a contract change that could break existing skill or agent consumers that parse specific fields.

**What it unlocks:**
Smaller payloads reduce logcat transport time and parsing cost; combined with D1, could cut Android phase to under 200ms.

**Where to investigate first:**

- Start from the same Android snapshot path listed in D1.
- Compare `getCurrentUiHierarchyDump()` output against the typed `UiTree` path from `AccessibilityNodeInfo.buildUiTree()`.
- Inventory which XML attributes are used by Node, skills, docs, and common agent workflows before removing or changing any field.

**Planning guidance:**

This is a public snapshot contract change unless it is opt-in. Prefer adding an explicit reduced-output mode or new parameter over silently changing the default XML shape. A task pack should include migration notes, docs updates, and compatibility tests for consumers that expect `data.text` to contain full hierarchy XML.

### D3 - Incremental / diff snapshot mode

**What changes:**
Android operator tracks prior snapshot state and returns only nodes that changed since the last call.

**Why it matters:**
Agent loops frequently snapshot the same screen repeatedly. If only a few nodes change between calls (e.g., a counter increments, a loader spins), transmitting the full 87KB tree is wasteful.

**Why it is deferred:**
Requires stateful operator behavior, a new diff contract, and careful handling of tree structural changes (node insertion/deletion, re-parenting). High implementation complexity. Requires D1/D2 to be designed first to avoid doing it twice.

**What it unlocks:**
Near-zero marginal cost for repeated snapshots of a stable screen, enabling high-frequency agent observation loops.

### D4 - Persistent socket transport (replace broadcast/logcat)

**What changes:**
Android operator maintains a persistent socket on a local port, forwarded via `adb forward`. Node connects once and communicates via direct send/receive instead of broadcast dispatch and logcat scraping.

**Why it matters:**
The core of the current latency is the polling model: spawn logcat, wait for settle, broadcast, poll for response, dump for payload. A socket eliminates the settle delay entirely, removes per-call subprocess overhead, and enables chunked or streaming payloads without logcat line length limits.

**Why it is deferred:**
Requires coordinated Android + Node changes and a new transport contract. Cannot be done incrementally - it replaces the entire communication path. The `[Clawperator-Result]` envelope contract must be preserved or explicitly versioned. High risk, high reward - wrong sequencing blocks all other work.

**What it unlocks:**
Sub-100ms round trips (excluding Android computation), multi-Hz snapshot loops, streaming partial results, and elimination of logcat line-length constraints on payload size.

## Relationship To Immediate Work

The completed Node-side I/O cleanup already handled:

- reducing broadcast delay
- extracting snapshot payload from the live logcat stream
- removing redundant `logcat -c` and `logcat -d`
- overlapping startup work where safe
- parallelizing cheap preflight steps

Future work should not reopen those completed Node-only items unless a regression is found. The remaining findings above own Android contract changes and transport redesign work.

## Suggested Prompt For Future Task Authoring

Point a future planning agent at these files:

1. `tasks/node/io-optimizations/findings.md`
2. `tasks/node/io-optimizations/findings-deferred.md`
3. `tasks/node/handshaking/findings.md`
4. `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt`
5. `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
6. `apps/android/shared/data/uitree/src/main/kotlin/clawperator/accessibilityservice/AccessibilityNodeInfoExtAndroid.kt`
7. `docs/api/snapshot.md`
8. `apps/node/src/contracts/execution.ts`

Ask it to author a task pack for Android-side `snapshot_ui` traversal and serialization reduction. The pack should:

- keep unfiltered `snapshot_ui` behavior unchanged unless an explicit breaking-change decision is made
- define the new action parameters, if any, in Node and Android contracts
- require live-device measurement before and after implementation
- require Android unit/instrumentation coverage for filtering and serialization behavior
- require Node contract validation and docs regeneration for any public parameter or output-shape change
