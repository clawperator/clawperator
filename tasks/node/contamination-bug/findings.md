# Snapshot XML contamination findings

## Summary

`snapshot_ui` can return `data.text` that is not valid XML. The reproduced
case inserts Android system log messages such as:

```text
Updating configuration, locales updated from [] to [en_US]
```

inside the hierarchy string returned by `clawperator snapshot`.

This is not a display issue with `--output pretty`. The contamination is in the
structured `envelope.stepResults[].data.text` payload.

## Live reproduction

Command run from this checkout using the branch-local CLI:

```bash
node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output pretty --timeout 10000
```

Observed result:

- `envelope.status` was `success`
- `stepResults[0].actionType` was `snapshot_ui`
- `stepResults[0].data.actual_format` was `hierarchy_xml`
- `stepResults[0].data.text` contained the non-XML `Updating configuration...`
  line inside the `<hierarchy>` document
- the same contaminating line appeared more than once in one returned snapshot

Connected devices were:

```text
<physical_device_serial>    device
emulator-5554               device
```

The reproduction targeted the physical device explicitly. An earlier non-
escalated attempt could not access the host ADB daemon from the sandbox; after
ADB access was allowed, the device was visible and the bug reproduced.

## Raw logcat source

Recent `adb -s <device_serial> logcat -d -v tag` output showed this pattern:

```text
D/TaskScopeDefault: [TaskScope] UI Hierarchy:
D/TaskScopeDefault: <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
D/TaskScopeDefault: <hierarchy rotation="0">
D/TaskScopeDefault:   <node ...>
D/TaskScopeDefault:     <node ...>
V/Configuration: Updating configuration, locales updated from [] to [en_US]
D/TaskScopeDefault:       <node ...>
```

So the Android side is not logging the contaminating text as part of the XML
message. The system `Configuration` log is interleaved between separate
`TaskScopeDefault` logcat lines.

## Code path

Android emits the hierarchy in:

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt`

Relevant line:

```kotlin
Log.d("$TAG UI Hierarchy:\n$hierarchyDump")
```

Node retrieves and attaches snapshot text in:

- `apps/node/src/domain/executions/runExecution.ts`

Relevant behavior:

- clears logcat before dispatch with `adb logcat -c`
- waits for the canonical result envelope
- after success, dumps all current logcat with `adb logcat -d -v tag`
- passes every dumped line to `extractSnapshotsFromLogs()`
- attaches extracted snapshots to successful `snapshot_ui` steps

The extractor lives in:

- `apps/node/src/domain/executions/snapshotHelper.ts`

The central issue is that `extractLogMessage()` strips the logcat tag from any
line shaped like `V/Configuration: ...`, returning only the message text. Later,
while inside a snapshot block, `extractSnapshotsFromLogs()` appends any message
that does not begin with a bracketed marker:

```ts
if (trimmed.startsWith("[") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) {
  // terminate current snapshot
}

currentSnapshotLines.push(message);
```

Because `Updating configuration...` does not start with `[` or `<`, it is
treated as hierarchy content.

## Controlled local proof

A direct call to the built extractor with a synthetic interleaved
`V/Configuration`-style line reproduces the bug:

```text
<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
Updating configuration, locales updated from [] to [en_US]
  <node index="0" text="Settings" />
</hierarchy>
```

This confirms the failure is in Node extraction behavior, independent of the
SolaX app UI.

## Affected surfaces

The bug is shared by every surface that relies on `runExecution()` snapshot
post-processing:

- `clawperator snapshot`
- `clawperator exec` payloads containing `snapshot_ui`
- `serve` API `POST /snapshot`
- MCP `snapshot`
- MCP `execute` calls containing `snapshot_ui`
- skills or smoke scripts that call the Node CLI/API and consume `data.text`

The Android `snapshot_ui` step result itself only returns metadata such as
`actual_format`, `foreground_package`, `has_overlay`, and `window_count`.
The XML is attached later by Node, so fixing only the CLI renderer would not
address the contract bug.

## Current test coverage gap

`apps/node/src/test/unit/snapshotHelper.test.ts` covers:

- extracting from `D/E` logcat lines
- preserving colons in XML attributes
- rejecting the old `TaskScopeDefault:` marker shape
- multiple snapshots in one log stream

It does not cover interleaved non-TaskScope logcat lines while a hierarchy block
is open. That missing case is exactly what reproduced on-device.

## Fix direction

The extractor should preserve enough logcat metadata to know which tag emitted a
line. While a snapshot block is open, it should only append lines from the same
snapshot-producing tag, likely `TaskScopeDefault` or the Android app's exact
hierarchy logger, and should ignore or terminate on other tags.

Candidate shape:

- parse each logcat line into `{ level, tag, message }` instead of only
  `message`
- start a snapshot only from a line whose message includes
  `[TaskScope] UI Hierarchy:` and whose tag is the expected task-scope tag
- append XML lines only from the same tag
- terminate on `</hierarchy>`
- if another tag appears before `</hierarchy>`, ignore it rather than appending
  its message
- add a regression test with an interleaved `V/Configuration` line between two
  `D/TaskScopeDefault` XML lines

An additional hardening option is to validate that the final snapshot text
starts with an XML declaration or `<hierarchy` and contains no non-XML lines
outside tags. That should be secondary to tag-aware extraction because the
root cause is loss of logcat source identity.

## Open questions

- Should the accepted snapshot tag be exactly `TaskScopeDefault`, or should it
  accept shortened tags such as `E`/`D/E` from older or alternate `-v tag`
  output? Existing tests use `D/E` as the emitted prefix, so the fix needs to
  preserve compatibility or intentionally update the fixture to the actual
  current `TaskScopeDefault` logcat shape.
- Should contamination be silently ignored, or should the extractor record a
  warning when it sees interleaved non-snapshot log lines while a snapshot is
  open? Silent ignore is likely safest for the public contract, but a debug log
  could help diagnose noisy devices.
- Should Node pass a narrower logcat filter for the post-success dump instead of
  dumping the full buffer? Filtering may reduce noise, but tag-aware parsing is
  still needed because the same code should remain robust to raw dumps and test
  fixtures.

