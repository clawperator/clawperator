# Known Issues

## Operator action logs may include sensitive UI text

- File: `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- Current behavior: `step_success` logs include `result.data` for every action, including `read_text`.
- Risk: user-visible text (for example account or device data) can be written to logcat.
- Follow-up: add redaction/safe logging mode for `read_text` data once current operator recipe debugging is complete.
