# Skill Result Contract

## Executive Summary

Define a skill-level result contract so the brain can reason about a skill run
as more than an opaque stdout blob. This is the load-bearing interface change
that turns checkpoints, terminal verification, and compare output into
structured, consumable data instead of private script conventions.

W2 is intentionally emitter-agnostic. It defines the contract, teaches
`runSkill` to parse it, and retrofits the preserved replay baseline to emit it.
The agent-driven orchestrated proving skill moved to W2b.

## Status

| Item | Value |
| --- | --- |
| State | complete |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | P1, P2, P3, P4 |
| Remaining | none |
| Current / Next | complete; hand off to W2b / W3 / W4 dependents |
| Blockers | none |

## Goal

Introduce a skill-level `SkillResult` contract and make `runSkill` parse it so
the brain can read goals, checkpoints, terminal verification, and embedded exec
outcomes directly. Prove the contract on the preserved Solax replay baseline,
while leaving the agent-driven orchestrated proving skill to W2b.

## Why Now

Current code verified in the repo shows:

- `runSkill` returns a `SkillRunResult` on success with `ok`, `skillId`,
  `output`, `exitCode`, and `durationMs`
- failure results carry `ok: false`, a typed `code` and `message`, and
  optional raw `stdout` and `stderr`
- skill stdout is still the primary skill-to-brain channel
- `ResultEnvelope` is exec-level only
- skill scaffolding has no declared goal or verification contract

That is the actual brain/hand gap. Without a skill-level contract, reliability
work produces honest black boxes and compare work has to do forensic
reconstruction.

## In Scope

- define `SkillResult`
- decide how a skill emits it robustly
- make `runSkill` parse and return it compatibly with legacy skills
- embed exec-level evidence inside the skill-level result
- retrofit `com.solaxcloud.starter.set-discharge-to-limit-replay` to emit
  `SkillResult` as well, so the recording program does not ship a
  first-class replay skill that still speaks stdout
- create test fixtures and tests in the Clawperator repo

## Out of Scope

- broad retrofit of every unrelated legacy skill in one pass (those are on
  a separate migration path and are upgraded as they are touched)
