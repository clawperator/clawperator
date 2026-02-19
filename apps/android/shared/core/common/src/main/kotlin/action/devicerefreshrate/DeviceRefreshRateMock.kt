package action.devicerefreshrate

import kotlinx.coroutines.flow.MutableStateFlow

class DeviceRefreshRateMock(
    currentRefreshRate: Double,
    deviceSupportedRefreshRates: List<Double>,
) : DeviceRefreshRate {
    constructor(currentRefreshRate: Double = 60.0) : this(currentRefreshRate, listOf(currentRefreshRate))

    override val currentRefreshRate = MutableStateFlow(currentRefreshRate)

    val _deviceSupportedRefreshRates = deviceSupportedRefreshRates
    override val deviceSupportedRefreshRates: List<Double>
        get() = _deviceSupportedRefreshRates
}
