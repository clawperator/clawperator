package clawperator.task.runner

import action.developeroptions.DeveloperOptionsManager
import action.math.geometry.Rect
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
import kotlin.time.Duration.Companion.milliseconds

class UiActionEngineDefaultTest : ActionTest {
    @Test
    fun `execute runs generic action list and returns step data`() =
        actionTest {
            val uiScope = RecordingTaskUiScope()
            val taskScope = RecordingTaskScope(uiScope)
            val developerOptionsManager = DeveloperOptionsManagerMock()
            val engine = UiActionEngineDefault(developerOptionsManager, UiGlobalActionDispatcherMock())

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
    fun `execute snapshot_ui returns overlay metadata when available`() =
        actionTest {
            val uiScope = RecordingTaskUiScope()
            val taskScope =
                RecordingTaskScope(
                    uiScope = uiScope,
                    snapshotResult =
                        UiSnapshotResult(
                            actualFormat = UiSnapshotActualFormat.HierarchyXml,
                            foregroundPackage = "com.android.permissioncontroller",
                            hasOverlay = true,
                            overlayPackage = "com.android.permissioncontroller",
                            windowCount = 2,
                        ),
                )
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan =
                        UiActionPlan(
                            commandId = "cmd-snapshot-overlay",
                            taskId = "task-snapshot-overlay",
                            source = "test",
                            actions = listOf(UiAction.SnapshotUi(id = "snap-1")),
                        ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("snapshot_ui", stepResult.actionType)
            assertEquals("hierarchy_xml", stepResult.data["actual_format"])
            assertEquals("com.android.permissioncontroller", stepResult.data["foreground_package"])
            assertEquals("true", stepResult.data["has_overlay"])
            assertEquals("com.android.permissioncontroller", stepResult.data["overlay_package"])
            assertEquals("2", stepResult.data["window_count"])
        }

    @Test
    fun `execute scroll_and_click uses TaskUiScope primitives`() =
        actionTest {
            val uiScope = RecordingTaskUiScope()
            val taskScope = RecordingTaskScope(uiScope)
            val developerOptionsManager = DeveloperOptionsManagerMock()
            val engine = UiActionEngineDefault(developerOptionsManager, UiGlobalActionDispatcherMock())

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
            val developerOptionsManager = DeveloperOptionsManagerMock()
            val engine = UiActionEngineDefault(developerOptionsManager, UiGlobalActionDispatcherMock())

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
            val engine =
                UiActionEngineDefault(
                    DeveloperOptionsManagerMock(),
                    UiGlobalActionDispatcherMock(error = IllegalStateException("OperatorAccessibilityService is not running - cannot execute press_key")),
                )

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

    @Test
    fun `execute press_key returns success result when global action succeeds`() =
        actionTest {
            val taskScope = RecordingTaskScope(RecordingTaskUiScope())
            val engine =
                UiActionEngineDefault(
                    DeveloperOptionsManagerMock(),
                    UiGlobalActionDispatcherMock(result = true),
                )

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-key-success",
                        taskId = "task-key-success",
                        source = "test",
                        actions = listOf(UiAction.PressKey(id = "k1", key = UiSystemKey.HOME)),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("press_key", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("home", stepResult.data["key"])
        }

    @Test
    fun `execute press_key returns failed step result when global action is rejected`() =
        actionTest {
            val taskScope = RecordingTaskScope(RecordingTaskUiScope())
            val engine =
                UiActionEngineDefault(
                    DeveloperOptionsManagerMock(),
                    UiGlobalActionDispatcherMock(result = false),
                )

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-key-failed",
                        taskId = "task-key-failed",
                        source = "test",
                        actions = listOf(UiAction.PressKey(id = "k1", key = UiSystemKey.RECENTS)),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("press_key", stepResult.actionType)
            assertEquals(false, stepResult.success)
            assertEquals("recents", stepResult.data["key"])
            assertEquals("GLOBAL_ACTION_FAILED", stepResult.data["error"])
        }

    @Test
    fun `execute scroll returns moved when scrollOnce returns Moved`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(scrollOnceOutcome = TaskScrollOutcome.Moved)
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-scroll-moved",
                        taskId = "task-scroll-moved",
                        source = "test",
                        actions = listOf(UiAction.Scroll(id = "s1", direction = TaskScrollDirection.Down)),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("moved", stepResult.data["scroll_outcome"])
            assertEquals("down", stepResult.data["direction"])
            assertTrue(uiScope.scrollOnceCalled)
        }

    @Test
    fun `execute scroll returns edge_reached when scrollOnce returns EdgeReached`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(scrollOnceOutcome = TaskScrollOutcome.EdgeReached)
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-scroll-edge",
                        taskId = "task-scroll-edge",
                        source = "test",
                        actions = listOf(UiAction.Scroll(id = "s2", direction = TaskScrollDirection.Up)),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("edge_reached", stepResult.data["scroll_outcome"])
            assertEquals("up", stepResult.data["direction"])
        }

    @Test
    fun `execute scroll returns failure when scrollOnce returns GestureFailed`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(scrollOnceOutcome = TaskScrollOutcome.GestureFailed)
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-scroll-gesture-failed",
                        taskId = "task-scroll-gesture-failed",
                        source = "test",
                        actions = listOf(UiAction.Scroll(id = "s3")),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll", stepResult.actionType)
            assertEquals(false, stepResult.success)
            assertEquals("gesture_failed", stepResult.data["scroll_outcome"])
            assertEquals("GESTURE_FAILED", stepResult.data["error"])
        }

    @Test
    fun `execute scroll returns container_not_found when scrollOnce throws no scrollable container`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(scrollOnceThrows = IllegalStateException("No scrollable container visible"))
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-scroll-no-container",
                        taskId = "task-scroll-no-container",
                        source = "test",
                        actions = listOf(UiAction.Scroll(id = "s4")),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll", stepResult.actionType)
            assertEquals(false, stepResult.success)
            assertEquals("CONTAINER_NOT_FOUND", stepResult.data["error"])
        }

