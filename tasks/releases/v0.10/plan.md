# v0.10 release acceptance

All planned feature implementations are merged through `b7ff0695` (PR #290).
Implementation is complete; release acceptance remains open for the historical
result-reader cause and the manual supported-image CI regression. Do not treat
local passing samples or added diagnostics as closing those gates.

## Completed implementation

The feature packs have been retired except for the remaining result-transport
causal follow-up. Durable contracts and validation live at the links below.

| Item | Delivered behavior | Permanent record |
| --- | --- | --- |
| R1 | [DONE] Selected Operator readiness | [Doctor readiness](../../../docs/internal/design/doctor-readiness.md) |
| R2 | [DONE] Scaffold failure propagation | [Skill scaffold execution](../../../docs/internal/design/skill-scaffold-execution.md) |
| R3 | [DONE] On-screen logs CLI | [On-screen logs](../../../docs/internal/design/on-screen-logs.md) |
| R4 | [DONE] Structured inspection and relational matching | [Selector inspection](../../../docs/internal/design/selector-inspection.md) |
| R5 | [DONE] Strict scoped selection and duplicate hints | [Strict action selection](../../../docs/api/selectors.md#strict-action-selection) |
| R6 | [DONE] Action receipts and failure evidence | [Action diagnostics](../../../docs/internal/design/action-result-diagnostics.md) |
| R7 | [DONE] Compact snapshots and raw artifacts | [Compact snapshots](../../../docs/internal/design/compact-snapshots.md) |
| R8 | [DONE] Still evidence bundles | [Still evidence](../../../docs/internal/design/still-evidence.md) |
| R9 | [DONE] Managed video | [Managed video](../../../docs/internal/design/managed-video.md) |
| R10 | [DONE] Sensitive hierarchy access; manual CI evidence pending | [Hierarchy access](../../../docs/internal/design/accessibility-hierarchy.md) |
| R11 | [DONE] Scroll container eligibility transitions | [Scroll validation](../../../docs/internal/design/action-result-diagnostics.md#scroll-eligibility-transition-validation) |
| R12 | [DONE] Verified hierarchy harness preparation | [Integrated acceptance](../../../validation/sensitive-hierarchy-access/README.md#integrated-hierarchy-and-transport-acceptance) |
| R13 | [DONE] Transport repairs and diagnostics; causal acceptance pending | [Transport findings](../../../docs/internal/design/result-transport-reliability.md) |
| R14 | [DONE] Full-stream video verification | [Video verification](../../../docs/internal/design/managed-video.md#full-stream-verification) |

## Remaining gates

1. **Result-transport causal acceptance.** Follow the
   [remaining transport pack](../../node/result-transport-reliability/plan.md).
   The audit's reader exit after confirmed Android start remains causally
   unresolved. Latest instrumentation validation passed 60/60 commands per
   variant and verified injected disconnects, failure-log persistence and MCP
   metadata preservation. It did not capture a natural recurrence or close the
   historical cause. Resolve that gap or record an explicit release-scope
   decision before claiming readiness.
2. **Manual supported-image CI proof.** Dispatch the existing
   [Sensitive hierarchy access workflow](../../../.github/workflows/sensitive-hierarchy.yml)
   against the release-candidate source and retain its run URL and artifacts.
   It must pass the full Android 15 Internet query/XML regression for both
   matching APK variants on the supported English API-35 Google APIs x86_64
   revision-9 image. Local arm64 passes, focused preparation checks and retries
   do not replace it. The documentation audit on 13 September 2026 found no
   listed runs for this workflow. Keep it manual, without PR or push triggers.
3. **Final integrated candidate verification.** Record the final source commit,
   CLI/APK build identities and all declared attempts. Use existing evidence
   where it covers the delivered revision; run the combined Node suite,
   relevant Android unit/build checks, docs build and affected live harnesses
   for uncovered candidate changes. Verify CLI help, strict/query results,
   compact projection, still bundles, managed-video lifecycle and overlay
   interaction together. Retain supported-device limits and every failure.
   Affected sibling skill contracts require coordinated migration/versioning
   and smoke checks before compatibility is claimed.

The earlier six-case debug/release fresh/subpage/search matrix at `306b38d`
passed, including Display scrolling, query/MCP/XML parity and PNG checks. The
later reader-exit recurrence remains in the transport record alongside passing
series. Full-stream media proof does not establish transport reliability.

## Scope and retirement

Unrelated skill preflight, recording export, doctor setup findings and I/O
optimization work remain separate. Reports, application-specific assertions,
recovery policy and agent planning belong to consumers. Preserve original
verdicts and never replay uncertain mutations to fill evidence gaps. There is no
new clock/timer feature beyond the existing overlay stale-panel TTL.

Retire this plan once the remaining gates have evidence or explicit dispositions
in their permanent homes. Retire the transport pack when its causal acceptance
is resolved or explicitly accepted/deferred. This plan does not authorize
version changes, publication or deployment; those use the release workflow.
