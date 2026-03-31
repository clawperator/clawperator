# Eval Phase 4 Work Breakdown

Parent plan: `tasks/evals/phase-4/plan.md`

## Executive Summary

1 PR, 3 sub-phases. Phase 3 PR must be merged before starting.

| Sub-phase | Purpose | Agent tier |
| --- | --- | --- |
| 4a | Skill emission prompt + extraction + validation | thinking |
| 4b | Replay runner and replay CLI subcommand | default |
| 4c | End-to-end validation with real generated skills | default |

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total sub-phases | 3 (4a-4c) |
| Completed | none |
| Remaining | 4a, 4b, 4c |
| Current / Next | 4a |
| Blockers | Phase 3 PR must be merged |

## Hard Rules

1. Do not start Phase 4 until Phase 3 PR is merged.
2. Never write extracted skills to a permanent repo location during a run.
   Always use a temp directory. Clean it up after replay.
3. Replay must use the same device serial from the original run's `config.json`.
4. Task score and skill score are always independent. Never combine them into
   one status field.
5. Replay has a hard wall-clock timeout of 60s by default.
   Accept `--replay-timeout-s` as an override.
6. One commit per sub-phase.
7. Update `tasks/evals/phase-4/plan.md` Status section after each sub-phase.

## Required Reading

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/evals/plan.md` | Overarching design, result schema |
| 2 | `tasks/evals/phase-4/plan.md` | Scope, skill score schema, decision rules |
| 3 | `apps/node/src/contracts/skills.ts` | Skill structure contract |
| 4 | `apps/node/src/cli/registry.ts` | `skills validate` and `skills run` command signatures |
| 5 | `apps/node/src/domain/skills/validateSkill.ts` | What validation checks |
| 6 | `evals/harness/scorer.py` | Current scorer to extend |
| 7 | `evals/harness/runner.py` | Current runner to understand integration point |
| 8 | `evals/specs/android-version/prompt-public.md` | Template for the skill prompt |

## PR / Phase Plan

| PR | Purpose | Included sub-phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-4 | Skill generation + replay eval | 4a, 4b, 4c | thinking/default/default | 1 valid skill generated; 1 passing replay |

---

## Sub-phase 4a: Skill Emission Prompt, Extraction, and Validation

### Agent Tier

thinking

### Goal

Design the skill emission protocol. Write the `prompt-skill.md` prompt variant.
Add skill extraction and validation to `scorer.py`. Update `spec.json`.

### Files or Surfaces To Change

- `evals/specs/android-version/prompt-skill.md` (new)
- `evals/specs/android-version/spec.json`
- `evals/harness/scorer.py`

### Steps

1. Read `apps/node/src/contracts/skills.ts` to understand the skill structure
   the agent must emit. What fields are required? What is the minimal valid
   skill that would pass `clawperator skills validate`?
   Document findings in `tasks/evals/phase-4/findings.md` (create now).

2. Write `evals/specs/android-version/prompt-skill.md`. It must:
   - Include everything from `prompt-public.md` verbatim.
   - Add a "Skill emission" section after the answer instructions:

     ```
     ## Skill Emission (optional but scored)

     After determining the Android version, you may also emit a reusable
     Clawperator skill that performs this task. If you choose to emit a skill,
     output it between these exact markers:

     CLAWPERATOR_SKILL_START
     <skill JSON here>
     CLAWPERATOR_SKILL_END

     The skill must be a valid JSON object that Clawperator can validate and run.
     The skill should open Android Settings, navigate to About phone, extract the
     Android version, and return it in its output. Structure it as a single
     Clawperator execution with the necessary actions.

     If you cannot produce a valid skill, omit the markers entirely.
     ```

3. Add `skill_generation` section to `spec.json`:
   ```json
   "skill_generation": {
     "skill_prompt": "prompt-skill.md",
     "skill_start_marker": "CLAWPERATOR_SKILL_START",
     "skill_end_marker": "CLAWPERATOR_SKILL_END",
     "replay_timeout_s": 60
   }
   ```

4. Add to `scorer.py`:
   ```python
   def extract_skill(transcript: str, start_marker: str, end_marker: str) -> str | None:
       """
       Extract the last skill JSON block from the transcript.
       Returns the raw JSON string or None if no complete block found.
       """

   def validate_skill(skill_json: str, clawperator_cmd: list[str], operator_package: str) -> tuple[bool, list[str]]:
       """
       Validate an agent-emitted skill JSON blob against the Clawperator skill
       contract. This is non-trivial because `clawperator skills validate`
       operates on registered skill IDs, not raw JSON files.

       Steps:
       1. Parse skill_json as JSON. If invalid JSON, return (False, ["invalid JSON"]).
       2. Create a temp skill directory structure that mimics a registered skill:
          - <tmpdir>/<skill_id>/SKILL.md  (can be empty)
          - <tmpdir>/<skill_id>/skill.json  (the emitted JSON)
          - <tmpdir>/<skill_id>/scripts/run.js  (if the skill references scripts)
       3. The skill_id to use: extract from the JSON's "id" field if present,
          otherwise generate a temp ID like "eval-generated-<timestamp>".
       4. Attempt structural validation by checking required fields against
          the SkillEntry interface in apps/node/src/contracts/skills.ts:
          Required fields: id, applicationId, intent, summary, path, skillFile,
          scripts (array), artifacts (array).
       5. If structural validation passes, optionally attempt
          `<clawperator_cmd> skills validate <skill_id>` if the skill can be
          temporarily registered. If this step is too complex for Phase 4,
          structural validation alone is acceptable - document the limitation.
       6. Clean up temp dir regardless of result.
       7. Return (is_valid: bool, errors: list[str]).
       """
   ```

5. Add unit tests for `extract_skill` in `evals/harness/test_scorer.py`:
   ```python
   # Single block
   t1 = "...\nCLAWPERATOR_SKILL_START\n{\"foo\":1}\nCLAWPERATOR_SKILL_END\n..."
   assert extract_skill(t1, "CLAWPERATOR_SKILL_START", "CLAWPERATOR_SKILL_END") == '{"foo":1}'

   # Last block wins
   t2 = "CLAWPERATOR_SKILL_START\n{\"v\":1}\nCLAWPERATOR_SKILL_END\n" \
        "CLAWPERATOR_SKILL_START\n{\"v\":2}\nCLAWPERATOR_SKILL_END"
   assert extract_skill(t2, "CLAWPERATOR_SKILL_START", "CLAWPERATOR_SKILL_END") == '{"v":2}'

   # No block
   assert extract_skill("no markers here", "CLAWPERATOR_SKILL_START", "CLAWPERATOR_SKILL_END") is None
   ```

6. Run unit tests:
   ```bash
   python -m pytest evals/harness/test_scorer.py -v
   ```

### Acceptance Criteria

- `prompt-skill.md` exists and contains both marker strings.
- `spec.json` has a `skill_generation` section.
- `extract_skill` unit tests pass.
- `validate_skill` function exists and is importable.

### Validation

```bash
python -m pytest evals/harness/test_scorer.py -v
python -c "from evals.harness.scorer import extract_skill, validate_skill; print('ok')"
```

### Expected Commit

```
feat(evals): add skill emission prompt, extraction, and validation
```

---

## Sub-phase 4b: Replay Runner and CLI Subcommand

### Agent Tier

default

### Goal

Implement `evals/harness/replay.py` and the `--replay <run_id>` subcommand.
Wire skill score into `result.json`.

### Files or Surfaces To Change

- `evals/harness/replay.py` (new)
- `evals/run_eval.py`
- `evals/harness/runner.py`

### Steps

1. Implement `evals/harness/replay.py`:
   ```python
   def run_replay(
       run_dir: Path,
       bin: str,
       operator_package: str,
       device_serial: str,
       timeout_s: int = 60,
   ) -> dict:
       """
       1. Load config.json from run_dir to get device_serial.
       2. Load transcript.txt and extract skill JSON.
       3. If no skill found: return skill_score with skill_emitted=False.
       4. Run validate_skill(). If invalid: return with skill_valid=False.
       5. Write skill to temp dir.
       6. Run: <bin> skills run <skill_id> --device <serial> --operator-package <pkg>
          with wall-clock timeout_s.
       7. Parse output for CLAWPERATOR_EVAL_ANSWER marker in skill output,
          OR look for the answer in the Clawperator result envelope output field.
       8. Score against original ground_truth from config.json.
       9. Clean up temp skill dir.
       10. Return skill_score dict.
       """
   ```

   Important: the replay scorer must find the answer from skill output. The
   skill may emit it as a structured result field or as text. Define and
   document how the skill is expected to surface the version string.
   Record the design decision in `findings.md`.

2. Wire skill scoring into `runner.py`: after the main run completes, if the
   spec includes `skill_generation` and the run used the skill prompt variant,
   call `run_replay` automatically. Add `skill_score` to `result.json`.

3. Add `--replay <run_id>` to `run_eval.py` as a separate code path:
   - Load the run directory.
   - Run `run_replay()` against it.
   - Write `result-replay.json` (analogous to `result-rescored.json`).
   - Print the replay status.

4. Add `--skill-prompt` flag to `run_eval.py` (optional, defaults to
   `prompt-public.md`). When set to `prompt-skill.md`, the skill emission
   markers are active.

### Acceptance Criteria

- `replay.py` imports without error.
- `python evals/run_eval.py android-version --replay <run_id_with_no_skill>`
  produces `result-replay.json` with `skill_score.skill_emitted = false`.
- `--skill-prompt prompt-skill.md` flag is accepted.

### Validation

```bash
python -c "from evals.harness.replay import run_replay; print('ok')"
# Run on a Phase 1 run that has no skill:
python evals/run_eval.py android-version \
  --replay <any_phase1_run_id>
cat evals/runs/<run_id>/result-replay.json | python -m json.tool | grep skill_emitted
```

### Expected Commit

```
feat(evals): add replay runner and --replay CLI subcommand
```

---

## Sub-phase 4c: End-to-End Validation with Generated Skills

### Agent Tier

default

### Goal

Run the eval with the skill prompt. Verify a valid skill is generated. Replay
it. Achieve at least one `replay_status = "pass"`.

### Steps

1. Run the eval with the skill prompt in `full-repo` mode
   (the agent has the best chance with full repo access):
   ```bash
   python evals/run_eval.py android-version \
     --agent claude --model claude-opus-4-5 \
     --mode full-repo \
     --skill-prompt prompt-skill.md \
     --device <serial>
   ```
2. Check if a skill was emitted and validate:
   ```bash
   python -m json.tool evals/runs/<run_id>/result.json | grep -A5 '"skill_score"'
   ```
3. If `skill_valid = false`, inspect the transcript to understand what the
   agent emitted and why it failed validation. Record in `findings.md`.
   Adjust the prompt if the failure is a prompt clarity issue (update
   `prompt-skill.md` and re-run).
4. Once a run produces `skill_valid = true`, run the replay:
   ```bash
   python evals/run_eval.py android-version --replay <run_id>
   ```
5. Verify `replay_status = "pass"` in `result-replay.json`.

### Acceptance Criteria

- At least 1 `result.json` with `skill_score.skill_valid = true`.
- At least 1 `result-replay.json` with `skill_score.replay_status = "pass"`.
- `findings.md` documents any prompt adjustments made and why.

### Validation

```bash
python -m json.tool evals/runs/<skill_run_id>/result.json \
  | python -c "import sys,json; d=json.load(sys.stdin); print(d['skill_score']['skill_valid'])"
python -m json.tool evals/runs/<skill_run_id>/result-replay.json \
  | python -c "import sys,json; d=json.load(sys.stdin); print(d['skill_score']['replay_status'])"
```

### Expected Commit

```
feat(evals): validate skill generation and replay with Phase 4 passing runs
```
