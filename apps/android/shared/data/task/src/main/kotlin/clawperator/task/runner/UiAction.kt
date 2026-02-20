package clawperator.task.runner

import clawperator.uitree.UiTreeClickTypes

/**
 * Typed generic UI automation actions that can be executed by UiActionEngine.
 */
sealed interface UiAction {
    val id: String

    data class OpenApp(
        override val id: String,
        val applicationId: String,
        val retry: TaskRetry = TaskRetryPresets.AppLaunch,
    ) : UiAction

    data class CloseApp(
        override val id: String,
        val applicationId: String,
        val retry: TaskRetry = TaskRetryPresets.AppClose,
    ) : UiAction

    data class WaitForNode(
        override val id: String,
        val matcher: NodeMatcher,
        val retry: TaskRetry = TaskRetryPresets.UiReadiness,
    ) : UiAction

    data class Click(
        override val id: String,
        val matcher: NodeMatcher,
        val clickTypes: UiTreeClickTypes = UiTreeClickTypes.Default,
        val retry: TaskRetry = TaskRetryPresets.UiReadiness,
    ) : UiAction

    data class ScrollAndClick(
        override val id: String,
        val target: NodeMatcher,
        val container: NodeMatcher? = null,
        val clickTypes: UiTreeClickTypes = UiTreeClickTypes.Default,
        val direction: TaskScrollDirection = TaskScrollDirection.Down,
        val maxSwipes: Int = 10,
        val distanceRatio: Float = 0.7f,
        val settleDelayMs: Long = 250,
        val scrollRetry: TaskRetry = TaskRetryPresets.UiScroll,
        val clickRetry: TaskRetry = TaskRetryPresets.UiReadiness,
        val findFirstScrollableChild: Boolean = false,
    ) : UiAction

    data class ReadText(
        override val id: String,
        val matcher: NodeMatcher,
        val retry: TaskRetry = TaskRetryPresets.UiReadiness,
        val validator: UiTextValidator? = null,
    ) : UiAction

    data class SnapshotUi(
        override val id: String,
        val format: UiSnapshotFormat = UiSnapshotFormat.Ascii,
        val retry: TaskRetry = TaskRetry.None,
    ) : UiAction

    data class EnterText(
        override val id: String,
        val matcher: NodeMatcher,
        val text: String,
        val submit: Boolean = false,
        val retry: TaskRetry = TaskRetryPresets.UiReadiness,
    ) : UiAction

    data class Sleep(
        override val id: String,
        val durationMs: Long,
        val retry: TaskRetry = TaskRetry.None,
    ) : UiAction
}

enum class UiSnapshotFormat {
    Ascii,
    Json,
}

enum class UiSnapshotActualFormat(
    val wireValue: String,
) {
    Ascii("ascii"),
    Json("json"),
    HierarchyXml("hierarchy_xml"),
}

enum class UiTextValidator {
    Temperature,
}

data class UiActionPlan(
    val commandId: String,
    val taskId: String,
    val source: String,
    val actions: List<UiAction>,
)

data class UiActionStepResult(
    val id: String,
    val actionType: String,
    val success: Boolean = true,
    val data: Map<String, String> = emptyMap(),
)

data class UiActionExecutionResult(
    val commandId: String,
    val taskId: String,
    val stepResults: List<UiActionStepResult>,
)
