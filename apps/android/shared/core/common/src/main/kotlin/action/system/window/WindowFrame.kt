package action.system.window

import androidx.compose.ui.unit.Dp

data class WindowFrame(
    val windowInsets: WindowInsets?,
    val windowSize: WindowSize,
) {
    constructor(
        statusBarHeight: Dp?,
        navigationBarHeight: Dp?,
        deviceWidth: Dp,
        deviceHeight: Dp,
        deviceWidthPx: Int,
        deviceHeightPx: Int,
    ) : this(
        windowInsets = if (statusBarHeight != null && navigationBarHeight != null) {
            WindowInsets(
                statusBarHeight = statusBarHeight,
                navigationBarHeight = navigationBarHeight,
            )
        } else {
            null
        },
        windowSize =
            WindowSize(
                deviceWidth = deviceWidth,
                deviceHeight = deviceHeight,
                deviceWidthPx = deviceWidthPx,
                deviceHeightPx = deviceHeightPx,
            ),
    )

    fun containsAny(
        offsetXPx: Float,
        offsetYPx: Float,
        widthPx: Float,
        heightPx: Float,
    ): Boolean {
        val itemRight = offsetXPx + widthPx
        val itemBottom = offsetYPx + heightPx
        val windowRight = windowSize.deviceWidthPx
        val windowBottom = windowSize.deviceHeightPx

        // Check if the rectangle intersects with the window frame
        // Two rectangles intersect if they are not completely to the left, right, above, or below each other
        return !(
            itemRight < 0 ||
                // Completely to the left
                offsetXPx > windowRight ||
                // Completely to the right
                itemBottom < 0 ||
                // Completely above
                offsetYPx > windowBottom
        ) // Completely below
    }

    val statusBarHeight: Dp?
        get() = windowInsets?.statusBarHeight
    val navigationBarHeight: Dp?
        get() = windowInsets?.navigationBarHeight
    val deviceWidth: Dp
        get() = windowSize.deviceWidth
    val deviceHeight: Dp
        get() = windowSize.deviceHeight
    val deviceWidthPx: Int
        get() = windowSize.deviceWidthPx
    val deviceHeightPx: Int
        get() = windowSize.deviceHeightPx

    companion object {
        val Preset =
            WindowFrame(
                windowInsets = WindowInsets.Preset,
                windowSize = WindowSize.Preset,
            )
    }
}
