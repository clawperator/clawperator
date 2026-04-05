# Eval Phase 4: Skill Generation and Replay Eval

## Executive Summary

Extend the `android-version` eval with a secondary scoring dimension: did the
agent also produce a valid, reusable Clawperator skill? Add a replay eval that
runs the generated skill deterministically and scores its output.

1 PR, 3 sub-phases.

## Status

| Item | Value |
| --- | --- |
| State | in progress |
| Total PRs | 1 |
| Total phases | 3 (4a-4c) |
| Completed | 4a, 4b |
| Remaining | 4c |
| Current / Next | 4c |
| Blockers | none |

## Pre-Implementation Alignment Check

Before implementing Phase 4, the implementer must answer the following
questions by reading the current skill contracts and docs:

1. Read `apps/node/src/contracts/skills.ts` and `../clawperator-skills/` (the
   sibling repo). What is the minimal valid skill shape? Does it match what a
   naive agent would emit?

2. Is the generated artifact expected to be:
   - A deterministic runnable skill (executes the same action sequence every time)?
   - An agent-readable workflow scaffold (captures the strategy but is not itself
     deterministic)?
   - Something else?

   Answer this before writing `prompt-skill.md`. The prompt must tell the agent
   which format to produce.

3. The current product and docs story describes skills as "reusable app-specific
   workflow knowledge" that "lives above the runtime." A generated skill that is
   just an opaque LLM dump of tool calls may not align with this. Verify that the
   replay path (`clawperator skills run`) can actually execute what a LLM agent
   would produce.

4. If the skill contract is not stable enough to produce reliable replays,
   consider: is Phase 4 about measuring "can the agent produce a valid skill
   artifact" (structure test) or "can the skill actually run correctly"
   (execution test)? Both are valid but they require different prompts and
   different scorers.

**Hard rule:** Do not write `prompt-skill.md` until questions 1-4 above are
answered in `tasks/evals/phase-4/findings.md`.

## Goal

A single eval run can produce two scores:

1. **Task score** (already exists): did the agent determine the correct Android
   version?
2. **Skill score** (new): did the agent also emit a valid, runnable Clawperator
   skill for the task?

A replay eval runs the generated skill directly (without an LLM agent) and
scores whether it returns the correct answer deterministically.

## Why This Phase

The progression from "answer a question once" to "produce a reusable skill that
answers it reliably" is a meaningful step in agent capability. The replay eval
is also Clawperator's first self-hosted automation test derived from an LLM run
rather than hand-authored.

## In Scope

- New prompt variant for `android-version` that additionally asks the agent
  to emit a skill artifact alongside its answer
- A skill-extraction step in `scorer.py` that parses the emitted skill from
  the transcript
- A skill-validation step using `clawperator skills validate`
- A replay scorer that runs the extracted skill via
  `clawperator skills run` and checks the output
- `result.json` updated with `skill_score` block
- New sub-command: `python evals/run_eval.py android-version --replay <run_id>`

## Out of Scope

- Committing generated skills to the skills repo (manual step)
- Multi-skill eval (more than one generated skill per run)
- Automated retry loops for skill execution

## Existing Artifact Scope

| Artifact | Disposition |
| --- | --- |
| `evals/specs/android-version/prompt-public.md` | Unchanged (task score prompt) |
| `evals/specs/android-version/spec.json` | Add `skill_generation` section |
| `evals/harness/scorer.py` | Add skill extraction and validation |
| `result.json` | Add `skill_score` block |

## Surfaces and Ownership

