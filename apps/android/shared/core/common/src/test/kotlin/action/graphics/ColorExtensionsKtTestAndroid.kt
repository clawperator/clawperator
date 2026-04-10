package action.graphics

import androidx.compose.ui.graphics.Color
import kotlin.test.assertEquals
import kotlin.test.Test

class ColorExtensionsKtTest {
    @Test
    fun composeColorConstants() {
        assertEquals(Color.Black, Color.Black)
        assertEquals(Color.Green, Color.Green)
    }
}
