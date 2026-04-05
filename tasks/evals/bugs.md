# Evals Bugs

This file records open issues discovered while running the `android-version`
eval on `evals/phase-4`. Resolved harness bugs and completed verification notes
have been removed so the file only tracks remaining follow-up.

## 1. Eval preflight logging drops the doctor failure details that would explain why a run is invalid

- Scope: `android-version` eval preflight failures
- Affected runs:
  - `android-version-20260405-124727-939-eed564-gemini-auto-gemini--emulator-gemini-local`
  - `android-version-20260405-125036-338-5d2949-kimi-kimi-code-ki-emulator-kimi-local`
- Observed behavior:
  - Both runs failed immediately with `failure_reason = "doctor_preflight_failed"`.
  - No agent turns executed.
  - No Clawperator commands were issued.
- Verified cause:
  - `evals/harness/environment.py` runs `clawperator doctor --json --device <serial>`.
  - If doctor returns non-zero, `preflight()` raises `EnvironmentError("doctor_preflight_failed")`
    without preserving the doctor JSON payload, failure code, or fix steps.
  - In the concrete emulator failure here, the discarded doctor payload contained the actual diagnosis:
    - `VERSION_INCOMPATIBLE`
    - CLI version `0.5.3`
    - installed `.dev` APK version `0.4.1-d`
    - guidance to rebuild or reinstall the matching debug APK
- Why this matters:
  - The eval harness detected the real issue, but the saved run artifacts did not explain it.
  - Operators only see a generic preflight failure unless they manually rerun `clawperator doctor`.
  - This slows debugging and makes an environment/setup problem look like an eval failure.
