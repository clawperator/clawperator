package action.system.window

import androidx.compose.ui.unit.Dp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object WindowFrameManagerNoOp : WindowFrameManager {
    override val isReady: StateFlow<Boolean> = MutableStateFlow(true)

    override val windowFrame: StateFlow<WindowFrame> = MutableStateFlow(WindowFrame.Preset)

    override fun setInsets(
        statusBarHeight: Dp,
        navBarHeight: Dp,
    ) { }

    override fun setSize(
        deviceWidthPx: Int,
        deviceHeightPx: Int,
    ) { }
}
