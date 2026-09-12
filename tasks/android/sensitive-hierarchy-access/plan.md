# Restore access to sensitive native UI hierarchies

## Goal and release requirement

Enable `android:isAccessibilityTool="true"` in both shipped Operator variants
and expose Android-reported per-node sensitivity. This lets the canonical
Clawperator API inspect the native Settings > Network & internet > Internet
screen on Android 15. Both structured queries and XML snapshots must return the
actual application hierarchy. Better diagnostics alone do not satisfy this task.

This is **R10, required for v0.10**. The user has superseded the earlier parked
status. Do not release v0.10 with this task unresolved unless the user explicitly
changes the release requirement.

## Status and dependencies

One implementation PR, one phase; not started. Base on merged R4 (`8cab7adb`,
PR #273), which supplies query support and typed hierarchy failures. No dependency
on R5-R9; coordinate any shared diagnostics changes with R6 without absorbing it.
This pack authorizes its scoped implementation when selected, not release
publication or unrelated accessibility changes.

## Established cause and selected approach

[Durable investigation](../../../docs/internal/design/accessibility-hierarchy.md)
records a controlled Android 15 experiment: the application root is marked
`isAccessibilityDataSensitive=true`. With the current service declaration,
`isAccessibilityTool=false`, Android filters out that root. Direct window access
and cache clearing do not restore it. A temporary `isAccessibilityTool=true`
build returned 67 nodes and valid XML; restoring the original declaration
restored the failure. The global 0.9.5 CLI behaved the same with those APKs.
The declaration predates R4; an old release APK was not tested.

Selected approach: enable `android:isAccessibilityTool="true"` in development
and release APKs. The user accepts broader sensitive-view access and states that
the APK will not be distributed through Google Play. This resolves the earlier
access-path decision; no additional classification approval is required for this
scoped implementation. Document Android's definition and the actual broader
access without introducing distribution variants or another decision gate.

## Sensitivity reporting contract

Add `accessibilityDataSensitive: boolean | null` to each query `NodeSummary`.
Read Android's `AccessibilityNodeInfo.isAccessibilityDataSensitive()` on API 34+
at capture time; preserve that evidence through the tree model and resolver.

| Value | Meaning |
| --- | --- |
| `true` | Android reports this node's accessibility data as sensitive. |
| `false` | Android reports this node's accessibility data as not sensitive. |
| `null` | The platform API is unavailable (below API 34), the node is a fallback, or its value could not be obtained. |

The field is emitted in new query payloads, with explicit null for unknown. It is
an additive extension of `schemaVersion: 1`; old APK payloads may omit the field,
which consumers must treat as unknown, never false. CLI/raw/MCP must expose the
same evidence without inventing values. The flag describes each returned node,
not every node on the screen or the entire command. Do not infer it from the
service declaration, node text, a missing root, package identity, or other nodes.
A sensitive root is visible through an unfiltered query, not implicitly included
in every filtered result.

XML adds `accessibility-data-sensitive="true"` or `"false"` to each node when
known, omitting the attribute when unknown. Preserve raw hierarchy structure and
all other attributes. If compact snapshot work has merged, preserve this state
in its projection and document whether it is omitted when unknown. Keep query
and XML capture times independent; compare stable fixture nodes for parity.

This is metadata only: sensitive nodes remain successful results, with no new
opt-in flag, redaction, selector predicate, automatic refusal, or logging/export
policy change. A false value is not a claim that content is safe to store/share.

Do not introduce `privateMode`, `incognito`, or generic `sensitive` verdicts.
Android's accessibility-data flag does not establish browser history/cookie
behavior, screenshot protection, password status, or correctness of private
mode. Browser-specific tests may assert this flag when that is their documented
expectation, but must separately verify private-mode indicators and behavior.

## Scope and invariants

- Implement the selected declaration for the shipped Operator variants, with any
  required setup/migration guidance. Test the upgrade path as well as a fresh
  service connection; a source-only flag edit is not proof of runtime behavior.
- Preserve CLI/raw/MCP query parity, raw XML, node state and relationships,
  canonical command/task correlation, and truthful failure when access really
  is unavailable. Keep screenshot capture working independently.
- Never substitute a status-bar or unrelated window hierarchy, hardcode Settings
  package behavior, return zero matches for an inaccessible root, or use hidden
  retries/OCR as a substitute for the required native hierarchy.
- Exclude strict-selector work, general action receipts, other release packs,
  and promising universal access to every app or Android version.

## Source ownership

| Source | Why it matters |
| --- | --- |
| `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml` | Current service declaration and demonstrated configuration difference |
| `apps/android/app/src/main/AndroidManifest.xml` | Service metadata binding |
| `apps/android/app/app.gradle.kts` | Development/release variants and packaging |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeInspectorAndroid.kt` | Shared query/XML active-root capture and missing-root evidence |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` | Query capture and matching |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt` | XML capture failure behavior |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt` | Service connection/lifecycle behavior |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/accessibilityservice/AccessibilityNodeInfoExtAndroid.kt` | Native capture and XML attributes; guard API-34 access |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiNode.kt` | Preserve optional per-node sensitivity without collapsing unknown to false |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/NodeResolver.kt` | Query NodeSummary serialization and fallback state |
| `apps/node/src/contracts/selectors.ts` | NodeSummary contract and compatibility with older APK payloads |
| `apps/node/src/mcp/tools/named.ts` | Parsed query output and metadata parity |
| `apps/android/shared/test/src/test/kotlin/clawperator/uitree/UiTreeInspectorAndroidTest.kt` | Existing hierarchy diagnostics tests |

## Durable outputs and completion

Update `docs/internal/design/accessibility-hierarchy.md` with the selected
approach, rationale, reproduced results, and remaining limits. Update `docs/setup.md`
and public action, selector, MCP, and error documentation where installation
requirements or observed behavior change. Document sensitivity values, API-level
availability, old-APK omission, and the distinction from private-mode verification. Use `.agents/skills/docs-author/SKILL.md` and `docs-build`.

Done means the supported implementation, regression coverage, live acceptance
from the work breakdown, repaired in-scope failures, docs/status updates, and
validated local commits are complete. The committed, CI-wired Android 15 Internet
screen regression in the work breakdown is mandatory; manual captures alone do
not satisfy it. Missing sensitivity reporting or required
live proof remains a v0.10 blocker, not a completed task.
