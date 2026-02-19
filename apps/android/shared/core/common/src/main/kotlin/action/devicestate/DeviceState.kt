package action.devicestate

import kotlinx.coroutines.flow.Flow

/**
 * A helper class that provides up to date information about the
 * state of the device, such as [isScreenOn] and [queryDeviceLocked].
 */
interface DeviceState {
    /**
     * Is the device currently locked? Will be true if the device has a
     * lock screen, and it is either currently displaying or will display
     * upon the device's screen turning on.
     */
    val queryDeviceLocked: Boolean

    /**
     * Similar to [queryDeviceLocked] but provides events upon locking/unlocking
     * of device.
     * One major difference is that this value will be true when screen is turned off,
     * regardless of the fact that the device is actually locked or not. This doesn't
     * cause any problems because the value is turned false when the screen turns
     * on and the device was never locked.
     */
    val isDeviceLocked: Flow<Boolean>

    /**
     * Is the device's screen currently on?
     *
     * See also [queryScreenOn].
     */
    val isScreenOn: Flow<Boolean>

    /**
     * To be used for immediate access to the state of screen on or off.
     * The difference between this and [isScreenOn] is the need for immediate access to this info.
     * Since [isScreenOn] has to be backed by a listener like a BroadcastReceiver, there could
     * be delay in posting that info to [isScreenOn].
     */
    fun queryScreenOn(): Boolean

    val isUserUnlocked: Boolean

    fun registerForUserUnlock(block: () -> Unit)

    /**
     * true if the device smallest width < 600dp, false otherwise.
     */
    val isPhone: Boolean
}

typealias UserUnlockBlock = () -> Unit
