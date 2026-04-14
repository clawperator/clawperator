---
title: Skill Author By Recording Problem Definition
status: draft
owner: recording-program
last_updated: 2026-04-15
---

# Problem Definition

## Why This Exists

The recording program has now landed most of the underlying runtime work needed
to support user-authored skills from a recording:

- retained recording export as authoring evidence
- compare support
- `SkillResult`
- declarative skill contracts
- replay skills as deterministic wrappers
- orchestrated skills as agent-driven runtime programs

What remains is not primarily new runtime invention. The remaining gap is a
clear, honest, developer-facing workflow that turns "I can perform this once on
my phone" into "I now have an inspectable skill artifact I can run again."

That workflow is represented by the repo-local skill:

- `.agents/skills/skill-author-by-recording/`

This file exists to pin down the actual product problem now that the supporting
implementation has moved forward and some of the original task-pack framing has
started to drift.

## Refined North Star

The north star is not "author an orchestrated Solax skill."

The north star is:

- a developer can record a real phone workflow once
- the system can turn that evidence into a truthful skill artifact
- the workflow is simple enough to demo clearly in
  `tasks/recording/video-draft.md`
- the workflow does not force first-time users to learn replay versus
  orchestrated as upfront product concepts

The Solax demo remains the proving case because it is visually compelling and
shows the full recording-to-skill story. But the product goal is broader than
that one case.

## Core Product Problem

We need one front-door authoring experience that is simple for a first-time
developer and honest about what the system is doing.

Today the internal architecture recognizes two skill shapes:

- replay
- orchestrated

Those are real implementation differences with different runtime behavior and
different authoring difficulty. But they should not be the first thing a user
has to learn.

The workflow should instead feel like:

1. record the workflow
2. keep the evidence
3. author the right skill shape from that evidence
4. run it once and inspect the result

The system may internally choose replay first, recommend orchestrated, or allow
an explicit override. But the initial user experience should stay centered on
"create a skill from this recording," not on teaching runtime taxonomy.

## Product Principles

### 1. Recording Is Evidence

The recording export is authoring evidence, compare input, and maintenance
evidence. It is not the runtime program.

### 2. Replay Is First-Class

Replay is not a lesser artifact, not just a CI aid, and not merely a stepping
stone to orchestrated. For stable deterministic UI flows, replay may be the
best production shape.

### 3. Orchestrated Is Also First-Class

Orchestrated is the right shape when runtime decisions depend on current UI
state, recovery matters, or terminal proof requires an agentic runtime
program.

### 4. Users Should Not Carry The Taxonomy Up Front

The first-time workflow should not depend on the user already understanding
replay versus orchestrated. The workflow should gather intent, inspect the
recording evidence, and recommend or apply the right shape with minimal user
burden.

### 5. Scope Must Stay Tight

We should not expand this phase into a larger skill-family architecture,
runtime bundling, or automatic multi-variant dispatch unless that work is
strictly required to support the front-door workflow and the demo.

## Current Strategic Read

The current implementation and docs support an important product conclusion:

- replay-first authoring should be the default implementation path

Why:

- replay skills are simpler to author
- replay skills are easier to explain
- replay skills are more deterministic
- replay gives a straightforward path from recording evidence to a working
  reusable artifact

But replay-first is a default, not a universal rule.

Some flows will be obviously orchestrated-shaped from the start. For those
flows, the workflow should say so honestly and author orchestrated directly
instead of forcing a fake replay-first detour.

## What The Workflow Must Decide

For any given recording-driven authoring pass, the workflow needs to answer:

1. Is replay sufficient to satisfy the user intent truthfully?
2. If replay is sufficient, should replay be the authored output for this pass?
3. If replay is not sufficient, should the workflow author orchestrated now?
4. Should a sibling variant be deferred as optional follow-on work rather than
   required output of the first pass?

The current recommended default is:

- if the flow looks replay-safe, author replay first
- if the flow is not replay-safe, author orchestrated
- do not require both variants in the first implementation pass

## Non-Goals

This phase does not need to solve all future skill-family problems.

Out of scope unless a later plan explicitly pulls them in:

- a single runtime skill that bundles replay and orchestrated variants under
  one registry entry
- automatic replay-to-orchestrated fallback inside the runtime contract
- mandatory dual-authoring of both variants for every recorded workflow
- teaching first-time users the full replay/orchestrated taxonomy before they
  can create their first skill

## Implications For The Video

The promo video remains a valid north star, but it should be interpreted
carefully.

The video should prove that:

- the recording-to-skill workflow is real
- the generated artifacts are inspectable
- the result can be run again with trustworthy output

The video may continue to showcase the orchestrated Solax path because it is
the strongest wow demo. But the task pack should not accidentally redefine the
whole product problem as "author orchestrated skills only."

For generic users, the front-door workflow should still support the simpler
replay-first path when the captured flow is deterministic.

## Current Implementation State

The `.agents/skills/skill-author-by-recording/` directory does not yet exist.

The product problem is defined. The constraints are settled. The next step is
to create the skill from scratch in P1.

## Decision To Carry Into Planning

The planning baseline after this problem-definition pass should be:

- keep one front-door skill: `skill-author-by-recording`
- refine the north star to "record once, author the right skill shape, inspect
  and run it"
- default the implementation strategy toward replay-first authoring
- preserve orchestrated as a first-class path for flows that need it
- avoid unnecessary expansion into bundled runtime families or automatic
  fallback behavior in this phase
