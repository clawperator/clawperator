# Recording Program Refactor Plan

## Instructions For The Next Agent

You are picking up **planning work** on the Clawperator recording program.
Your job is to continue authoring and hardening the plans that live in
`tasks/recording/*` until they describe a feature set that can be
demonstrated end to end in the promo video at
`tasks/recording/video-draft.md`.

The bar the whole program has to clear: a viewer watching the final
video sees a developer **create an orchestrated skill from a recording**
and then **run it reliably against a live device**, and comes away
understanding both halves without tribal knowledge. If a scene in the
script describes something the task packs cannot deliver, you escalate
the task pack, not the script.

### What to do first

Read these files **in this order** before you change anything. They are
the current source of truth for where the program stands.

1. `tasks/recording/refactor-plan.md` — this file. Has the current
   architectural correction, the decisions already made, the open
   questions, and the hardening backlog.
2. `tasks/recording/plan.md` — top-level workstream orchestration. Lists
   W0 through W6 (soon W2b) and the current sequence.
3. `tasks/recording/video-draft.md` — the forcing function. Every
   feature you plan for must ladder up to a scene in this script.
4. `tasks/recording/brain-hand-contract/problem-definition.md` — the
   architectural framing. Already supports agent-driven skills
   conceptually; do a sanity pass for stale "scripted orchestrated"
   language.
5. `tasks/recording/skill-checkpoints/plan.md` and `work-breakdown.md`
   (W1). Solax replay baseline truthfulness. Status: ready.
6. `tasks/recording/skill-result-contract/plan.md` and
   `work-breakdown.md` (W2). `SkillResult` contract and `runSkill`
   parsing. Note that W2 P3 in the current file is the Solax
   orchestrated retrofit; this refactor **moves** that phase out of W2
   and into a new W2b pack.
7. `tasks/recording/skill-contract-declaration/plan.md` and
   `work-breakdown.md` (W3). Optional `contract` block in `skill.json`
   and `indeterminate` semantics.
8. `tasks/recording/compare/plan.md` and `work-breakdown.md` (W4).
   Recording-export-versus-`SkillResult` divergence workflow. Needs
   rethinking for non-deterministic agent-driven runs — see gaps below.
9. `tasks/recording/graduate-demo-findings/plan.md` and
   `work-breakdown.md` (W5). Migration of temporary demo notes into
   permanent docs.
10. `tasks/recording/skill-author-by-recording/plan.md` and
    `work-breakdown.md` (W6). Guided authoring workflow. This refactor
    changes what W6 has to produce.
11. `tasks/recording/demo/findings.md` — leftover notes from the
    original Solax v0 demo run. Some of these are stale now; others
    are durable. W5 handles graduation.

Then do a second pass against the repository code that the plans
depend on, because the plans are only honest if they match current code:

- `CLAUDE.md` at the repo root. Important correction: the
  "Clawperator is an actuator" rule applies to the **runtime**
  (`apps/node`), not to skills. Skills are the layer where agent
  reasoning lives. This misread is what caused the current refactor;
  do not repeat it.
- `apps/node/src/contracts/result.ts` — `ResultEnvelope` (exec-level).
- `apps/node/src/contracts/skills.ts` — current skills contract and
  error codes.
- `apps/node/src/domain/skills/runSkill.ts` — current `runSkill`
  implementation. W2b will extend this to handle agent-driven skills.
- `apps/node/src/cli/commands/skills.ts` — the CLI surface.
- `docs/skills/authoring.md` — current public authoring contract.
- `docs/skills/overview.md` — current public skills category story.
  Note: this currently describes `-orchestrated` as "expected to expose
  structured checkpoints, terminal verification, and clearer result
  semantics as that contract work lands". That wording should stay
  until the contract work actually ships; updating it is a W2 deliverable.
