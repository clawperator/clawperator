package action.power

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import kotlinx.coroutines.flow.MutableStateFlow

class PowerManagerSystem(
    context: Context,
) : PowerManager {
    private val systemPowerManager by lazy {
        context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
    }

    private var isPowerSaveMode = systemPowerManager.isPowerSaveMode
    override val powerSaveMode = MutableStateFlow(isPowerSaveMode)

    init {
        context.registerReceiver(
            object : BroadcastReceiver() {
                override fun onReceive(
                    context: Context,
                    intent: Intent,
                ) {
                    if (intent.action == android.os.PowerManager.ACTION_POWER_SAVE_MODE_CHANGED) {
                        isPowerSaveMode = systemPowerManager.isPowerSaveMode
                        powerSaveMode.value = isPowerSaveMode
                    }
                }
            },
            IntentFilter(android.os.PowerManager.ACTION_POWER_SAVE_MODE_CHANGED),
        )
    }

    override fun isInteractive() = systemPowerManager.isInteractive

    override fun isPowerSaveMode() = isPowerSaveMode
}
