# Eval Phase 1 Work Breakdown

Parent plan: `tasks/evals/phase-1/plan.md`

## Executive Summary

1 PR, 4 sub-phases. All ship together. Sub-phases are sequenced; do not
start the next until the current one passes its acceptance criteria.

| Sub-phase | Purpose | Agent tier |
| --- | --- | --- |
| 1a | Directory scaffold + gitignore | fast |
| 1b | Harness core (environment, runner, scorer, artifacts, claude adapter) | thinking |
| 1c | Eval spec + prompt + run_eval.py CLI + README | default |
| 1d | Validation: 3 passing runs + error run + dry-run | default |

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total sub-phases | 4 (1a-1d) |
| Completed | none |
| Remaining | 1a, 1b, 1c, 1d |
| Current / Next | 1a |
| Blockers | none |

## Hard Rules

1. Do not skip any sub-phase. 1a through 1d must all pass before committing
   the PR.
2. Build the Node CLI before any device interaction:
   `npm --prefix apps/node run build`. Never test against stale `dist/`.
3. Use the branch-local CLI for all device operations:
   `CLAWPERATOR_BIN="node $(pwd)/apps/node/dist/cli/index.js"`.
4. Use the `.dev` Operator APK for all local testing:
   `CLAWPERATOR_OPERATOR_PACKAGE="com.clawperator.operator.dev"`.
5. Do not hard-code device serials anywhere. Always use `--device <serial>`
   or the `ANDROID_SERIAL` env var.
6. Agent working directory for `public-surface` mode must be a clean
   `tempfile.mkdtemp()`. Never the repo root.
7. Do not store the full inherited environment in `config.json`. Store only
   the `env_overrides` dict (ANDROID_SERIAL, CLAWPERATOR_BIN,
   CLAWPERATOR_OPERATOR_PACKAGE).
8. The harness must never write to `evals/runs/` inside the repo without
   creating the directory first (it is gitignored, so it may not exist).
9. One commit per sub-phase. Do not batch 1a+1b into one commit.
10. Update `tasks/evals/phase-1/plan.md` Status section after each sub-phase.
11. If a sub-phase acceptance check fails, fix it before moving on.
12. Never shorten `Clawperator` to `Claw` in code, docs, or comments.
13. Do not add AI attribution lines to commit messages.
14. `--max-turns` is accepted by `run_eval.py` in Phase 1 but must have no
    effect on harness behavior. It is recorded in `config.json` only.
15. Answer scoring must normalize both sides: strip leading `android ` prefix
    (case-insensitive), strip whitespace, lowercase. Never compare raw strings.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/evals/plan.md` | Overarching design: axes, result schema, agent CLI flags |
| 2 | `tasks/evals/phase-1/plan.md` | Phase scope, decision rules, acceptance criteria |
| 3 | `CLAUDE.md` | Repo rules, device selection rules, validation commands |
| 4 | `apps/node/src/contracts/result.ts` | Result envelope shape (for `[Clawperator-Result]` detection) |
| 5 | `apps/node/src/contracts/errors.ts` | Error codes (doctor pre-flight may emit these) |
| 6 | `apps/node/src/cli/registry.ts` | Verify `doctor` command name and flags |
| 7 | `.agents/skills/test-recording-validate/runs/20260319-134606/result.json` (if present) | Exemplar run artifact shape from existing skill |

## PR / Phase Plan

| PR | Purpose | Included sub-phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Complete Phase 1 harness | 1a, 1b, 1c, 1d | fast/thinking/default/default | 3 passing runs; error run; dry-run; `evals/runs/` gitignored |

---

## Sub-phase 1a: Directory Scaffold

### Agent Tier

fast

### Goal

Create the `evals/` directory structure with empty package files and gitignore.
No logic yet.

### Files or Surfaces To Change

- `evals/.gitignore`
- `evals/harness/__init__.py`
- `evals/harness/agents/__init__.py`
- `evals/specs/android-version/` (empty directory, created for 1c)
- `.gitignore` (repo root, one line added)

### Steps

1. Create `evals/` directory tree:
   ```
   evals/
   ├── harness/
   │   ├── agents/
   ```
2. Create `evals/.gitignore`:
   ```
   runs/
   __pycache__/
   *.pyc
   .pytest_cache/
   ```
3. Create empty `evals/harness/__init__.py` and `evals/harness/agents/__init__.py`.
4. Add to repo root `.gitignore` (append after the existing `tmp/` entry):
   ```
   evals/runs/
   ```
5. Verify `evals/runs/` is gitignored:
   ```bash
   mkdir -p evals/runs/test && git status evals/runs/
   # Should show nothing tracked under evals/runs/
   rmdir evals/runs/test
   ```

### Acceptance Criteria

- `evals/harness/__init__.py` exists and is empty.
- `evals/harness/agents/__init__.py` exists and is empty.
- `evals/.gitignore` contains `runs/`.
- `git check-ignore evals/runs/` returns `evals/runs/`.

### Validation

```bash
git check-ignore -v evals/runs/
```

### Expected Commit

```
chore(evals): scaffold evals/ directory structure
```

---

## Sub-phase 1b: Harness Core

### Agent Tier

thinking

### Goal

Implement the five harness modules: `environment.py`, `runner.py`, `scorer.py`,
`artifacts.py`, and `agents/` (base + Claude adapter). No eval spec yet; no
CLI entry point yet. Focus on correctness of each component in isolation.

### Files or Surfaces To Change

- `evals/harness/environment.py`
- `evals/harness/runner.py`
- `evals/harness/scorer.py`
- `evals/harness/artifacts.py`
- `evals/harness/agents/base.py`
- `evals/harness/agents/claude.py`

### Component Specifications

#### `environment.py`

```python
@dataclass
class Environment:
    device_serial: str
    ground_truth_android_version: str
    clawperator_bin: str          # resolved path or command
    clawperator_version: str      # from `clawperator version` output
    operator_package: str

