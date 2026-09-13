# Result transport causal follow-up

Implementation and bounded validation are merged through `b7ff0695` (PR #290).
The historical post-dispatch reader-exit cause remains unresolved. Retain this
pack for that acceptance gap; do not repeat completed implementation phases.

## Permanent sources

- [Transport contract, causal findings and retained attempts](../../../docs/internal/design/result-transport-reliability.md)
- [Latest diagnostic verification](../../../docs/internal/design/result-transport-reliability.md#diagnostic-verification-and-current-release-limits)
- [Public transport errors](../../../docs/api/errors.md#result-transport-failures)
- [Fixed-series harness and prerequisites](../../../validation/result-transport-reliability/README.md)
- [Integrated hierarchy harness](../../../validation/sensitive-hierarchy-access/README.md)

## Remaining outcome

The independent audit at `6367227a` observed `RESULT_TRANSPORT_EXITED`, exit 255,
empty stderr, sent dispatch, a correlated Android command-start event and zero
received chunks. Controlled reader-connection interruptions later reproduced
that symptom while independent strict reassembly proved successful Android
publication. This demonstrates one possible mechanism, not the historical cause.
The original zero-event timeout also remains causally unproven.

Use the merged reader timeline and publication markers to capture a naturally
failing attempt with simultaneous independent host/protocol and device/process
observations. Distinguish reader termination, publication loss and service
failure. Make only evidence-supported repairs with deterministic regressions;
otherwise report the specific causal limit. A later passing series or injected
disconnect does not establish the historical cause.

Keep all original codes, command/task correlation, strict integrity checks,
authoritative Android results and explicit dispatch uncertainty. Never replay
an accepted or uncertain mutation, fabricate a terminal envelope, inflate
arbitrary timeouts or weaken the fixture to obtain a pass. Publication markers
mean logging writes returned, not host delivery. Keep raw captures private.
A replacement transport or durable retrieval mechanism requires separate scope.

## Completion

Follow [work-breakdown.md](work-breakdown.md) for bounded verification. Close the
causal gap through demonstrated evidence and repairs, or obtain an explicit
release-scope decision accepting or deferring it. Preserve the decision and its
limits in the permanent design record before retiring this pack. The manual
supported-image CI gate is separately tracked in the
[release acceptance plan](../../releases/v0.10/plan.md).
