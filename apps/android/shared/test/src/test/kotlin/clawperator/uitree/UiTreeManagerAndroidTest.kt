package clawperator.uitree

import action.math.geometry.Rect
import android.view.accessibility.AccessibilityNodeInfo
import clawperator.accessibilityservice.AccessibilityServiceManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.runner.RunWith
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.robolectric.annotation.Config
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadow.api.Shadow
import org.robolectric.shadows.ShadowAccessibilityNodeInfo

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class UiTreeManagerAndroidTest {
    private val manager = UiTreeManagerAndroid(accessibilityServiceManager = AccessibilityServiceManagerStub())

    @Test
    fun `setText clear true performs empty set then text set`() =
        runTest {
            val nodeInfo = editableNode()
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = true)

            assertTrue(result)
            assertEquals(listOf("", "hello"), performedSetTextValues(nodeInfo))
        }

    @Test
    fun `setText clear failure stops before text set`() =
        runTest {
            val nodeInfo = editableNode()
            val shadow = Shadow.extract<ShadowAccessibilityNodeInfo>(nodeInfo)
            shadow.setOnPerformActionListener { action, arguments ->
                if (action != AccessibilityNodeInfo.ACTION_SET_TEXT) {
                    true
                } else {
                    arguments?.getCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE) != ""
                }
            }
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = true)

            assertFalse(result)
            assertEquals(listOf(""), performedSetTextValues(nodeInfo))
        }

    @Test
    fun `setText clear false performs one text set`() =
        runTest {
            val nodeInfo =
                editableNode().apply {
                    text = "existing"
                }
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = false)

            assertTrue(result)
            assertEquals(listOf("hello"), performedSetTextValues(nodeInfo))
        }

    @Test
    fun `setText submit true prefers ime enter action when available`() =
        runTest {
            val nodeInfo = editableNode(includeImeEnterAction = true)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = true, clear = false)

            assertTrue(result)
            assertEquals(listOf("hello"), performedSetTextValues(nodeInfo))
            assertTrue(performedActionIds(nodeInfo).contains(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id))
            assertFalse(performedActionIds(nodeInfo).contains(AccessibilityNodeInfo.ACTION_CLICK))
        }

    @Test
    fun `setText submit true falls back to click when ime enter action is unavailable`() =
        runTest {
            val nodeInfo = editableNode()
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = true, clear = false)

            assertTrue(result)
            assertEquals(listOf("hello"), performedSetTextValues(nodeInfo))
            assertFalse(performedActionIds(nodeInfo).contains(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id))
            assertTrue(performedActionIds(nodeInfo).contains(AccessibilityNodeInfo.ACTION_CLICK))
        }

    @Test
    fun `setText submit fallback stays best effort when click cannot run`() =
        runTest {
            val nodeInfo = editableNode()
            val shadow = Shadow.extract<ShadowAccessibilityNodeInfo>(nodeInfo)
            shadow.setOnPerformActionListener { action, arguments ->
                when (action) {
                    AccessibilityNodeInfo.ACTION_SET_TEXT -> true
                    AccessibilityNodeInfo.ACTION_CLICK -> false
                    else -> true
                }
            }
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = true, clear = false)

            assertTrue(result)
            assertEquals(listOf("hello"), performedSetTextValues(nodeInfo))
            assertTrue(performedActionIds(nodeInfo).contains(AccessibilityNodeInfo.ACTION_CLICK))
        }

    @Test
    fun `setText fails when no text-entry strategy succeeds`() =
        runTest {
            val nodeInfo = editableNode()
            val shadow = Shadow.extract<ShadowAccessibilityNodeInfo>(nodeInfo)
            shadow.setOnPerformActionListener { action, arguments ->
                when (action) {
                    AccessibilityNodeInfo.ACTION_SET_TEXT -> false
                    else -> true
                }
            }
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = false)

            assertFalse(result)
            assertEquals(listOf("hello"), performedSetTextValues(nodeInfo))
        }

    private fun editableNode(includeImeEnterAction: Boolean = false): AccessibilityNodeInfo =
        AccessibilityNodeInfo.obtain().apply {
            addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_TEXT)
            if (includeImeEnterAction) {
                addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER)
            }
            isEditable = true
            isFocused = true
        }

    private fun uiNode(nodeInfo: AccessibilityNodeInfo): UiNode =
        UiNode(
            id = UiNodeId("0:0"),
            role = UiRole.TextField,
            label = "Field",
            className = "android.widget.EditText",
            bounds = Rect.Zero,
            isClickable = true,
            isEnabled = true,
            isVisible = true,
            accessibilityNodeInfo = nodeInfo,
        )

    private fun performedSetTextValues(nodeInfo: AccessibilityNodeInfo): List<String> {
        val shadow = Shadow.extract<ShadowAccessibilityNodeInfo>(nodeInfo)
        return shadow.getPerformedActionsWithArgs()
            .filter { it.first == AccessibilityNodeInfo.ACTION_SET_TEXT }
            .map { pair ->
                pair.second
                    ?.getCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE)
                    ?.toString()
                    ?: ""
            }
    }

    private fun performedActionIds(nodeInfo: AccessibilityNodeInfo): List<Int> {
        val shadow = Shadow.extract<ShadowAccessibilityNodeInfo>(nodeInfo)
        return shadow.getPerformedActionsWithArgs().map { it.first }
    }

    private class AccessibilityServiceManagerStub : AccessibilityServiceManager {
        override val isRunning: Flow<Boolean> = flowOf(false)
    }
}
