package action.devicestate

import action.keyguard.KeyguardManager
import action.log.Log
import action.power.PowerManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import androidx.core.os.UserManagerCompat
import kotlinx.coroutines.flow.MutableStateFlow
import java.lang.ref.WeakReference
import action.common.R as ResourcesR

class DeviceStateSystem(
    private val context: Context,
    private val powerManager: PowerManager,
    private val keyguardManager: KeyguardManager,
) : DeviceState {
    override val queryDeviceLocked: Boolean
        get() = keyguardManager.isDeviceLocked()

    override val isDeviceLocked = MutableStateFlow(queryDeviceLocked)

    override val isScreenOn = MutableStateFlow(powerManager.isInteractive())

    override val isUserUnlocked: Boolean
        get() = UserManagerCompat.isUserUnlocked(context)

    private var registeredContext: WeakReference<Context>? = null

    private val userUnlockBlocks = mutableListOf<UserUnlockBlock>()

    private val userUnlockBroadcastReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context?,
                intent: Intent?,
            ) {
                userUnlockBlocks.forEach { it() }
                userUnlockBlocks.clear()
                this@DeviceStateSystem.context.unregisterReceiver(this)
            }
        }

    /**
     * To allow an implementation to register [BroadcastReceiver]s.
     */
    fun register(context: Context) {
        if (registeredContext == null) {
            registeredContext = WeakReference(context)
            context.registerReceiver(
                broadcastReceiver,
                IntentFilter().apply {
                    addAction(Intent.ACTION_SCREEN_ON)
                    addAction(Intent.ACTION_SCREEN_OFF)
                    addAction(Intent.ACTION_USER_PRESENT)
                },
            )
        }
    }

    /**
     * To allow an implementation to unregister any [BroadcastReceiver]s.
     */
    fun unregister(context: Context) {
        registeredContext?.get()?.let {
            context.unregisterReceiver(broadcastReceiver)
            registeredContext = null
        }
    }

    override fun registerForUserUnlock(block: UserUnlockBlock) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            if (userUnlockBlocks.isEmpty()) {
                context.registerReceiver(
                    userUnlockBroadcastReceiver,
                    IntentFilter(Intent.ACTION_USER_UNLOCKED),
                )
            }
            userUnlockBlocks.add(block)
        }
    }

    override fun queryScreenOn(): Boolean = powerManager.isInteractive()

    private val broadcastReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context,
                intent: Intent,
            ) {
                when (intent.action) {
                    Intent.ACTION_SCREEN_OFF -> {
                        isScreenOn.value = false
                        isDeviceLocked.value = true
                        Log.d("ACTION_SCREEN_OFF")
                    }
                    Intent.ACTION_SCREEN_ON -> {
                        isScreenOn.value = true
                        isDeviceLocked.value = queryDeviceLocked
                        Log.d("ACTION_SCREEN_ON")
                    }
                    Intent.ACTION_USER_PRESENT -> {
                        isDeviceLocked.value = false
                        Log.d("ACTION_USER_PRESENT")
                    }
                }
            }
        }

    override val isPhone: Boolean by lazy {
        !context.resources.getBoolean(ResourcesR.bool.is_tablet)
    }
}
