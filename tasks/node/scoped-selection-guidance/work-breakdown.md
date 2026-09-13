# Work breakdown

One focused PR; independent of the metadata and state-root changes.

1. Trace selection diagnostics through the canonical result and CLI/MCP outputs.
   Compare existing docs with the observed overlap scenario; fix only evidenced
   presentation gaps and add the coherent walkthrough using docs-author.
2. For Node edits run Node build then tests, adding regressions for lost warnings
   and unchanged structured results. If Android behavior must change, justify it
   within the diagnostic scope and run assembleDebug and testDebugUnitTest.
   A docs-only outcome needs no unrelated runtime suite.
3. Validate the walkthrough through the branch-local CLI on an explicit device,
   matching development Operator and an app/fixture exposing overlapping lists.
   Retain candidate, ancestor, warning, chosen-container and target-found evidence;
   assert the intended destination. If the app is unavailable, identify the
   missing live case; existing external evidence is not a new verification run.
4. Run `./scripts/docs_build.sh` using docs-build, repair in-scope failures, record
   sanitized evidence, update pack/release status and commit validated work.

Stop after diagnostics/examples. Do not relax strictness, change occlusion
semantics or implement ANR recovery. Documentation completion cannot stand in
for validation of any changed runtime presentation.
