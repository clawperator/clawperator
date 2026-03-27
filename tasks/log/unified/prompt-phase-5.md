# Phase 5: Docs and Design Notes - Unified Logging Task

You are executing Phase 5 of the unified logging task in the `feature/unified-logging-pr-2` branch. Phases 0-4 are complete. Your job is documentation only - no code changes to `apps/node/src/` except possibly `registry.ts` if the help text needs correction.

## Required reading (read every file before writing anything)

Read these in this exact order:

1. `.agents/skills/docs-author/SKILL.md` - **the governing workflow for all documentation work**. Follow it exactly. It requires reading code before writing docs, one page per commit, and a reread step after each draft.
2. `docs/internal/documentation-drafting-north-star.md` - documentation philosophy (referenced by docs-author skill)
3. `tasks/log/unified/plan.md` - the stable contract: routing table, event schema, naming table, expected log output examples
4. `tasks/log/unified/work-breakdown.md` - Phase 5 section for deliverables and acceptance criteria
5. `CLAUDE.md` - repo rules, especially the documentation discipline section

Then read these source files (code is the source of truth, not existing docs):

6. `apps/node/src/contracts/logging.ts` - `LogEvent`, `LogLevel`, `ClawperatorLogger`, routing rules, path utilities
7. `apps/node/src/adapters/logger.ts` - unified logger implementation, `createClawperatorLogger`, `child()`, fail-open
8. `apps/node/src/cli/commands/logs.ts` - `clawperator logs` implementation
9. `apps/node/src/cli/registry.ts` - search for `COMMANDS["logs"]` to see the registered command
10. `apps/node/src/domain/observe/events.ts` - EventEmitter (separate from logger, needs design note)
11. `apps/node/src/cli/commands/serve.ts` - serve logging (routes through unified logger)

Also read these exemplar docs to match the quality bar:

12. `docs/api/environment.md` - exemplar for configuration/environment pages (already covers `CLAWPERATOR_LOG_DIR` and `CLAWPERATOR_LOG_LEVEL`)
13. `docs/api/overview.md` - exemplar for API reference

## What to produce

### Deliverable 1: Public docs page - `docs/api/logging.md`

A new page covering the unified logging system for agents using Clawperator. Write from the code in `contracts/logging.ts` and `adapters/logger.ts`, not from the plan docs.

Must include:
- Where logs are written (`~/.clawperator/logs/clawperator-YYYY-MM-DD.log`)
- NDJSON format with `LogEvent` field table (ts, level, event, message, plus optional fields)
- Log levels: `debug`, `info`, `warn`, `error` with threshold behavior
- Event naming conventions (dot-separated, prefix-based routing)
- The `clawperator logs` command: dumps existing content then streams new lines, Ctrl+C to stop, exits 0
- At least one concrete JSON example showing a log line
- How `--log-level` controls the file threshold
- Fail-open behavior: if log directory is unavailable, one stderr warning, then continues
- Cross-reference to `docs/api/environment.md` for `CLAWPERATOR_LOG_DIR` and `CLAWPERATOR_LOG_LEVEL` (do not duplicate that content)

Do NOT document internal routing rules, `child()` context propagation, or the `ClawperatorLogger` TypeScript interface - those are internal implementation details, not agent-facing.

### Deliverable 2: Internal design note - `docs/internal/design/unified-logging.md`

An internal design note for engineers working on the codebase. This is NOT public docs. Write from the code.

Must include:
- The unified logger contract and routing rules (reference the routing table in `contracts/logging.ts`)
- Why EventEmitter (`domain/observe/events.ts`) remains separate from the logger: it carries rich in-memory objects (`ResultEnvelope`, `RunExecutionResult`) to SSE clients, which are not suitable for NDJSON serialization. The logger handles file and terminal routing.
- Why `clawperator logs` is file-based (reads the NDJSON file) rather than subscribing to the logger in-process
- Why skill terminal streaming stays on the `onOutput` callback rather than going through the logger's terminal routing
- `child()` context propagation pattern
- Deferred work: potential future EventEmitter-to-logger unification

### Deliverable 3: Nav and build integration

1. Add `docs/api/logging.md` to `sites/docs/mkdocs.yml` nav in the API Reference section
2. If the page uses code-derived content markers, update `sites/docs/source-map.yaml`
3. Run `./scripts/docs_build.sh` and confirm it succeeds

## Workflow

Follow the docs-author skill workflow exactly:

1. Read code first (files listed above)
2. Draft `docs/api/logging.md` based on what the code does
3. Commit: `docs: draft logging page - verified against contracts/logging.ts and adapters/logger.ts`
4. Reread the draft against the code. Fix issues found.
5. Commit: `docs: refine logging page - <what you fixed>`
6. Draft `docs/internal/design/unified-logging.md` based on the code
7. Commit: `docs: draft unified-logging design note - verified against contracts/logging.ts and observe/events.ts`
8. Reread and refine if needed
9. Update `sites/docs/mkdocs.yml` nav
10. Run `./scripts/docs_build.sh` - must pass
11. Commit the nav change and any regenerated output together

## Rules

- **Code is the source of truth.** Do not write from `plan.md` or `work-breakdown.md`. Read the actual code.
- **One page per commit.** Do not batch `logging.md` and `unified-logging.md` into one commit.
- **Reread every draft.** Compare against code. Fix errors before moving on.
- **Do not duplicate content** from `docs/api/environment.md`. Cross-reference it.
- **Do not use em dashes.** Use regular hyphens.
- **Never shorten Clawperator to Claw.**
- **`./scripts/docs_build.sh` must pass** before you stop.
- Do not modify any files in `apps/node/src/` except fixing help text in `registry.ts` if it is inaccurate.
- Do not push. Stop after your final commit.

## Acceptance criteria

- `docs/api/logging.md` exists and covers all items listed in Deliverable 1
- `docs/internal/design/unified-logging.md` exists and covers all items listed in Deliverable 2
- `sites/docs/mkdocs.yml` nav includes the logging page
- `./scripts/docs_build.sh` succeeds with no errors
- An agent reading only `docs/api/logging.md` could find the log file, understand its format, and use `clawperator logs` to tail it
- No terminology violations (grep for "receiver", "observe snapshot", "Claw " in docs/)
