# Eval Phase 3 Work Breakdown

Parent plan: `tasks/evals/phase-3/plan.md`

## Executive Summary

1 PR, 2 sub-phases. Phase 2 PR must be merged before starting.

| Sub-phase | Purpose | Agent tier |
| --- | --- | --- |
| 3a | Published runtime target + version pinning | default |
| 3b | Full-repo knowledge mode + prompt + validation | default |

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total sub-phases | 2 (3a-3b) |
| Completed | none |
| Remaining | 3a, 3b |
| Current / Next | 3a |
| Blockers | Phase 2 PR must be merged |

## Hard Rules

1. Do not start Phase 3 until Phase 2 PR is merged.
2. Published runtime runs must use `com.clawperator.operator` (not `.dev`).
3. Full-repo mode working directory must be the actual repo root, not
   a temp dir.
4. Both modes still require a doctor pre-flight to pass before spawning.
5. Log the resolved binary path at the start of every run.
6. One commit per sub-phase.
7. Update `tasks/evals/phase-3/plan.md` Status section after each sub-phase.

## Required Reading

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/evals/plan.md` | Axis definitions, runtime target semantics |
| 2 | `tasks/evals/phase-3/plan.md` | Scope and decision rules |
| 3 | `evals/harness/environment.py` | Current resolution logic to extend |
| 4 | `evals/run_eval.py` | Current CLI stubs to remove |
| 5 | `evals/specs/android-version/prompt-public.md` | Template for the full-repo prompt |

## PR / Phase Plan

| PR | Purpose | Included sub-phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-3 | Runtime targets + full-repo mode | 3a, 3b | default | 1 passing run per new mode+runtime combo |

---

## Sub-phase 3a: Published Runtime Target

### Agent Tier

default

### Goal

Add `--runtime published` support. Resolve the global `clawperator` binary.
Add version pinning to `result.json`.

### Files or Surfaces To Change

- `evals/harness/environment.py`
- `evals/run_eval.py`

### Steps

1. In `environment.py`, update `preflight()` to accept a `runtime` parameter:
   ```python
   def preflight(device: str | None, runtime: str = "local-dev") -> Environment:
   ```
2. For `runtime == "published"`:
   - Use `shutil.which("clawperator")` as the binary.
   - If None, raise `EnvironmentError("published_binary_not_found")`.
   - Use `com.clawperator.operator` as the default operator package
     (not overridden by `CLAWPERATOR_OPERATOR_PACKAGE` for this path - log a
     note if the env var is set and differs).
3. Capture `clawperator_npm_version`:
   - For `local-dev`: read from `apps/node/package.json` `"version"` field.
   - For `published`: parse `clawperator version` output (JSON by default;
     the key is `"cliVersion"` - see `apps/node/src/cli/commands/version.ts:19`).
4. Add `clawperator_npm_version` to the `Environment` dataclass and to
   `result.json` under `environment`.
5. Remove the `--runtime published` "not implemented" error from `run_eval.py`.
6. Update `evals/README.md` to document when to use each runtime target.

### Acceptance Criteria

- `python evals/run_eval.py android-version --agent claude --model <m> --runtime published --dry-run`
  shows the global `clawperator` binary path and `com.clawperator.operator`.
- A full passing run with `--runtime published` produces `result.json` with
  `environment.clawperator_npm_version` populated.

### Validation

```bash
python evals/run_eval.py android-version \
  --agent claude --model claude-opus-4-5 \
  --runtime published --dry-run
# Verify binary path shown is the global install, not apps/node/

python evals/run_eval.py android-version \
  --agent claude --model claude-opus-4-5 \
  --runtime published --device <serial>
python -m json.tool evals/runs/<run_id>/result.json | grep "clawperator_npm_version"
```

### Expected Commit

```
feat(evals): add published runtime target and version pinning
```

---

## Sub-phase 3b: Full-Repo Knowledge Mode

### Agent Tier

default

### Goal

Implement `--mode full-repo`. Add `prompt-full-repo.md`. Remove the Phase 3
stub error from the CLI.

### Files or Surfaces To Change

- `evals/harness/runner.py`
- `evals/run_eval.py`
- `evals/specs/android-version/prompt-full-repo.md` (new)

### Steps

1. In `runner.py`, update `run_eval()` to accept `repo_root: Path`.
   For `full-repo` mode, set `work_dir = str(repo_root)` instead of
   `tempfile.mkdtemp()`. Do not delete the working directory after the run.
2. Add `$REPO_ROOT` as a template variable in the prompt substitution step.
   Set it to the resolved repo root path.
3. Remove the `--mode full-repo` "not implemented" error from `run_eval.py`.
4. Determine the repo root:
   ```python
   import subprocess
   result = subprocess.run(
       ["git", "rev-parse", "--show-toplevel"],
       capture_output=True, text=True, check=True
   )
   repo_root = Path(result.stdout.strip())
   ```
5. Write `evals/specs/android-version/prompt-full-repo.md`. Base it on
   `prompt-public.md` with these additions:
   - Add `- Repository root: $REPO_ROOT` to the Environment section.
   - Add a note that the agent may read internal docs in `$REPO_ROOT/docs/`
     and source code to understand the API.
   - Keep all other constraints (still use Clawperator commands only for
     device interaction; still emit `CLAWPERATOR_EVAL_ANSWER`).
6. Run a validation eval in `full-repo` mode:
   ```bash
   python evals/run_eval.py android-version \
     --agent claude --model claude-opus-4-5 \
     --mode full-repo --device <serial>
   ```
7. Verify the run `config.json` shows `work_dir` as the repo root, not a
   temp dir.

### Acceptance Criteria

- `prompt-full-repo.md` exists and contains `$REPO_ROOT`.
- A full passing run with `--mode full-repo` has `work_dir` set to the
  repo root in `config.json`.
- `--dry-run` with `--mode full-repo` shows the repo root path.

### Validation

```bash
python evals/run_eval.py android-version \
  --agent claude --model claude-opus-4-5 \
  --mode full-repo --dry-run

python evals/run_eval.py android-version \
  --agent claude --model claude-opus-4-5 \
  --mode full-repo --device <serial>
python -m json.tool evals/runs/<run_id>/config.json | grep "work_dir"
```

### Expected Commit

```
feat(evals): add full-repo knowledge mode and prompt
```
