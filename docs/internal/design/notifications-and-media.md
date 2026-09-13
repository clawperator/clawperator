# Notification and media observation

N1 introduces notification listing, media session listing/status, explicit play
and pause, and the `background-observation` doctor capability. N2 notification
mutations and seeking remain pending. Public contracts live in
[notifications](../../api/notifications.md) and [media](../../api/media.md).

## Service boundary and readiness

Node validates the entire execution before classifying it. Only a nonempty list
containing exclusively list_notifications, list_media_sessions and
get_media_status bypasses interactive readiness. Android parses and makes the
same classification before accessibility lookup and notification-shade closing.
Mixed lists retain whole-execution readiness in either order. A failed readiness
check must not dispatch a read prefix. Existing UI-only behavior remains in place.

Background doctor checks the host, selected device, installed Operator/version,
and actual listener-backed notification/media queries. It does not run doctor_ping,
clear logcat, launch an app, remediate permissions or invoke interactive readiness.
Default doctor remains interactive. Background --full/--fix is rejected before
checks. This capability does not promise Direct Boot, disconnected-adb, arbitrary
Doze or OEM process-policy support.

Notification snapshots use the connected listener's activeNotifications, including
ongoing/group entries; the presentation manager's historical cache is not reused.
Listener access denial and disconnection are distinct errors. Notification action
handles are revision-scoped descriptors only. No content is logged outside the
canonical result transport by the changed Android execution path.

Media handles map Android tokens to controllers for the lifetime of this Operator
process. Each selected controller is pinned through dispatch and postcondition
waiting. A replacement never satisfies an old command. Dispatch and reported-state
confirmation are separate, including timeout/cancellation evidence. Commands are
not replayed to recover a missing receipt.

## Original reports versus platform estimates

