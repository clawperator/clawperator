# Skill Author By Recording

## Executive Summary

Package the proven recording-to-orchestrated workflow into a repo-local agent
skill at `.agents/skills/skill-author-by-recording/`.

This skill is the **single developer-facing entrypoint** for skill authorship
from a recording. If implementation complexity requires decomposition, it may
delegate to narrower helper skills internally. We should not add a separate
top-level `skill-author-orchestrator` skill because that would be redundant and
too easy to confuse with `...-orchestrated`.

This task exists because the current recording plans already define the replay
baseline, the agent-driven orchestrated runtime, and the compare/contract
story. Until this workflow is explicitly owned, the developer-facing "how"
remains too implicit and too dependent on an expert holding the process in
their head.

This workflow is intentionally downstream of the current recording program. It
should only be implemented once the replay baseline, `SkillResult`, the
agent-driven orchestrated runtime, declarative skill contracts, compare, and
durable docs are all in place.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | P1, P2, P3 |
| Current / Next | P1 after W2b, W3, W4, and W5 |
| Blockers | `skill-checkpoints/`, `skill-result-contract/`, `agent-driven-skills/`, `skill-contract-declaration/`, `compare/`, and `graduate-demo-findings/` must land first |

## Goal

Create a repo-local agent workflow that can guide a human and an authoring-time
agent through the full path from recorded UI flow to an **agent-driven
orchestrated skill**, without pretending the recording alone is sufficient, and
without forcing the human to choose among multiple top-level authoring skills.

## Why This Is A Separate Task

The recording program now has a clear architectural shape:

- recordings are evidence
- replay skills preserve the direct path as a separate deterministic baseline
- orchestrated skills are agent-driven at runtime through `SKILL.md` plus a
  thin harness, and they add declared contracts, terminal verification, and
  structured outputs

What is still missing is the guided developer experience that turns those
pieces into one understandable workflow. That workflow should be explicit and
inspectable, not tribal knowledge.

The release skill family is the closest local precedent: one orchestrator skill
coordinates several narrower release skills. W6 should copy that decomposition
pattern if needed, but keep a single front door for the user.

## In Scope

- a repo-local skill at `.agents/skills/skill-author-by-recording/`
- explicit phase boundaries for the internal authoring workflow
- optional helper-skill decomposition behind the single top-level entrypoint
- instructions that guide the operator through:
  - starting recording
  - performing the recorded UI flow when prompted
  - stopping recording
  - pulling and exporting artifacts
  - handing the recording evidence to an authoring-time agent
  - authoring the orchestrated skill from that evidence
  - running one self-test invocation of the newly authored skill
  - surfacing the key files and generated code for inspection
- explicit visual/file-level outputs that a human can inspect during the flow

## Replay vs Orchestrated: When To Use Each

This workflow is centered on the orchestrated authoring path because that is
the primary proving case for the recording program and the promo video. That
does not make orchestrated the right answer for every flow. The authoring-time
agent must apply the following guidance when deciding what to produce, and must
surface the choice to the developer before authoring begins.

### Use a replay skill when

- The UI flow is short and stable for the known target layout. A small number
  of interactions can be a signal here, but it is not a hard threshold or
  product rule.
- Every step follows a predictable deterministic path with no branching based
  on current UI state.
- No recovery from app-state surprises is expected - the app is assumed to be
  in the right starting state before every run.
- Coordinate-based or exact-node-match clicking is acceptable because the
  layout is controlled.
- The skill is intended as a baseline reference for compare or as a first
  sanity check, not as a primary production automation.

A replay skill can be authored directly from the recording export without
running an agent CLI at runtime. It still emits `SkillResult` per the W2
contract, but its `run.js` is the full execution logic rather than a thin
harness delegating to an agent.

### Use an orchestrated skill when

- The flow involves multiple steps where the right action depends on what the
  current UI state actually shows.
- Recovery from unexpected app state (wrong screen, stale UI, prior run left
  the app mid-flow) is important for reliability.
- The skill's goal requires verifying that an action had the intended
  persisted effect before reporting success.
- The inputs change the flow in ways a fixed script cannot safely anticipate.
- The flow is complex enough that describing it as a plain-English agent
  program (SKILL.md) is clearer than encoding it as imperative script logic.

An orchestrated skill spawns an embedded runtime agent that reads SKILL.md
and reasons turn by turn. It does not bypass Clawperator - the agent calls
Clawperator primitives for every device action. What changes is that an agent
is doing the reasoning, not a fixed script.

### Both can coexist

The Solax discharge-limit proving case has both a replay sibling
(`-replay`) and an orchestrated sibling (`-orchestrated`). The replay
baseline exists as a deterministic reference. The orchestrated skill exists
as the production-grade, agent-driven, contract-verified automation.

Some larger orchestrated skills may internally follow deterministic sequences
for parts of their flow. That is fine. What makes a skill orchestrated is that
an agent decides the sequence and holds itself to a declared contract, not that
every step is non-deterministic.

If the recording evidence suggests the flow is simple enough for replay, tell
the developer before authoring and let them choose. Do not default to
orchestrated just because it sounds more sophisticated. Simple replay skills
are valid, maintained artifacts.

## Out Of Scope

- runtime support changes that belong in the main recording workstreams
- pretending recordings automatically become orchestrated skills
- inventing new contracts or result shapes in this task
- proving the replay baseline again unless the authoring-time agent wants to
  read it as optional reference material
- adding a second developer-facing top-level skill such as
  `skill-author-orchestrator`

## Source Of Truth

| Area | Source |
| --- | --- |
| Recording lifecycle | `docs/api/recording.md` |
| Skill scaffolding and authoring | `docs/skills/authoring.md` |
| Replay/orchestrated proving pattern | `tasks/recording/plan.md` |
| Runtime-agent shape for orchestrated skills | `tasks/recording/agent-driven-skills/` |
| Structured skill results | `tasks/recording/skill-result-contract/` |
| Contract declaration | `tasks/recording/skill-contract-declaration/` |
| Compare expectations | `tasks/recording/compare/` |

## Output Contract

This task should produce a workflow that, when invoked by an agent, does all of
the following in a way a developer can follow:

- explains when the human should touch the phone
- shows the exact recording/export commands it is running under the hood, even
  if the workflow abstracts them
- shows which recording artifacts were captured and where they live
- shows the authored orchestrated skill and its three load-bearing artifacts:
  `SKILL.md`, `skill.json`, and `scripts/run.js`
- highlights the specific instructions, checkpoint identities, verification
  logic, and declared contract that make the orchestrated skill a runtime
  agent program instead of a macro
- invokes the new skill once and surfaces the resulting `SkillResult`
- leaves behind enough inspectable commands, files, and code surfaces that the
  workflow can be demonstrated in a developer-facing video without relying on
  unstated operator knowledge

The preferred implementation shape is:

- top-level entrypoint:
  - `.agents/skills/skill-author-by-recording/`
- helper skills behind that entrypoint, if decomposition is needed:
  - `.agents/skills/recording-capture-export/`
  - `.agents/skills/skill-author-orchestrated-from-recording/`
  - `.agents/skills/skill-validate-authored-skill/`

These helper names are descriptive and non-overlapping. Avoid names such as
`skill-author-orchestrator` because they are too easy to confuse with
`skill-author-orchestrated` or with the product concept of an orchestrated
skill.

Replay-specific helper authorship is intentionally **not** required in the
first user-facing workflow. The replay baseline remains an important proving
artifact in W1/W2, but the front-door authorship experience in W6 is centered
on producing the orchestrated skill that the video demonstrates.

## Durable Follow-Up

Once implemented, this task should inform:

- `.agents/skills/skill-author-by-recording/`
- `docs/skills/authoring.md`
- any developer-facing demos or videos of the recording workflow

## Relationship To The Recording Promo Video

`tasks/recording/video-draft.md` is the script that will be read aloud once
this task pack, and the W1-W5 work it depends on, have all landed. It is
written in present tense and assumes the workflow exists, the Solax
`-orchestrated` skill exists as an agent-driven runtime skill, `SkillResult`
is parsed by `runSkill`, declared contracts with `indeterminate` status are
shipped, and `clawperator recording compare` is shipped.

That framing is intentional. Treat the video as a forcing function: the
scope of this task is the gap between what the script describes and what
currently exists. If the script describes something this pack cannot
reasonably deliver, the fix is to escalate the scope of the task pack or
re-negotiate the script with the recording-program owner. Do not silently
weaken the script to hide a scope gap.
