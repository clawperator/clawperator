package clawperator.task.runner

import clawperator.uitree.UiTreeClickTypes

/**
 * Typed generic UI automation actions that can be executed by UiActionEngine.
 */
sealed interface UiAction {
    val id: String

    data class OpenUri(
        override val id: String,
        val uri: String,
        val retry: TaskRetry = TaskRetryPresets.AppLaunch,
    ) : UiAction

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
        val findFirstScrollableChild: Boolean = true,
        /** When false, scrolls until the target is visible but does not click it. */
        val clickAfter: Boolean = true,
    ) : UiAction

    data class Scroll(
        override val id: String,
        val container: NodeMatcher? = null,
        val direction: TaskScrollDirection = TaskScrollDirection.Down,
        val distanceRatio: Float = 0.7f,
        val settleDelayMs: Long = 250,
        val findFirstScrollableChild: Boolean = true,
        val retry: TaskRetry = TaskRetry.None,
    ) : UiAction

    /**
     * Bounded scroll loop. Scrolls repeatedly until a termination condition fires.
     * Always applies safety caps - a scroll loop with no bound is unsafe.
     *
     * Termination conditions (in priority order):
     * 1. [maxScrolls] cap reached
     * 2. [maxDurationMs] cap reached
     * 3. Edge detected (leading-child signature unchanged across successive scrolls)
     * 4. No position change across [noPositionChangeThreshold] consecutive scrolls
     *
     * Returns a [TaskScrollUntilResult] with the number of scrolls executed
     * and the reason termination occurred.
     */
    data class ScrollUntil(
        override val id: String,
        val target: NodeMatcher? = null,
        val container: NodeMatcher? = null,
        val direction: TaskScrollDirection = TaskScrollDirection.Down,
        val distanceRatio: Float = 0.7f,
        val settleDelayMs: Long = 250,
        val maxScrolls: Int = 20,
        val maxDurationMs: Long = 10_000,
        val noPositionChangeThreshold: Int = 3,
        val findFirstScrollableChild: Boolean = true,
    ) : UiAction

    data class ReadText(
        override val id: String,
        val matcher: NodeMatcher,
        val retry: TaskRetry = TaskRetryPresets.UiReadiness,
        val validator: UiTextValidator? = null,
    ) : UiAction

    data class SnapshotUi(
        override val id: String,
        val retry: TaskRetry = TaskRetryPresets.UiReadiness,
    ) : UiAction

    data class DoctorPing(
        override val id: String,
        val retry: TaskRetry = TaskRetry.None,
    ) : UiAction

    data class TakeScreenshot(
        override val id: String,
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

    data class PressKey(
        override val id: String,
        val key: UiSystemKey,
    ) : UiAction
}

enum class UiSnapshotActualFormat(
    val wireValue: String,
) {
    HierarchyXml("hierarchy_xml"),
}

data class UiSnapshotResult(
    val actualFormat: UiSnapshotActualFormat,
    val foregroundPackage: String? = null,
    val hasOverlay: Boolean = false,
    val overlayPackage: String? = null,
    val windowCount: Int? = null,
)

enum class UiTextValidator {
    Temperature,
}

enum class UiSystemKey {
    BACK,
    HOME,
    RECENTS;

    companion object {
        fun fromWire(value: String): UiSystemKey =
            when (value.lowercase()) {
                "back" -> BACK
                "home" -> HOME
                "recents" -> RECENTS
                else -> error("unsupported key: $value")
            }
    }
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
