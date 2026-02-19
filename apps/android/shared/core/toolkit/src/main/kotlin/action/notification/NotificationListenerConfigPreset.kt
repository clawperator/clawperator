package action.notification

import action.system.model.ApplicationId

class NotificationListenerConfigPreset : NotificationListenerConfig {
    override val isTrackingEnabled: Boolean
        get() = true

    override fun areNotificationsDisabledFor(applicationId: ApplicationId): Boolean = false

    override fun canShowNotificationForIntent(
        action: String?,
        categories: Set<String>?,
    ): Boolean = true

    override fun destroy() = Unit
}