def preflight(device: str | None) -> Environment:
    """
    1. Verify adb is on PATH.
    2. Run `adb devices`. Extract authorized devices.
    3. If device is specified, verify it is in the authorized list.
       If not specified and exactly one authorized device exists, use it.
       If not specified and multiple devices exist, raise with helpful message.
    4. Resolve CLAWPERATOR_BIN: env var > "node <repo_root>/apps/node/dist/cli/index.js"
    5. Verify the resolved binary is executable (os.access check).
    6. Resolve CLAWPERATOR_OPERATOR_PACKAGE: env var > "com.clawperator.operator.dev"
    7. Run `<bin> doctor --json` with ANDROID_SERIAL set.
       If exit code != 0, raise EnvironmentError("doctor_preflight_failed").
    8. Run `adb -s <serial> shell getprop ro.build.version.release`.
       Strip whitespace. Reject empty result.
    9. Run `<bin> version --json` to capture clawperator_version.
    10. Return Environment dataclass.
    """
```

Use `subprocess.run` with `check=False` for all subprocess calls. Check return
codes explicitly. Never use shell=True with user-provided values.

#### `scorer.py`

```python
def normalize_version(v: str) -> str:
    """Strip whitespace, strip leading 'android ' prefix (case-insensitive), lowercase."""
    v = v.strip().lower()
    if v.startswith("android "):
        v = v[len("android "):]
    return v.strip()

def extract_answer(transcript: str) -> str | None:
    """
    Scan transcript lines for 'CLAWPERATOR_EVAL_ANSWER: <value>'.
    Return the last occurrence (allows the agent to revise).
    Returns None if no marker found.
    """

def detect_disallowed_tool(transcript: str) -> bool:
    """
    Return True if the transcript contains evidence of the agent directly
    invoking adb shell (not Clawperator's own output).
    Use a conservative pattern - false negatives are acceptable in Phase 1.
    See Open Questions in plan.md for pattern guidance.
    """

@dataclass
class ScorerResult:
    answer_extracted_raw: str | None
    answer_normalized: str | None
    ground_truth_normalized: str
    answer_correct: bool
    used_disallowed_tool: bool

def score(transcript: str, ground_truth: str) -> ScorerResult:
    """Extract answer, normalize both sides, compare, return ScorerResult."""
```

#### `artifacts.py`

```python
def make_run_id(eval_id: str, agent_type: str, model: str) -> str:
    """
    Format: <eval_id>-<YYYYMMDD-HHMMSS>-<agent_type>-<model_short>
    model_short: first 12 chars of model, lowercased, hyphens preserved.
    """

