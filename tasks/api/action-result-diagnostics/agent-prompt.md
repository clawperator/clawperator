# PR-1 Implementation Prompt

Implement `tasks/api/action-result-diagnostics` PR-1 (R6): precise action receipts, preserved failed-step evidence, and truthful scroll outcomes. Scope is Phase 1 in [work-breakdown.md](work-breakdown.md), with [plan.md](plan.md) as the contract and source pointers.

Prerequisite: Both selector-inspection PRs (R4 and R5) must be merged. Verify any required merges in your implementation branch before dependent work.

Use the merged NodeSummary/resolver and current task engine. Accepted dispatch is not a verified application postcondition; preserve existing overlay failure codes.

Complete this PR through implementation, the specified regression and applicable live evidence, in-scope repairs, docs/status updates, and narrow local commits. Make routine implementation choices within the contract; continue until acceptance is satisfied or an external blocker leaves specific evidence unproven.

Do not expand into other task packs. Finish with commits and a concise account of validation and any remaining blocker. This prompt does not authorize pushing, merging, or release publication.
