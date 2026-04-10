# Skill Result Contract

## Executive Summary

Define a skill-level result contract so the brain can reason about a skill run
as more than an opaque stdout blob. This is the load-bearing interface change
that turns checkpoints, terminal verification, and compare output into
structured, consumable data instead of private script conventions.

Use a new Solax orchestrated skill as the first proving case, while preserving
the replay baseline separately.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1, P2, P3, P4 |
| Current / Next | P1 |
| Blockers | none |

## Goal

Introduce a skill-level `SkillResult` contract and create a new Solax
`-orchestrated` skill that emits it, so the brain can read goals,
checkpoints, terminal verification, and embedded exec outcomes directly.

## Why Now

Current code verified in the repo shows:

- `runSkill` returns `{ ok, output: string, exitCode }`
- skill stdout is the skill-to-brain channel
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
- create or retrofit
  `com.solaxcloud.starter.set-discharge-to-limit-orchestrated` to emit the
  new shape
- create test fixtures and tests in the Clawperator repo

## Out of Scope

- broad retrofit of all existing skills
- compare implementation itself
- new observation primitives unless the contract work proves they are necessary
- authoring a repo-local `skill-author-by-recording` skill

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/src/contracts/` | Clawperator repo | `SkillResult` contract |
| `apps/node/src/domain/skills/` | Clawperator repo | parsing, runtime, compatibility |
| `apps/node/src/test/` | Clawperator repo | fixtures and regression tests |
| `../clawperator-skills/` | Skills repo | Solax orchestrated proving case |
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
- The contract must carry:
  - `contractVersion` (semver-shaped string)
  - `skillId`
  - `goal`
  - `inputs`
  - `status` (`success` | `failed` | `indeterminate`)
  - `checkpoints` (ordered list of checkpoint records)
  - `terminalVerification` (or `null` if the skill does not declare one)
  - `execEnvelopes` (embedded `ResultEnvelope` records, in order)
  - `diagnostics` (optional structured hints, never required)
- Checkpoint evidence must not be a free-form `Record<string,string>` as the
  primary contract shape. P1 must choose a small typed union or another
  explicitly versioned structure so downstream consumers are not forced back
  into ad-hoc string parsing.
- `com.solaxcloud.starter.set-discharge-to-limit-orchestrated` is the first
  opt-in proving skill, not the template for every field.
- `runSkill` returns `skillResult: SkillResult | null` on the success shape
  and on the error shape. Legacy skills set it to `null`.
- The `clawperator skills run --json` CLI surface must include
  `skillResult` in its JSON output when present.
- Backward compatibility hard rule: existing skills that emit no frame must
  continue to return `ok: true` based on exit code, exactly as today, with
  `skillResult: null`. No legacy skill is required to opt in.
- W2 must not introduce a `SkillRunResult` shape that W3 will immediately
  need to break. If W2 adds new run-result discriminants or status fields,
  they must be designed to extend to W3's `indeterminate` outcome without
  another breaking reshape.
- W2 does not ship a shared skill-side authoring helper (there is no
  `checkpoint(...)` library or framework published by this task pack). The
  orchestrated Solax `run.js` emits the `SkillResult` frame with ordinary
  per-skill code: it keeps an in-script list of checkpoint records, appends
  to it as each step completes or fails, runs its terminal verification
  read-back, and writes one `[Clawperator-Skill-Result]` frame on stdout at
  the end of the run. Whether a skill uses a tiny local helper inside its
  own `scripts/` directory is a per-skill stylistic choice and is not a
  public contract. Any future cross-skill helper library is explicitly out
  of scope for W2 and must be proposed as a separate task pack if it is
  wanted later. This keeps the "agent authors the skill" story honest: the
  agent is writing the emission code itself from the recording evidence,
  not calling a magic framework that does it for them.

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
- Required vs optional fields. Recommend: `contractVersion`, `skillId`,
  `status`, `checkpoints` are required. `goal`, `inputs`,
  `terminalVerification`, `execEnvelopes`, `diagnostics` are optional in v1.
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
- a new Solax `-orchestrated` skill that emits `SkillResult`
- durable design notes in `docs/internal/design/` if the contract decisions
  are not self-evident from the code alone

## Durable Follow-Up

This work should later feed:

- `tasks/recording/skill-contract-declaration/`
- `tasks/recording/compare/`
- `docs/skills/authoring.md`
- future `skill.json` goal/verification declaration work
