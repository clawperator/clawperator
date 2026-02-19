package action.devicerefreshrate

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display
import android.view.WindowManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class DeviceRefreshRateSystem(
    context: Context,
) : DeviceRefreshRate {
    private val displayManager: DisplayManager by lazy { context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager }
    private val displayContext: Context by lazy {
        context.createDisplayContext(defaultDisplay)
    }
    private val windowContext: Context? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            displayContext.createWindowContext(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, null)
        } else {
            null
        }
    }
    private val defaultDisplay: Display by lazy { displayManager.getDisplay(Display.DEFAULT_DISPLAY) }
    private val _windowDisplay: Display? get() {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            windowContext?.display
        } else {
            null
        }.let {
            it ?: defaultDisplay
        }
    }
    private val display: Display
        get() = _windowDisplay ?: defaultDisplay

    private fun updateCurrentRefreshRate() {
        _currentRefreshRate.value = display.refreshRate.toDouble()
    }

    private val _currentRefreshRate = MutableStateFlow(display.refreshRate.toDouble())
    override val currentRefreshRate: StateFlow<Double>
        get() {
            updateCurrentRefreshRate()
            return _currentRefreshRate
        }

    override val deviceSupportedRefreshRates: List<Double> by lazy {
        mutableListOf<Double>()
            .apply {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                    @Suppress("DEPRECATION")
                    defaultDisplay.supportedRefreshRates.forEach { refreshRate ->
                        add(refreshRate.toDouble())
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    defaultDisplay.supportedModes.forEach { mode ->
                        add(mode.refreshRate.toDouble())
                    }
                }
            }.sortedBy { it }
    }
}
