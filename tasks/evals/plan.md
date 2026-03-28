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

- **public-surface mode** (soft isolation): the agent runs in a freshly created
  temp directory (`tempfile.mkdtemp()`). No repo files are placed in this
  directory. No repo paths appear in the agent's environment or prompt. The
  agent's filesystem access is NOT sandboxed - it could traverse the filesystem
  if it chose to. The eval's claim is: 'the agent was not given repo access'
  (passive), not 'the agent was prevented from accessing the repo' (active). If
  eval integrity requires real isolation, add hard sandboxing in a future phase.
  Prompt provides only: `docs.clawperator.com`, `clawperator.com`, the
  clawperator command, and the device serial.
- `full-repo`: agent runs from the repo root with full access to all internal
  docs and source.

**Runtime target** controls which binary and Operator APK are used:

- `local-dev`: `CLAWPERATOR_CMD` (defaults to
  `["node", "<repo_root>/apps/node/dist/cli/index.js"]`) + `com.clawperator.operator.dev`
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

## Agent Capability Matrix

| Agent | Non-interactive flag | Stream JSON | Explicit work-dir | Turn counting | Confidence |
| --- | --- | --- | --- | --- | --- |
| Claude | `--dangerously-skip-permissions` | yes (`--output-format stream-json`) | cwd of subprocess | Parse `"type":"message"` JSON lines | high |
| Gemini | `--yolo` | yes (`--output-format stream-json`) | cwd of subprocess | Empirical (verify in Phase 2) | medium |
| Codex | `--dangerously-bypass-approvals-and-sandbox` | no (plain text) | `-C <dir>` | Heuristic only | low |
| Kimi | `--print --yolo` | maybe (verify in Phase 2) | `--work-dir <dir>` | Heuristic only | low |

Note: "Confidence" is for turn counting only. All four are viable for task completion.

## Result Schema

`result.json` for every run:

