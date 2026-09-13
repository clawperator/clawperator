# R13 implementation and evidence

Contract: [plan.md](plan.md). Coordination: [v0.10](../../releases/v0.10/plan.md).

## PR-1: diagnose, repair and verify result transport

Status: local implementation and declared series completed; remaining causal and release gates are explicit below. The following phases belong to the same PR; code normalization alone is not the complete deliverable.

### Phase 1: lifecycle evidence and stable errors

Reproduce early process exit/spawn failure with controlled subprocesses. Cover exit status, signal, stderr, correlation and known/unknown dispatch state. Replace prose-as-code fallback without flattening existing typed errors. Capture raw bounded stream evidence around live failures and identify which layer rejected or lost a result; preserve sensitive device output outside Git.

### Phase 2: regression-driven reliability repairs

Test stream fragments split across reads, coalesced messages, unrelated commands, chunk ordering, duplicate/conflicting chunks, missing chunks, malformed metadata, truncation and checksum/size mismatch. Valid accepted transport must reconstruct exactly once; invalid transport must fail with the correct bounded diagnostic, not be silently accepted. Test cancellation/cleanup and exit racing with a complete result. Prove no second mutation dispatch after an uncertain result.

Use observations to select narrowly scoped host or Android fixes. Do not assume that all three observed failures share a cause. If a live cause remains unreproduced, retain evidence and record that limit; do not claim a fix or mark the reliability phase complete based only on a later successful retry. Make bounded progress with deterministic fixtures and instrumentation, then report the specific unresolved blocker rather than an indefinite investigation or speculative rewrite.

### Phase 3: live proof and documentation

On the API-35 English emulator, test each matching debug/release variant separately with only its service active. Run immediate open/query sequences and full Internet queries using `--visibility all --limit 1000`, without shrinking payloads to evade chunking. Capture exact source/build versions, command IDs, attempt counts, output sizes, timings and every failure. Use a fixed declared series (at least 20 immediate open/query cycles and 20 repeated full queries per variant); never discard failed attempts or repeat the series until it happens to pass. A finite passing series supports the stated fixture only, not a zero-flake guarantee.

Run the checked-in hierarchy regression with R11/R12 integrated before recording full release readiness. Unresolved reproducible transport failures block that claim. Update error docs and durable design evidence, review consumer parity, update phase/release status, and commit validated work.

