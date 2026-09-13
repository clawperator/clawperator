# Notifications and media sessions

## Goal and status

Deliver system notification inspection and deterministic media-session control in
Clawperator 0.11.0. An agent can discover what is playing, read its reported and
estimated position, pause/resume it, seek when supported, and inspect or act on
accessible notifications without opening the notification shade.

Status: planned; no feature implementation or live compatibility evidence yet.
Execution and PR boundaries: [work-breakdown.md](work-breakdown.md).
Release coordination: [v0.11 plan](../releases/v0.11/plan.md).

## Scope and decisions

- Reuse Android's registered notification listener and existing permission setup.
  Introduce a reliable service boundary with fresh awaitable snapshots, explicit
  connection state, timeout/cancellation, and structured failures. A disconnected
  listener or failed query must never appear as a successful empty list.
- System inspection includes ongoing notifications and group summaries by
  default. Do not route it through presentation filtering or hidden-package state.
  A read must not dismiss notifications or trigger group-summary cancellation.
- Use Android `MediaSessionManager.getActiveSessions(listenerComponent)` and
  `MediaController` for media state and controls. Notification progress extras
  are generic progress, not media timestamps. Do not use UI scraping, shell
  keyevents, or dumpsys parsing as hidden fallbacks.
- Expose CLI commands, typed Node helpers, and canonical execution actions usable
  through the existing HTTP `/execute` route. Dedicated HTTP routes are not
  required. Preserve the terminal envelope and commandId/taskId correlation.
- Keep the existing string-valued step-data wire contract. Define versioned JSON
  payloads within it and validate/decode them in typed Node helpers. Do not change
  all existing result consumers to accommodate this feature.
- Queries must bound count/text/payload size and report truncation explicitly.
  Return available structured fields, not arbitrary extras, artwork bytes,
  PendingIntents, or serialized platform tokens. Keep sensitive payloads out of
  incidental service/action debug logs; canonical result transport remains the
  intentional delivery path.

## Public surface

All commands retain normal device selection, operator package, timeout and JSON
output behavior. Canonical action names below are proposed implementation names;
keep CLI/help, Android parser, Node validation and docs consistent.

| CLI | Execution action | Behavior |
| --- | --- | --- |
| `notifications list [--app <package>]` | `list_notifications` | Fresh accessible notification snapshot |
| `media list [--app <package>]` | `list_media_sessions` | Active sessions and advertised capabilities |
| `media status --session <id>` | `get_media_status` | One session's metadata and playback evidence |
| `media pause --session <id>` | `media_pause` | Request pause |
| `media play --session <id>` | `media_play` | Request playback at current position |
| `notifications dismiss <key>` | `dismiss_notification` | Request removal of one notification |
| `notifications action <key> --action <action-id>` | `invoke_notification_action` | Invoke one advertised button |
| `media seek --session <id> --position-ms <value>` | `media_seek` | Request an absolute millisecond position |

For single-session commands, permit `--app` instead of `--session` only when it
resolves exactly one session. Require one selector; reject conflicting selectors,
blank values and ambiguity with actionable errors listing candidates. Do not
choose the first/most recent/playing session implicitly. Use a distinct
`mediaSessionId` execution parameter to avoid confusing existing recording IDs.

Session IDs are opaque, stable for a session during the Operator process lifetime,
and invalidated on session destruction or process restart. Notification keys are
system keys. Action handles include a notification revision and expire when that
notification is updated/removed or the Operator restarts. Re-resolve immediately
before invocation and fail stale references rather than choosing a new button.
Android may still race after validation; return canceled/uncertain dispatch honestly.

List notifications with key, applicationId, title/text, post time, ongoing/group
flags, clearability, optional generic progress, and action descriptors. Actions
requiring RemoteInput or authentication must be identified; text replies and
unlock/authentication flows are outside this release. Do not execute those through
an incomplete generic action invocation.

