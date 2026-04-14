# Skill Author By Recording

## Executive Summary

Package the proven recording-to-skill workflow into a repo-local agent skill at
`.agents/skills/skill-author-by-recording/`.

This skill is the single developer-facing entrypoint for skill authorship from
a recording. It should remain one front door even if the implementation later
delegates to narrower helper workflows internally.

The workflow must stay aligned with the durable skill contracts already landed
in docs and code:

- replay remains a first-class maintained skill shape
- orchestrated remains a first-class maintained skill shape
- first-time users should not have to learn the taxonomy up front
- the workflow should prefer the simplest truthful authored output for the
  captured flow

This task exists because the recording program now has the underlying runtime
pieces in place, but the product-facing authoring workflow still needs tighter
framing. The remaining work is mainly workflow shaping, sequencing, and
demo-grade closeout rather than new deep runtime invention.

## Status

| Item | Value |
| --- | --- |
| State | active, plan tightened after implementation drift |
| Total PRs | 3 |
| Total phases | 3 |
| Completed | problem framing and first repo-local workflow draft |
| Remaining | replay-first workflow closeout, orchestrated path closeout, demo validation |
| Current / Next | P1 replay-first workflow closeout |
| Blockers | none |

## Current Baseline

The workflow already exists on the current branch as the single repo-local
entrypoint:

- `.agents/skills/skill-author-by-recording/`

Important choices already made on this branch:

- keep one human-facing entrypoint
- add no helper skills because the workflow fits in one durable skill for now
- reuse durable docs and code contracts instead of reviving deleted task packs
- make replay-vs-orchestrated selection explicit before authoring begins
- require a sanitized retained baseline under
  `skills/<skill_id>/references/compare-baseline.export.json`
- keep the orchestrated boundary honest: `SKILL.md` is the program and
  `scripts/run.js` remains a thin harness

What now needs tightening is the product framing and implementation order. The
original wording predates several rounds of replay, compare, contract, and
orchestrated-runtime implementation, so this plan now treats this work as one
linked initiative delivered across multiple ordered PRs.

## Goal

Create a repo-local agent workflow that can guide a human and an authoring-time
agent through the full path from recorded UI flow to a truthful authored skill,
without pretending the recording alone is sufficient and without forcing the
human to choose among multiple top-level authoring skills.

The default authoring strategy should be:

- author replay first when the captured flow is replay-safe
- author orchestrated when replay would not be truthful or sufficient
- avoid requiring both variants in the first pass unless the task explicitly
  calls for both

## Why This Is A Separate Task

The recording program now has a clear architectural shape:

- recordings are evidence
- replay skills preserve a deterministic execution path
- orchestrated skills are agent-driven runtime programs through `SKILL.md` plus
  a thin harness
- compare and `SkillResult` give us an inspectable maintenance and verification
  story

What is still missing is the guided developer experience that turns those
pieces into one understandable workflow. The remaining planning question is no
longer "can the runtime support replay and orchestrated?" It can. The question
now is "what is the narrowest front-door workflow that supports the demo and
generalizes without unnecessary scope expansion?"

## In Scope

- a repo-local skill at `.agents/skills/skill-author-by-recording/`
- explicit phase boundaries for the internal authoring workflow
- instructions that guide the operator through:
  - starting recording
  - performing the recorded UI flow when prompted
  - stopping recording
  - pulling and exporting artifacts
  - handing the recording evidence to an authoring-time agent
  - authoring the right skill shape from that evidence
  - running one self-test invocation of the authored skill
  - surfacing the key files and generated code for inspection
- explicit visual and file-level outputs that a human can inspect during the
  flow
- a generic developer-facing path that accepts a new app-specific skill id and
  plain-language goal instead of assuming the Solax proving case

## Replay vs Orchestrated: Product Stance

This workflow should not make first-time users learn the replay/orchestrated
taxonomy before they can create a skill. The authoring-time agent should use
the recording evidence and user intent to recommend or apply the right shape.

The default product stance is replay-first authoring when replay is sufficient,
because replay is simpler to author, easier to explain, and more deterministic.
That does not make orchestrated secondary. It means the workflow should prefer
the simplest truthful output first.

### Use a replay skill when