| Surface | Path | Change |
| --- | --- | --- |
| Eval spec | `evals/specs/android-version/spec.json` | Add skill_generation config |
| Prompt (skill variant) | `evals/specs/android-version/prompt-skill.md` | New |
| Scorer | `evals/harness/scorer.py` | Skill extraction + validation |
| Replay runner | `evals/harness/replay.py` | New |
| CLI | `evals/run_eval.py` | `--replay` subcommand |
| Result schema | `result.json` | `skill_score` block |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Skill validation command | `apps/node/src/cli/registry.ts` (skills validate) |
| Skill run command | `apps/node/src/cli/registry.ts` (skills run) |
| Skill structure contract | `apps/node/src/contracts/skills.ts` (`SkillEntry` interface) |
| Skill validation behavior | `apps/node/src/domain/skills/validateSkill.ts` (requires skill in local registry) |
| Skill registry loader | `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Expected skill output | `[Clawperator-Result]` envelope with answer in `stepResults` |

**Important implementation note:** `clawperator skills validate <skill_id>` looks
up the skill by ID from the local skills registry (`~/.clawperator/skills/`),
not from an arbitrary file path. To validate an agent-emitted skill, you must
either:
1. Scaffold the skill into the registry directory and register it, validate,
   then clean up, OR
2. Perform structural validation in Python against the `SkillEntry` interface
   and the expected file structure (skill.json, scripts, artifacts).

Option 2 is simpler and sufficient for Phase 4. Reserve option 1 for a future
phase if structural validation proves too weak.

## Skill Score Schema

New block in `result.json`:

```json
"skill_score": {
  "skill_emitted": true,
  "skill_valid": true,
  "skill_validation_errors": [],
  "replay_attempted": true,
  "replay_status": "pass",
  "replay_answer_normalized": "15",
  "replay_answer_correct": true,
  "replay_wall_clock_s": 12.4
}
```

`replay_status` values:
- `pass` - skill ran and returned correct answer
- `fail` - skill ran but returned wrong answer
- `no_answer` - skill ran but emitted no answer
- `error` - skill failed to run (validation error, execution error)
- `skipped` - skill was not emitted or not valid

## Skill Emission Contract

The prompt instructs the agent to emit the skill as a JSON block bounded by
specific markers. The scorer looks for:

```
CLAWPERATOR_SKILL_START
<json skill content>
CLAWPERATOR_SKILL_END
```

The content between the markers is extracted and structurally validated against
the `SkillEntry` interface from `apps/node/src/contracts/skills.ts`. Required
fields: `id`, `applicationId`, `intent`, `summary`, `path`, `skillFile`,
`scripts` (array), `artifacts` (array). The prompt must tell the agent what
structure to produce. A naive agent that just emits an action list without the
registry wrapper fields will fail validation.

For replay, the extracted skill JSON and any referenced scripts are written to a
temp directory, temporarily registered, and executed via `clawperator skills run`.
The temp registration is cleaned up after the replay regardless of outcome.

## Deterministic Versus Judgment

| Aspect | Type | Rule |
| --- | --- | --- |
| Skill extraction from transcript | Deterministic | Extract content between `CLAWPERATOR_SKILL_START` and `CLAWPERATOR_SKILL_END` markers |
| Skill validation | Deterministic | Run `clawperator skills validate` and check exit code |
| Replay execution | Deterministic | Run `clawperator skills run` against the same device |
| Replay answer scoring | Deterministic | Same `normalize_version` + `score` as the task scorer |

## Decision Rules

| Question | Rule |
| --- | --- |
| If the agent emits multiple skill blocks? | Use the last one (same principle as answer marker). |
| If the skill fails validation? | Set `skill_valid = false`, `replay_attempted = false`, `replay_status = "skipped"`. |
| If replay execution times out? | Set `replay_status = "error"`, record wall_clock_s. |
| Does task score affect skill score? | No. Skill score is independent. A run can pass the task and fail the skill, or vice versa. |

## Failure Modes To Prevent

- Running the replay eval against a different device than the one used in the
  original run. Always use the same device serial from `config.json`.
- Writing the extracted skill to a permanent location. Use a temp directory.
  Clean it up after the replay.
- Blocking on replay execution indefinitely. Replay has its own wall-clock
  timeout (default 60s).

## Acceptance Criteria

Phase 4 is complete when:

1. At least 1 run with `--agent claude --mode full-repo` produces
   `skill_score.skill_valid = true`.
2. At least 1 replay run produces `skill_score.replay_status = "pass"` with
   the correct Android version.
3. `python evals/run_eval.py android-version --replay <run_id>` works on a
   run that contains an extracted skill.
4. A run that produces no skill block has `skill_score.skill_emitted = false`
   and `skill_score.replay_status = "skipped"`.

## Durable Follow-Up

| Item | Destination |
| --- | --- |
| Generated skills worth keeping | Manually reviewed and submitted to `../clawperator-skills` |
| Replay eval design notes | `docs/internal/design/` |
