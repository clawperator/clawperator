# Evals Bugs

This file records concrete issues discovered while running the `android-version`
eval on `evals/phase-4`. It is intended as a temporary bug log for follow-up
work on the eval harness and eval environment.

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

## 2. Gemini can reach the correct answer but still score `no_answer` if it splits the required answer marker across lines

- Scope: `android-version` eval, emulator `emulator-5554`, `runtime=published`
- Affected run:
  - `android-version-20260405-124743-985-21f8e2-gemini-auto-gemini--emulator-gemini-published`
- Observed behavior:
  - Saved result status was `no_answer`.
  - Ground truth was `15`.
  - Transcript shows Gemini navigated to the correct Settings page and identified Android version `15`.
- Verified cause:
  - The transcript contains `CLAWPERATOR_\\nEVAL_ANSWER: 15` instead of the required single-line
    marker `CLAWPERATOR_EVAL_ANSWER: 15`.
  - `extract_answer_from_transcript()` in `evals/harness/scorer.py` requires an exact
    single-line match via `^CLAWPERATOR_EVAL_ANSWER:\s*(\S.*?)\s*$`.
  - Because the marker token was broken by a newline, extraction returned `None`.
- Why this matters:
  - The model found the correct value but failed the output contract.
  - This is not adb cheating and not navigation failure.
  - Current scoring is intentionally strict, but this failure mode should be documented
    because it looks like a model miss unless the transcript is inspected.

## 3. Kimi published run wrote a stale `result.json` that disagreed with its transcript

- Scope: `android-version` eval, emulator `emulator-5554`, `runtime=published`
- Affected run:
  - `android-version-20260405-125036-295-d2d39f-kimi-kimi-code-ki-emulator-kimi-published`
- Observed behavior:
  - Saved `result.json` reported:
    - `status = "no_answer"`
    - `answer_extracted_raw = null`
    - `answer_normalized = null`
  - The transcript contains a valid final line:
    - `CLAWPERATOR_EVAL_ANSWER: 15`
- Verified cause:
  - Running the transcript back through `evals.harness.scorer.score(...)` produced:
    - `answer_extracted_raw = "15"`
    - `answer_normalized = "15"`
    - `answer_correct = True`
  - Running `evals/run_eval.py android-version --rescore <run_id>` rewrote the derived outcome
    as `PASS | rescored | 83.8s | answer=15`.
  - This means the saved `result.json` did not reflect the transcript that was persisted for the run.
- Why this matters:
  - This is a harness persistence or result-writing bug, not a model failure.
  - Operators can incorrectly conclude the model failed unless they manually rescore the run.

## 4. The anti-cheating rule is present and working for these runs

- Prompt check:
  - `evals/specs/android-version/prompt-public.md` explicitly says:
    - `Use only Clawperator commands for device interaction. Do not use adb shell commands or any other method to read the version.`
- Scoring check:
  - `evals/harness/scorer.py` checks transcripts for adb-shell usage with `detect_disallowed_tool(...)`.
- Observed runs:
  - All emulator runs inspected here recorded `used_adb = false`.
- Why this matters:
  - The failures above should not be misclassified as cheating.
  - The main issues are environment mismatch, answer-marker formatting, and stale result persistence.
