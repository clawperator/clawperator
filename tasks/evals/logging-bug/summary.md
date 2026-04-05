# Evals Logging Bug

## Summary

The eval harness preserves only a generic `doctor_preflight_failed` reason when
`clawperator doctor --json` fails during preflight. It drops the structured
doctor diagnostics that would explain why the run is invalid.

## Observed Example

- Eval: `android-version`
- Runtime: `local-dev`
- Device: `emulator-5554`
- Affected runs:
  - `android-version-20260405-124727-939-eed564-gemini-auto-gemini--emulator-gemini-local`
  - `android-version-20260405-125036-338-5d2949-kimi-kimi-code-ki-emulator-kimi-local`

Observed eval artifact behavior:
- `failure_reason = "doctor_preflight_failed"`
- no agent turns
- no Clawperator commands issued

## Actual Underlying Diagnosis

The discarded `doctor` output contained the actionable cause:

- failure code: `VERSION_INCOMPATIBLE`
- CLI version: `0.5.3`
- installed package: `com.clawperator.operator.dev`
- installed APK version: `0.4.1-d`
- required action: rebuild or reinstall the matching debug APK from the same checkout

## Code Path

- `evals/harness/environment.py`
  - `preflight()` runs `clawperator doctor --json --device <serial>`
  - if `doctor` returns non-zero, it raises `EnvironmentError("doctor_preflight_failed")`
  - it does not persist the doctor JSON payload, failure code, evidence, or fix steps

## Why This Is a Bug

- The harness already detects the real problem, but the eval run artifacts hide it.
- Operators must manually rerun `clawperator doctor` to understand what failed.
- This makes an environment setup problem look like a generic eval failure.

## Expected Follow-up

Preflight failure artifacts should preserve enough doctor detail to explain the
invalid run directly, at minimum:

- doctor failure code
- summary/detail text
- key evidence fields such as CLI version, APK version, and operator package
- suggested fix steps when present
