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
  `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit`
- Validation status:
  - `skills validate` passes
  - `skills run ... -- 40` succeeded on-device

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
  - final successful runtime path on the Samsung device was:
    `Intelligence -> Peak Export card -> Device Discharging action card -> Discharge to row -> dialog input -> Confirm -> Save`
  - the first reliable implementation used coordinate clicks for the two
    container-card taps and selector-driven actions for the remaining row,
    dialog, and save steps
  - a later re-run showed the original `v0` skill was not actually reliable:
    when asked to move from `40` to `39`, the UI still showed `Discharge to
    40%` after the run
  - root cause was the dialog input: the Solax `Discharge to` field lives in a
    WebView-backed `android.widget.EditText` (`resourceId=van-field-1-input`),
    and Clawperator `enter_text` reported success without producing the app-side
    change Solax required for persistence
  - the value only persisted when the skill used device key events:
    `DEL`, `DEL`, `input text <value>`, then `KEYCODE_ENTER`, followed by
    `Confirm`, top-page `Save`, and outer-page `Save`
  - removing the final `snapshot_ui` from the skill avoided the recurring
    terminal-envelope timeout at the end of otherwise successful runs
  - after forcing `com.clawperator.operator.dev` to stop during debugging, the
    accessibility service became unavailable and had to be re-enabled with adb
    secure settings before Clawperator commands could handshake again
  - verified end-to-end after the patch:
    the skill successfully set the value to `40`, and then successfully set it
    back to `39`; both were confirmed by reopening the Solax flow and reading
    the persisted `Discharge to` row from the UI
- Docs or workflow gaps:
  - `docs/api/recording.md` and `docs/skills/authoring.md` match the current
    flow we plan to use:
    `record start -> record stop -> record pull -> recording export -> skills new --recording-context`.
  - `record parse` remains useful for inspection, but not as the scaffold input.
  - pull, export, and parse should be treated as sequential steps in practice;
    running export or parse before pull completes can create false failure
    noise
  - the recording parse output was useful, but not sufficient by itself to
    derive the working skill flow. Live screenshots and UI dumps were needed to
    identify the real clickable containers and the extra `Device Discharging`
    step between `Peak Export` and `Discharge to`
- Durable guidance to migrate into `skill-author-by-recording`:
  - Prefer proving the app-specific skill first, then distilling the reusable
    workflow from the real implementation rather than guessing abstractions up
    front.
  - Do not parallelize dependent artifact steps after recording stop. Pull
    first, then export, then parse or inspect.
  - when a recorded tap lands on blank space beside a label, do not assume the
    label text itself is the clickable node. Confirm with a live UI dump or
    screenshot, and use a container-aware strategy or coordinates when needed
  - for hybrid or WebView-backed inputs, treat recording-derived text-entry
    selectors as only a starting point. Validate that the host app actually
    persists the changed value, not just that the field visually accepted text
  - if a command times out and later commands log
    `waiting_for_active_command=true`, clear the stuck operator state before
    continuing or the next run may never actually start

## Open Questions

- Exact Solax intent name:
  - chosen: `set-discharge-to-limit`
  - full skill id: `com.solaxcloud.starter.set-discharge-to-limit`
- Is snapshot omission sufficient:
- Any app-specific constraints that should not be generalized:
