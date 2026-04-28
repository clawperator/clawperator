# Personalized Skills Implementation Instructions

You are implementing `tasks/skills/personalized-skills` `PR-1` only.

## Prerequisite

- No merge gate. Current task pack is a single-PR task.

## Goal

Implement `PR-1`: audit, create required personal wrappers, verify OpenClaw
discovery and live behavior, and publish personalized-skill guidance.

This PR includes only:

- Phase 1: Audit And Policy Findings
- Phase 2: No-Argument Battery And Energy Wrappers
- Phase 3: Basic Netflix Wrapper
- Phase 4: Unified HVAC Control Wrapper
- Phase 5: Durable Public Documentation

## Hard Boundary

- This task pack has no later PR. Complete only the five phases named above.
- Do not work on bundled-skill symlink behavior.
- Do not redesign Clawperator runtime skill registry behavior.
- Do not commit real private labels, device serials, account identifiers,
  credentials, tokens, profile names, or personal routines to this repo.
- Personal skill files under `~/.agents/skills/` or
  `~/.openclaw/workspace/skills/` are not repo files. If they are tracked
  elsewhere, commit them in that owning repo separately. In this repo, commit
  task findings/docs changes only.

## Context-Building Order

1. Read `tasks/skills/personalized-skills/plan.md`.
2. Read `tasks/skills/personalized-skills/work-breakdown.md`.
3. Confirm the PR / Phase Plan maps `PR-1` to phases 1-5.
4. Read `tasks/skills/fix-repeatable-skills/findings.md` before doing Phase 1.
5. Read `.agents/skills/docs-author/SKILL.md` before Phase 5.
6. Read directly referenced source-of-truth files before relying on technical
   claims.

## Operating Rules

- Execute phases strictly in order.
- After each phase, run that phase's validation, fix failures, update
  `findings.md` or `finalization-items.md` as required, and commit before
  starting the next phase.
- Update this file as execution progresses. Keep the status table current,
  record commits, validations, blockers, and review-loop status.
- Phase 2 must document `## Test Script Convention` in `findings.md` before
  creating wrappers.
- Each wrapper must have an executable local test script that passes before
  OpenClaw discovery/live validation.
- Use `openclaw skills list --eligible --json`,
  `openclaw skills info ... --json`, and
  `openclaw agent --message ... --json` exactly as the task pack requires, or
  record concrete blockers.
- For `home-hvac-control`, create only the unified user-facing skill. Do not
  create split user-facing HVAC wrappers.

## Execution Status

| Phase | Status | Commit | Validation / Notes |
| --- | --- | --- | --- |
| Phase 1: Audit And Policy Findings | complete | `15948340` | Read implementation instructions, plan, work breakdown, prior findings, AGENTS.md, docs-author guidance, docs north star, current skills docs, runtime contracts, and sibling skills repo entrypoints. Confirmed PR-1 maps to phases 1-5 only. Created `findings.md`; `openclaw skills list --eligible --json` confirmed `agents-skills-personal`; Phase 1 validation commands passed. |
| Phase 2: No-Argument Battery And Energy Wrappers | complete | `458dfc8a` | Re-read `findings.md`; target home is `~/.agents/skills/`. Created `home-battery-get-level` and `home-energy-get-yesterday-usage-cost` in `~/.agents/skills/`; both local static command-shape tests passed; OpenClaw list/info discovery passed for both; exact live `openclaw agent --message ... --json` calls were attempted and blocked by missing `--to`, `--session-id`, or `--agent`; blocker recorded in `findings.md`. |
| Phase 3: Basic Netflix Wrapper | complete | `b2ace7e7` | Re-read Phase 2 results in `findings.md`; personal skill home is visible to OpenClaw. Created `media-netflix-set-my-list-state` in `~/.agents/skills/`; local intent mapping test passed for add, remove, and missing-title refusal; OpenClaw list/info discovery passed; live forward test recorded as blocked because My List mutation needs a user-approved safe title/profile and exact OpenClaw agent calls currently require `--to`, `--session-id`, or `--agent`. |
| Phase 4: Unified HVAC Control Wrapper | complete | `ea171acb` | Re-read Phase 2 and Phase 3 results in `findings.md`; personal skill home remains discoverable through OpenClaw. Created only `home-hvac-control` in `~/.agents/skills/`; local intent sequence test passed for ordered AirTouch power, zone, fan sequence, unknown alias refusal, no split wrappers, and partial-failure reporting; OpenClaw list/info discovery passed; split HVAC wrapper names were not discovered; live forward test recorded as blocked because HVAC mutation needs a user-approved safe window and exact OpenClaw agent calls currently require `--to`, `--session-id`, or `--agent`. |
| Phase 5: Durable Public Documentation | complete | `f3107b10` | Used `.agents/skills/docs-author/SKILL.md`; reread docs north star and docs navigation. Created `docs/skills/personalized.md`; updated `docs/skills/authoring.md`, `docs/index.md`, and `sites/docs/mkdocs.yml`; reran required validation checks; `./scripts/docs_build.sh` passed and regenerated `sites/docs/static/llms-full.txt` and `sites/landing/public/llms-full.txt`. |
| Review loop | in progress | `5664d9af`; `4ebf0ed4`; `ad1fc3dd`; personal repo `dc3f51f` | Review pass 1 found one material docs issue: fixed in `5664d9af`; reran `./scripts/docs_build.sh`, placeholder/em-dash checks, and all four personal wrapper tests. Review pass 2 found the personal wrapper directories were untracked in their owning `~/.agents` repo; committed them there as `dc3f51f`, recorded that in `findings.md`, and committed the ledger update as `4ebf0ed4`. Review pass 3 found stale task status and targetless OpenClaw validation examples; fixed in `ad1fc3dd`. Running review pass 4 against the same scope. |

