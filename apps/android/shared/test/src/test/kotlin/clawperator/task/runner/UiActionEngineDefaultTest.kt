package clawperator.task.runner

import action.developeroptions.DeveloperOptionsManager
import action.math.geometry.Rect
import clawperator.accessibilityservice.AccessibilityServiceManager
import clawperator.test.ActionTest
import clawperator.test.actionTest
import clawperator.uitree.ToggleState
import clawperator.uitree.UiTreeClickTypes
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.time.Duration

class UiActionEngineDefaultTest : ActionTest {
    @Test
    fun `execute runs generic action list and returns step data`() =
        actionTest {
            val uiScope = RecordingTaskUiScope()
            val taskScope = RecordingTaskScope(uiScope)
            val developerOptionsManager = FakeDeveloperOptionsManager()
            val engine = UiActionEngineDefault(developerOptionsManager, AccessibilityServiceManagerMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan =
                        UiActionPlan(
                            commandId = "cmd-1",
                            taskId = "task-1",
                            source = "test",
                            actions =
                                listOf(
                                    UiAction.OpenApp(id = "step-open", applicationId = "com.example.app"),
                                    UiAction.WaitForNode(
                                        id = "step-wait",
                                        matcher = nodeMatcher { resourceId("com.example:id/title") },
                                    ),
                                    UiAction.ReadText(
                                        id = "step-read",
                                        matcher = nodeMatcher { resourceId("com.example:id/title") },
                                    ),
                                    UiAction.SnapshotUi(id = "step-snapshot"),
                                ),
                        ),
                )

            assertEquals("cmd-1", result.commandId)
            assertEquals("task-1", result.taskId)
            assertEquals(4, result.stepResults.size)
            assertEquals("com.example.app", taskScope.openedApps.single())
            assertEquals(1, taskScope.logUiTreeCount)
            assertEquals("Title Text", result.stepResults.first { it.id == "step-read" }.data["text"])
        }

    @Test
    fun `execute scroll_and_click uses TaskUiScope primitives`() =
        actionTest {
            val uiScope = RecordingTaskUiScope()
            val taskScope = RecordingTaskScope(uiScope)
            val developerOptionsManager = FakeDeveloperOptionsManager()
            val engine = UiActionEngineDefault(developerOptionsManager, AccessibilityServiceManagerMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan =
                        UiActionPlan(
                            commandId = "cmd-2",
                            taskId = "task-2",
                            source = "test",
                            actions =
                                listOf(
                                    UiAction.ScrollAndClick(
                                        id = "step-scroll-click",
                                        target = nodeMatcher { textContains("Bedroom") },
                                        direction = TaskScrollDirection.Down,
                                        maxSwipes = 3,
                                        clickTypes = UiTreeClickTypes.Click,
                                    ),
                                ),
                        ),
                )

            assertEquals("step-scroll-click", result.stepResults.single().id)
            assertTrue(uiScope.scrollIntoViewCalled)
            assertTrue(uiScope.clickCalled)
        }

    @Test
    fun `execute close_app returns unsupported error result`() =
        actionTest {
            val uiScope = RecordingTaskUiScope()
            val taskScope = RecordingTaskScope(uiScope)
            val developerOptionsManager = FakeDeveloperOptionsManager()
            val engine = UiActionEngineDefault(developerOptionsManager, AccessibilityServiceManagerMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan =
                        UiActionPlan(
                            commandId = "cmd-close",
                            taskId = "task-close",
                            source = "test",
                            actions =
                                listOf(
                                    UiAction.CloseApp(id = "step-close", applicationId = "com.example.app"),
                                ),
                        ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("step-close", stepResult.id)
            assertEquals("close_app", stepResult.actionType)
            assertEquals(false, stepResult.success)
            assertEquals("UNSUPPORTED_RUNTIME_CLOSE", stepResult.data["error"])
            assertTrue(stepResult.data["message"]?.contains("Android runtime cannot reliably close apps") == true)
        }

    @Test
    fun `execute press_key throws when accessibility service is unavailable`() =
        actionTest {
            val taskScope = RecordingTaskScope(RecordingTaskUiScope())
            // AccessibilityServiceManagerMock is not AccessibilityServiceManagerAndroid,
            // so currentAccessibilityService extension returns null - simulating unavailable service.
            val engine = UiActionEngineDefault(FakeDeveloperOptionsManager(), AccessibilityServiceManagerMock())

            assertFailsWith<IllegalStateException> {
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-key",
                        taskId = "task-key",
                        source = "test",
                        actions = listOf(UiAction.PressKey(id = "k1", key = UiSystemKey.BACK)),
                    ),
                )
            }
        }
}

