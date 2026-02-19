package action.device

/**
 * Returns *an* identifier for this device. Note: modern Android actively discourages using
 * such identifiers to user ID: https://developer.android.com/training/articles/user-data-ids.html
 *
 * This is only intended to be used a consistent device identifier for the duration of this
 * install, not a unique device id. It's entirely possible multiple devices will have the same
 * [bestDeviceId], especially in cases where the [DeviceIdSystem.fallbackId] is used.
 */
interface DeviceId {
    /**
     *
     */
    val bestDeviceId: String

    /**
     * The secure AndroidId returned from the device. Can be null.
     */
    val secureAndroidId: String?
}

class DeviceIdMock(
    override val bestDeviceId: String,
    override val secureAndroidId: String?,
) : DeviceId {
    constructor(deviceId: String) : this(deviceId, deviceId)
}
