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

- Target skill id: `com.solaxcloud.starter.set-discharge-to-limit`
- Skill path:
- Validation status:

## Findings

- Recording:
  - live prerequisite check found an operator variant mismatch on the Samsung
    device:
    expected `com.clawperator.operator.dev`, installed
    `com.clawperator.operator`
  - Solax app package is installed on the device:
    `com.solaxcloud.starter`
  - installing the debug APK with `./gradlew app:installDebug` succeeded
  - adb-side permission bootstrap with
    `grant-device-permissions --operator-package com.clawperator.operator.dev`
    succeeded
- Export artifact:
- Selector or control-flow notes:
- Validation notes:
  - `clawperator doctor` passed overall device readiness but warned on the
    operator package variant mismatch
  - after installing the debug APK and granting permissions, `clawperator
    doctor --operator-package com.clawperator.operator.dev` passed including a
    successful handshake
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
  - chosen: `set-discharge-to-limit`
  - full skill id: `com.solaxcloud.starter.set-discharge-to-limit`
- Is snapshot omission sufficient:
- Any app-specific constraints that should not be generalized:
