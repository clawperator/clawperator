# Orchestrated Skill Evals Work Breakdown

Parent plan: `tasks/recording/orchestrated-skill-evals/plan.md`

## Executive Summary

Total PRs: 1. Total phases: 3.

- P1: define the eval contract and artifact model
- P2: implement the Solax cold-start eval in `/evals`
- P3: validate it on-device and document the workflow

## Status

| Phase | State |
| --- | --- |
| P1 | completed |
| P2 | completed |
| P3 | completed |

## Hard Rules

- Do not rely on ad hoc shell loops as the proving mechanism.
- Do not normalize once before a batch and call that "from scratch each run".
- Do not treat in-app continuation proof as a substitute for cold-start proof.
- Do not hide failures behind aggregate counts; preserve per-run artifacts.
- Do not infer the target value from memory. Read current state and choose a
  different value for the next run.
- Do not run without an explicit `--device`.
- Do not run local proving against the release operator package by accident.
- Keep replay and orchestrated concerns separate. This task is for
  orchestrated-skill evals.

## Required Reading

| File | Why it matters |
| --- | --- |
| `tasks/recording/orchestrated-skill-evals/plan.md` | Scope and end-state |
| `evals/README.md` | Existing eval conventions |
| `evals/run_eval.py` | Eval entrypoint shape |
| `evals/harness/runner.py` | Execution model |
| `docs/skills/authoring.md` | Durable orchestrated authoring contract |
| `docs/internal/design/skill-design.md` | Failure modes and proving lessons |
| `docs/skills/overview.md` | Named orchestrated runtime contract |

## Phase P1: Define The Eval Contract

### Goal

Specify what an orchestrated cold-start eval must prove and what artifacts it
must preserve.

### Acceptance Criteria

- There is a named eval target for the Solax orchestrated skill.
- The eval contract distinguishes:
  - cold-start normalized proof
  - in-app continuation proof
- The Solax proving case defaults to cold-start normalized proof.
- The contract defines:
  - pre-run normalization
  - target-value selection
  - per-run pass/fail rules
  - aggregate success rules
  - artifact layout

## Phase P2: Implement The Eval

### Goal

Add the eval implementation under `/evals`.

### Acceptance Criteria

- The eval can:
  - close SolaX
  - return to launcher
  - verify outside-app start state
  - read current discharge state when available
  - choose a different target value
  - invoke the orchestrated skill once
  - persist the raw JSON result
  - extract and classify the resulting `SkillResult`
- The eval records one directory per run plus an aggregate summary.
- Failure artifacts are preserved by default.
- The implementation is readable enough that a future agent can reuse it for a
  second orchestrated skill.

## Phase P3: Validate And Document

### Goal

Run the eval on the real Samsung device and document how to use it.

### Acceptance Criteria

- The eval is run on-device with:
  - `--device <device_serial>`
  - `--operator-package com.clawperator.operator.dev`
- At least one documented proving batch exists from the eval, not from terminal
  shell history.
- `evals/README.md` or another durable eval doc explains:
  - when to use the eval
  - what it proves
  - what it does not prove
  - where artifacts land
- The workflow makes clear that this eval replaced ad hoc shell-loop proving for
  the Solax orchestrated case.
