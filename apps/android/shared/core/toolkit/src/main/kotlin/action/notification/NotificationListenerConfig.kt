package action.notification

import action.system.model.ApplicationId

/**
 * Configuration interface for notification listening functionality.
 * Provides settings that control how notifications are tracked and filtered.
 */
interface NotificationListenerConfig {
    /**
     * Whether notification tracking is enabled globally.
     */
    val isTrackingEnabled: Boolean

    /**
     * Whether notifications are disabled for a specific package.
     */
    fun areNotificationsDisabledFor(applicationId: ApplicationId): Boolean

    /**
     * Whether the app should show a notification for a given intent.
     * Used to filter out deep shortcuts and other non-main intents.
     */
    fun canShowNotificationForIntent(
        action: String?,
        categories: Set<String>?,
    ): Boolean

    /**
     * Clean up resources and unregister listeners.
     */
    fun destroy()
}
