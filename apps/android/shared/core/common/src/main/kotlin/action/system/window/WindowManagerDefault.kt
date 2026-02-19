package action.system.window

import androidx.compose.ui.graphics.Color
import action.log.Log
import kotlinx.coroutines.flow.MutableStateFlow

class WindowManagerDefault(
    private val windowFrameManager: WindowFrameManager,
) : WindowManager {
    override val isReady: Boolean
        get() = windowFrameManager.isReady.value

    override val windowFrame: WindowFrame
        get() = windowFrameManager.windowFrame.value

    override val systemBarColors: MutableStateFlow<SystemBarColors> = MutableStateFlow(SystemBarColors.Preset)

    override fun setStatusBarColor(color: Color) {
        systemBarColors.value = systemBarColors.value.copy(statusBarColor = color)
        Log.d("setStatusBarColor: $color")
    }

    override fun setStatusBarDarkIcons(darkIcons: Boolean?) {
        systemBarColors.value = systemBarColors.value.copy(darkStatusBarIcons = darkIcons)
        Log.d("setStatusBarDarkIcons: $darkIcons")
    }

    override fun setNavigationBarColor(color: Color) {
        systemBarColors.value = systemBarColors.value.copy(navigationBarColor = color)
        Log.d("setNavigationBarColor: $color")
    }
}