Live regression testing uncovered an important platform behavior:
[Android MediaSessionRecord](https://android.googlesource.com/platform/frameworks/base/+/dfd7091ae8cb/services/core/java/com/android/server/media/MediaSessionRecord.java)
extrapolates positions in getPlaybackState and rewrites the update timestamp.
Its playback-state callback delivers the stored player state instead.

Therefore the service retains onPlaybackStateChanged values and original timing.
Until the first callback, evidence is platform_query, original reported position
and update time are unknown, and the platform position is only an estimate. Once
a callback arrives, evidence is player_report. Fresh observations do not alter
its original update time. Neither callback state nor estimated progress proves
actual playback. Controlled player samples provide independent evidence.

Notification provisioning uses NotificationManager's allow_listener shell command,
even if secure settings already list the component. A settings-only grant left
the listener disconnected on the tested API 35 image. Older API 21-26 images may
use the legacy secure-setting grant if the shell command is absent; this fallback
still requires successful execution and is not a claim of a connected listener.

## Local validation record

Validated on 2026-09-13 from the N1 branch based on
626a169d5cb3cb3435e65a8e525f887873954c4e, including implementation commit 3c7d88f2
and permission/first-unlock hardening commit d1d7b1cc. Branch-local versions
remain 0.10.1 and 0.10.1-d (1001900); release versioning belongs to V1.
The final live target was the explicitly selected API 36 emulator. Earlier
locked/off and control proofs also passed on API 35. Temporary emulator PINs were
removed and accessibility settings restored; no personal credential was changed.

Final debug Operator SHA-256:
`f06c0a3b7a99ff4ebc5c8013394c1302c748144162daa18d2ff6c8e41523bf69`.
Independent fixture APK SHA-256:
`0af5c8282c3dfef05ddaa14f7bef3d1ea82d928071d7b71718c3901aa11d23bc`.
The standalone fixture survives Operator process death and records actual player
position, screen/keyguard state, power-event counters and control dispatch counts.

| Case | Evidence and outcome |
| --- | --- |
| Real video | The supplied YouTube video played in Chrome after unmuting. Pause/play confirmed player state. Paused API position 108676 ms matched visible elapsed time 1:48; duration was 205861 ms. |
| Real audio | Native browser audio played a generated 120-second WAV. Paused API position 36199 ms matched HTMLAudioElement.currentTime 36.14 seconds; resume showed 36.61 seconds and paused=false. Both real-player modes used Chrome; this is not a claim about every third-party player. |
| Actual fixture pause/play | Independent actualPlaying changed false/true. Already-paused requests returned dispatched=true and targetStateObserved=true with exactly one additional callback. |
| Position states | Live 1x/2x playback progressed; buffering estimates remained fixed; invalid position/update time stayed unknown. Offline math tests cover duration clamps, negative/nonfinite speed and invalid monotonic time. Wall-clock time is not an input. |
| Stale report, stalled player | Original callback position/time stayed fixed and report age increased while independent actual position stalled. |
| Stale report, moving player | Actual playback resumed without new reports; the original report timestamp remained unchanged. Missing updates alone do not prove a stall. |
| Locked/off matrix | All three reads, background doctor and generic MCP passed for nonsecure off, secure on/off, expired cache and relocked states. Independent sample counts advanced without power-transition counters changing during observation. |
| Accessibility unavailable | Clearing the enabled-service list actually unbound accessibility. Locked/off reads and background doctor still succeeded. |
| Open shade | SystemUI mExpandedVisible remained true before/after CLI reads and direct read ingress, without acquiring an accessibility hierarchy. |
| Mixed/UI ingress | With accessibility unbound, direct Android mixed lists in both orders and UI-only input returned SERVICE_UNAVAILABLE with no steps. Host regression tests reject both orders before broadcasting when readiness fails. |
| Notification lifecycle | Existing/ongoing/group notifications, progress, post/update/removal, revision changes, empty results, filtering and bounded/truncated results passed. |
| Permission and reconnection | Revocation returned NOTIFICATION_ACCESS_DENIED through CLI and MCP. Regrant restored existing notifications. Killing only the Operator while locked/off recovered the listener without opening the app; old session handles expired. |
| Before first unlock | After a controlled reboot, CLI reads, background doctor and MCP returned DEVICE_USER_NOT_UNLOCKED. Android user state remained RUNNING_LOCKED until explicit test cleanup. |
| Transport parity | Live HTTP /execute and typed decoding preserved report values and command/task correlation; generic MCP preserved successful read payloads and permission/expired-session errors. |
| Session/control races | Same-package sessions were ambiguous; exact selection worked. Ignored pause timed out with dispatched=true. Replacement during the wait failed with MEDIA_SESSION_EXPIRED. Offline tests pin a resolved session across destruction before dispatch and after dispatch, excluding the replacement. |
| Offline platform coverage | Robolectric API 21 and 28 cover snapshots, callback preservation, permission denial/disconnection, destroyed-token exclusion and pinned-session guards. |

Final validation passed all 1,583 Node tests, the full Android unitTest aggregate,
Operator/fixture debug assembly, and documentation generation with 34 navigation
pages, 399 generated-doc links and no organization warnings.

Raw local evidence is private; committed examples exclude serials, account content
and machine paths. Reproduction is in validation/notifications-media. Offline
checks run in normal CI; the live workflow is manual only.

## Corrections and compatibility limits

Testing exposed and fixed a settings-only permission grant, platform query
extrapolation, and stale permission settings after revocation. API 27+ now uses
NotificationManager.isNotificationListenerAccessGranted rather than trusting the
saved setting. Earlier APIs retain their compatible setting-based check.
A first-unlock guard uses read-only Android user-state probes; unsupported probes
leave runtime errors authoritative. It never wakes or unlocks the device.

Initial browser attempts on API 35 rendered blank; the supplied video and native
audio were successfully verified on the selected API 36 emulator. The initial
accessibility-off harness changed only the global switch, which did not reliably
unbind services; the final harness clears and restores the enabled-service list.
An initial shade setup raced keyguard dismissal; setup now settles before opening
the shade. These failed attempts are not counted as passing evidence.

Live platform coverage is API 35/36, with API 21/28 service behavior tested offline.
No live API 21 listener-binding claim is made. Old-image/OEM compatibility and
arbitrary Doze/process restrictions remain limits to consider during release
verification. Direct Boot service operation is not supported. N2 notification
mutations/seeking and downstream PiP-window assertions remain separate work.

The PR review also verified that API 24-26 may return
`No shell command implementation.` with exit status zero. Provisioning recognizes
that response and uses the legacy grant through API 26; API 27+ missing-command
responses remain failures. Regression tests cover both behaviors.

The independent PR review also found unreported button-label truncation and
unsynchronized listener state on API 21-23. Button labels now contribute to
textTruncated. Revision handles use ConcurrentHashMap and the connection fields
are volatile; compiled Kotlin uses API-21-compatible putIfAbsent. New offline
regressions cover truncation and concurrent revision reads. The reviewer confirmed
all findings resolved with no new issues. Post-fix validation passed 20 focused
Node tests, toolkit/operator Android tests and debug assembly, plus the complete
locked/off lifecycle/control harness on the final API 36 APK above.
