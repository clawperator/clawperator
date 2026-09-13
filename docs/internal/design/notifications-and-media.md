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
the listener disconnected on the tested API 35 image. Older API 21-25 images may
use the legacy secure-setting grant if the shell command is absent; this fallback
still requires successful execution and is not a claim of a connected listener.

## Local validation record

Validated on 2026-09-13, based on 626a169d5cb3cb3435e65a8e525f887873954c4e,
in the N1 implementation worktree. Branch-local Node and debug Operator versions
are 0.10.1 and 0.10.1-d (1001900); the release version bump is a later release step.
The live target was an explicit Android API 35 Pixel emulator, previously unlocked.
No personal device credential was changed. Secure-lock proof used a temporary
emulator PIN, removed in cleanup, and restored accessibility afterward.

The passing callback/stale-report and locked/off series used debug APK SHA-256
b993fabc3248b4541d51ebfe96dd03b9fe910c41f09e24cd914c5dc44a453738.
The expanded control-race and locked/on-off proof also passed with debug APK
b87f81315045d7ec163a1471c61725321ed55e3f1b8c3c421c8ed4ee806b4911.
Final session-lifecycle hardening and the extended harness passed with debug APK
51d07cc7b0871614786c53d992a4f81f1d71ab4b7362a93fda104f267f876819.
The full Node suite passed 1,580 tests; the subsequently added background-doctor
regression passed with its existing suite (14 tests). Android assembly, app unit
tests, parser tests and toolkit tests passed. Docs routes and generated links passed.

| Case | Evidence and outcome |
| --- | --- |
| Actual pause/play | MediaPlayer's independently sampled actualPlaying changed false/true after explicit commands |
| Stale PLAYING report | Actual position remained 5675 ms; original callback position/time stayed fixed, report age increased during repeated queries |
| Nonsecure screen off | 13.38 seconds of repeated reads; screenOn false; screen-on event counter remained 1; independent sample count advanced 59 to 185 |
| Secure screen off | CLI reads, background doctor and MCP three-action execution succeeded; deviceLocked true and screenOn false throughout |
| Accessibility disabled | The same locked/off CLI, doctor and MCP reads succeeded with the listener connected |
| Beyond readiness-cache TTL | Repeated after nine seconds without UI operations; screen-on counter remained 2 across the locked series |
| HTTP and typed-helper parity | Live read execution and typed decoder agreed on session identity, original reported position/time and screen-off state; HTTP retained commandId/taskId |
| Generic MCP parity | Actual stdio execute dispatched all three reads; successful canonical steps and screen-off values preserved |
| Background doctor | Actual notification/media probes passed and reported screenOn=false, deviceLocked=true, userUnlocked=true |
| Unavailable listener | Returned NOTIFICATION_LISTENER_DISCONNECTED, not empty-list success, following the force-stop experiment |
| Secure screen on and relocked off | CLI, background doctor and MCP passed with accessibility disabled; screen/keyguard state retained |
| Session/control races | Two same-package sessions produced ambiguity; exact selection worked; unsupported/expired handles failed specifically; ignored pause timed out with dispatched=true; replacement during pause wait returned MEDIA_SESSION_EXPIRED with dispatched=true |
| Offline platform tests | Robolectric API 28 verifies notification snapshots, original callback preservation despite altered query values, permission errors, ambiguity and destroyed-token exclusion |
| Mixed execution policy | Automated runExecution test rejects both action orders and UI-only input before broadcast when readiness fails |

Retain raw local evidence privately. Committed examples contain no device serials,
account content or machine paths. The reproducible harness lives in
validation/notifications-media. Normal PR CI runs offline Node/Android tests;
notification-media live CI is workflow_dispatch only.

## Failed attempts and remaining acceptance

All attempts matter; a later pass does not turn an earlier failure into a pass.
Initial setup exposed a stale settings-only listener grant. Early fixture controls
needed transport flags and correct shell quoting. The first stale-report assertion
then exposed Android's query extrapolation; the callback implementation fixes that
case. A force-stop experiment disconnected both listener and accessibility; setup
was restored before later positive tests. This does not prove unattended process
restart/reconnection while locked. One screen-on baseline preceded its deliberate setup wake broadcast; the harness
now waits for the independently acknowledged transition before recording baseline
counters, and the full sequence passed afterward. One browser screenshot attempt overlapped a
Node rebuild and failed before dispatch; it was retried after build completion.

The supplied YouTube URL was opened in the browser, with successful open_uri
receipts. Hierarchy queries repeatedly returned no foreground root/windows and
screenshots showed a blank app area after browser restart. An explicit browser
launch through adb test setup also produced no accessible foreground hierarchy. Real browser video
playback is unproven. The generated MP4 fixture is independent local playback
proof, not real-browser compatibility or a second audio-player compatibility test.

N1 is not yet fully accepted. Outstanding gates include real video/audio-player
comparison, the lowest supported API image, process restart/reconnect and first
unlock behavior, open-shade preservation, comprehensive notification update/reconnection lifecycle coverage,
and remaining pre-dispatch session-race permutations. Preserve these gates in the
active task pack; do not label N1 release-ready from the passing subset above.
