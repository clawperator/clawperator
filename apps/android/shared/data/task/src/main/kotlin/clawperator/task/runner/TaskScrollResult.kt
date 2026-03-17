package clawperator.task.runner

/**
 * Result of a scroll operation.
 */
sealed interface TaskScrollResult {
    /** Target node was found and scrolled into view */
    data class Found(
        val node: TaskUiNode,
    ) : TaskScrollResult

    /** Scrolling was exhausted without finding the target */
    data object NotFoundExhausted : TaskScrollResult
}

/**
 * Outcome of a single standalone scroll gesture (see [TaskUiScope.scrollOnce]).
 *
 * Distinguishes between three states:
 * - [Moved]: the gesture was dispatched and leading-child signature changed - content moved.
 * - [EdgeReached]: the gesture was dispatched but signature was unchanged - container is at its limit.
 * - [GestureFailed]: the accessibility service rejected the gesture dispatch.
 *
 * [EdgeReached] is not an error condition. It is the expected terminal state when paginating
 * a finite list and should be treated as a successful no-op result in agent loops.
 */
enum class TaskScrollOutcome {
    Moved,
    EdgeReached,
    GestureFailed,
}

/**
 * Full result of a single standalone scroll gesture (see [TaskUiScope.scrollOnce]).
 *
 * Extends [TaskScrollOutcome] with observability fields:
 * - [resolvedContainerId]: the resourceId of the container that was scrolled. Populated
 *   when auto-detection is used so callers can confirm which container was selected.
 */
data class TaskScrollOnceResult(
    val outcome: TaskScrollOutcome,
    val resolvedContainerId: String? = null,
)

/**
 * Reason a [TaskUiScope.scrollLoop] bounded scroll loop terminated.
 */
enum class TaskScrollTerminationReason {
    /** Target matcher became visible in the current UI tree */
    TargetFound,
    /** Content ended naturally - leading-child signature unchanged at the boundary */
    EdgeReached,
    /** Hit the [UiAction.ScrollUntil.maxScrolls] safety cap */
    MaxScrollsReached,
    /** Hit the [UiAction.ScrollUntil.maxDurationMs] safety cap */
    MaxDurationReached,
    /** No content movement across [UiAction.ScrollUntil.noPositionChangeThreshold] consecutive scrolls */
    NoPositionChange,
    /** Container resolution failed before any scroll was attempted */
    ContainerNotFound,
    /** Container matched but is not scrollable */
    ContainerNotScrollable,
    /** Container disappeared mid-loop (e.g. app navigated away) */
    ContainerLost,
}

/**
 * Full result of a [TaskUiScope.scrollLoop] bounded scroll loop.
 */
data class TaskScrollLoopResult(
    val terminationReason: TaskScrollTerminationReason,
    val scrollsExecuted: Int,
    val resolvedContainerId: String? = null,
)
