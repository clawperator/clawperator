# Delivery and validation

One implementation PR. Independent of metadata repair for development; use its
integrated result when asserting complete physical-device bundles.

Choose and document an atomic ownership mechanism satisfying the
[plan's cross-root exclusion contract](plan.md) before enabling the override.
Implement root resolution, caller/worker propagation and permission preflight
with that mechanism. Keep metadata failures distinct from ownership failures.

## Required checks

- Add deterministic process/race regressions for the plan's acceptance matrix,
  including same-device starts under different roots. Run
  `npm --prefix apps/node run build && npm --prefix apps/node run test`.
- Update the canonical docs named in the plan with
  `.agents/skills/docs-author/SKILL.md`; regenerate with docs-build and run
  `./scripts/docs_build.sh`.
- On an explicit connected device with the matching development Operator, use
  the branch-local CLI to start/status/stop from a restricted writable workspace.
  Use separate processes and roots to verify the second owner is rejected,
  inspect the resulting video, then confirm a fresh recording after clean stop.
  Requires ffmpeg/ffprobe and an environment reproducing denied home writes.

Record sanitized evidence and ownership rationale in the permanent docs named
in the plan. Fix in-scope failures, update pack/release status and commit
validated logical units. Identify untested restrictions or races as open
acceptance. Unrelated host changes and publication are outside this pack.
