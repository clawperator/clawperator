# Eval Phase 1: Minimum Viable Harness

## Executive Summary

Ship the first working end-to-end eval run. One eval spec (`android-version`),
one agent adapter (Claude), wall-clock timeout only. The harness produces a
scored `result.json` with a full agent transcript for every run.

1 PR, 4 sub-phases. All sub-phases ship in the same PR.

## Status

| Item | Value |
| --- | --- |
| State | complete |
| Total PRs | 1 |
| Total phases | 4 (1a-1d) |
| Completed | 1a, 1b, 1c, 1d |
| Remaining | none |
| Current / Next | none |
| Blockers | none |

## Goal

`python evals/run_eval.py android-version --agent claude --model <model>`
runs end-to-end on a connected Android device, produces a valid `result.json`
with a correct `outcome.status`, and the transcript shows real Clawperator
commands being executed.

## Why This Phase

Phase 1 is the foundation everything else builds on. Keeping it to one agent
and one eval is intentional: it is faster to discover harness problems on a
thin surface before adding the complexity of multiple agents and specs.

## Implementing Agent

**Kimi** is the default coding agent for implementing this phase. See
`tasks/evals/plan.md` "Implementing Agent" section for full invocation
reference, model name (`kimi-code/kimi-for-coding`), and agent tier to
Kimi flag mapping.

Note: "one agent adapter (Claude)" above refers to the eval subject - the agent
being evaluated. The implementing agent (Kimi) writes the harness code.
The Claude adapter is built first because Claude is the most well-understood
eval subject.

## In Scope

- `evals/` directory structure as defined in `tasks/evals/plan.md`
- `evals/.gitignore` (ignores `runs/` and `__pycache__/`)
- `evals/harness/` Python package: environment, runner, scorer, artifacts,
  base agent, Claude adapter
- `evals/specs/android-version/`: spec.json + prompt-public.md
- `evals/run_eval.py` CLI with flags: positional eval ID, `--agent`,
  `--model`, `--device`, `--mode`, `--runtime`, `--timeout-s`, `--max-turns`
  (accepted but not enforced), `--label`, `--runs-dir`, `--dry-run`
- `evals/README.md` (operational docs: how to run, how to read results,
  how public-surface isolation works, how to add an agent adapter)
- `docs/internal/design/evals.md` (best-effort - write if time allows in 1c;
  if not, write as immediate follow-up commit after 1d passes)
- `.gitignore` at repo root: add `evals/runs/`

## Out of Scope

- Gemini, Codex, Kimi adapters (Phase 2)
- Turn counting or turn budget enforcement (Phase 2)
- `--rescore` flag (Phase 2)
- `--runtime published` (Phase 3)
- `--mode full-repo` + `prompt-full-repo.md` (Phase 3)
- Multi-eval comparison tooling (Phase 3+)
- Skill generation scoring (Phase 4)

## Existing Artifact Scope

| Artifact | Disposition |
| --- | --- |
| `tasks/evals/plan.md` | Already written. Read but do not modify during Phase 1. |
| `.gitignore` (repo root) | Add one entry: `evals/runs/`. No other changes. |
| `evals/` | New directory. Does not exist today. |

## Surfaces and Ownership

