package action.notification

import kotlinx.coroutines.flow.Flow

/**
 * Interface for managing notification listener service operations.
 * Provides Flow-based streams for active, added, and removed notifications.
 */
interface NotificationListenerServiceManager {
    /**
     * Enable the notification listener service.
     */
    fun enableService()

    /**
     * Disable the notification listener service.
     */
    fun disableService()

    /**
     * Check if the user has granted notification listener permission.
     */
    fun isServiceAllowedByUser(): Boolean

    /**
     * Request notification access permission from the user.
     * @param toastMessage Optional message to show to the user
     */
    fun requestNotificationAccess(toastMessage: String? = null)

    /**
     * Query active notifications from the system.
     */
    fun queryActiveNotifications()

    /**
     * Cancel a notification by its key.
     */
    fun cancelNotification(key: String)

    /**
     * Try to trigger a service restart if it crashed.
     */
    fun tryAndTriggerServiceRestart()

    /**
     * Try to trigger a service restart after a delay.
     */
    fun tryAndTriggerServiceRestartDelayed(delayMs: Long)

    /**
     * Flow of currently active notifications.
     */
    val activeNotifications: Flow<List<NotificationData>>

    /**
     * Flow of newly added notifications.
     */
    val notificationAdded: Flow<NotificationData>

    /**
     * Flow of removed notifications.
     */
    val notificationRemoved: Flow<NotificationData>
}
