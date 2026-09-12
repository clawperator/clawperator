# PR-1 Implementation Prompt

Implement `tasks/node/evidence-capture` PR-1 (R8): portable screenshot/hierarchy bundles with correlated manifests and partial failures. Scope is Phase 1 in [work-breakdown.md](work-breakdown.md), with [plan.md](plan.md) as the contract and source pointers.

Prerequisite: No additional feature dependency. Verify any required merges in your implementation branch before dependent work.

Reuse capture primitives and preserve useful image evidence when hierarchy capture fails. The caller owns test verdicts and reports.

Complete this PR through implementation, the specified regression and applicable live evidence, in-scope repairs, docs/status updates, and narrow local commits. Make routine implementation choices within the contract; continue until acceptance is satisfied or an external blocker leaves specific evidence unproven.

Do not implement or scaffold PR-2 managed video capture; it needs a separate handoff after PR-1 merges. Finish with commits and a concise account of validation and any remaining blocker. This prompt does not authorize pushing, merging, or release publication.
