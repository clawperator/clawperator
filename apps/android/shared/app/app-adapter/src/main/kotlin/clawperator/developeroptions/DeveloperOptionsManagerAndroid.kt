package clawperator.developeroptions

import android.content.Context
import android.provider.Settings
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

class DeveloperOptionsManagerAndroid(
    private val context: Context,
) : DeveloperOptionsManager {

    override val isEnabled: Flow<Boolean> = settingFlow(
        Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
    )

    override val isUsbDebuggingEnabled: Flow<Boolean> = settingFlow(
        Settings.Global.ADB_ENABLED,
    )

    private fun settingFlow(settingName: String): Flow<Boolean> = callbackFlow {
        fun read(): Boolean =
            Settings.Global.getInt(context.contentResolver, settingName, 0) == 1

        trySend(read())

        val observer = object : android.database.ContentObserver(null) {
            override fun onChange(selfChange: Boolean) {
                trySend(read())
            }
        }
        context.contentResolver.registerContentObserver(
            Settings.Global.CONTENT_URI,
            true,
            observer,
        )
        awaitClose {
            context.contentResolver.unregisterContentObserver(observer)
        }
    }.distinctUntilChanged()
}
