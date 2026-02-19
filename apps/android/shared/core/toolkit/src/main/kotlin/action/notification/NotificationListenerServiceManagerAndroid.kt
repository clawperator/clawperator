package action.notification

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.service.notification.StatusBarNotification
import android.widget.Toast
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.TimeUnit

/**
 * Android implementation of NotificationListenerServiceManager.
 * Uses an in-process broadcast dispatcher to communicate with the notification service.
 */
class NotificationListenerServiceManagerAndroid(
    private val context: Context,
) : NotificationListenerServiceManager {
    private val packageManager: PackageManager get() = context.packageManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private val localDispatcher = InProcessBroadcastDispatcher(context, mainHandler)
    private var notificationEventReceiver: BroadcastReceiver? = null

    companion object {
        const val ACTION_COMMAND = "com.action.notif.SERVICE_COMMAND"
        const val ACTION_NOTIF_QUERIED = "com.action.ACTIVE_NOTIFICATIONS"
        const val ACTION_NOTIF_ADDED = "com.action.NOTIF_ADDED"
        const val ACTION_NOTIF_REMOVED = "com.action.NOTIF_REMOVED"
        const val ACTION_NOTIF_CLEAR_ALL = "com.action.NOTIF_CLEAR_ALL"

        const val EXTRA_COMMAND = "extra_command"
        const val EXTRA_NOTIFICATIONS = "extra_notifications"
        const val EXTRA_NOTIF_KEY = "extra_notif_key"
        const val EXTRA_NOTIF = "extra_notif"
    }

    enum class Command {
        UNBIND,
        REBIND,
        QUERY,
        CANCEL,
    }

    // Flow state holders
    private val _activeNotifications = MutableStateFlow<List<NotificationData>>(emptyList())
    private val _notificationAdded = MutableSharedFlow<NotificationData>()
    private val _notificationRemoved = MutableSharedFlow<NotificationData>()

    override fun enableService() {
        val intent = Intent(ACTION_COMMAND)
        intent.putExtra(EXTRA_COMMAND, Command.REBIND.ordinal)
        localDispatcher.sendBroadcast(intent)
    }

    override fun disableService() {
        val intent = Intent(ACTION_COMMAND)
        intent.putExtra(EXTRA_COMMAND, Command.UNBIND.ordinal)
        localDispatcher.sendBroadcast(intent)
    }

    override fun isServiceAllowedByUser(): Boolean {
        val componentName = ComponentName(context, NotificationListenerService::class.java)
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(componentName.flattenToString())
    }

    override fun requestNotificationAccess(toastMessage: String?) {
        val intent =
            Intent(
                Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS,
            )

        val infos = packageManager.queryIntentActivities(intent, 0)
        if (infos.isNotEmpty()) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }

        toastMessage?.let {
            Toast.makeText(context, it, Toast.LENGTH_LONG).show()
        }
    }

    override fun queryActiveNotifications() {
        val intent = Intent(ACTION_COMMAND)
        intent.putExtra(EXTRA_COMMAND, Command.QUERY.ordinal)
        localDispatcher.sendBroadcast(intent)
    }

    override fun cancelNotification(key: String) {
        val intent = Intent(ACTION_COMMAND)
        intent.putExtra(EXTRA_COMMAND, Command.CANCEL.ordinal)
        intent.putExtra(EXTRA_NOTIF_KEY, key)
        localDispatcher.sendBroadcast(intent)
    }

    /**
     * Cancel a notification by StatusBarNotification (for backward compatibility).
     *
     * Note: This method is not part of the NotificationListenerServiceManager interface
     * and will not be called by the NotificationListenerService. It's provided for
     * backward compatibility with legacy code that expects this overload.
     */
    fun cancelNotification(sbn: StatusBarNotification) {
        cancelNotification(sbn.key)
    }

    override fun tryAndTriggerServiceRestart() {
        if (isServiceAllowedByUser() && !NotificationListenerService.isListenerConnected) {
            val componentName = ComponentName(context, NotificationListenerService::class.java)
            packageManager.setComponentEnabledSetting(
                componentName,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP,
            )
            packageManager.setComponentEnabledSetting(
                componentName,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP,
            )
        }
    }

    override fun tryAndTriggerServiceRestartDelayed(delayMs: Long) {
        val timeToConfigureAfterBoot = TimeUnit.SECONDS.toMillis(120)
        val systemJustBooted = SystemClock.elapsedRealtime() < timeToConfigureAfterBoot
        val actualDelay = if (systemJustBooted) delayMs + timeToConfigureAfterBoot else delayMs

        Handler(Looper.getMainLooper()).postDelayed({
            tryAndTriggerServiceRestart()
        }, actualDelay)
    }

    override val activeNotifications: Flow<List<NotificationData>> = _activeNotifications.asStateFlow()

    override val notificationAdded: Flow<NotificationData> = _notificationAdded.asSharedFlow()

    override val notificationRemoved: Flow<NotificationData> = _notificationRemoved.asSharedFlow()

    /**
     * Register the command receiver to listen for service commands.
     */
    fun registerCommandReceiver(receiver: BroadcastReceiver) {
        val filter = IntentFilter(ACTION_COMMAND)
        localDispatcher.registerReceiver(receiver, filter)
    }

    /**
     * Unregister the command receiver.
     */
    fun unregisterCommandReceiver(receiver: BroadcastReceiver) {
        localDispatcher.unregisterReceiver(receiver)
    }

    /**
     * Create a broadcast receiver that listens for notification events.
     * This should be registered by the host application.
     */
    fun createNotificationEventReceiver(): BroadcastReceiver = NotificationEventReceiver()

    /**
     * Register the notification event receiver to listen for broadcast events.
     * This method is idempotent - it won't register the same receiver twice.
     */
    fun registerNotificationEventReceiver() {
        if (notificationEventReceiver == null) {
            notificationEventReceiver = createNotificationEventReceiver()
            val filter =
                IntentFilter().apply {
                    addAction(ACTION_NOTIF_QUERIED)
                    addAction(ACTION_NOTIF_ADDED)
                    addAction(ACTION_NOTIF_REMOVED)
                    addAction(ACTION_NOTIF_CLEAR_ALL)
                }
            notificationEventReceiver?.let { receiver ->
                localDispatcher.registerReceiver(receiver, filter)
            }
        }
        // If notificationEventReceiver is already non-null, we've already registered it
    }

    /**
     * Unregister the notification event receiver.
     */
    fun unregisterNotificationEventReceiver(receiver: BroadcastReceiver) {
        localDispatcher.unregisterReceiver(receiver)
    }

    /**
     * Clean up all registered receivers.
     * Note: This only unregisters the internal notification event receiver.
     * If external receivers were registered with registerNotificationEventReceiver(),
     * they need to be unregistered separately using unregisterNotificationEventReceiver().
     */
    fun cleanup() {
        notificationEventReceiver?.let { receiver ->
            localDispatcher.unregisterReceiver(receiver)
            notificationEventReceiver = null
        }
    }

    private inner class NotificationEventReceiver : BroadcastReceiver() {
        override fun onReceive(
            context: Context,
            intent: Intent,
        ) {
            when (intent.action) {
                ACTION_NOTIF_QUERIED -> {
                    val notifications = getNotificationsFromIntent(intent)
                    val notificationData = notifications.map { it.toNotificationData() }
                    _activeNotifications.value = notificationData
                }
                ACTION_NOTIF_ADDED -> {
                    getNotificationFromIntent(intent)?.let { sbn ->
                        val notificationData = sbn.toNotificationData()
                        _notificationAdded.tryEmit(notificationData)
                    }
                }
                ACTION_NOTIF_REMOVED -> {
                    getNotificationFromIntent(intent)?.let { sbn ->
                        val notificationData = sbn.toNotificationData()
                        _notificationRemoved.tryEmit(notificationData)
                    }
                }
                ACTION_NOTIF_CLEAR_ALL -> {
                    // Emit individual removal events before clearing
                    _activeNotifications.value.forEach { notification ->
                        _notificationRemoved.tryEmit(notification)
                    }
                    _activeNotifications.value = emptyList()
                }
            }
        }
    }

    private fun getNotificationFromIntent(intent: Intent): StatusBarNotification? = intent.getParcelableExtra(EXTRA_NOTIF)

    private fun getNotificationsFromIntent(intent: Intent): List<StatusBarNotification> {
        val data = intent.getParcelableArrayExtra(EXTRA_NOTIFICATIONS) as? Array<StatusBarNotification>
        return data?.toList() ?: emptyList()
    }

    /** Exposed so NotificationListenerService can send intents to this manager's receivers. */
    fun sendBroadcast(intent: Intent) {
        localDispatcher.sendBroadcast(intent)
    }
}

/**
 * In-process broadcast dispatcher. Replaces LocalBroadcastManager for same-process only delivery.
 */
private class InProcessBroadcastDispatcher(
    private val context: Context,
    private val mainHandler: Handler,
) {
    private val receivers = mutableListOf<Pair<IntentFilter, BroadcastReceiver>>()

    fun registerReceiver(receiver: BroadcastReceiver, filter: IntentFilter) {
        synchronized(receivers) {
            receivers.add(filter to receiver)
        }
    }

    fun unregisterReceiver(receiver: BroadcastReceiver) {
        synchronized(receivers) {
            receivers.removeAll { it.second == receiver }
        }
    }

    fun sendBroadcast(intent: Intent) {
        val action = intent.action ?: return
        val toNotify = synchronized(receivers) {
            receivers.filter { (filter, _) ->
                filter.countActions() > 0 && (0 until filter.countActions()).any { filter.getAction(it) == action }
            }.map { it.second }
        }
        mainHandler.post {
            toNotify.forEach { it.onReceive(context, intent) }
        }
    }
}
