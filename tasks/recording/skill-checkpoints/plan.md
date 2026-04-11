# Skill Checkpoints

## Executive Summary

Retrofit the current Solax proving skill with explicit integrity guarantees and
preserve it as the durable `-replay` baseline. Define a small, durable pattern
for non-trivial replay skills: do not report success unless the skill verifies
the intended terminal app state. This is separate from recording compare.
Compare is diagnostic; this task is about reliability.

Use `com.solaxcloud.starter.set-discharge-to-limit-replay` as the replay
baseline and capture the minimal conventions that should later inform broader
skill authoring guidance.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 3 |
| Total phases | 4 |
| Completed | P0 |
| Remaining | P1, P2, P3 |
| Current / Next | P1 |
| Blockers | none |

## Goal

Make the Solax replay skill truthful and checkpointed enough to serve as a
trustworthy baseline and proving case for later compare and orchestrated-skill
work.

## Why Now

The current Solax `v0` works on the target device, but it still has integrity
gaps:

- it can treat stdout from a failed exec as success
- it does not verify terminal persisted state before returning success
- it uses two unscoped `Save` clicks in sequence

These are cheap, high-value fixes and should land before compare depends on
Solax as a proof target.

## In Scope

- fix silent-success behavior in the Solax skill
- preserve/rename the current Solax skill as
  `com.solaxcloud.starter.set-discharge-to-limit-replay`
- provide an explicit compatibility path for callers that still use the
  unsuffixed `com.solaxcloud.starter.set-discharge-to-limit` id during the
  transition
- prove that a forced sub-exec failure reaches `runSkill` as failure instead of
  being flattened into success
- add terminal-state verification for `Discharge to <target>%`
- tighten the double-`Save` behavior so the second click cannot accidentally hit
  the same node without evidence the UI advanced
- document the checkpoint/state-verification expectations for non-trivial skills
- capture any Solax-specific caveats that should remain local to the skill

## Out of Scope

- generic recording-vs-run compare behavior
- broad retrofit of all existing skills
- replacing all coordinate taps in the Solax skill unless a clearly superior
  approach proves out cheaply

## Existing Artifact Scope

Primary work is expected in:

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/`
- `docs/skills/authoring.md`
- potentially `tasks/recording/demo/findings.md` until durable docs are updated

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `../clawperator-skills/` | Skills repo | Solax implementation and live proof |
| `docs/skills/` | Clawperator repo | Durable authoring guidance |
| `tasks/recording/skill-checkpoints/` | Clawperator repo | Temporary execution contract |

## Source Of Truth

| Area | Source |
| --- | --- |
| Solax replay skill behavior | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/` |
| Current recording learnings | `tasks/recording/demo/findings.md` |
| Skill authoring expectations | `docs/skills/authoring.md` |

## Decision Rules

- Non-trivial skills must not return success unless the intended terminal state
  is verified.
- Underlying exec failure must remain visible to the caller as failure.
- Use the cheapest reliable proof path first. Prefer reading the persisted row
  over adding more speculative complexity.
- Device-specific coordinates are acceptable for this proving skill if clearly
  documented and proven on-device.

## Failure Modes To Prevent

- false success when exec failed
- sub-exec failure that reaches the brain as `ok:true`
- success without persisted-state verification
- mistaken second `Save` click against the same node
- documenting Solax-specific hacks as if they were generic authoring guidance

## Output Contract

This task should produce:

- a Solax skill that exits truthfully
- the current replay-style Solax behavior preserved under the explicit
  `-replay` name
- a documented migration or compatibility decision for the old unsuffixed
  Solax skill id
- proof that forced sub-exec failure propagates to the caller as failure
- explicit terminal-state verification for the requested discharge value
- a documented checkpoint/reliability pattern suitable for future skill
  authoring guidance

## Durable Follow-Up

Graduate the generalizable parts of this work into `docs/skills/authoring.md`.
Keep Samsung/Solax-specific details in the skill docs.
