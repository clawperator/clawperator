# Result transport remaining acceptance

Contract and boundaries: [plan.md](plan.md).

## Completed

- [DONE] Typed transport failures, correlation, strict reassembly, paced
  background publication and consumer parity, merged in `0c4ed5ce` (PR #282).
- [DONE] Exit-to-close dispatch protection, bounded pipe draining and harness
  no-replay sequencing, merged in `7cdb31d4` (PR #288).
- [DONE] Controlled connection-interruption proof, stdout-observation repair and
  independent delivery/action/fixture accounting, merged in `8a46043a` (PR #289).
- [DONE] Bounded reader lifecycle timeline and Android publication markers,
  merged in `b7ff0695` (PR #290). Latest debug and release series each passed
  60/60 delivery and fixture checks. This supplies a complete later debug
  series; the earlier build-overlap failure and 19 unrun attempts remain in the
  [durable evidence](../../../docs/internal/design/result-transport-reliability.md#diagnostic-verification-and-current-release-limits).

## Remaining work

1. Capture a natural recurrence using the merged instrumentation and independent
   bounded observations. Use the original API-35 English hierarchy fixture,
   with matching branch-local CLI/APK and only the selected service active.
   Retain shell completion/disconnect evidence, process state, command identity,
   output size, timing and publication observations. Do not run builds alongside
   live checks because a Node rebuild replaces `dist/`.
2. Diagnose only what the evidence supports. Add regression coverage and repair
   any demonstrated in-scope cause. If it does not reproduce within a declared
   bounded investigation, preserve the unresolved blocker instead of claiming
   closure or continuing indefinitely.
3. After a repair, run Node build/tests, repository validation, docs build and
   any affected Android builds/unit tests. Run one declared 20-cycle open/query
   plus 20 full Internet-query series per matching debug/release variant with
   `--visibility all --limit 1000`, plus the complete hierarchy fixture. Retain
   every failure and unrun attempt; a failed open stops subsequent mutation
   attempts. Distinguish transport delivery from action and fixture success.
4. Update permanent findings and release status with source/build identities,
   exact attempt accounting and causal limits. The manually dispatched
   supported-image CI run remains independently required. An explicit scope
   decision is required to accept or defer an unresolved release blocker.

Completed implementation, local passes and controlled disconnects do not close
the historical causal gate. Existing evidence can support unchanged surfaces;
do not rerun all historical phase commands simply to clean up this pack.
