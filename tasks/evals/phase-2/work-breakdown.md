# Eval Phase 2 Work Breakdown

Parent plan: `tasks/evals/phase-2/plan.md`

## Executive Summary

1 PR, 3 sub-phases. Sub-phases are sequenced; complete one before starting
the next. Phase 1 PR must be merged before starting.

| Sub-phase | Purpose | Agent tier |
| --- | --- | --- |
| 2a | Gemini, Codex, Kimi adapters + count_turn in base + Claude count_turn | default |
| 2b | Turn budget enforcement in runner.py + result schema changes | default |
| 2c | `--rescore` flag + validation runs for all three new agents | default |

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total sub-phases | 3 (2a-2c) |
| Completed | none |
| Remaining | 2a, 2b, 2c |
| Current / Next | 2a |
| Blockers | Phase 1 PR must be merged |

## Hard Rules

1. Do not start Phase 2 until Phase 1 PR is merged.
2. Never crash a run due to turn-counting parse failures. Log a warning and
   set `turns_counted = null`. Continue with wall-clock timeout.
3. `count_turn` must be a pure function of one output line. No state.
4. Wrap all stream-json parsing in try/except. Log the raw line that failed
   to parse at debug level.
5. Do not overwrite `result.json` during `--rescore`. Write `result-rescored.json`.
6. All validation runs use the branch-local CLI build and `.dev` Operator APK.
7. One commit per sub-phase.
8. Update `tasks/evals/phase-2/plan.md` Status section after each sub-phase.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/evals/plan.md` | Overarching design, agent CLI invocation table |
| 2 | `tasks/evals/phase-2/plan.md` | Scope, decision rules, acceptance criteria |
| 3 | `evals/harness/agents/base.py` | Current base class - understand interface before extending |
| 4 | `evals/harness/agents/claude.py` | Reference adapter to follow for pattern |
| 5 | `evals/harness/runner.py` | Current runner - understand where to add turn counting |
| 6 | `evals/harness/scorer.py` | Current scorer - understand before adding rescore path |

Before implementing each adapter, run the actual CLI to understand its
stream-json output:
```bash
# Claude (already known from Phase 1):
claude -p "say hello" --output-format stream-json --dangerously-skip-permissions 2>/dev/null | head -20

# Gemini:
gemini -p "say hello" --output-format stream-json --yolo 2>/dev/null | head -20

# Codex (no stream-json):
codex exec --dangerously-bypass-approvals-and-sandbox -m gpt-4o "say hello" 2>/dev/null | head -20

