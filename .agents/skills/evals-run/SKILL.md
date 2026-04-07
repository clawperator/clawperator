---
name: evals-run
description: Run, debug, replay, and rescore Clawperator evals. Use when working in the `evals/` harness, choosing between `local-dev` and `published` runtime targets, diagnosing `VERSION_INCOMPATIBLE` or other preflight failures, or inspecting eval artifacts and replay output.
---

# Evals Run

Use this skill for Clawperator eval runs and their follow-up triage.

Read [`references/evals-run.md`](references/evals-run.md) for the operational runbook.

## When To Use

- Run the `android-version` eval.
- Decide whether a run should use the code version or the published version.
- Diagnose preflight failures, answer extraction failures, or agent auth issues.
- Replay or rescore an existing run.

## Scope

- Keep eval guidance internal to the repo.
- Do not move eval-specific behavior into public docs.
- Treat the harness as a measurement tool, not a planner.
