# Eval Harness

## Prerequisites

- Python 3.11 or newer
- A connected Android device
- The Clawperator Operator APK installed and permissioned
- The `tasks/docs/gaps/` PR merged before treating results as meaningful

## Run The First Eval

Use the project-managed Python environment:

```bash
uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent claude \
  --model claude-opus-4-5
```

You can pass `--device <serial>` when more than one device is connected.

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
- `outcome.answer_extracted_raw` - last marker value emitted by the agent
- `outcome.answer_normalized` - normalized answer used for scoring
- `outcome.ground_truth_normalized` - normalized ground truth
- `outcome.answer_correct` - whether the normalized answer matched ground truth
- `outcome.failure_reason` - non-null for error runs
- `metrics.wall_clock_s` - total elapsed run time
- `metrics.violations.used_adb` - diagnostic flag for direct `adb shell` usage
- `artifacts.transcript` - transcript file name
- `artifacts.config` - config file name

## Public-Surface Isolation

Phase 1 public-surface runs use a fresh temp directory from `tempfile.mkdtemp()`.
That directory does not contain repo files, repo paths are not put into the
agent prompt, and the harness only forwards a minimal environment. This is
soft isolation, not a sandbox. The agent can still access the broader machine
filesystem if it chooses to.

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