| Surface | Path | Change | Required? |
| --- | --- | --- | --- |
| Eval harness | `evals/harness/` | New Python package | required |
| Eval spec | `evals/specs/android-version/` | New spec + prompt | required |
| Eval CLI | `evals/run_eval.py` | New entry point | required |
| Operational README | `evals/README.md` | New | required |
| Internal design doc | `docs/internal/design/evals.md` | New | best-effort |
| Repo gitignore | `.gitignore` | One line added | required |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Agent CLI flags (claude) | Run `claude --help` on this machine |
| ADB device serial convention | `ANDROID_SERIAL` env var is the adb convention |
| Clawperator command resolution | Three-tier: (1) `CLAWPERATOR_BIN` env var if set, (2) local build at `<repo_root>/apps/node/dist/cli/index.js` if present, (3) global `clawperator` via `shutil.which`. Mirrors `apps/node/src/domain/skills/skillsConfig.ts:resolveSkillBin()`. Resolved to `clawperator_cmd: list[str]` during preflight. No `CLAWPERATOR_SCRIPT` env var exists. |
| Operator package resolution | `CLAWPERATOR_OPERATOR_PACKAGE`, fallback `com.clawperator.operator.dev` |
| Doctor pre-flight contract | `apps/node/src/cli/commands/doctor.ts` |
| Result envelope marker | `[Clawperator-Result]` in terminal output |
| Ground truth collection | `adb [-s <serial>] shell getprop ro.build.version.release` (capture timestamp at read time) |
| Overarching design | `tasks/evals/plan.md` |

## Deterministic Versus Judgment

| Aspect | Type | Rule |
| --- | --- | --- |
| Answer marker | Deterministic | `CLAWPERATOR_EVAL_ANSWER:` prefix at line start, last valid occurrence wins. Captures all non-whitespace content after colon (multi-word values like "Android 15" are captured). Empty-after-colon lines are ignored. |
| Scorer normalization | Deterministic | Strip leading/trailing whitespace, lowercase, strip leading `android ` if present, then extract the first digit run if one exists. If no digits exist, compare the trimmed lowercase string. Never compare raw strings. |
| Result marker detection | Deterministic | Count only exact line-start matches of `^\\[Clawperator-Result\\]`; substring matches are ignored. This is best-effort telemetry, not a status gate. Do not let parsing affect control flow. |
| `used_disallowed_tool` detection | Judgment | Detect agent-initiated `adb shell` in transcript. Avoid false positives from Clawperator's own verbose log output. Log `violations.used_adb` separately and keep the heuristic diagnostic-only. |
| Prompt rendering contract | Deterministic | Implement a single `build_prompt(template_path: str, variables: dict) -> str` function. Variables are explicit: `CLAWPERATOR_CMD`, `CLAWPERATOR_OPERATOR_PACKAGE`, `DEVICE_SERIAL`, `DOCS_URL`. No `CLAWPERATOR_BIN` in prompt variables (it is a preflight input only). No implicit string replacement or ad hoc formatting. Use the rendered prompt as input to the agent once per run, and make `CLAWPERATOR_CMD` the full shell-safe base command string (for example `node /abs/path/to/index.js`). |
| Command execution contract | Deterministic | The prompt must tell the agent to execute Clawperator commands exactly as shell commands using the provided base command. Do not reinterpret or rewrite the command structure. |
| Run ID format | Deterministic | `<eval_id>-<YYYYMMDD-HHMMSS>-<agent_type>-<model_short>[-<label_slug>]` |

## Decision Rules