Media status includes state, title/artist when supplied, durationMs, supported
controls, reportedPositionMs, estimatedPositionMs, playbackSpeed, observation time
and position update age. Unknown values remain null with a reason, never zero.
Only extrapolate valid reported positions in explicitly advancing playback states
using device elapsed realtime and speed. Do not advance paused/buffering state;
clamp estimates to zero and known duration. Missing/invalid update timestamps
cannot establish an estimate. Label estimates as estimates, not frame accuracy.
Document that some apps, live streams, ads and remote playback expose incomplete
or app-defined timelines; a visible video need not expose a usable media session.

Controls validate advertised capabilities, report dispatch separately from
observed outcome, and never automatically replay a mutation after uncertain
transport. Default completion is dispatch receipt plus a fresh state observation;
do not claim a postcondition from the return of a void platform call. Offer a
bounded explicit wait for pause/play target state and seek target tolerance, with
requested timeout/tolerance reported in evidence. A failed wait retains the fact
that dispatch occurred. Unsupported controls and vanished sessions are errors.

## Existing implementation and owning sources

Verified against checkout `7cdb31d4`; recheck relevant behavior when implementing.

- `apps/android/shared/core/toolkit/src/main/kotlin/action/notification/`: existing
  listener, service manager and basic NotificationData. Queries populate a cache;
  posted/removed events do not maintain that cache. Current query/cancel failures
  can return silently. Reuse registration, not these unproven result semantics.
- `apps/android/shared/core/toolkit/src/main/AndroidManifest.xml`: listener service
  registration and binding permission.
- `apps/android/shared/data/toolkit/src/main/kotlin/clawperator/appnotifications/AppNotificationsManagerDefault.kt`:
  presentation filtering excludes ongoing/group notifications; initial query
  handler lacks wiring. Do not make the new inspection API depend on this cache.
  Repair only reused components; unrelated presentation cleanup is excluded.
- `apps/android/shared/app/di/src/main/kotlin/clawperator/di/module/AppModule.kt`:
  existing notification dependency wiring and new controller integration.
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/`:
  command parser, execution and correlated result transport.
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
  and `UiActionEngine.kt`: add service-backed actions; avoid incidental payload
  logging. No whole-engine rename or unrelated action redesign is needed.
- `apps/node/src/contracts/{execution,aliases,result,errors}.ts` and
  `apps/node/src/domain/executions/validateExecution.ts`: action allowlist,
  strict parameter validation, payload/error contracts and compatibility.
- `apps/node/src/cli/registry.ts`, command modules and `commands/serve.ts`:
  public entry points, help and HTTP execution parity.
- `apps/node/src/domain/device/grantPermissions.ts` and
  `apps/node/src/domain/doctor/checks/`: notification permission setup exists;
  expose actual permission/listener capability, not just a settings write.
- `docs/internal/design/node-api-design-guiding-principles.md`: public ergonomics.

Platform references to verify while implementing:
[notification listener](https://developer.android.com/reference/android/service/notification/NotificationListenerService),
[media sessions](https://developer.android.com/reference/android/media/session/MediaSessionManager),
[playback state](https://developer.android.com/reference/android/media/session/PlaybackState),
[transport controls](https://developer.android.com/reference/android/media/session/MediaController.TransportControls).
Respect OS/profile restrictions and sensitive-content redaction; access is not a
promise of every notification on every profile. No bypasses belong in this work.

## Durable documentation and exclusions

Author `docs/api/notifications.md`, `docs/api/media.md`, and
`docs/internal/design/notifications-and-media.md`; update setup, action reference,
CLI help, docs navigation/source routing and generated outputs where affected.
Use `.agents/skills/docs-author/SKILL.md` and `docs-build/SKILL.md`.
Inspect sibling runtime-skill consumers; if existing contracts require migration,
update/version affected skills in lockstep and run their smoke checks. New
app-specific media skills are not required for this platform feature.

Exclude notification history/storage, subscriptions/event streaming, snoozing,
reply composition, content-intent app launching, arbitrary custom session commands,
volume/routing controls, root/privileged permission workarounds and app-specific
playback strategies. Generic notification button invocation is in scope.

Done means both feature PR scopes are implemented, validated with matching builds,
documented and locally committed, with truthful evidence and remaining platform
limits recorded. Publication is tracked separately in the release plan.
