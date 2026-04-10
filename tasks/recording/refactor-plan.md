# Recording Program Refactor Plan

## Purpose

Capture a load-bearing architectural correction to the recording program
before it is executed, so the follow-up work can be picked up in a fresh
thread without losing context.

Read this file before touching `tasks/recording/*` or `video-draft.md`.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Blockers | none |
| Next | author W2b pack, update W2/W6/top-level plan, rewrite video Scenes 2/3/7/8/10/12 |
| Owner context | handoff from recording/demo branch working session |

## The Disconnect We Discovered

The current recording program describes an "orchestrated" Solax skill whose
`scripts/run.js` is a straight sequential script with checkpoint labels
around each step. A technically literate viewer reading that code cannot
tell it apart from a macro replayer, because it is architecturally a macro
replayer with checkpoint bookkeeping. There is no agent reasoning inside it
at runtime.

The recording promo video (`tasks/recording/video-draft.md`) pitches
Clawperator as a "brain and hand" system. The brain is the agent, the hand
is Clawperator. The video's current Scene 8 code block does not contain a
brain. This makes the pitch a lie.

Earlier in the session I attempted to defend the script shape by citing
`CLAUDE.md`:

> Clawperator is an actuator: It does not own strategy, planning, or
> autonomous reasoning.
> Clawperator is not an autonomous planner. Agent reasoning stays outside
> this runtime.

That rule constrains **Clawperator the runtime** (`apps/node`, the CLI, the
Operator APK, the exec runtime). It does not constrain **Clawperator
skills**. Skills are exactly the layer where agent control is supposed to
live. The repo already demonstrates this pattern internally in
`.agents/skills/` (`docs-build`, `docs-author`,
`skill-author-by-recording`), which are all markdown-as-program skills
executed by a Claude/Codex agent. There is no architectural reason a
user-facing orchestrated runtime skill cannot follow the same pattern,
and there is every reason it should.

This refactor plan corrects that.

## What Changes At The Architectural Level

Orchestrated skills are **agent-driven by definition** from W2b onward.
Concretely:

- An orchestrated skill's `SKILL.md` is written as a program for an agent
  to read: declared inputs, allowed primitives, required checkpoint
  identities, recovery branches, emission rules.
- An orchestrated skill's `scripts/run.js` is a **thin harness** that:
  reads `SKILL.md`, resolves the configured agent CLI, spawns the agent
  with `SKILL.md` as the program and the skill inputs as arguments,
  forwards the agent's stdout, and exits with the agent's exit code.
- The agent process is the brain. It reads, snapshots via
  `clawperator snapshot`, reasons, taps via `clawperator exec`, handles
  recovery, and at the end writes a single `[Clawperator-Skill-Result]`
  frame to stdout.
- The `SkillResult` contract from W2 does not change. It is
  emitter-agnostic. What changes is who emits it for orchestrated skills:
  the embedded agent, not hand-written script logic.

Replay skills remain scripted and deterministic. They still emit
`SkillResult` per the W2 retrofit. They are **not** a competing
pedagogical frame in the video; see "Video rewrite" below.

## Hard Decisions Already Made

These are committed. Do not re-litigate them in implementation.

1. Orchestrated skills require a configured agent CLI. There is no
   graceful fallback to scripted execution. If no agent CLI is available,
   the skill refuses to run with a typed error. A half-running
   orchestrated skill is worse than a clean refusal.
2. The default agent CLI is `codex`. This is a pragmatic default because
   the owner has generous local limits on Codex. The contract must still
   allow swapping in another CLI, but `codex` is the v1 baseline.
3. The video does **not** show a replay skill on screen. Comparing two
   skill shapes is cognitive load that does not serve the viewer, who
   just wants to understand what is being built. Scene 8 shows the
   orchestrated skill only. Replay is an implementation detail of the
   program, not a teaching tool for the video.
4. The Solax orchestrated skill is the first proving case for the
   agent-driven model, and it is the only orchestrated skill shown in
   the video.
5. `SkillResult` is universal across every new skill (replay and
   orchestrated). That decision was made in the previous round and stands.

## New And Changed Task Packs

### New: `tasks/recording/agent-driven-skills/` (W2b)

Slots into the workstream sequence between W2 (`skill-result-contract/`)
and W3 (`skill-contract-declaration/`).

**Scope:**

