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

## Public-surface isolation

Public-surface runs use `tempfile.mkdtemp()` so the agent gets a clean working
directory. The repo path must not appear in the agent's cwd, prompt, or
inherited env vars. This is soft isolation only. The harness does not sandbox
the agent and does not claim to prevent the agent from exploring the parent
filesystem.

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
