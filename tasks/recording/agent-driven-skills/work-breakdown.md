# Agent-Driven Skills Work Breakdown (W2b)

## Executive Summary

Concrete phases for the W2b pack. See `plan.md` for scope, decision
rules, and output contract. See
`tasks/recording/refactor-plan.md` for the architectural framing.

## Status

| Item | Value |
| --- | --- |
| Total PRs | 2 |
| Total phases | 5 |
| Completed | none |
| Remaining | P1, P2, P3, P4, P5 |
| Current / Next | P1 after W2 lands |
| Blockers | W2 (`skill-result-contract/`) must define `SkillResult` and `runSkill` parsing first |

## Hard Rules

- Do not start P2 until P1 has committed every "Required Decisions In
  P1" item from `plan.md`. Partial decisions cause churn in the
  runtime implementation.
- Do not land P3 (Solax retrofit) before P2 is green. The Solax skill
  is the first real consumer of the runtime path and should not
  validate against a half-built runtime.
- Do not declare P4 (reliability validation) passed on fewer than 10
  runs. The reliability threshold (8/10 to terminal verification, no
  `runtime_poisoned`) is load-bearing for the video.
- Do not couple `SkillResult` parsing to the presence of an agent CLI.
  `SkillResult` is emitter-agnostic by W2's decision and must stay
  that way.
- Do not ship the recording export into the runtime agent's prompt.
  SKILL.md is the only program the runtime agent reads.
- Do not allow agent-driven skills to bypass declared-inputs
  validation. `runSkill` validates inputs before the agent is spawned.

## Required Reading

Before starting P1, read:

- `tasks/recording/refactor-plan.md`
- `tasks/recording/agent-driven-skills/plan.md`
- `tasks/recording/skill-result-contract/plan.md` and
  `work-breakdown.md` (especially the `SkillResult` shape and the
  `runSkill` parsing contract after W2)
- `apps/node/src/contracts/skills.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/cli/registry.ts` (to verify the primitive allowlist)
- `apps/node/src/domain/doctor/checks/` (to pattern-match the new
  agent CLI check against existing checks)
- `.agents/skills/docs-author/SKILL.md` and
  `.agents/skills/docs-build/SKILL.md` (repo-local precedents for
  markdown-as-program workflows that already exist in this checkout)
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/`
  (the current scripted Solax baseline)

## PR / Phase Plan

| PR | Phases | Repo | Purpose |
| --- | --- | --- | --- |
| PR-W2b-1 | P1, P2 | clawperator | runtime contract and implementation for agent-driven skills |
| PR-W2b-2 | P3, P4 | clawperator-skills (and small docs follow-up in clawperator) | Solax retrofit and reliability validation |

P5 is a documentation-only handoff phase and can be folded into
PR-W2b-2 or shipped as a small follow-up PR depending on how large
the docs changes end up.

## Phase P1: Commit The Agent-Driven Runtime Contract

### Goal

Nail down every "Required Decisions In P1" item from `plan.md` so P2
implementation has no ambiguous edges.

### Steps

1. Draft the `skill.json` `agent` block schema (cli, cliPath,
   timeoutMs, minVersion) and add it to a design note under
   `docs/internal/design/` if the shape is not self-evident in code.
2. Verify the proposed primitive allowlist against
   `apps/node/src/cli/registry.ts`. Record the final list.
3. Decide the exact agent input shape. Default recommendation:
   SKILL.md passed as the agent's program, inputs passed as a JSON
   blob via `CLAWPERATOR_SKILL_INPUTS` env var plus argv
   passthrough.
4. Decide the error code string (`SKILL_AGENT_CLI_UNAVAILABLE`) and
   the exact error payload shape.
5. Decide the agent CLI resolution order (`skill.json.agent.cliPath`
   wins over `PATH`; `PATH` wins if `cliPath` is null).
6. Decide the stderr policy (free-form agent reasoning allowed,
   forwarded by `runSkill`, not part of `SkillResult`).
7. Decide the timeout interaction (`runSkill` outer timeout is
   authoritative; `skill.json.agent.timeoutMs` picks the default if
   the caller did not pass `--timeout`).
8. Decide the checkpoint-invention policy (agent may not invent
   checkpoint identities outside SKILL.md; unreachable declared
   checkpoints are `skipped`; final status is `indeterminate`
   unless terminal verification still holds).
9. Decide the reliability threshold (10 runs, 8/10 reach terminal
   verification, no `runtime_poisoned` states).
10. Capture all of the above in a single design note or plan
    addendum so P2 has a single source of truth.

### Acceptance Criteria

- every decision in `plan.md` under "Required Decisions In P1" has a
  committed answer with rationale
- the answer for the primitive allowlist has been verified against
  `apps/node/src/cli/registry.ts`, not guessed
- the answers live in code, a design note, or this pack's files, not
  only in chat

### Expected Commit

```text
chore(tasks): commit agent-driven skill runtime contract decisions
```

## Phase P2: Implement Agent-Driven `runSkill` Support

### Goal

Extend `runSkill` and the skills contract so a skill with an `agent`
block in its `skill.json` runs via the configured agent CLI, with
typed failure paths and doctor coverage.

### Steps

1. Extend `apps/node/src/contracts/skills.ts` to include the optional
   `agent` block on the skill shape, plus the
   `SKILL_AGENT_CLI_UNAVAILABLE` error variant.
2. Update the registry loader to preserve the `agent` block when
   reading `skill.json`.
3. Extend `apps/node/src/domain/skills/runSkill.ts`:
   - detect agent-driven skills via the `agent` block
   - validate declared inputs against the `skill.json` inputs schema
     before spawning
   - resolve the agent CLI per the resolution order decided in P1
   - if the CLI is missing, return `SKILL_AGENT_CLI_UNAVAILABLE`
     without spawning anything
   - spawn the agent with SKILL.md as the program argument and
     inputs as an env var blob plus argv
   - forward stdout and stderr
   - parse the emitted `[Clawperator-Skill-Result]` frame via the
     existing W2 parser
   - enforce the outer timeout; if it hits, kill the agent cleanly
     and return a typed error
4. Add a `clawperator doctor` check under
   `apps/node/src/domain/doctor/checks/` that verifies the
   configured agent CLI is available on PATH (or at the configured
   path). Surface a clear remediation message.
5. Add regression tests under `apps/node/src/test/` covering:
   - agent CLI missing returns `SKILL_AGENT_CLI_UNAVAILABLE`
   - agent CLI present but exits non-zero returns a typed failure
     with agent stderr captured
   - agent emits a malformed `SkillResult` frame returns a typed
     parse error
   - agent emits `status: indeterminate` returns that status intact
   - agent emits `status: success` returns the full typed object
   - input validation fails before the agent is spawned
   - outer timeout kills the agent cleanly
   - an agent-driven run that takes a non-deterministic recovery
     path but still reaches terminal verification is reported as
     `success` with the actually-reached checkpoints
6. Update `docs/skills/overview.md` and `docs/skills/authoring.md`
   once the runtime path is green.

### Acceptance Criteria

- `runSkill` detects agent-driven skills via the `agent` block, not
  by filename inspection or heuristics
- `SKILL_AGENT_CLI_UNAVAILABLE` is returned cleanly before any
  spawn attempt when the CLI is missing
- input validation rejects invalid inputs before spawn
- `npm --prefix apps/node run build && npm --prefix apps/node run test`
  is green, including the new regression tests
- `clawperator doctor` reports agent CLI availability
- docs describe the agent-driven orchestrated shape accurately

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
clawperator doctor --json
```

