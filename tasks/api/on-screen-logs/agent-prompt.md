# PR-1 Implementation Prompt

You are implementing `tasks/api/on-screen-logs` PR-1 only.

Goal: implement Phase 1 (Android controller and mechanism proof) and Phase 2 (raw execution contract and public documentation). The result is a generic Action Launcher-owned Clawperator feature. Keep all examples, fixtures, documentation, and implementation independent of external projects.

## Context-Building Order

1. Read `AGENTS.md`.
2. Read `tasks/api/on-screen-logs/plan.md`.
3. Read the execution summary, hard rules, required reading, findings format, and PR/phase table in `tasks/api/on-screen-logs/work-breakdown.md`.
4. Confirm PR-1 contains only Phases 1-2 and PR-2 is the stop boundary.
5. Read only Phases 1-2 and their source-of-truth files, in the specified order. Do not read later phase details except to confirm the boundary.

## Execution

Implement the two phases one at a time. For each phase, run its validation, fix failures, update findings and only that phase's status, and commit before proceeding. Use branch-local Node tools and the debug Operator; preserve unrelated working-tree changes. Follow the parameter defaults, replacement semantics, geometry, expiry, and draw-acknowledgement contract exactly. No ticking timer or host-driven elapsed updates.

Do not start, scaffold, partially implement, validate, or review Phase 3 or Phase 4. In particular, do not implement the CLI convenience command. Raw execution is sufficient for PR-1. Do not add temporary production ingress for the proof.

Use `.agents/skills/docs-author/SKILL.md` and `.agents/skills/docs-build/SKILL.md` for public documentation. Verify current code before editing; documentation is not evidence that a runtime path works. Tests belong in the same phase as new behavior. If the overlay mechanism cannot meet the interaction, isolation, or capture criteria, record the evidence and stop for a design decision rather than weakening the criteria.

After both phases are implemented, validated, and committed, run `$review-swarm-loop` for PR-1 only. Scope it to the changed files in these path groups:

- `apps/android/shared/data/operator/`
- `apps/android/shared/data/task/`
- `apps/android/shared/data/uitree/`
- `apps/android/shared/app/di/`
- `apps/android/shared/test/`
- `apps/node/src/contracts/`
- `apps/node/src/domain/executions/`
- `apps/node/src/mcp/tools/core.ts` and `apps/node/src/cli/commands/serve.ts`, only if modified for raw transport support
- `apps/node/src/test/`
- `validation/on-screen-logs/`
- `docs/api/` and the corresponding changed generated docs/navigation files under `sites/docs/`

Resolve the actual changed paths before review. If implementing the chosen controller requires another module, record its exact path in findings and include that PR-1 path in the review scope. Never include later-PR CLI convenience work. Fix actionable findings in the main agent, validate each fix, commit each successful pass, and repeat until no material findings remain. Record findings requiring PR-2 work as out of scope instead of implementing them.

Stop after PR-1 is validated, committed, and review-clean. Report observed live results, remaining limitations, and that PR-2 waits for PR-1 merge and explicit continuation. Do not merge, push, or begin PR-2 automatically.
