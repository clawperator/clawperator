package action.notification

import action.coroutine.CoroutineScopes
import action.log.Log
import action.string.quote
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.koin.android.ext.android.inject
import android.service.notification.NotificationListenerService as AndroidNotificationListenerService

/**
 * Android NotificationListenerService implementation that delegates to a manager.
 */
class NotificationListenerService : AndroidNotificationListenerService() {
    companion object {
        var isListenerConnected = false

        const val Tag = "[NotificationListener]"

        fun log(message: String) = Log.d("$Tag $message")

        fun logi(message: String) = Log.i("$Tag $message")

        fun logv(message: String) = Log.v("$Tag $message")
    }

    private val manager: NotificationListenerServiceManager by inject()
    private val config: NotificationListenerConfig by inject()
    private val coroutineScopes: CoroutineScopes by inject()
    private val coroutineScopeMain: CoroutineScope get() = coroutineScopes.main
    private val coroutineScopeIo: CoroutineScope get() = coroutineScopes.io

    private var commandReceiver: BroadcastReceiver? = null

    override fun onCreate() {
        super.onCreate()

        logi("onCreate()")

        // Only proceed if manager and config are set
        commandReceiver = CommandReceiver()
        (manager as? NotificationListenerServiceManagerAndroid)?.let { androidManager ->
            androidManager.registerNotificationEventReceiver()
            commandReceiver?.let { receiver ->
                androidManager.registerCommandReceiver(receiver)
            }
        }
    }

    override fun onListenerConnected() {
        logi("onListenerConnected()")
        isListenerConnected = true

        if (config.isTrackingEnabled) {
            queryActiveNotifications()
        } else {
            unbindService()
        }
    }

    override fun onListenerDisconnected() {
        logi("onListenerDisconnected()")
        postAllNotificationsRemoved()
        isListenerConnected = false
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        log("onNotificationPosted() - ${sbn.packageName} - ${sbn.notification?.tickerText ?: "No ticker"}")
        if (config.isTrackingEnabled) {
            postNewNotification(sbn)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        log("onNotificationRemoved() - ${sbn.packageName} - ${sbn.notification?.tickerText ?: "No ticker"}")
        postNotificationRemoved(sbn)
    }

    override fun onDestroy() {
        logi("onDestroy()")
        // Cancel the injected coroutine scopes if they're SupervisorJob-based
        // Note: Host app is responsible for canceling these scopes during app shutdown

        // Unregister CommandReceiver first (this is the receiver that listens for commands from the manager)
        commandReceiver?.let { receiver ->
            (manager as? NotificationListenerServiceManagerAndroid)?.unregisterCommandReceiver(receiver)
        }

        // Then cleanup the manager (this unregisters the internal notification event receiver)
        // Note: If the host app registered additional receivers via registerNotificationEventReceiver(),
        // those need to be unregistered separately using unregisterNotificationEventReceiver()
        (manager as? NotificationListenerServiceManagerAndroid)?.cleanup()
        super.onDestroy()
    }

    private fun queryActiveNotifications() {
        if (!isListenerConnected || !config.isTrackingEnabled) {
            return
        }

        coroutineScopeIo.launch {
            try {
                val notifications = getActiveNotifications()
                log("queryActiveNotifications() - Found ${notifications.size} notifications")
                if (notifications.isNotEmpty()) {
                    notifications.forEachIndexed { index, it ->
                        val data = it.toNotificationData()
                        log(" notification[$index]: applicationId:${data.applicationId.quote()}, title:${data.title.quote()}, text:${data.text.quote()}")
                    }
                }
                withContext(coroutineScopeMain.coroutineContext) {
                    onNotificationsQueried(notifications)
                }
            } catch (e: Exception) {
                Log.e("$Tag queryActiveNotifications() failed", e)
            }
        }
    }

    private fun onNotificationsQueried(notifications: Array<StatusBarNotification>) {
        if (isListenerConnected && config.isTrackingEnabled) {
            postNotificationsQueried(notifications)
        }
    }

    private fun safeCancelNotification(key: String) {
        if (!isListenerConnected) {
            return
        }
        try {
            cancelNotification(key)
        } catch (e: Exception) {
            // Log error but don't crash
        }
    }

    private fun rebindService() {
        queryActiveNotifications()
    }

    private fun unbindService() {
        postAllNotificationsRemoved()
    }

    private fun postNewNotification(notification: StatusBarNotification) {
        val intent = Intent(NotificationListenerServiceManagerAndroid.ACTION_NOTIF_ADDED)
        intent.putExtra(NotificationListenerServiceManagerAndroid.EXTRA_NOTIF, notification)
        sendLocalBroadcast(intent)
    }

    private fun postNotificationRemoved(notification: StatusBarNotification) {
        val intent = Intent(NotificationListenerServiceManagerAndroid.ACTION_NOTIF_REMOVED)
        intent.putExtra(NotificationListenerServiceManagerAndroid.EXTRA_NOTIF, notification)
        sendLocalBroadcast(intent)
    }

    private fun postNotificationsQueried(notifications: Array<StatusBarNotification>) {
        val intent = Intent(NotificationListenerServiceManagerAndroid.ACTION_NOTIF_QUERIED)
        intent.putExtra(NotificationListenerServiceManagerAndroid.EXTRA_NOTIFICATIONS, notifications)
        sendLocalBroadcast(intent)
    }

    private fun postAllNotificationsRemoved() {
        val intent = Intent(NotificationListenerServiceManagerAndroid.ACTION_NOTIF_CLEAR_ALL)
        sendLocalBroadcast(intent)
    }

    private fun sendLocalBroadcast(intent: Intent) {
        (manager as? NotificationListenerServiceManagerAndroid)?.sendBroadcast(intent)
    }

    private inner class CommandReceiver : BroadcastReceiver() {
        override fun onReceive(
            context: Context,
            intent: Intent,
        ) {
            val androidManager = manager as? NotificationListenerServiceManagerAndroid
            val commandOrdinal = intent.getIntExtra(NotificationListenerServiceManagerAndroid.EXTRA_COMMAND, -1)

            if (commandOrdinal >= 0 && commandOrdinal < NotificationListenerServiceManagerAndroid.Command.entries.size) {
                val command = NotificationListenerServiceManagerAndroid.Command.entries[commandOrdinal]

                when (command) {
                    NotificationListenerServiceManagerAndroid.Command.UNBIND -> unbindService()
                    NotificationListenerServiceManagerAndroid.Command.REBIND -> rebindService()
                    NotificationListenerServiceManagerAndroid.Command.QUERY -> queryActiveNotifications()
                    NotificationListenerServiceManagerAndroid.Command.CANCEL -> {
                        val key = intent.getStringExtra(NotificationListenerServiceManagerAndroid.EXTRA_NOTIF_KEY)
                        key?.let { safeCancelNotification(it) }
                    }
                }
            }
        }
    }
}
