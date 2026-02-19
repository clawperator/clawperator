package action.graphics.color

import androidx.compose.ui.graphics.Color

class ColorManager {
    data class Key(
        val color: Color,
        val variance: Float,
    )

    private val cache = mutableMapOf<Key, Color>()

    fun getModifiedColor(
        color: Color,
        variance: Float = .2f,
    ): Color =
        cache.getOrPut(Key(color, variance)) {
            color.getModifiedColor()
        }
}
