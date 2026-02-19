package action.system.window

import action.log.Log
import action.system.unit.SystemUnitManager
import androidx.compose.ui.unit.Dp
import kotlinx.coroutines.flow.StateFlow

open class WindowFrameManagerDefault(
    private val systemUnitManager: SystemUnitManager,
) : WindowFrameManager {
    override val isReady: StateFlow<Boolean>
        get() = TODO("Not yet implemented")

    private var _windowFrame: WindowFrame? = null
    override val windowFrame: StateFlow<WindowFrame>
        get() = TODO()
//        get() = requireNotNull(_windowFrame) {"windowInsets is null - must call setInsets()"}

    override fun setInsets(
        statusBarHeight: Dp,
        navBarHeight: Dp,
    ) {
        val insets =
            WindowInsets(
                statusBarHeight = statusBarHeight,
                navigationBarHeight = navBarHeight,
            )
        _windowFrame = _windowFrame?.copy(windowInsets = insets)
    }

    open fun updateSize() { }

    override fun setSize(
        deviceWidthPx: Int,
        deviceHeightPx: Int,
    ) {
        val size =
            WindowSize(
                deviceWidth = systemUnitManager.pxToDp(deviceWidthPx),
                deviceHeight = systemUnitManager.pxToDp(deviceHeightPx),
                deviceWidthPx = deviceWidthPx,
                deviceHeightPx = deviceHeightPx,
            )

        val windowFrame = _windowFrame
        _windowFrame = windowFrame?.copy(windowSize = size)
            ?: WindowFrame(windowInsets = WindowInsets.Empty, windowSize = size)
    }

    fun setInsets(
        statusBarHeight: Dp,
        navBarHeight: Dp,
        deviceWidthPx: Int,
        deviceHeightPx: Int,
    ) {
        _windowFrame =
            WindowFrame(
                statusBarHeight = statusBarHeight,
                navigationBarHeight = navBarHeight,
                deviceWidth = systemUnitManager.pxToDp(deviceWidthPx),
                deviceHeight = systemUnitManager.pxToDp(deviceHeightPx),
                deviceWidthPx = deviceWidthPx,
                deviceHeightPx = deviceHeightPx,
            ).also {
                Log.d("setInsets(): $it")
            }
    }
}