private class RecordingTaskScope(
    private val uiScope: RecordingTaskUiScope,
) : TaskScope {
    val openedApps = mutableListOf<String>()
    var logUiTreeCount: Int = 0

    override suspend fun openApp(
        applicationId: String,
        retry: TaskRetry,
    ) {
        openedApps += applicationId
    }

    override suspend fun openUri(
        uri: String,
        retry: TaskRetry,
    ) {
    }

    override suspend fun pause(
        duration: Duration,
        retry: TaskRetry,
    ) {
    }

    override suspend fun logUiTree(
        retry: TaskRetry,
    ): UiSnapshotActualFormat {
        logUiTreeCount++
        return UiSnapshotActualFormat.HierarchyXml
    }

    override suspend fun closeApp(
        applicationId: String,
        retry: TaskRetry,
    ) {
    }

    override suspend fun <T> ui(block: suspend TaskUiScope.() -> T): T = uiScope.block()
}

private class RecordingTaskUiScope : TaskUiScope {
    var scrollIntoViewCalled: Boolean = false
    var clickCalled: Boolean = false

    override suspend fun getValidatedText(
        matcher: NodeMatcher,
        retry: TaskRetry,
        validator: (String) -> Boolean,
    ): String {
        val value = "22.5 C"
        if (!validator(value)) {
            throw IllegalStateException("validator rejected test text")
        }
        return value
    }

    override suspend fun waitForNode(
        matcher: NodeMatcher,
        retry: TaskRetry,
    ): TaskUiNode =
        TaskUiNode(
            resourceId = "com.example:id/title",
            label = "Title Text",
            clickable = true,
            role = "text",
            bounds = Rect.Zero,
            debugPath = "0/0",
        )

    override suspend fun getText(
        matcher: NodeMatcher,
        retry: TaskRetry,
    ): String = "Title Text"

    override suspend fun click(
        matcher: NodeMatcher,
        clickTypes: UiTreeClickTypes,
        retry: TaskRetry,
    ) {
        clickCalled = true
    }

    override suspend fun scrollUntil(
        target: NodeMatcher,
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        maxSwipes: Int,
        distanceRatio: Float,
        settleDelay: Duration,
        retry: TaskRetry,
        findFirstScrollableChild: Boolean,
    ): TaskScrollResult {
        scrollIntoViewCalled = true
        return TaskScrollResult.Found(
            TaskUiNode(
                resourceId = "com.example:id/bedroom",
                label = "Bedroom",
                clickable = true,
                role = "button",
                bounds = Rect.Zero,
                debugPath = "0/1",
            ),
        )
    }

    override suspend fun scrollIntoView(
        target: NodeMatcher,
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        maxSwipes: Int,
        distanceRatio: Float,
        settleDelay: Duration,
        retry: TaskRetry,
        findFirstScrollableChild: Boolean,
    ): TaskUiNode {
        scrollIntoViewCalled = true
        return TaskUiNode(
            resourceId = "com.example:id/bedroom",
            label = "Bedroom",
            clickable = true,
            role = "button",
            bounds = Rect.Zero,
            debugPath = "0/1",
        )
    }

    override suspend fun getCurrentToggleState(
        target: NodeMatcher,
        retry: TaskRetry,
    ): ToggleState = ToggleState.Unknown

    override suspend fun setCurrentToggleState(
        target: NodeMatcher,
        desiredState: ToggleState,
        retry: TaskRetry,
    ): ToggleState = desiredState

    override suspend fun enterText(
        matcher: NodeMatcher,
        text: String,
        submit: Boolean,
        retry: TaskRetry,
    ) {
        // Test implementation - no-op
    }
}

private class FakeDeveloperOptionsManager : DeveloperOptionsManager {
    override val isEnabled: Flow<Boolean> = flowOf(true)
    override val isUsbDebuggingEnabled: Flow<Boolean> = flowOf(true)
}

// Not AccessibilityServiceManagerAndroid, so currentAccessibilityService extension returns null.
private class AccessibilityServiceManagerMock : AccessibilityServiceManager {
    override val isRunning: Flow<Boolean> = flowOf(false)
}
