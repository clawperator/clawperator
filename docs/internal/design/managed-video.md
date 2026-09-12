# Managed video evidence

The public contract is [Managed video](../../api/evidence.md#managed-video).
Video extends the shared still-evidence schema without changing raw screenshot,
snapshot, or accessibility-event recording contracts. No runtime skill migration
or Android action is required. The host implementation uses Node, targeted ADB,
ffprobe and ffmpeg; it does not use macOS-specific APIs.

## Ownership and persistence

`domain/evidence/video.ts` validates requests, checks host/device capabilities,
reads metadata, acquires an exclusive device lock, and starts a detached Node
worker. The worker is packaged beside the domain modules in `dist/` and owns all
manifest writes after startup. Output directories are exclusive. UUIDs generate
remote paths, and only validated dimensions/durations enter the remote script.
Caller labels and context never become shell commands.

`videoWorker.ts` uses the PID emitted by a shell that immediately execs
screenrecord. It verifies the exact command arguments and `/proc` start identity
before acknowledging startup or signaling stop. Stop verifies again immediately
before SIGINT. The worker keeps its own ADB child handle; it never signals a
persisted host PID. A random session nonce, worker start identity and heartbeat
identify the original worker without relying on platform-specific process APIs.
The Android duration cap remains independent of host lifetime.

Status reads the shared schema and session state. A stale/missing heartbeat after
the startup grace period reports recovery required and retains the lock and last
manifest. It does not fabricate terminal evidence or reclaim locks based on age.
The worker releases its lock only when it has observed recorder termination with
sufficient certainty. Crashes or ambiguous disconnects require manual ownership
verification. A known terminal manifest remains immutable, including under repeated
or concurrent stop requests. Atomic nonce-bound request files avoid multiple
callers racing manifest publication.

Media verification requires positive probed duration, exact requested dimensions,
and full decoding of the selected first video stream through EOF, with a positive
frame count and no decoder error diagnostics. The video is renamed only after
these checks. Encoder stderr (including an empty successful stream) and host capture
receipts are hashed artifacts. Retained stderr is capped and truncation is an
explicit partial failure. Remote cleanup follows successful pull and verification;
otherwise the recovery state preserves its unique path.

## Validation and limits

The selected Android 16 / API 36 emulator advertised `screenrecord` v1.4 with
size and duration options. Its successful help output used stderr, so capability
checks accept both output streams while still requiring exit zero. Host ffprobe
and ffmpeg were available. The matching branch debug Operator 0.10.0-d was built,
installed and granted permissions; CLI 0.10.0 was used throughout. Other connected
devices were not targeted.

An initial 12-second CLI recording finalized at its duration cap with verified
574x1280 H.264 media. A separate explicit-stop recording completed, but its
app-open timed out and scrolls found no container; it does not count as navigation
proof. A second app-open with the matching APK also timed out. These failures are
preserved as preparation observations, not relabeled as video success or repaired
inside this media feature.

After observing the restored Settings search screen and navigating back, an
independent screenshot confirmed the Settings homepage. The final navigation
recording entered Network & internet, confirmed that screen in a snapshot, returned
and scrolled the Settings list. Decoded frames showed both screens. Explicit stop
from another CLI process finalized the recording. All artifact hashes and byte
counts matched the saved files. The 60-second cap was stopped after approximately
50.9 seconds of host time; the verified media timeline was approximately 43.8
seconds. Both durations are retained independently, not treated as equivalent.

Offline coverage uses fake process adapters and a clock for recorder startup,
identity mismatch, cap overrun, disconnect, corrupt decoding, dimension fallback,
pull failure, stale workers, locks, CLI validation/exit codes, and MCP path/target
restrictions. A real detached-worker subprocess test uses executable fake media
and ADB tools to prove survival after the initiating process exits and concurrent,
idempotent stop. That fixture is POSIX-only; Windows live operation is not proven.
Live media checks supply the independent pixel/decoder proof that fake tools cannot.
Private logs, screenshots and recordings remain outside tracked files.

A managed idle capture started through MCP, survived closure of that MCP server,
and was inspected/stopped through a fresh server using only its session ID. It
hit its 12-second cap after approximately 12.5 seconds on the host, but ffprobe
reported a zero-duration H.264 stream containing one decodable frame. The result
correctly remained partial with `isError: true`, retained media and remote path,
and preserved the caller's failed verdict. This is evidence of an idle encoder
limitation, not a positive-duration playback proof. Regression coverage now keeps
available probe dimensions, codec and zero duration even when verification fails.

Final validation passed: Node build and all 1,544 Node tests with no skips, the
Android debug APK build, and the documentation build (32 navigation pages and
394 generated-doc links, no organization warnings). The final MCP idle check
confirmed that the zero-duration observation is retained alongside the partial
status. The supported-image manual release CI and separate runtime release gates
remain outside this feature's completion claim.


## On-screen log recording verification

A follow-up on the same dedicated API 36 emulator verified the merged on-screen
log API against actual video pixels. The panel was initially absent. A separate
`on-screen-log set` displayed a purple, right-anchored BEFORE label before video
start. While recording, separate acknowledged set commands replaced it with a
blue, left-anchored UPDATED label and then a green, right-anchored FINAL label.
All three generations appeared with the intended text, color and position in the
decoded MP4 frames. No recorder-side overlay composition or API change was needed.

The owned recording stopped successfully with verified 574x1280 H.264 media.
Artifact hashes and byte counts matched the saved files. Host capture lasted
approximately 10.26 seconds; the media timeline was 6.716 seconds and contained
six frames. The final update appeared in the last decoded frame at 6.704 seconds.
One-second sampling omitted that final generation, so validation inspected the
original decoded frames rather than relying only on a resampled contact sheet.
This retains the documented idle-encoder timing limitation.

After stop, a separate screenshot still showed the green FINAL panel and snapshot
metadata reported `operator_overlay_visible: "true"`. Capture had not cleared or
replaced the caller-owned panel. The test then explicitly cleared its own panel;
a following snapshot reported `operator_overlay_visible: "false"`. Recording,
frames, command receipts and post-stop screenshots remain in private local
artifacts rather than tracked source.


## Review follow-up

An independent full-branch review identified three lifecycle defects, all repaired:
normal recorder exit during stop identity verification or signaling skipped media
finalization; failed artifact reads could leave overall status complete; and a
host-worker spawn error could leave an owned device lock with no worker.

Stop now continues to media verification only after observing a normal recorder
close in the race, without repeating a signal. Artifact read errors enter the
manifest errors and every requested artifact must be complete for success.
Heartbeats continue through artifact reads and final persistence. Host-worker
ownership begins at the confirmed spawn event; synchronous and asynchronous spawn
failures persist a failed startup manifest and release only the nonce-owned lock.
Regression cases cover each failure, and the reviewer found no remaining
actionable issues in the follow-up review.

Validation after these repairs passed the Node build, 52 focused evidence tests,
and the full 1,549-test Node suite. A fresh selected-device recording started and
stopped successfully, retained the updated on-screen log in decoded frames, and
passed independent artifact hash/byte-count checks. The test explicitly cleared
its own panel afterward. The documentation build also passed.


## Full-stream verification (R14)

R9 merged in PR #285 (`6fc6c191`); its opening-frame checksum could accept a
recording damaged later in the stream. R14 replaces that check with full ffmpeg
decoding to a null output. `-map 0:v:0` matches the probed stream, `-xerror` and
`-err_detect explode` make decoding damage fatal, and error-level stderr is also
rejected even if the process returns zero. A final `progress=end` report must
contain a positive frame count. Missing EOF, timeout, or exhausted output budget
cannot authorize promotion. Probe metadata is saved before decoding starts.

`-fps_mode passthrough` and `-enc_time_base -1` retain the source timebase. Without
that output timing, valid sparse VFR input can trigger duplicate-DTS diagnostics
in the null muxer. We prevent the verifier from inventing those errors rather
than ignoring decoder diagnostics. No expected frame count is derived from
average frame rate or wall time, and no decoded pixels are retained by Node.

The decode deadline is fixed at 120 seconds, including process startup, regardless
of probed duration. Decoder threads are capped at two and output threads at one;
ffmpeg's maximum individual allocation is 256 MiB, not an aggregate RSS cap.
All video subprocess stdout/stderr capture remains capped at 16 MiB combined.
Progress emits at a 60-second interval plus completion. A deadline or overflow
sends SIGKILL to the owned subprocess; collection stops after settlement. Pull
and probe retain their individual 10-second deadlines. Stop's 15-second caller
wait can return pending while the worker continues verification with heartbeats;
repeated stop does not restart decoding or recording.

The generated real-codec regression in
`validation/video-stream-verification/test-video-stream.mjs` corrupts the AVCC
NAL length in a packet after 2.5 seconds of a three-second H.264 MP4. Probe and
opening-frame decoding still succeed, but full verification fails. The worker
fixture uses those real bytes and real ffmpeg, faking only recorder transport:
partial bytes/hash, codec, size, duration, caller verdict, and diagnostics survive;
no promoted file or recapture occurs, and repeated stop is immutable. Other
fixtures cover a truncated tail, valid CFR, and valid bursty VFR. Unit tests cover
missing EOF/frames, zero duration, timeouts, output overflow, exit-zero diagnostics,
CLI/MCP partial status, stop races, artifact read failures, and heartbeats through
decode and final artifact persistence.

At the 180-second recording cap, 60-fps H.264 fixtures fully decoded at 720x1280,
1280x720, and 1920x1080 in approximately 5.0, 6.5, and 10.3 seconds respectively
on the validation host. The harness enforces the production deadline and runs in
the shared validation suite and PR CI with ffmpeg installed. This measures the
default maximum in both orientations and one explicit full-HD size; it does not
guarantee arbitrary dimensions, higher frame rates, other codecs, or slower hosts.
The requested size contract is unchanged and budget overruns remain partial.


Live R14 validation used only the assigned Android 16 / API 36 emulator, CLI
0.10.0, and the matching locally built debug Operator 0.10.0-d. The recording
reached its 60-second cap and finalized complete at 576x1280 with 60,571.956 ms
of probed media duration and approximately 60,287.6 ms of host duration. An
independent full `framemd5` decode succeeded for all 116 frames; the last frame
started at 44.920589 seconds and held through the remaining media timeline.
Inspected opening, middle, and final decoded frames showed the Settings list,
Display & touch page, and return to the list. Artifact hashes/byte counts matched,
the original failed caller verdict remained unchanged, and two terminal stop
calls returned complete without changing the manifest.

A subsequent Network & internet click returned `NODE_NOT_FOUND` on the scrolled
Settings list. That failed action was retained and does not count as navigation
proof or justify a recapture. An initial start was denied access to local lock
storage before recorder startup; after that host permission was available, the
single recording above ran. No shared ADB-server operations or other devices
were used. Private media, snapshots, action failures, and decoder output remain
outside Git.

Final R14 validation passed all 1,554 Node tests with no skips, the complete
validation suite (including real-codec fixtures), the matching debug APK build,
and the documentation build (32 navigation pages and 394 generated-doc links,
no organization warnings). An initial Node test invocation overlapped a validation
build that replaced `dist/`; it was discarded, then the full suite passed after
the build completed. The separate R13 and manual supported-image release gates
are unchanged; media verification does not establish result-transport readiness.
