package action.devicestate

import action.keyguard.KeyguardManager
import action.power.PowerManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.test.mock.MockContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DeviceStateSystemTest {
    @Test
    fun `screen off updates screen state without fabricating locked state`() {
        val context = BroadcastCapturingContext()
        val deviceState =
            DeviceStateSystem(
                context = context,
                powerManager = FakePowerManager(interactive = true),
                keyguardManager = MutableKeyguardManager(deviceLocked = false),
            )

        deviceState.register(context)
        context.dispatch(Intent.ACTION_SCREEN_OFF)

        assertFalse(deviceState.isScreenOn.value)
        assertFalse(deviceState.isDeviceLocked.value)
    }

    @Test
    fun `screen off preserves an existing locked state without fabricating a new one`() {
        val context = BroadcastCapturingContext()
        val deviceState =
            DeviceStateSystem(
                context = context,
                powerManager = FakePowerManager(interactive = true),
                keyguardManager = MutableKeyguardManager(deviceLocked = true),
            )

        deviceState.isDeviceLocked.value = true
        deviceState.register(context)
        context.dispatch(Intent.ACTION_SCREEN_OFF)

        assertFalse(deviceState.isScreenOn.value)
        assertTrue(deviceState.isDeviceLocked.value)
    }

    @Test
    fun `screen on refreshes evented lock state from queryDeviceLocked`() {
        val context = BroadcastCapturingContext()
        val keyguardManager = MutableKeyguardManager(deviceLocked = true)
        val deviceState =
            DeviceStateSystem(
                context = context,
                powerManager = FakePowerManager(interactive = false),
                keyguardManager = keyguardManager,
            )

        deviceState.isDeviceLocked.value = false
        deviceState.register(context)
        context.dispatch(Intent.ACTION_SCREEN_ON)

        assertTrue(deviceState.isScreenOn.value)
        assertTrue(deviceState.isDeviceLocked.value)
    }

    @Test
    fun `user present clears evented locked state`() {
        val context = BroadcastCapturingContext()
        val deviceState =
            DeviceStateSystem(
                context = context,
                powerManager = FakePowerManager(interactive = true),
                keyguardManager = MutableKeyguardManager(deviceLocked = true),
            )

        deviceState.isDeviceLocked.value = true
        deviceState.register(context)
        context.dispatch(Intent.ACTION_USER_PRESENT)

        assertFalse(deviceState.isDeviceLocked.value)
    }
}

private class BroadcastCapturingContext : MockContext() {
    private val receivers = mutableListOf<BroadcastReceiver>()

    override fun registerReceiver(
        receiver: BroadcastReceiver?,
        filter: IntentFilter?,
    ): Intent? {
        receiver?.let { receivers += it }
        return null
    }

    override fun unregisterReceiver(receiver: BroadcastReceiver?) {
        receiver?.let { receivers.remove(it) }
    }

    fun dispatch(action: String) {
        val intent = Intent(action)
        receivers.toList().forEach { receiver ->
            receiver.onReceive(this, intent)
        }
    }
}

private class FakePowerManager(
    private var interactive: Boolean,
) : PowerManager {
    override val powerSaveMode = MutableStateFlow(false)

    override fun isInteractive(): Boolean = interactive

    override fun isPowerSaveMode(): Boolean = powerSaveMode.value
}

private class MutableKeyguardManager(
    var deviceLocked: Boolean,
) : KeyguardManager {
    override fun isDeviceLocked(): Boolean = deviceLocked

    override fun isKeyguardLocked(): Boolean = deviceLocked

    override fun isDeviceSecure(): Boolean = true
}
