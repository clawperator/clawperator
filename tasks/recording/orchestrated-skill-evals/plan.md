# Orchestrated Skill Evals

## Executive Summary

Move repeated orchestrated-skill proving out of ad hoc terminal loops and into a
first-class eval workflow under `/evals`.

The immediate driver is the Solax orchestrated proving case. We proved that the
skill can act agentically, recover from mid-flow state, and complete live runs,
but we also learned that a chained shell loop is too easy to get subtly wrong.
A loop that normalizes once before a batch does not prove "from scratch every
time", and a loop that lives only in terminal history is not a durable
validation surface.

This task creates the eval shape needed to verify orchestrated skills honestly:

- normalize the device before every run
- run one independent skill invocation per trial
- capture machine-readable artifacts per trial
- summarize pass/fail cleanly
- make the proving method inspectable and repeatable

The first eval target is the Solax discharge-limit orchestrated skill, but the
design should support future orchestrated skills without re-inventing the
harness each time.

## Status

| Item | Value |
| --- | --- |
| State | completed |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | P1, P2, P3 |
| Remaining | none |
| Current / Next | done |
| Blockers | none |

## Goal

Create a durable `/evals` workflow that can verify an orchestrated skill across
multiple independent from-scratch runs on a real device, with explicit
preconditions, preserved artifacts, and a truthful success threshold.

## Why This Is Needed

Recent live validation surfaced a real process gap:

- one normalized from-scratch run is not the same as a batch of independent
  from-scratch runs
- a shell loop that continues from the prior app state can still prove useful
  agentic continuation behavior, but it is not the right proof for cold-start
  reliability
- terminal-only loops are too opaque and too easy to mis-specify

We want a repeatable answer to questions like:

- did the skill start from outside the target app every time?
- did each run choose a new target value different from the currently observed
  one?
- did the skill emit a terminal `SkillResult` and verify the persisted value?
- what exactly failed on runs that did not pass?

Those are eval questions, not branch-local shell-loop questions.

## In Scope

- a Solax-focused eval entrypoint under `/evals`
- per-run device normalization before every trial
- explicit real-device targeting
- per-run target-value selection that differs from the currently observed value
- per-run artifact capture:
  - invocation metadata
  - raw JSON result
  - selected target value
  - observed terminal value
  - pass/fail classification
- aggregate summary output for a multi-run proving set
- documentation for how to run the eval and interpret results

## Out Of Scope

- changing the orchestrated skill contract again
- changing the replay sibling
- making the eval generic enough for every future mobile app on day one
- moving branch-closeout evidence into `/evals` retroactively
- CI-gating live device evals

## Primary Requirements

The eval must:

- normalize before every run, not once before a batch
- target a specific device serial explicitly
- target `com.clawperator.operator.dev` explicitly for local proving
- treat each run as independent
- record enough information to debug a failure without re-running blindly
- distinguish:
  - launcher or outside-app cold-start proof
  - in-app continuation proof
- default to the cold-start proof mode for the Solax reliability case

## Proposed Eval Shape

The first version should support a command pattern equivalent to:

```bash
cd <repo_root>/evals
uv run python -m evals.run_eval solax_orchestrated_cold_start \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --runs 4
```

Exact naming can change, but the eval must encode the policy rather than rely
on a human remembering it.

## Required Normalization Policy

Before each run:

1. close `com.solaxcloud.starter`
2. return to launcher or another explicit outside-app surface
3. verify the target app is not foregrounded
4. read the currently observed discharge value if available
5. choose a new target value that is different from the observed one

After each run:

1. persist the raw JSON result
2. extract the emitted `SkillResult`
3. classify success only if the terminal verification matches the requested
   value
4. preserve enough device/log context to debug failure causes

## Output Contract

The eval should leave behind:

- one run directory per trial
- one aggregate summary file for the full batch
- enough structured data to answer:
  - which values were attempted
  - which runs passed
  - which runs failed
  - where each raw result lives
  - whether the run started from normalized outside-app state

Preferred artifact examples:

- `evals/artifacts/<timestamp>/run-01/result.json`
- `evals/artifacts/<timestamp>/run-01/metadata.json`
- `evals/artifacts/<timestamp>/summary.json`
- `evals/artifacts/<timestamp>/summary.md`

## Source Of Truth

Verify implementation and docs against:

- `evals/README.md`
- `evals/run_eval.py`
- `evals/harness/`
- `docs/skills/authoring.md`
- `docs/internal/design/skill-design.md`
- `docs/skills/overview.md`
- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/domain/skills/runSkill.ts`

## Success Criteria

This task is done when:

- we can run a multi-trial orchestrated eval from `/evals`
- each trial is independently normalized
- the Solax proving case can be validated without ad hoc shell loops
- the eval outputs are clear enough that a future agent can inspect failures
  without reconstructing terminal history
