package action.devicestate

import kotlinx.coroutines.flow.MutableStateFlow

class DeviceStateMock(
    var _queryDeviceLocked: Boolean = false,
    _isScreenOn: Boolean = true,
    var _isUserUnlocked: Boolean = true,
    var _isPhone: Boolean = true,
    _isDeviceLocked: Boolean = false,
) : DeviceState {
    constructor(_queryDeviceLocked: Boolean = false, _isScreenOn: Boolean) :
        this(_queryDeviceLocked, _isScreenOn = _isScreenOn, _isUserUnlocked = true, _isPhone = true, _isDeviceLocked = false)

    override val queryDeviceLocked: Boolean
        get() = _queryDeviceLocked

    override val isDeviceLocked = MutableStateFlow(_isDeviceLocked)

    override val isScreenOn = MutableStateFlow(_isScreenOn)

    override val isUserUnlocked: Boolean
        get() = _isUserUnlocked

    override fun registerForUserUnlock(block: () -> Unit) { }

    override fun queryScreenOn(): Boolean = isScreenOn.value

    override val isPhone: Boolean
        get() = _isPhone
}