    @Test
    fun `execute scroll returns container_not_scrollable when scrollOnce throws not scrollable`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(scrollOnceThrows = IllegalStateException("Scrollable container not found for matcher"))
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-scroll-not-scrollable",
                        taskId = "task-scroll-not-scrollable",
                        source = "test",
                        actions = listOf(UiAction.Scroll(id = "s5")),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll", stepResult.actionType)
            assertEquals(false, stepResult.success)
            assertEquals("CONTAINER_NOT_SCROLLABLE", stepResult.data["error"])
        }

    @Test
    fun `execute scroll_until returns edge_reached termination`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.EdgeReached, scrollsExecuted = 7),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-edge",
                        taskId = "task-su-edge",
                        source = "test",
                        actions = listOf(UiAction.ScrollUntil(id = "su1", direction = TaskScrollDirection.Down)),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("EDGE_REACHED", stepResult.data["termination_reason"])
            assertEquals("7", stepResult.data["scrolls_executed"])
            assertEquals("down", stepResult.data["direction"])
        }

    @Test
    fun `execute scroll_until returns max_scrolls_reached termination`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.MaxScrollsReached, scrollsExecuted = 20),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-maxscrolls",
                        taskId = "task-su-maxscrolls",
                        source = "test",
                        actions = listOf(UiAction.ScrollUntil(id = "su2")),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("MAX_SCROLLS_REACHED", stepResult.data["termination_reason"])
            assertEquals("20", stepResult.data["scrolls_executed"])
        }

    @Test
    fun `execute scroll_until returns no_position_change termination`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.NoPositionChange, scrollsExecuted = 4),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-npc",
                        taskId = "task-su-npc",
                        source = "test",
                        actions = listOf(UiAction.ScrollUntil(id = "su3")),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("NO_POSITION_CHANGE", stepResult.data["termination_reason"])
        }

    @Test
    fun `execute scroll_until returns failure for container_not_found`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.ContainerNotFound, scrollsExecuted = 0),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-cnf",
                        taskId = "task-su-cnf",
                        source = "test",
                        actions = listOf(UiAction.ScrollUntil(id = "su4")),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(false, stepResult.success)
            assertEquals("CONTAINER_NOT_FOUND", stepResult.data["error"])
            assertEquals("CONTAINER_NOT_FOUND", stepResult.data["termination_reason"])
        }

    @Test
    fun `execute scroll_until returns failure for container_lost`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.ContainerLost, scrollsExecuted = 3),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-cl",
                        taskId = "task-su-cl",
                        source = "test",
                        actions = listOf(UiAction.ScrollUntil(id = "su5")),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(false, stepResult.success)
            assertEquals("CONTAINER_LOST", stepResult.data["error"])
            assertEquals("CONTAINER_LOST", stepResult.data["termination_reason"])
        }

    @Test
    fun `execute scroll_until returns target_found termination`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.TargetFound, scrollsExecuted = 3),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-target",
                        taskId = "task-su-target",
                        source = "test",
                        actions = listOf(
                            UiAction.ScrollUntil(
                                id = "su-target",
                                target = NodeMatcher(textContains = "About phone"),
                            ),
                        ),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("TARGET_FOUND", stepResult.data["termination_reason"])
            assertEquals("3", stepResult.data["scrolls_executed"])
        }

    @Test
    fun `execute scroll_until clicks target when clickAfter is true`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.TargetFound, scrollsExecuted = 3),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-target-click",
                        taskId = "task-su-target-click",
                        source = "test",
                        actions = listOf(
                            UiAction.ScrollUntil(
                                id = "su-target-click",
                                target = NodeMatcher(textContains = "About phone"),
                                clickAfter = true,
                            ),
                        ),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("TARGET_FOUND", stepResult.data["termination_reason"])
            assertEquals("true", stepResult.data["click_after"])
            assertEquals(true, uiScope.clickCalled)
        }

    @Test
    fun `execute scroll_until returns edge_reached when target genuinely absent`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.EdgeReached, scrollsExecuted = 3),
                waitForNodeThrows = IllegalStateException("Node not found"),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-absent-click",
                        taskId = "task-su-absent-click",
                        source = "test",
                        actions = listOf(
                            UiAction.ScrollUntil(
                                id = "su-absent-click",
                                target = NodeMatcher(textContains = "Missing Target"),
                                clickAfter = true,
                            ),
                        ),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("EDGE_REACHED", stepResult.data["termination_reason"])
            assertEquals("true", stepResult.data["click_after"])
            assertEquals(false, uiScope.clickCalled)
        }

    @Test
    fun `execute scroll_until normalizes to target_found when target is visible after loop`() =
        actionTest {
            val uiScope = RecordingTaskUiScope(
                scrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.EdgeReached, scrollsExecuted = 2),
            )
            val taskScope = RecordingTaskScope(uiScope)
            val engine = UiActionEngineDefault(DeveloperOptionsManagerMock(), UiGlobalActionDispatcherMock())

            val result =
                engine.execute(
                    taskScope = taskScope,
                    plan = UiActionPlan(
                        commandId = "cmd-su-post-loop-target",
                        taskId = "task-su-post-loop-target",
                        source = "test",
                        actions = listOf(
                            UiAction.ScrollUntil(
                                id = "su-post-loop-target",
                                target = NodeMatcher(textEquals = "Battery"),
                                clickAfter = true,
                            ),
                        ),
                    ),
                )

            val stepResult = result.stepResults.single()
            assertEquals("scroll_until", stepResult.actionType)
            assertEquals(true, stepResult.success)
            assertEquals("TARGET_FOUND", stepResult.data["termination_reason"])
            assertEquals("2", stepResult.data["scrolls_executed"])
            assertEquals(true, uiScope.clickCalled)
        }
}

