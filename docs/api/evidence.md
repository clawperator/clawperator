# Evidence Bundles

Capture a screenshot and raw hierarchy as local files with device metadata,
correlation IDs, timestamps, hashes, and explicit component failures. A bundle
records observations; it does not assert an application outcome or change a
caller-supplied test verdict.

## CLI capture

```bash
clawperator evidence capture --device <device_serial> --operator-package com.clawperator.operator.dev --output-dir /absolute/new/bundle --label "Settings observation" --context-json '{"commandId":"original-command","originalVerdict":"failed"}'
```

| Option | Contract |
| --- | --- |
| `--output-dir <directory>` | Required absolute new directory; its parent must exist. Blank paths, filesystem roots, parent traversal, and existing destinations are rejected. |
| `--device <serial>` | Standard explicit device selection. Required when multiple devices are connected. |
| `--operator-package <package>` | Standard Operator selection; package identifier characters only, with no automatic variant switch. |
| `--label <text>` | Optional, defaults to null; at most 2048 UTF-16 code units. An empty label is valid. |
| `--context-json <object>` | Optional JSON object, defaults to `{}`; at most 16 KiB UTF-8 when serialized. Arrays, null, and non-JSON values are invalid. |
| `--timeout <ms>` | Overall device-work budget, default 30000; integer `1000..120000`. |
| `--output <json\|pretty>` | Response formatting. |

Device selection occurs once. The screenshot is attempted first, followed by
raw hierarchy capture on that same device. Both are attempted independently
within the remaining budget. With less than 1000 ms remaining, hierarchy capture
is recorded as timed out without dispatch because that is the execution engine's
minimum timeout. Metadata queries also use the remaining budget. Final local
file/manifest persistence can continue after the device-work deadline so timeout
evidence remains available.

The screenshot uses the same targeted ADB capture helper as normal screenshots
and does not require an application accessibility root or an available Operator.
Hierarchy capture still requires the selected Operator and preserves its actual
success or failure. Its readiness check is read-only: a sleeping or locked device
returns a hierarchy failure without wake or Home input. Expiring the device-work
budget records screenshot cancellation as `COMMAND_TIMEOUT` and retains any
partial image bytes. Screenshot bytes must decode as a valid PNG with matching,
positive dimensions. Capture is limited to 64 MiB and decoding to 32 million
pixels. Empty, corrupt, or incomplete PNGs cannot mark an image complete.

The screenshot and hierarchy are sequential, not atomic or automatically settled.
The caller owns waiting, assertions, and screen preparation. Capture does not
retry a prior action, change overlays, run doctor, upload media, or generate a
report. [Accessibility-event recording](recording.md) remains a separate feature.

## Result and exit status

```json
{
  "ok": true,
  "status": "complete",
  "manifestPath": "/absolute/new/bundle/manifest.json",
  "evidenceId": "generated-uuid"
}
```

| Status | Meaning | CLI exit |
| --- | --- | --- |
| `complete` | Both image and XML verified, metadata available, and capture receipts persisted | 0 |
| `partial` | At least one requested capture is usable, but another capture, metadata field, or receipt file failed | 1 |
| `failed` | Neither requested capture is usable | 1 |

Partial/failed results have `ok: false` and `code: "EVIDENCE_CAPTURE_FAILED"`.
They retain the readable manifest and any available artifacts when the destination
is writable. `EVIDENCE_OUTPUT_EXISTS` rejects collisions without overwriting.
Invalid requests or device-selection failures occur before capture. If storage
prevents manifest persistence, the command returns `EVIDENCE_CAPTURE_FAILED`;
files already written remain in the chosen directory, but no finalized manifest
is promised.

A complete capture can contain `context.originalVerdict: "failed"`. These are
independent facts. Never replace the caller's original verdict with capture status.

## Bundle files and manifest

| File | Content |
| --- | --- |
| `manifest.json` | Atomically finalized schema-version-1 manifest |
| `screenshot.png` | Verified screenshot |
| `hierarchy.xml` | Verified raw XML, unchanged from the capture envelope |
| `captures.json` | Original Operator capture result and host screenshot receipt |

Incomplete artifacts retain names such as `screenshot.partial.png` or
`hierarchy.partial.xml`. A new attempt requires a new directory. A terminal
bundle is not subsequently modified by capture commands. Bundles contain local
screen content and may contain sensitive data; no upload is performed.

The manifest contains `schemaVersion: 1`, `evidenceId`, `label`, opaque `context`,
`device`, host UTC ISO `startedAt`/`finishedAt`, `status`, `artifacts`, and `errors`.

`device` includes:

- `serial`, `operatorPackage`, `cliVersion`, and `operatorVersion`;
- `apiLevel`, `androidVersion`, `manufacturer`, and `model`;
- `deviceType`: `emulator` if either `ro.kernel.qemu` or `ro.boot.qemu` is `"1"`,
  including conflicting `"0"`/`"1"` indicators. A successfully read, parseable
  property inventory is inferred to be `physical` when both flags are absent,
  empty, or `"0"`. Unexpected nonempty values without a `"1"`, malformed or
  empty inventories, and failed or timed-out reads produce `unknown`.
  `deviceTypeProperties` retains nonempty raw values, with null for absent or
  empty flags;
