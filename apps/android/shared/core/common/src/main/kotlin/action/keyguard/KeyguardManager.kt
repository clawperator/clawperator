package action.keyguard

interface KeyguardManager {
    /**
     * For API >= 22, returns whether the device is currently locked with a PIN, pattern or other secure method.
     * Otherwise, returns whether the device is currently locked.
     */
    fun isDeviceLocked(): Boolean

    /**
     * Returns whether the device is currently locked.
     */
    fun isKeyguardLocked(): Boolean

    /**
     * Returns whether the device is secured with a PIN, pattern or password.
     */
    fun isDeviceSecure(): Boolean
}

class KeyguardManagerMock(
    val deviceLocked: Boolean = false,
    val keyguardLocked: Boolean = false,
    val deviceSecure: Boolean = true,
) : KeyguardManager {
    override fun isDeviceLocked(): Boolean = deviceLocked

    override fun isKeyguardLocked(): Boolean = keyguardLocked

    override fun isDeviceSecure(): Boolean = deviceSecure
}
