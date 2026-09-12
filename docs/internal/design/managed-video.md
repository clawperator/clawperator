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
and an actual decoded frame checksum. The video is renamed only after these
checks. Encoder stderr (including an empty successful stream) and host capture
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
