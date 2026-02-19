package action.utils

import action.math.geometry.Point

interface WindowDimens {
    val density: Float

    /**
     * The real size of the display without subtracting any window decor such as
     * the status or nav bar.
     */
    val displaySize: Point

    val maxDisplayDimension: Int

    val minDisplayDimension: Int
}
