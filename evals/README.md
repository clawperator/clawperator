# Eval Harness

## Prerequisites

- Python 3.11 or newer
- A connected Android device
- The Clawperator Operator APK installed and permissioned

## Run The Eval Harness

Use the project-managed Python environment from the `evals/` project root:

```bash
uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent claude \
  --model claude-haiku-4-5
```

You can pass `--device <serial>` when more than one device is connected.
The lockfile for this project lives at `evals/uv.lock`.

Runtime targets:

- `--runtime local-dev` uses the branch-local `apps/node/dist/cli/index.js`
  build and the `.dev` Operator APK. This is the default for day-to-day
  development.
- `--runtime published` uses the globally installed `clawperator` binary and
  the release Operator APK (`com.clawperator.operator`). Use this to verify
  the shipped runtime path.

Other supported agents:

- `claude`
- `gemini`
- `codex`
- `kimi`

Example invocations:

```bash
uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent gemini \
  --model auto-gemini-3 \
  --device <serial>

uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent codex \
  --model gpt-5.1-codex-mini \
  --device <serial>

uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent kimi \
  --model kimi-code/kimi-for-coding \
  --device <serial>
```

Phase 2 records `metrics.turns_counted` and `metrics.turns_budget` in
`result.json`. These are diagnostic fields only. They are not scoring gates and
they are not meant to be compared across agents.

`--max-turns` stops a run with `outcome.status = budget_exceeded` if the agent
has not answered yet. Gemini currently counts assistant `delta: true` message
chunks as turns, so its turn count can look more granular than a human reading
of the reply. That is expected for this phase.

`--rescore <run_id>` replays scoring from `config.json` and `transcript.txt`
without re-running the agent. It writes `result-rescored.json` alongside the
original `result.json`.

## Read `result.json`

Every run writes `evals/runs/<run_id>/result.json`.

Key fields:

- `run_id` - unique run directory name
- `eval_id` - always `android-version` in Phase 1
- `agent.type` and `agent.model` - the evaluated agent identity
- `knowledge_mode` - `public-surface` in Phase 1
- `runtime_target` - `local-dev` in Phase 1
- `spec.eval_version` - eval spec version
- `spec.prompt_sha256` - hash of the rendered prompt text
- `environment.device_serial` - the device used for the run
- `environment.ground_truth_android_version` - Android version read from `adb`
- `outcome.status` - `pass`, `fail`, `timeout`, `no_answer`, or `error`
- `outcome.status` can also be `budget_exceeded` when `--max-turns` is hit
- `outcome.answer_extracted_raw` - last marker value emitted by the agent
- `outcome.answer_normalized` - normalized answer used for scoring
- `outcome.ground_truth_normalized` - normalized ground truth
- `outcome.answer_correct` - whether the normalized answer matched ground truth
- `outcome.failure_reason` - non-null for error runs
- `metrics.wall_clock_s` - total elapsed run time
- `metrics.violations.used_adb` - diagnostic flag for direct `adb shell` usage
- `metrics.turns_counted` - diagnostic turn count or `null`
- `metrics.turns_budget` - the configured max turn budget
- `artifacts.transcript` - transcript file name
- `artifacts.config` - config file name

## Public-Surface Isolation

Phase 1 public-surface runs use a fresh temp directory from `tempfile.mkdtemp()`.
That directory does not contain repo files, repo paths are not put into the
agent prompt, and the harness only forwards a minimal environment. This is
soft isolation, not a sandbox. The agent can still access the broader machine
filesystem if it chooses to.

The harness uses the branch-local `clawperator` build when available. Public
surface runs avoid leaking repo paths into the prompt and use a temp-directory
shim so the agent can invoke `clawperator` without seeing the underlying
workspace path.

## Parallel Runs

Runs are not parallel. Use one device and one eval run at a time.

## Add An Agent Adapter

Start with `evals/harness/agents/base.py`.

Implement:

- `build_command(prompt, work_dir)`
- `build_env(base_env)`
- `supports_streaming()`
- `normalize_line(raw)`

## Internal Answer Marker

`CLAWPERATOR_EVAL_ANSWER` is an internal eval marker only. It is not a public
API and must not appear in public-facing documentation or production usage.

## Common Failure Patterns

- The agent loops on the same screen
- The agent never emits `CLAWPERATOR_EVAL_ANSWER`
- The agent uses `adb` directly and the run only records the violation
- The agent guesses the answer without using Clawperator
- Gemini `delta: true` chunks count as turn boundaries for `--max-turns`, so a
  long answer can consume more than one counted turn