def write_run(
    run_dir: Path,
    result: dict,      # result.json content
    config: dict,      # config.json content (includes invocation.command)
    transcript: str,
) -> None:
    """
    Create run_dir. Write result.json, config.json, transcript.txt.
    Do not overwrite an existing run_dir - raise if it already exists.
    Transcript is capped at 10MB. If truncated, append [TRANSCRIPT TRUNCATED AT 10MB].
    """
```

#### `agents/base.py`

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

@dataclass
class AgentConfig:
    type_id: str
    model: str
    knowledge_mode: str   # "public-surface" | "full-repo"
    extra_flags: list[str] = field(default_factory=list)

class BaseAgent(ABC):
    def __init__(self, config: AgentConfig): ...

    @abstractmethod
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        """Return the exact subprocess argv list."""

    @abstractmethod
    def build_env(self, base_env: dict) -> dict:
        """Return env overrides for this agent (not the full environment)."""
```

No `count_turn` method in Phase 1. It is added in Phase 2.

#### `agents/claude.py`

```python
class ClaudeAgent(BaseAgent):
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        cmd = [
            "claude",
            "-p", prompt,
            "--model", self.config.model,
            "--dangerously-skip-permissions",
            "--output-format", "stream-json",
        ]
        cmd.extend(self.config.extra_flags)
        return cmd

    def build_env(self, base_env: dict) -> dict:
        # Claude Code uses the subprocess working directory for context.
        # No additional env overrides needed beyond what runner.py provides.
        return {}
```

#### `runner.py`

```python
def run_eval(
    spec: dict,
    env: Environment,
    agent: BaseAgent,
    knowledge_mode: str,
    timeout_s: int,
    runs_dir: Path,
    max_turns: int | None = None,  # accepted but not used in Phase 1
) -> Path:
    """
    1. Build prompt from spec['prompts'][knowledge_mode] file.
       Substitute $CLAWPERATOR_BIN, $DEVICE_SERIAL, $CLAWPERATOR_OPERATOR_PACKAGE.
    2. Compute prompt_sha256.
    3. Create work_dir:
       - public-surface: tempfile.mkdtemp()
       - full-repo: repo root
    4. Check for CLAUDE.md / context file requirement (see Open Questions).
    5. Build subprocess env:
       base = dict(os.environ)
       base["ANDROID_SERIAL"] = env.device_serial
       base["CLAWPERATOR_BIN"] = env.clawperator_bin
       base["CLAWPERATOR_OPERATOR_PACKAGE"] = env.operator_package
       overrides = agent.build_env(base)
       final_env = {**base, **overrides}
    6. Build command = agent.build_command(prompt, work_dir).
    7. Record started_at.
    8. Open transcript file for streaming write.
    9. Spawn subprocess with Popen, cwd=work_dir, env=final_env.
       stdout and stderr merged to transcript file via stdout=f, stderr=f.
    10. Poll for:
        a. Process exits naturally.
        b. Wall-clock timeout exceeded.
        c. Answer marker found in transcript (check every 0.5s, re-read last 4KB).
    11. On timeout: send SIGTERM, wait 5s, send SIGKILL.
    12. Record finished_at.
    13. Read full transcript. Run scorer.score().
    14. Determine outcome.status:
        - timeout -> "timeout"
        - answer_correct -> "pass"
        - answer emitted but wrong -> "fail"
        - no answer -> "no_answer"
    15. Build result.json and config.json per schema in tasks/evals/plan.md.
    16. Write run artifacts via artifacts.write_run().
    17. Clean up temp work_dir if public-surface mode.
    18. Return run dir path.
    """
```

### Steps

1. Implement `environment.py` with the spec above.
2. Implement `scorer.py` with the spec above. Write unit tests for
   `normalize_version` and `extract_answer` in `evals/harness/test_scorer.py`.
3. Implement `artifacts.py` with the spec above.
4. Implement `agents/base.py` and `agents/claude.py` with the spec above.
5. Implement `runner.py` with the spec above.
6. Run the unit tests:
   ```bash
   python -m pytest evals/harness/test_scorer.py -v
   ```
   All tests must pass.

### Unit Test Requirements for `scorer.py`

Write at least these test cases in `evals/harness/test_scorer.py`:

