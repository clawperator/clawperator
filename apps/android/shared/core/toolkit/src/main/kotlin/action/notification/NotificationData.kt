package action.notification

import action.system.model.ApplicationId

/**
 * Multiplatform data model representing a notification.
 * This wraps Android's StatusBarNotification data in a platform-agnostic way.
 */
data class NotificationData(
    val key: String,
    val applicationId: ApplicationId,
    val title: String,
    val text: String,
    val postTime: Long,
    val flags: Int = 0,
    val groupKey: String? = null,
    val isGroupSummary: Boolean = false,
    val isOngoing: Boolean = false,
    val intentAction: String? = null,
    val intentCategories: Set<String>? = null,
)
