# Delivery and validation

One implementation PR; independent of the other new packs. Implement the
[plan's policy and acceptance cases](plan.md), including status propagation to
both evidence paths. Video-root changes are outside this pack.

## Required checks

- Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.
- Update the canonical docs named in the plan with
  `.agents/skills/docs-author/SKILL.md`; regenerate with docs-build and run
  `./scripts/docs_build.sh`.
- Check connected devices and select explicit physical and emulator targets.
  Use the branch-local CLI and matching `com.clawperator.operator.dev` APK.
  On physical hardware with absent flags, capture a still and short video;
  inspect manifests, terminal exits, hashes, hierarchy and decoded video.
  Verify emulator classification separately. Prerequisites: ready Operator,
  writable output/state and ffmpeg/ffprobe.

Record sanitized source/version and observed outcomes in the permanent docs
named in the plan. Fix in-scope failures, update pack/release status and commit
validated logical units. Missing live prerequisites leave acceptance open;
record exactly which rows remain unproven. Publication is outside this pack.
