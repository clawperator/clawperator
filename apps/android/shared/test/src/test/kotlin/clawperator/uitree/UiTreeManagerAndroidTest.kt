package clawperator.uitree

import action.math.geometry.Rect
import android.view.accessibility.AccessibilityNodeInfo
import clawperator.accessibilityservice.AccessibilityServiceManager
import clawperator.accessibilityservice.NoOpTextInputConnectionSource
import clawperator.accessibilityservice.TextInputConnectionSource
import clawperator.accessibilityservice.TextInputEditorInfo
import clawperator.accessibilityservice.TextInputSession
import clawperator.accessibilityservice.TextInputSurroundingText
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
    @Test
    fun `setText clear true performs empty set then text set`() =
        runTest {
            val manager = createManager()
            val nodeInfo = editableNode()
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = true)

            assertTrue(result)
            assertEquals(listOf("", "hello"), performedSetTextValues(nodeInfo))
        }

    @Test
    fun `setText clear failure stops before text set`() =
        runTest {
            val manager = createManager()
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
            val manager = createManager()
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
            val manager = createManager()
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
            val manager = createManager()
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
            val manager = createManager()
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
            val manager = createManager()
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

    @Test
    fun `setText uses api33 input connection when legacy set text is unavailable`() =
        runTest {
            val session = FakeTextInputSession(initialText = "existing", surroundingTextAvailable = false)
            val manager = createManager(textInputConnectionSource = FakeTextInputConnectionSource(session))
            val nodeInfo = editableNode(includeSetTextAction = false)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = false)

            assertTrue(result)
            assertEquals("hello", session.text)
            assertEquals(
                listOf(
                    "getSurroundingText(2147483647,2147483647)",
                    "setSelection(2147483647,2147483647)",
                    "deleteSurroundingText(2147483647,0)",
                    "commitText(hello,1)",
                ),
                session.operations,
            )
        }

    @Test
    fun `setText api33 path selects known text length before commit`() =
        runTest {
            val session =
                FakeTextInputSession(
                    initialText = "existing",
                    editorInfo =
                        FakeTextInputSession.editorInfo(
                            initialSurroundingText =
                                TextInputSurroundingText(
                                    text = "existing",
                                    selectionStart = 3,
                                    selectionEnd = 3,
                                    offset = 0,
                                ),
                        ),
                )
            val manager = createManager(textInputConnectionSource = FakeTextInputConnectionSource(session))
            val nodeInfo = editableNode(includeSetTextAction = false)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = false)

            assertTrue(result)
            assertEquals("hello", session.text)
            assertEquals(
                listOf(
                    "setSelection(0,8)",
                    "commitText(hello,1)",
                ),
                session.operations,
            )
        }

    @Test
    fun `setText api33 path uses editor action for submit`() =
        runTest {
            val session =
                FakeTextInputSession(
                    initialText = "existing",
                    editorInfo = FakeTextInputSession.editorInfo(actionId = 42),
                )
            val manager = createManager(textInputConnectionSource = FakeTextInputConnectionSource(session))
            val nodeInfo = editableNode(includeSetTextAction = false)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = true, clear = false)

            assertTrue(result)
            assertEquals("hello", session.text)
            assertTrue(session.operations.contains("performEditorAction(42)"))
            assertFalse(performedActionIds(nodeInfo).contains(AccessibilityNodeInfo.ACTION_CLICK))
        }

    @Test
    fun `setText api33 path returns false when session is missing and legacy route is unavailable`() =
        runTest {
            val manager = createManager(textInputConnectionSource = NoOpTextInputConnectionSource)
            val nodeInfo = editableNode(includeSetTextAction = false)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = false)

            assertFalse(result)
        }

    @Test
    fun `setText api33 path returns false when session is finished and legacy route is unavailable`() =
        runTest {
            val session = FakeTextInputSession(initialText = "existing", isActive = false)
            val manager = createManager(textInputConnectionSource = FakeTextInputConnectionSource(session))
            val nodeInfo = editableNode(includeSetTextAction = false)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = false)

            assertFalse(result)
        }

    @Test
    fun `setText api33 path returns false when editor info is missing and legacy route is unavailable`() =
        runTest {
            val session = FakeTextInputSession(initialText = "existing", editorInfo = null)
            val manager = createManager(textInputConnectionSource = FakeTextInputConnectionSource(session))
            val nodeInfo = editableNode(includeSetTextAction = false)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = true, clear = false)

            assertFalse(result)
        }

    @Test
    fun `setText api33 path keeps selection step when clear is true`() =
        runTest {
            val session =
                FakeTextInputSession(
                    initialText = "existing",
                    editorInfo =
                        FakeTextInputSession.editorInfo(
                            initialSurroundingText =
                                TextInputSurroundingText(
                                    text = "existing",
                                    selectionStart = 0,
                                    selectionEnd = 8,
                                    offset = 0,
                                ),
                        ),
                )
            val manager = createManager(textInputConnectionSource = FakeTextInputConnectionSource(session))
            val nodeInfo = editableNode(includeSetTextAction = false)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = true)

            assertTrue(result)
            assertEquals("hello", session.text)
            assertEquals(
                listOf(
                    "setSelection(0,8)",
                    "commitText(hello,1)",
                ),
                session.operations,
            )
        }

    @Test
    @Config(sdk = [32])
    fun `setText skips api33 path on lower api levels`() =
        runTest {
            val session = FakeTextInputSession(initialText = "existing")
            val manager = createManager(textInputConnectionSource = FakeTextInputConnectionSource(session))
            val nodeInfo = editableNode(includeSetTextAction = false)
            val uiNode = uiNode(nodeInfo)

            val result = manager.setText(uiNode = uiNode, text = "hello", submit = false, clear = false)

            assertFalse(result)
            assertEquals(emptyList(), session.operations)
        }

    private fun editableNode(
        includeImeEnterAction: Boolean = false,
        includeSetTextAction: Boolean = true,
    ): AccessibilityNodeInfo =
        AccessibilityNodeInfo.obtain().apply {
            if (includeSetTextAction) {
                addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_TEXT)
            }
            if (includeImeEnterAction) {
                addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER)
            }
            isEditable = true
            isFocused = true
            if (!includeSetTextAction) {
                val shadow = Shadow.extract<ShadowAccessibilityNodeInfo>(this)
                shadow.setOnPerformActionListener { action, arguments ->
                    when (action) {
                        AccessibilityNodeInfo.ACTION_SET_TEXT -> false
                        else -> true
                    }
                }
            }
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

    private fun createManager(
        textInputConnectionSource: TextInputConnectionSource = NoOpTextInputConnectionSource,
    ): UiTreeManagerAndroid =
        UiTreeManagerAndroid(
            accessibilityServiceManager =
                AccessibilityServiceManagerStub(
                    textInputConnectionSource = textInputConnectionSource,
                ),
        )

    private class AccessibilityServiceManagerStub(
        private val textInputConnectionSource: TextInputConnectionSource = NoOpTextInputConnectionSource,
    ) :
        AccessibilityServiceManager,
        TextInputConnectionSource by textInputConnectionSource {
        override val isRunning: Flow<Boolean> = flowOf(false)
    }

    private class FakeTextInputConnectionSource(
        private val session: TextInputSession?,
    ) : TextInputConnectionSource {
        override fun currentSession(): TextInputSession? = session
    }

    private class FakeTextInputSession(
        initialText: String,
        override val isActive: Boolean = true,
        override val editorInfo: TextInputEditorInfo? = editorInfo(),
        private val surroundingTextAvailable: Boolean = true,
    ) : TextInputSession {
        var text: String = initialText
            private set
        val operations = mutableListOf<String>()
        private var selectionStart: Int = initialText.length
        private var selectionEnd: Int = initialText.length

        override fun getSurroundingText(
            beforeLength: Int,
            afterLength: Int,
        ): TextInputSurroundingText? {
            operations += "getSurroundingText($beforeLength,$afterLength)"
            if (!surroundingTextAvailable) {
                return null
            }
            return TextInputSurroundingText(
                text = text,
                selectionStart = selectionStart,
                selectionEnd = selectionEnd,
                offset = 0,
            )
        }

        override fun setSelection(
            start: Int,
            end: Int,
        ): Boolean {
            operations += "setSelection($start,$end)"
            if (!isActive) {
                return false
            }
            val resolvedStart =
                if (start == Int.MAX_VALUE) {
                    text.length
                } else {
                    start.coerceIn(0, text.length)
                }
            val resolvedEnd =
                if (end == Int.MAX_VALUE) {
                    text.length
                } else {
                    end.coerceIn(0, text.length)
                }
            selectionStart = resolvedStart
            selectionEnd = resolvedEnd
            return true
        }

        override fun deleteSurroundingText(
            beforeLength: Int,
            afterLength: Int,
        ): Boolean {
            operations += "deleteSurroundingText($beforeLength,$afterLength)"
            if (!isActive) {
                return false
            }
            val cursor = maxOf(selectionStart, selectionEnd)
            val deleteStart = (cursor - beforeLength).coerceAtLeast(0)
            val deleteEnd = (cursor + afterLength).coerceAtMost(text.length)
            text = text.removeRange(deleteStart, deleteEnd)
            selectionStart = deleteStart
            selectionEnd = deleteStart
            return true
        }

        override fun commitText(
            text: CharSequence,
            newCursorPosition: Int,
        ): Boolean {
            operations += "commitText($text,$newCursorPosition)"
            if (!isActive) {
                return false
            }
            val start = minOf(selectionStart, selectionEnd)
            val end = maxOf(selectionStart, selectionEnd)
            this.text = this.text.replaceRange(start, end, text.toString())
            val cursor = start + text.length
            selectionStart = cursor
            selectionEnd = cursor
            return true
        }

        override fun performEditorAction(editorAction: Int): Boolean {
            operations += "performEditorAction($editorAction)"
            return isActive
        }

        companion object {
            fun editorInfo(
                actionId: Int = 0,
                imeOptions: Int = 0,
                initialSurroundingText: TextInputSurroundingText? = null,
            ): TextInputEditorInfo =
                TextInputEditorInfo(
                    actionId = actionId,
                    imeOptions = imeOptions,
                    initialSelectionStart = 0,
                    initialSelectionEnd = 0,
                    initialSurroundingText = initialSurroundingText,
                )
        }
    }
}
