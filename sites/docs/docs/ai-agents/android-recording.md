# Android Recording Format for Agents

This page describes the current Android recording output that Clawperator can
produce on device.

Use it for:

- understanding what a raw recording contains
- deciding how an agent should consume a pulled recording
- knowing which fields are reliable and which are best-effort
- understanding current proof-of-concept limits before building replay or
  skill-authoring workflows on top

This page intentionally focuses on the recording data itself. It does not
document a public host-side retrieval API because that surface is still in
progress.

For the exact `hierarchy_xml` snapshot structure used inside `snapshot`
fields, see [Clawperator Snapshot Format](../reference/snapshot-format.md).

Recordings are started and stopped by dispatching `start_recording` and
`stop_recording` action types through `clawperator execute`.

## Current status

The current proof of concept can record usable interaction traces for
non-system-navigation flows.

What is working today:

- `window_change`
- `click`
- `scroll`
- `text_change`
- synchronous snapshot capture for step-candidate accessibility events

What is intentionally deferred:

- normalized Back / Home / Recents semantics
- reliable `press_key` `key: "back"` capture as a required contract
- any parser behavior that depends on system-gesture inference

System navigation evidence may still appear in raw recordings, but agents
should not currently assume those events are normalized or portable across
devices.

## Recording file shape

Android recordings are newline-delimited JSON.

- line 1 is always a `recording_header`
- all following lines are individual event records
- `seq` is the authoritative ordering field
- `ts` is wall-clock event time in epoch milliseconds

Example:

```json
{"type":"recording_header","schemaVersion":1,"sessionId":"demo-001","startedAt":1710000000000,"operatorPackage":"com.clawperator.operator.dev"}
{"ts":1710000000000,"seq":0,"type":"window_change","packageName":"com.android.settings","className":"com.android.settings.Settings","title":"Settings","snapshot":"<hierarchy .../>"}
{"ts":1710000000800,"seq":1,"type":"click","packageName":"com.android.settings","resourceId":"com.android.settings:id/dashboard_tile","text":"Display","contentDesc":null,"bounds":{"left":0,"top":400,"right":1080,"bottom":560},"snapshot":"<hierarchy .../>"}
{"ts":1710000002100,"seq":2,"type":"scroll","packageName":"com.android.settings","resourceId":null,"scrollX":0,"scrollY":420,"maxScrollX":0,"maxScrollY":2800,"snapshot":null}
{"ts":1710000002600,"seq":3,"type":"text_change","packageName":"com.google.android.youtube","resourceId":null,"text":"linkin park waiting for the end emily","snapshot":null}
```

## Header record

The first line identifies the file and schema.

Fields:

- `type`: always `recording_header`
- `schemaVersion`: file schema version
- `sessionId`: session identifier chosen or generated when recording started
- `startedAt`: epoch milliseconds for session start
- `operatorPackage`: package that produced the recording

Agents should use the header to:

- reject unsupported schema versions
- correlate the file to a session identifier
- understand whether the file came from the debug or release operator variant

## Event types

The current recording runtime emits these event categories.

### `window_change`

Represents screen or window transitions.

Common fields:

- `packageName`
- `className`
- `title`
- `snapshot`

Use this event when an agent needs to understand:

- which app or screen came to the foreground
- what transition happened before a later click or text entry

### `click`

Represents a tap-like activation on a UI element.

Common fields:

- `packageName`
- `resourceId`
- `text`
- `contentDesc`
- `bounds`
- `snapshot`

This is usually the most useful action record for replay-style reasoning.

### `scroll`

Represents a view scroll event.

Common fields:

- `packageName`
- `resourceId`
- `scrollX`
- `scrollY`
- `maxScrollX`
- `maxScrollY`
- `snapshot: null`

Scroll is captured because it is meaningful context, but it is intentionally
cheap. It does not carry a tree snapshot.

### `text_change`

Represents text changing inside an editable control.

Common fields:

- `packageName`
- `resourceId`
- `text`
- `snapshot: null`

Important: the emitted `text` value is the whole visible text state after that
change, not just the last character.

## Snapshot semantics

Snapshots are present on step-candidate accessibility events:

- `window_change`
- `click`

Snapshots are intentionally `null` on high-rate events:

- `scroll`
- `text_change`

The current implementation uses synchronous capture on the accessibility event
thread for step-candidate events. That improves snapshot correctness relative
to an async design, but it does not make snapshots perfect.