## Execution

### Phase 1

1. Create `tasks/skills/personalized-skills/findings.md` with the required
   structure.
2. Confirm whether OpenClaw loads `~/.agents/skills/` via
   `"source": "agents-skills-personal"` or requires
   `~/.openclaw/workspace/skills/` via `"source": "openclaw-workspace"`.
3. Seed all four required skill rows.
4. Validate and commit:

```text
docs(tasks): capture personalized skills findings
```

### Phase 2

1. Create and test `home-battery-get-level`.
2. Create and test `home-energy-get-yesterday-usage-cost`.
3. Run local command-shape tests before OpenClaw validation.
4. Verify discovery and live-call results through OpenClaw.
5. Update `findings.md` and `finalization-items.md` if needed.
6. Validate and commit repo task updates:

```text
docs(tasks): verify home-battery and home-energy personal wrappers
```

### Phase 3

1. Create and test `media-netflix-set-my-list-state`.
2. Required tests: add title, remove title, missing title does not run.
3. Verify discovery and safe OpenClaw forward test, or record safe-test blocker.
4. Validate and commit repo task updates:

```text
docs(tasks): verify Netflix personal wrapper
```

### Phase 4

1. Create and test `home-hvac-control`.
2. It is a personal AgentSkills `SKILL.md` wrapper, not a Clawperator
   orchestrated runtime skill.
3. Required tests: expected multi-command AirTouch sequence, unknown alias does
   not run without clarification/inspection, partial failure reports exact
   failed step.
4. Verify discovery and safe OpenClaw forward test, or record blocker.
5. Validate and commit repo task updates:

```text
docs(tasks): verify unified HVAC personal wrapper
```

### Phase 5

1. Use `.agents/skills/docs-author/SKILL.md`.
2. Create `docs/skills/personalized.md`.
3. Update `docs/skills/authoring.md`, `docs/index.md`, and
   `sites/docs/mkdocs.yml`.
4. Run `./scripts/docs_build.sh`.
5. Draft and refine docs as required by the task pack.
6. Commit:

```text
docs(skills): add personalized skills guidance
```

and, if needed:

```text
docs(skills): refine personalized skills guidance
```

## Review Loop

After the final Phase 5 commit, run `$review-swarm-loop` for `PR-1` only,
scoped to:

- `tasks/skills/personalized-skills/`
- `docs/skills/personalized.md`
- `docs/skills/authoring.md`
- `docs/index.md`
- `sites/docs/mkdocs.yml`
- the chosen personal skill home paths for:
  - `home-battery-get-level`
  - `home-energy-get-yesterday-usage-cost`
  - `media-netflix-set-my-list-state`
  - `home-hvac-control`

Then:

1. Fix all actionable review-loop findings in the main agent.
2. Validate each fix pass.
3. Commit each successful fix pass.
4. Repeat `$review-swarm-loop` until it reports no material findings for the
   `PR-1` scope.
5. Stop and report completion, commits, validations, OpenClaw live-test results,
   and any recorded blockers.
