# Work breakdown

One implementation PR. Independent of metadata repair for development; use its
integrated result when asserting complete physical-device bundles.

1. Inspect lifecycle callers and choose an atomic ownership design that satisfies
   cross-root exclusion. Record the rationale in permanent design docs. Implement
   root resolution, propagation and permission preflight with that design.
2. Add deterministic process/race regressions for the acceptance matrix, including
   same-device starts under different roots. Run Node build then full Node tests.
3. Update docs using docs-author and run `./scripts/docs_build.sh` via docs-build.
4. With an explicit connected device and matching development Operator, use the
   branch-local CLI to start/status/stop from a restricted writable workspace.
   Use separate processes and roots to verify the second owner is rejected,
   inspect the resulting video, then confirm a fresh recording after clean stop.
   Requires ffmpeg/ffprobe and an environment that can reproduce denied home
   writes. Keep any untested restriction/race explicit.
5. Fix in-scope failures, record sanitized evidence, update release/pack status,
   and commit validated logical units. Stop before unrelated host changes or
   publication. Do not label media metadata failures as ownership failures.
