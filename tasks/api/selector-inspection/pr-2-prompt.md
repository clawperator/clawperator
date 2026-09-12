# PR-2 Implementation Prompt

Implement `tasks/api/selector-inspection` PR-2 (R5): strict, scoped action selection using the merged query resolver. Scope is Phase 2 in [work-breakdown.md](work-breakdown.md), with [plan.md](plan.md) as the contract and source pointers.

Prerequisite: This pack's PR-1 (R4) must be merged. Verify any required merges in your implementation branch before dependent work.

Preserve bounded wait/search behavior when a target is absent; ambiguity must prevent target dispatch. Reuse the merged resolver rather than creating another selector engine.

Complete this PR through implementation, the specified regression and applicable live evidence, in-scope repairs, docs/status updates, and narrow local commits. Make routine implementation choices within the contract; continue until acceptance is satisfied or an external blocker leaves specific evidence unproven.

Do not expand into other task packs. Finish with commits and a concise account of validation and any remaining blocker. This prompt does not authorize pushing, merging, or release publication.
