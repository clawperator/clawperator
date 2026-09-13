# Full-stream video verification

Run `./validation/test_all.sh --suite validation` for the integrated check, or
build Node and run `node validation/video-stream-verification/test-video-stream.mjs`.
Requires ffmpeg/ffprobe with libx264. CI installs ffmpeg.
No device is used by this harness.

Fixtures are generated in a temporary directory and removed after the run:
valid CFR, a late damaged NAL packet with a decodable opening frame, a truncated
tail, bursty VFR, and 180-second 60-fps clips in both default maximum orientations
and full HD. Every production decode uses its actual deadline. Fixture encoding
has a separate 300-second deadline; subprocess diagnostics are bounded throughout.
The corrupt fixture also passes through worker finalization with simulated
recorder transport and real media subprocesses, checking retained partial bytes,
probe metadata, caller verdict, hashes, ownership release, and repeated stop.

An optional `VIDEO_FIXTURE_OUTPUT` environment variable names an existing local
directory in which to retain the small valid/corrupt/VFR fixtures. Do not commit
media or private live evidence. See the [design](../../docs/internal/design/managed-video.md#full-stream-verification-r14)
for resource limits and live validation findings.
