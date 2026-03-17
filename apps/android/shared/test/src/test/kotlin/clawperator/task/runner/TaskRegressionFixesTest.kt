package clawperator.task.runner

import action.math.geometry.Rect
import clawperator.app.close.AppCloseManager
import clawperator.apps.AppsRepository
import clawperator.test.ActionTest
import clawperator.test.actionTest
import clawperator.trigger.TriggerManager
import clawperator.uitree.UiNode
import clawperator.uitree.UiNodeId
import clawperator.uitree.UiRole
import clawperator.uitree.UiTree
import clawperator.uitree.UiTreeFilterer
import clawperator.uitree.UiTreeFormatter
import clawperator.uitree.UiTreeInspector
import clawperator.uitree.UiTreeManager
import clawperator.uitree.UiWindowMetadata
import clawperator.urlnavigator.UrlNavigator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.advanceUntilIdle
import java.lang.reflect.Proxy
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class TaskRegressionFixesTest : ActionTest {
    @Test
    fun `wait_for_navigation times out when target package never changes`() =
        actionTest {
            val taskScope =
                TaskScopeDefault(
                    appsRepository = unusedProxy(),
                    triggerManager = unusedProxy(),
                    appCloseManager = unusedProxy(),
                    uiTreeInspector =
                        SequenceUiTreeInspector(
                            listOf(
                                UiWindowMetadata(foregroundPackage = "com.android.settings"),
                                UiWindowMetadata(foregroundPackage = "com.android.settings"),
                                UiWindowMetadata(foregroundPackage = "com.android.settings"),
                            ),
                        ),
                    uiTreeFilterer = IdentityUiTreeFilterer,
                    uiTreeFormatter = unusedProxy(),
                    taskUiScope = unusedProxy(),
                    urlNavigator = unusedProxy(),
                    coroutineScopeIo = backgroundScope,
                )

            val result = async {
                taskScope.waitForNavigation(
                    expectedPackage = "com.android.settings",
                    expectedNode = null,
                    timeoutMs = 500,
                )
            }

            advanceUntilIdle()

            assertFalse(result.await().success)
        }

    @Test
    fun `wait_for_navigation succeeds after package changes away and back`() =
        actionTest {
            val taskScope =
                TaskScopeDefault(
                    appsRepository = unusedProxy(),
                    triggerManager = unusedProxy(),
                    appCloseManager = unusedProxy(),
                    uiTreeInspector =
                        SequenceUiTreeInspector(
                            listOf(
                                UiWindowMetadata(foregroundPackage = "com.android.settings"),
                                UiWindowMetadata(foregroundPackage = "com.android.chrome"),
                                UiWindowMetadata(foregroundPackage = "com.android.settings"),
                            ),
                        ),
                    uiTreeFilterer = IdentityUiTreeFilterer,
                    uiTreeFormatter = unusedProxy(),
                    taskUiScope = unusedProxy(),
                    urlNavigator = unusedProxy(),
                    coroutineScopeIo = backgroundScope,
                )

            val result = async {
                taskScope.waitForNavigation(
                    expectedPackage = "com.android.settings",
                    expectedNode = null,
                    timeoutMs = 800,
                )
            }

            advanceUntilIdle()

            assertTrue(result.await().success)
        }

    @Test
    fun `readKeyValuePair reads summary from nearest sibling scope`() =
        actionTest {
            val uiScope =
                TaskUiScopeDefault(
                    uiTreeInspector =
                        StaticUiTreeInspector(
                            UiTree(
                                root =
                                    testNode(
                                        id = "root",
                                        role = UiRole.Container,
                                        children =
                                            listOf(
                                                testNode(
                                                    id = "row",
                                                    role = UiRole.Row,
                                                    children =
                                                        listOf(
                                                            testNode(
                                                                id = "column",
                                                                role = UiRole.Column,
                                                                children =
                                                                    listOf(
                                                                        testNode(
                                                                            id = "label",
                                                                            role = UiRole.Text,
                                                                            label = "Android version",
                                                                        ),
                                                                    ),
                                                            ),
                                                            testNode(
                                                                id = "summary",
                                                                role = UiRole.Text,
                                                                label = "16",
                                                                resourceId = "com.android.settings:id/summary",
                                                            ),
                                                        ),
                                                ),
                                            ),
                                    ),
                                windowId = 1,
                            ),
                        ),
                    uiTreeFilterer = IdentityUiTreeFilterer,
                    uiTreeFormatter = unusedProxy(),
                    uiTreeManager = unusedProxy(),
                    coroutineScopeIo = backgroundScope,
                )

            val result = uiScope.readKeyValuePair(NodeMatcher(textEquals = "Android version"), TaskRetry.None)

            assertEquals("Android version", result.first)
            assertEquals("16", result.second)
        }

    @Test
    fun `readKeyValuePair does not fall through to following row`() =
        actionTest {
            val uiScope =
                TaskUiScopeDefault(
                    uiTreeInspector =
                        StaticUiTreeInspector(
                            UiTree(
                                root =
                                    testNode(
                                        id = "root",
                                        role = UiRole.Container,
                                        children =
                                            listOf(
                                                testNode(
                                                    id = "row-1",
                                                    role = UiRole.Row,
                                                    children =
                                                        listOf(
                                                            testNode(
                                                                id = "label-1",
                                                                role = UiRole.Text,
                                                                label = "Security patch level",
                                                            ),
                                                        ),
                                                ),
                                                testNode(
                                                    id = "row-2",
                                                    role = UiRole.Row,
                                                    children =
                                                        listOf(
                                                            testNode(
                                                                id = "label-2",
                                                                role = UiRole.Text,
                                                                label = "Android version",
                                                            ),
                                                            testNode(
                                                                id = "summary-2",
                                                                role = UiRole.Text,
                                                                label = "16",
                                                                resourceId = "com.android.settings:id/summary",
                                                            ),
                                                        ),
                                                ),
                                            ),
                                    ),
                                windowId = 1,
                            ),
                        ),
                    uiTreeFilterer = IdentityUiTreeFilterer,
                    uiTreeFormatter = unusedProxy(),
                    uiTreeManager = unusedProxy(),
                    coroutineScopeIo = backgroundScope,
                )

            val error =
                assertFailsWith<IllegalStateException> {
                    uiScope.readKeyValuePair(NodeMatcher(textEquals = "Security patch level"), TaskRetry.None)
                }

            assertEquals("VALUE_NODE_NOT_FOUND", error.message)
        }
}

