# Eval System Design

## Why evals exist

Evals are a measurement instrument for docs quality and API discoverability.
The harness answers one question: can an unfamiliar agent use Clawperator's
public surfaces to complete a task on a real device?

## Measurement-not-teaching principle

The eval is a ruler, not a textbook. Eval prompts, spec files, and
`CLAWPERATOR_EVAL_ANSWER` must never appear in public docs. If agents see the
marker in public documentation, future runs measure familiarity with the eval
format rather than real task completion.

## `CLAWPERATOR_EVAL_ANSWER` marker

`CLAWPERATOR_EVAL_ANSWER` is an internal eval artifact, not a production API.
It is emitted only because the eval prompt instructs the agent to do so. It is
not published on `docs.clawperator.com` or `clawperator.com`, and it should not
appear in production transcripts.

## Two-axis model

Every run is parameterized by two independent axes.

| Axis | Values | What it isolates | Phase |
| --- | --- | --- | --- |
| Knowledge surface | `public-surface`, `full-repo` | Whether the agent succeeds with only public docs versus the full repo | `public-surface`: Phase 1; `full-repo`: Phase 3 |
| Runtime target | `local-dev`, `published` | Whether the run exercises the branch-local build or the published binary and APK | `local-dev`: Phase 1; `published`: Phase 3 |

In Phase 1 only the `public-surface` + `local-dev` combination is testable.

## Runtime target semantics

`local-dev` uses the branch-local Node CLI build from
`apps/node/dist/cli/index.js` when it exists. It pairs with the debug Operator
APK `com.clawperator.operator.dev`.

`published` uses the globally installed `clawperator` binary resolved with
`shutil.which("clawperator")`. It does not fall back to the branch-local
build. If the global binary is missing, the harness aborts with
`published_binary_not_found`.

`published` uses the release Operator APK `com.clawperator.operator` as the
effective package. If `CLAWPERATOR_OPERATOR_PACKAGE` is set to a different
value, the harness logs a warning and still uses the release package. That
keeps published runs comparable and prevents silent `.dev` versus release
mixing.

The harness records `environment.clawperator_npm_version` in `result.json` for
every passing run:

- `local-dev` reads the version from `apps/node/package.json`
- `published` reads the `cliVersion` field from `clawperator version`

`clawperator version` is expected to return JSON, but the harness also accepts
a plain-text fallback and extracts the first version-like token when JSON is
not available.

Verification pattern:

```bash
uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent claude --model claude-sonnet-4-6 --runtime published --dry-run
```

The dry-run output should show the global `clawperator` binary path and
`com.clawperator.operator`.

## Public-surface isolation

Public-surface runs use `tempfile.mkdtemp()` so the agent gets a clean working
directory. The repo path must not appear in the agent's cwd, prompt, or
inherited env vars. This is soft isolation only. The harness does not sandbox
the agent and does not claim to prevent the agent from exploring the parent
filesystem.

## Full-repo knowledge mode

`full-repo` uses the repository root as the agent working directory. The
prompt includes `$REPO_ROOT`, and the template tells the agent it may read
internal docs under `$REPO_ROOT/docs/` and source under
`$REPO_ROOT/apps/node/src/`.

`full-repo` is intentionally non-isolated. The harness does not copy files to a
temp directory and does not redact the repo path from `config.json` or
`result.json`.

Doctor preflight still runs before the agent is spawned. `ANDROID_SERIAL` is
still present in the agent environment.

Verification pattern:

```bash
uv run --project evals --extra dev python evals/run_eval.py android-version \
  --agent claude --model claude-sonnet-4-6 --mode full-repo --dry-run
```

The dry-run output should show the repository root as the working directory
and the rendered prompt should contain `Repository root: <repo_root>`.

## Doctor pre-flight

The harness aborts before spawning the agent if `clawperator doctor --json`
fails. That keeps device setup problems out of the agent's turn budget and
prevents misleading eval failures caused by the environment rather than the
agent.

## `used_disallowed_tool` detection

Phase 1 uses a conservative transcript heuristic for agent-authored `adb shell`
usage. It strips ANSI codes and looks for shell-prompt-style lines that start
with `>` or `$` followed by `adb shell`. The flag is diagnostic-only. False
negatives are acceptable in Phase 1.

## Open Question resolutions

- Claude context file requirement: pending validation during Phase 1 device
  runs.
- Transcript cap behavior: transcripts are capped at 10 MiB and the harness
  appends `[TRANSCRIPT_TRUNCATED]` when the cap is reached.

## Compatibility matrix

When Phase 1 reaches at least 10 runs across at least 2 agents, publish a
public compatibility matrix in `docs/evals-compat.md` with pass rates by eval,
agent/model, knowledge mode, and runtime target. Do not expose prompts, markers,
or harness internals in that page.