- `display.width`, `height`, `density`, and `rotation`. Current `wm` overrides
  take precedence over physical dimensions/density. Rotation uses the primary
  display's input viewport or the older `SurfaceOrientation` value (`0..3`).

Still and video capture use the same classification policy. Emulator flags are
a heuristic, not hardware attestation. Unknown classification remains a metadata
failure; this policy does not change historical manifests.

Unavailable metadata is null with an associated error; unknown device type is
`unknown`. Missing metadata makes otherwise usable evidence partial. Geometry
and device properties are targeted ADB observations and are not synchronized
with the screenshot or device clock.

Each still-capture artifact includes `kind` (`screenshot`, `hierarchy`, or `capture_envelopes`),
a bundle-relative `path`, `mimeType`, `status`, `bytes`, `sha256`, separate
`startedAt`/`finishedAt`, and monotonic `durationMs`. Image and hierarchy entries
also include `commandId` and `taskId` for their capture records. Failed entries
without usable files have null path/size/hash and an `error`; retained partial
files have their own partial entry and error. The manifest never hashes itself.
Errors contain `{code,stage,message,component}`, with component nullable.

`captures.json` retains the Operator result under its hierarchy record's
`result`, including the canonical envelope and fields such as
`operator_overlay_visible` when supplied. The screenshot record has
`source: "adb_screencap"` and a host transport receipt, not an invented Operator
envelope. Its `result.ok` describes transport completion; the manifest separately
records PNG validation. Each capture record includes the corresponding artifact's
correlation and observation/persistence timing. No base64 media is embedded.

## MCP and Node domain

