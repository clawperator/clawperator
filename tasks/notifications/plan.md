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
  through the existing HTTP `/execute` route and generic MCP `execute` tool.
  Dedicated HTTP routes and named MCP tools are not required. Preserve the terminal envelope and commandId/taskId correlation.
- Keep the existing string-valued step-data wire contract. Define versioned JSON
  payloads within it and validate/decode them in typed Node helpers. Do not change
  all existing result consumers to accommodate this feature.
- Queries must bound count/text/payload size and report truncation explicitly.
  Return available structured fields, not arbitrary extras, artwork bytes,
  PendingIntents, or serialized platform tokens. Keep sensitive payloads out of
  incidental service/action debug logs; canonical result transport remains the
  intentional delivery path.

## Observation without UI readiness

N1 must support executions containing only `list_notifications`,
`list_media_sessions` and `get_media_status` with the screen off or keyguard locked,
without waking the display, dismissing keyguard, closing the notification shade,
or requiring an accessible foreground window. Keep device/APK/transport and
notification-access prerequisites; an accessibility service must not be required
solely to execute these reads. Check both host preflight and Android ingress/task
execution rather than bypassing only the Node readiness call.

Classify validated canonical actions explicitly. The initial exemption applies
only when every action is one of these three reads. Mixed UI/read executions and
all other executions retain existing whole-execution interactive readiness before
agent dispatch; do not split, reorder or partially dispatch their read steps.
Existing host preflight behavior (including close_app) is not made transactional
by this change. Use a separate observation-only execution when screen-off evidence
is needed. New mutation commands retain interactive readiness in this release;
background control is not required to satisfy the observation use case.

## Readiness and diagnostic contract

Add `doctor --capability background-observation` in N1. Preserve the existing
interactive doctor behavior as the default (and accept `--capability interactive`).
Include the selected capability in structured output. Background readiness checks
host/device transport, compatible Operator, service command round-trip, notification
access and connected listener; an empty notification/session list is valid evidence
of a working query. Screen-on/keyguard/accessibility/app-window readiness are not
required checks for this capability. Report available device-state evidence without
turning it into an interactive gate. Do not return success from permission settings
alone, and do not hide transport, binding, version or access errors.

The background diagnostic must not invoke wake/Home, shade dismissal, app launch,
UI smoke, logcat clearing or automatic setup/remediation. Reject `--full`/`--fix`
with this capability before side effects; retain their default interactive behavior.
Its successful exit means background observations are available, not that UI
automation or actual playback works. Document this distinction in doctor/setup
help and docs. Default doctor's interactive failure must not veto service reads.
No CLI/helper/HTTP/MCP wrapper may add that global gate to observation-only actions.

Keep interactive readiness cache policy unchanged for existing actions, but do not
read or populate that cache to establish background readiness. Test cold, warm and
expired caches; a previous interactive success is not current device-state evidence.
Ordinary screen lock after first unlock is supported. Before first unlock after
reboot, report real unavailable prerequisites explicitly if Android prevents
service access; full Direct Boot support is outside this release. Do not confuse
`userUnlocked` (credential storage available) with an unlocked keyguard.

Existing app `OperatorRepositoryDefault.isReady` combines window readiness with a
loaded app list. It is a presentation signal, not proof of background capability;
service queries/diagnostics must work with that signal false. Existing interactive
skill orchestration retains its readiness policy; this release does not claim all
UI skills work screen-off. Consumers use the direct observation API/MCP execution.

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

Resolve a target once per single-session action and pin that exact controller/token
through dispatch, observation and any postcondition wait. An `--app` resolution
must never be rerun to follow a replacement session. If the pinned session dies,
fail with session-expired evidence even if the same package now exposes another
session. For multi-action executions, each explicit action resolves its own target;
callers needing identity across actions must reuse the discovered session ID.

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
and position update age. Preserve both the original player position-update
elapsed-realtime timestamp and the query observation elapsed-realtime timestamp,
with their clock domain explicit; never replace the former with query time.
Unknown values remain null with a reason, never zero.
Only extrapolate valid reported positions in explicitly advancing playback states
using device elapsed realtime and speed. Do not advance paused/buffering state;
clamp estimates to zero and known duration. Missing/invalid update timestamps
cannot establish an estimate. Label estimates as estimates, not frame accuracy.
Repeated fresh queries may contain unchanged, stale player reports. Advancing
estimates from a last reported PLAYING state are never evidence of actual continued
playback. Expose unchanged update timestamps/position and increasing report age;
do not turn a successful query or estimate into a playback-progress assertion.
Postcondition waits establish reported player state/position only. Actual playback
progress needs independent fixture/player evidence. PiP window persistence needs
its own visual/window assertion and is not established by media state.
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
- `apps/node/src/domain/doctor/checks/deviceInteractivity.ts`: interactive predicate,
  doctor_ping probing, automatic wake/Home attempts and eight-second success cache.
- `apps/node/src/domain/doctor/criticalChecks.ts`, `DoctorService.ts` and
  `apps/node/src/cli/commands/doctor.ts`: interactivity is currently critical,
  checks stop on the first non-pass, and report readiness controls exit status.
  Add capability selection without weakening default interactive semantics.
- `apps/node/src/cli/commands/skills.ts`: interactive skill-target preparation also
  calls the wake/readiness helper; it must not be reused for observation entry points.
- `apps/android/shared/app/app-adapter/src/main/kotlin/clawperator/state/operator/OperatorRepositoryDefault.kt`:
  app UI readiness depends on window readiness and app-list loading; keep the
  background service path independent.
- `apps/node/src/domain/executions/runExecution.ts`: currently performs interactive
  readiness before ordinary dispatch; add the explicit observation-only exemption.
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/runtime/OperatorCommandReceiver.kt`:
  currently requires accessibility and closes the notification shade before action
  parsing. Remove these dependencies/side effects for observation-only commands.
- `apps/node/src/mcp/tools/core.ts`, `tools/common.ts`, `errors.ts` and integration
  tests: generic execute delegates raw actions to canonical validation; prove new
  payload/error parity through MCP rather than assuming delegation is sufficient.
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