Agents should treat `snapshot` as:

- best-effort context about what was visible around the interaction
- useful for understanding the target element and nearby UI
- not guaranteed to be an exact pre-interaction ground truth frame

The authoritative basis for a new action is still the live snapshot from the
current device state.

## How agents should use recordings

The right mental model is:

- recordings are context, not executable scripts
- raw event fields are hints, not guaranteed selectors
- live device state still decides what to do next

Recommended usage pattern:

1. Read the recording in `seq` order.
2. Use `window_change` and `click` events to understand the intended path.
3. Treat `snapshot` as supporting context for what the user likely saw.
4. Derive the actual next selector from the current device snapshot, not from
   recorded fields alone.
5. Use `scroll` and `text_change` as behavioral context rather than assuming
   they are directly replayable in a one-to-one way.

## Field reliability guidance

Some fields are much more stable than others.

Usually helpful:

- `seq`
- `type`
- `packageName`
- `snapshot` when present
- `text` on visible user-facing controls
- `bounds` as spatial context

Frequently missing or unstable:

- `resourceId` on many third-party apps
- `contentDesc` on many controls
- `title` on some window transitions
- `resourceId` on `text_change`

Agents should prefer:

1. live current snapshot
2. package and nearby UI context
3. visible text and content description
4. resource IDs when they exist and appear stable
5. recorded bounds only as supporting evidence

## Real text-input example

On a physical Samsung device, a manual YouTube search recording captured a
useful text-input sequence:

- manual character entry emitted repeated `text_change` events
- autocomplete selection emitted a normal `click`
- more manual typing after autocomplete emitted more `text_change` events

Excerpt:

```json
{"seq":17,"type":"text_change","packageName":"com.google.android.youtube","resourceId":null,"text":"l","snapshot":null}
{"seq":18,"type":"text_change","packageName":"com.google.android.youtube","resourceId":null,"text":"li","snapshot":null}
{"seq":19,"type":"text_change","packageName":"com.google.android.youtube","resourceId":null,"text":"lin","snapshot":null}
{"seq":28,"type":"text_change","packageName":"com.google.android.youtube","resourceId":null,"text":"linking park","snapshot":null}
{"seq":37,"type":"click","packageName":"com.google.android.youtube","resourceId":"com.google.android.youtube:id/edit_suggestion","text":"Edit suggestion linkin park waiting for the end","contentDesc":"Edit suggestion linkin park waiting for the end","snapshot":"<hierarchy .../>"}
{"seq":38,"type":"text_change","packageName":"com.google.android.youtube","resourceId":null,"text":"linkin park waiting for the end e","snapshot":null}
{"seq":42,"type":"text_change","packageName":"com.google.android.youtube","resourceId":null,"text":"linkin park waiting for the end emily","snapshot":null}
```

What this means for agent design:

- text entry is more tractable than system-navigation normalization in the
  current proof of concept
- autocomplete is visible as a click target, not a hidden IME-only effect
- `text_change` may have `resourceId: null`, so surrounding UI context matters
  more than the event alone

## Current gotchas

### System navigation is not normalized yet

Back / Home / Recents behavior is device- and navigation-mode-dependent in
current recordings.

Do not assume:

- a Back action will appear as `press_key`
- a Home gesture has one universal raw shape
- system UI events are portable across Samsung, emulator, and future devices

### `text_change` may be underspecified

Text changes can be useful even when they lack `resourceId`, but that means
the event alone may not identify the correct field to target later.

### Scroll and text events do not carry snapshots

That is intentional. High-rate event categories stay cheap by omitting tree
capture.

### Recordings are lossy

They preserve identifiable interaction moments, not full human intent or every
intermediate visual state.

Agents should expect:

- missing timing nuance
- missing IME-specific details
- occasional nulls
- OEM-specific variation

## What recordings are good for right now

The current recording format is already useful for:

- understanding a user-demonstrated navigation path
- turning a demonstrated flow into agent context
- grounding replay attempts in actual observed UI state
- bootstrapping skill authoring for stable non-system-navigation flows

It is not yet the right contract to assume for:

- normalized system gesture replay
- device-portable Back / Home / Recents semantics
- one-to-one deterministic playback with no live state verification

## Related pages

- [Clawperator Snapshot Format](../reference/snapshot-format.md)
- [Navigation Patterns for Agents](navigation-patterns.md)
- [Clawperator Node API - Agent Guide](node-api-for-agents.md)