- `.agents/skills/docs-build/` and `.agents/skills/docs-author/` —
  internal examples of the markdown-as-program pattern that already
  exist in this checkout. There is not yet a
  `.agents/skills/skill-author-by-recording/` skill; W6 creates that
  later.
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/`
  — the existing replay skill. Read it to understand the current Solax
  automation, and to inform the SKILL.md-as-program that W2b will
  write.

### What you are allowed to change

- Plans in `tasks/recording/*`. Harden acceptance criteria, sequence
  phases, close open questions, add new packs when a gap demands one.
- This file. When you close a gap, mark it and add any new gaps you
  discover. This is a living planning artifact until W2b lands.
- The video draft at `tasks/recording/video-draft.md`, but only once
  the underlying plans that justify a scene are in place. Do not
  write scenes describing features that no task pack owns.

### What you are not allowed to change yet

- Anything under `apps/node/`, `apps/android/`, `docs/`, `sites/`,
  `.agents/skills/`, or `../clawperator-skills/`. This refactor is
  still in the planning phase. Implementation happens only after the
  program owner gives an explicit green light on the hardened plans.
- The "Hard Decisions Already Made" section below. Those are
  committed. If you need to relitigate one, talk to the owner first.

### How to know you are done planning

The planning phase is complete when **all** of the following are true:

- Every scene in `video-draft.md` is traceable to a phase in a task
  pack under `tasks/recording/*` that can deliver it.
- Every open question in the "Open Questions" section of this file
  has either been answered in a task pack, or has been explicitly
  scheduled as a W2b deliverable.
- Every item in the "Additional Gaps And Hardening Items" section of
  this file has been closed or explicitly moved into a task pack's
  scope.
- The top-level `tasks/recording/plan.md` lists W2b as an active
  workstream with its own plan and work-breakdown files.
- The owner has confirmed alignment on the updated plans.

Only then is the program ready for implementation.

---

## Purpose

Capture a load-bearing architectural correction to the recording program
before it is executed, so the follow-up work can be picked up in a fresh
thread without losing context.

The correction: orchestrated skills must be **agent-driven at runtime**,
not scripted sequences with checkpoint labels. This affects the task
packs, the video, and the definition of the feature set the program is
building toward.

## Goal

When the whole recording program ships, a developer can run the
`skill-author-by-recording` workflow in this repo and:

1. Author a new orchestrated skill for a real mobile app from a recorded
   UI flow, without hand-writing the runtime behavior.
2. Run that skill against a live device and see it hit its declared goal
   reliably, via an embedded agent reasoning turn by turn, not a brittle
   scripted replay.
3. Inspect every artifact that was produced: recording export, declared
   contract, SKILL.md program, thin harness, `SkillResult` from each
   run, and compare output when a run diverges from the baseline.
4. Watch the promo video in `video-draft.md` and see the above happen
   on screen, honestly, without any "this part is aspirational" caveats.

The Solax "set discharge limit" skill is the first proving case for the
whole program. If the Solax orchestrated skill cannot be authored,
invoked, and reliably run, the program is not done.

## Status

| Item | Value |
| --- | --- |
| State | planning — hardening in progress |
| Blockers | none |
| Next | harden W2b scope, update W2/W3/W4/W6/top-level plans, rewrite video Scenes 2/3/7/8/10/12 |
| Owner sign-off needed before | any file edits outside `tasks/recording/*` and before video scene rewrites |

## The Disconnect We Discovered

The current recording program describes an "orchestrated" Solax skill
whose `scripts/run.js` is a straight sequential script with checkpoint
labels around each step. A technically literate viewer reading that
code cannot tell it apart from a macro replayer, because it is
architecturally a macro replayer with checkpoint bookkeeping. There is
no agent reasoning inside it at runtime.

The recording promo video pitches Clawperator as a "brain and hand"
system. The brain is the agent, the hand is Clawperator. The video's
current Scene 8 code block does not contain a brain. This makes the
pitch a lie.

Earlier in the working session this was defended by citing `CLAUDE.md`:

> Clawperator is an actuator: It does not own strategy, planning, or
> autonomous reasoning.
> Clawperator is not an autonomous planner. Agent reasoning stays
> outside this runtime.

That rule constrains **Clawperator the runtime** (`apps/node`, the CLI,
the Operator APK, the exec runtime). It does not constrain **Clawperator
skills**. Skills are exactly the layer where agent control is supposed
to live. The repo already demonstrates this pattern internally in
`.agents/skills/` (`docs-build`, `docs-author`,
`skill-author-by-recording`), which are all markdown-as-program skills
executed by a Claude/Codex agent. There is no architectural reason a
user-facing orchestrated runtime skill cannot follow the same pattern,
and there is every reason it should.

This refactor plan corrects that, and then pulls every downstream
consequence through the task packs and the video.

## What Changes At The Architectural Level

Orchestrated skills are **agent-driven by definition** from W2b onward.
Concretely:

- An orchestrated skill's `SKILL.md` is written as a program for an
  agent to read: declared inputs, allowed primitives, required
  checkpoint identities, recovery branches, emission rules.
- An orchestrated skill's `scripts/run.js` is a **thin harness** that:
  reads `SKILL.md`, resolves the configured agent CLI, spawns the
  agent with `SKILL.md` as the program and the skill inputs as
  arguments, forwards the agent's stdout, and exits with the agent's
  exit code.
- The agent process is the brain. It reads, snapshots via
  `clawperator snapshot`, reasons, taps via `clawperator exec`, handles
  recovery, and at the end writes a single `[Clawperator-Skill-Result]`
  frame to stdout.
- The `SkillResult` contract from W2 does not change. It is
  emitter-agnostic. What changes is who emits it for orchestrated
  skills: the embedded agent, not hand-written script logic.

Replay skills remain scripted and deterministic. They still emit
`SkillResult` per the W2 retrofit. They are not a competing pedagogical
frame in the video; see "Video rewrite" below.

There are now **two distinct agent invocations** in the Solax story,
and any plan must keep them straight:

- **Authoring-time agent**: spawned by the
  `skill-author-by-recording` workflow to read the recording export
  and write the SKILL.md-as-program, skill.json, and thin run.js for
  the new orchestrated skill. Runs once per skill created.
- **Runtime agent**: spawned by the thin run.js harness every time the
  skill is invoked. Reads SKILL.md, drives the device, emits one
  `SkillResult` per run. Runs once per invocation.

These are the same codex binary but different prompts, different
inputs, and different outputs. The plans must not confuse them.

## Principles Any Implementation Must Preserve

These are the non-obvious invariants that fell out of the working
session. If a future plan or implementation violates one of these, it
is wrong, even if the acceptance criteria look green.

1. **Reliable outcome, not reliable path.** An agent-driven orchestrated
   skill is not deterministic by path. Two runs of the same skill with
   the same inputs may hit different intermediate checkpoints because
   the agent recovered from a surprise or took a different branch.
   The contract the brain relies on is the **terminal verification**,
   not the exact checkpoint sequence. This reframes what "reliability"
   means in the program. The video, the task packs, and the compare
   workflow all have to reflect this.
2. **The hand stays deterministic.** Even though the brain inside the
   skill is non-deterministic, every call it makes into Clawperator
   (exec, snapshot, checkpoint, skill-result) is deterministic. The
   agent cannot bypass the hand. The hand is still the actuator.
3. **The brain is inspectable.** A developer must be able to open
   SKILL.md and read the exact program the runtime agent was given.
   The brain is not a black box; it is a markdown file next to the
   skill. This is what distinguishes this design from "just ask Claude
   to do it".
4. **The declared contract is the source of truth for success.** The
   `skill.json` `contract` block (W3) plus the `SkillResult`
   `terminalVerification` record are the only things that let the
   runtime say a skill succeeded. An agent that *claims* success in
   text but cannot prove terminal verification does not succeed; it
   returns `indeterminate`.
5. **Every artifact is inspectable code or data.** Recording export,
   SKILL.md, skill.json, run.js harness, `SkillResult` JSON, compare
   output. Nothing is hidden. A developer watching the video must be
   able to open each one and understand it.
6. **Authoring and runtime use the same agent CLI.** `codex` is the
   v1 default for both. A plan that introduces different CLIs at
   different stages without a very clear reason is adding complexity
   the program does not need yet.

## Hard Decisions Already Made

These are committed. Do not re-litigate them in implementation.

1. Orchestrated skills **require** a configured agent CLI. There is no
   graceful fallback to scripted execution. If no agent CLI is
   available, the skill refuses to run with a typed error. A
   half-running orchestrated skill is worse than a clean refusal.
2. The default agent CLI is `codex`. This is a pragmatic default
   because the program owner has generous local limits on Codex. The
   contract must still allow swapping in another CLI, but `codex` is
   the v1 baseline.
3. The video does **not** show a replay skill on screen. Comparing two
   skill shapes is cognitive load that does not serve the viewer, who
   just wants to understand what is being built. Scene 8 shows the
   orchestrated skill only. Replay is an implementation detail of the
   program, not a teaching tool for the video.
4. The Solax orchestrated skill is the first proving case for the
   agent-driven model, and it is the only orchestrated skill shown in
   the video.
5. `SkillResult` is universal across every new skill (replay and
   orchestrated). Decided in the previous round. Stands.
6. The success of the program is measured on **reliable outcomes**,
   not on replayable paths. See principle 1 above.
7. Authoring-time agent and runtime agent are the same binary
   (`codex`) with different prompts. Plans that split these across
   different CLIs need owner approval first.

## New And Changed Task Packs

### New: `tasks/recording/agent-driven-skills/` (W2b)

Slots into the workstream sequence between W2 (`skill-result-contract/`)
and W3 (`skill-contract-declaration/`).

**Scope:**

- Declare that "orchestrated" = agent-driven by definition.
- Define the SKILL.md-as-program minimum contract:
  - declared goal (matches `skill.json` goal)
  - declared inputs (matches `skill.json` inputs schema)
  - allowed Clawperator primitives (at minimum: `clawperator exec`,
    `clawperator snapshot`, `clawperator checkpoint` — the final set
    is a W2b deliverable)
  - required checkpoint identities, mirroring the W2 Solax list
  - recovery branches (what the agent must do when a snapshot does
    not match expectations)
  - emission rules (exactly one `[Clawperator-Skill-Result]` frame on
    stdout at the end)
  - hard rule: the agent must not invent new checkpoint identities
    not listed in SKILL.md; if the run took a path SKILL.md did not
    cover, the missing identities are reported as `skipped` and the
    final status should be `indeterminate` unless terminal
    verification still holds
- Define the thin-harness pattern for `run.js`:
  - read `SKILL.md`
  - resolve the agent CLI from skill config, defaulting to `codex`
  - spawn with `SKILL.md` as program and inputs as arguments
  - forward stdout
  - exit with the agent's exit code
- Define the agent CLI contract:
  - how the CLI name is declared in `skill.json` (recommend a new
    `agent` block with `cli`, optional `cliPath`, optional
    `timeoutMs`)
  - how `runSkill` validates the agent CLI is present before spawning
  - how the agent's own timeout interacts with `runSkill`'s timeout
  - what error `runSkill` returns when the agent CLI is missing
    (recommend a new typed error, e.g. `SKILL_AGENT_CLI_UNAVAILABLE`)
  - how `clawperator doctor` surfaces agent CLI availability
- Define the authoring handoff shape: what inputs/context the runtime
  agent gets from `runSkill` (recommend: SKILL.md as program plus a
  JSON inputs blob via an env var, e.g. `CLAWPERATOR_SKILL_INPUTS`).
- Define the Solax orchestrated proving case in this pack:
  - `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/`
  - a real SKILL.md-as-program that an agent can execute against the
    SolaX Cloud app
  - a thin run.js harness
  - a `skill.json` with the declared contract block and `agent` block
- Include a **reliability validation phase**: run the orchestrated
  skill at least 10 times against a live Samsung target with a
  cleaned baseline state, measure success rate, classify failure
  modes, and document required fixes before declaring W2b done.
- Prove the pack on a live Samsung target.

**Out of scope for W2b:**

- agent CLI implementation (the program does not ship codex)
- a shared SKILL.md template library
- a general-purpose agent skill framework beyond what Solax needs
- replay skill changes (they stay scripted; their retrofit lives in
  W2 P3)
- streaming/progressive checkpoint emission (v1 is end-of-run only)
- the authoring-time agent loop (that is W6's job; W2b only owns the
  runtime shape)

### Changed: `tasks/recording/skill-result-contract/` (W2)

- **Move P3 (the Solax orchestrated retrofit) out of W2 and into W2b.**
  W2 keeps: P1 contract definition, P2 `runSkill` parsing/tests, and
  the replay skill retrofit (because replay stays scripted and does
  not need agent runtime). The orchestrated retrofit lands in W2b
  where it belongs.
- Note explicitly that the `SkillResult` contract is emitter-agnostic:
  it does not care whether the emitter is a script or an agent. This
  stops later task packs from accidentally coupling the contract to
  scripted emission.
- Keep the "replay skill must also emit SkillResult" language and the
  coarse-subset checkpoint policy from the previous round. Those
  stand.
- Update PR grouping so the orchestrated retrofit is no longer in
  PR-4. PR-4 becomes the W2 replay retrofit only. A new PR (PR-4b or
  PR-5b) carries W2b.
- Remove any remaining language implying the first orchestrated
  proving skill will be scripted. The orchestrated retrofit now
  produces SKILL.md + thin harness + skill.json.

### Changed: `tasks/recording/skill-contract-declaration/` (W3)

- Update the `indeterminate` semantics wording to be agent-aware:
  "`indeterminate` is emitted when the skill-runner (script or
  embedded agent) finishes without an exec failure, but the declared
  verification in `skill.json` is not satisfied when cross-checked
  against the emitted `SkillResult.terminalVerification`." The
  runtime cross-check is still the authoritative source.
- Ensure the Solax proving case in W3 uses the agent-driven
  orchestrated skill from W2b, not a scripted version. W3 has a
  dependency on W2b landing first — update the blocker list.
- Add an acceptance criterion: a run of the orchestrated skill in
  which the app is forced into a state where the declared verification
  cannot be satisfied must emit a `SkillResult` with
  `status: indeterminate`, and `runSkill` must surface that state to
  its caller. This is the test that proves the contract is enforced.

### Changed: `tasks/recording/compare/` (W4)

This pack needs real rethinking, not just wording updates, because
agent-driven runs break the "checkpoint sequence equality" assumption
it was designed around.

- The W4 compare model today implicitly assumes that a baseline
  checkpoint sequence (derived from the recording export) and a run
  checkpoint sequence (from `SkillResult`) are meaningfully
  comparable in order. That assumption holds for scripted replay
  runs. It **does not hold** for agent-driven orchestrated runs,
  which may legitimately take a different path while still reaching
  the same terminal state.
- W4 must distinguish two comparison modes:
  - **literal compare**: baseline checkpoint identities vs run
    checkpoint identities in order. Meaningful for replay skills and
    for agent-driven runs that followed the happy path. Still the
    right thing when everything matches.
  - **semantic compare**: terminal-verification equality between the
    baseline's expected final state (derived from the recording
    export) and the run's emitted `terminalVerification`. Meaningful
    when an agent-driven run diverges from baseline but still reaches
    the goal.
- W4 must define how it reports a successful agent-driven run that
  followed a different path. The correct answer is probably "not a
  divergence": the agent hit terminal verification, so the outcome is
  valid, and compare should call this out as "outcome matches,
  path differs" rather than flagging it as a failure.
- W4 must still flag a legitimate divergence: the run did not reach
  terminal verification, and the first checkpoint in the baseline
  that was not reached (or was reached with a non-ok status) is the
  meaningful divergence point.
- Update the Solax proving cases in W4 so at least one is an
  agent-driven run that takes a different path than the recording
  baseline but still reaches terminal verification. Compare must
  handle this case correctly.

### Changed: `tasks/recording/skill-author-by-recording/` (W6)

- The guided authoring workflow now produces an **agent program**,
  not a script, for the orchestrated skill. The workflow's output
  contract must list `SKILL.md` as the primary authored artifact for
  the orchestrated sibling, with the thin run.js harness as a
  near-boilerplate follow-on and the skill.json contract block as
  the third artifact.
- W6 should use the release-skill family as the decomposition precedent:
  one top-level `skill-author-by-recording` entrypoint, with optional helper
  skills behind it if the implementation gets large. Do **not** add a second
  top-level `skill-author-orchestrator` skill; that name is too easy to
  confuse with `skill-author-orchestrated`.
- The workflow must know how to prompt the human when to touch the
  phone, run the recording lifecycle, and then hand the recording
  evidence to an authoring-time agent that produces the
  SKILL.md-as-program from that evidence. The authoring-time agent
  is a separate codex invocation from the runtime agent.
- The "inspectable outputs" list must be updated: orchestrated
  artifacts are `SKILL.md`, `skill.json`, and a thin `run.js`, not a
  long scripted run.js.
- Add an **authoring self-test loop**: after the authoring-time agent
  writes the three files, the workflow should invoke the new skill
  once against the live device and confirm the terminal verification
  succeeds before declaring the authoring done. If it does not, the
  workflow should surface the failing `SkillResult` to the developer
  and stop. This closes the loop between authoring and runtime and
  is what lets the video claim "authored and then reliably run".
- Explicitly mark that the authoring-time agent does not ship the
  recording export into the runtime skill. The export is authoring
  evidence only. SKILL.md is the runtime program. This is the
  cleanest story and avoids shipping huge evidence blobs into every
  run of the skill.
- Default helper decomposition for W6, if needed:
  - `recording-capture-export`
  - `skill-author-orchestrated-from-recording`
  - `skill-validate-authored-skill`
  Replay-specific helper authoring is not part of the first front-door flow.

### Changed: `tasks/recording/plan.md` (top-level)

- Add W2b to the workstream table and to the Required Sequence list.
- Add to Program Definition Of Done: "The Solax orchestrated proving
  skill is agent-driven at runtime. Its `SKILL.md` is the agent's
  program; its `scripts/run.js` is a thin harness that spawns the
  configured agent CLI; the embedded agent emits a `SkillResult`
  frame at the end; the reliability validation phase in W2b has
  been run against a live Samsung target."
- Add a Hard Rule: "Orchestrated skills created from W2b onward are
  agent-driven by definition. A scripted run.js that does not
  delegate to an agent CLI is, by definition, a replay skill
  regardless of its id suffix."
- Update PR grouping to list the new W2b PRs.
- Update the workstream ownership section so `skill-result-contract/`
  no longer claims ownership of the orchestrated Solax retrofit.
  That ownership moves to `agent-driven-skills/`.
- Update the workstream blocker graph: W3 now blocks on W2b (not
  just W2). W4 still blocks on W2, but its Solax proving runs block
  on W2b. W6 still blocks on W2/W3/W4/W5, but its authoring output
  format now depends on W2b's SKILL.md-as-program contract.

### Sanity check: `tasks/recording/brain-hand-contract/problem-definition.md`

- Read through for any language that explicitly contradicts the
  agent-driven-skill direction. The architectural framing is already
  compatible; the risk is stale wording like "the skill is a script"
  or "checkpoints are hand-written". Patch those if found.
- Do not rewrite the problem definition. Its job is to carry the
  "why"; the implementation shape is W2b's job.

### Cleanup: `tasks/recording/demo/`

- `demo/findings.md` was written against the pre-refactor assumption
  that the orchestrated skill would be scripted. Review each
  finding:
  - if it is about scripted-orchestrated mechanics, flag it as
    obsolete and let W5 decide whether to delete or relocate it
  - if it is about recording lifecycle, device behavior, or the
    SolaX app itself, it is still durable and W5 should graduate it
- Do not delete `demo/` yet. W5 owns that graduation.

## Video Rewrite

Apply these to `tasks/recording/video-draft.md` once the underlying
plans are in place. Do **not** preserve the replay vs orchestrated
side-by-side framing that the previous session added. It was the
wrong call.

### Scene 2 - Why This Is Not Just Macro Replay

Drop the "macro replay vs Clawperator + agent" comparison in its
current shape. Replace with a single narrative beat: "This is not a
macro recorder, because at runtime the thing driving the phone is an
agent reasoning turn by turn against a declared contract, not a tape
being played back." Keep it short. Do not introduce replay skills here.

### Scene 3 - Invoke The Guided Authoring Workflow

Update the prompt sent to Codex so it no longer implies a replay +
orchestrated pairing. Have it simply create the orchestrated skill
from the recording evidence. One skill.

### Scene 7 - The Agent Authors The Orchestrated Skill

Rewrite around a single skill folder:

```text
skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/
```

Show Codex (the authoring-time agent) streaming three files into that
folder:

- `SKILL.md` (the agent's program)
- `skill.json` (declared contract, including the `agent` block)
- `scripts/run.js` (thin harness)

Lower-third card: "the orchestrated skill is authored as an agent
program, not as a script."

### Scene 8 - The Orchestrated Skill, Up Close

Drop the two-column code view. Show the orchestrated skill as three
stacked panels:

1. `SKILL.md` — the agent's program in plain English, showing
   declared inputs, required checkpoint identities, recovery
   branches, and the emission rule. The human reads this to
   understand what the skill does; the runtime agent reads this to
   execute.
2. `scripts/run.js` — the thin harness (roughly 15 lines): read
   SKILL.md, resolve the agent CLI (`codex` by default), spawn,
   forward stdout, exit. Narration lands the point: this file is not
   the skill. The SKILL.md is the skill. The run.js is how
   Clawperator starts an agent on that SKILL.md.
3. `skill.json` — the declared contract (inputs schema, goal,
   verification rule) plus the `agent` block naming the required CLI.

Narration must make these points explicitly:

- The code on screen is not a macro. The thing driving the phone is
  an agent, reading SKILL.md like an operator reading a runbook.
- The agent is not a mystery box. You can open SKILL.md and see
  every instruction it was given. The brain is inspectable.
- Clawperator still stays the deterministic hand. The agent calls
  Clawperator primitives to drive the device. The brain never
  bypasses the hand.
- Reliability here means reliable outcome, not reliable path. The
  agent may take a slightly different route on different runs; what
  makes it trustworthy is the declared verification that it must
  satisfy before reporting success.

### Scene 10 - The Runtime Loop

Rewrite to show **two agents**, one at each layer:

```text
OpenClaw (brain, top layer)
  "set discharge limit to 40%"
       |
       v
  pick the orchestrated skill
       |
       v
  invoke with { percent: 40 }
       |
       v
  Clawperator runSkill spawns the agent CLI on SKILL.md
       |
       v
  embedded skill-runner agent (brain, inner layer)
    read SKILL.md
    loop:
      snapshot via clawperator snapshot
      reason about the current UI
      tap/type via clawperator exec
      record checkpoint
      recover if a branch requires it
    run terminal verification
    emit [Clawperator-Skill-Result] frame
       |
       v
  OpenClaw reads the SkillResult
    status == success? done
    status == indeterminate? retry differently, or escalate
    status == failed? walk checkpoints and reason
```

Narration must land: there is a brain at the OpenClaw layer, and a
brain *inside the skill*. Clawperator (the hand) is deterministic at
both layers. The agents are the things reasoning. Skills exist
precisely to host that inner reasoning step, against a contract.

### Scene 12 - Inspectability

Update the file tree to match the one-skill reality:

```text
recordings/<session>.export.json
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/skill.json
```

Labels:

- evidence
- agent program (SKILL.md)
- harness that starts the agent (run.js)
- declared contract (skill.json)

No replay file on this tree.

### Other Scenes

- Scene 1 hook is unchanged.
- Scene 4 recording lifecycle is unchanged.
- Scene 5 human performs the flow is unchanged.
- Scene 6 export-is-evidence is unchanged.
- Scene 9 `SkillResult` up close is unchanged in substance, but the
  narration should stop calling out replay as a parallel emitter.
- Scene 11 compare is mostly unchanged, but the narration should
  acknowledge the "outcome matches, path differs" case explicitly.
  The compare command in Scene 11 stays the same.
- Scene 13 close is unchanged.

### Video Production Notes

Not every concern is a task pack. These notes belong on the
production side of the video, so whoever records it plans for them:

- The runtime agent's turn-by-turn reasoning needs to be **visible on
  screen** during Scene 10 or Scene 11 for the pitch to land. The
  codex CLI that `runSkill` spawns must stream output the viewer can
  read. If W2b decides stderr carries agent reasoning logs, that
  stream is what the video shows.
- Scene 11 needs a **reproducible failure case** to demo compare.
  W2b's reliability validation phase should include at least one
  forced failure scenario (e.g. putting the SolaX app in the wrong
  starting state) that can be reliably replayed for the video.
- The live run shown in the video should be one of the runs
  captured by W2b's reliability validation, not a fresh take. This
  gives the video a real recorded `SkillResult` to show on screen in
  Scene 9 instead of a hand-written example.

## Additional Gaps And Hardening Items

The items below are gaps the previous working session identified but
did not fully close. Each one needs either an answer in this file, a
phase in a task pack, or an explicit decision to defer. A future
thread picking up this plan should walk this list and close each item.

1. **Reliability validation phase.** W2b must run the orchestrated
   Solax skill at least 10 times against a cleaned baseline and
   record success rate, failure modes, and time to terminal state.
   The video's "reliably run" claim rests on this measurement
   existing. Currently referenced in the W2b scope above; make sure
   the W2b work-breakdown file actually owns it when that file is
   authored.
2. **Observability story.** When an orchestrated run fails, what
   does a developer read to debug it? Candidates: agent stderr
   stream, `SkillResult.checkpoints`, `SkillResult.diagnostics`,
   compare output, recording export. Pick the minimum set a
   developer needs to diagnose a failed run and document it in
   `docs/skills/` as part of W6 or a follow-on. Must be concrete
   enough that the video can implicitly demo it in Scene 11.
3. **Agent stderr contract.** Related to the above. W2b has to
   decide whether the embedded agent is allowed to write
   human-readable reasoning on stderr during the run, and whether
   that stream is captured in the `SkillResult` or only surfaced
   through `runSkill`'s existing stderr passthrough. Recommend:
   stderr is free for agent reasoning logs in v1 and passes through
   `runSkill`'s existing stdout/stderr capture without being
   contract-versioned. If a future task wants to promote agent
   reasoning to contract data, that is a new feature.
4. **Cost and rate-limit story.** Every orchestrated skill run
   spawns a codex process. That is paid API calls or bounded local
   limits. The program is not blocked on solving this, but the
   plans should name it so a future feature (shared agent session,
   cached reasoning, etc.) has a place to land. Recommend: add a
   "Cost notes" section to the W2b plan that says "in v1 every run
   spawns a fresh codex process; batching, caching, and session
   reuse are explicit follow-ups".
5. **Recording export at runtime.** Does the runtime agent get the
   recording export as evidence, or only SKILL.md? Recommend:
   SKILL.md only at runtime. The export is authoring evidence and
   should not be shipped into every run. This decision must land in
   W2b or W6. If W6 decides the authoring-time agent needs a
   different answer, it must say so explicitly.
6. **SKILL.md shape sketch.** W2b must deliver at least one
   concrete SKILL.md example, not just a schema. The executing
   thread should sketch what the Solax orchestrated SKILL.md looks
   like as part of W2b P1 so the authoring story and the runtime
   story land against a real artifact. The sketch should include
   declared inputs, the allowed primitives list, at least one
   recovery branch, and the emission rule block.
7. **Authoring-time agent prompt shape.** W6 has to produce a SKILL.md
   from recording evidence. What prompt does the authoring-time
   agent get? Candidates: the recording export, the user's stated
   goal, the existing replay skill as a reference, the SKILL.md
   template from W2b. Recommend: all four. Document this in W6.
8. **Authoring self-test loop.** Listed in the W6 changes above.
   Make sure the W6 work-breakdown actually owns a phase that runs
   the freshly-authored skill at least once before declaring the
   authoring done.
9. **Non-determinism and compare.** Listed in the W4 changes above.
   Make sure W4's work-breakdown owns both literal and semantic
   comparison modes and names at least one agent-driven test case
   for each.
10. **Input validation.** `skill.json`'s declared inputs schema must
    be enforced by `runSkill` before the agent is spawned, not by
    the agent itself. Otherwise the agent sees garbage inputs and
    makes poor decisions. W2b decision.
11. **Agent CLI version pin.** `codex` is the default, but which
    version? A codex CLI that changes its flags or prompt interface
    between versions can break every orchestrated skill. Recommend:
    `skill.json` carries an optional `agent.minVersion`, and W2b
    defines what `runSkill` does when the installed version is
    older. Defer to a follow-on if W2b does not have time.
12. **Prompt injection / runtime agent trust.** The runtime agent
    receives device screen content via `clawperator snapshot`. If
    the device shows hostile content, the agent could be prompted
    to misbehave. This is a real concern for any serious rollout.
    For the proving case it is out of scope, but the program should
    name it so a future security task pack has a hook. Add a
    "Security follow-ups" note in `brain-hand-contract/` or W2b.
13. **Runtime-state signalling from agent-driven skills.** W2 already
    handles `runtime_poisoned` and `runtime_unavailable` as runtime
    states. An agent-driven skill will likely hit these states more
    often because it actually looks at the UI. Decide whether
    agent-driven skills have a privileged way to report these
    states (e.g. `SkillResult.diagnostics.runtimeState`) or just
    use the existing mechanism. Recommend: same mechanism, no new
    surface.
14. **Per-turn checkpoint emission vs end-of-run.** Listed in open
    questions below; default is end-of-run for v1.
15. **What primitives does the agent actually need?** The plan
    currently lists `exec`, `snapshot`, `checkpoint`. Verify against
    the CLI registry (`apps/node/src/cli/registry.ts`) that these
    are the right names and that no other primitives (e.g.
    `recording snapshot --json`, `serve` endpoints) should be in
    the allowed set. W2b decision.
16. **Video forcing function.** Every time a task pack changes, walk
    `video-draft.md` and confirm each scene still lines up with a
    deliverable. If it does not, escalate to the owner. Never
    quietly weaken the script to paper over a scope gap.

## Files That Will Change

When this refactor is executed, these files will be touched. A future
thread should keep this list in sync.

- new: `tasks/recording/agent-driven-skills/plan.md`
- new: `tasks/recording/agent-driven-skills/work-breakdown.md`
- edit: `tasks/recording/skill-result-contract/plan.md`
  - move orchestrated retrofit scope out
  - clarify `SkillResult` is emitter-agnostic
  - remove any "scripted orchestrated" wording
- edit: `tasks/recording/skill-result-contract/work-breakdown.md`
  - remove P3 orchestrated parts (keep replay retrofit)
  - adjust PR grouping
- edit: `tasks/recording/skill-contract-declaration/plan.md`
  - update `indeterminate` semantics wording
  - add W2b as a blocker
  - update proving-case dependency
- edit: `tasks/recording/skill-contract-declaration/work-breakdown.md`
  - add an acceptance criterion for the forced-indeterminate case
- edit: `tasks/recording/compare/plan.md`
  - introduce literal vs semantic comparison modes
  - add non-deterministic-path handling
- edit: `tasks/recording/compare/work-breakdown.md`
  - add Solax agent-driven proving cases for both modes
- edit: `tasks/recording/skill-author-by-recording/plan.md`
  - update output contract to "SKILL.md as agent program"
  - add authoring self-test loop
  - clarify recording export is authoring evidence only
- edit: `tasks/recording/skill-author-by-recording/work-breakdown.md`
  - update artifact list and acceptance criteria accordingly
- edit: `tasks/recording/plan.md`
  - add W2b to workstream table
  - update Program Definition Of Done
  - add Hard Rule for agent-driven orchestrated skills
  - update PR grouping section
  - update pack ownership section
  - update blocker graph (W3 on W2b, etc.)
- edit: `tasks/recording/video-draft.md`
  - rewrite Scenes 2, 3, 7, 8, 10, 12 as described above
  - light edits to Scene 9 narration
  - light edits to Scene 11 narration (outcome-matches case)
  - add video production notes block (or keep them only in this file)
- sanity check, possibly small edits:
  `tasks/recording/brain-hand-contract/problem-definition.md`
- review, do not rewrite yet:
  `tasks/recording/demo/findings.md` (W5 owns the graduation)
- probably unchanged:
  `tasks/recording/graduate-demo-findings/*` (W5) and
  `tasks/recording/skill-checkpoints/*` (W1). Light cross-reference
  pass to make sure nothing contradicts the refactor.

## Open Questions For The Executing Thread

These do not need to be resolved before W2b scoping, but they must be
resolved before W2b implementation lands.

1. **Agent CLI discovery.** Does `runSkill` resolve `codex` from
   `PATH` only, or from a configurable absolute path in
   `skill.json`'s `agent` block, or both? Recommend: both, with
   `skill.json` winning over PATH when present.
2. **Timeout interaction.** `runSkill` today enforces a per-skill
   timeout. Agent-driven skills are longer-running. Decide whether
   orchestrated skills raise the default timeout, whether
   `skill.json` carries its own timeout hint, and whether hitting
   the outer timeout should kill the embedded agent cleanly.
   Recommend: per-skill timeout hint in `skill.json`, sane default
   (e.g. 300000ms for orchestrated skills), outer timeout is what
   `runSkill` enforces.
3. **Agent stdout discipline.** The embedded agent must emit exactly
   one `[Clawperator-Skill-Result]` frame on stdout. Decide whether
   the agent is allowed to write human-readable reasoning on stderr
   during the run. Recommend: stderr is free for agent reasoning
   logs in v1, with the caveat that it is not part of the contract
   and should not be parsed by any downstream consumer.
4. **Doctor check.** `clawperator doctor` should probably add a new
   check: "agent CLI `codex` is on PATH". Decide whether this is a
   W2b deliverable or a later follow-up. Recommend: W2b, so the
   first orchestrated run on a new dev box has a clean failure path.
5. **`SKILL_AGENT_CLI_UNAVAILABLE` error.** Add to
   `apps/node/src/contracts/skills.ts`. Decide its exact code string
   in W2b, not earlier.
6. **Agent input shape.** Decide how inputs are passed to the codex
   invocation. Recommend: as a JSON blob in an env var
   (`CLAWPERATOR_SKILL_INPUTS`) plus the raw argv, so the SKILL.md
   can reference either form.
7. **Per-turn checkpoint emission vs end-of-run emission.** The
   agent could either emit checkpoints progressively (one JSON line
   per checkpoint) so `runSkill` sees progress, or buffer them all
   and emit one `SkillResult` frame at the end. Recommend:
   end-of-run emission in v1, because it preserves the existing
   single-frame parser and avoids a streaming protocol. Progressive
   emission is an explicit follow-up.
8. **Compare modes.** Both literal and semantic. W4 owns this.
   Recommend: literal is the default, semantic is an opt-in flag,
   and the default case explicitly notes "outcome matches, path
   differs" when literal fails but semantic passes.
9. **Agent CLI version pinning.** See hardening item 11.
10. **Primitive allowlist.** See hardening item 15.
11. **Authoring self-test failure handling.** What does W6 do if the
    freshly authored skill fails its self-test run? Candidates:
    surface the failure and stop, auto-retry with agent feedback,
    fall back to a scripted replay skeleton. Recommend: surface and
    stop. The developer should see the failure and decide.
12. **How many reliability runs is "enough"?** W2b says at least
    10. Decide whether the real number is 10, 20, or
    N-runs-until-3-consecutive-successes. Recommend: 10 runs, at
    least 8 of which reach terminal verification, no
    runtime_poisoned states. If those thresholds are not met, W2b
    fails and the fix is scoped from the observed failure modes.

## Context For A Fresh Thread

The "Instructions For The Next Agent" block at the top of this file
is the canonical reading order. This section was an earlier list and
has been folded in. If you are here looking for the reading order,
scroll back up.

## Cleanup

Delete this file when W2b has landed and the video-draft has been
rewritten. Its job is to carry the refactor across threads, nothing
more. When you delete it, make sure any still-open gaps have been
graduated into a task pack that owns them; nothing in this file
should silently vanish.
