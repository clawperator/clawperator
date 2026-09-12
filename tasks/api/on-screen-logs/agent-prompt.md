# PR-2 Implementation Prompt

You are implementing `tasks/api/on-screen-logs` PR-2 only.

Prerequisite: PR-1 merged in `120c1eb782bbed67e1cb1fbe7c2080fdb302ff5d` (PR #266), and PR-2 is explicitly requested. Verify that commit is an ancestor of your checkout. Use an isolated implementation branch/worktree if this tasking worktree is still in use; preserve unrelated task packs and user changes.

Goal: complete Phase 3 (CLI Convenience) and Phase 4 (Cross-Surface Regression and Handoff), one at a time. Expose `on-screen-log set` and `on-screen-log clear` as thin wrappers around the merged raw actions, then prove the complete public interface. Do not reimplement the renderer or raw API.

## Context-Building Order

1. Read `AGENTS.md`.
2. Read `tasks/api/on-screen-logs/plan.md`.
3. Read the summary, status, hard rules, required reading, findings format, and PR/phase table in `tasks/api/on-screen-logs/work-breakdown.md`.
4. Confirm PR-2 includes only Phases 3-4 and is the final PR. Read those phase sections and their directly referenced source files. Phases 1-2 are completed history, not work to repeat.
5. Read `tasks/api/on-screen-logs/findings.md` and `docs/api/on-screen-logs.md`, distinguishing prior live proof from work you must validate now.
6. Verify the current registry, `cli/commands/action.ts`, canonical validator, and daemon proxy against source before editing. Read the shipped controller only as needed for a directly implicated regression.

## Hard Boundary

Implement PR-2 only. Do not implement other task packs, named MCP tools, new Serve endpoints, screenshot-pipeline redesign, a video API, timing widgets, metadata inference, or a broader logging system. Do not start, scaffold, partially prepare, validate, or review follow-on work outside Phases 3-4. Keep all content generic to Clawperator and Action Launcher.

Preserve PR-1's strict raw schema, exact Node input aliases, string-valued result fields, API-level limitations, and caller-text semantics. Use the canonical validator for defaults and colors. Set/clear must use the existing mutation path with `allowPostDispatchFallback:false`; uncertainty after dispatch must not replay a command or renew its TTL.

Capture label evidence using separate awaited executions: set, screenshot, replacement set, screenshot, clear. Combined PR-1 set/screenshot/clear fixtures prove schema and a known ordering limitation, not visible-label capture. Keep that limitation documented. Use the public CLI for Phase 4 proof rather than only the debug proof Activity.

## Execution

For each phase, in order:

1. Implement only that phase, including its regression tests and authored docs.
2. Run that phase's validation with branch-local Node tools. Live proof requires the matching debug Operator, an explicit dedicated device, and enabled accessibility. Do not replace an APK on another agent's device.
3. Fix failures; record exact results and remaining limitations in findings. Historical PR-1 test results cannot stand in for your validation. Do not mark unavailable live gates passed.
4. Update only the current PR-2 phase's status and commit narrowly with the specified conventional message before moving to the next phase.

Use `.agents/skills/docs-author/SKILL.md` and `.agents/skills/docs-build/SKILL.md` for public docs. Restore device settings and clear the panel after proof. Retain screenshots/videos in ignored local artifacts; do not upload them.

After both phases are validated and committed, run `$review-swarm-loop` for PR-2 only, scoped to changed durable files in these explicit path groups:

- `apps/node/src/cli/registry.ts`, `apps/node/src/cli/commands/action.ts`, `apps/node/src/cli/daemonProxy.ts`
- `apps/node/src/domain/actions/onScreenLog.ts`
- `apps/node/src/test/unit/onScreenLogCommand.test.ts`, `apps/node/src/test/unit/cliRegistry.test.ts`, `apps/node/src/test/unit/cliHelp.test.ts`, `apps/node/src/test/unit/cliExitCode.test.ts`, `apps/node/src/test/unit/daemon/`
- `validation/on-screen-logs/`
- `docs/api/on-screen-logs.md` and directly changed API caveat pages: `docs/api/actions.md`, `docs/api/snapshot.md`, `docs/api/errors.md`, `docs/api/serve.md`, `docs/api/mcp.md`
- Generated outputs changed by the docs workflow under `sites/docs/.build/`, `sites/docs/static/llms-full.txt`, and `sites/landing/public/llms-full.txt`

Do not review unrelated tasking files or all of PR-1 again. If Phase 4 requires a directly implicated regression fix in an existing Android/Node source file outside that list, record the exact path and reason in findings and add only that changed file and its tests to the PR-2 review scope. A wider redesign requires a separate task.

Fix actionable review findings in the main agent, validate each fix pass, commit each successful pass, and repeat until no material PR-2 findings remain. Record out-of-scope findings as follow-up without implementing them.

Stop after PR-2 is validated, committed, and the scoped review loop clears. Report commits, proof results, and limitations. Keep this multi-PR task pack for finalization; do not run task-cleanup, push, or merge without the active workflow's authorization.
