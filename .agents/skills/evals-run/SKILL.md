---
name: evals-run
description: Run, debug, replay, and rescore Clawperator evals. Use when working in the `evals/` harness, choosing between `local-dev` and `published` runtime targets, diagnosing `VERSION_INCOMPATIBLE` or other preflight failures, or inspecting eval artifacts and replay output.
---

# Evals Run

Use this skill for Clawperator eval runs and their follow-up triage.

Read [`references/evals-run.md`](references/evals-run.md) for the operational runbook.
Use [`scripts/run_android_version_eval.sh`](scripts/run_android_version_eval.sh)
when you want the skill to install the matching APK for the selected runtime
and run both runtime targets on the same emulator.

## When To Use

- Run the `android-version` eval.
- Run the Pack A red or green `android-version` benchmark on the required AOSP
  emulator surface with `--mode full-repo --skill-prompt prompt-skill.md`.
- Decide whether a run should use the code version or the published version.
- Set up the emulator for `local-dev`, `published`, or both.
- Diagnose preflight failures, answer extraction failures, or agent auth issues.
- Replay or rescore an existing run.

## Scope

- Keep eval guidance internal to the repo.
- Do not move eval-specific behavior into public docs.
- Treat the harness as a measurement tool, not a planner.
