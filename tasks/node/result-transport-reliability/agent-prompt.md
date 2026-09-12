# PR-1 implementation prompt

Implement `tasks/node/result-transport-reliability` PR-1 (R13): normalize transport failures and investigate and repair result loss/reassembly. Scope includes all PR-1 phases in [work-breakdown.md](work-breakdown.md); [plan.md](plan.md) owns the behavior and source pointers.

The prerequisite runtime implementations are already merged in main through `a44ad0bf`. Verify current source and use the pack's distinction between independent implementation and combined release validation. Preserve strict selection, correlation and the prohibition on replay after uncertain mutation dispatch as applicable.

Complete implementation, relevant regression and live checks, in-scope repairs, docs/status updates and narrow local commits. Record specific unproven evidence or external blockers honestly; do not mark a passing retry as erasing a failed run.

Stop at this pack's PR-1 boundary. Do not absorb adjacent task packs or media work. This prompt does not authorize pushing, merging or publishing a release.
