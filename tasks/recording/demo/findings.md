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
- Session id: `solax-set-discharge-to-limit-20260410-135211`
- Recording directory:
  `../clawperator-skills/recordings/solax-set-discharge-to-limit`
- NDJSON path:
  `../clawperator-skills/recordings/solax-set-discharge-to-limit/solax-set-discharge-to-limit-20260410-135211.ndjson`
- Export path:
  `../clawperator-skills/recordings/solax-set-discharge-to-limit/solax-set-discharge-to-limit-20260410-135211.export.json`
- Steps path:
  `../clawperator-skills/recordings/solax-set-discharge-to-limit/solax-set-discharge-to-limit-20260410-135211.steps.json`

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
  - manual recording completed successfully with `eventCount=27`
- Export artifact:
  - export succeeded with `eventCount=27`, `packageTransitionCount=8`
  - by-type counts from the export:
    `window_change=11`, `scroll=6`, `click=8`, `text_change=2`
- Selector or control-flow notes:
  - parsed step log shows the following high-signal flow:
    `open_app -> Intelligence -> ON -> discharge row -> input field -> Confirm -> Save`
  - parsed text capture included:
    `Discharge to 41%`
  - parsed text-entry selector included:
    `resourceId=van-field-1-input`
- Validation notes:
  - `clawperator doctor` passed overall device readiness but warned on the
    operator package variant mismatch
  - after installing the debug APK and granting permissions, `clawperator
    doctor --operator-package com.clawperator.operator.dev` passed including a
    successful handshake
  - `record parse` emitted six warnings that scroll events were dropped in v1
- Docs or workflow gaps:
  - `docs/api/recording.md` and `docs/skills/authoring.md` match the current
    flow we plan to use:
    `record start -> record stop -> record pull -> recording export -> skills new --recording-context`.
  - `record parse` remains useful for inspection, but not as the scaffold input.
  - pull, export, and parse should be treated as sequential steps in practice;
    running export or parse before pull completes can create false failure
    noise
- Durable guidance to migrate into `skill-author-by-recording`:
  - Prefer proving the app-specific skill first, then distilling the reusable
    workflow from the real implementation rather than guessing abstractions up
    front.
  - Do not parallelize dependent artifact steps after recording stop. Pull
    first, then export, then parse or inspect.

## Open Questions

- Exact Solax intent name:
  - chosen: `set-discharge-to-limit`
  - full skill id: `com.solaxcloud.starter.set-discharge-to-limit`
- Is snapshot omission sufficient:
- Any app-specific constraints that should not be generalized:
