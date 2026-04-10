# Skill Author By Recording

## Executive Summary

Package the proven recording-to-replay-to-orchestrated workflow into a
repo-local agent skill at `.agents/skills/skill-author-by-recording/`.

This task exists because the current recording plans already define the replay
and orchestrated end-state, but until this workflow is explicitly owned, the
developer-facing "how" remains too implicit and too dependent on an expert
holding the process in their head.

This workflow is intentionally downstream of the current recording program. It
should only be implemented once the replay baseline, `SkillResult`, declarative
skill contracts, compare, and durable docs are all in place.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | P1, P2, P3 |
| Current / Next | P1 after W5 |
| Blockers | `skill-checkpoints/`, `skill-result-contract/`, `skill-contract-declaration/`, `compare/`, and `graduate-demo-findings/` must land first |

## Goal

Create a repo-local agent workflow that can guide a human and an agent through
the full path from recorded UI flow to a replay skill and then to an
orchestrated skill, without pretending the recording alone is sufficient.

## Why This Is A Separate Task

The recording program now has a clear architectural shape:

- recordings are evidence
- replay skills preserve the direct path
- orchestrated skills add checkpoints, verification, and structured outputs

What is still missing is the guided developer experience that turns those
pieces into one understandable workflow. That workflow should be explicit and
inspectable, not tribal knowledge.

## In Scope

- a repo-local skill at `.agents/skills/skill-author-by-recording/`
- instructions that guide the operator through:
  - starting recording
  - performing the recorded UI flow when prompted
  - stopping recording
  - pulling and exporting artifacts
  - scaffolding the replay skill
  - authoring the orchestrated sibling from the recording evidence
  - surfacing the key files and generated code for inspection
- explicit visual/file-level outputs that a human can inspect during the flow

## Out Of Scope

- runtime support changes that belong in the main recording workstreams
- pretending recordings automatically become orchestrated skills
- inventing new contracts or result shapes in this task

## Source Of Truth

| Area | Source |
| --- | --- |
| Recording lifecycle | `docs/api/recording.md` |
| Skill scaffolding and authoring | `docs/skills/authoring.md` |
| Replay/orchestrated proving pattern | `tasks/recording/plan.md` |
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
- shows the replay skill that was scaffolded from the recording context
- shows the orchestrated skill that was authored from that evidence
- highlights the specific checkpoints, verification logic, and declared
  contract that make the orchestrated skill different from raw replay
- leaves behind enough inspectable commands, files, and code surfaces that the
  workflow can be demonstrated in a developer-facing video without relying on
  unstated operator knowledge

## Durable Follow-Up

Once implemented, this task should inform:

- `.agents/skills/skill-author-by-recording/`
- `docs/skills/authoring.md`
- any developer-facing demos or videos of the recording workflow

## Relationship To The Recording Promo Video

`tasks/recording/video-draft.md` is the script that will be read aloud once
this task pack, and the W1-W5 work it depends on, have all landed. It is
written in present tense and assumes the workflow exists, the `-replay` and
`-orchestrated` Solax skills exist, `SkillResult` is parsed by `runSkill`,
declared contracts with `indeterminate` status are shipped, and
`clawperator recording compare` is shipped.

That framing is intentional. Treat the video as a forcing function: the
scope of this task is the gap between what the script describes and what
currently exists. If the script describes something this pack cannot
reasonably deliver, the fix is to escalate the scope of the task pack or
re-negotiate the script with the recording-program owner. Do not silently
weaken the script to hide a scope gap.
