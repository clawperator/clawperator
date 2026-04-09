# Recording Export Findings

## Environment

- Repo: `<repo_root>`
- Branch: `codex/recording-export-agent-context-impl`
- Connected devices:
  - `<device_serial>` (physical)
  - `emulator-5554` (emulator)
- Live validation target: `emulator-5554`

## Commands Run

- `clawperator devices`
- `./gradlew :app:installDebug`
- `node apps/node/dist/cli/index.js doctor --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording start --session-id export-demo --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js open com.android.settings --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js back --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording stop --session-id export-demo --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording pull --session-id export-demo --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording export --input recordings/export-demo.ndjson --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js skills new com.example.recording.export-demo --summary "Author a skill from a recorded flow" --recording-context recordings/export-demo.export.json --device emulator-5554 --operator-package com.clawperator.operator.dev --json`

## Export Output Summary

- `recording start` and `recording stop` succeeded on `emulator-5554` using `com.clawperator.operator.dev`.
- `recording pull` wrote `recordings/export-demo.ndjson`.
- `recording export` wrote `recordings/export-demo.export.json`.
- Export wrapper output:
  - `eventCount: 2`
  - `packageTransitionCount: 1`
  - `byType: {"window_change": 2}`
- The exported file was then reused as skill-authoring context.

## Skill Scaffold Summary

- `skills new com.example.recording.export-demo --recording-context recordings/export-demo.export.json --json` succeeded.
- The scaffold returned a copied `recordingContextPath` inside the new skill folder.
- The generated `SKILL.md` contains a `## Recording Context` section before `Usage:`.
- The copied `recording-context.json` file is present in the skill folder and was referenced verbatim by the scaffold.

## Anomalies

- None observed during the live emulator run.

## Open Questions

- None at this point. The emulator had the debug Operator APK installed and the live flow completed successfully.

## Follow-up Improvements

- Stale recording recovery could be smoother.
  - What happened: during the live rerun on `emulator-5554`, `recording start` initially failed with `RECORDING_ALREADY_IN_PROGRESS` because an earlier session was still active on the device. I had to stop the leftover session manually before the flow could continue.
  - How to fix: add a lightweight `recording status` subcommand that reports the active session id, on-device file path, and whether the Operator app thinks the session is still open. If adding a new command is too much for this phase, improve the `recording start` failure payload so it always includes `sessionId`, `filePath`, and a short recovery hint such as "run `recording stop --session-id <id>` first". The stop path already exists, so the main gap is discovery and guidance.
  - Effort: `low` if this is just richer error text on the existing command, `med` if it becomes a dedicated status command with tests and docs.
- `recording pull` and `recording export` still require a manual handoff that is easy to mistype.
  - What happened: `recording pull` wrote the host NDJSON file successfully, but I still had to locate the pulled path and pass it to `recording export` by hand. That extra hop is easy to get wrong when sessions are named dynamically.
  - How to fix: make `recording pull` return the exact pulled file path in a top-level field every time, and add a convenience mode to `recording export` that accepts a pulled session directory instead of only a raw NDJSON file. The safest version is directory autodiscovery that picks the newest `*.ndjson` file in the directory and fails clearly if more than one candidate is present. That keeps the command deterministic while reducing manual path handling.
  - Effort: `low` for better output shaping only, `med` for directory autodiscovery plus tests, `high` if you also add a new combined pull-and-export workflow.
- The test suite should explicitly cover the stale-session path.
  - What exists now: the suite proves the happy path, the parser contract, and the export/scaffold round-trip, but it does not lock down `RECORDING_ALREADY_IN_PROGRESS`.
  - How to fix: add a focused CLI regression that starts a recording, attempts a second `recording start`, asserts the structured error payload, and verifies the existing session can be stopped and resumed cleanly afterward. If a full emulator integration test is too heavy, a unit test around the command handler response shape is still valuable, but the emulator-level path is the strongest signal because the bug surfaced there.
  - Effort: `low` for a handler-level regression test, `med` for a live emulator smoke that exercises the stale-session recovery end to end.
