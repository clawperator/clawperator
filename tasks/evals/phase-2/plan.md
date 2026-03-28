# Eval Phase 2: Additional Agents and Turn Budget

## Executive Summary

Add Gemini, Codex, and Kimi agent adapters to the harness. Activate turn
counting and turn budget enforcement. Add `--rescore` for re-scoring saved
transcripts without re-running an agent.

1 PR, 3 sub-phases.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total sub-phases | 3 (2a-2c) |
| Completed | none |
| Remaining | 2a, 2b, 2c |
| Current / Next | 2a |
| Blockers | Phase 1 PR must be merged before starting |

## Goal

All four agent types (claude, gemini, codex, kimi) can run the `android-version`
eval. `--max-turns` is enforced. Every run records `turns_counted` and
`turns_budget` in `result.json`. `turns_counted` is populated for Claude and
Gemini. For Codex and Kimi it is best-effort and may be null.

**Turn counting is a diagnostic metric only:**
- It is NOT used for pass/fail scoring.
- It is NOT comparable across agents (different agents define "turn" differently).
- It is recorded in `result.json` as `metrics.turns_counted` for human inspection.
- A run with `turns_counted = null` is fully valid.
- Do not build tooling that aggregates or compares `turns_counted` across agents in Phase 2.

## Why This Phase

Three of the four installed agents cannot run evals yet. Turn budgets prevent
runaway costs on expensive models. Turn counting also provides the first
diagnostic signal for inspecting agent behavior - not for cross-agent comparison.

## In Scope

- `evals/harness/agents/gemini.py`
- `evals/harness/agents/codex.py`
- `evals/harness/agents/kimi.py`
- `count_turn(line: str) -> bool` method added to `BaseAgent` and each adapter
- Turn budget enforcement in `runner.py`: `budget_exceeded` status activated
- `turns_counted` and `turns_budget` populated in `result.json`
- `--rescore <run_id>` flag in `run_eval.py`
- At least 1 passing run for each new agent type as validation

## Out of Scope

- `--runtime published` (Phase 3)
- `--mode full-repo` (Phase 3)
- Skill generation scoring (Phase 4)
- Cross-agent comparison tooling (lower priority, may be deferred to Phase 3)

## Existing Artifact Scope

| Artifact | Disposition |
| --- | --- |
| `evals/harness/agents/base.py` | Add `count_turn` abstract method |
| `evals/harness/agents/claude.py` | Add `count_turn` implementation |
| `evals/harness/runner.py` | Add turn counting loop + budget enforcement |
| `result.json` schema | `turns_counted` and `turns_budget` change from `null` to populated values |

## Surfaces and Ownership

| Surface | Path | Change |
| --- | --- | --- |
| Agent adapters | `evals/harness/agents/` | Three new adapters |
| Base agent | `evals/harness/agents/base.py` | `count_turn` added |
| Runner | `evals/harness/runner.py` | Turn counting + budget enforcement |
| CLI | `evals/run_eval.py` | `--rescore` flag activated |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Gemini CLI flags | `gemini --help` on this machine |
| Codex CLI flags | `codex exec --help` on this machine |
| Kimi CLI flags | `kimi --help` on this machine |
| Claude stream-json turn event shape | Empirical: run `claude -p "test" --output-format stream-json` and inspect output |
| Gemini stream-json turn event shape | Empirical: run `gemini -p "test" --output-format stream-json` and inspect output |
| Overarching design | `tasks/evals/plan.md` |

## Deterministic Versus Judgment

| Aspect | Type | Use | Rule |
| --- | --- | --- | --- |
| Turn counting for Claude/Gemini | Deterministic | diagnostic only | Parse stream-json lines. Count lines where `"role":"assistant"` or `"type":"message"` with assistant role. Document exact JSON key checked. |
| Turn counting for Codex/Kimi | Best-effort / may remain null. Not a gating metric. | diagnostic only, may be null | Approximate using heuristic markers visible in real output (empirically determined). Log a warning per run that turn counting is approximate for this adapter. If the heuristic fires fewer than 2 times in the full transcript, set `turns_counted = null`. |
| Budget exceeded status | Deterministic for Claude; conditional for Gemini (after 2a validation); not enforced for Codex/Kimi | enforcement only for structured-turn agents | `budget_exceeded` fires only when `count_turn` is reliable: Claude always, Gemini if empirical 2a inspection confirms reliable parsing, Codex/Kimi never. For Codex and Kimi, `budget_exceeded` is never emitted - wall-clock timeout is the only enforcement mechanism. |

## Decision Rules

| Question | Rule |
| --- | --- |
| If stream-json parsing fails for turn counting, what happens? | Log a warning, set `turns_counted = null` for the run, continue with wall-clock timeout only. Never crash the run. |
| How does `--rescore` work? | Load `config.json` from the run dir to get ground_truth. Read `transcript.txt`. Re-run scorer. Write a new `result.json` alongside the old one as `result-rescored.json`. Do not overwrite the original. |
| If the agent emits the answer before the turn budget is reached, does budget_exceeded fire? | No. Answer emission always wins over budget enforcement. |

## Failure Modes To Prevent

- Crashing the run if stream-json output is malformed. Always wrap parsing in
  try/except and fall back gracefully.
- Conflating turn count with message token count. A "turn" is one complete
  assistant response cycle, not a token batch.
- Making `count_turn` stateful per-line in a way that requires sequential
  processing. The method must be pure: given one output line, returns True if
  that line represents a completed turn.

## Acceptance Criteria

Phase 2 is complete when:

1. `python evals/run_eval.py android-version --agent gemini --model <model>`
   produces at least 1 passing run.
2. `python evals/run_eval.py android-version --agent codex --model <model>`
   produces at least 1 passing run.
3. `python evals/run_eval.py android-version --agent kimi --model <model>`
   produces at least 1 passing run.
4. Codex and Kimi passing runs may have `turns_counted = null` in
   `result.json` - this is expected and acceptable.
5. `python evals/run_eval.py android-version --rescore <run_id>` produces
   `result-rescored.json` without errors.
6. A Claude run with `--max-turns 2` that has not answered by turn 2 produces
   `outcome.status = "budget_exceeded"`. Codex and Kimi runs with `--max-turns`
   set do NOT produce `budget_exceeded` - they time out via wall-clock only.
   Gemini's enforcement is conditional on 2a empirical validation confirming
   reliable turn parsing.

## Durable Follow-Up

| Item | Destination |
| --- | --- |
| Turn counting heuristics per agent | Code comments in each adapter |
| Approximate-counting caveat | `evals/README.md` |
