package action.utils

import action.math.geometry.Point

class WindowDimensMock(
    var _density: Float = 0f,
    var _maxDisplayDimension: Int = 0,
    var _minDisplayDimension: Int = 0,
    override var displaySize: Point = Point(0, 0),
) : WindowDimens {
    override val density: Float
        get() = _density
    override val maxDisplayDimension: Int
        get() = _maxDisplayDimension
    override val minDisplayDimension: Int
        get() = _minDisplayDimension
}