- Declare that "orchestrated" = agent-driven by definition.
- Define the SKILL.md-as-program minimum contract:
  - declared goal
  - declared inputs
  - allowed Clawperator primitives (`clawperator exec`, `clawperator
    snapshot`, `clawperator checkpoint`, whatever the final primitive
    set is)
  - required checkpoint identities, mirroring the W2 P3 list
  - recovery branches (what the agent must do when a snapshot does not
    match expectations)
  - emission rules (exactly one `[Clawperator-Skill-Result]` frame on
    stdout at the end)
- Define the thin-harness pattern for `run.js`:
  - read `SKILL.md`
  - resolve the agent CLI from skill config, defaulting to `codex`
  - spawn with `SKILL.md` as program and inputs as arguments
  - forward stdout
  - exit with the agent's exit code
- Define the agent CLI contract:
  - how the CLI name is declared in `skill.json`
  - how `runSkill` validates the agent CLI is present
  - how the agent's timeout interacts with `runSkill`'s timeout
  - what error `runSkill` returns when the agent CLI is missing
    (recommend a new typed error, e.g. `SKILL_AGENT_CLI_UNAVAILABLE`)
  - how `clawperator doctor` surfaces agent CLI availability
- Define the Solax orchestrated proving case in this pack:
  - `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/`
  - a real SKILL.md-as-program that an agent can execute against the
    SolaX Cloud app
  - a thin run.js harness
  - a `skill.json` with the declared contract block
- Prove the pack on a live Samsung target.

**Out of scope for W2b:**

- agent CLI implementation (we do not ship codex)
- a shared SKILL.md template library
- a general-purpose agent skill framework beyond what Solax needs
- replay skill changes (they stay scripted; their retrofit is W2 P3)

### Changed: `tasks/recording/skill-result-contract/` (W2)

- **Move P3 (the Solax orchestrated retrofit) out of W2 and into W2b.**
  W2 keeps: P1 contract definition, P2 `runSkill` parsing/tests, and the
  replay skill retrofit (because replay stays scripted and does not need
  agent runtime). The orchestrated retrofit lands in W2b where it
  belongs.
- Note explicitly that the `SkillResult` contract is emitter-agnostic:
  it does not care whether the emitter is a script or an agent. This
  stops later task packs from accidentally coupling the contract to
  scripted emission.
- Keep the "replay skill must also emit SkillResult" language and the
  coarse-subset checkpoint policy from the previous round. Those stand.
- Update PR grouping so the orchestrated retrofit is no longer in PR-4.
  PR-4 becomes the W2 replay retrofit only. A new PR (PR-4b or PR-5b)
  carries W2b.

### Changed: `tasks/recording/skill-author-by-recording/` (W6)

- The guided authoring workflow now produces an **agent program**, not a
  script, for the orchestrated skill. The workflow's output contract
  must list `SKILL.md` as the primary authored artifact for the
  orchestrated sibling, with the thin run.js harness as a near-boilerplate
  follow-on.
- The skill must know how to prompt the human when to touch the phone,
  run the recording lifecycle, and then hand the recording evidence to
  an authoring agent that produces the SKILL.md-as-program.
- The "inspectable outputs" list must be updated: orchestrated artifacts
  are `SKILL.md`, `skill.json`, and a thin `run.js`, not a long scripted
  run.js.

### Changed: `tasks/recording/plan.md` (top-level)

- Add W2b to the workstream table and to the Required Sequence list.
- Add to Program Definition Of Done: "The Solax orchestrated proving
  skill is agent-driven at runtime. Its `SKILL.md` is the agent's
  program; its `scripts/run.js` is a thin harness that spawns the
  configured agent CLI; the embedded agent emits a `SkillResult` frame
  at the end."
- Add a Hard Rule: "Orchestrated skills created from W2b onward are
  agent-driven by definition. A scripted run.js that does not delegate
  to an agent CLI is, by definition, a replay skill regardless of its
  id suffix."
- Update PR grouping to list the new W2b PRs.
- Update the workstream ownership section so `skill-result-contract/`
  no longer claims ownership of the orchestrated Solax retrofit. That
  ownership moves to the new pack.

## Video Rewrite

Apply these directly to `tasks/recording/video-draft.md`. Do not preserve
the replay vs orchestrated side-by-side framing that the previous session
added. It was the wrong call.

### Scene 2 - Why This Is Not Just Macro Replay

