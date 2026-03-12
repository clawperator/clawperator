/**
 * Scroll action result types for agent consumption.
 */

/**
 * Outcome of a single `scroll` action.
 *
 * - `moved`        - gesture dispatched and content moved (leading-child signature changed)
 * - `edge_reached` - gesture dispatched but signature unchanged; container is at its limit
 * - `gesture_failed` - accessibility service rejected the gesture
 *
 * `edge_reached` is not an error. It is the expected terminal state when paginating
 * a finite list and should be treated as success in agent loops.
 */
export type ScrollOutcome = "moved" | "edge_reached" | "gesture_failed";

/**
 * Reason a `scroll_until` loop terminated.
 *
 * - `EDGE_REACHED`          - content ended naturally (finite list)
 * - `MAX_SCROLLS_REACHED`   - hit the maxScrolls cap (expected on infinite feeds)
 * - `MAX_DURATION_REACHED`  - hit the maxDurationMs cap
 * - `NO_POSITION_CHANGE`    - repeated scrolls produced no movement (stalled or bounced)
 * - `TARGET_FOUND`          - scroll_until with until: "ELEMENT_VISIBLE" found the target
 * - `CONTAINER_NOT_FOUND`   - container resolution failed before any scroll
 * - `CONTAINER_NOT_SCROLLABLE` - resolved container is not scrollable
 */
export type ScrollTerminationReason =
  | "EDGE_REACHED"
  | "MAX_SCROLLS_REACHED"
  | "MAX_DURATION_REACHED"
  | "NO_POSITION_CHANGE"
  | "TARGET_FOUND"
  | "CONTAINER_NOT_FOUND"
  | "CONTAINER_NOT_SCROLLABLE";
