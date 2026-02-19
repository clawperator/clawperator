package clawperator.operator.task

import kotlinx.serialization.Serializable

@Serializable
data class TaskState(
    val taskId: String,
    val deviceId: String,
    val command: String,
    val status: String,
    val message: String,
    val progressPct: Int? = null,
    val result: String? = null,
    val errorCode: String? = null,
    // Note: createdAt and updatedAt are server timestamps from Firestore
    // They would be deserialized as Map or custom types in a real implementation
)