### Expected Commit

```text
feat(skills): run agent-driven skills via configured agent CLI
```

## Phase P3: Author The Solax Orchestrated Skill As Agent-Driven

### Goal

Build
`com.solaxcloud.starter.set-discharge-to-limit-orchestrated` in
`../clawperator-skills` as the first real agent-driven orchestrated
skill. Prove the runtime contract from P2 against a live device.

### Steps

1. Create the skill directory structure:
   ```text
   skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/
     SKILL.md
     skill.json
     scripts/run.js
   ```
2. Author `skill.json` with the declared `agent` block and the
   declared `contract` block (see W3 for the contract block shape;
   if W3 has not landed yet, ship a minimal `contract` scaffold that
   W3 can fill out).
3. Author the thin `run.js` harness following the boilerplate
   pattern from P1/P2. It should:
   - read SKILL.md from its own directory
   - resolve the agent CLI from env or `skill.json`
   - spawn the agent with SKILL.md as program and inputs as env var
     plus argv
   - forward stdout and exit with the agent's exit code
4. Author `SKILL.md` as an agent program. It must:
   - declare the inputs schema (`percent: integer[0,100]`)
   - declare the goal (`set_discharge_limit`)
   - enumerate the required checkpoint identities (aligned with the
     W2 replay coarse subset and the W2 orchestrated full list)
   - describe the allowed primitives the agent may call
   - describe at least one recovery branch (e.g. "if the
     Intelligence tab is not visible after opening the app, close
     and reopen once; if still not visible, emit SkillResult with
     `status: failed`")
   - describe the terminal verification rule (`Discharge to
     <percent>%` row present in the UI)
   - describe the emission rules (exactly one
     `[Clawperator-Skill-Result]` frame at the end; status chosen
     per the verification outcome)
5. Register the new skill in the skills registry.
6. Smoke-test the skill against a live Samsung target via:
   ```bash
   clawperator skills run com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --json -- 40
   ```
7. Confirm the SkillResult frame parses cleanly, terminal
   verification matches, and the expected checkpoint identities are
   present.

### Acceptance Criteria

- the skill exists in `../clawperator-skills` and is loadable via
  `clawperator skills get`
- `skills run` against a live device returns a typed `SkillResult`
  with `status: success` and terminal verification matching
  `Discharge to 40%`
- the agent's turn-by-turn reasoning is visible on stderr during the
  run (for operator debuggability and for the video)
- no checkpoint identities outside the declared list appear in the
  emitted result

### Expected Commit

```text
feat(solax): author agent-driven discharge limit orchestrated skill
```

## Phase P4: Reliability Validation

### Goal

Prove the Solax orchestrated skill is reliable enough to back the
video's "reliably run" claim, and document what reliable means in
practice.

### Steps

1. Define the cleaned baseline starting state for each run. This
   must be reproducible (e.g., "app fully closed, discharge limit
   last set to 100%").
2. Run the Solax orchestrated skill 10 times with input `percent:
   40` and a clean baseline before each run.
3. Capture the emitted `SkillResult` for each run by saving the full
   `clawperator skills run --json` output to
   `docs/internal/design/reliability/` using the `tee` pattern below.
   Use `docs/internal/design/` because `tasks/recording/` will be
   deleted when the recording program closes; reliability evidence
   must survive that cleanup.
4. For each run, record:
   - final status (success / failed / indeterminate)
   - checkpoint identities reached and their statuses
   - whether terminal verification matched
   - total runtime in milliseconds
   - failure mode (if any), classified by cause
5. Compute the success rate and compare against the threshold
   (>= 8/10 reach terminal verification with `status: success`;
   zero `runtime_poisoned` states).
6. If the threshold is not met, classify the dominant failure mode
   and open a fix (likely a SKILL.md instruction or recovery branch
   adjustment) before re-running.
7. Write a short reliability report capturing the measurement
   methodology, the raw run results, the final success rate, and
   any caveats (e.g., "requires app in foreground before start").
8. Include at least one **forced failure run** for the video's
   compare scene: put the app in a wrong starting state, run the
   skill, confirm it emits `status: failed` or `status:
   indeterminate` with a meaningful divergence checkpoint, and
   archive that `SkillResult` for Scene 11.

### Acceptance Criteria

- at least 10 clean runs captured with full `SkillResult` documents
- at least 8 runs reach terminal verification with `status:
  success`
- zero `runtime_poisoned` states across all runs
- at least one archived forced-failure run exists for Scene 11
- a reliability report and raw run results exist under
  `docs/internal/design/reliability/` and will survive deletion of
  `tasks/recording/`

### Validation

```bash
mkdir -p docs/internal/design/reliability
for i in $(seq 1 10); do
  clawperator skills run com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
    --device <device_serial> \
    --operator-package com.clawperator.operator.dev \
    --json -- 40 \
    | tee docs/internal/design/reliability/run-$i.json
done
```

### Expected Commit

```text
feat(solax): validate orchestrated skill reliability over 10 runs
```

## Phase P5: Handoff

### Goal

Make sure downstream packs (W3, W4, W6) and public docs pick up the
agent-driven orchestrated shape without drift.

### Steps

1. Confirm `skill-contract-declaration/` (W3) plan lists W2b as a
   blocker and references the agent-driven Solax orchestrated skill
   as its proving case.
2. Confirm `compare/` (W4) plan describes literal vs semantic
   comparison modes and uses at least one agent-driven Solax run as
   a proving case for the semantic mode.
3. Confirm `skill-author-by-recording/` (W6) plan lists SKILL.md +
   thin harness + skill.json as the authoring output contract and
   includes an authoring self-test loop that invokes the newly
   authored skill before declaring the authoring done.
4. Update `docs/skills/overview.md` and `docs/skills/authoring.md`
   so the public category story and authoring guidance match the
   shipped runtime.
5. Update `docs/internal/design/` with a short design note on the
   agent-driven runtime shape if the code alone does not carry the
   rationale (timeout interaction, stderr policy, checkpoint-
   invention policy).
6. Run `./scripts/docs_build.sh` to regenerate the docs site.

### Acceptance Criteria

- downstream pack plans reference agent-driven skills correctly
- public docs describe the agent-driven orchestrated shape and the
  `SKILL_AGENT_CLI_UNAVAILABLE` error
- `./scripts/docs_build.sh` succeeds end to end

### Expected Commit

```text
docs(skills): document agent-driven orchestrated runtime
```

## Out Of Scope For W2b

- agent CLI implementation (the program does not ship codex)
- shared SKILL.md template library
- streaming / progressive checkpoint emission
- cost, caching, or session reuse for the agent CLI
- prompt injection hardening
- authoring-time agent loop that writes SKILL.md from a recording
  (W6 owns that)
- scripted replay skill changes (W2 P3 owns those)

## Durable Follow-Up

- `tasks/recording/skill-contract-declaration/` (W3)
- `tasks/recording/compare/` (W4)
- `tasks/recording/skill-author-by-recording/` (W6)
- `tasks/recording/video-draft.md` Scenes 7, 8, 9, 10, 11, 12
- `docs/skills/overview.md`
- `docs/skills/authoring.md`
- `docs/internal/design/`
