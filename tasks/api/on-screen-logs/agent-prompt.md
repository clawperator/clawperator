# PR-2 Implementation Prompt

Implement `tasks/api/on-screen-logs` PR-2: the `on-screen-log set` and `clear` CLI commands and the public-interface regression/capture proof. This includes Phases 3-4 in [work-breakdown.md](work-breakdown.md), using [plan.md](plan.md) as the contract.

PR-1 is merged in `120c1eb782bbed67e1cb1fbe7c2080fdb302ff5d`; verify that prerequisite in your implementation branch. The shipped API and prior proof are documented in `docs/api/on-screen-logs.md` and the pack's findings. Consult the work breakdown's source pointers as needed.

Keep the CLI thin over the canonical validator and existing mutation execution path. Preserve no replay after uncertain dispatch, raw aliases, API-level limits, and string-valued results. Capture visible labels with separate awaited set, screenshot, replacement, screenshot, and clear executions; redesigning capture interleaving is outside this PR.

Complete the commands, tests, relevant live checks, in-scope repairs, docs, and status updates, then commit validated logical units. Continue through both phases without pausing after the first implementation. Use branch-local tools and a dedicated debug device for live verification; record unavailable evidence honestly.

Finish when PR-2's acceptance criteria and relevant checks are satisfied. It is the final PR in this pack, not authorization to implement other packs, add timers/metadata inference, publish, or merge. Report commits, proof results, and any remaining blocker. Keep the task pack for finalization.
