package clawperator.operator.task

import kotlinx.serialization.Serializable

@Serializable
data class TaskStatusResponse(
    val status: String,
    val taskState: TaskState? = null,
)