```python
# normalize_version
assert normalize_version("15") == "15"
assert normalize_version("Android 15") == "15"
assert normalize_version("android 15") == "15"
assert normalize_version("  Android 15  ") == "15"
assert normalize_version("14") == "14"

# extract_answer - last occurrence wins
transcript_single = "some output\nCLAWPERATOR_EVAL_ANSWER: 15\nmore output"
assert extract_answer(transcript_single) == "15"

transcript_multi = "CLAWPERATOR_EVAL_ANSWER: 14\nlater...\nCLAWPERATOR_EVAL_ANSWER: 15"
assert extract_answer(transcript_multi) == "15"

transcript_none = "no answer here"
assert extract_answer(transcript_none) is None

# score - pass
result = score("CLAWPERATOR_EVAL_ANSWER: Android 15\n", "15")
assert result.answer_correct is True
assert result.answer_normalized == "15"
assert result.answer_extracted_raw == "Android 15"

# score - fail
result = score("CLAWPERATOR_EVAL_ANSWER: 14\n", "15")
assert result.answer_correct is False

# score - no answer
result = score("no answer", "15")
assert result.answer_correct is False
assert result.answer_extracted_raw is None
```

### Acceptance Criteria

- All unit tests in `evals/harness/test_scorer.py` pass.
- `from evals.harness.runner import run_eval` imports without error.
- `from evals.harness.agents.claude import ClaudeAgent` imports without error.
- `from evals.harness.environment import preflight` imports without error.

### Validation

```bash
python -m pytest evals/harness/test_scorer.py -v
python -c "from evals.harness.runner import run_eval; print('ok')"
python -c "from evals.harness.agents.claude import ClaudeAgent; print('ok')"
```

### Expected Commit

```
feat(evals): implement harness core (environment, runner, scorer, artifacts, claude adapter)
```

---

## Sub-phase 1c: Eval Spec, Prompt, CLI, and README

### Agent Tier

default

### Goal

Write the `android-version` eval spec, the public-surface prompt, the
`run_eval.py` CLI entry point, and the `evals/README.md`.

### Files or Surfaces To Change

- `evals/specs/android-version/spec.json`
- `evals/specs/android-version/prompt-public.md`
- `evals/run_eval.py`
- `evals/README.md`
- `docs/internal/design/evals.md`

### Eval Spec

`evals/specs/android-version/spec.json`:

```json
{
  "eval_id": "android-version",
  "name": "Determine Android Version via Settings",
  "description": "Agent must navigate Android Settings using the Clawperator CLI to determine the device Android version.",
  "version": "1.0.0",
  "prompts": {
    "public-surface": "prompt-public.md",
    "full-repo": "prompt-full-repo.md"
  },
  "environment": {
    "requires_device": true,
    "requires_clawperator_doctor": true,
    "requires_settings_app": true
  },
  "budget": {
    "default_timeout_s": 300,
    "default_max_turns": 40
  },
  "scoring": {
    "method": "exact_match_normalized",
    "ground_truth_source": "adb_getprop",
    "ground_truth_prop": "ro.build.version.release",
    "answer_marker": "CLAWPERATOR_EVAL_ANSWER"
  }
}
```

### Prompt File

`evals/specs/android-version/prompt-public.md`:

```markdown
You are an autonomous agent with access to a connected Android device via the
Clawperator CLI. Your task is to determine the Android version running on the
device and return it as your final answer.

Environment:
- Clawperator binary: $CLAWPERATOR_BIN
- Operator package: $CLAWPERATOR_OPERATOR_PACKAGE
- Target device serial: $DEVICE_SERIAL
- Clawperator documentation: https://docs.clawperator.com

Instructions:
1. Open Android Settings using the Clawperator CLI. The Android Settings
   app package name is: com.android.settings
2. Navigate within Settings to find the Android version. It is typically
   found under "About phone" or "About device".
3. Use the observe-decide-act loop: snapshot the current state, decide
   what to do, execute an action, repeat.
4. When you have determined the Android version, output exactly this line:

   CLAWPERATOR_EVAL_ANSWER: <version>

   where <version> is the numeric version string only (e.g. "15" or "14",
   not "Android 15"). You may revise your answer by outputting the line
   again - the last occurrence is used.

5. If you cannot determine the version within your allowed attempts, output:

   CLAWPERATOR_EVAL_ANSWER: unknown

Constraints:
- Use only Clawperator commands for device interaction. Do not use adb
  shell commands or any other method to read the version.
- Reference only the public documentation at https://docs.clawperator.com.
- Pass --device $DEVICE_SERIAL on every Clawperator command.
- Pass --operator-package $CLAWPERATOR_OPERATOR_PACKAGE on every
  Clawperator command.
```

