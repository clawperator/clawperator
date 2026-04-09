# Evals Runbook

## Runtime Target Selection

- `local-dev` uses the branch-local Node CLI build and the `.dev` Operator APK.
- `published` uses the globally installed `clawperator` binary and the release Operator APK.
- The code version is typically ahead of the published version. Do not mix runtime targets unless the CLI and APK versions are intentionally aligned.

## Before Running

- Use `./gradlew :app:assembleDebug` and install `apps/android/app/build/outputs/apk/debug/app-debug.apk` when testing `local-dev`.
- Install the matching release CLI and release APK when testing `published`.
- Use `--device <serial>` whenever more than one Android device is connected.
- Use `--mode full-repo` only when the eval should see repository-internal docs and source.

## Run

```bash
uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent <agent> \
  --model <model> \
  --runtime <local-dev|published> \
  --device <serial>
```

To run both runtime targets on the same emulator with the matching APK setup
steps, use:

```bash
.agents/skills/evals-run/scripts/run_android_version_eval.sh <device_serial> <agent> <model>
```

Pass `local-dev` or `published` as a fourth argument to run only one target.
The published branch downloads the exact APK for the installed published CLI
version before setup.

## Triage

- `VERSION_INCOMPATIBLE` usually means the CLI and APK versions do not match.
- For `local-dev`, rebuild the debug APK from the same checkout before rerunning.
- For `published`, download and install the APK that matches `clawperator version`.
- `doctor_preflight_failed` means preflight stopped the run before the agent started.
- `no_answer` means the transcript needs inspection for the answer marker and scorer behavior.
- Auth or provider errors such as `LLM not set` mean the agent config must be fixed before rerunning.

## Artifacts

- `evals/runs/<run_id>/config.json`
- `evals/runs/<run_id>/result.json`
- `evals/runs/<run_id>/transcript.txt`

## Follow-up Commands

- Replay: `uv run --project evals --extra dev python evals/run_eval.py android-version --replay <run_id>`
- Rescore: `uv run --project evals --extra dev python evals/run_eval.py android-version --rescore <run_id>`
