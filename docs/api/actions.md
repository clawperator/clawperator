# Actions

## Purpose

Reference for canonical `ExecutionAction.type` values, required parameters, and the Node-guaranteed result shape.

## General Rules

- The canonical public action names are validated in `apps/node/src/domain/executions/validateExecution.ts`.
- Input aliases such as `tap`, `read`, `snapshot`, `screenshot`, `key_press`, and `type_text` are normalized before validation. Use canonical names in stored payloads.
- Selector fields are documented on [Selectors](selectors.md). This page names selector-bearing parameters but does not redefine selector syntax.
- `StepResult.data` is always a `Record<string, string>`. For most actions, Node does not guarantee extra success keys beyond that map existing.

## Action Reference

| Action type | Required params | Optional params | Step result data on success | Common failure modes |
| --- | --- | --- | --- | --- |
| `click` | One of `matcher` or `coordinate` | `clickType` (`long_click`, `focus`) | No Node-guaranteed success keys | `NODE_NOT_FOUND`, `NODE_NOT_CLICKABLE`, `GESTURE_FAILED`, validation failure if both `matcher` and `coordinate` are set |
| `scroll` | None | `direction`, `container`, `distanceRatio`, `settleDelayMs` | No Node-guaranteed success keys | `CONTAINER_NOT_FOUND`, `CONTAINER_NOT_SCROLLABLE`, `GESTURE_FAILED`, invalid direction |
| `scroll_until` | None unless `clickAfter = true`, then `matcher` is required | `direction`, `matcher`, `container`, `clickAfter`, `distanceRatio`, `settleDelayMs`, `maxScrolls`, `maxDurationMs`, `noPositionChangeThreshold`, `findFirstScrollableChild` | No Node-guaranteed success keys | `NODE_NOT_FOUND`, container failures, invalid limits or direction |
| `scroll_and_click` | `matcher` | `direction`, `container`, `clickAfter` | No Node-guaranteed success keys | Same as `scroll_until`, plus click failure after the target is found |
| `read_text` | `matcher` | `all`, `container`, `validator` | No Node-guaranteed success keys | `NODE_NOT_FOUND`, validation failure if `validator = "regex"` and `validatorPattern` is missing or invalid |
| `read_key_value_pair` | `labelMatcher` | `all` | No Node-guaranteed success keys | Validation failure when `labelMatcher` is missing |
| `enter_text` | `matcher`, non-empty `text` | `submit`, `clear` | No Node-guaranteed success keys | `NODE_NOT_FOUND`, validation failure for blank text |
| `press_key` | `key` | None | No Node-guaranteed success keys | Validation failure unless key is `back`, `home`, or `recents` |
| `wait_for_node` | `matcher` | `timeoutMs` | No Node-guaranteed success keys | `NODE_NOT_FOUND` on timeout, validation failure for missing matcher |
| `wait_for_navigation` | At least one of `expectedPackage` or `expectedNode`, plus positive `timeoutMs` | None | No Node-guaranteed success keys | Validation failure for missing target or timeout, timeout-driven runtime failure |
| `snapshot_ui` | None | None | `text` with the XML hierarchy when extraction succeeds; Node may also add `warn` | `SNAPSHOT_EXTRACTION_FAILED`, `RESULT_ENVELOPE_TIMEOUT` |
| `take_screenshot` | None | `path` | `path` to the captured screenshot file | Validation failure for blank `path`, timeout or dispatch failures |
| `close_app` | `applicationId` | None | `application_id` after successful Node pre-flight normalization | Validation failure for missing `applicationId`, adb force-stop failure |
| `sleep` | `durationMs >= 0` | None | No Node-guaranteed success keys | Validation failure for negative or oversized duration |
| `open_app` | `applicationId` | None | No Node-guaranteed success keys | Validation failure for missing `applicationId`, app launch failure |
| `open_uri` | `uri` | None | No Node-guaranteed success keys | Validation failure for missing or blank `uri` |
| `start_recording` | None | `sessionId` | No Node-guaranteed success keys | Recording-state errors such as `RECORDING_ALREADY_IN_PROGRESS` |
| `stop_recording` | None | `sessionId` | No Node-guaranteed success keys | Recording-state errors such as `RECORDING_NOT_IN_PROGRESS` |

## Canonical CLI To Action Mapping

| CLI command | Action type |
| --- | --- |
| `click` | `click` |
| `type` | `enter_text` |
| `read` | `read_text` |
| `read-value` | `read_key_value_pair` |
| `wait` | `wait_for_node` |
| `wait-for-nav` | `wait_for_navigation` |
| `snapshot` | `snapshot_ui` |
| `screenshot` | `take_screenshot` |
| `close` | `close_app` |
| `sleep` | `sleep` |
| `open` | `open_app` or `open_uri` |
| `press` / `back` | `press_key` |
| `scroll` | `scroll` |
| `scroll-until` | `scroll_until` or `scroll_and_click` |

## Notes On Result Data

- `snapshot_ui` is the only action whose success payload is post-processed into a required `data.text` XML string.
- `take_screenshot` is normalized to include `data.path` after the screenshot is captured.
- `close_app` is normalized to `data.application_id` when the adb pre-flight force-stop succeeds even if Android reports `UNSUPPORTED_RUNTIME_CLOSE`.
- For all other actions, treat `data` as action-specific runtime output rather than a statically typed contract.

## Related Pages

- [Selectors](selectors.md)
- [Errors](errors.md)
- [Snapshot Format](snapshot.md)
