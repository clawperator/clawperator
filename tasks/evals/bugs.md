# Evals Bugs

This file records open issues discovered while running the `android-version`
eval on `evals/phase-4`. Resolved harness bugs and completed verification notes
have been removed so the file only tracks remaining follow-up.

## 1. Emulator `local-dev` runs fail in doctor preflight due to CLI/APK version mismatch

- Scope: `android-version` eval, emulator `emulator-5554`, `runtime=local-dev`
- Affected runs:
  - `android-version-20260405-124727-939-eed564-gemini-auto-gemini--emulator-gemini-local`
  - `android-version-20260405-125036-338-5d2949-kimi-kimi-code-ki-emulator-kimi-local`
- Observed behavior:
  - Both runs failed immediately with `failure_reason = "doctor_preflight_failed"`.
  - No agent turns executed.
  - No Clawperator commands were issued.
- Verified cause:
  - Running `node apps/node/dist/cli/index.js doctor --device emulator-5554 --operator-package com.clawperator.operator.dev`
    failed with `VERSION_INCOMPATIBLE`.
  - The branch-local CLI reported version `0.5.3`.
  - The emulator had `com.clawperator.operator.dev` APK version `0.4.1-d` installed.
- Why this matters:
  - These runs do not measure model behavior.
  - They are invalid comparisons until the emulator debug APK is rebuilt and reinstalled
    from the same checkout as the branch-local CLI.
