package action.utils

import action.annotation.ColorInt
import action.annotation.FloatRange
import androidx.core.graphics.ColorUtils

@ColorInt
fun shadeColor(
    @ColorInt color: Int,
    percent: Int,
): Int {
    val transForm = { i: Float -> if (i < 255) if (i < 1) 0f else i else 255f }

    val offset = Math.round(2.55 * percent).toFloat()
    val r = ((color shr 16 and 0xFF) + offset).let(transForm)
    val g = ((color shr 8 and 0x00FF) + offset).let(transForm)
    val b = ((color and 0x0000FF) + offset).let(transForm)
    return (-0x1000000 + (r * 0x10000 + g * 0x100 + b)).toInt()
}

/**
 * Returns transformed color with [lightness] for given [color], the alpha component is ignored
 */
@ColorInt
fun tintColor(
    @ColorInt color: Int,
    @FloatRange(from = 0.0, to = 1.0) lightness: Float,
): Int {
    val hsl = floatArrayOf(0f, 0f, 0f)
    ColorUtils.colorToHSL(color, hsl)
    hsl[2] = lightness
    return ColorUtils.HSLToColor(hsl)
}

@ExperimentalUnsignedTypes
fun Int.toHexString(
    includeAlpha: Boolean = true,
    prefix: String? = "0x",
): String {
    val asHex =
        toUInt().toString(16).let {
            if (!includeAlpha) {
                it.substring(2, it.length)
            } else {
                it
            }
        }
    return "$prefix$asHex"
}
