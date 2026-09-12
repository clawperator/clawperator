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
