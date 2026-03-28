# Clawperator Eval System - Implementation Plan

Created: 2026-03-28

## Purpose

Define and ship an initial eval harness for measuring whether an unfamiliar agent
can use Clawperator's public-facing surfaces to operate a connected Android device
and complete a real task autonomously.

This is both a practical capability benchmark and a foundation for a future
public-facing eval story. The design intentionally starts small and grows cleanly.

---

## Context and Constraints

- The eval harness lives in the main Clawperator repo under `evals/`.
- Clawperator is the deterministic "hand." The agent under evaluation is the "brain."
- The eval measures the full system loop (observe → decide → act), not a scripted
  workflow. The agent must reason from docs and tool output.
- Python is the implementation language for the harness. The existing repo uses
  TypeScript/Node for the API layer and bash for scripts; Python is conventional
  for eval tooling and does not require compiling before running.
- Run artifacts are gitignored. They accumulate locally and are not committed.
- The existing `.agents/skills/test-recording-validate/runs/` pattern - timestamped
  directories alongside the skill - is the established convention in this repo.
  Evals use the same shape: a `runs/` directory gitignored at the eval layer.

---

## Two Key Axes

Every eval run is parameterized by two independent axes:

### Axis 1: Knowledge Surface

Controls what context the agent is allowed to draw on.

| Mode | What is available |
|---|---|
| `public-surface` | docs.clawperator.com, clawperator.com, clawperator binary + --help, device info provided in prompt. No repo access. |
| `full-repo` | Full repo directory. All internal docs, source, and design files in scope. |

**Public-surface** is the primary fairness target for the first eval. The agent
should not need to read internal source to succeed at a real automation task.

Implementation: working directory differs by mode.
- `public-surface`: agent runs in an isolated temp directory with no repo access.
  The prompt gives it the docs URL, the path to the clawperator binary, and the
  device serial.
- `full-repo`: agent runs from the repo root.

### Axis 2: Runtime Target

Controls which Clawperator binary and Operator APK are used.

| Mode | Binary | Operator package |
|---|---|---|
| `local-dev` | `node apps/node/dist/cli/index.js` (via `CLAWPERATOR_BIN`) | `com.clawperator.operator.dev` (via `CLAWPERATOR_OPERATOR_PACKAGE`) |
| `published` | `clawperator` (global npm install) | `com.clawperator.operator` |

The env vars `CLAWPERATOR_BIN` and `CLAWPERATOR_OPERATOR_PACKAGE` are already
established in the project and map directly to these two modes. The harness reads
them and surfaces them to the agent's environment.

For initial development, always use `local-dev`. Published mode is added later
once the harness is stable.

---

## Agent Support

The harness wraps each agent CLI as an adapter. All four CLIs are installed on
this machine. Non-interactive invocation for each:

### Claude Code

```bash
claude -p "<prompt>" \
  --model <model> \
  --dangerously-skip-permissions \
  --output-format stream-json
```

Model examples: `claude-opus-4-5`, `claude-sonnet-4-5`, `sonnet`, `opus`

Notes:
- `--dangerously-skip-permissions` enables fully non-interactive mode.
- `--output-format stream-json` gives structured per-event output for turn
  counting and transcript capture.
- Working directory controls repo access (set to temp dir for public-surface).

### Gemini CLI

```bash
gemini -p "<prompt>" \
  --model <model> \
  --yolo \
  --output-format stream-json
```

Model examples: `gemini-2.5-pro`, `gemini-2.5-flash`

Notes:
- `--yolo` auto-approves all tool actions (non-interactive).
- `--output-format stream-json` for structured output.
- Working directory controls repo access.

### Codex (OpenAI)

```bash
codex exec \
  --dangerously-bypass-approvals-and-sandbox \
  -m <model> \
  "<prompt>"
```

Or via stdin:
```bash
echo "<prompt>" | codex exec --dangerously-bypass-approvals-and-sandbox -m <model> -
```

Model examples: `o3`, `o4-mini`, `gpt-4o`

Notes:
- `--dangerously-bypass-approvals-and-sandbox` skips all confirmation prompts.
- `-C <dir>` sets working directory for public-surface mode isolation.
- No structured stream-json; output is captured as raw text.

### Kimi

```bash
kimi --print --yolo \
  --model <model> \
  -p "<prompt>"
```

Model examples: `kimi-k2`, `moonshot-v1-8k`