### CLI Entry Point

`run_eval.py` must support:

```
python evals/run_eval.py android-version \
  --agent claude \
  --model claude-opus-4-5 \
  [--device <serial>] \
  [--mode public-surface|full-repo] \
  [--runtime local-dev|published] \
  [--timeout-s 300] \
  [--max-turns 40] \
  [--runs-dir evals/runs] \
  [--dry-run]
```

`--dry-run` must print: resolved config, prompt file path, prompt sha256, and
the substituted prompt text. Then exit 0 without spawning an agent.

`--mode full-repo` must raise a clear error in Phase 1: "full-repo mode is not
yet implemented (Phase 3)".

`--runtime published` must raise a clear error in Phase 1: "published runtime
is not yet implemented (Phase 3)".

`--rescore` is not implemented in Phase 1. Raise: "rescore is not yet
implemented (Phase 2)".

Successful run: print the run directory path to stdout on completion.
Print `outcome.status` and `outcome.answer_normalized` to stdout.

### README

`evals/README.md` must include:
- Prerequisites (Python 3.11+, device connected, Operator APK installed,
  docs.gaps PR merged)
- How to run the first eval (exact command)
- How to read result.json (field descriptions)
- How `public-surface` isolation works (temp dir, no repo access)
- Note: runs are not parallel (one device, one run at a time)
- How to add a new agent adapter (pointer to `agents/base.py`)
- Note that `CLAWPERATOR_EVAL_ANSWER` is an internal eval marker and must
  not appear in public-facing documentation or production usage

### Internal Design Doc

`docs/internal/design/evals.md` must cover these topics in order:

1. **Why evals exist** - measurement instrument for docs quality and API
   discoverability. The harness answers: "Can an unfamiliar agent use
   Clawperator's public surfaces to complete a task on a real device?"
2. **Measurement-not-teaching principle** - the eval is a ruler, not a
   textbook. Eval prompts, spec files, and `CLAWPERATOR_EVAL_ANSWER` must
   never appear in public docs. If agents see the marker in docs, future
   runs measure eval familiarity rather than real capability.
3. **`CLAWPERATOR_EVAL_ANSWER` marker** - internal eval artifact. Not a
   production API. Not published on `docs.clawperator.com` or
   `clawperator.com`. Agents emit it only because the eval prompt instructs
   them to. Must not appear in production transcripts.
4. **Two-axis model** - knowledge surface x runtime target. Explain each
   value and what it isolates. Include the phase each combination becomes
   testable.
5. **Public-surface isolation** - why `tempfile.mkdtemp()`. Why the repo
   path must not appear in the agent's cwd, prompt, or inherited env vars.
   What "no repo access" means in practice.
6. **Doctor pre-flight** - why the harness aborts before spawning the agent
   on doctor failure rather than letting the agent discover it.
7. **`used_disallowed_tool` detection** - the chosen heuristic (fill in
   after implementation), why it is diagnostic-only, why false negatives are
   acceptable in Phase 1.
8. **Open Question resolutions** - record the empirical answers to the Phase
   1 open questions (Claude context file requirement; transcript cap behavior).
9. **Compatibility matrix** - future public artifact. When Phase 1 has >= 10
   runs across >= 2 agents, create `docs/evals-compat.md` with agent/model
   pass rates. That page is the appropriate public output - it does not expose
   prompts, markers, or harness internals.

Write `docs/internal/design/evals.md` after implementing the harness (sub-phase
1b) and spec (1c), so the heuristic and open question answers are known. It is
acceptable to write a placeholder for the `used_disallowed_tool` heuristic
section and fill it in after the 1d validation runs reveal the real pattern.

### Steps

1. Create `evals/specs/android-version/spec.json` with the content above.
2. Create `evals/specs/android-version/prompt-public.md` with the prompt above.
3. Create `evals/run_eval.py` with the CLI spec above. Use Python's `argparse`.
4. Create `evals/README.md` with the required sections above.
5. Verify dry-run works:
   ```bash
   python evals/run_eval.py android-version \
     --agent claude --model claude-opus-4-5 --dry-run
   ```
   Expected: prints resolved config and prompt, exits 0, no agent spawned.
