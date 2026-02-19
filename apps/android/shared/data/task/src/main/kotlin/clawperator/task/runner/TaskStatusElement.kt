package clawperator.task.runner

import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.CoroutineContext

/**
 * Coroutine context element that carries the current TaskStatusSink.
 *
 * This element enables any suspend function within a task execution to access
 * the status sink without explicit parameter passing.
 */
class TaskStatusElement(
    val sink: TaskStatusSink,
) : AbstractCoroutineContextElement(TaskStatusElement) {
    companion object Key : CoroutineContext.Key<TaskStatusElement>

    override fun toString(): String = "TaskStatusElement(sink=$sink)"
}

/**
 * Retrieves the current TaskStatusSink from the coroutine context.
 *
 * @return The current TaskStatusSink, or TaskStatusSink.NoOp if none is present
 */
suspend fun currentTaskStatus(): TaskStatusSink = kotlin.coroutines.coroutineContext[TaskStatusElement]?.sink ?: TaskStatusSinkNoOp()
