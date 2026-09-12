# Capture portable image and video evidence

## Goal and Scope

Produce reusable evidence artifacts with capture metadata and honest partial-failure reporting.

Screenshots already work, but correlation and recovery artifacts require ad hoc wrappers. Native-resolution screenrecord can fail and auto-fallback to a different size; successful process exit and file existence do not prove a usable video or its timeline duration.

PR-1: screenshot plus raw hierarchy bundle and manifest. PR-2: managed MP4 capture with start/status/stop, bounded ownership, explicit sizing, and media verification.

Excluded: HTML reports, QA verdicts, uploads, permanent artifact retention services, audio recording, post-processing overlays, on-screen timer/overlay work, and replacing accessibility-event recording.

## Status

| Item | Value |
| --- | --- |
| State | Not started |
| Total PRs | 2 |
| Total phases | 2 |
| Completed | None |
| Remaining | 1-2 |
| Current / Next | Phase 1 |
| Blockers | None |

## Sources

| Topic | Authority |
| --- | --- |
| Screenshot primitive | `apps/node/src/domain/observe/screenshot.ts` |
| Host screenshot handling | `apps/node/src/domain/executions/runExecution.ts` |
| Snapshot primitive | `apps/node/src/domain/observe/snapshot.ts` |
| Process adapter | `apps/node/src/adapters/android-bridge/processRunner.ts` |
| CLI registration | `apps/node/src/cli/registry.ts` |
| MCP entry points | `apps/node/src/mcp/tools/index.ts` |
| Existing event recording | `apps/node/src/cli/commands/record.ts` |
| Observe tests | `apps/node/src/test/unit/observe.test.ts` |

Initial investigation used `5d23af5`; the final task audit used merged main `120c1eb`, including the shipped on-screen-log raw API. Preserve its controller-owned overlay identity, visibility metadata, canonical error codes, and strict input aliases. Installed-runtime observations came from CLI/Operator 0.9.5; do not assume the checkout and device are identical. Recheck affected seams after dependency merges. New identifiers below are proposed contracts to implement, not claims about shipped behavior.

## Behavior and Decisions

| Situation | Result |
| --- | --- |
| All requested components verified | complete |
| Some components available, another fails | partial; retain every successful component and error |
| No requested component usable | failed |
| Video command started but not finalized | recording; never complete |
| Output destination already exists | fail without overwriting |
| Stop repeated after finalization | Return the same final manifest; do not recapture |
| Stop/status for unknown session | EVIDENCE_SESSION_NOT_FOUND |
| Device disconnect or worker crash | Preserve partial files and structured failure; do not claim complete |
| Caller supplies an original action failure | Preserve as opaque context; never replace its verdict with capture status |

PR-1 adds `clawperator evidence capture --output-dir <new-directory> [--label <text>] [--context-json <object>]` and MCP `evidence_capture`; standard explicit device/operator flags apply. CLI output-dir must be absolute and newly created. MCP rejects outputDir and caller-chosen host paths; create a unique bundle beneath the server-owned evidence root, default `~/.clawperator/evidence/bundles`, with an injectable baseDir for tests. Request both screenshot and raw snapshot; run sequentially in that order, attempt both even if one fails. Do not retry the original action. The shared Node domain function accepts the equivalent typed arguments. Capture primitives are reused; do not duplicate screenshot transport. Audit the current screenshot path for an application-root prerequisite: evidence screenshots must still be attempted when the app hierarchy is unavailable. If necessary, narrowly extract the existing targeted ADB PNG capture into one shared helper used by normal screenshots and evidence, without altering raw execution ordering. An unavailable Operator can still yield partial screenshot-only evidence; never invent a successful snapshot. Resolve the device once and use it throughout. Read metadata with explicitly targeted ADB; unavailable metadata is null with an associated error.