| Question | Rule |
| --- | --- |
| What if doctor pre-flight fails? | Abort with `outcome.status = "error"`, `failure_reason = "doctor_preflight_failed"`. Do not spawn the agent. |
| What if no device is connected? | Abort with `outcome.status = "error"`, `failure_reason = "no_device"`. Do not spawn the agent. |
| What if the selected agent binary is missing? | Abort with `outcome.status = "error"`, `failure_reason = "agent_binary_not_found"`. Do not spawn the agent. |
| What if the agent emits the answer marker multiple times? | Use the last occurrence. |
| What if the transcript is truncated at 10MB? | Still scan the full stream for the answer marker before truncating. Store the truncation marker `[TRANSCRIPT_TRUNCATED]` at the end. Do not stop the run. |
| What `ANDROID_SERIAL` in agent env? | Always set it to the resolved device serial. This eliminates `--device` failure modes. |
| What timestamp records ground truth? | Record `ground_truth_collected_at` when `adb shell getprop ro.build.version.release` is read. If a post-run re-read is performed, store it separately for logging only and never use it for scoring. |
| Public-surface working directory | Always `tempfile.mkdtemp()` once per run. Never the repo root. The temp dir path must not be under or adjacent to the repo root, and must not contain any repo files or symlinks. **Note: this is soft isolation** - the agent is not sandboxed. It could read the parent filesystem if it tried. The harness controls what it puts *in* the agent's environment and working directory, not what the agent can access beyond that. |
| Agent environment | Start from a minimal whitelist (`PATH`, `HOME`, `LANG`, `LC_ALL`) and inject only the eval variables needed for the run. Do not inherit the full parent environment blindly. |
| CLAWPERATOR_BIN representation | Internal representation is `clawperator_cmd: list[str]` (always an argv list). `CLAWPERATOR_BIN` env var is accepted as input from the user but resolved into `clawperator_cmd` during preflight. There is no `CLAWPERATOR_SCRIPT` env var - do not invent one. Never store a compound command string like 'node /path/script.js' as a single string anywhere in the harness. The agent receives only the full shell-safe command string derived from that argv list (via `shlex.join()`), never a partially composed executable name. Subprocess calls always use `env.clawperator_cmd + [subcommand, ...]` as the argv list. |
| Context file in temp dir | Check whether Claude Code requires a context file to function in a directory with no CLAUDE.md. If required, create a minimal one: contains only `https://docs.clawperator.com` and nothing else. |
| Prompt traceability | If outbound HTTP access can be observed, capture accessed domains for triage. At minimum, grep the transcript for visible docs-linked domains and record them in diagnostics. |

## Pre-Run Device State

The harness normalizes device UI state to the Home screen before spawning the
agent. The following defines what is and is not the harness's responsibility:

**Harness does before spawning the agent (added step in runner.py):**
1. Send `adb -s <serial> shell input keyevent KEYCODE_WAKEUP` - wake the screen.
2. Send `adb -s <serial> shell input keyevent KEYCODE_HOME` - navigate to the Home screen.
   Sleep 0.5s after to allow Home to settle.

**Harness verifies (via doctor pre-flight):**
- Device is connected and authorized
- Operator APK is installed and responsive

**Harness does NOT handle:**
- Screen unlock (device must have no PIN/pattern lock, or be already unlocked)
- Permission dialogs that appear post-spawn (agent must handle these)

**Required pre-run state (operator responsibility):**
- Device unlocked (no PIN/pattern) OR manually unlocked before running
- No full-screen dialogs that can't be dismissed with HOME

**Agent responsibility:**
- Navigate to Android Settings from the Home screen
- Handle any per-app permission prompts encountered during navigation

Rationale: HOME normalization eliminates "random foreground app" as a noise
source for near zero cost (two adb keyevents). Screen unlock is excluded
because automating unlock requires knowing the PIN/pattern, which is
device-specific and outside harness scope.

## Failure Modes To Prevent

- Running the agent before doctor passes - wastes the entire turn budget on
  environment setup errors.
- Setting `ANDROID_SERIAL` in the agent's env but not passing `--device`
  in the prompt - both are needed to be safe. Set the env var AND include
  `--device` in the prompt instructions.
- Using truthy/falsy checks on optional strings (e.g. `if env_var:` when empty
  string vs. unset mean different things). Use explicit `is None` checks.
- Starting the harness with a stale `dist/` when using `local-dev` runtime.
  Check that `dist/cli/index.js` exists and is newer than `src/`. Print a
  warning if not.
- Building subprocess command lines as strings. Use argv lists directly and
  only stringify for logging with `shlex.join(cmd)`.
- Inheriting the full parent environment blindly. Start from a minimal
  whitelist, then inject only the variables required for the run.
- Sending SIGTERM only to the agent parent PID may leave child processes running
  (e.g. an agent that spawned a subprocess to call the Clawperator binary). Use
  `start_new_session=True` in Popen to create a fresh process group boundary on
  POSIX, then terminate the entire group with `os.killpg(os.getpgid(proc.pid), signal)`.
