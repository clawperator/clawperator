# Accessibility hierarchy availability

Queries and XML snapshots obtain their hierarchy from the Operator accessibility
service. A visible screenshot does not guarantee an accessible root. A missing
root must remain a failure, not a zero-match result or another window's tree.
See [query failure behavior](../../api/actions.md#action-query-ui).

## Confirmed sensitive-root filtering

On the Android 15/API 35 emulator, Settings > Network & internet > Internet is a
native `NetworkProviderSettings` preference/RecyclerView screen inside
`SubSettings`. Its root reports `isAccessibilityDataSensitive=true`.

A controlled diagnostic build established the cause:

| Service declaration | Observation on the same Internet screen |
| --- | --- |
| Normal `isAccessibilityTool=false` | Active root and active/focused window root are null; the status-bar root remains readable. Clearing the accessibility cache does not help. |
| Temporary `isAccessibilityTool=true` | Query returns 67 nodes; XML succeeds through both branch-local CLI and global CLI 0.9.5. Instrumentation confirms the root is sensitive. |
| Original declaration restored | Query and global-CLI XML failure return. |

Android 15's [AccessibilityInteractionController](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/core/java/android/view/AccessibilityInteractionController.java)
returns null from `getRootView()` when the root is sensitive and the request is
not from an accessibility tool. This explains the observed failure before any
Clawperator matching or serialization. The experiment did not establish which
Settings code or resource marks the root sensitive.

The service configuration is identical to `v0.9.5`, and root acquisition predates
structured queries. This is an existing coverage gap, not evidence of a selector
regression. An old release APK was not installed, so the experiment is not a
full old-binary comparison. All temporary instrumentation and configuration were
removed; the normal development APK was restored. Evidence is limited to API 35.

## Required v0.10 follow-up

Status: required for v0.10 by user direction; the earlier deferral is superseded.
Implementation remains separate from selector inspection. The normal service
declaration is unchanged until the supported approach is implemented.

The selected v0.10 approach is to enable `android:isAccessibilityTool="true"` in
both Operator variants. The user accepts broader access and states the APK will
not be distributed through Google Play. Android defines
[`isAccessibilityTool`](https://developer.android.com/reference/android/accessibilityservice/AccessibilityServiceInfo#attr_android:isAccessibilityTool)
as identifying services used to assist users with disabilities. The declaration
change is planned, not yet implemented in the normal APK.

The same work will expose per-node `accessibilityDataSensitive` in structured
queries and `accessibility-data-sensitive` in XML, based on Android's API-34+
node flag. Unknown values must remain unknown, including on older Android or
older APKs. This reports platform evidence, not a private-browsing verdict or a
claim that content is safe to disclose. Browser-mode correctness needs separate
application-specific evidence. No automatic redaction or refusal is implied.

Implementation must verify both variants, upgrades, query/XML metadata parity,
a normal-screen control, and genuine failure behavior. Retries, cache clearing,
and another window's hierarchy do not solve the demonstrated filtering rule.
