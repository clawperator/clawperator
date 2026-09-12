# Make result transport failures typed and diagnosable

R13, follow-up to R6/R10 integration. Status: implemented locally with focused evidence; reliability/release gates remain open. One implementation PR containing investigation, in-scope fixes and evidence.

## Outcome and observations

Every failed result transport must expose a stable machine-readable code, preserve its original diagnostics and command correlation, and accurately describe dispatch uncertainty. Investigate and fix demonstrated causes of intermittent loss or malformed reassembly; do not declare the reliability work complete merely because codes are normalized.

The audit of `a44ad0bf` observed three distinct failures, not a proven common cause:

- A repeated debug Internet query returned both code and message as `logcat exited before terminal envelope (code=255, signal=null)`.
- A release Settings query after successful open returned `RESULT_ENVELOPE_TIMEOUT` with broadcast sent and no correlated events.
- Another release attempt at that query returned `RESULT_ENVELOPE_MALFORMED: Invalid result transport chunk`.

Between failures, doctor, open and ten consecutive full release Settings queries succeeded. This is intermittent evidence, not proof that transport is healthy or that accessibility caused the failures.

## Contract and boundaries

- Process spawn/early-exit errors must use stable documented codes, never dynamically generated message text. Reuse appropriate existing codes or add narrowly named codes; retain exit status, signal and original message as structured diagnostics where known.
- Preserve `commandId`, `taskId`, device/package and dispatch state on all failure paths. Unknown execution position stays unknown; payload-last is not observed Android progress. Do not fabricate a canonical terminal envelope or success from host inference.
- Preserve existing specific timeout/malformed/integrity codes and authoritative Android action failures. Transport failure must not erase already trustworthy evidence or replace a typed error with a generic string.
- Inspect subscription readiness, stream framing, chunk validation/reassembly and publication before selecting a fix. Correct only demonstrated causes. No transport replacement, arbitrary timeout inflation, weakened integrity checks or automatic replay of accepted/uncertain mutations.
- Exercise generic execution consumers (CLI, Serve, MCP and daemon routing as affected) so the same failure remains classifiable, non-successful and correlated. Add neither a reporting framework nor media capture here.

## Sources and dependencies

- `apps/node/src/adapters/android-bridge/logcatResultReader.ts`: process lifecycle and correlated stream reading.
- `apps/node/src/adapters/android-bridge/resultEnvelopeTransport.ts`: framing and chunk checks.
- `apps/node/src/domain/executions/runExecution.ts`: currently falls back from absent code to error prose.
- `apps/node/src/contracts/errors.ts`, `apps/node/src/test/unit/resultEnvelopeTransport.test.ts`, `apps/node/src/test/unit/runExecution.test.ts`: public errors and regression coverage; add lifecycle tests at the appropriate existing test location.
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/ResultEnvelopeTransport.kt`: Android chunk publication, if evidence implicates it.
- `validation/sensitive-hierarchy-access/`: real open/query reproduction and manual release integration; coordinate changes with R12.

R6/R10 are merged. This PR can begin independently of R11/R12. Full regression success needs their fixes; focused transport proof must not require falsely marking their failures passed. Keep any new reusable reliability harness under `validation/`; wire offline checks into existing test discovery and live checks into explicit/manual validation only.

Document public codes in `docs/api/errors.md` and durable causal findings, reproduction and limits in `docs/internal/design/result-transport-reliability.md`. Use docs-author/docs-build skills. Choosing exact new code names is an implementation decision subject to the existing error taxonomy, not an unresolved user approval.

## Local implementation outcome

Stable lifecycle codes, dispatch-after-exit prevention, bounded diagnostics and
Android chunk pacing are implemented. See the [durable findings and complete
attempt accounting](../../../docs/internal/design/result-transport-reliability.md).
The original debug publication reproduced three transport failures. Paced debug
had 59/60 successful commands (one service-startup failure); paced release had
60/60. Both variants completed all 40 full queries without transport failure.
The original live exit-255 and zero-event timeout causes remain unproven; the
reliability phase and release gates are not marked complete. After integration
with main, combined debug hierarchy proof passed; release retained a Wi-Fi
switch fixture-readiness failure. Manual CI remains outstanding.
