package action.system.window

import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

interface WindowManager {
    val isReady: Boolean

    val windowFrame: WindowFrame

    val systemBarColors: StateFlow<SystemBarColors>

    fun setStatusBarColor(color: Color)

    /**
     * Null means let the system arbitrate whether to use dark status bar icons or not.
     */
    fun setStatusBarDarkIcons(darkIcons: Boolean?)

    fun setNavigationBarColor(color: Color)
}

object WindowManagerNoOp : WindowManager {
    override val isReady: Boolean
        get() = true

    override val windowFrame: WindowFrame
        get() = WindowFrame.Preset

    override val systemBarColors: StateFlow<SystemBarColors> = MutableStateFlow(SystemBarColors.Preset)

    override fun setStatusBarColor(color: Color) { }

    override fun setStatusBarDarkIcons(darkIcons: Boolean?) { }

    override fun setNavigationBarColor(color: Color) { }
}