# Kimi:
kimi --print --yolo --output-format stream-json -p "say hello" 2>/dev/null | head -20
```

Record the exact output format for each in findings (create
`tasks/evals/phase-2/findings.md`).

## PR / Phase Plan

| PR | Purpose | Included sub-phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-2 | Additional agents + turn budget | 2a, 2b, 2c | default | 1 passing run per new agent; turns_counted populated; rescore works |

---

## Sub-phase 2a: Agent Adapters and `count_turn`

### Agent Tier

default

### Goal

Implement Gemini, Codex, and Kimi adapters. Add `count_turn` as an abstract
method to `BaseAgent` and implement it for all four adapters.

### Files or Surfaces To Change

- `evals/harness/agents/base.py`
- `evals/harness/agents/claude.py`
- `evals/harness/agents/gemini.py` (new)
- `evals/harness/agents/codex.py` (new)
- `evals/harness/agents/kimi.py` (new)
- `tasks/evals/phase-2/findings.md` (create)

### Steps

1. Run each agent CLI with a simple prompt to inspect stream-json output format.
   Record findings in `tasks/evals/phase-2/findings.md`. This is required
   before implementing any adapter.
2. Add `count_turn` to `BaseAgent`:
   ```python
   @abstractmethod
   def count_turn(self, line: str) -> bool:
       """
       Return True if this output line represents a completed agent turn.
       Must be a pure function of the line alone. No state.
       If the output format for this agent is not stream-json, approximate
       using heuristic markers documented in the adapter.
       """
   ```
3. Implement `count_turn` for `ClaudeAgent`. Expected: return True when the
   line is a valid JSON object with `"type": "message"` and `"role": "assistant"`.
   Wrap in try/except; return False on parse error.
4. Implement `GeminiAgent`. Use `gemini -p ... --yolo --output-format stream-json`
   as the base command. Implement `count_turn` from the empirical output.
5. Implement `CodexAgent`. Use `codex exec --dangerously-bypass-approvals-and-sandbox`.
   Codex does not support stream-json. Implement `count_turn` using heuristic
   markers observed in real output (e.g. "Applying changes" or similar agent
   completion signals). Add a prominent comment stating the count is approximate.
6. Implement `KimiAgent`. Use `kimi --print --yolo`. If `--output-format stream-json`
   is available and produces parseable turn events, use it. Otherwise approximate.
   Document the approach in a comment.
7. Update `__init__.py` in `evals/harness/agents/` to export all adapters.
8. Verify imports work:
   ```bash
   python -c "from evals.harness.agents.gemini import GeminiAgent; print('ok')"
   python -c "from evals.harness.agents.codex import CodexAgent; print('ok')"
   python -c "from evals.harness.agents.kimi import KimiAgent; print('ok')"
   ```

### Adapter Specifications

**`GeminiAgent.build_command`:**
```python
["gemini", "-p", prompt, "--model", self.config.model, "--yolo", "--output-format", "stream-json"]
```
Working directory controlled by cwd parameter to Popen (no explicit flag needed
for Gemini - it uses cwd).

**`CodexAgent.build_command`:**
```python
["codex", "exec", "--dangerously-bypass-approvals-and-sandbox", "-m", self.config.model, "-C", work_dir, prompt]
```

**`KimiAgent.build_command`:**
```python
["kimi", "--print", "--yolo", "--model", self.config.model, "--work-dir", work_dir, "-p", prompt]
```

### Acceptance Criteria

- All three new adapters import without error.
- Each adapter's `build_command` returns a list with the correct CLI binary
  as the first element.
- `count_turn` is defined on all four adapters.
- `findings.md` contains actual sample output from each of the four CLIs.

### Validation

```bash
python -c "from evals.harness.agents.gemini import GeminiAgent; print('ok')"
python -c "from evals.harness.agents.codex import CodexAgent; print('ok')"
python -c "from evals.harness.agents.kimi import KimiAgent; print('ok')"
```

### Expected Commit

```
feat(evals): add Gemini, Codex, Kimi adapters with count_turn
```

---

## Sub-phase 2b: Turn Budget Enforcement

### Agent Tier

default

### Goal

Wire `count_turn` into `runner.py`. Enforce `--max-turns`. Add
`budget_exceeded` status. Populate `turns_counted` and `turns_budget` in
`result.json`.

### Files or Surfaces To Change

- `evals/harness/runner.py`

### Steps

1. Add a running `turns: int = 0` counter to the main poll loop in `runner.py`.
2. After each output line is written to the transcript, call:
   ```python
   try:
       if agent.count_turn(line):
           turns += 1
   except Exception:
       pass  # never crash on turn counting failure
   ```
3. Add budget check after turn increment:
   ```python
   if max_turns is not None and turns >= max_turns:
       # terminate agent
       status = "budget_exceeded"
       break
   ```
4. After the poll loop, record `turns_counted`:
   - If counting is available and `turns > 0`, set to `turns`.
   - If `turns == 0` and counting could not be confirmed working, set to `null`
     and log a warning.
   - Use `null` consistently for agents whose `count_turn` only approximates.
     The comment in the adapter determines whether to trust the count.
5. Populate `result.json` fields:
   - `metrics.turns_counted`: int or null
   - `metrics.turns_budget`: value of `max_turns` (int or null if not set)

### Acceptance Criteria

- A run with `--max-turns 2` terminates after 2 turns and produces
  `outcome.status = "budget_exceeded"`.
- A passing run with `--max-turns 40` has `turns_counted` populated.
- A run that completes normally never produces `budget_exceeded`.

### Validation

```bash
# Verify budget_exceeded status with a very low turn budget
python evals/run_eval.py android-version \
  --agent claude --model claude-opus-4-5 \
  --max-turns 2 --device <serial>
cat evals/runs/<run_id>/result.json | python -m json.tool | grep -A2 '"status"'
# Expected: "budget_exceeded"
```

### Expected Commit

```
feat(evals): activate turn budget enforcement and populate turns_counted
```

---

## Sub-phase 2c: Rescore and Validation Runs

### Agent Tier

default

### Goal

Implement `--rescore`. Run validation passes for Gemini, Codex, and Kimi.

### Files or Surfaces To Change

- `evals/run_eval.py`

### Steps

1. Implement `--rescore <run_id>` in `run_eval.py`:
   - Load `<runs_dir>/<run_id>/config.json` to get `ground_truth_android_version`.
   - Load `<runs_dir>/<run_id>/transcript.txt`.
   - Run `scorer.score(transcript, ground_truth)`.
   - Build a new result dict with updated `outcome` and same `run_id`.
   - Write to `<runs_dir>/<run_id>/result-rescored.json`. Do not overwrite `result.json`.
   - Print the new status.
2. Run the eval for each new agent. Use a connected device:
   ```bash
   python evals/run_eval.py android-version \
     --agent gemini --model gemini-2.5-pro --device <serial>

   python evals/run_eval.py android-version \
     --agent codex --model o3 --device <serial>

   python evals/run_eval.py android-version \
     --agent kimi --model kimi-k2 --device <serial>
   ```
3. Verify each run produces a valid `result.json` and a transcript.
4. Run `--rescore` on one of the Phase 1 passing runs to verify it works:
   ```bash
   python evals/run_eval.py android-version \
     --rescore <phase1_run_id>
   cat evals/runs/<phase1_run_id>/result-rescored.json
   ```

### Acceptance Criteria

- At least 1 passing run (`outcome.status = "pass"`) for each of: gemini,
  codex, kimi.
- `--rescore` on an existing run produces `result-rescored.json` without errors.
- `result-rescored.json` does not overwrite `result.json`.

### Validation

```bash
ls evals/runs/ | grep gemini
ls evals/runs/ | grep codex
ls evals/runs/ | grep kimi
# Pick one passing run from each and verify:
python -m json.tool evals/runs/<gemini_run>/result.json | grep '"status"'
python -m json.tool evals/runs/<codex_run>/result.json | grep '"status"'
python -m json.tool evals/runs/<kimi_run>/result.json | grep '"status"'
```

### Expected Commit

```
feat(evals): add --rescore and validate Gemini, Codex, Kimi adapters
```
