package action.random

import androidx.compose.ui.graphics.Color
import kotlin.random.Random

val Random.randomColor: Color
    get() {
        val red = nextFloat()
        val green = nextFloat()
        val blue = nextFloat()
        return Color(red, green, blue, 1.0f)
    }
