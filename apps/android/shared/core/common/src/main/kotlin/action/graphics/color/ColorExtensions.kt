package action.graphics.color

import androidx.compose.ui.graphics.Color
import kotlin.math.abs

fun Color.getContrastingColor(
    lightColor: Color = Color.White,
    darkColor: Color = Color.Black,
): Color {
    val red = this.red * 255
    val green = this.green * 255
    val blue = this.blue * 255
    val luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    return if (luminance > 128) darkColor else lightColor
}

fun Color.isLight(): Boolean {
    val red = this.red * 255
    val green = this.green * 255
    val blue = this.blue * 255
    val luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    return luminance > 128
}

fun Color.getModifiedColor(variance: Float = .1f): Color =
    modifyLightness(
        variance =
            if (isLight()) {
                -variance
            } else {
                variance
            },
    )

fun Color.setLightness(lightness: Float) =
    getHsl().let { hsl ->
        hsl[2] = lightness
        hsl.getColorFromHsl()
    }

/**
 * Returns a float between 0 and 1 that represents how similar two colors are.
 */
fun Color.getSimilarity(other: Color): Float {
    val red = this.red
    val green = this.green
    val blue = this.blue
    val otherRed = other.red
    val otherGreen = other.green
    val otherBlue = other.blue

    val redDiff = abs(red - otherRed)
    val greenDiff = abs(green - otherGreen)
    val blueDiff = abs(blue - otherBlue)
    val totalDiff = redDiff + greenDiff + blueDiff
    return 1 - (totalDiff / 3)
}

/**
 * Returns a modified [Color] with the same hue and saturation, but with a modified lightness.
 * The variance is to be between [-1, 1].
 *
 * For example, if the color is red, and the variance is 0.1, the returned color is light red.
 * If the color is red, and the variance is -0.1, the returned color is dark red.
 */
fun Color.modifyLightness(variance: Float): Color {
    val hsl = getHsl()
    val lightness = hsl[2]
    val newLightness = lightness + variance
    hsl[2] = newLightness.coerceIn(0f, 1f)

    return hsl.getColorFromHsl()
//    return Color(ColorUtils.HSLToColor(hsl))
}

fun Color.getHsl(): FloatArray {
    val red = red
    val green = green
    val blue = blue
    val max = maxOf(red, green, blue)
    val min = minOf(red, green, blue)
    val delta = max - min
    var hue = 0f
    var saturation = 0f
    val lightness = (max + min) / 2f

    if (delta != 0f) {
        saturation = if (lightness < 0.5f) delta / (max + min) else delta / (2f - max - min)

        when (max) {
            red -> hue = (green - blue) / delta + (if (green < blue) 6f else 0f)
            green -> hue = (blue - red) / delta + 2f
            blue -> hue = (red - green) / delta + 4f
        }

        hue *= 60f
    }

    return floatArrayOf(hue, saturation, lightness)
}

fun FloatArray.getColorFromHsl(): Color {
    val hue = this[0]
    val saturation = this[1]
    val lightness = this[2]

    val c = (1f - abs(2f * lightness - 1f)) * saturation
    val x = c * (1f - abs((hue / 60f) % 2f - 1f))
    val m = lightness - c / 2f
    val r: Float
    val g: Float
    val b: Float

    when {
        hue < 60f -> {
            r = c
            g = x
            b = 0f
        }
        hue < 120f -> {
            r = x
            g = c
            b = 0f
        }
        hue < 180f -> {
            r = 0f
            g = c
            b = x
        }
        hue < 240f -> {
            r = 0f
            g = x
            b = c
        }
        hue < 300f -> {
            r = x
            g = 0f
            b = c
        }
        else -> {
            r = c
            g = 0f
            b = x
        }
    }

    return Color(r + m, g + m, b + m)
}
