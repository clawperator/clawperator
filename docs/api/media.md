# Media sessions

```sh
clawperator media list
clawperator media status --session <id>
clawperator media pause --session <id> --wait-timeout-ms 2000
clawperator media play --session <id> --wait-timeout-ms 2000
```

Discover active Android sessions before targeting one. `--app <package>` may
replace `--session` only when it identifies exactly one session. No implicit
selection of a recent or playing app occurs. Session handles expire when their
session ends or the Operator restarts; a replacement from the same package does
not inherit the handle. Temporarily inactive sessions are omitted from discovery
and cannot be targeted (`MEDIA_SESSION_EXPIRED`). Reactivating the same Android
session restores its existing handle and retained original report. The selected
controller is pinned throughout each action.

List/status work while the display is off or keyguard locked without waking it.
Pause/play/seek retain normal interactive readiness. Notification access and a connected
listener are required. Players without active sessions cannot be controlled here.

| Action | Parameters |
| --- | --- |
| list_media_sessions | Optional applicationId, limit (1-100, default 25), maxTextChars (1-1024, default 256) |
| get_media_status | Exactly one applicationId or mediaSessionId |
| media_pause / media_play | Exactly one applicationId or mediaSessionId; optional waitTimeoutMs (0-30000, default 0) |
| media_seek | Exactly one applicationId or mediaSessionId; required positionMs; optional waitTimeoutMs and positionToleranceMs (see below) |

Use these actions through CLI, typed `runNotificationMedia`, HTTP `/execute`, or
generic MCP `execute`. Canonical `data.payload` is a JSON string with
schemaVersion 1 and deviceState (screenOn, deviceLocked, userUnlocked). Lists contain sessions/total/truncated; status contains session.
Use `decodeNotificationMediaPayload` for typed Node decoding. Session metadata
includes nullable title/artist/durationMs, state and supportedControls.

## Position evidence

`evidence` is `player_report` after a playback-state callback has arrived for the
selected session. Before that, it is `platform_query`: Android may have already
extrapolated the queried position and replaced its timestamp. In this case,
reportedPositionMs, positionUpdatedElapsedMs and positionUpdateAgeMs are null,
estimatedPositionMs contains the platform value, and positionUnknownReason is
`original_player_report_unavailable`. Repeating queries cannot manufacture an
original player report. Session discovery does not wait for a callback.

- reportedPositionMs is the player's last reported value; unknown is null.
- positionUpdatedElapsedMs preserves the player's original update timestamp.
- observedElapsedMs is the query time in Android elapsed realtime, not wall time.
- positionUpdateAgeMs exposes report age. A fresh query need not be a fresh report.
- estimatedPositionMs extrapolates a valid position using playbackSpeed in
  advancing states, bounded by zero and known duration. It does not advance paused
  or buffering reports. Invalid/missing timing or speed yields null with a reason.

An unchanged PLAYING report can keep producing advancing estimates after actual
playback stops. Neither an estimate nor a state query proves ongoing playback or
PiP-window persistence. Use independent playback/window evidence for assertions.
Live streams, ads and remote playback may have app-defined or unavailable timelines.

## Control evidence

Pause/play require the advertised control. With default waitTimeoutMs zero,
results report dispatched and targetStateObserved plus a new session observation.
The execution timeout may end a wait earlier. A positive wait requests bounded confirmation of the player's reported target
state. This establishes reported state, not independent playback progress.
MEDIA_POSTCONDITION_TIMEOUT retains dispatched=true. Expired sessions, unsupported
controls and ambiguity return MEDIA_SESSION_EXPIRED, MEDIA_ACTION_UNSUPPORTED or
MEDIA_SESSION_AMBIGUOUS. Never replay a mutation after uncertain transport.

## Seeking

```sh
clawperator media seek --session <id> --position-ms 20000 --wait-timeout-ms 2000 --position-tolerance-ms 100
```

`media_seek` requires exactly one `mediaSessionId` or `applicationId`, and
`positionMs`. Position must be a finite nonnegative integer no greater than
9007199254740991 (JavaScript's maximum safe integer). Missing, blank, fractional,
negative and unsafe positions are rejected before dispatch. Unknown parameters
and conflicting selectors are rejected on both Node and Android ingress.

The selected player must advertise seek. If durationMs is known and nonnegative,
positionMs must be no greater than it: zero duration permits only position zero.
Missing or negative duration is unknown and imposes no upper bound beyond the
safe-integer limit. The service never silently clamps the requested position.
A player can still reject or ignore a supported request.

Optional `waitTimeoutMs` is 0-30000 (default 0); optional `positionToleranceMs` is
0-60000 (default 1000). Both must be integers. With no wait the result reports
dispatch and a fresh session observation. With a positive wait, confirmation
requires a new playback-state callback after dispatch, a valid original update
time at or after dispatch and no later than observation, and a nonnegative
reported position within the absolute tolerance. A previous report, platform
query or extrapolated estimate cannot satisfy the wait. A player that reports
infrequently, rounds positions or seeks only to keyframes may need a larger
tolerance or may time out even when it moves.

The schemaVersion 1 payload contains dispatched, requestedPositionMs,
positionToleranceMs, waitTimeoutMs, targetPositionObserved, session,
observedElapsedMs and deviceState. The same parameters and payload work through
typed helpers, HTTP `/execute` and generic MCP `execute`. MEDIA_POSITION_OUT_OF_RANGE
means the requested position exceeds known duration; MEDIA_ACTION_UNSUPPORTED
means seek is not advertised. Invalid direct service values use
MEDIA_POSITION_INVALID; ingress rejects malformed parameters during validation.

MEDIA_POSTCONDITION_TIMEOUT, execution timeout/cancellation and session expiry
retain dispatched, requestedPositionMs, positionToleranceMs and waitTimeoutMs in
string-valued step evidence. A session that becomes inactive or is replaced during
a wait fails with MEDIA_SESSION_EXPIRED. The command never follows its replacement
or repeats an uncertain control. Original player reports remain separate from
estimates, including across temporary inactivity. Report confirmation is not
independent proof of actual playback; verify the player when that matters.
