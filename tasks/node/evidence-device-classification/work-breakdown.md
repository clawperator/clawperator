# Work breakdown

One implementation PR; no dependency on other new packs.

1. Add focused metadata regressions and implement the classification/read-outcome
   policy in plan.md. Verify status propagation to both evidence paths.
2. Update canonical docs in the same change. Run
   `npm --prefix apps/node run build && npm --prefix apps/node run test`, then
   `./scripts/docs_build.sh` with the docs-build skill.
3. Check connected devices before selecting explicit targets. Use the branch-local
   CLI and matching `com.clawperator.operator.dev` APK. Capture a still and a short
   video on physical hardware with absent flags, then inspect manifests, hashes,
   hierarchy and decoded video. Verify emulator classification separately.
   Prerequisites: ready Operator, writable output/state and ffmpeg/ffprobe.
4. Record sanitized source/version and observed outcomes in permanent docs;
   distinguish unit evidence from any unavailable live matrix rows. Fix in-scope
   failures, update pack/release status, and commit validated logical units.

Stop after this scope. Do not publish or implement video-root changes. Missing
live prerequisites leave live acceptance unproven, not passed.