- compare implementation itself
- new observation primitives unless the contract work proves they are necessary
- authoring a repo-local `skill-author-by-recording` skill

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/src/contracts/` | Clawperator repo | `SkillResult` contract |
| `apps/node/src/domain/skills/` | Clawperator repo | parsing, runtime, compatibility |
| `apps/node/src/test/` | Clawperator repo | fixtures and regression tests |
| `../clawperator-skills/` | Skills repo | Solax replay proving case for contract emission |
| `tasks/recording/skill-result-contract/` | Clawperator repo | temporary execution contract |

## Source Of Truth

| Area | Source |
| --- | --- |
| Exec envelope | `apps/node/src/contracts/result.ts` |
| Current skill runtime | `apps/node/src/domain/skills/runSkill.ts` |
| Current authoring contract | `docs/skills/authoring.md` |
| Brain/hand framing | `tasks/recording/brain-hand-contract/problem-definition.md` |

## Decision Rules

- Introduce a new skill-level contract instead of overloading `ResultEnvelope`.
- Keep `runSkill` backward compatible for legacy skills that emit plain stdout.
- Use an explicit framed skill result over "best effort parse last stdout
  line". Frames are unambiguous and align with the existing
  `[Clawperator-Result]` envelope idiom.
- The contract defines these fields. The "Required vs optional fields" decision
  below is authoritative for presence rules, and those rules apply separately
  to the emitted frame and the parsed or injected `SkillResult` returned by
  `runSkill`.
  - `contractVersion` (semver-shaped string)
  - `skillId`
  - `source` (required on the parsed or injected `SkillResult`; omitted from
    the emitted frame and injected by `runSkill`; see below)
  - `goal` (optional in v1; see "Required vs optional fields")
  - `inputs` (optional in v1; see "Required vs optional fields")
  - `status` (`success` | `failed` | `indeterminate`)
  - `checkpoints` (ordered list of checkpoint records)
  - `terminalVerification` (optional in v1; may be `null` when present)
  - `execEnvelopes` (optional embedded `ResultEnvelope` records, in order)
  - `diagnostics` (optional structured hints, never required)
- `source` is a required field that carries the execution provenance of the
  parsed or injected result. Shape: `{ kind: "agent"; agentCli: string } | {
  kind: "script" }`. This field is **injected by `runSkill`** when it parses
  the emitted frame, not by the skill or agent itself. For agent-driven
  skills, `runSkill` reads the `agent.cli` value from `skill.json` and sets
  `source: { kind: "agent", agentCli: <cli> }`. For scripted skills, it sets
  `source: { kind: "script" }`. The skill-side emitter does not include
  `source` in the frame; `runSkill` is the single authority for this field.
  Rationale: `source` is infrastructure metadata. The runtime agent knows what
  device actions to take, not which CLI binary it is running inside. Having
  `runSkill` inject `source` keeps SKILL.md emission rules clean and guarantees
  accuracy. It also keeps the persisted `clawperator skills run --json`
  wrapper self-describing as a portable artifact: any consumer reading a
  `.skills-run.json` file can inspect `skillResult.source` to determine the
  emitter kind without needing the skills registry.
- Checkpoint evidence must not be a free-form `Record<string,string>` as the
  primary contract shape. P1 must choose a small typed union or another
  explicitly versioned structure so downstream consumers are not forced back
  into ad-hoc string parsing.
- Emitting `SkillResult` is the expected default for every skill authored
  after W2 ships, regardless of whether the skill is a `-replay` or
  `-orchestrated` variant. The contract is the common return channel all
  new skills use to talk to the brain. It is not a property reserved for
  orchestrated skills.
- `runSkill` returns `skillResult: SkillResult | null` on both the success
  and error shape. `null` is reserved for legacy skills that predate the
  contract, not for replay skills as a class.
- The `clawperator skills run --json` CLI surface must include
  `skillResult` in its JSON output when present.
- Backward compatibility hard rule (legacy only): existing skills that
  predate this contract and emit no frame must continue to return
  `ok: true` based on exit code, exactly as today, with
  `skillResult: null`. Those skills are on an explicit migration path and
  should be upgraded to emit `SkillResult` as they are touched. This
  compatibility lane exists for legacy skills; it is not a category of
  skill any new authoring work should use.
- Required Solax retrofit scope: in this workstream,
  `com.solaxcloud.starter.set-discharge-to-limit-replay` ends up emitting
  `SkillResult`. W2b separately creates the agent-driven
  `...-orchestrated` sibling and makes it emit the same contract. Keeping that
  split explicit is how W2 stays emitter-agnostic.
- W2 must not introduce a `SkillRunResult` shape that W3 will immediately
  need to break. If W2 adds new run-result discriminants or status fields,
  they must be designed to extend to W3's `indeterminate` outcome without
  another breaking reshape.
- W2 does not ship a shared skill-side authoring helper. Replay skills may
  emit the `SkillResult` frame with ordinary per-skill code, and W2b may
  later decide how agent-driven orchestrated skills emit the same frame via
  their SKILL.md program. Any future cross-skill helper library is explicitly
  out of scope for W2 and must be proposed as a separate task pack if it is
  wanted later.

## Required Decisions In P1

P1 must commit to all of these. None of them may be deferred to
implementation:

- Frame marker string. Recommend `[Clawperator-Skill-Result]` to mirror
  `[Clawperator-Result]`.
- Frame placement: single contiguous JSON document immediately after the
  marker on its own line, terminated by end-of-stream or a closing marker
  line. Recommend single-line JSON for the v1 frame to keep the parser
  trivial.
- Behavior on multiple frames in one stdout stream: reject as malformed.
- Behavior on a frame whose `contractVersion` major matches but minor is
  newer: accept, log unknown fields as a warning, do not reject. Behavior
  on unknown major: reject with a typed parse error.
- Required vs optional fields. Committed: `contractVersion`, `skillId`,
  `source`, `status`, `checkpoints` are required. `goal`, `inputs`,
  `terminalVerification`, `execEnvelopes`, `diagnostics` are optional in v1.
  `source` is required for all `SkillResult` documents because it is injected
  by `runSkill` at parse time, not by the emitter - its presence is guaranteed
  for any result `runSkill` returns.
- `source` injection. Committed: `runSkill` is the single authority for the
  `source` field. It injects `source: { kind: "agent", agentCli: <cli> }` for
  agent-driven skills and `source: { kind: "script" }` for scripted skills
  after parsing the emitted frame. If the emitted frame contains a `source`
  field, `runSkill` must reject the result as malformed rather than silently
  accepting a self-reported value that could differ from the known execution
  context.
- Status of the existing `expectContains` mechanism. Recommend: keep it for
  backward compatibility in v1 but document that contract-driven
  verification is the preferred path. Plan its deprecation in a follow-up,
  not in this task.
- Checkpoint evidence shape. Recommend a typed union with a `kind`
  discriminant plus a small payload, and optional references into
  `execEnvelopes` by index when the evidence comes from an underlying
  `ResultEnvelope`. Do not leave this as an implementation detail in the
  Solax retrofit.
- Runtime-state signaling policy. P1 must decide whether `runtime_poisoned`
  and `runtime_unavailable` are represented through a typed
  `diagnostics.runtimeState` slot, another explicit contract field, or are
  intentionally downgraded to `upstream_failure` in v1. Compare must not
  guess these classes from raw stderr text.

## Failure Modes To Prevent

- inventing a contract too abstract to retrofit onto a real skill
- breaking legacy skills while adding structured results
- extending exec-level `ResultEnvelope` to carry skill semantics
- forcing compare to invent a second overlapping trace format

## Output Contract

This task should produce:

- a defined `SkillResult` contract
- `runSkill` support for parsing and returning it
- test coverage using local fixtures only
- the preserved Solax replay baseline emitting `SkillResult`
- durable design notes in `docs/internal/design/` if the contract decisions
  are not self-evident from the code alone

## Durable Follow-Up

This work should later feed:

- `tasks/recording/agent-driven-skills/`
- `tasks/recording/skill-contract-declaration/`
- `tasks/recording/compare/`
- `docs/skills/authoring.md`
- future `skill.json` goal/verification declaration work
