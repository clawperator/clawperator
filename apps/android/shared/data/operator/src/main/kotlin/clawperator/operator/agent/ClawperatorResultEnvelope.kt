package clawperator.operator.agent

import clawperator.task.runner.UiActionExecutionResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** Prefix for the canonical terminal result line. Node parser expects exactly this. */
const val CLAWPERATOR_RESULT_PREFIX = "[Clawperator-Result]"

/**
 * Stable error codes for top-level envelope failures.
 * Emitted in [ClawperatorResultEnvelope.errorCode] so agents can branch on them without
 * string-matching the human-readable [ClawperatorResultEnvelope.error] field.
 */
object EnvelopeErrorCodes {
    /** The Clawperator Operator accessibility service is not running. */
    const val SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
}

/**
 * Canonical terminal envelope shape for Node API strict mode.
 * Emit exactly one line per command: `[Clawperator-Result] <json>`.
 *
 * [error] is a human-readable description of the failure reason.
 * [errorCode] is a stable, enumerated code agents can branch on reliably.
 * Both are null on success. [errorCode] may be absent in envelopes from older APK versions.
 */
@Serializable
data class ClawperatorResultEnvelope(
    val commandId: String,
    val taskId: String,
    val status: String, // "success" | "failed"
    val stepResults: List<CanonicalStepResult>,
    val error: String?,
    val errorCode: String? = null,
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
            success = step.success,
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
 *
 * [errorCode] should be a value from [EnvelopeErrorCodes] when the failure has a
 * well-known cause. Omit (or pass null) for generic or unclassified failures.
 */
fun buildCanonicalFailureLine(
    commandId: String,
    taskId: String,
    reason: String,
    errorCode: String? = null,
): String {
    val envelope = ClawperatorResultEnvelope(
        commandId = commandId,
        taskId = taskId,
        status = "failed",
        stepResults = emptyList(),
        error = reason,
        errorCode = errorCode,
    )
    return CLAWPERATOR_RESULT_PREFIX + " " + json.encodeToString(envelope)
}
