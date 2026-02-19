package action.system.window

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class WindowFrameTest {
    private val windowFrame = WindowFrame.Preset // 360dp x 820dp, with status=24dp and nav=16dp

    @Test
    fun containsAny_fullyInside_returnsTrue() {
        val result =
            windowFrame.containsAny(
                offsetXPx = 100f,
                offsetYPx = 100f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertTrue(result)
    }

    @Test
    fun containsAny_partiallyOffLeft_returnsTrue() {
        val result =
            windowFrame.containsAny(
                offsetXPx = -25f,
                offsetYPx = 100f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertTrue(result)
    }

    @Test
    fun containsAny_partiallyOffRight_returnsTrue() {
        val result =
            windowFrame.containsAny(
                offsetXPx = windowFrame.deviceWidthPx - 25f,
                offsetYPx = 100f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertTrue(result)
    }

    @Test
    fun containsAny_partiallyOffTop_returnsTrue() {
        val result =
            windowFrame.containsAny(
                offsetXPx = 100f,
                offsetYPx = -25f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertTrue(result)
    }

    @Test
    fun containsAny_partiallyOffBottom_returnsTrue() {
        val result =
            windowFrame.containsAny(
                offsetXPx = 100f,
                offsetYPx = windowFrame.deviceHeightPx - 25f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertTrue(result)
    }

    @Test
    fun containsAny_completelyOffLeft_returnsFalse() {
        val result =
            windowFrame.containsAny(
                offsetXPx = -100f,
                offsetYPx = 100f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertFalse(result)
    }

    @Test
    fun containsAny_completelyOffRight_returnsFalse() {
        val result =
            windowFrame.containsAny(
                offsetXPx = windowFrame.deviceWidthPx + 1f,
                offsetYPx = 100f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertFalse(result)
    }

    @Test
    fun containsAny_completelyOffTop_returnsFalse() {
        val result =
            windowFrame.containsAny(
                offsetXPx = 100f,
                offsetYPx = -100f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertFalse(result)
    }

    @Test
    fun containsAny_completelyOffBottom_returnsFalse() {
        val result =
            windowFrame.containsAny(
                offsetXPx = 100f,
                offsetYPx = windowFrame.deviceHeightPx + 1f,
                widthPx = 50f,
                heightPx = 50f,
            )
        assertFalse(result)
    }

    @Test
    fun containsAny_exactlyAtEdges_returnsTrue() {
        val result =
            windowFrame.containsAny(
                offsetXPx = 0f,
                offsetYPx = 0f,
                widthPx = windowFrame.deviceWidthPx.toFloat(),
                heightPx = windowFrame.deviceHeightPx.toFloat(),
            )
        assertTrue(result)
    }
}
