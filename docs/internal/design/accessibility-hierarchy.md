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

## Parked follow-up

Status: explicitly deferred by the user, outside the selector inspection PR.
The normal service declaration remains unchanged.

When resumed, first decide the intended service classification and supported
access path for sensitive screens. Android defines
[`isAccessibilityTool`](https://developer.android.com/reference/android/accessibilityservice/AccessibilityServiceInfo#attr_android:isAccessibilityTool)
as identifying services used to assist users with disabilities. Changing it
broadens sensitive-view access beyond this one page and is a product decision,
not a selector implementation detail. Then implement the chosen approach with
explicit-device query/XML verification, a normal-screen control, and a check of
the resulting service declaration. Do not treat retries, cache clearing, or
another window's hierarchy as a solution to the demonstrated filtering rule.
