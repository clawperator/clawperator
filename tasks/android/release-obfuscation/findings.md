# Release Obfuscation Snapshot Findings

Date: 2026-04-28
Status: bug finding handoff

## Summary

Release Operator snapshot extraction can fail on the host even when the Android
runtime successfully captures the UI hierarchy and emits a successful
`[Clawperator-Result]` envelope.

The observed failure is caused by the Node-side `0.9.2` snapshot extraction path
depending on the literal Android log tag `TaskScopeDefault`. That tag is stable
in the debug/dev Operator APK, but it is obfuscated in the release Operator APK.

This makes release snapshots look poisoned from the CLI even though the release
APK did the Android work correctly.

## User-Visible Symptom

The AirTouch HVAC skill failed on the first `snapshot` after opening the app:

```text
Skill au.com.polyaire.airtouch5.set-power-state exited with code 1
runtime_execution failed
Command failed: ... snapshot --device <device_serial> --operator-package com.clawperator.operator --json
```

The skill stopped before terminal verification and before making the requested
HVAC state changes.

## Reproduction Context

Installed versions on the physical Android device during the finding:

```text
clawperator --version
0.9.2

com.clawperator.operator
versionName=0.9.2

com.clawperator.operator.dev
versionName=0.9.2-d
```

Direct snapshot probes against the same foreground AirTouch screen:

```bash
clawperator snapshot --device <device_serial> --operator-package com.clawperator.operator --json
```

returned `SNAPSHOT_EXTRACTION_FAILED`.

```bash
clawperator snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --json
```

returned a successful hierarchy XML snapshot.

## Log Evidence

The Clawperator runtime log showed the skill opened AirTouch successfully, then
failed on the first snapshot:

```text
2026-04-28T09:04:09.731Z skills.run.start au.com.polyaire.airtouch5.set-power-state
2026-04-28T09:04:10.017Z preflight.apk.pass open_app ... com.clawperator.operator
2026-04-28T09:04:11.628Z envelope.received open_app
2026-04-28T09:04:13.674Z preflight.apk.pass snapshot ... com.clawperator.operator
2026-04-28T09:04:14.263Z envelope.received snapshot
2026-04-28T09:04:14.279Z skills.run.output status=failed runtime_execution
```

The direct release snapshot returned:

```json
{
  "error": "SNAPSHOT_EXTRACTION_FAILED",
  "message": "UI hierarchy extraction produced no output for this step. Check clawperator version compatibility and logcat extraction health.",
  "foreground_package": "au.com.polyaire.airtouch5",
  "has_overlay": "true",
  "overlay_package": "com.sec.android.app.launcher",
  "window_count": "3"
}
```

Logcat showed the release Operator actually completed the Android snapshot
successfully:

```text
[Clawperator-Command] start commandId=snapshot-1777367053555-odiyvun
D/kw2: [TaskScope] UI Hierarchy:
[Clawperator-Command] stage-success commandId=snapshot-1777367053555-odiyvun id=logUiTree
[Clawperator-Result] {"commandId":"snapshot-1777367053555-odiyvun","status":"success",...}
```

The important detail is the log tag:

- release APK: `D/kw2: [TaskScope] UI Hierarchy:`
- dev APK: `D/TaskScopeDefault: [TaskScope] UI Hierarchy:`

The hierarchy marker text was present in both cases, but the release class/log
tag was obfuscated.

## Root Cause

At tag `v0.9.2` (`8c5458494cf559e8048dec0bc6465ddb5a6eaebf`), Node only
treated lines as snapshot hierarchy lines when the raw logcat line contained
`TaskScopeDefault`:

```ts
function isSnapshotLogLine(line: string): boolean {
  return line.includes("TaskScopeDefault");
}
```

That means:

- dev/debug APK snapshots worked because the log tag contained `TaskScopeDefault`
- release APK snapshots failed because minification obfuscated the log tag
- the Android envelope still reported success because the Android action did
  succeed
- the host normalized the snapshot step to `SNAPSHOT_EXTRACTION_FAILED` because
  no hierarchy XML was attached to the `snapshot_ui` step

## Relevant Commit After 0.9.2

Commit `5a2eae0b704bd6645c18bdfe4da3c5f849b3e4db`
(`fix(runtime): correlate snapshot UI logs by commandId (#246)`) directly
addresses this class of bug.

It changes Android from:

```kotlin
Log.d("$TAG UI Hierarchy:\n$hierarchyDump")
```

to:

```kotlin
val commandId = currentTaskCommandId() ?: "unknown"
Log.d("$TAG UI Hierarchy [commandId=$commandId]:\n$hierarchyDump")
```

and changes Node to parse snapshot blocks from the stable message marker:

```text
[TaskScope] UI Hierarchy [commandId=<command_id>]:
```

rather than from the log tag or class name.

This is the right architectural direction because `commandId` is a protocol
field and log tags are not a stable runtime contract.

## Current Branch Caveat

The current local branch contains:

```text
832fd395 Revert "fix(node): support legacy snapshot markers"
232132bf fix(node): support legacy snapshot markers
5a2eae0b fix(runtime): correlate snapshot UI logs by commandId (#246)
```

With the revert in place, current Node expects the new command-id-tagged marker.
A freshly built post-`5a2eae0b` dev APK should satisfy that contract. A `0.9.2`
release APK will not, because it still emits the legacy untagged marker.

## Engineering Takeaways

- Never use Android class names, logger tags, or minifiable implementation names
  as host/runtime protocol boundaries.
- Snapshot extraction should key off stable message markers and `commandId`.
- Release APK smoke tests must include `snapshot_ui`, not just debug/dev APK
  validation.
- The host should preserve enough raw snapshot failure evidence to make this
  diagnosis visible without a manual logcat pass.
- Mixed Node/APK version behavior needs explicit compatibility handling or
  clear preflight errors, especially for snapshot extraction.

## Suggested Follow-Up

Validate the intended fixed path with a clean, matched local build:

1. Build Node from the current branch.
2. Install the matching release Operator APK, not only `.dev`.
3. Run `clawperator snapshot --device <device_serial> --operator-package com.clawperator.operator --json`.
4. Confirm logcat contains the command-id-tagged hierarchy marker.
5. Confirm Node attaches `data.text` to the `snapshot_ui` step.
6. Run at least one skill smoke test that performs a snapshot under the release
   Operator package.

