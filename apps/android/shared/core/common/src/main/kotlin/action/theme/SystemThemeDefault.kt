package action.theme

import action.power.PowerManager
import action.system.ui.mode.UiModeManager
import android.os.Build
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class SystemThemeDefault(
    private val uiModeManager: UiModeManager,
    private val powerManager: PowerManager,
) : SystemTheme {
    override val isDarkTheme: Boolean
        get() {
            if (uiModeManager.isNightModeDisplaying) {
                return true
            }

            // As per Google's recommendation, enable dark theme if the device is in
            // power saving mode for pre-API 29 devices
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                return powerManager.isPowerSaveMode()
            }

            return false
        }

    private val _darkTheme by lazy { MutableStateFlow(isDarkTheme) }
    override val darkTheme: StateFlow<Boolean>
        get() = _darkTheme

    override fun update() {
        _darkTheme.value = isDarkTheme
    }
}