Reframe. Drop the "macro replay vs Clawperator + agent" comparison in its
current shape. Replace with a single narrative beat: "This is not a macro
recorder, because at runtime the thing driving the phone is an agent
reasoning turn by turn against a declared contract, not a tape being
played back." Keep it short. Do not introduce replay skills here.

### Scene 3 - Invoke The Guided Authoring Workflow

Update the prompt sent to Codex so it no longer says "create a
`-orchestrated` skill" with the implicit pairing. Have it simply create
the orchestrated skill from the recording evidence. One skill, not two.

### Scene 7 - The Agent Authors The Orchestrated Skill

Rewrite around a single skill folder:

```text
skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/
```

Show Codex streaming three files into that folder:

- `SKILL.md` (the agent's program)
- `skill.json` (declared contract)
- `scripts/run.js` (thin harness)

Lower-third card explains: the orchestrated skill is authored as an
agent program, not as a script.

### Scene 8 - The Orchestrated Skill, Up Close

Drop the two-column code view. Show the orchestrated skill as three
stacked panels:

1. `SKILL.md` — the agent's program in plain English, showing declared
   inputs, required checkpoint identities, recovery branches, and the
   emission rule. This is the thing a human reads to understand what
   the skill does, and the thing the agent reads to execute.
2. `scripts/run.js` — the thin harness (roughly 15 lines): read SKILL.md,
   resolve the agent CLI (`codex` by default), spawn, forward stdout,
   exit. The narration explicitly lands the point: this file is not the
   skill. The SKILL.md is the skill. The run.js is how Clawperator
   starts an agent on that SKILL.md.
3. `skill.json` — the declared contract (inputs schema, goal, verification
   rule), unchanged from the previous draft except that the `agent`
   field declares the required CLI.

Narration must make these points explicitly:

- The code on screen is not a macro. The thing driving the phone is an
  agent, reading SKILL.md like an operator reading a runbook.
- The agent is not a mystery box. You can open SKILL.md and see every
  instruction it was given. The brain is inspectable.
- Clawperator still stays the deterministic hand. The agent calls
  Clawperator primitives to drive the device. The brain never bypasses
  the hand.

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

Narration must land this: there is a brain at the OpenClaw layer, and a
brain *inside the skill*. Clawperator (the hand) is deterministic at both
layers. The agents are the things reasoning. Skills exist precisely to
host that inner reasoning step, against a contract.

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
- Scene 9 `SkillResult` up close is unchanged in substance but the
  narration should stop calling out replay as a parallel emitter.
- Scene 11 compare works unchanged. Compare still compares recording
  export vs a `SkillResult` from the orchestrated skill run. Replay is
  not shown.
- Scene 13 close is unchanged.

## Files That Will Change

When this refactor is executed, these files will be touched:

- new: `tasks/recording/agent-driven-skills/plan.md`
- new: `tasks/recording/agent-driven-skills/work-breakdown.md`
- edit: `tasks/recording/skill-result-contract/plan.md`
  - move orchestrated retrofit scope out
  - clarify `SkillResult` is emitter-agnostic
- edit: `tasks/recording/skill-result-contract/work-breakdown.md`
  - remove P3 orchestrated parts (keep replay retrofit)
  - adjust PR grouping
- edit: `tasks/recording/skill-author-by-recording/plan.md`
  - update output contract to "SKILL.md as agent program"
- edit: `tasks/recording/skill-author-by-recording/work-breakdown.md`
  - update artifact list and acceptance criteria accordingly
- edit: `tasks/recording/plan.md`
  - add W2b to workstream table
  - update Program Definition Of Done
  - add Hard Rule for agent-driven orchestrated skills
  - update PR grouping section
  - update pack ownership section
- edit: `tasks/recording/video-draft.md`
  - rewrite Scenes 2, 3, 7, 8, 10, 12 as described above
  - light edits to Scene 9 narration
- probably unchanged: `tasks/recording/brain-hand-contract/problem-definition.md`
  - its framing already supports agent-driven skills; sanity-check,
    do not rewrite

## Open Questions For The Executing Thread

These do not need to be resolved before W2b scoping, but they must be
resolved before W2b implementation lands.

1. **Agent CLI discovery.** Does `runSkill` resolve `codex` from `PATH`
   only, or from a configurable absolute path in `skill.json`'s `agent`
   block, or both? Recommend: both, with `skill.json` winning over PATH
   when present.
2. **Timeout interaction.** `runSkill` today enforces a per-skill
   timeout. Agent-driven skills are longer-running. Decide whether
   orchestrated skills raise the default timeout, whether `skill.json`
   carries its own timeout hint, and whether hitting the outer timeout
   should kill the embedded agent cleanly. Recommend: per-skill timeout
   hint in `skill.json`, with a sane default (e.g. 180000ms), and the
   outer timeout is what `runSkill` enforces.
3. **Agent stdout discipline.** The embedded agent must emit exactly one
   `[Clawperator-Skill-Result]` frame on stdout. Decide whether the
   agent is allowed to write human-readable reasoning on stderr during
   the run (useful for debugging), or whether stderr is reserved for
   hard failures. Recommend: stderr is free for agent reasoning logs in
   v1, with the caveat that they are not part of the contract.
4. **Doctor check.** `clawperator doctor` should probably add a new
   check: "agent CLI `codex` is on PATH". Decide whether this is a W2b
   deliverable or a later follow-up. Recommend: W2b, so the first
   orchestrated run on a new dev box has a clean failure path.
5. **`SKILL_AGENT_CLI_UNAVAILABLE` error.** Add to
   `apps/node/src/contracts/skills.ts`. Decide its exact code string in
   W2b, not earlier.
6. **Agent input shape.** Decide how inputs are passed to the codex
   invocation. Recommend: as a JSON blob in an env var
   (`CLAWPERATOR_SKILL_INPUTS`) plus the raw argv, so the SKILL.md can
   reference either form.
7. **Per-turn checkpoint emission vs end-of-run emission.** The agent
   could either emit checkpoints progressively (one JSON line per
   checkpoint) so `runSkill` sees progress, or buffer them all and emit
   one `SkillResult` frame at the end. Recommend: end-of-run emission
   in v1, because it preserves the existing single-frame parser and
   avoids a streaming protocol. Progressive emission can be a later
   feature if we actually need it.

## Context For A Fresh Thread

If a new thread is picking this up cold, read in this order:

1. This file (`tasks/recording/refactor-plan.md`).
2. `tasks/recording/plan.md` - current workstream state.
3. `tasks/recording/brain-hand-contract/problem-definition.md` - the
   architectural framing. This file already supports agent-driven skills
   conceptually, even though the earlier implementation plans drifted
   toward scripted orchestrated skills.
4. `tasks/recording/skill-result-contract/plan.md` and
   `work-breakdown.md` - the current W2 shape. Note that P3 in the
   work-breakdown is the orchestrated retrofit that this refactor moves
   out into W2b.
5. `tasks/recording/video-draft.md` - the promo script. It is written
   present-tense under the assumption the whole program has shipped.
   The current Scene 8 shows a scripted orchestrated skill with
   checkpoint labels. That is the lie this refactor fixes.
6. `.agents/skills/docs-build/`, `.agents/skills/docs-author/`, and
   `.agents/skills/skill-author-by-recording/` - worked examples of
   the SKILL.md-as-program pattern the refactor wants to apply to
   runtime skills. These are the closest repo-local precedents. Open
   them to see what a good SKILL.md-as-program looks like.
7. `apps/node/src/domain/skills/runSkill.ts` - current `runSkill`
   implementation. W2b will likely extend this, or its `resolveScript`
   helper, to handle agent-driven skills. Do not break legacy scripted
   skills when doing so.
8. `apps/node/src/contracts/skills.ts` - current skills contract and
   error codes. W2b adds `SKILL_AGENT_CLI_UNAVAILABLE` and probably an
   `agent` block in the skill shape.
9. `CLAUDE.md` - repo rules. Specifically, the "Clawperator is an
   actuator" rule applies to the runtime, **not** to skills. Skills are
   the layer where agents are welcome. Do not make the same mistake
   that triggered this refactor.
10. `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/`
    - the existing replay skill. Read it to understand what the current
    Solax automation looks like on device, and to inform the SKILL.md
    instructions the orchestrated skill will need.

When the executing thread has read those files, the remaining task is
mechanical: author the W2b pack, apply the edits listed under "Files
That Will Change", rewrite the listed video scenes, and commit.

Do **not** execute any of the individual file changes listed in this
refactor plan before confirming alignment with the program owner. The
owner asked for this plan to exist as a checkpoint, specifically so the
refactor can be paused and resumed cleanly across sessions.

## Cleanup

Delete this file when W2b has landed and the video-draft has been
rewritten. Its job is to carry the refactor across threads, nothing more.
