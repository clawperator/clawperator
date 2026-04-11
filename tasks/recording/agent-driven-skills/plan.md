# Agent-Driven Skills (W2b)

## Executive Summary

Define what it means for a Clawperator orchestrated skill to be
**agent-driven at runtime**, extend `runSkill` to execute such skills
safely, and retrofit the Solax `-orchestrated` skill as the first
proving case.

This pack exists because W2's `SkillResult` contract is emitter-agnostic
but the current recording-program plans implicitly assume scripted
emission. Without this pack, "orchestrated" skills are just labeled
macro replays. With this pack, orchestrated skills host an embedded
agent that reasons turn by turn against the current UI through a
programmed `SKILL.md`, while W3 later adds the declarative
`skill.json.contract` block that the runtime can enforce.

This file and `tasks/recording/plan.md` are the current source of truth for the
runtime shape of orchestrated skills.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 5 |
| Completed | none |
| Remaining | P1, P2, P3, P4, P5 |
| Current / Next | P1 after W2 lands |
| Blockers | `skill-result-contract/` must land first (W2 contract + parser) |

## Goal

Ship an orchestrated skill runtime shape in which:

- the skill's behavior is described in `SKILL.md` as a program written
  for an agent to execute
- `scripts/run.js` is a thin harness that spawns a configured agent
  CLI (default `codex`) with that SKILL.md as the program and the
  skill inputs as arguments
- the agent drives the device through Clawperator primitives, records
  checkpoints, runs terminal verification, and emits exactly one
  `[Clawperator-Skill-Result]` frame
- the Solax orchestrated skill proves the pattern against a live
  Samsung target
- reliability is measured and documented, not assumed

## Why Now

Current plans describe "orchestrated" as if it were a category of
scripted skill with better labeling. That is not the promise the
recording program makes. The promise is that an agent reasons about
the UI at runtime and holds itself to a declared contract. W2b closes
the gap between that promise and the current plans.

## In Scope

- `skill.json` `agent` block (required `cli`, optional `cliPath`,
  optional `timeoutMs`)
- SKILL.md-as-program minimum contract (declared goal, declared
  inputs, allowed primitives, required checkpoint identities,
  recovery branches, emission rules)
- thin-harness pattern for `run.js` (small, boilerplate, reusable)
- `runSkill` changes required to execute orchestrated skills via
  `scripts/run.js` safely
- a new typed error `SKILL_AGENT_CLI_UNAVAILABLE`
- an advisory `clawperator doctor` host check for the default agent CLI
  (`codex`) plus any explicit env override used for orchestrated skills
- Solax orchestrated skill as the first proving case
- reliability validation phase against a live Samsung target
- test fixtures and regression coverage for the new agent-driven path

## Out Of Scope

