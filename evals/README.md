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

For repo-local Codex work, the [`evals-run`](../.agents/skills/evals-run/SKILL.md)
skill wraps the common emulator workflow, including both runtime targets.
Its helper script lives at
[`run_android_version_eval.sh`](../.agents/skills/evals-run/scripts/run_android_version_eval.sh).

Every run writes its artifacts under `evals/runs/<run_id>/`:

- `config.json`
- `result.json`
- `transcript.txt`

Replay runs also write `result-replay.json`. Rescore runs write
`result-rescored.json`.

Runtime targets:

- `--runtime local-dev` uses the branch-local `apps/node/dist/cli/index.js`
  build and the `.dev` Operator APK (`com.clawperator.operator.dev`). This is
  the default for day-to-day development.
- `--runtime published` uses the globally installed `clawperator` binary and
  the release Operator APK (`com.clawperator.operator`). Use this to verify
  the shipped runtime path.

### Runtime Target Version Compatibility

The two runtime targets use different version sources that can diverge:

| Runtime Target | CLI Version Source | APK Version | Package Name |
|----------------|-------------------|-------------|--------------|
| `local-dev` | `apps/node/package.json` (code version) | Local debug build | `com.clawperator.operator.dev` |
| `published` | `npm install -g clawperator` (published version) | Downloaded release | `com.clawperator.operator` |

The **code version** is typically ahead of the **published version** because
it includes unreleased changes. This means you cannot mix runtime targets
without version alignment.

**Important:** The CLI and APK versions must be compatible. If you see a
`VERSION_INCOMPATIBLE` error during preflight, align your setup:

- For `local-dev` (code version): Build and install the debug APK from the
  same source tree:
  ```bash
  ./gradlew :app:assembleDebug
  adb install -r apps/android/app/build/outputs/apk/debug/app-debug.apk
  ```

- For `published` (published version): Install matching versions of the CLI
  and APK:
  ```bash
  npm install -g clawperator@<version>
  clawperator operator setup --apk <downloaded-apk> --device <serial>
  ```

The published APK download URL follows the pattern:
`https://downloads.clawperator.com/operator/v{VERSION}/operator-v{VERSION}.apk`

Knowledge modes:

- `--mode public-surface` keeps the agent in a fresh temp directory and gives
  it only public docs plus the command surface.
- `--mode full-repo` runs the agent from the repository root and lets it read
  internal docs and source code. Use this when you want to measure the boost
  from repo-local knowledge.

## Skill Scoring And Replay

The `android-version` eval can also score whether the agent emitted a reusable
skill package.

Use the skill prompt variant to enable that scoring:

```bash
uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent claude \
  --model claude-sonnet-4-6 \
  --mode full-repo \
  --skill-prompt prompt-skill.md \
  --device <serial>
```

When you use `--skill-prompt prompt-skill.md` and the spec provides
`skill_generation`, the run records a `skill_score` block in `result.json`.
You will see fields like:

- `skill_emitted`
- `skill_valid`
- `skill_validation_errors`
- `replay_attempted`
- `replay_status`
- `replay_answer_normalized`
- `replay_answer_correct`
- `replay_wall_clock_s`

Replay the emitted skill from a previous run with:

```bash
uv run --project evals --extra dev python evals/run_eval.py android-version \
  --replay <run_id>
```

Replay uses the device serial recorded in the original run config. It writes
`result-replay.json` alongside the original artifacts. If the original run did
not emit a valid skill, replay reports `replay_status = "skipped"`.
Replay only reports `pass`, `fail`, or `no_answer` when the replayed
`clawperator skills run` process exits cleanly. Non-zero exit codes are always
recorded as `replay_status = "error"`.

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

The harness records `metrics.turns_counted` and `metrics.turns_budget` in
`result.json` when turn counting is enabled. These are diagnostic fields only.
They are not scoring gates and they are not meant to be compared across
agents.

`--max-turns` stops a run with `outcome.status = budget_exceeded` if the agent
has not answered yet. Gemini currently counts assistant `delta: true` message
chunks as turns, so its turn count can look more granular than a human reading
of the reply. That is expected for Gemini.

`--rescore <run_id>` replays scoring from `config.json` and `transcript.txt`
without re-running the agent. It writes `result-rescored.json` alongside the
original `result.json`.

## Read `result.json`

Every run writes `evals/runs/<run_id>/result.json`.

Key fields:

- `run_id` - unique run directory name
- `eval_id` - always `android-version` for this eval
- `agent.type` and `agent.model` - the evaluated agent identity
- `knowledge_mode` - `public-surface` or `full-repo`
- `runtime_target` - `local-dev` or `published`
- `spec.eval_version` - eval spec version
- `spec.prompt_sha256` - hash of the rendered prompt text
- `environment.device_serial` - the device used for the run
- `environment.ground_truth_android_version` - Android version read from `adb`
- `outcome.status` - `pass`, `fail`, `timeout`, `no_answer`, `error`, or `budget_exceeded`
- `outcome.status` can also be `budget_exceeded` when `--max-turns` is hit
- `outcome.answer_extracted_raw` - last marker value emitted by the agent
- `outcome.answer_normalized` - normalized answer used for scoring
- `outcome.ground_truth_normalized` - normalized ground truth
- `outcome.answer_correct` - whether the normalized answer matched ground truth
- `outcome.failure_reason` - non-null for error runs
- `preflight` - present on preflight failures when the harness has structured
  diagnostics. Public-surface runs keep only `doctor_failure.code` and
  `doctor_failure.summary` there. Full-repo runs also include the raw
  `doctor_report`
- `metrics.wall_clock_s` - total elapsed run time
- `metrics.violations.used_adb` - diagnostic flag for direct `adb shell` usage
- `metrics.turns_counted` - diagnostic turn count or `null`
- `metrics.turns_budget` - the configured max turn budget
- `skill_score` - present when the run used the skill prompt and the spec has
  `skill_generation`
- `artifacts.transcript` - transcript file name
- `artifacts.config` - config file name

## Public-Surface Isolation

Public-surface runs use a fresh temp directory from `tempfile.mkdtemp()`.
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
- `skill_score.replay_status = "skipped"` means the run did not emit a valid
  skill block, not that replay failed
- Replay only trusts answer artifacts that the skill created or modified
  during the replayed run. Seeded inline artifact contents alone do not count
  as a successful replay result.
- `outcome.failure_reason = "doctor_preflight_failed"` means preflight blocked
  the run before the agent started. Check `preflight.doctor_failure` in
  `result.json` for the actionable doctor code and summary. Full-repo runs also
  preserve the raw `doctor_report`.
- `VERSION_INCOMPATIBLE` during preflight means the CLI and APK versions don't
  match. See [Runtime Target Version Compatibility](#runtime-target-version-compatibility)
  above. The code version (local-dev) is typically ahead of the published version.
