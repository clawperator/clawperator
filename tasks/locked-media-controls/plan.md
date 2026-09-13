# N3: media controls while locked or screen off

## Goal and status

[TODO] Deliver one dedicated N3 feature PR after N2. Allow media_pause,
media_play and media_seek through the canonical execution path while the device
is locked, screen off, or accessibility is unavailable, without waking or
unlocking it. This is a 0.11 release prerequisite in the
[release plan](../releases/v0.11/plan.md).

N2 remains a separately completed feature batch. Its implementation in bf85701e
and cleanup in 54637f54 deliberately retained interactive readiness for all
mutations. This pack documents the next change; it does not implement N3 or
assert that either feature PR has merged. Execution and validation details belong
in [work-breakdown.md](work-breakdown.md).

The motivating physical-device test opened the requested video in the YouTube
app and started playback, but both locked pause/play commands failed before
media dispatch with DEVICE_NOT_INTERACTIVE. Background observations worked and
audio continued. The [permanent finding](../../docs/internal/design/notifications-and-media.md#physical-youtube-locked-control-limitation)
separates reported state, independent evidence and sampling limits.

## Required readiness contract

Classify only after validating the entire execution. A nonempty execution
containing exclusively any combination of these actions may use the non-waking
service path:

- list_notifications, list_media_sessions, get_media_status
- media_pause, media_play, media_seek

This includes single controls, multiple controls and mixed read/control lists.
It must not depend on an interactive readiness cache being warm. Do not describe
mutations as observation-only merely to reuse the existing helper name; preserve
read-only semantics wherever another caller relies on them.

Any execution containing dismiss_notification, invoke_notification_action or a
UI/other action retains existing whole-execution interactive readiness. A failed
readiness check must prevent dispatch of every prefix, regardless of order. Do
not split mixed executions or silently execute their eligible prefix. Preserve
existing UI-only behavior, including its current readiness handling.

The eligible service path must not call interactive doctor_ping, obtain an
accessibility hierarchy, close the shade, send wake/home/input commands, launch
an app, unlock/authenticate, or remediate settings. Background doctor remains
observation-only; it must never exercise a media mutation. Keep its existing
capability name, exits and lack of remediation. Preserve the first-user-unlock
boundary after reboot: locked keyguard after first unlock is supported, Direct
Boot service operation is not. Notification access, connected listener and
platform/profile restrictions remain authoritative; no unavailable path becomes
an empty success.

## Control and evidence invariants

Retain CLI/typed helper/HTTP /execute/generic MCP execute parity and the canonical
[Clawperator-Result] envelope with commandId/taskId correlation. Dedicated new
routes or named MCP tools are unnecessary. This changes readiness, not the N2
position, selector, duration or tolerance contracts.

Resolve exactly one session and pin its controller through dispatch and waits.
A same-package replacement or temporary inactivity cannot satisfy an in-flight
command. Separate commands that need identity continuity must reuse the original
mediaSessionId. Never replay a control to recover an uncertain transport receipt.
Retain dispatch evidence on failed confirmation, execution timeout/cancellation,
permission loss or expiry. Keep original player callbacks and timestamps separate
from query time and estimates, including across inactivity/reactivation.

A successful platform call proves dispatch only. Player state and position
confirmation are reports, not independent proof of actual effects. Neither
advancing estimates nor an unchanged PLAYING callback establishes real playback.
A resume attempt after a rejected pause does not prove a pause/resume cycle.

## Scope and stop boundary

Include Android, Node, automatic offline tests, explicit/manual live fixture
coverage, public help/docs, permanent sanitized evidence and task status/cleanup
in the same N3 PR. Inspect sibling runtime-skill consumers; update and version
only affected existing skills if a contract change requires it.

Exclude locked notification dismissal/buttons, replies, authentication flows,
new app-specific skills, arbitrary media commands, PiP-window guarantees,
transport redesign and V1-V3 release execution. No version bump, package
publication, push, PR creation or merge is authorized by this planning request.
A later instruction to implement N3 authorizes its scoped implementation,
validation, in-scope repairs, documentation, cleanup and local commits; remote
operations still require explicit authorization.

N3 depends on N2's seek/service contracts. Start its dedicated branch from the
merged N2 base, or stack explicitly on N2's committed branch if implementation
is requested while N2 review is pending. N2 must merge before N3 merges; do not
fold N3 implementation into the N2 PR. N3 must merge before V1 release readiness
is considered complete. Live API 21 compatibility remains an explicit V1 gate;
N3 tests on other platforms cannot waive it. No unresolved product decision is
needed to begin N3.
