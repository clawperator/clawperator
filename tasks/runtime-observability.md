# Runtime observability task sequence

Six generic task packs, eight implementation PRs. All are not started. These are task-author handoffs, not implementation changes. Baseline source: main 5d23af5; live exploration used installed CLI/Operator 0.9.5. Read each pack's plan and work breakdown before implementation. Phase tests and public docs ship with the behavior.

| Order | Pack | PRs | Dependency | Why |
| --- | --- | --- | --- | --- |
| 1 | [Selected Operator readiness](node/readiness-verification/plan.md) | 1 | None | Preparation cannot claim readiness without a matching handshake |
| 1 | [Scaffold failure propagation](node/scaffold-failure-propagation/plan.md) | 1 | None | Preserve failed child status and streams |
| 2 | [Selector inspection](selector-inspection/plan.md) | 2 | Internal merge gate | Query state first, then strict scoped actions |
| 3 | [Action diagnostics](action-result-diagnostics/plan.md) | 1 | Both selector PRs | Truthful targets, failures, and scroll evidence |
| 3 | [Compact snapshots](node/compact-snapshots/plan.md) | 1 | Selector PR-1 | Bounded structural output with retained raw evidence |
| 3 | [Evidence capture](node/evidence-capture/plan.md) | 2 | Internal merge gate | Still bundles first, managed video second |

Order is a suggested rollout, not a claim that all work must block downstream consumers. Readiness and scaffold fixes are bounded. Selector and receipt contracts remove recurring correctness workarounds. Compact output and evidence can proceed once their explicit dependencies permit. Still evidence does not depend on new selectors or receipts: callers can attach opaque original context.

Default application roles are device preparation, not a new core runtime blocker. Document capability-checked provisioning and verification in the readiness task. Restricted-root diagnostics are handled through the action-failure contract; no unsupported system-dialog workaround is promised.

Existing on-screen display work is independent and owned by its active task/branch. These packs do not modify its API or introduce timing requirements. If it merges before implementation, re-read changed tree metadata/CLI files and preserve the new behavior while adding tests for interactions.

Use `.agents/skills/task-author-review/SKILL.md` before execution and `.agents/skills/task-cleanup/SKILL.md` after completion. Keep packs through their internal merge gates. Migrate contracts to the authored docs listed in each pack; never leave temporary tasks as the only API documentation. Remove completed index rows during cleanup, and remove this index when all listed work is complete.
