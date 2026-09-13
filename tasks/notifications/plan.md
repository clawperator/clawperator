# Notifications and media: remaining N2 contract

## Status and permanent references

N1 is [DONE] locally: notification reads, media discovery/status/pause/play,
background doctor, and CLI/typed helper/HTTP/generic MCP support. Merge and release
are separate prerequisites. Completed implementation instructions have been retired.

Current behavior and evidence are owned by:

- [Notification API](../../docs/api/notifications.md)
- [Media API](../../docs/api/media.md)
- [Doctor](../../docs/api/doctor.md#background-observation-readiness)
- [Design and validation evidence](../../docs/internal/design/notifications-and-media.md)
- [Reproducible fixture](../../validation/notifications-media/README.md)

N2 remains unimplemented. Delivery stages and validation are in
[work-breakdown.md](work-breakdown.md); publication remains in the
[v0.11 release plan](../releases/v0.11/plan.md).

## N2 public surface

| CLI | Canonical action | Behavior |
| --- | --- | --- |
| `notifications dismiss <key>` | `dismiss_notification` | Request removal of one accessible notification |
| `notifications action <key> --action <action-id>` | `invoke_notification_action` | Invoke one advertised button from the same notification revision |
| `media seek --session <id> --position-ms <value>` | `media_seek` | Request an absolute millisecond position |

Keep Android parsing, strict Node validation, CLI help, typed helpers, HTTP
`/execute`, generic MCP `execute`, and public docs aligned. Dedicated HTTP routes
or named MCP tools are not required. Retain the canonical envelope and
commandId/taskId correlation, with versioned JSON inside string-valued step data.
Define the exact new parameters/errors in the implementation and public docs;
reject blanks, missing/conflicting selectors and inappropriate parameters.

All three mutations retain whole-execution interactive readiness. Only the three
existing read actions are exempt, including when accessibility is unavailable or
the screen is locked/off. Mixed lists must not partially dispatch a read prefix
when readiness fails. Do not add automatic unlock/authentication or make existing
UI commands require notification access.

## Notification dismissal and buttons

Use the listener-backed service snapshot, not presentation-filtered caches.
Check existence and clearability immediately before dismissal; distinguish
requested cancellation from observed removal. A refused cancellation cannot be
reported as confirmed deletion. Preserve permission, listener-disconnection,
query, stale-key and not-dismissible failures; no unavailable path becomes an
empty successful result.

Resolve the key and revision-scoped action handle immediately before invoking
its PendingIntent. Updates, removal, reconnect/restart and canceled PendingIntents
must fail stale references rather than select a replacement button. Android can
race after validation; record canceled or uncertain dispatch honestly.

Advertised RemoteInput and authentication requirements are explicit. Reject
unsupported input/authentication actions; text composition, replies and unlock
flows are excluded. Do not expose raw PendingIntents, arbitrary extras, platform
tokens or incidental notification-content logs. Keep results bounded and report
text/action/item truncation truthfully.

## Media seeking

Require exactly one session selector. `--app` is allowed only when it resolves
one active session; never select the first, newest or playing session implicitly.
Use mediaSessionId rather than recording sessionId. Pin the resolved controller
through dispatch and any wait. A same-package replacement cannot satisfy the
original command; separate actions resolve independently, so callers needing
identity across actions reuse the discovered handle.

Validate a finite, nonnegative integer position in milliseconds, advertised seek
support and known-duration bounds. Define behavior for unknown/zero duration
explicitly. Default completion reports dispatch plus a fresh observation; a void
platform call is not a postcondition. Provide a bounded optional position wait
with explicit tolerance and report requested timeout/tolerance in evidence.
A failed wait or execution cancellation retains dispatch evidence. Never replay
controls after uncertain transport.

Preserve original callback position/update timestamps separately from query time
and estimates. Temporary inactivity retains the same session handle and original
report, while discovery/targeting require activity. Destruction/restart invalidates
handles. Estimates, state confirmation and fresh queries do not prove actual
playback or PiP-window persistence. Validate actual effects with independent
fixture/player evidence, including ignored seeks and stale PLAYING reports.

## Implementation owners and exclusions

Extend `action/media/NotificationMediaService.kt`, the registered listener,
Android AgentCommandParser/UiAction/UiActionEngine, Node notification contracts
and typed helper, and the existing CLI registry. Preserve current setup and
capability-specific readiness; use the permanent design document for rationale.
Respect OS/profile restrictions and sensitive-content redaction.

Update docs and generated outputs in the same PR. Inspect sibling runtime-skill
consumers; version and smoke-test affected skills if an existing contract changes.
New app-specific media skills are not required.

Exclude history/storage, subscriptions, snoozing, replies, content-intent app
launching, arbitrary custom session commands, volume/routing controls, privileged
permission bypasses and app-specific playback strategies. N2 completes this
feature pack; release/version publication remains separate.