- the flow is short and deterministic
- there is little or no branching on current UI state
- the app is assumed to start in the right state each run
- coordinate-based or exact-node-match clicking is acceptable because the
  layout is controlled
- the flow can be satisfied truthfully by deterministic script logic

### Use an orchestrated skill when

- the next step depends on current UI state
- recovery from mid-flow or stale app state matters
- success requires proving a persisted terminal state
- the inputs change the flow in ways a fixed script cannot safely anticipate
- the intent is clearer as an agent program than as a fixed script

### Both can coexist

The Solax discharge-limit proving case has both a replay sibling and an
orchestrated sibling. That is a valid pattern, but it should not automatically
become the required output shape for every first-pass authoring workflow.

If the recording evidence suggests the flow is simple enough for replay, replay
should be the default recommended output for that pass unless the user
explicitly asked for orchestrated.

If the workflow decides replay is not sufficient, it should explain why and
move to orchestrated honestly instead of forcing a fake replay-first detour.

## Out Of Scope

- runtime support changes that belong in the earlier recording implementation
  phases
- pretending recordings automatically become skills
- inventing new contracts or result shapes in this task
- mandatory dual-authoring of both replay and orchestrated variants for every
  recorded flow
- bundled runtime-family work such as one registry skill with internal replay
  and orchestrated subfolders
- adding a second developer-facing top-level skill such as
  `skill-author-orchestrator`

## Source Of Truth

This work executes after the earlier recording implementation phases have
landed. Durable knowledge should now be read from docs and code, not from
retired task packs.

| Area | Stable source |
| --- | --- |
| Recording lifecycle | `docs/api/recording.md` |
| Skill scaffolding and authoring | `docs/skills/authoring.md` |
| Replay/orchestrated proving pattern | `docs/skills/authoring.md` |
| Runtime-agent shape for orchestrated skills | `docs/skills/overview.md`, `docs/skills/authoring.md` |
| Orchestrated skill design lessons and failure modes | `docs/internal/design/skill-design.md`, `docs/skills/authoring.md` |
| Structured skill results | `docs/skills/authoring.md`, `apps/node/src/contracts/`, `apps/node/src/domain/skills/` |
| Contract declaration | `docs/skills/authoring.md` |
| Compare workflow | `docs/api/recording.md` |
| Reliability report | `docs/internal/design/reliability/` |

## Output Contract

This task should produce a workflow that, when invoked by an agent, does all of
the following in a way a developer can follow:

- explains when the human should touch the phone
- asks for or derives the target skill id, app/package context, and
  plain-language goal in a way that works for a developer's own workflow
- shows the exact recording/export commands it is running under the hood
- shows which recording artifacts were captured and where they live
- retains one canonical sanitized recording-export baseline adjacent to the
  authored skill at a predictable reference path such as
  `references/compare-baseline.export.json`
- shows the authored skill artifacts for the chosen shape
- when the chosen shape is orchestrated, highlights the specific instructions,
  checkpoint identities, verification logic, and declared contract that make
  the orchestrated skill a runtime agent program instead of a macro
- invokes the new skill once and surfaces the resulting `SkillResult`
- makes it explicit when replay or orchestrated is the better fit and why
- leaves behind enough inspectable commands, files, and code surfaces that the
  workflow can be demonstrated in a developer-facing video without relying on
  unstated operator knowledge

The retained reference export is for authoring evidence, compare baselines, and
future maintenance. It is not a runtime artifact and must not be listed under
`skill.json.artifacts`.

## Relationship To The Recording Promo Video

`tasks/recording/video-draft.md` remains the north star, but it should be read
carefully. The video may demonstrate the orchestrated Solax path because it is
the strongest wow demo, while the generic workflow still defaults to
replay-first authoring when replay is sufficient.

The video should prove that:

- the recording-to-skill workflow is real
- the generated artifacts are inspectable
- the result can be run again with trustworthy output

The video must not silently redefine the generic workflow as orchestrated-only.

## Delivery Shape

This should remain one linked initiative with one parent task pack, but it
should be delivered across multiple ordered PRs rather than as one monolithic
final change.

Current recommended PR order:

1. replay-first workflow closeout
2. orchestrated-path closeout
3. demo validation and final graduation

Each PR should leave the repo in a coherent reviewable state and update this
task pack as the source of sequencing truth until the final recording-program
PR ships.
