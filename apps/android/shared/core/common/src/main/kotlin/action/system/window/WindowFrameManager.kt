package action.system.window

import androidx.compose.ui.unit.Dp
import kotlinx.coroutines.flow.StateFlow

interface WindowFrameManager {
    val isReady: StateFlow<Boolean>

    val windowFrame: StateFlow<WindowFrame>

    fun setInsets(
        statusBarHeight: Dp,
        navBarHeight: Dp,
    )

    fun setSize(
        deviceWidthPx: Int,
        deviceHeightPx: Int,
    )
}
