# Clawperator Eval System

## Executive Summary

Build a local eval harness that measures whether an unfamiliar agent can use
Clawperator's public-facing surfaces to operate a connected Android device and
complete real tasks autonomously. The harness is a Python CLI under `evals/`
in the main repo. Eval runs produce scored result artifacts with full agent
transcripts.

4 PRs, one per phase. Phase 1 ships the minimum viable harness with one eval
and one agent. Phases 2-4 expand agent support, runtime targets, and eval
scope. No phase requires a merge gate on the next except where noted.

Prerequisite: `docs/gaps/` must land (and merge) before Phase 1 eval results
are treated as meaningful benchmarks.

| PR | Phase | Scope | Agent tier |
| --- | --- | --- | --- |
| PR-1 | 1 | Harness scaffold + first eval + Claude adapter | thinking |
| PR-2 | 2 | Gemini, Codex, Kimi adapters + turn counting | default |
| PR-3 | 3 | Published runtime target + full-repo mode | default |
| PR-4 | 4 | Skill generation and replay eval | thinking |

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 4 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | 1 |
| Blockers | docs/gaps/ must land before Phase 1 results are meaningful |

## Goal

A reproducible, inspectable eval harness that:

- runs a named eval spec against a named agent and model
- enforces a wall-clock timeout and (Phase 2+) turn budget
- captures the full agent transcript
- scores the result against an independent ground truth
- writes structured `result.json` artifacts for every run

The first eval (`android-version`) measures whether an agent can navigate
Android Settings using only Clawperator's public CLI and docs to determine the
device's Android version.

## Why Now

Clawperator is a tool for LLM agents. Having no way to measure whether an
unfamiliar agent can actually use it makes every docs or API change
unverifiable from the agent's perspective. The eval system is the feedback
loop for docs quality, API discoverability, and harness reliability.

## Two Key Axes

Every run is parameterized by two independent axes:

| Axis | Values | Phase introduced |
| --- | --- | --- |
| Knowledge surface | `public-surface`, `full-repo` | surface: Phase 1; full-repo: Phase 3 |
| Runtime target | `local-dev`, `published` | local-dev: Phase 1; published: Phase 3 |

**Knowledge surface** controls what context the agent may draw on:

- `public-surface`: agent runs in an isolated temp directory with no repo
  access. Prompt provides only: `docs.clawperator.com`, `clawperator.com`,
  the clawperator binary path, and the device serial.
- `full-repo`: agent runs from the repo root with full access to all internal
  docs and source.

**Runtime target** controls which binary and Operator APK are used:

- `local-dev`: `CLAWPERATOR_BIN` (defaults to
  `node apps/node/dist/cli/index.js`) + `com.clawperator.operator.dev`
- `published`: global `clawperator` npm binary + `com.clawperator.operator`

## Repository Structure

```
evals/
├── README.md
├── .gitignore            (ignores runs/ and __pycache__)
├── run_eval.py           (CLI entry point)
├── harness/
│   ├── __init__.py
│   ├── runner.py
│   ├── environment.py
│   ├── scorer.py
│   ├── artifacts.py
│   └── agents/
│       ├── __init__.py
│       ├── base.py
│       ├── claude.py     (Phase 1)
│       ├── gemini.py     (Phase 2)
│       ├── codex.py      (Phase 2)
│       └── kimi.py       (Phase 2)
└── specs/
    └── android-version/
        ├── spec.json
        ├── prompt-public.md
        └── prompt-full-repo.md  (Phase 3)
```

Run artifacts (gitignored):
```
evals/runs/
└── android-version-20260328-143022-claude-opus/
    ├── config.json
    ├── result.json
    └── transcript.txt
```

## Agent CLI Invocations

All four agent CLIs are installed. Non-interactive invocations verified:

| Agent | Non-interactive flag | Model flag | Work-dir flag |
| --- | --- | --- | --- |
| Claude Code | `-p "<prompt>" --dangerously-skip-permissions --output-format stream-json` | `--model` | cwd of subprocess |
| Gemini CLI | `-p "<prompt>" --yolo --output-format stream-json` | `--model` | cwd of subprocess |
| Codex | `exec --dangerously-bypass-approvals-and-sandbox "<prompt>"` | `-m` | `-C <dir>` |
| Kimi | `--print --yolo -p "<prompt>"` | `--model` | `--work-dir <dir>` |