- Letting timeout cleanup drop buffered transcript lines. Flush transcript
  buffers and close file handles before escalating from SIGTERM to SIGKILL.
- Treating `used_disallowed_tool` as a fail signal. It is diagnostic-only in
  Phase 1 and must not override the outcome status.
- Failing to capture agent-binary availability up front. Resolve the adapter's
  executable during preflight and abort with `agent_binary_not_found` if it is
  unavailable.
- Omitting agent API keys from the subprocess environment. The harness uses a
  minimal env whitelist that does NOT include API keys. Each agent adapter's
  `build_env()` method MUST forward the required API key(s) from `os.environ`
  (e.g. `ANTHROPIC_API_KEY` for Claude, `OPENAI_API_KEY` for Codex,
  `GOOGLE_API_KEY`/`GEMINI_API_KEY` for Gemini). Without this, the agent
  subprocess silently fails to authenticate. Exception: Kimi uses OAuth stored
  credentials in `~/.kimi/` and does NOT need env-var API keys - it only needs
  HOME in the whitelist (already present).
- Using short model names for Kimi (e.g. `kimi-k2`). Kimi requires
  provider-prefixed model names like `kimi-code/kimi-for-coding`. Short names
  produce `LLM not set` and the agent fails to start.

## Open Questions (resolve during Phase 1 implementation)

1. **Claude context file requirement**: Verify empirically whether Claude Code
   requires or benefits from a CLAUDE.md in its working directory for
   non-interactive `-p` mode. If it reads one automatically, create a minimal
   stub. Document the result.

2. **`used_disallowed_tool` heuristic**: Clawperator's verbose output may
   contain `adb shell` strings in log lines. Use a conservative pattern that
   only matches agent-authored shell lines, for example
   `^(?:\\$|>)\\s+adb\\s+shell\\b` after ANSI stripping. Record the result in
   `metrics.violations.used_adb`. Keep it diagnostic-only and accept false
   negatives in Phase 1.

3. **Transcript size**: If a run produces a very large transcript (e.g. many
   snapshots with full XML), consider streaming to file and only reading the
   last N bytes for the answer scan. Cap at 10MB. Document behavior.

## Output Contract

For every completed run, `evals/runs/<run_id>/` contains:
- `result.json` - schema from `tasks/evals/plan.md`, no null required fields
- `config.json` - full run configuration including invocation.command
- `transcript.txt` - full agent stdout+stderr, up to 10MB
- `harness.log` - structured harness event log (JSON lines, one event per line)

## Acceptance Criteria

All four must be true for Phase 1 to be complete:

1. At least 1 `result.json` with `outcome.status = "pass"` and
   `outcome.answer_correct = true`.
2. At least 1 `result.json` with `outcome.status = "error"` and a non-null
   `failure_reason`.
3. Dry-run exits 0 with the prompt printed.
4. The passing transcript contains at least one line with `[Clawperator-Result]`.

**Post-merge milestone:** After the PR merges, gather 3 independent passing
runs to establish the baseline. This is not a merge gate - it is the first
entry in the eval log.

## Idempotency

Running the same eval twice with the same agent and device should produce two
independent `result.json` files with different `run_id` values and different
timestamps. The harness must not overwrite a previous run directory.

## Durable Follow-Up

| Item | Destination after task cleanup |
| --- | --- |
| `used_disallowed_tool` final heuristic | Code comment in `harness/scorer.py` AND `docs/internal/design/evals.md` |
| Open Question resolutions (Claude context file, transcript cap) | `docs/internal/design/evals.md` decisions section |

Note: `evals/README.md` is a required Phase 1 deliverable.
`docs/internal/design/evals.md` is best-effort - write if time allows in 1c;
if not, write as an immediate follow-up commit after 1d passes. It must not
block the PR from landing. Content requirements for both are in sub-phase 1c
of `tasks/evals/phase-1/work-breakdown.md`.
