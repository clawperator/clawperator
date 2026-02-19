package action.devicerefreshrate

import kotlinx.coroutines.flow.StateFlow

/**
 * Details about the device refresh rate.
 */
interface DeviceRefreshRate {
    /**
     * Note: this value can change at runtime (such as when using a Pixel 5, which has variable
     * refresh rate).
     */
    val currentRefreshRate: StateFlow<Double>

    val deviceSupportedRefreshRates: List<Double>
}
