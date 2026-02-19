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