- agent CLI implementation (the program does not ship codex)
- a shared SKILL.md template library
- a general-purpose agent skill framework beyond what Solax needs
- scripted replay skill changes (those live in W2 P3)
- streaming/progressive checkpoint emission (v1 is end-of-run only)
- the authoring-time agent loop that writes SKILL.md from a
  recording (that is W6's job; W2b only owns the runtime shape)
- caching, session reuse, or rate-limit mitigation for the agent CLI
  (explicit follow-up)
- prompt-injection hardening (explicit follow-up under a future
  security task pack)

## Surfaces And Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/src/contracts/skills.ts` | Clawperator repo | `agent` block, `SKILL_AGENT_CLI_UNAVAILABLE` |
| `apps/node/src/domain/skills/runSkill.ts` | Clawperator repo | detection of agent-driven skills, execution of `scripts/run.js`, timeout handling, result parsing |
| `apps/node/src/domain/doctor/checks/` | Clawperator repo | advisory host check for the default orchestrated-skill agent CLI |
| `apps/node/src/test/` | Clawperator repo | fixtures and regression tests |
| `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/` | Skills repo | Solax proving case (SKILL.md, run.js, skill.json) |
| `docs/skills/authoring.md`, `docs/skills/overview.md` | Clawperator repo | public authoring and category wording updates |

## Source Of Truth

| Area | Source |
| --- | --- |
| `SkillResult` contract | `apps/node/src/contracts/` (post-W2) |
| Current skill runtime | `apps/node/src/domain/skills/runSkill.ts` |
| Current doctor checks | `apps/node/src/domain/doctor/checks/` |
| Current replay skill | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/` |
| Internal SKILL.md-as-program precedents | `.agents/skills/docs-build/`, `.agents/skills/docs-author/` |
| Architectural framing | `tasks/recording/brain-hand-contract/problem-definition.md` |
| Recording program sequencing | `tasks/recording/plan.md` |

## Decision Rules

- Orchestrated skills require a configured agent CLI. No scripted
  fallback. No graceful degradation. If the agent CLI is missing,
  `runSkill` refuses with `SKILL_AGENT_CLI_UNAVAILABLE`.
- The default agent CLI is `codex`. Other CLIs must be nameable in
  `skill.json` but `codex` is the v1 baseline.
- The thin-harness pattern is boilerplate by design. It does not
  contain skill logic. If a harness starts growing skill-specific
  code, that code belongs in SKILL.md as an instruction for the
  agent, not in the harness.
- Responsibility boundary: `runSkill` does not spawn the agent CLI
  directly for orchestrated skills. It validates the configured agent
  settings, executes the skill's `scripts/run.js` harness, forwards
  stdout and stderr, enforces the outer timeout, and parses the emitted
  `SkillResult`. The harness is the layer that resolves and spawns the
  configured agent CLI on `SKILL.md`.
- The embedded agent is not allowed to invent checkpoint identities
  outside the list declared in SKILL.md. If the run took a path
  SKILL.md did not cover, the missing identities are reported as
  `skipped` and the final status is `indeterminate` unless terminal
  verification still holds.
- For the Solax proving case, W2b must mirror the replay contract
  choices made in W2 P3 unless a later task pack intentionally
  revises them. Reuse `goal: { "kind": "set_discharge_limit",
  "percent": <n> }`, reuse `inputs: { "percent": <n> }`, and include
  the same coarse replay checkpoint subset in the same order:
  `app_opened`, `discharge_to_row_focused`, `target_text_entered`,
  `save_completed`, `terminal_state_verified`. Do not silently drop
  or rename any of those coarse identities; if one later proves
  unstable, record the reason explicitly in the task pack and skill
  docs.
- The recording export is authoring evidence only. It is not passed
  to the runtime agent. SKILL.md is the only program the runtime
  agent reads.
- W2b must not invent a second machine-readable input schema before W3.
  Before W3 lands, `runSkill` may apply only the existing CLI/runtime
  argument checks and then forward the resulting inputs to the agent.
  Pre-spawn validation against declared `contract.inputs` is W3's job.
- The runtime agent must not include a `source` field in the emitted
  `[Clawperator-Skill-Result]` frame. `source` is injected by `runSkill`
  from the known `skill.json` `agent` block after parsing the frame. SKILL.md
  emission rules must explicitly omit `source`. If a frame arrives with
  `source` already set, `runSkill` rejects it as malformed.
- Framed provenance is authoritative, not best-effort. W2b must ensure the
  orchestrated skill's `skill.json` always carries readable trusted source
  metadata (`agent.cli`) because shipped W2 behavior rejects framed results if
  `runSkill` cannot read source metadata from `skill.json`.
- Timeout precedence is fixed by shipped W2 behavior: if the outer `runSkill`
  timeout fires, W2b must consume the timeout outcome and must not assume a
  partially written frame can still be parsed into `skillResult`.
- The authoring-time agent (W6) and the runtime agent (this pack)
  are the same binary (`codex`) with different prompts. Plans that
  split them across different CLIs need owner approval.
- Reliability is measured, not assumed. The reliability validation
  phase (P4) must run at least 10 invocations against a live Samsung
  target with a cleaned starting state and record success rate,
  failure modes, and time-to-terminal-state. At least 8 of 10 runs
  must reach terminal verification with `status: success`, with no
  `runtime_poisoned` states, or the pack does not ship.
- Replay remains first-class. This pack defines the orchestrated runtime shape,
  but it must not weaken the preserved replay baseline or imply replay is now a
  deprecated category.

## Required Decisions In P1

P1 must commit to all of these. None of them may be deferred to
implementation:

- Exact shape of the `skill.json` `agent` block. Recommend:
  ```json
  "agent": {
    "cli": "codex",
    "cliPath": null,
    "timeoutMs": 300000
  }
  ```
- Exact primitive allowlist the runtime agent is told it can use.
  Recommend v1: only already-shipped, device-facing CLI surfaces that
  are verified against `apps/node/src/cli/registry.ts` at implementation
  time. At minimum this means `clawperator snapshot` and
  `clawperator exec`, plus one existing text-reading surface if terminal
  verification needs it. Checkpoint recording and SkillResult emission are
  protocol duties inside the agent program, not separate CLI subcommands.
- Exact agent input shape. Recommend: SKILL.md content passed as the
  agent's program, inputs passed as a JSON blob via
  `CLAWPERATOR_SKILL_INPUTS` env var plus raw argv passthrough.
- Exact error code string for missing agent CLI. Recommend:
  `SKILL_AGENT_CLI_UNAVAILABLE`.
- Exact agent CLI resolution order. Recommend: `skill.json`'s
  `agent.cliPath` wins over `PATH`; `PATH` wins if `cliPath` is null.
- Exact scope of the doctor check. Recommend: `clawperator doctor` gets a
  host-level advisory check for the default orchestrated-skill agent CLI
  (`codex`) and any explicit env override. Per-skill CLI availability remains
  a `runSkill` or `skills validate` responsibility because doctor has no skill
  id input.
- Exact stderr policy. Recommend: stderr is free for agent reasoning
  logs, captured and forwarded by `runSkill` via the existing
  stdout/stderr mechanism, but not part of the `SkillResult` contract.
- Exact timeout interaction. Recommend: the `runSkill` outer timeout
  is authoritative; `skill.json`'s `agent.timeoutMs` is a hint
  `runSkill` uses to pick its default if the caller did not pass
  `--timeout`.
- Checkpoint-invention policy (see decision rules above).
- Reliability threshold (see decision rules above).

## Failure Modes To Prevent

- treating `SkillResult` emission as the proof a skill is
  orchestrated, when the emitter was actually a scripted harness with
  no agent at all
- allowing the agent to invent checkpoint identities the declared
  contract does not cover, which would silently break compare (W4)
- letting a missing agent CLI produce a vague error instead of a
  typed one
- shipping the Solax orchestrated skill without a real reliability
  measurement, so the video's "reliably run" claim is a guess
- quietly expanding the thin-harness pattern into a skill framework
- coupling the `SkillResult` contract to agent-driven emission so W2
  cannot stay emitter-agnostic

## Output Contract

This pack should produce:

- the extended `skill.json` contract with an `agent` block
- `runSkill` changes to detect agent-driven skills, execute the skill's
  `scripts/run.js` harness, forward stdout and stderr, and return the
  parsed `SkillResult`
- `SKILL_AGENT_CLI_UNAVAILABLE` typed error in
  `apps/node/src/contracts/skills.ts`
- a `clawperator doctor` advisory check for the default orchestrated-skill
  agent CLI on PATH
- a concrete SKILL.md-as-program for the Solax orchestrated skill
  covering every required checkpoint identity and at least one
  recovery branch
- a thin `run.js` harness that is reusable by future orchestrated
  skills with minimal edits
- a `skill.json` for the Solax orchestrated skill declaring the
  `agent` block plus (via W3) the `contract` block
- test coverage for the new path, including: agent CLI missing,
  agent exits non-zero, agent emits malformed frame, agent emits
  indeterminate, agent takes a non-deterministic recovery path but
  reaches terminal verification
- a reliability validation report under `docs/internal/design/reliability/`
  documenting the 10-run measurement (must survive `tasks/recording/` deletion)
- updates to `docs/skills/authoring.md` and `docs/skills/overview.md`
  describing the agent-driven orchestrated shape
- documentation clarifying that the retained compare baseline is reference
  evidence only and is never passed into the runtime agent

## SkillResult File Persistence

The `clawperator skills run --json` output includes the full `SkillResult` in
its JSON payload. Saving that full CLI JSON output to a file is the mechanism
that feeds the `clawperator recording compare --result <file>` workflow shown
in the video.

W2b does not own a new `--save-result` flag. The v1 pattern is:

```bash
clawperator skills run <id> --json -- <inputs> > ./runs/<id>-<ts>.skills-run.json
```

W4 (`compare/`) owns the `--result` file input contract. The intended v1
contract is that compare accepts this saved `skills run --json` wrapper
directly, extracts `skillResult`, and does not require a separate transform
step. W2b owns ensuring the `--json` output from `clawperator skills run`
contains the full `SkillResult` document in a form that `compare` can consume
directly from that wrapper.

The reliability validation phase (P4) must save all 10 run results and the
forced-failure run using this pattern, so they are available as real inputs
for the compare demo in Scene 11 of the video.

## Cost Notes

In v1, every orchestrated skill invocation spawns a fresh `codex` process.
Batching, caching, session reuse, and cost/rate-limit optimization are explicit
follow-ups, not hidden assumptions in this pack. The v1 bar is correctness,
inspectability, and reliable outcome.

## Security Follow-Ups

These concerns are explicitly deferred from v1 but must not be lost when
`tasks/recording/` is deleted. Any future security task pack should start here.

- **Prompt injection via device screen content.** The runtime agent receives
  device UI content via `clawperator snapshot`. A device showing adversarially
  crafted text could prompt the agent to take unintended actions (navigate away
  from the skill's declared scope, exfiltrate snapshot data, emit a misleading
  `SkillResult`). Mitigations to explore: constraining the agent's permitted
  Clawperator primitives at the harness level, sandboxing the agent process,
  or requiring explicit human approval for agent actions outside the declared
  checkpoint sequence.
- **Agent CLI trust boundary.** The thin harness spawns a configurable binary.
  A `skill.json` sourced from an untrusted skills registry could point
  `agent.cliPath` at an arbitrary executable. `runSkill` should validate that
  the resolved CLI path matches an allowlist or carries a signature before
  spawning it.
- **`SkillResult` frame spoofing.** If an agent can write arbitrary content to
  stdout, it could emit a fabricated `SkillResult` claiming verification it
  did not perform. The frame parser is the only defense today. Consider whether
  a witness log (exec envelopes from actual `clawperator exec` calls) should
  be cross-checked against declared checkpoints in a future hardening pass.

## Durable Follow-Up

This work feeds:

- `tasks/recording/skill-contract-declaration/` (W3): proving case
  consumes the agent-driven Solax orchestrated skill
- `tasks/recording/compare/` (W4): must handle non-deterministic
  agent paths; proving cases use agent-driven Solax runs
- `tasks/recording/skill-author-by-recording/` (W6): authoring output
  format is now `SKILL.md` + thin harness + `skill.json`
- `docs/skills/authoring.md`, `docs/skills/overview.md`
- `tasks/recording/video-draft.md` Scenes 7, 8, 10, 12
