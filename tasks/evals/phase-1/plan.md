# Eval Phase 1: Minimum Viable Harness

## Executive Summary

Ship the first working end-to-end eval run. One eval spec (`android-version`),
one agent adapter (Claude), wall-clock timeout only. The harness produces a
scored `result.json` with a full agent transcript for every run.

1 PR, 4 sub-phases. All sub-phases ship in the same PR.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 4 (1a-1d) |
| Completed | none |
| Remaining | 1a, 1b, 1c, 1d |
| Current / Next | 1a |
| Blockers | `docs/gaps/` PR must merge before Phase 1d results count as meaningful |

## Goal

`python evals/run_eval.py android-version --agent claude --model <model>`
runs end-to-end on a connected Android device, produces a valid `result.json`
with a correct `outcome.status`, and the transcript shows real Clawperator
commands being executed.

## Why This Phase

Phase 1 is the foundation everything else builds on. Keeping it to one agent
and one eval is intentional: it is faster to discover harness problems on a
thin surface before adding the complexity of multiple agents and specs.

## In Scope

- `evals/` directory structure as defined in `tasks/evals/plan.md`
- `evals/.gitignore` (ignores `runs/` and `__pycache__/`)
- `evals/harness/` Python package: environment, runner, scorer, artifacts,
  base agent, Claude adapter
- `evals/specs/android-version/`: spec.json + prompt-public.md
- `evals/run_eval.py` CLI with flags: positional eval ID, `--agent`,
  `--model`, `--device`, `--mode`, `--runtime`, `--timeout-s`, `--max-turns`
  (accepted but not enforced), `--runs-dir`, `--dry-run`
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
| Clawperator binary resolution | `CLAWPERATOR_BIN` env var, fallback `node apps/node/dist/cli/index.js` |
| Operator package resolution | `CLAWPERATOR_OPERATOR_PACKAGE`, fallback `com.clawperator.operator.dev` |
| Doctor pre-flight contract | `apps/node/src/cli/commands/doctor.ts` |
| Result envelope marker | `[Clawperator-Result]` in terminal output |
| Ground truth collection | `adb [-s <serial>] shell getprop ro.build.version.release` |
| Overarching design | `tasks/evals/plan.md` |

## Deterministic Versus Judgment

| Aspect | Type | Rule |
| --- | --- | --- |
| Answer marker | Deterministic | `CLAWPERATOR_EVAL_ANSWER:` prefix, last occurrence wins |
| Scorer normalization | Deterministic | Strip leading `android ` (case-insensitive), strip whitespace, lowercase |
| `used_disallowed_tool` detection | Judgment | Detect agent-initiated `adb shell` in transcript. Avoid false positives from Clawperator's own verbose log output. Finalize heuristic during implementation (see Open Questions). |
| Prompt template substitution | Deterministic | `$CLAWPERATOR_BIN`, `$DEVICE_SERIAL`, `$CLAWPERATOR_OPERATOR_PACKAGE` replaced before spawning |
| Run ID format | Deterministic | `<eval_id>-<YYYYMMDD-HHMMSS>-<agent_type>-<model_short>` |

## Decision Rules

| Question | Rule |
| --- | --- |
| What if doctor pre-flight fails? | Abort with `outcome.status = "error"`, `failure_reason = "doctor_preflight_failed"`. Do not spawn the agent. |
| What if no device is connected? | Abort with `outcome.status = "error"`, `failure_reason = "no_device"`. Do not spawn the agent. |
| What if the agent emits the answer marker multiple times? | Use the last occurrence. |
| What if the transcript is truncated at 10MB? | Still scan the full stream for the answer marker before truncating. Store the truncation marker `[TRANSCRIPT TRUNCATED AT 10MB]` at the end. |
| What `ANDROID_SERIAL` in agent env? | Always set it to the resolved device serial. This eliminates `--device` failure modes. |
| Public-surface working directory | Always `tempfile.mkdtemp()`. Never the repo root. Never a path that reveals the repo location. **Note: this is soft isolation** - the agent is not sandboxed. It could read the parent filesystem if it tried. The harness controls what it puts *in* the agent's environment and working directory, not what the agent can access beyond that. |
| CLAWPERATOR_BIN representation | `CLAWPERATOR_BIN` env var contains the executable name only (e.g. 'node' or 'clawperator'). Script path is separate. Do not store 'node /path/to/script.js' as a single string. |
| Context file in temp dir | Check whether Claude Code requires a context file to function in a directory with no CLAUDE.md. If required, create a minimal one: contains only `https://docs.clawperator.com` and nothing else. |

## Pre-Run Device State

The harness does not normalize device UI state before spawning the agent.
The following assumptions define what is and is not the harness's responsibility:

**Harness verifies (via doctor pre-flight):**
- Device is connected and authorized
- Operator APK is installed and responsive

**Harness does NOT control:**
- Which app is in the foreground
- Whether the screen is on or off
- Whether the device is unlocked

**Required pre-run state (operator responsibility before starting the eval):**
- Screen on
- Device unlocked
- No overlay dialogs blocking the screen (e.g. update prompts, permission dialogs)

**Agent responsibility:**
- Open Android Settings itself (the prompt provides the package name)
- Handle arbitrary foreground state at start

Rationale: requiring the harness to normalize to Home screen adds fragility for
marginal gain. The agent is expected to navigate from any foreground state. If
eval noise from starting state proves significant, add a Home screen
normalization step in a future phase.

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
- Storing the full inherited environment in `config.json`. Store only the
  env_overrides relevant to the run.
- Sending SIGTERM only to the agent parent PID may leave child processes running
  (e.g. an agent that spawned a subprocess to call the Clawperator binary). Use
  `os.killpg` with `os.getpgid(proc.pid)` to terminate the entire process group.
  Set `start_new_session=True` in Popen to ensure a clean process group boundary.

## Open Questions (resolve during Phase 1 implementation)

1. **Claude context file requirement**: Verify empirically whether Claude Code
   requires or benefits from a CLAUDE.md in its working directory for
   non-interactive `-p` mode. If it reads one automatically, create a minimal
   stub. Document the result.

2. **`used_disallowed_tool` heuristic**: Clawperator's verbose output may
   contain `adb shell` strings in log lines. The detection pattern must
   distinguish agent-run `adb` from Clawperator internal output. Candidate
   pattern: look for lines matching `^\$ adb shell` or `^> adb shell` in the
   transcript. Finalize during implementation and document the chosen heuristic.

3. **Transcript size**: If a run produces a very large transcript (e.g. many
   snapshots with full XML), consider streaming to file and only reading the
   last N bytes for the answer scan. Cap at 10MB. Document behavior.

## Output Contract

For every completed run, `evals/runs/<run_id>/` contains:
- `result.json` - schema from `tasks/evals/plan.md`, no null required fields
- `config.json` - full run configuration including invocation.command
- `transcript.txt` - full agent stdout+stderr, up to 10MB

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
