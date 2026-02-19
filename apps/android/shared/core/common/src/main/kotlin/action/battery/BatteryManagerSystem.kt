package action.battery

import action.utils.updateValueIfNew
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

class BatteryManagerSystem(
    context: Context,
) : BatteryManager {
    private val systemBatteryManager by lazy {
        context.getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager
    }
    private val pollSystemIsCharging: Boolean?
        get() =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                systemBatteryManager.isCharging
            } else {
                null
            }

    private val _isCharging = MutableLiveData(pollSystemIsCharging ?: false)
    override val isCharging: LiveData<Boolean> get() = _isCharging

    init {
        context.registerReceiver(
            object : BroadcastReceiver() {
                override fun onReceive(
                    context: Context,
                    intent: Intent,
                ) {
                    when (intent.action) {
                        Intent.ACTION_POWER_CONNECTED -> {
                            _isCharging.updateValueIfNew(true)
                        }
                        Intent.ACTION_POWER_DISCONNECTED -> {
                            _isCharging.updateValueIfNew(false)
                        }
                    }
                }
            },
            IntentFilter().apply {
                addAction(Intent.ACTION_POWER_CONNECTED)
                addAction(Intent.ACTION_POWER_DISCONNECTED)
            },
        )
    }
}