```json
{
  "run_id": "<eval_id>-<timestamp>-<agent>-<model_short>[-<label_slug>]",
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
  "run_label": "baseline-opus",
  "invocation": {
    "command": ["claude", "-p", "...", "--model", "...", "..."],
    "work_dir": "/tmp/clawperator-eval-<id>",
    "env_overrides": {
      "ANDROID_SERIAL": "<device_serial>",
      "CLAWPERATOR_CMD": "node /path/to/dist/cli/index.js",
      "CLAWPERATOR_OPERATOR_PACKAGE": "..."
    }
  },
  "environment": {
    "device_serial": "<device_serial>",
    "ground_truth_android_version": "15",
    "ground_truth_collected_at": "<ISO8601>",
    "ground_truth_rechecked_at": null,
    "clawperator_cmd": ["node", "/path/to/dist/cli/index.js"],
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
    "time_to_first_clawperator_command_s": 4.2,
    "timeout_budget_s": 300,
    "clawperator_commands_detected": 8,
    "actions_per_turn": null,
    "answer_emitted": true,
    "violations": {
      "used_adb": false
    },
    "diagnostics": {
      "used_snapshot": true,
      "used_open_settings": true,
      "navigated_settings": true,
      "failure_classification": "navigation",
      "domains_accessed": ["docs.clawperator.com"]
    },
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

`run_label` is optional user-provided metadata. If present, it is appended to
`run_id` as a filesystem-safe slug and recorded in `config.json`.

`time_to_first_clawperator_command_s` is diagnostic-only and measures the
latency from agent spawn to the first exact `[Clawperator-Result]` envelope.
It helps distinguish "thinking too long" from "navigation failure" and does
not affect scoring.

`actions_per_turn` is diagnostic-only and is computed as
`clawperator_commands_detected / turns_counted` when both values are known.
It is null in Phase 1.

`clawperator_commands_detected` counts only exact line-start matches of
`[Clawperator-Result]` and is diagnostic-only. It helps inspection, but it
does not drive scoring or status selection.

`metrics.violations.used_adb` is the authoritative diagnostic flag for direct
`adb shell` usage. `used_disallowed_tool` remains a derived summary field for
backwards compatibility and is not a scoring gate.

`metrics.diagnostics.*` are heuristic-only breadcrumbs to summarize the
transcript. They are there for triage, not for status selection.

`metrics.diagnostics.failure_classification` is a coarse, best-effort label
for transcript triage. Acceptable values in Phase 1 are `unknown`,
`navigation`, `docs`, `tool_usage`, and `timeout`.

`metrics.diagnostics.domains_accessed` is a best-effort list of outbound HTTP
domains observed in transcript or proxy logs. It is for traceability when docs
links or external content seem to influence behavior.

## Outcome Precedence

When multiple terminal conditions could apply simultaneously, the harness uses
this precedence (highest to lowest):

| Priority | Condition | Status |
| --- | --- | --- |
| 1 | Harness or environment error (pre-flight failure, subprocess crash, I/O error) | `error` |
| 2 | Answer emitted and correct | `pass` |
| 3 | Answer emitted and incorrect | `fail` |
| 4 | Turn budget reached before answer | `budget_exceeded` |
| 5 | Wall-clock timeout reached before answer | `timeout` |
| 6 | Process exited normally with no answer emitted | `no_answer` |

Rules:
- An answer that arrives in the final line before timeout still wins (priority 2/3 beats 4/5).
- `budget_exceeded` only fires if `--max-turns` is set and the agent has not yet emitted an answer.
- `error` always wins. A run where the harness itself fails is not a `fail` - it is an `error`.

Edge cases:
- If the agent emits a valid answer marker on the very last line before the timeout fires (race
  condition): the answer wins. The timer thread sets `timeout_triggered` but the for-loop reads
  one more line before exiting. Check `last_answer` after the loop, before checking
  `timeout_triggered.is_set()`. Answer takes priority 2/3 over timeout (priority 5).
- If the agent emits `CLAWPERATOR_EVAL_ANSWER:` with no value (empty after colon): this is a
  malformed marker. Do NOT count it as an answer. The regex must require at least one
  non-whitespace character after the colon.
- If the agent emits the marker inside a JSON blob or code block (i.e. not at
  line start): it does NOT match. The regex requires `^CLAWPERATOR_EVAL_ANSWER:`
  at the beginning of a line. Agents must emit the marker as a bare line.
  This is intentional - it prevents false positives from tool output logs.
- "Last valid match wins" means: if the agent emits the marker 5 times, the 5th (last) valid
  match is the answer, regardless of what came before.

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
  [--label <text>] \
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
  `adb shell` directly. Detect and record `metrics.violations.used_adb`
  regardless of the score; do not fail the run automatically.
- Leaking repo paths into the agent's environment in `public-surface` mode.
  The agent's working directory must be a clean temp dir with no repo files.
- Counting `[Clawperator-Result]` with substring matching. Use an exact
  line-start prefix match only: `r"^\[Clawperator-Result\]"`.
- Letting timeout cleanup drop buffered transcript lines. Flush transcript
  buffers and close file handles before escalating from SIGTERM to SIGKILL.
- Building command invocations as shell strings. Always pass subprocess argv
  lists directly and use `shlex.join(cmd)` only for human-readable logging.
- Failing to capture agent-binary availability up front. Resolve the adapter's
  executable during preflight and abort with `agent_binary_not_found` if it is
  unavailable.
- Failing to capture domain-level traceability when docs-linked behavior seems
  surprising. Capture accessed domains when possible so prompt-injection-style
  surprises can be triaged later.

## Internal Documentation

Two internal doc artifacts are Phase 1 deliverables:

| Artifact | Path | Phase | Purpose | Required? |
| --- | --- | --- | --- | --- |
| Harness operational README | `evals/README.md` | 1 | How to run evals, add adapters, read results | required |
| Eval system design doc | `docs/internal/design/evals.md` | 1 | Design rationale, isolation rules, marker protocol, detection heuristics | best-effort |

Content requirements for both are specified in `tasks/evals/phase-1/work-breakdown.md` sub-phase 1c.

### Eval System Design Doc

`docs/internal/design/evals.md` must capture the following decisions durably so
they survive task cleanup and inform future maintainers and agents:

- **Why evals exist**: measurement instrument for docs quality and API
  discoverability - not a teaching surface. The harness measures whether an
  agent can succeed with the public docs as written.
- **Measurement-not-teaching principle**: eval prompts, spec files, and the
  `CLAWPERATOR_EVAL_ANSWER` marker must never appear in public docs. If agents
  encounter the marker through public docs, future runs measure familiarity
  with the eval format rather than genuine task completion.
- **`CLAWPERATOR_EVAL_ANSWER` marker**: internal eval artifact only. Not a
  production API. Not referenced from `docs.clawperator.com` or
  `clawperator.com`. Agents emit it only because the eval prompt instructs them
  to; it must not appear in production transcripts.
- **Two-axis model**: every run is parameterized by knowledge surface x runtime
  target independently. Rationale for each axis and its values.
- **Public-surface isolation**: why `tempfile.mkdtemp()` and why repo paths
  must not appear in the agent's environment or prompt. Clarify the soft-isolation
  model: the harness does not sandbox the agent; the claim is "agent was not given
  repo access," not "agent was prevented from accessing the repo."
- **`used_disallowed_tool` detection**: the chosen heuristic (finalized during
  Phase 1 implementation), why it is diagnostic-only and non-blocking.
- **Doctor pre-flight requirement**: why the harness aborts before spawning
  the agent rather than letting the agent discover the failure.
- **Compatibility matrix**: future public artifact. Once Phase 1 accumulates
  enough runs, publish `docs/evals-compat.md` with a table of agent/model
  pass rates by eval and knowledge mode. This is the appropriate public output
  of the eval system - it does not expose prompts, markers, or harness internals.

### Compatibility Matrix

The compatibility matrix is NOT part of any current phase. It is deferred until
Phase 1 has at least 10 runs across at least 2 agents. When that threshold is
reached, create `docs/evals-compat.md` with:

- A table: eval name x agent/model x knowledge mode x runtime target -> pass rate
- Footnotes explaining knowledge mode and runtime target
- No mention of `CLAWPERATOR_EVAL_ANSWER` or internal harness mechanics
- Published at `docs.clawperator.com` via the normal docs pipeline
