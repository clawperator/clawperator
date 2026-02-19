package clawperator.operator.agent

import clawperator.task.runner.UiActionExecutionResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** Prefix for the canonical terminal result line. Node parser expects exactly this. */
const val CLAWPERATOR_RESULT_PREFIX = "[Clawperator-Result]"

/**
 * Canonical terminal envelope shape for Node API strict mode.
 * Emit exactly one line per command: `[Clawperator-Result] <json>`.
 */
@Serializable
data class ClawperatorResultEnvelope(
    val commandId: String,
    val taskId: String,
    val status: String, // "success" | "failed"
    val stepResults: List<CanonicalStepResult>,
    val error: String?,
)

@Serializable
data class CanonicalStepResult(
    val id: String,
    val actionType: String,
    val success: Boolean,
    val data: Map<String, String> = emptyMap(),
)

private val json = Json { encodeDefaults = false }

/**
 * Build the single-line canonical terminal log message for a successful result.
 */
fun buildCanonicalSuccessLine(
    commandId: String,
    taskId: String,
    result: UiActionExecutionResult,
): String {
    val stepResults = result.stepResults.map { step ->
        CanonicalStepResult(
            id = step.id,
            actionType = step.actionType,
            success = true,
            // UiActionStepResult.data is currently Map<String, String>; keep this direct mapping in sync if that contract changes.
            data = step.data,
        )
    }
    val envelope = ClawperatorResultEnvelope(
        commandId = commandId,
        taskId = taskId,
        status = "success",
        stepResults = stepResults,
        error = null,
    )
    return CLAWPERATOR_RESULT_PREFIX + " " + json.encodeToString(envelope)
}

/**
 * Build the single-line canonical terminal log message for a failed result.
 */
fun buildCanonicalFailureLine(
    commandId: String,
    taskId: String,
    reason: String,
): String {
    val envelope = ClawperatorResultEnvelope(
        commandId = commandId,
        taskId = taskId,
        status = "failed",
        stepResults = emptyList(),
        error = reason,
    )
    return CLAWPERATOR_RESULT_PREFIX + " " + json.encodeToString(envelope)
}
