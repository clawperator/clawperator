# Recording Compare

## Executive Summary

Add a recording-versus-run comparison workflow that lets an agent identify the
first meaningful divergence between a deterministic skill run and a recorded
baseline. This is cross-repo work: Clawperator owns trace emission and compare
behavior, while `../clawperator-skills` provides the proving skill and runtime
validation target.

Start by proving the design against
`com.solaxcloud.starter.set-discharge-to-limit`, then generalize only the parts
that survive that live exercise.

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

Make it possible to compare a skill run against recording-derived expectations
so an agent can say where the run first diverged and why.

## Why Now

The Solax `v0` work showed two truths at once:

- deterministic replay remains essential for some app flows
- current skill authoring lacks a structured way to compare runtime behavior to
  a recording baseline

Without comparison support, agents must infer divergence from screenshots,
ad-hoc UI dumps, and logs. That is slow, fragile, and difficult to generalize.

## In Scope

- define the compare model for deterministic replay validation
- emit or assemble a normalized run trace from skill execution
- compare run trace checkpoints against a recording-export baseline
- surface the first meaningful divergence in machine-readable and human-usable
  form
- prove the model with the Solax discharge-limit skill
- document what belongs in Clawperator versus the skills repo

## Out of Scope

- fully autonomous recovery or planning from divergence
- generic “brain” architecture changes beyond what compare support requires
- strict raw-event replay matching
- retrofitting every existing skill in one pass

## Existing Artifact Scope

Edits are expected in:

- `apps/node/` for run-trace and compare behavior
- `docs/api/` or `docs/skills/` for durable documentation
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit`
  as the proving skill

The existing recording demo task files remain in scope only as temporary
working notes. Durable guidance must migrate out of `tasks/`.

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/` | Clawperator repo | Trace emission, compare CLI/API, contracts |
| `docs/` | Clawperator repo | Durable user/developer docs |
| `../clawperator-skills/` | Skills repo | Proving skill, validation target, adoption feedback |
| `tasks/recording-compare/` | Clawperator repo | Temporary execution contract for this work |

## Source Of Truth

| Area | Source |
| --- | --- |
| Recording export schema | `apps/node/src/domain/recording/exportRecording.ts` |
| Current recording workflow | `docs/api/recording.md` |
| Skill scaffolding behavior | `docs/skills/authoring.md` and `apps/node/src/domain/skills/scaffoldSkill.ts` |
| Skill runtime contract | `apps/node/src/cli/registry.ts`, `apps/node/src/contracts/` |
| Solax proving behavior | live device validation plus `../clawperator-skills` |

## Deterministic Versus Judgment

Deterministic:

- trace capture shape
- normalized checkpoint extraction
- compare output schema
- divergence ordering rules

Judgment:

- choosing which checkpoints are meaningful
- deciding what baseline evidence is stable enough to compare
- deciding which Solax-specific findings generalize

## Decision Rules

- Compare normalized checkpoints, not raw event streams.
- Prefer recording export as baseline evidence over parsed step log alone.
- Treat the first divergence as the primary diagnostic output.
- Do not claim replay parity unless the final persisted app state is verified.
- Generalize only after the Solax proving case works end to end.

## Failure Modes To Prevent

- building a compare system that depends on lossy `record parse` output alone
- comparing timestamps or raw event counts that are not stable enough to matter
- shipping a trace format that is too thin to explain divergence
- overfitting compare logic to Solax-specific WebView behavior
- leaving durable guidance trapped in `tasks/`

## Output Contract

This task should produce:

- a defined run-trace artifact shape
- a compare command or equivalent compare-capable workflow
- divergence output that identifies:
  - baseline checkpoint
  - actual checkpoint
  - first divergence point
  - evidence summary
  - likely class of mismatch
- Solax validation showing the compare output is useful in practice
- durable docs updates

## Idempotency

Trace and compare outputs may vary in timestamps and incidental metadata.
Checkpoint identities, divergence ordering, and final-state conclusions should
remain stable across reruns of the same deterministic flow.

## Durable Follow-Up

Before deleting this task pack, move durable guidance into:

- `docs/api/recording.md`
- `docs/skills/authoring.md`
- any repo-local skill guidance needed for `.agents/skills/skill-author-by-recording`

