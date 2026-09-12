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

## Supported v0.10 access

Both Operator variants now declare `android:isAccessibilityTool="true"` in the
shared service configuration. Android defines
[`isAccessibilityTool`](https://developer.android.com/reference/android/accessibilityservice/AccessibilityServiceInfo#attr_android:isAccessibilityTool)
as identifying services used to assist users with disabilities. The selected
product decision accepts broader access and distribution outside Google Play.
There is no separate opt-in or distribution variant.

Native capture reads `AccessibilityNodeInfo.isAccessibilityDataSensitive` only
on API 34+. `UiNode` retains nullable evidence, `NodeResolver` emits explicit
`accessibilityDataSensitive` nulls in schema version 1, and raw XML emits
`accessibility-data-sensitive` only when known. Failed reads and fallback nodes
remain unknown. Old APK omission is also unknown. CLI/raw/MCP preserve the
sensitivity evidence. It never changes matching or success and does not infer
private browsing, screenshot protection, or a disclosure policy. See the
[public contract](../../api/actions.md#action-query-ui).

No application-specific production logic, alternative-window substitution,
cache-clearing retry, or screenshot/OCR fallback was introduced. Existing absent
service/root failures and independent host screenshots remain intact.

## Regression and verification

The [device harness](../../../validation/sensitive-hierarchy-access/README.md)
uses branch-local CLI, raw execution, and a real named MCP call. It checks three
consecutive Internet queries, sensitive Settings root identity, Wi-Fi control
state/bounds/sensitivity against XML, a decoded screenshot, and a normal Display
& touch control screen. Loading content cannot satisfy readiness. Missing roots
fail immediately; all navigation and subprocess waits are bounded. The harness
leaves the device on Home and never changes network settings.

The manual CI workflow runs both APK variants on an API 35 Google APIs x86_64 revision-9
image with English locale. It checks the revision explicitly, verifies packaged
service metadata through the compiled resource table, runs offline assertions,
and executes the actual emulator regression. A new image requires deliberate
requalification. The shared Android test suite uses Robolectric 4.11.1 to test
the API-34 method; other suites retain their existing version.

Implementation verification uses CLI 0.10.0, development APK 0.10.0-d, and release
APK 0.10.0 on an API 35 arm64 Google image, build AE3A.240806.036/12592187.
Evidence remains outside Git. APK inspection covers AAPT's version-qualified
service resource and release path shortening, including the manifest binding.

Acceptance completed on the implementation branch:

| Check | Outcome |
| --- | --- |
| Development upgrade, then connected service | Full Internet/CLI/raw/MCP/XML/screenshot/control harness passed |
| Release variant after fresh binding | Full harness passed |
| Restored development APK after fresh binding | Full harness passed, starting from a retained Internet subpage |
| Isolated same-code APK with `isAccessibilityTool=false` | Harness failed at Internet `query_ui` with `UI_TREE_UNAVAILABLE`, `serviceAvailable=true`, `rootAvailable=false`; correlation and failed step retained |
| Screenshot with unavailable hierarchy | Independent failure PNG decoded successfully |
| Packaged declaration and manifest binding | Both intended APKs passed; false-declaration APK was rejected |
| Android build and unit tests | Both variants built; full `testDebugUnitTest` passed; final changed shared suite passed |
| Node build and standard tests | 306 tests passed |
| Focused query/MCP tests | 94 tests passed, including sensitivity transport and older-payload compatibility |
| Offline harness fixtures | Five tests passed for hierarchy/state/XML failures and old-payload handling |
| Authored docs | Full docs build and route validation passed |

The negative-control source edit was restored, both intended APKs rebuilt, and
the intended development APK reinstalled. The temporary release installation
was removed and the original development service selection restored. No network
settings were changed. These results prove local acceptance; a manually dispatched GitHub run remains
release evidence, not a check on every pull request.

The development upgrade briefly disconnected the service and then reconnected
without a manual re-enable. The release install encountered a stale/crashed
Android binding; disabling the selected service, stopping its process, and
re-enabling it restored navigation. Setup guidance describes re-enabling a
service that remains unavailable. These are observed lifecycle limits, not
permission to replay failed mutations inside capture.

The local emulator proves the Android filtering rule and capture contract. It
does not establish universal OEM/version support, a physical-device result,
Google Play eligibility, or private-browser behavior. The GitHub-hosted x86_64
job runs only through `workflow_dispatch`, by user direction to avoid slow PR
checks. It has no PR or push trigger; local validation does not claim a remote
CI result. No runtime skill consumes a strict NodeSummary schema requiring a
migration for this additive field.
