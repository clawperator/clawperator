package action.time

import action.log.Log
import action.system.settings.SystemSettingsRepository
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import kotlinx.coroutines.flow.MutableStateFlow

class TimeRepositorySystem(
    private val systemSettingsRepository: SystemSettingsRepository,
) : TimeRepository() {
    override val currentTime: Long
        get() = getCurrentTimeMillis()

    override val elapsedRealtime: Long
        get() = SystemClock.elapsedRealtime()

    override val isUsingAutomaticSystemTime: Boolean
        get() = systemSettingsRepository.isUsingAutomaticSystemTime

    override val userChangedSystemTime = MutableStateFlow(1)

    private val broadcastReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context,
                intent: Intent,
            ) {
                if (intent.action == Intent.ACTION_TIME_CHANGED) {
                    Log.d("[utimechange] ACTION_TIME_CHANGED")
                    userChangedSystemTime.value += 1
                }
            }
        }

    fun registerForUserTimeChange(context: Context) {
        context.registerReceiver(
            broadcastReceiver,
            IntentFilter().apply {
                addAction(Intent.ACTION_TIME_CHANGED)
            },
        )
    }
}
