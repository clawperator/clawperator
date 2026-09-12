# Still Evidence Bundles

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
  `physical` if a successfully read value is `"0"` and neither is `"1"`, or
  `unknown` otherwise; `deviceTypeProperties` retains both property observations;
- `display.width`, `height`, `density`, and `rotation`. Current `wm` overrides
  take precedence over physical dimensions/density. Rotation uses the primary
  display's input viewport or the older `SurfaceOrientation` value (`0..3`).

Unavailable metadata is null with an associated error; unknown device type is
`unknown`. Missing metadata makes otherwise usable evidence partial. Geometry
and device properties are targeted ADB observations and are not synchronized
with the screenshot or device clock.

Each artifact includes `kind` (`screenshot`, `hierarchy`, or `capture_envelopes`),
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
