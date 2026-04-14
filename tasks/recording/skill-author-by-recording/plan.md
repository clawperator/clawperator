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
| Completed | problem framing, plan tightening, and P1 |
| Remaining | P2 (orchestrated path), P3 (demo validation) |
| Current / Next | P2 orchestrated-path closeout |
| Blockers | none |

## Current Baseline

The `.agents/skills/skill-author-by-recording/` directory now exists from P1.
P2 should extend that front-door skill rather than replace it.

The product decisions and constraints are settled in this task pack and in
`problem-definition.md`. The implementing agent should read those files and
the required reading list before writing anything.

Decisions already made that the implementation must honor:

- keep one human-facing entrypoint
- add no helper skills because the workflow fits in one durable skill for now
- reuse durable docs and code contracts instead of reviving deleted task packs
- make replay-vs-orchestrated selection explicit before authoring begins
- require a sanitized retained baseline under
  `skills/<skill_id>/references/compare-baseline.export.json`
- keep the orchestrated boundary honest: `SKILL.md` is the program and
  `scripts/run.js` remains a thin harness

The next implementation task is to extend the created skill so the
orchestrated branch is just as truthful and inspectable as the replay-first
path established in P1.

## Testing Strategy

This task should be tested primarily as a workflow product, not as a library.

Current expectation:

- use lightweight automated checks for file presence, wording drift, and
  anti-pattern phrasing
- use human-guided acceptance walkthroughs to prove the workflow is truthful,
  understandable, and inspectable end to end
- require first-run debug evidence to be retained, especially for orchestrated
  self-tests
- add unit tests only if a later phase introduces executable decision logic,
  validation helpers, or scripts whose behavior is no longer captured well by
  human walkthroughs alone

Phase-specific testing:

- P1: one human-guided replay-safe walkthrough that confirms the recording
  lifecycle, evidence retention, explicit replay recommendation, single-shape
  authoring, one self-test run, and surfaced `SkillResult`
- P2: one human-guided orchestrated-shaped walkthrough that confirms the
  workflow honestly chooses orchestrated when replay would not be truthful or
  sufficient, and retains the self-test debug bundle needed for post-mortem
  inspection
- P3: demo-path validation against the Solax proving case so the full story is
  understandable from recording through authored skill and self-test result

If later work moves the replay-versus-orchestrated recommendation into code,
the first unit-test target should be the first-match-wins decision table in
this plan.

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

## Why Now

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

## Existing Artifact Scope

This task edits an existing task pack and an existing repo-local workflow
concept.

In scope to change:

- `tasks/recording/skill-author-by-recording/plan.md`
- `tasks/recording/skill-author-by-recording/work-breakdown.md`
- `tasks/recording/skill-author-by-recording/problem-definition.md`
- `.agents/skills/skill-author-by-recording/` when aligning the implementation
  skill to the refined plan

Preserve as-is unless a later phase explicitly changes them:

- the underlying replay runtime contract
- the underlying orchestrated runtime contract
- `tasks/recording/video-draft.md` as the current demo north star

Out of scope for this planning task:

- redesigning the already-landed runtime contracts
- broad changes to recording, compare, or skills CLI behavior

## Surfaces and Ownership

| Surface | Ownership | Role in this task |
| --- | --- | --- |
| `tasks/recording/skill-author-by-recording/` | planning | Stable task-pack contract and execution spec |
| `.agents/skills/skill-author-by-recording/` | repo-local skill | Front-door developer workflow implementation |
| `docs/skills/authoring.md` | authored docs | Durable public authoring guidance |
| `docs/skills/overview.md` | authored docs | Durable orchestrated runtime contract |
| `docs/api/recording.md` | authored docs | Durable recording/export/compare contract |
| `tasks/recording/video-draft.md` | demo reference | Demo north star and forcing function |

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

## Deterministic Versus Judgment

Deterministic:

- one front-door workflow remains the product shape
- replay and orchestrated are both first-class
- replay-first is the default recommendation when replay is sufficient
- mandatory dual-authoring is out of scope
- bundled runtime-family work is out of scope
- the promo video remains the north star but does not redefine the generic
  workflow as orchestrated-only

Judgment:

- whether a captured flow is replay-safe or requires orchestrated authoring
- whether the user intent is ambiguous enough to require one clarifying
  question
- whether a later follow-on should author the sibling variant

## Decision Rules

Use this first-match-wins lookup table when deciding the authored shape for a
single recording-driven pass:

| Condition | Action |
| --- | --- |
| User explicitly requests `-replay` | Author replay and do not up-sell orchestrated in the same pass |
| User explicitly requests `-orchestrated` | Author orchestrated and do not force a replay-first detour |
| No explicit shape and flow is replay-safe | Recommend and author replay |
| No explicit shape and replay would not be truthful or sufficient | Explain why and author orchestrated |
| User wants both variants explicitly | Treat sibling authoring as intentional scope, not a default |

Use this PR structure table:

| PR | Purpose | Included phases |
| --- | --- | --- |
| PR-1 | Replay-first workflow creation | P1 |
| PR-2 | Orchestrated-path closeout | P2 |
| PR-3 | Demo validation and graduation | P3 |

## Failure Modes To Prevent

- turning the generic workflow into orchestrated-only product framing because
  the demo path is orchestrated
- forcing first-time users to learn replay versus orchestrated before they can
  create a skill
- accidentally requiring both variants in the first implementation pass
- letting the repo-local workflow drift away from the durable docs and runtime
  contracts
- leaving the PR order implicit and allowing later-phase work to start before
  earlier framing is settled
- treating the recording export as the runtime program instead of authoring
  evidence

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

## Idempotency

Stable across reruns:

- the one-front-door workflow shape
- the replay-first default recommendation
- the phase order and PR boundaries unless explicitly re-planned
- the canonical retained baseline location

May vary across reruns:

- whether a particular captured flow is judged replay-safe or orchestrated-only
- the exact authored skill id chosen by the user for a new workflow
- the detailed implementation text inside the repo-local skill as the workflow
  is refined

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

## Durable Follow-Up

Once implementation closes out, durable knowledge should live in:

- `.agents/skills/skill-author-by-recording/` for the repo-local workflow
- `docs/skills/authoring.md` for durable public authoring guidance
- `docs/skills/overview.md` only if the orchestrated runtime contract itself
  changes
- `docs/api/recording.md` only if recording/export/compare behavior changes
