# Known Issues

## Container auto-detection on nested-scroll layouts

- Current behavior: When `scroll` or `scroll_until` is called without an explicit `container`, the runtime picks the first visible `scrollable="true"` node.
- Risk: On nested-scroll screens (e.g. Samsung Settings), this may select an outer `ScrollView` wrapper instead of the actual content list (`RecyclerView`), leading to misleading scroll outcomes or false confidence in tests.
- Workaround: The public docs advise agents to prefer explicit `container.resourceId` matchers on complex screens.
- Follow-up: Improve automatic container resolution to prefer deeper nested scrollables or common content-list classes over generic wrappers when both are visible.

## Operator action logs may include sensitive UI text

- File: `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- Current behavior: `step_success` logs include `result.data` for every action, including `read_text`.
- Risk: user-visible text (for example account or device data) can be written to logcat.
- Follow-up: add redaction/safe logging mode for `read_text` data once current operator recipe debugging is complete.
