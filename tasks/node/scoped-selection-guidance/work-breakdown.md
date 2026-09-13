# Delivery and validation

One focused PR; independent of the metadata and state-root changes. Trace
selection diagnostics through CLI/MCP outputs and deliver the
[plan's walkthrough](plan.md). Change runtime presentation only where inspection
establishes a gap; a verified docs-only result is a valid outcome.

## Dependencies and concurrency

Can start and merge independently of all other packs. Coordinate action/selector
presentation and shared docs with pack 4; this pack owns selection diagnostics
and the walkthrough. Linking to the query example is optional and must wait
until that target exists, without blocking this walkthrough. Serialize live
runs sharing the same device; see the
[release coordination rules](../../releases/v0.10.x/plan.md#dependencies-and-concurrent-work).

## Required checks

- For Node edits, add regressions for lost warnings and unchanged structured
  results, then run
  `npm --prefix apps/node run build && npm --prefix apps/node run test`.
  If Android diagnostic behavior changes within this scope, run
  `./gradlew :app:assembleDebug` and `./gradlew :app:testDebugUnitTest`.
  A docs-only outcome needs no unrelated runtime suite.
- Use `.agents/skills/docs-author/SKILL.md` for authored docs, docs-build for
  regeneration, and run `./scripts/docs_build.sh`.
- Validate the walkthrough through the branch-local CLI on an explicit device,
  matching development Operator and an app/fixture exposing overlapping lists.
  Retain candidate, ancestor, warning, chosen-container and target-found evidence;
  assert the intended destination. Existing external evidence is not a new live
  verification run. If the app is unavailable, leave that acceptance case open.

Record sanitized evidence in the permanent docs named in the plan. Fix in-scope
failures, update pack/release status and commit validated work. Scope exclusions
remain in the plan; documentation alone cannot validate runtime changes.
Publication is outside this pack.
