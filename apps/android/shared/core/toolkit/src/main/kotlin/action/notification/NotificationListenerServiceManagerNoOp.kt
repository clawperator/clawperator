package action.notification

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flowOf

class NotificationListenerServiceManagerNoOp : NotificationListenerServiceManager {
    override fun enableService() = Unit

    override fun disableService() = Unit

    override fun isServiceAllowedByUser(): Boolean = false

    override fun requestNotificationAccess(toastMessage: String?) = Unit

    override fun queryActiveNotifications() = Unit

    override fun cancelNotification(key: String) = Unit

    override fun tryAndTriggerServiceRestart() = Unit

    override fun tryAndTriggerServiceRestartDelayed(delayMs: Long) = Unit

    override val activeNotifications: Flow<List<NotificationData>>
        get() = flowOf(emptyList())
    override val notificationAdded: Flow<NotificationData>
        get() = emptyFlow()
    override val notificationRemoved: Flow<NotificationData>
        get() = emptyFlow()
}
