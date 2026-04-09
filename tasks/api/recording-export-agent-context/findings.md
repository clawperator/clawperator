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
