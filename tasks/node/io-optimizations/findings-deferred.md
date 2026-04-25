# Snapshot I/O Optimization: Deferred Findings

Date: 2026-04-25
Scope: Structural and higher-cost work intentionally deferred from the immediate Node-side I/O optimization phase

## Summary

These items remain important for long-term snapshot performance, but they are intentionally out of scope for the immediate low-hanging-fruit Node work in `tasks/node/io-optimizations/findings.md`.

They are deferred because they require Android contract changes, transport redesign, or broader architectural planning than is appropriate for the immediate phase.

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

### D2 - Reduced attribute set in snapshot output

**What changes:**
Omit always-false or rarely-used boolean attributes from the serialized XML. Return a compact representation rather than the full AccessibilityNodeInfo dump.

**Why it matters:**
The 87KB XML contains many redundant boolean attributes (e.g., `scrollable="false"`, `long-clickable="false"`). A reduced set would shrink payload, reduce logcat line count, and lower Android serialization time.

**Why it is deferred:**
Requires Android-side changes to the serializer in `TaskScopeDefault`. Any attribute removal is a contract change that could break existing skill or agent consumers that parse specific fields.

**What it unlocks:**
Smaller payloads reduce logcat transport time and parsing cost; combined with D1, could cut Android phase to under 200ms.

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

The immediate execution brief should remain focused on:

- reducing broadcast delay
- extracting snapshot payload from the live logcat stream
- removing redundant `logcat -c` and `logcat -d`
- overlapping startup work where safe
- parallelizing cheap preflight steps
- using `serve` mode where caller context allows it

It should not absorb the Android contract changes or transport redesign work above.