private object IdentityUiTreeFilterer : UiTreeFilterer {
    override fun filterOnScreenOnly(uiTree: UiTree): UiTree = uiTree
}

private class StaticUiTreeInspector(
    private val uiTree: UiTree,
) : UiTreeInspector {
    override suspend fun getCurrentUiElements() = error("unused in test")

    override suspend fun getCurrentUiTree(): UiTree = uiTree

    override suspend fun getCurrentWindowMetadata(): UiWindowMetadata? = null

    override suspend fun getCurrentUiHierarchyDump(): String? = null
}

private class SequenceUiTreeInspector(
    private val metadataSequence: List<UiWindowMetadata>,
) : UiTreeInspector {
    private var index = 0

    override suspend fun getCurrentUiElements() = error("unused in test")

    override suspend fun getCurrentUiTree(): UiTree? = null

    override suspend fun getCurrentWindowMetadata(): UiWindowMetadata? {
        val current = metadataSequence.getOrElse(index) { metadataSequence.last() }
        if (index < metadataSequence.lastIndex) {
            index++
        }
        return current
    }

    override suspend fun getCurrentUiHierarchyDump(): String? = null
}

private fun testNode(
    id: String,
    role: UiRole,
    label: String = "",
    resourceId: String? = null,
    children: List<UiNode> = emptyList(),
): UiNode =
    UiNode(
        id = UiNodeId(id),
        role = role,
        label = label,
        className = "test.${role.name}",
        bounds = Rect.Zero,
        isClickable = false,
        isEnabled = true,
        isVisible = true,
        resourceId = resourceId,
        children = children,
    )

@Suppress("UNCHECKED_CAST")
private inline fun <reified T> unusedProxy(): T =
    Proxy.newProxyInstance(
        T::class.java.classLoader,
        arrayOf(T::class.java),
    ) { _, method, _ ->
        when (method.name) {
            "toString" -> "unusedProxy(${T::class.java.simpleName})"
            else -> error("Unexpected call to ${T::class.java.simpleName}.${method.name}")
        }
    } as T
