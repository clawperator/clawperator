# Notifications

Read accessible active Android notifications without opening the notification
shade, waking the display or dismissing keyguard:

```sh
clawperator notifications list --app <package> --limit 25 --max-text-chars 256
clawperator doctor --capability background-observation
```

Notification access must be enabled for the selected Operator and its listener
must be connected. Operator setup grants access; unavailable access or a
connection failure returns an error, not an empty list. Android profile and
sensitive-content restrictions still apply.

`list_notifications` accepts optional `applicationId`, `limit` (1-100, default 25)
and `maxTextChars` (1-1024, default 256). Omit applicationId for all accessible apps.
Blank values, unknown parameters and invalid bounds are rejected. The same action
works through HTTP `/execute` and generic MCP `execute`.

The canonical step's `data.payload` is a JSON string with `schemaVersion: 1`,
`observedElapsedMs`, `deviceState`, `notifications`, `total` and `truncated`. Node's
`decodeNotificationMediaPayload` validates and decodes it. Notifications include
key, applicationId, nullable title/text, postTime, ongoing/clearable/group fields,
action descriptors, text/action truncation flags and nullable generic progress.
deviceState records screenOn, deviceLocked and userUnlocked at query completion.
These endpoint values alone cannot exclude a transient wake; use independent
state-transition evidence for regression tests. Ongoing notifications and group summaries are included. Results are capped at
64,000 payload bytes as well as the requested item/text limits; `truncated`
indicates omitted items. An empty list with total zero is a successful snapshot.

Action descriptors expose opaque actionId, title, requiresInput and
requiresAuthentication. These describe buttons; invocation and dismissal are
not currently available. Progress is the notification's generic value/max and
indeterminate flag, not a playback timestamp. Use [media status](media.md).

Observation-only execution lists may contain list_notifications,
list_media_sessions and get_media_status in any order. They bypass interactive
readiness and do not need accessibility or an app window. Mixed lists retain
normal whole-execution interactive readiness. Use separate read-only executions
when observing screen-off behavior. Before first unlock after reboot, platform
service availability can differ from an ordinary locked screen.

Errors include NOTIFICATION_ACCESS_DENIED, NOTIFICATION_LISTENER_DISCONNECTED,
NOTIFICATION_QUERY_FAILED and NOTIFICATION_SERVICE_UNAVAILABLE. Inspect the
failed step's errorCode; transport failures remain distinct.