Use `manifest.json`, `screenshot.png`, `hierarchy.xml`, and `captures.json` (original capture envelopes). Manifest schema version 1: `{schemaVersion,evidenceId,label,context,device:{serial,operatorPackage,cliVersion,operatorVersion,apiLevel,androidVersion,manufacturer,model,deviceType,display:{width,height,density,rotation}},startedAt,finishedAt,status,artifacts,errors}`. deviceType is emulator when ro.kernel.qemu or ro.boot.qemu is "1", physical when a successfully read value is "0", and unknown otherwise; retain the queried property evidence. Prefer current display override dimensions over physical dimensions when present. Timestamps are host UTC ISO strings; each artifact adds individual capture-start/end timestamps and durationMs from monotonic time. Entries: `{kind,path,mimeType,status,bytes,sha256,startedAt,finishedAt,durationMs,commandId?,taskId?,error?}`. Failed entries have null path/hash/bytes and an error; preserve any incomplete file under an explicitly partial path. Path values are relative to the bundle root; no base64 media. Optional label defaults to null and is at most 2048 UTF-16 code units; optional context defaults to {}. Context is caller-owned JSON, capped at 16 KiB UTF-8, including optional original commandId/taskId/stepId. Reject non-object JSON and unsafe/blank output paths. Do not mix caller timestamps with capture timestamps. A screenshot and hierarchy are sequential, never described as atomic or automatically settled. The caller owns wait/assertion policy.

Write the manifest atomically, retain capture errors and available artifacts, and return `{ok,status,manifestPath,evidenceId}`; ok=true only for complete still capture. Partial/failed capture exits nonzero but leaves a readable manifest when the destination was writable. Define EVIDENCE_CAPTURE_FAILED and EVIDENCE_OUTPUT_EXISTS consistently. Do not downgrade an original test result, delete successful evidence on partial failure, or report empty/corrupt PNG as complete. Verify PNG structure/dimensions via a decoder or validated PNG parser, not extension alone. Metadata collection failures also yield partial status, even when both capture artifacts succeeded. All artifacts and metadata are local and may contain screen content; no upload is performed. No new raw Android action is required.

PR-2 adds `evidence video start --output-dir <new-directory> --duration-seconds <1..180> [--size <WIDTHxHEIGHT>]`, `evidence video status --session <manifest-path>`, and `evidence video stop --session <manifest-path>`, with equivalent MCP tools/domain methods. Use MCP tool names evidence_video_start, evidence_video_status, and evidence_video_stop. Start shares label/context metadata fields; returns recording only after bounded startup confirmation, or structured startup failure. Maximum duration is mandatory to bound orphan processes. Verify supported duration/options using the selected device screenrecord help; if the device cannot honor the requested duration, fail rather than silently clamp it. Start requires this explicit device; status and stop use the immutable saved target, and reject conflicting supplied target flags. Existing `record start/stop` continues to mean accessibility-event recording.

Recording must survive the initiating CLI process and support status/stop from subsequent processes. Use session-owned durable state and argument-array process invocation. A detached Node worker with an atomic stop-request file is one suitable implementation; equivalent coordination is acceptable if it preserves ownership, bounded cleanup, and the public lifecycle. Do not kill a stored host PID blindly. Worker retains the targeted remote recorder PID and verifies its command line plus unique output path before sending SIGINT via ADB. No killall/pkill. Allocate an ASCII session ID for device paths; never interpolate caller label/context into a shell command. Signal only a verified recorder belonging to this session. Poll stop requests at a bounded interval; real-time control is not promised. Persist a random session nonce, host PID and process start identity, remote PID, device serial, temporary remote path, last update, and requested deadline separately from the terminal manifest. Status reconciles worker termination/time cap with persisted final state and reports unavailable worker truthfully. If process identity cannot be verified, mark recovery required and retain the lock; do not signal a potentially reused PID. Guard active ownership with an exclusive lock per device under a new `~/.clawperator/evidence/locks/` state directory, following the injectable baseDir pattern in `apps/node/src/domain/daemon/lifecycle.ts` (do not place evidence locks inside daemon session state); a second active session on that device fails EVIDENCE_RECORDING_ACTIVE. Stale locks require verification, not age-only deletion. Stop waits up to 15 seconds for graceful finalization and returns recording/finalizing with nonzero exit if still pending; status remains usable. Clean only this session's remote temporary file after successful pull/verification. On failure retain the path and recovery instructions; never erase another session.

