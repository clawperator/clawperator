/**
 * Scroll action result types for agent consumption.
 */

/** Observed progress only. edge_reached is reserved for instrumented platform boundaries. */
export type ScrollOutcome = "moved" | "no_movement" | "unknown" | "container_lost" | "edge_reached" | "gesture_failed";

export interface ScrollProgress {
  beforeSignature: string | null;
  afterSignature: string | null;
  comparable: boolean;
  reason: string;
}

/**
 * Reason a `scroll_until` loop terminated.
 *
 * - `TARGET_FOUND`          - target matcher became visible in the current UI tree
 * - `EDGE_REACHED`          - content ended naturally (finite list)
 * - `MAX_SCROLLS_REACHED`   - hit the maxScrolls cap (expected on infinite feeds)
 * - `MAX_DURATION_REACHED`  - hit the maxDurationMs cap
 * - `NO_POSITION_CHANGE`    - repeated scrolls produced no movement (stalled or bounced)
 * - `CONTAINER_NOT_FOUND`   - container resolution failed before any scroll
 * - `CONTAINER_NOT_SCROLLABLE` - resolved container is not scrollable
 */
export type ScrollTerminationReason =
  | "TARGET_FOUND"
  | "EDGE_REACHED"
  | "MAX_SCROLLS_REACHED"
  | "MAX_DURATION_REACHED"
  | "NO_POSITION_CHANGE"
  | "CONTAINER_NOT_FOUND"
  | "CONTAINER_NOT_SCROLLABLE"
  | "CONTAINER_LOST";