MCP `evidence_capture` accepts the common `deviceId`, `operatorPackage`, and
`timeoutMs` fields, plus optional `label` and `context` (an object, not a JSON
string). It rejects `outputDir`, raw paths, and unknown parameters. Each request
allocates a new bundle beneath the server-owned
`~/.clawperator/evidence/bundles` directory and returns its `manifestPath`.
Partial/failed results also set MCP `isError: true` while preserving that path.
See [MCP Server](mcp.md#mcp-tool-evidence-capture).

The shared Node domain entry point is `captureEvidence(options, dependencies?)`
in `domain/evidence/capture.ts`. It accepts equivalent typed options. Omitting
`outputDir` allocates a managed bundle; the test/server dependency `baseDir`
overrides its managed bundle root. The writer and readers share the schema in
`contracts/evidence.ts`. Injectable capture, metadata, file, process, and clock
dependencies support deterministic testing.

## Managed video

Video uses the same bundle schema and adds a persistent, bounded recording
lifecycle. It does not change accessibility-event `record start/stop` commands.
Install `ffprobe` and `ffmpeg` on the host before starting video; still evidence
does not require them. Both tools and the selected device's `screenrecord`
capabilities are checked before a recording is dispatched.

```bash
clawperator evidence video start --device <device_serial> --operator-package com.clawperator.operator.dev --output-dir /absolute/new/video-bundle --duration-seconds 30
clawperator evidence video status --session /absolute/new/video-bundle/manifest.json
clawperator evidence video stop --session /absolute/new/video-bundle/manifest.json
ffprobe -v error -show_streams /absolute/new/video-bundle/video.mp4
```

Start requires an explicit device and an integer `--duration-seconds` from 1 to
180. The duration is enforced by Android even if the host worker disappears.
The common `--timeout` option applies only to still capture; video uses the fixed
startup, stop, and media subprocess budgets below.
The output directory must be absolute and new. Optional `--label` and
`--context-json` have the same contracts as still capture. There is no automatic
retry, wake, navigation, overlay change, audio, or application assertion.

By default, the current display dimensions are scaled down to a longest edge of
at most 1280 pixels, with both edges rounded down to positive even numbers.
`--size WIDTHxHEIGHT` accepts positive even dimensions within 1% of the current
display aspect ratio. Rotation is sampled before start. Rotation during recording
is not continuously tracked or corrected. Encoder fallback to different dimensions
fails final verification; file existence alone is never proof of usable video.

The detached Node worker survives the start CLI process. Start waits at most five
seconds for its recorder PID acknowledgement and a verified live recorder without
an observed startup error. This confirms startup, not a decoded frame. A startup
acknowledgement timeout returns `ok: false`, `code: "COMMAND_TIMEOUT"`, and the
session path, and requests that the worker stop. Status remains available.

| Operation | Success and exit status |
| --- | --- |
| Start | Exit 0, `ok: true`, `status: "recording"` after startup confirmation. Startup failures or timeout exit 1. |
| Status | Exit 0 for a found `starting`, `recording`, `finalizing`, or `complete` session. Partial, failed, unknown, or unavailable-worker states exit 1. |
| Stop | Exit 0 only for `complete`. It waits up to 15 seconds; pending, partial, or failed sessions exit 1. Poll status if finalization remains pending. |

Responses include `sessionId`, `manifestPath`, `status`, and `ok`, plus a failure
`code` when applicable. Status and stop use the immutable saved target and reject
conflicting device or Operator options. Repeated stop after finalization returns
the existing outcome without changing evidence. Concurrent stop requests write
nonce-bound requests; only the worker publishes manifests.

### Video artifacts and recovery

Active video manifests have `finishedAt: null`; terminal manifests have a host UTC
finish time. `video` contains `requestedDurationSeconds`, `hostDurationMs`,
`mediaDurationMs`, `requestedSize`, `actualSize`, `codec`, and `stopReason`.
Host duration uses a monotonic clock and is measured independently of the decoded
media timeline. Idle screens can produce shorter media timelines; neither duration
is a substitute for the other. A zero-duration idle recording remains partial,
even if one frame decodes. Available probe metadata is retained on verification
failure. Stop reasons are `requested`, `duration_cap`,
`startup_failure`, or `failure` (null while recording).

The worker pulls `video.partial.mp4`, probes codec, dimensions and positive media
duration, and fully decodes the first video stream with ffmpeg through its final
frame. Verification requires a successful end-of-stream report with at least one
frame and no error diagnostics. Later corruption cannot pass on the strength of
an opening frame. Source timing is preserved for variable-frame-rate recordings;
verification does not resample the video or compare media time with host time.
Pull and probe each have a 10-second hard deadline; full decoding has a 120-second
hard deadline. Decoding uses two decoder threads, one output thread, a 256 MiB
single-allocation limit, and a null output so decoded frames are not buffered by
Node or saved. Each video subprocess has a combined 16 MiB diagnostic/output
limit; exceeding a deadline or output limit kills that subprocess and fails
verification. The allocation limit is not a total process-memory limit.
Only verified media becomes `video.mp4`.

Stop still waits at most 15 seconds. A pending `COMMAND_TIMEOUT` can therefore
precede successful finalization; use status or repeat stop for the same session.
The worker keeps its heartbeat and ownership through final persistence and never
recaptures after verification failure. Default sizes (long edge at most 1280) and
explicit 1920x1080 were exercised at 180 seconds and 60 fps. Larger sizes, higher
frame rates, other codecs, and slower hosts are not guaranteed to meet the fixed
decode budget; they fail verification if they exceed it.
Failed verification retains partial bytes and errors. `encoder.stderr.txt` and
`captures.json` retain encoder diagnostics and the host recorder receipt; neither
is an invented Operator result. An empty stderr artifact is valid and hashed. Stderr retention is capped at
1 MiB; truncation is reported as a partial artifact and bundle error.
Every requested artifact must be readable and complete before the bundle can
report success. Artifact-read failures retain their underlying error; an unreadable
video fails the bundle, while an unreadable receipt or stderr makes usable video
partial. Metadata failures also produce partial status when the video is usable.

One exclusive lock per device lives under `~/.clawperator/evidence/locks`.
`session.json` keeps the random nonce, host PID/start identity, remote PID/start
identity, remote path, target, deadline and recovery state separate from the
manifest. A nonce-bound heartbeat identifies the original worker. No stored host
PID is used to signal a process. Before sending SIGINT, the worker checks the
remote recorder command, unique output path and process start identity.

`EVIDENCE_RECORDING_ACTIVE` refuses a second session on the same device.
`EVIDENCE_SESSION_NOT_FOUND` indicates an unknown or invalid session.
`EVIDENCE_RECOVERY_REQUIRED` means ownership cannot be verified. Status reports
an unavailable worker as failed while retaining its last persisted manifest and
lock, rather than fabricating a finalized recording. Inspect `session.json`, the
remote file and recorder identity before manual recovery; never remove a lock
based on age alone or signal a PID without checking its identity. The device-side
duration cap bounds a surviving recorder. No automatic stale-lock takeover occurs.
If recorder termination wins a race with stop, an observed normal exit still
proceeds through pull and media verification; an uncertain failure never permits
signaling again. A confirmed failure to spawn the host worker records a failed
startup manifest and releases its own lock because no recorder was started.
Remote temporary media is removed only after successful pull and verification;
failed captures retain their remote path for recovery.

### Video MCP and Node API

`evidence_video_start` accepts `durationSeconds`, optional `size`, `label`,
`context`, `deviceId`, and `operatorPackage`. An explicit target configured in the
MCP session can supply the device. It rejects output paths and unknown fields,
allocates a bundle under `~/.clawperator/evidence/bundles`, and returns `sessionId`.
`evidence_video_status` and `evidence_video_stop` accept only that opaque
`sessionId`; path and target overrides are rejected. Failed and pending-stop
results set `isError: true`.

Node callers use `startVideo`, `videoStatus`, and `stopVideo` in
`domain/evidence/video.ts`. Start accepts the equivalent typed options; status and
stop use `{session: absoluteManifestPath}` with optional matching target fields.
The injectable video `baseDir` is the evidence state root containing `bundles/`
and `locks/`, unlike still capture's `baseDir`, which is its bundle root.