Notes:
- `--print` enables non-interactive mode and implicitly adds `--yolo`.
- `--work-dir <dir>` sets working directory for isolation.
- `--output-format stream-json` available for structured output.

### Ollama (future)

Ollama models are accessed via Codex's `--oss` flag or a dedicated adapter.
Not in scope for Phase 1 but the adapter interface is designed to accommodate it.

---

## Repository Structure

```
evals/
├── README.md                       - How to run evals, environment setup
├── .gitignore                      - Ignores runs/ and __pycache__
├── run_eval.py                     - CLI entry point
├── harness/                        - Python harness package
│   ├── __init__.py
│   ├── runner.py                   - Orchestrates a single eval run
│   ├── environment.py              - Device check, ground truth, env validation
│   ├── scorer.py                   - Answer extraction and comparison
│   ├── artifacts.py                - Run artifact writing and result schema
│   └── agents/
│       ├── __init__.py
│       ├── base.py                 - BaseAgent interface
│       ├── claude.py               - Claude Code adapter
│       ├── gemini.py               - Gemini CLI adapter
│       ├── codex.py                - Codex (OpenAI) adapter
│       └── kimi.py                 - Kimi adapter
└── specs/
    └── android-version/            - First eval
        ├── spec.json               - Eval specification
        ├── prompt-public.md        - Task prompt for public-surface mode
        └── prompt-full-repo.md     - Task prompt for full-repo mode (future)
```

Run artifacts land in a gitignored directory:

```
evals/runs/
└── android-version-20260328-143022-claude-opus/
    ├── config.json        - Full run configuration (agent, mode, env)
    ├── result.json        - Outcome, answer, metrics
    └── transcript.txt     - Full agent stdout/stderr
```

The `evals/runs/` path is added to `.gitignore`. Keeping runs under `evals/` rather
than a repo-root `.runs/` keeps all eval-related material co-located and makes the
gitignore entry unambiguous.

---

## Harness Components

### runner.py

Orchestrates a single eval run end-to-end:

1. Load eval spec from `specs/<eval-id>/spec.json`.
2. Call `environment.py` to validate device connectivity and collect ground truth.
3. Instantiate the correct agent adapter from `agents/`.
4. Build the task prompt (substituting device serial, bin path, operator package,
   docs URL as template variables).
5. Spawn the agent subprocess with the correct flags, working directory, and
   environment variables.
6. Stream agent output to transcript file in real time.
7. Monitor for:
   - Agent emitting the answer marker (`CLAWPERATOR_EVAL_ANSWER: <value>`)
   - Wall-clock timeout (configurable, default 300s)
   - Turn budget (configurable, default 40 turns; counted from stream-json events
     where available, approximated otherwise)
8. Terminate agent on timeout or budget exceeded.
9. Call `scorer.py` with transcript and ground truth.
10. Write full result to `artifacts.py`.

### environment.py

Pre-flight before any agent is spawned:

- Verify `adb` is on PATH.
- Run `adb devices` and check at least one authorized device is present.
- If `--device` is specified, verify that serial is present.
- Collect ground truth: `adb [-s <serial>] shell getprop ro.build.version.release`.
  Strip whitespace. Reject empty result.
- Resolve `CLAWPERATOR_BIN`: use env var if set, else `node apps/node/dist/cli/index.js`
  relative to repo root.
- Resolve `CLAWPERATOR_OPERATOR_PACKAGE`: use env var if set, else
  `com.clawperator.operator.dev`.
- Verify the resolved binary is executable.
- Return an `Environment` dataclass with all resolved values.

The scorer's ground truth is collected here, before the agent is spawned, from
an independent path (direct adb call) that has nothing to do with the Clawperator
UI automation path the agent will take.

### agents/base.py

```python
class BaseAgent:
    type_id: str          # "claude", "gemini", "codex", "kimi"
    model: str
    knowledge_mode: str   # "public-surface" | "full-repo"
    extra_flags: list[str]

    def build_command(self, prompt: str, work_dir: str) -> list[str]: ...
    def build_env(self, base_env: dict) -> dict: ...
    def count_turn(self, line: str) -> bool: ...
    # count_turn returns True if the line represents a completed agent turn
    # (used to track turn budget). For stream-json agents, looks for role:assistant
    # events. For text-output agents, uses heuristic markers.
```

