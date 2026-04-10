# Recording Demo Findings

## Purpose

Capture concrete findings while creating a real Solax skill from a live manual
recording. This file is temporary. Durable workflow guidance should move into
`.agents/skills/skill-author-by-recording/` or the main docs once proven.

Populate this file as execution progresses. Keep only information that helps
the agent finish the work or distill durable follow-up guidance.

## Recording Run

- Date: 2026-04-10
- Device: Samsung Galaxy physical device (`SM_S901E`)
- Operator package: `com.clawperator.operator.dev`
- Session id:
- Recording directory:
- NDJSON path:
- Export path:
- Steps path:

## Skill Scaffolding

- Target skill id:
- Skill path:
- Validation status:

## Findings

- Recording:
- Export artifact:
- Selector or control-flow notes:
- Validation notes:
- Docs or workflow gaps:
  - `docs/api/recording.md` and `docs/skills/authoring.md` match the current
    flow we plan to use:
    `record start -> record stop -> record pull -> recording export -> skills new --recording-context`.
  - `record parse` remains useful for inspection, but not as the scaffold input.
- Durable guidance to migrate into `skill-author-by-recording`:
  - Prefer proving the app-specific skill first, then distilling the reusable
    workflow from the real implementation rather than guessing abstractions up
    front.

## Open Questions

- Exact Solax intent name:
  - existing namespace confirmed:
    `com.solaxcloud.starter.get-battery`
- Is snapshot omission sufficient:
- Any app-specific constraints that should not be generalized:
