# Agent-Driven Skills Closeout Work Breakdown (W2b Follow-Up)

## Executive Summary

Concrete remaining work for the `skills/agent-driven` branches after the main
W2b runtime work. This pack should be used for implementation. The older
`agent-driven-skills/` pack remains the history and runtime-shape reference.

## Status

| Item | Value |
| --- | --- |
| Total PRs | 2 |
| Total phases | 3 |
| Completed | none |
| Remaining | C1, C2, C3 |
| Current / Next | C1 |

## Hard Rules

- Do not mark the skills-side PR ready before C3 is complete.
- Do not declare P4 reliability passed on fewer than 10 runs.
- Do not leave codex-only as an implicit implementation detail. If it is the
  shipped W2b v1 reality, document it.
- Do not preserve hidden runtime toggles as private operator knowledge.
- Do not broaden this pack into W3 or W4.

## Phase C1: Close Clawperator Runtime And Docs Gaps

### Goal

Finish the remaining Clawperator-side branch deltas so the runtime repo is
honestly PR-ready.

### Steps

1. Reject malformed `skill.json.agent` as a validation/runtime error instead of
   silently falling back to scripted execution.
2. Add regression coverage for that failure path.
3. Add `SKILL_AGENT_CLI_UNAVAILABLE` to the public error-code reference in
   `docs/skills/overview.md`.
4. Regenerate docs outputs and verify `./scripts/docs_build.sh`.

### Acceptance Criteria

- malformed agent metadata does not downgrade into replay/scripted execution
- the docs reference surface includes the missing typed error code
- build, tests, and docs build are green

## Phase C2: Thin The Solax Orchestrated Harness

### Goal

Turn the Solax orchestrated skill into a truthful codex-based W2b v1 reference.

### Steps

1. Move Solax-specific logic and runtime authority out of `scripts/run.js` and
   into `SKILL.md`.
2. Reduce `scripts/run.js` to codex-oriented harness duties only:
   - read env and local files
   - resolve the codex runtime invocation honestly
   - spawn the runtime agent on `SKILL.md`
   - forward output and signals
   - preserve the final framed result
3. Remove sibling-repo and branch-local build assumptions from the harness.
4. Remove any hidden sandbox or approval bypass knobs, or promote them into a
   declared/documented contract if the project decides they truly must ship.
5. Update the skill and public docs so the codex-only W2b v1 limitation is
   explicit if that remains the real runtime shape.

### Acceptance Criteria

- `SKILL.md` is the clear authority on skill behavior
- `scripts/run.js` is materially thinner and no longer acts like a Solax
  frontend
- the harness can run without author-workstation sibling-repo assumptions
- the codex-only limitation, if real, is documented honestly

## Phase C3: Complete Reliability Evidence

### Goal

Run and record the required live-device reliability pass for the Solax proving
skill.

### Steps

1. Define and document the clean baseline starting state used before each run.
2. Run the skill 10 times against the physical Samsung target with input `40`.
3. Save full JSON outputs and stderr transcripts under
   `docs/internal/design/reliability/solax-discharge-to-limit/`.
4. Include at least one forced-failure or recovery-case archive if the protocol
   calls for it.
5. Summarize:
   - success count
   - failure modes
   - whether any `runtime_poisoned` state occurred
   - whether the pack's threshold was met
6. Only after the evidence exists, update task-pack status files to reflect the
   true state.

### Acceptance Criteria

- at least 10 recorded runs exist
- the evidence is committed in the repo
- the threshold outcome is explicit and truthful
- PR readiness for the skills repo is based on evidence, not recollection

## Expected Commit Shape

Recommended local commit grouping:

1. `docs(tasks): add W2b closeout follow-up pack`
2. `fix(skills): reject malformed orchestrated agent metadata`
3. `fix(solax): thin orchestrated codex harness`
4. `docs(reliability): record Solax orchestrated validation runs`