Each adapter subclass implements `build_command`, `build_env`, and `count_turn`.

Key concern: turn counting is agent-specific.
- Claude: `stream-json` output includes `{"type":"message","role":"assistant",...}`
  events; each one is a completed turn.
- Gemini: similar `stream-json` events.
- Codex: no structured streaming; turns are approximated by observing the agent
  re-emitting its "thinking" prefix or tool-call/result pairs.
- Kimi: `--output-format stream-json` when available, else approximated.

Turn counting is best-effort for Phase 1. Wall-clock timeout is the primary
safety net. Turn budget is a secondary limit to prevent runaway costs.

### scorer.py

The scorer is intentionally separate from the harness runner so it can be used
standalone to re-score a saved transcript.

```python
def extract_answer(transcript: str) -> str | None:
    # Scan transcript lines for:
    # CLAWPERATOR_EVAL_ANSWER: <value>
    # Return the last occurrence (allows the agent to revise).
    ...

def score(answer: str | None, ground_truth: str) -> ScorerResult:
    # Normalize both to stripped lowercase for comparison.
    # Returns pass/fail + match details.
    ...
```

The answer marker `CLAWPERATOR_EVAL_ANSWER: <value>` is:
- Defined in the task prompt ("when you have determined the answer, output exactly:
  `CLAWPERATOR_EVAL_ANSWER: <version>`").
- Unique enough that it will not appear in normal tool output.
- Easy to grep for post-hoc analysis.

### artifacts.py

Writes the canonical run result. The `result.json` schema is defined below.
Also writes `config.json` (full run parameters) and `transcript.txt` (raw output).

---

## Result Schema

`result.json` for a single eval run:

```json
{
  "run_id": "android-version-20260328-143022-claude-opus",
  "eval_id": "android-version",
  "started_at": "2026-03-28T14:30:22Z",
  "finished_at": "2026-03-28T14:31:49Z",

  "agent": {
    "type": "claude",
    "model": "claude-opus-4-5",
    "extra_flags": []
  },

  "knowledge_mode": "public-surface",
  "runtime_target": "local-dev",

  "environment": {
    "device_serial": "<device_serial>",
    "ground_truth_android_version": "15",
    "clawperator_bin": "apps/node/dist/cli/index.js",
    "clawperator_version": "0.5.3",
    "operator_package": "com.clawperator.operator.dev"
  },

  "outcome": {
    "status": "pass",
    "answer_extracted": "15",
    "answer_correct": true,
    "failure_reason": null
  },

  "metrics": {
    "wall_clock_s": 87.4,
    "turns_counted": 12,
    "turns_budget": 40,
    "timeout_budget_s": 300,
    "clawperator_commands_detected": 8,
    "answer_emitted": true,
    "first_answer_turn": 12
  },

  "artifacts": {
    "transcript": "transcript.txt",
    "config": "config.json"
  }
}
```

`outcome.status` is one of:
- `pass` - correct answer emitted within budget
- `fail` - answer emitted but incorrect
- `no_answer` - budget or timeout reached without emitting an answer
- `timeout` - wall-clock limit reached
- `budget_exceeded` - turn limit reached before answer
- `error` - harness or environment error (not agent failure)

`metrics.clawperator_commands_detected` is a count of lines in the transcript
that include the Clawperator result envelope marker `[Clawperator-Result]`, giving
a rough signal for how heavily the agent used the tool vs. guessed.

---

## First Eval: `android-version`

### Task Definition

Given a connected Android device or emulator, determine the device's Android
version by exploring Android Settings dynamically using Clawperator's public
CLI/API. Return the correct Android version string as the final answer.

No prebuilt skill for this task exists. The agent must discover the path itself.

### Task Prompt (public-surface mode)

```
You are an autonomous agent with access to a connected Android device via the
Clawperator CLI. Your task is to determine the Android version running on the
device and return it as your final answer.

Environment:
- Clawperator binary: $CLAWPERATOR_BIN
- Operator package: $CLAWPERATOR_OPERATOR_PACKAGE
- Target device serial: $DEVICE_SERIAL
- Clawperator documentation: https://docs.clawperator.com

Instructions:
1. Use the Clawperator CLI to observe the device UI and navigate Android Settings
   to find the Android version. Do not use adb directly or any other method - use
   only Clawperator commands.
2. Use the observe-decide-act loop: snapshot the current state, decide what to do,
   execute an action, repeat.
3. When you have determined the Android version, output exactly this line and
   nothing else after it:

   CLAWPERATOR_EVAL_ANSWER: <version>

   where <version> is the Android version string (e.g. "15" or "14").

4. If you cannot determine the version within your allowed attempts, output:

   CLAWPERATOR_EVAL_ANSWER: unknown

Constraints:
- Use only Clawperator commands for device interaction.
- Do not use adb shell commands directly.
- Reference only the public documentation at https://docs.clawperator.com.
- Pass --device $DEVICE_SERIAL on every Clawperator command.
- Pass --operator-package $CLAWPERATOR_OPERATOR_PACKAGE on every Clawperator command.
```

Template variables (`$CLAWPERATOR_BIN`, `$DEVICE_SERIAL`, `$CLAWPERATOR_OPERATOR_PACKAGE`)
are substituted by the harness before spawning the agent.

### Constraints

- Agent may only call Clawperator CLI commands for device interaction.
- No direct `adb shell` calls (prompt instructs against it; prompt violation is
  recorded in transcript and noted in post-hoc analysis, but does not auto-fail
  the run - the answer correctness is what matters for the score).
- Knowledge mode: `public-surface` (agent's working directory is a temp dir;
  no repo access).
- Runtime target: `local-dev` (branch-local build, `.dev` operator package).

### Required Environment

- At least one authorized Android device or emulator connected via adb.
- Clawperator Operator APK installed and permissioned on the target device.
- `CLAWPERATOR_BIN` set (or defaults to `node apps/node/dist/cli/index.js` from
  repo root).
- `CLAWPERATOR_OPERATOR_PACKAGE` set (or defaults to `com.clawperator.operator.dev`).
- The target device has Android Settings app (all standard Android devices do).
- Doctor check passes: `$CLAWPERATOR_BIN doctor` exits 0.

### Success Criteria

The run is scored `pass` if and only if:
1. The agent emits `CLAWPERATOR_EVAL_ANSWER: <value>` before timeout/budget.
2. `<value>` (stripped, lowercased) matches `ro.build.version.release` (stripped,
   lowercased) as read by the harness before the run.

Matching is exact string equality after normalization. If the device reports "15"
and the agent answers "Android 15" the run scores `fail`. This strictness is
intentional - it surfaces prompt clarity issues.

### Timeout and Budget

| Parameter | Default | Configurable |
|---|---|---|
| Wall-clock timeout | 300s (5 min) | Yes, `--timeout-s` |
| Turn budget | 40 turns | Yes, `--max-turns` |

Generous defaults for the first eval. Tighten after reviewing failure traces.

### Failure Behavior

On timeout or budget exceeded:
- Agent subprocess is sent SIGTERM, then SIGKILL after 5 seconds.
- Partial transcript is saved.
- Status is `timeout` or `budget_exceeded` respectively.
- Metrics are recorded for the partial run (turns used, commands detected, etc.).

---

## Harness CLI: run_eval.py

```
Usage: python run_eval.py [OPTIONS] EVAL_ID

Options:
  --agent     TYPE     Agent type: claude, gemini, codex, kimi [required]
  --model     MODEL    Model identifier passed to the agent CLI [required]
  --device    SERIAL   ADB device serial (required if multiple devices connected)
  --mode      MODE     Knowledge mode: public-surface, full-repo [default: public-surface]
  --runtime   TARGET   Runtime target: local-dev, published [default: local-dev]
  --timeout-s INT      Wall-clock timeout in seconds [default: 300]
  --max-turns INT      Maximum turn budget [default: 40]
  --runs-dir  PATH     Override runs output directory [default: evals/runs/]
  --dry-run            Print resolved config and prompt, then exit without running
  --rescore   RUN_ID   Re-score a saved run from transcript (no agent spawn)
```

Example invocations:

```bash
# Claude Opus, public-surface, local-dev (typical dev run)
python evals/run_eval.py android-version \
  --agent claude --model claude-opus-4-5

# Claude Sonnet with explicit device
python evals/run_eval.py android-version \
  --agent claude --model claude-sonnet-4-5 \
  --device <device_serial>

# Gemini 2.5 Pro
python evals/run_eval.py android-version \
  --agent gemini --model gemini-2.5-pro

# Codex o3
python evals/run_eval.py android-version \
  --agent codex --model o3

# Kimi K2
python evals/run_eval.py android-version \
  --agent kimi --model kimi-k2

# Full-repo mode for comparison
python evals/run_eval.py android-version \
  --agent claude --model claude-opus-4-5 \
  --mode full-repo

# Dry run to inspect prompt before committing API spend
python evals/run_eval.py android-version \
  --agent claude --model claude-opus-4-5 --dry-run

# Re-score a saved transcript
python evals/run_eval.py android-version \
  --rescore android-version-20260328-143022-claude-opus
```

---

## Spec File Format

`evals/specs/android-version/spec.json`:

```json
{
  "eval_id": "android-version",
  "name": "Determine Android Version via Settings",
  "description": "Agent must navigate Android Settings using Clawperator CLI to determine the device Android version.",
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

---

## Issues That Will Make This Eval Weak Unless Addressed

These are current gaps that will likely cause unfair or misleading results for an
agent operating in public-surface mode. They should be resolved before the eval
is used as a meaningful benchmark.

### 1. No "getting started" workflow guide on the public docs

The docs cover individual commands well, but there is no page that explains the
observe → decide → act loop as an end-to-end workflow. An unfamiliar agent must
infer the pattern from individual command docs. This is the single biggest risk
for a false `fail` that reflects docs quality rather than agent capability.

**Fix:** Add a short "Automation Workflow" or "First Steps" page to the public docs
that shows the basic loop: `snapshot` to observe, decide what to tap/type, execute
the action, repeat.

### 2. `snapshot` output format may not be clearly documented

The agent needs to understand what `clawperator snapshot` returns (XML UI hierarchy)
and how to extract text from it (e.g., the `text` attribute on nodes). If the docs
do not clearly show a sample snapshot and explain how to read it, agents will
struggle to navigate.

**Fix:** Verify `docs/api/snapshot.md` contains a real example with explanation of
key attributes (`text`, `content-desc`, `resource-id`). If not, add one.

### 3. Answer format strictness vs. prompt clarity

The prompt currently requires the agent to emit the Android version as a bare
string (e.g. "15" not "Android 15"). If the device's `ro.build.version.release`
returns "15" but the docs or Settings UI display "Android 15", the agent might
copy the display string. This is a real ambiguity.

**Fix:** The prompt should clarify: "output the exact version number as it appears
in `ro.build.version.release` format, e.g. '15', not 'Android 15'." Alternatively,
the scorer normalizes both sides (strip "Android " prefix before comparing). The
latter is more forgiving and probably correct.

**Recommendation:** Make the scorer strip the "Android " prefix from both values
before comparison. Update the prompt to say "the numeric version string (e.g. 15)".

### 4. `--device` flag requirement across all commands

If the agent forgets to pass `--device` on some commands (when multiple devices are
connected), those commands will fail or target the wrong device. The prompt already
instructs the agent to pass `--device` on every command. But if the harness ensures
only one device is visible to the agent (by setting `ANDROID_SERIAL` in the agent's
env), the problem goes away without relying on prompt adherence.

**Fix:** Set `ANDROID_SERIAL=<device_serial>` in the agent's environment. This is
the adb convention for defaulting to a specific device and is honored by
Clawperator. Document this in the harness design.

### 5. `clawperator doctor` not surfaced in prompt

An unfamiliar agent may not think to run `doctor` first to verify the environment.
A failing Operator service will produce confusing errors if the agent goes straight
to `snapshot`. The harness should run `doctor` as a pre-flight before spawning the
agent and fail the run with `error` status if it does not pass, rather than letting
the agent waste its turn budget on environment setup.

**Fix:** Add `doctor` pre-flight to `environment.py`. If it fails, emit a clear
`environment_check_failed` error in `result.json` and do not spawn the agent.

### 6. No baseline "open Settings" navigation example in docs

The agent needs to know how to open the Android Settings app. It should be able
to discover this from the `open` command docs and the Android Settings package name
(`com.android.settings`). But if the docs do not make this obvious, the agent may
try to navigate from whatever screen is currently active.

**Mitigation:** The prompt can tell the agent "start from Android Settings" and
provide the package name. This is fair for the public-surface mode since the
package name is widely known. Alternatively, confirm `docs/api/actions.md` covers
the `open` action with an example.

---

## Phased Implementation Plan

### Phase 1 - Minimum Viable Eval (first milestone)

**Goal:** One working eval run for one agent (Claude) that produces a scored result
and saved artifacts.

**Scope:**
- `evals/` directory structure as defined above.
- `evals/.gitignore` ignoring `runs/` and `__pycache__/`.
- `evals/harness/` Python package:
  - `environment.py` with device check, ground truth collection, doctor pre-flight,
    `ANDROID_SERIAL` injection.
  - `agents/base.py` and `agents/claude.py` only.
  - `runner.py` orchestrating the full loop (spawn, stream, timeout, kill).
  - `scorer.py` with answer extraction and normalized exact-match scoring.
  - `artifacts.py` writing `result.json`, `config.json`, `transcript.txt`.
- `evals/specs/android-version/`:
  - `spec.json` as defined above.
  - `prompt-public.md` as defined above (with template variables).
- `evals/run_eval.py` CLI entry point (minimal: `--agent`, `--model`, `--device`,
  `--dry-run`, positional eval ID).
- `evals/README.md` covering: prerequisites, how to run, how to read results.
- Pre-flight doctor check added to `environment.py`.
- Scorer normalizes "Android " prefix.
- `ANDROID_SERIAL` injected into agent env.

**Not in Phase 1:**
- Gemini, Codex, Kimi adapters.
- `full-repo` mode (prompt file can exist as a placeholder).
- Published runtime target.
- `--rescore` flag.
- Turn counting (wall-clock timeout only).
- Multi-eval comparison tooling.

**Done when:** `python evals/run_eval.py android-version --agent claude --model claude-opus-4-5`
runs end-to-end, produces a `result.json` with a valid `outcome.status`, and the
transcript shows real Clawperator commands being executed.

**Acceptance check (manual):**
- At least one passing run (status `pass`) with a correct Android version.
- At least one intentional failure run (e.g. wrong device, no Operator) that
  produces status `error` with a clear failure reason.
- Transcript is readable and shows the agent's full reasoning trace.

### Phase 2 - Additional Agents

**Goal:** All four agent types (claude, gemini, codex, kimi) can run the same eval.
Add turn counting where stream-json is available.

**Scope:**
- `agents/gemini.py`, `agents/codex.py`, `agents/kimi.py` adapters.
- Turn counting via stream-json parsing for Claude and Gemini.
- Approximate turn counting for Codex and Kimi.
- `--max-turns` flag active and enforced.
- `--rescore` flag for re-scoring saved transcripts.
- Side-by-side summary: `python evals/run_eval.py --compare <run_id_1> <run_id_2>`.

### Phase 3 - Runtime Targets and Full-Repo Mode

**Goal:** Enable published runtime testing and full-repo knowledge mode for
gap analysis.

**Scope:**
- `--runtime published` support: use global `clawperator` binary and
  `com.clawperator.operator` package.
- `prompt-full-repo.md` for the android-version eval.
- `--mode full-repo` sets working directory to repo root.
- Version pinning in results (record which npm version of clawperator was used).

### Phase 4 - Skill Generation Extension

**Goal:** Extend the android-version eval to score whether the agent also produces
a reusable Clawperator skill for the task.

**Scope:**
- Secondary scoring dimension: did the agent emit a valid skill artifact?
- Replay eval: run the generated skill deterministically and score its output.
- Metrics: skill correctness, replay success rate.

---

## Open Questions (to resolve during Phase 1)

1. **Prompt working directory for public-surface mode:** The cleanest isolation is
   a fresh `tempfile.mkdtemp()` with no files. Confirm that all four agent CLIs
   function correctly when their working directory has no CLAUDE.md / GEMINI.md /
   equivalent context file. If they require one, create a minimal one that lists
   only the public docs URL.

2. **Stream JSON parsing fragility:** Claude and Gemini stream-json formats may
   change across versions. Implement turn counting defensively (log a warning and
   fall back to wall-clock-only if parsing fails, rather than crashing the run).

3. **Transcript size:** A 40-turn run with snapshot XML in each turn could produce
   large transcripts. Consider capping transcript at 10MB and truncating with a
   marker if exceeded.

4. **Parallel runs:** The harness runs one eval at a time. Parallel execution
   (multiple agents at once) is explicitly out of scope for Phase 1 to avoid
   device contention. Add a note in README.

5. **Cost tracking:** `--max-budget-usd` is available for Claude Code. Consider
   surfacing it as a harness option for budget-sensitive runs. Not in Phase 1.
