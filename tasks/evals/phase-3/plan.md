# Eval Phase 3: Runtime Targets and Full-Repo Mode

## Executive Summary

Add the two remaining run axes: the `published` runtime target (global npm
binary + release Operator APK) and the `full-repo` knowledge mode (agent
runs from repo root with full source access). Add version pinning in results.

1 PR, 2 sub-phases.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 2 (3a-3b) |
| Completed | none |
| Remaining | 3a, 3b |
| Current / Next | 3a |
| Blockers | Phase 2 PR must be merged before starting |

## Goal

All four combinations of (knowledge mode) x (runtime target) are runnable:

| Knowledge mode | Runtime target | Notes |
| --- | --- | --- |
| `public-surface` | `local-dev` | Available since Phase 1 |
| `public-surface` | `published` | New in Phase 3 |
| `full-repo` | `local-dev` | New in Phase 3 |
| `full-repo` | `published` | New in Phase 3 |

## Why This Phase

The two axes exist so the eval can answer distinct questions:

- `published` runtime: does the published release work as well as the
  branch-local build?
- `full-repo` mode: how much does internal repo knowledge boost agent
  performance vs. public docs alone?

Neither question can be asked until this phase ships.

## In Scope

- `--runtime published` support: resolve binary as the global `clawperator`
  command, use `com.clawperator.operator` as the default package
- `--mode full-repo` support: agent working directory is the repo root;
  no isolation; prompt file is `prompt-full-repo.md`
- `evals/specs/android-version/prompt-full-repo.md` (new prompt file)
- Version pinning: record the exact `clawperator` npm version in
  `result.json` for both `local-dev` (from package.json) and `published`
  (from `clawperator version`)
- `evals/README.md` updated with new mode/runtime guidance

## Out of Scope

- Automated CI runs against published runtime (manual only in Phase 3)
- Cross-version regression testing
- Skill generation scoring (Phase 4)

## Existing Artifact Scope

| Artifact | Disposition |
| --- | --- |
| `evals/harness/environment.py` | Add `published` runtime resolution path |
| `evals/run_eval.py` | Remove "not implemented" errors for `--mode full-repo` and `--runtime published` |
| `evals/specs/android-version/` | Add `prompt-full-repo.md` |
| `result.json` | Add `environment.clawperator_npm_version` field |

## Surfaces and Ownership

| Surface | Path | Change |
| --- | --- | --- |
| Environment resolution | `evals/harness/environment.py` | Published runtime path |
| CLI | `evals/run_eval.py` | Remove Phase 3 stubs |
| Eval spec | `evals/specs/android-version/prompt-full-repo.md` | New prompt |
| README | `evals/README.md` | Update mode/runtime section |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Published runtime binary | `which clawperator` on this machine |
| Published Operator package ID | `com.clawperator.operator` (release APK) |
| Version output format | `clawperator version --json` output shape |
| Local npm version | `apps/node/package.json` `"version"` field |

## Pre-Implementation Verification

Before implementing Phase 3, verify the following on the target machine:

1. `clawperator doctor --json` - verify it returns JSON and exits 0 on a
   healthy device. Record the exact JSON shape.
2. `clawperator version --json` - verify it returns JSON with a version field.
   Record the exact key name (likely `"version"` but verify).
3. `clawperator --help` - verify the global binary is present and the version
   matches expectations.
4. Which Operator APK is installed: `adb shell pm list packages | grep clawperator`
   - confirm `com.clawperator.operator` (release) is installed alongside or
   instead of the `.dev` variant.

Do not assume these commands exist or produce JSON. They were introduced at
specific versions. Verify before writing environment.py's `published` resolution
path.

## Deterministic Versus Judgment

| Aspect | Type | Rule |
| --- | --- | --- |
| Binary resolution for `published` | Deterministic | Use `shutil.which("clawperator")`. If None, abort with error. |
| Operator package for `published` | Deterministic | Always `com.clawperator.operator` (no `.dev` suffix). |
| Full-repo working directory | Deterministic | Always the repo root (`git rev-parse --show-toplevel`). |
| Prompt for `full-repo` | Deterministic | Use `prompt-full-repo.md`. Raise if the file does not exist. |

## Decision Rules

| Question | Rule |
| --- | --- |
| If `clawperator` is not on PATH for `published` mode? | Abort with `outcome.status = "error"`, `failure_reason = "published_binary_not_found"`. |
| If `clawperator version --json` does not exist in the installed binary? | Fall back to parsing `clawperator version` plain text. Document the fallback in `environment.py` and in `docs/internal/design/evals.md`. |
| Should the `full-repo` prompt mention the repo path? | Yes, the prompt may tell the agent the repo is available at `$REPO_ROOT`. Add this as a template variable. |
| Does `full-repo` mode disable the doctor pre-flight? | No. Doctor still runs before spawning the agent. |
| Does `full-repo` mode set `ANDROID_SERIAL` in the agent env? | Yes, same as `public-surface`. |

## Failure Modes To Prevent

- Using the global `clawperator` binary for `local-dev` runs or vice versa.
  The environment.py must log clearly which binary is being used at the start
  of every run.
- Running a `full-repo` eval and accidentally leaking credentials or private
  files because the working directory is the repo root. The agent inherits the
  same environment; no secrets should be in the repo itself.
- A `published` runtime run using the `.dev` Operator APK. The package
  must match: `local-dev` -> `.dev`, `published` -> release.

## Acceptance Criteria

Phase 3 is complete when:

1. `python evals/run_eval.py android-version --agent claude --model <m> --runtime published`
   produces at least 1 passing run using the global `clawperator` binary.
2. `python evals/run_eval.py android-version --agent claude --model <m> --mode full-repo`
   produces at least 1 passing run with the repo root as working directory.
3. All new passing runs have `environment.clawperator_npm_version` populated
   in `result.json`.
4. `--dry-run` correctly shows the binary path for both runtime targets.

## Durable Follow-Up

| Item | Destination |
| --- | --- |
| Published runtime vs local-dev comparison notes | `evals/README.md` |
| Full-repo vs public-surface performance observations | `docs/internal/design/` after meaningful data exists |