## Validation

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./validation/test_all.sh --suite validation
./scripts/docs_build.sh
```

If Android publication changes, also build both APK variants and run `unitTest`; install those exact builds for live proof. Follow AGENTS.md for additional affected-surface checks. Live harness prerequisites and invocation are in `validation/sensitive-hierarchy-access/README.md`; R12 owns preparation, not transport recovery.

Done includes verified error contracts, in-scope repairs supported by evidence, regression tests, completed declared live series, honest remaining limits, docs and local commits. Do not implement R11/R12, media tasks, publishing or an automatic emulator workflow as incidental fixes.

## Recorded outcome

- Phase 1: implemented and covered with controlled subprocesses, exit/signal/
  stderr evidence, correlation, cancellation and dispatch-state checks.
- Phase 2: fixed deferred dispatch after reader death and reproduced Android
  chunk loss. Added publication pacing and strict framing/consumer regressions.
  Not declared fully complete: the audit's original live exit-255 and zero-event
  timeout causes remain unreproduced and unproven.
- Phase 3: completed each fixed 20-cycle/20-query series on both paced variants.
  Debug retained one initial service-unavailable open (59/60 commands); release
  passed 60/60. Both passed all 40 full queries. No repeat-to-green series.
  Subsequent combined proof is recorded below; manual CI remains a release
  prerequisite.

Durable evidence, payload sizes, timings and build hashes:
[Result transport reliability](../../../docs/internal/design/result-transport-reliability.md).
The task pack remains active because these limits do not satisfy the full gate.

Validation completed: Node build and 1,478 tests; both APK builds and 447
Android unit tests; repository validation suite; docs build and route checks.
Implementation commit: `cd3e979`. No push or release publication was performed.

PR integration: merged main at `28b8b1fa` with background publication `be5f85ac`.
The integrated build passed 1,496 Node / 463 Android tests, both APK builds,
repository validation and docs. Combined debug hierarchy proof passed. Release
failed the unique Wi-Fi switch fixture on its first successful 24-node Internet
capture, followed by two successful 68-node captures with the switch. No retry
was made; preserve this failure and the manual CI gate. See durable evidence.


## Earlier combined acceptance (before the independent PR #285 audit)

Merged R11/R12/R13 plus harness fixes through `306b38d` passed all six
fresh/subpage/search full hierarchy runs across debug/release, and a new fixed
60-command transport series per variant passed 120/120 total. No runtime code
was changed beyond merged `0c4ed5ce`. The readiness and stale-binding setup
repairs, the earlier interrupted release series, and exact build identity are
preserved in the [acceptance record](../../../validation/sensitive-hierarchy-access/README.md#integrated-r11r12r13-acceptance).
At that revision the local combined-proof gap was closed. The later PR-2
recurrence below reopens causal follow-up in addition to the manual
supported-image release CI gate; neither authorizes replaying failed mutations or claiming zero failures
under all conditions. R12's completed pack is retired.

## PR-2: diagnose the recurring reader exit

Status: bounded investigation, safety repairs and local verification complete; recurring post-dispatch exit-255 cause unresolved. Keep the causal reliability and release gates open. The independent `6367227a` audit reproduced exit 255 during an Internet parity query after confirmed command start, with zero received chunks. Stable public diagnostics passed; causal reliability remains unresolved. The later declared debug/release transport series passed 120/120 commands and must be retained alongside the failure.

Reproduce with the checked-in hierarchy fixture and independent bounded stream/process diagnostics on the same build. Inspect logcat process lifecycle, reader startup/teardown, host cancellation and device logging separately; make only evidence-supported repairs. Capture raw failure context privately and add deterministic tests for the reproduced cause. Preserve existing codes, command IDs, strict chunk integrity and no-replay semantics. Run the original PR's relevant checks and a declared finite series plus the complete hierarchy fixture on both variants. Report unreproduced causes or remaining failures explicitly; a retry-to-green is not completion. Update durable causal findings and release status, then commit the validated scope locally.

R14 is independent. Do not turn this follow-up into media implementation or automatic emulator CI; the supported-image release workflow remains manual.

### PR-2 recorded outcome

- [DONE] Inspected subscription timing, process lifecycle, UTF-8 framing, strict
  reassembly and paced background publication. ADB source makes a missing remote
  shell exit packet a plausible explanation for host exit 255, not a proven cause.
- [DONE] Reproduced dispatch between process `exit` and pipe `close` with two
  failing regressions and a real inherited-pipe subprocess. Blocked new dispatch
  at exit while preserving late diagnostics and already dispatched terminal data.
  Independent broadcast errors retain their classification.
- [DONE] Prevented the fixed-series harness from issuing a later open after a
  failed open; retain failed and unrun attempts instead of replaying uncertainty.
- [DONE] Committed implementation as `b31f497e`, then ran one fixed 60-command
  series and one complete hierarchy fixture on each matching debug/release build.
  Both series passed 60/60, both hierarchy fixtures and Home cleanup passed.
  One pre-repair debug hierarchy baseline also passed. No repeat-to-green runs.
- [DONE] Node build and 1,528 tests, both APK builds and 463 Android tests,
  repository validation, docs build and route/link checks passed.
- [OPEN] No new live post-dispatch exit occurred under independent bounded
  logging and shell tracing. Its cause remains unproven, as does the historical
  zero-event timeout. A fresh failing protocol/process capture is needed for
  causal closure. The manual supported-image CI gate remains required.

Build hashes, timings, exact scope and retained evidence limits are in the
[PR-2 findings](../../../docs/internal/design/result-transport-reliability.md#pr-2-bounded-live-results).
Do not retire this pack or mark full reliability/release acceptance complete.
The initial local phase performed no R14 work, remote synchronization or
publication. Subsequent user-authorized review integrated upstream main for PR
creation; the causal and manual release gates remain open.

### PR review gate

- [DONE] The first delegated review found unbounded pre-dispatch draining when
  inherited pipes remain open. Independently reproduced and fixed in `308d42eb`
  using the configured wait budget and explicit pipe cleanup.
- [DONE] Merged main through `0b571d76` and obtained a fresh clean independent
  code review on `21c58729`; no actionable findings remain in that reviewed diff.
- [DONE] Integrated Node build and 1,565 tests, 463 Android tests, both APK builds
  and repository validation passed. Initial host-wrapper/environment failures
  remain in private attempt accounting.

The clean code review does not close the historical post-dispatch exit cause
or the manual supported-image release gate. Final live outcomes are recorded
in the durable findings; failed attempts remain failures.

Final integrated live verification at `21c58729`: both fixed series delivered
60/60 canonical envelopes, but each passed 59/60 fixture checks. Debug retained
one authoritative `UI_TREE_UNAVAILABLE`; release retained one successful query
of the loading screen without the expected sensitive root. Neither series was
repeated. Both complete hierarchy fixtures and Home cleanup passed; a preceding
debug invocation rejected by the device lock before commands remains recorded.
See the [review/integration record](../../../docs/internal/design/result-transport-reliability.md#clean-review-and-latest-main-integration).

### Post-merge diagnostic follow-up

- [DONE] Independently rechecked the retained audit failure. Two controlled
  reader-only connection interruptions reproduced post-start exit 255 while
  independent strict reassembly proved successful Android publication. This
  establishes one possible mechanism, not the historical cause.
- [DONE] Reproduced and fixed incorrect `stdoutObserved: false` after fallback
  dispatch. Preserve the existing dispatch and transport-integrity contracts.
- [DONE] Separate delivery/action/fixture outcomes in the manual harness and
  capture read-only failure observations before subsequent attempts. Preserve
  observation errors, including denied process listing, without masking the
  original failure.
- [OPEN] Historical causal investigation, a complete uninterrupted debug series
  for this follow-up, and the manual supported-image release gate. The debug
  series retained a host build-overlap failure and 19 unrun attempts. Release
  passed its single 60-command series. No retry-to-green claim is made.

See the [follow-up evidence](../../../docs/internal/design/result-transport-reliability.md#follow-up-controlled-connection-interruption-and-evidence-repair).
PR #288 merged as `7cdb31d4`; the causal gate remains open after that merge.
