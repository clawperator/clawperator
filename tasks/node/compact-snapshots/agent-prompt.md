# PR-1 Implementation Prompt

Implement `tasks/node/compact-snapshots` PR-1 (R7): bounded structural snapshot output with access to unmodified raw evidence. Scope is Phase 1 in [work-breakdown.md](work-breakdown.md), with [plan.md](plan.md) as the contract and source pointers.

Prerequisite: Selector-inspection PR-1 (R4) must be merged for additive XML visibility. Verify any required merges in your implementation branch before dependent work.

Keep projection in the Node observe layer, preserve raw-mode compatibility, and retain the MCP restriction on caller-chosen host paths.

Complete this PR through implementation, the specified regression and applicable live evidence, in-scope repairs, docs/status updates, and narrow local commits. Make routine implementation choices within the contract; continue until acceptance is satisfied or an external blocker leaves specific evidence unproven.

Do not expand into other task packs. Finish with commits and a concise account of validation and any remaining blocker. This prompt does not authorize pushing, merging, or release publication.