## Result Schema

`result.json` for every run:

```json
{
  "run_id": "<eval_id>-<timestamp>-<agent>-<model_short>",
  "eval_id": "android-version",
  "started_at": "<ISO8601>",
  "finished_at": "<ISO8601>",
  "agent": { "type": "claude", "model": "claude-opus-4-5", "extra_flags": [] },
  "knowledge_mode": "public-surface",
  "runtime_target": "local-dev",
  "spec": {
    "eval_version": "1.0.0",
    "prompt_file": "prompt-public.md",
    "prompt_sha256": "<sha256 of rendered prompt>"
  },
  "invocation": {
    "command": ["claude", "-p", "...", "--model", "...", "..."],
    "work_dir": "/tmp/clawperator-eval-<id>",
    "env_overrides": {
      "ANDROID_SERIAL": "<device_serial>",
      "CLAWPERATOR_BIN": "...",
      "CLAWPERATOR_OPERATOR_PACKAGE": "..."
    }
  },
  "environment": {
    "device_serial": "<device_serial>",
    "ground_truth_android_version": "15",
    "clawperator_bin": "...",
    "clawperator_version": "0.5.3",
    "operator_package": "..."
  },
  "outcome": {
    "status": "pass",
    "answer_extracted_raw": "Android 15",
    "answer_normalized": "15",
    "ground_truth_normalized": "15",
    "answer_correct": true,
    "failure_reason": null
  },
  "metrics": {
    "wall_clock_s": 87.4,
    "timeout_budget_s": 300,
    "clawperator_commands_detected": 8,
    "answer_emitted": true,
    "used_disallowed_tool": false,
    "turns_counted": null,
    "turns_budget": null
  },
  "artifacts": { "transcript": "transcript.txt", "config": "config.json" }
}
```

`outcome.status` values:

| Status | Meaning | Phase |
| --- | --- | --- |
| `pass` | Correct answer emitted before timeout | 1 |
| `fail` | Answer emitted but incorrect | 1 |
| `no_answer` | Timeout reached, no answer emitted | 1 |
| `timeout` | Wall-clock limit reached | 1 |
| `error` | Harness or environment error | 1 |
| `budget_exceeded` | Turn limit reached before answer | 2 |

`turns_counted` and `turns_budget` are `null` in Phase 1, populated in Phase 2.

## Harness CLI

```
python evals/run_eval.py <eval_id> \
  --agent <claude|gemini|codex|kimi> \
  --model <model> \
  [--device <serial>] \
  [--mode <public-surface|full-repo>] \
  [--runtime <local-dev|published>] \
  [--timeout-s <int>] \
  [--max-turns <int>] \
  [--runs-dir <path>] \
  [--dry-run] \
  [--rescore <run_id>]
```

`--max-turns` is accepted in Phase 1 but not enforced. Enforcement activates
in Phase 2.

## First Eval: `android-version`

The agent must use Clawperator's CLI to navigate Android Settings, determine
the Android version, and emit it as a structured answer. Ground truth is
`adb shell getprop ro.build.version.release`, collected before the agent is
spawned.

Full spec, prompt, scoring rules, and validation: `tasks/evals/phase-1/`.

## Failure Modes To Prevent Across All Phases

- Spawning the agent before the doctor pre-flight passes. Always run
  `clawperator doctor` in `environment.py` and abort with `error` status if
  it fails.
- Letting a buggy agent run until system OOM. Always enforce the wall-clock
  timeout; send SIGTERM then SIGKILL after 5 seconds.
- Losing the answer if the agent emits it just before timeout. Scan the full
  transcript for the answer marker before terminating.
- Comparing answer strings without normalization. Always run `normalize_version`
  on both sides before scoring.
- Recording a `pass` for a run where the agent bypassed Clawperator and called
  `adb shell` directly. Detect and record `used_disallowed_tool` regardless of
  the score.
- Leaking repo paths into the agent's environment in `public-surface` mode.
  The agent's working directory must be a clean temp dir with no repo files.

## Durable Follow-Up

After Phase 1 ships, the following should be moved to their permanent homes:

| Item | Destination |
| --- | --- |
| Eval harness design decisions | `docs/internal/design/` |
| Documented agent invocation patterns | `evals/README.md` |
| Known eval fairness gaps | Fixed in `docs/` before declaring results meaningful |