private class RecordingTaskScope(
    private val uiScope: RecordingTaskUiScope,
    private val snapshotResult: UiSnapshotResult = UiSnapshotResult(actualFormat = UiSnapshotActualFormat.HierarchyXml),
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
    ): UiSnapshotResult {
        logUiTreeCount++
        return snapshotResult
    }

    override suspend fun closeApp(
        applicationId: String,
        retry: TaskRetry,
    ) {
    }

    override suspend fun <T> ui(block: suspend TaskUiScope.() -> T): T = uiScope.block()
}

private class RecordingTaskUiScope(
    private val scrollOnceOutcome: TaskScrollOutcome = TaskScrollOutcome.Moved,
    private val scrollOnceThrows: IllegalStateException? = null,
    private val scrollOnceContainerId: String? = null,
    private val scrollLoopResult: TaskScrollLoopResult = TaskScrollLoopResult(TaskScrollTerminationReason.EdgeReached, scrollsExecuted = 3),
    private val waitForNodeThrows: Exception? = null,
) : TaskUiScope {
    var scrollIntoViewCalled: Boolean = false
    var scrollOnceCalled: Boolean = false
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
    ): TaskUiNode {
        if (waitForNodeThrows != null) {
            throw waitForNodeThrows
        }
        return TaskUiNode(
            resourceId = "com.example:id/title",
            label = "Title Text",
            clickable = true,
            role = "text",
            bounds = Rect.Zero,
            debugPath = "0/0",
        )
    }

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

    override suspend fun scrollOnce(
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        distanceRatio: Float,
        settleDelay: Duration,
        retry: TaskRetry,
        findFirstScrollableChild: Boolean,
    ): TaskScrollOnceResult {
        scrollOnceCalled = true
        scrollOnceThrows?.let { throw it }
        return TaskScrollOnceResult(scrollOnceOutcome, scrollOnceContainerId)
    }

    override suspend fun scrollLoop(
        target: NodeMatcher?,
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        distanceRatio: Float,
        settleDelay: Duration,
        maxScrolls: Int,
        maxDuration: Duration,
        noPositionChangeThreshold: Int,
        findFirstScrollableChild: Boolean,
    ): TaskScrollLoopResult = scrollLoopResult

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

private class DeveloperOptionsManagerMock : DeveloperOptionsManager {
    override val isEnabled: Flow<Boolean> = flowOf(true)
    override val isUsbDebuggingEnabled: Flow<Boolean> = flowOf(true)
}

private class UiGlobalActionDispatcherMock(
    private val result: Boolean = true,
    private val error: IllegalStateException? = null,
) : UiGlobalActionDispatcher {
    override fun perform(key: UiSystemKey): Boolean {
        error?.let { throw it }
        return result
    }
}
