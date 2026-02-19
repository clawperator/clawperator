package action.notification

import android.app.Notification
import android.service.notification.StatusBarNotification

/**
 * Extension function to map [StatusBarNotification] to [NotificationData].
 */
fun StatusBarNotification.toNotificationData(): NotificationData {
    val notification = this.notification
    val extras = notification.extras

    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

    val flags = notification.flags
    val isGroupSummary = (flags and Notification.FLAG_GROUP_SUMMARY) != 0
    val isOngoing = (flags and (Notification.FLAG_FOREGROUND_SERVICE or Notification.FLAG_ONGOING_EVENT)) != 0

    // Extract intent action and categories from contentIntent
    val contentIntent = notification.contentIntent
    var intentAction: String? = null
    var intentCategories: Set<String>? = null

    // Note: PendingIntent doesn't expose the underlying Intent details for security reasons.
    // In practice, you would need to examine the Intent when the notification was created,
    // or use other notification properties to determine if it should be filtered.
    // For now, we'll leave these null and rely on other filtering mechanisms.
    intentAction = null
    intentCategories = null

    return NotificationData(
        key = this.key,
        applicationId = this.packageName,
        title = title,
        text = text,
        postTime = this.postTime,
        flags = flags,
        groupKey = this.groupKey,
        isGroupSummary = isGroupSummary,
        isOngoing = isOngoing,
        intentAction = intentAction,
        intentCategories = intentCategories,
    )
}
