package action.notification

import android.app.Notification
import android.service.notification.StatusBarNotification
import android.widget.ImageView

/**
 * Utility functions for notification handling.
 * Ported from legacy NotificationUtils.java
 */
object NotificationUtils {
    /**
     * Get the index of a notification in a list by matching package name, ID, and tag.
     */
    fun getIndex(
        list: List<NotificationData>,
        target: NotificationData,
    ): Int {
        for (i in list.indices) {
            val n = list[i]
            if (n.applicationId == target.applicationId && n.key == target.key) {
                return i
            }
        }
        return -1
    }

    /**
     * Get the total count from a list of notifications, considering notification.number.
     */
    fun getCount(notifications: List<NotificationData>): Int {
        return notifications.size // Simplified - could be enhanced with notification.number
    }

    /**
     * Check if two notifications have the same content.
     */
    fun contentsTheSame(
        n1: NotificationData,
        n2: NotificationData,
    ): Boolean = n1.title == n2.title && n1.text == n2.text

    /**
     * Check if a notification is a group summary.
     */
    fun isGroupSummary(flags: Int): Boolean = (flags and Notification.FLAG_GROUP_SUMMARY) != 0

    /**
     * Check if a notification is auto-cancel.
     */
    fun isAutoCancel(flags: Int): Boolean = (flags and Notification.FLAG_AUTO_CANCEL) != 0

    /**
     * Check if a notification is ongoing.
     */
    fun isOngoing(flags: Int): Boolean =
        (flags and Notification.FLAG_FOREGROUND_SERVICE) != 0 ||
            (flags and Notification.FLAG_ONGOING_EVENT) != 0

    /**
     * Set notification icon on an ImageView (Android-specific implementation).
     */
    fun setIcon(
        sbn: StatusBarNotification,
        imageView: ImageView,
    ) {
        val notification = sbn.notification
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val icon = notification.getLargeIcon()
            if (icon != null) {
                imageView.colorFilter = null
                imageView.setImageIcon(icon)
            } else {
                imageView.setColorFilter(NotificationColors.ICON_TINT)
                imageView.setImageIcon(notification.smallIcon)
            }
        } else {
            @Suppress("DEPRECATION")
            if (notification.largeIcon != null) {
                imageView.colorFilter = null
                imageView.setImageBitmap(notification.largeIcon)
            } else {
                imageView.setColorFilter(NotificationColors.ICON_TINT)
                val pm = imageView.context.packageManager
                val drawable = pm.getDrawable(sbn.packageName, notification.icon, null)
                imageView.setImageDrawable(drawable)
            }
        }
    }
} 
