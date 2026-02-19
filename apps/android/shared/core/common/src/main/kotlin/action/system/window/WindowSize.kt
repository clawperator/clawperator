package action.system.window


import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

data class WindowSize(
    val deviceWidth: Dp,
    val deviceHeight: Dp,
    val deviceWidthPx: Int,
    val deviceHeightPx: Int,
) {
    companion object {
        val Preset =
            WindowSize(
                deviceWidth = 360.dp,
                deviceHeight = 820.dp,
                deviceWidthPx = (360 * 2f).roundToInt(),
                deviceHeightPx = (820 * 2f).roundToInt(),
            )
    }
}