Default dimensions: read current display dimensions; scale down only, keeping the longest edge at most 1280, round both dimensions down to positive even numbers, and record requested dimensions. Explicit size must be positive even integers and within 1% of the current display aspect ratio; otherwise fail validation. Do not silently accept backend fallback: actual decoded dimensions must equal the requested size. Keep encoder stderr as an artifact. Rotation during capture is recorded as a limitation; do not promise continuous reorientation. No audio or automatic segment stitching.

Pull to `video.partial.mp4`, use ffprobe to obtain codec/dimensions/media duration, and ffmpeg to decode a frame. Verify those tools before starting; they are prerequisites only for video. Rename to video.mp4 only after valid decoding, positive media duration, and dimension validation. Add a video entry plus `{requestedDurationSeconds,hostDurationMs,mediaDurationMs,requestedSize,actualSize,codec,stopReason}` to the manifest. Do not equate these durations: idle-screen samples can have a shorter media timeline than wall time. Nonempty files and exit 0 alone are insufficient. Interrupted or decoder-failed files remain partial with errors. No streaming/media API keys, uploads, or embedded player belongs here.

### Manifest types and budgets

Use the same schema types in the writer and validator. Manifest status is `starting|recording|finalizing|complete|partial|failed`; still capture only returns complete/partial/failed. Artifact status is `complete|partial|failed`; kind is `screenshot|hierarchy|capture_envelopes|video|encoder_stderr`. Error records are `{code,stage,message,component}` with component nullable. A partial entry may reference its retained partial file and computed size/hash; a failed entry without a file has null path/bytes/sha256. Include entries for captures.json and retained stderr, and never include manifest.json in its own hash list. Hash files after final writes. created/recording manifests have finishedAt=null; terminal manifests set it. CaptureStarted/finished timestamps are component observations, not device clock synchronization.

Use a default 30000 ms overall still-capture timeout, configurable with the common timeout option. Pass remaining budget to each primitive. If no budget remains for a component, record its timeout without dispatching it; do not silently omit the component. Video startup waits at most 5000 ms for the worker's session/remote-PID acknowledgement and a live recorder with no observed startup error; this is process startup, not frame proof. Handle stop requests promptly within the documented stop deadline; polling or event-driven coordination is an implementation choice. The recorder's device-side duration cap must survive host-worker loss. Bound each pull/probe/decode subprocess at 10000 ms. A stop caller's 15-second wait is independent of worker finalization; it may return pending while status can be polled.

For CLI, capture exits 0 only on complete. Video start exits 0 with ok=true/status=recording after startup; partial/failed startup exits 1. Status exits 0 with ok=true for a found starting/recording/finalizing/complete session, and 1 with ok=false for partial/failed or unknown sessions. Stop exits 0 only on complete; pending/partial/failed exits 1 with ok=false and the current status. This distinguishes command acceptance from media completion. MCP returns equivalent data and error states using its existing result wrappers. MCP video start likewise allocates a managed bundle and returns sessionId; status/stop accept that opaque sessionId only, resolve it via server-owned state, and reject path/target overrides. CLI retains its manifest-path form. Add tests for both route contracts.

### Existing overlay compatibility

Capture each screenshot in its own execution while any caller-owned panel remains visible. Never combine set/screenshot/clear inside a bundle request or clear a caller's overlay. Keep original capture envelope metadata including operator_overlay_visible when available. The bundle does not verify labels or test verdicts. A raw hierarchy failure must not destroy a successfully captured image.

## Repeatability

Capture/start exclusively create a new destination and refuse collisions. Status is read-only apart from reconciling worker completion. Stop is idempotent after finalization. Evidence content is immutable after a terminal manifest; a new attempt needs a new directory.

## Durable Outputs

The work breakdown names the authored docs and regression coverage that ship with this contract. Keep implementation findings here only until the pack is complete; migrate lasting guidance before retiring it.