6. Write `docs/internal/design/evals.md` covering the 9 topics specified above.
   Sections 1-6 and 9 can be written now. Sections 7 and 8 may use a
   placeholder pending 1d validation runs.

### Acceptance Criteria

- `evals/specs/android-version/spec.json` is valid JSON.
- `evals/specs/android-version/prompt-public.md` contains all three template
  variables (`$CLAWPERATOR_BIN`, `$CLAWPERATOR_OPERATOR_PACKAGE`,
  `$DEVICE_SERIAL`) and the `CLAWPERATOR_EVAL_ANSWER` marker definition.
- `python evals/run_eval.py android-version --agent claude --model test --dry-run`
  exits 0 and prints the substituted prompt.
- `python evals/run_eval.py android-version --agent claude --model test --mode full-repo`
  exits non-zero with the Phase 3 message.
- `evals/README.md` contains the words "public-surface" and "temp".
- `evals/README.md` contains a note that `CLAWPERATOR_EVAL_ANSWER` is an
  internal marker that must not appear in public docs.
- `docs/internal/design/evals.md` exists and covers all 9 required topics
  (sections 7 and 8 may be marked as placeholders pending 1d).

### Validation

```bash
python -m json.tool evals/specs/android-version/spec.json > /dev/null && echo "valid json"
python evals/run_eval.py android-version --agent claude --model test --dry-run
python evals/run_eval.py android-version --agent claude --model test --mode full-repo; echo "exit: $?"
grep -q "CLAWPERATOR_EVAL_ANSWER" evals/README.md && echo "marker note present"
ls docs/internal/design/evals.md && echo "design doc present"
```

### Expected Commit

```
feat(evals): add android-version eval spec, prompt, CLI, README, and internal design doc
```

---

## Sub-phase 1d: Validation Runs

### Agent Tier

default

### Goal

Run the eval three times with a real connected device and verify that all
Phase 1 acceptance criteria are met.

### Required Environment

- Android device connected with Clawperator Operator APK installed and
  permissioned.
- `docs/gaps/` changes in place (or at least the current docs are sufficient
  for the agent to have a fair shot - note this in findings if not yet merged).
- Branch-local CLI built: `npm --prefix apps/node run build`.

### Steps

1. Verify environment:
   ```bash
   adb devices
   node apps/node/dist/cli/index.js doctor \
     --operator-package com.clawperator.operator.dev
   ```
2. Run the eval three times. For each run, record the run ID and outcome.
   Use an explicit device serial if more than one device is connected:
   ```bash
   python evals/run_eval.py android-version \
     --agent claude --model claude-opus-4-5 \
     --device <device_serial>
   ```
3. After three runs, verify at least one is `pass`.
   Read the transcript of each passing run and verify it shows real
   `[Clawperator-Result]` envelopes in the output.
4. Simulate an environment failure. Disconnect the device or stop the
   Operator APK, then run:
   ```bash
   python evals/run_eval.py android-version \
     --agent claude --model claude-opus-4-5
   ```
   Verify the output shows `outcome.status = "error"` in `result.json`.
5. Run dry-run and verify it exits 0 with the prompt printed.
6. Capture run IDs of the three passing runs and one error run.
   Note them in this section for human review.

### Acceptance Criteria

All must be true:
1. At least 3 `result.json` files with `outcome.status = "pass"` and
   `outcome.answer_correct = true`.
2. At least 1 `result.json` with `outcome.status = "error"` and a non-null
   `failure_reason`.
3. Each passing transcript contains at least one line with `[Clawperator-Result]`.
4. Dry-run exits 0.
5. `evals/runs/` is gitignored:
   ```bash
   git check-ignore -v evals/runs/
   ```

### Validation

```bash
# Check gitignore
git check-ignore -v evals/runs/

# Check a passing result.json
cat evals/runs/<passing_run_id>/result.json | python -m json.tool

# Check that transcript has Clawperator envelopes
grep -c '\[Clawperator-Result\]' evals/runs/<passing_run_id>/transcript.txt
```

### Expected Commit

```
feat(evals): validate Phase 1 eval harness with passing runs
```
