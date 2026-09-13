# Still evidence capture

The public contract is [Still Evidence Bundles](../../api/evidence.md). This
describes the still-capture implementation. The complementary
[managed video implementation](managed-video.md) extends its schema and artifact
ownership without changing the still-capture contract.

## Ownership and failure boundaries

`domain/evidence/capture.ts` coordinates one selected device, an exclusive new
bundle, screenshot then hierarchy, metadata, capture receipts, and the atomic
manifest writer. It neither replays a caller action nor runs doctor remediation. Caller
context is copied before asynchronous capture and never interpreted as a verdict.

`domain/observe/captureScreenshot.ts` is shared with normal screenshot execution
post-processing. It uses argument-array ADB invocation and an explicitly resolved
serial, with bounded process lifetime and output size. Evidence invokes that host
primitive independently of Operator readiness or application-root availability.
Its receipt is explicitly host-owned; no Android result envelope is invented.
The hierarchy uses the normal snapshot execution and retains the original result
and any Operator overlay metadata in `captures.json`. Its readiness probe uses
`doctor_ping` to read device state without wake or Home input. Sleeping or locked
devices retain screenshot evidence while hierarchy reports `DEVICE_NOT_INTERACTIVE`.

The budget runner caches the initial device inventory for the nested execution
preflight, bounds subsequent calls by the deadline, and kills only child processes
created by this capture. Deadline cancellation records `COMMAND_TIMEOUT` before
terminating screenshot capture and retains any received partial image bytes. A component with no remaining usable budget is recorded
as timed out without dispatch. File validation and manifest persistence remain
possible after the device-work budget expires. Metadata queries are read-only,
explicitly targeted, and bounded by the same deadline. Package names are restricted
to identifier characters before use in remote package inspection.

Files are first written under partial names, read back and validated, then renamed.
PNG decoding checks CRCs, dimensions, and decoded pixels. XML validation uses the
shared compact snapshot parser, without applying its output to the saved bytes.
Only usable screenshot/hierarchy artifacts count toward overall availability;
`captures.json` alone cannot make a failed bundle partial or complete. Metadata
or receipt-file errors make otherwise usable evidence partial. The manifest writer
and validator share `contracts/evidence.ts`; no file hashes include the manifest
itself. Each terminal attempt requires a new directory.

MCP exposes only domain-created manifest paths and never accepts caller output
paths. Managed bundles default to the evidence bundle root under the user's
Clawperator state directory. Node tests inject their own root, process/capture
providers, metadata readers, clock, and file operations. There are no macOS-only
APIs, uploads, report generation, or video lifecycle scaffolding.

## Device classification

Still capture and video start share `collectEvidenceMetadata`. A failed read is
distinct from a successful property inventory with absent emulator flags. The
inventory parser accepts bracketed Android properties, including multiline boot
history values and CRLF output; empty, malformed, or duplicate-key inventories
cannot establish a device type. Parsed nonempty flag values remain in the
manifest, with null for absent or empty flags.

For a usable inventory, either emulator flag equal to `"1"` wins, even against
`"0"` or another unexpected value. If both flags are absent, empty, or `"0"`,
classification is `physical` by inference. Other nonempty values, failed reads,
timeouts, and exhausted budgets remain `unknown`, with
`EVIDENCE_CAPTURE_FAILED`, stage `metadata`, component `deviceType`.
This is a heuristic, not hardware attestation. Other required metadata failures
still make usable bundles partial. Schema version 1 and historical manifests
remain unchanged.

### Physical-device classification validation

On 2026-09-13, source based on `e96e7584` plus this classification fix used
branch-local CLI 0.10.1 and the matching branch-built 0.10.1-d development APK,
installed on explicit physical and emulator targets. Android debug assembly
passed. The physical device's two emulator flags were absent. A new still bundle
and finalized video bundle both reported `complete`, `physical`, null raw flags,
and terminal CLI exit 0. Artifact sizes and SHA-256 hashes matched; the still
hierarchy passed an independent XML parser and the screenshot was visually
inspected. The H.264 video independently decoded fully with ffmpeg; ffprobe
reported 572 by 1280 pixels and 5.281122 seconds.

The emulator retained `emulator` classification with both flags equal to `"1"`.
Its still bundle remained partial, exit 1, solely because hierarchy capture
returned `SNAPSHOT_HIERARCHY_UNAVAILABLE`. This establishes classification,
not successful emulator hierarchy capture or resolution of that separate issue.
Initial partial bundles remain untouched. Those live runs exposed multiline
boot-history properties on both targets; sanitized LF and CRLF regression
fixtures now cover them.

The complete Node suite passed 1,615 tests. Regressions cover classification
precedence, malformed inventories, read failures and budgets, preservation of
other metadata failures, and real detached-worker finalization and CLI terminal
status for physical, emulator, and unknown classifications. Video acceptance used
writable default state; restricted-host state overrides and combined acceptance
with the writable-state pack remain separate work. Private captures and logs
remain outside tracked files.

## Validation and observed limits

Local device checks used a dedicated Android 16 / API 36 emulator with the
branch-built 0.10.0-d debug Operator and Node CLI 0.10.0. The Android debug build
passed, and the APK was installed on the selected target. Other connected devices
were not targeted.

A Settings search screen with the keyboard visible produced a complete CLI bundle.
The image was opened and visually confirmed; an independent XML parser accepted
the hierarchy. All three artifact hashes and sizes matched the saved bytes.
Image/hierarchy correlation IDs and observation times matched `captures.json`,
and the saved XML exactly matched its Operator result. The caller's example
failed verdict remained unchanged in context. The image was 1344 by 2992 pixels;
the manifest reported API level, emulator property evidence, density and primary
display rotation from targeted reads.

A second capture selected an unavailable Operator package. Its actual ADB image
capture succeeded, hierarchy failed with `OPERATOR_NOT_INSTALLED`, and the command
returned partial status with exit 1 and a readable manifest. A live MCP stdio call
also created a complete bundle beneath the server-owned evidence root and retained
the caller's original verdict.

An initial, separate app-open attempt returned `RESULT_ENVELOPE_TIMEOUT`. It was
not replayed by evidence capture, relabeled as success, or treated as an evidence-capture fix.
The screen retained Settings search state. These are bounded observations, not a
claim of complete release readiness or a fix for separate preparation/transport
workstreams. Both installed Operator variants were enabled at observation time;
Evidence capture explicitly targeted the debug variant and does not change accessibility setup.

Offline regression coverage includes root-unavailable and missing-Operator
failures, independent capture attempts, exhausted and remaining budgets, exclusive
output creation, malformed/empty PNGs, persisted-byte corruption, file/manifest
write failures, metadata fallback/null values, device selection, context/path
validation, CLI exit behavior, and MCP path restrictions and partial results.
Private captures and validation logs remain outside tracked files.

Validation commands passed: the complete Node suite (1,498 tests), then 151
focused evidence/execution/observe/MCP checks after final file-verification and
input-validation changes; the documentation build (32 navigation pages, no
organization warnings); and `git diff --check`. A final CLI evidence bundle
passed independent hash/XML/correlation checks. Normal screenshot capture through
the extracted helper also returned a successful canonical envelope and a decoded
1344 by 2992 PNG. Existing raw screenshot/snapshot skill consumers retain their
contracts, so no sibling skill migration or version bump is required.

The subsequent readiness and cancellation fixes passed a Node build and 155
focused evidence/execution/observe/MCP tests. Coverage includes sleeping, locked,
and interactive probe results and overall-deadline cancellation with partial bytes.
These follow-ups were not re-tested on a live sleeping or locked device.
